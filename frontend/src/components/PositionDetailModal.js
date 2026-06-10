import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { CurrencyAmount, formatDual } from '../utils/currency';
import './PositionDetailModal.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const fmt = (v, dec = 2) =>
  Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtPct = (v) => `${fmt(v)} %`;
const fmtVol = (v) => {
  if (v == null) return '—';
  if (v >= 1_000_000) return `${fmt(v / 1_000_000, 1)} Mio.`;
  if (v >= 1_000)     return `${fmt(v / 1_000, 1)} Tsd.`;
  return fmt(v, 0);
};

const Row = ({ label, value, accent, muted, children }) => (
  <div className={`dr ${accent ? 'dr-accent' : ''} ${muted ? 'dr-muted' : ''}`}>
    <span className="dr-label">{label}</span>
    <span className="dr-value">{children ?? value ?? '—'}</span>
  </div>
);

const kgvClass = (pe) => {
  if (pe == null) return '';
  if (pe < 10)  return 'kgv-low';
  if (pe < 20)  return 'kgv-mid';
  if (pe < 40)  return 'kgv-high';
  return 'kgv-rocket';
};

const pegClass = (peg) => {
  if (peg == null) return '';
  if (peg < 1)   return 'peg-cheap';
  if (peg <= 1.5) return 'peg-fair';
  return 'peg-expensive';
};

const Badge = ({ value, cls }) => (
  <span className={`metric-badge ${cls}`}>{value}</span>
);

const Sec = ({ title, children }) => (
  <div className="ds">
    <div className="ds-title">{title}</div>
    {children}
  </div>
);

const PositionDetailModal = ({ position, quote, fxRate, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Currency handling ────────────────────────────────────────────────────
  // Native currency is the primary display everywhere; € is shown as secondary info.
  const nativeCurrency = quote?.currency || 'EUR';
  const currentPriceNative = quote?.price ?? null;
  // EUR equivalent of the live price (ground truth for all P&L math)
  const currentPrice = nativeCurrency === 'EUR'
    ? currentPriceNative
    : (fxRate ? currentPriceNative / fxRate : null);

  // EUR ground-truth value -> native currency
  const toNative = (v) => (v == null) ? null : (nativeCurrency === 'EUR' ? v : (fxRate ? v * fxRate : null));
  // Native-currency ground-truth value -> EUR
  const toEur = (v) => (v == null) ? null : (nativeCurrency === 'EUR' ? v : (fxRate ? v / fxRate : null));

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API_URL}/stocks/details`, { params: { symbol: position.ticker } })
      .then((r) => setDetail(r.data.detail))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [position.ticker]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Investment calculations ──────────────────────────────────────────────
  const kurs = position.quantity > 0 ? position.purchase_cost / position.quantity : 0;
  const acquisitionCost = position.purchase_cost + (position.purchase_fee || 0);
  const sellFeePercentDec = (position.sell_fee_percent || 0) / 100;
  const sellFeeFixed      = position.sell_fee_fixed || 0;
  const taxRateDec        = (position.tax_rate || 26.375) / 100;
  const sellDenom         = position.quantity * (1 - sellFeePercentDec);

  let saleGross = null, sellFeeAmt = null, netSale = null, tax = null,
      netProceeds = null, netProfit = null;
  if (currentPrice !== null) {
    saleGross   = currentPrice * position.quantity;
    sellFeeAmt  = sellFeeFixed + sellFeePercentDec * saleGross;
    netSale     = saleGross - sellFeeAmt;
    tax         = Math.max(0, netSale - acquisitionCost) * taxRateDec;
    netProceeds = netSale - tax;
    netProfit   = netProceeds - acquisitionCost;
  }

  const breakEvenPrice = sellDenom > 0
    ? (acquisitionCost + sellFeeFixed) / sellDenom : null;
  const targetPrice = (r) => {
    if (sellDenom <= 0 || taxRateDec >= 1) return null;
    return (acquisitionCost * (1 + r - taxRateDec) / (1 - taxRateDec) + sellFeeFixed) / sellDenom;
  };

  const tsActivation = targetPrice(0.01);
  const pct    = currentPrice !== null && kurs > 0 ? ((currentPrice - kurs) / kurs) * 100 : null;
  const tsActive = currentPrice !== null && tsActivation !== null && currentPrice >= tsActivation;
  const stopBase = tsActive ? currentPrice : tsActivation;

  const targets = [
    { label: 'Break-even', price: breakEvenPrice },
    { label: '+1 %',       price: targetPrice(0.01) },
    { label: '+5 %',       price: targetPrice(0.05) },
    { label: '+10 %',      price: targetPrice(0.10) },
  ];
  const stops = [
    { label: 'Stopp 8 %',  price: stopBase * 0.92 },
    { label: 'Stopp 10 %', price: stopBase * 0.90 },
    { label: 'Stopp 12 %', price: stopBase * 0.88 },
  ];

  const d = detail;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>

        <div className="modal-head">
          <div>
            <span className="modal-ticker">{position.ticker}</span>
            <span className="modal-fullname">{d?.name || position.name}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-scroll">
          {loading && <div className="modal-loading">Lade Daten…</div>}

          <div className="modal-cols">
            {/* ── Left column ─────────────────────────────────────── */}
            <div className="modal-col">

              <Sec title="Wertpapier">
                <Row label="Symbol"  value={position.ticker} />
                {d?.isin     && <Row label="ISIN"    value={d.isin} />}
                {d?.exchange  && <Row label="Börse"   value={d.exchange} />}
                {d?.sector    && <Row label="Sektor"  value={d.sector} />}
                {d?.industry  && <Row label="Branche" value={d.industry} />}
              </Sec>

              <Sec title="Marktdaten">
                <Row label="Aktueller Kurs" accent>
                  <CurrencyAmount native={currentPriceNative} eur={toEur(currentPriceNative)} currency={nativeCurrency} />
                </Row>
                <Row label="Veränderung ggü. Kauf"
                  value={pct !== null ? `${pct >= 0 ? '+' : ''}${fmt(pct)} %` : '…'} />
                {d?.dayHigh != null && d?.dayLow != null && (
                  <Row label="Tageshoch / -tief"
                    value={`${formatDual(d.dayHigh, toEur(d.dayHigh), nativeCurrency)} / ${formatDual(d.dayLow, toEur(d.dayLow), nativeCurrency)}`} />
                )}
                {d?.volume != null && (
                  <Row label="Volumen" value={fmtVol(d.volume)} />
                )}
                {d?.fiftyTwoWeekHigh != null && d?.fiftyTwoWeekLow != null && (
                  <Row label="52-Wochen-Spanne"
                    value={`${formatDual(d.fiftyTwoWeekLow, toEur(d.fiftyTwoWeekLow), nativeCurrency)} – ${formatDual(d.fiftyTwoWeekHigh, toEur(d.fiftyTwoWeekHigh), nativeCurrency)}`} />
                )}
              </Sec>

              {(d?.trailingPE != null || d?.eps != null || d?.dividendYield != null || d?.analystTargetPrice != null) && (
                <Sec title="Kennzahlen">
                  {d?.trailingPE != null && (
                    <Row label="KGV (trailing)">
                      <Badge value={fmt(d.trailingPE)} cls={kgvClass(d.trailingPE)} />
                    </Row>
                  )}
                  {d?.forwardPE != null && (
                    <Row label="KGV (forward)">
                      <Badge value={fmt(d.forwardPE)} cls={kgvClass(d.forwardPE)} />
                    </Row>
                  )}
                  {d?.pegRatio != null && (
                    <Row label="PEG-Ratio">
                      <Badge value={fmt(d.pegRatio)} cls={pegClass(d.pegRatio)} />
                    </Row>
                  )}
                  {d?.eps  != null && <Row label="EPS"  value={`${fmt(d.eps)} ${d.currency || ''}`} />}
                  {d?.beta != null && <Row label="Beta" value={fmt(d.beta)} />}
                  {d?.dividendYield != null && (
                    <Row label="Dividendenrendite" value={fmtPct(d.dividendYield * 100)} />
                  )}
                  {d?.dividendPerShare != null && (
                    <Row label="Dividende / Aktie" value={`${fmt(d.dividendPerShare)} ${d.currency || ''}`} />
                  )}
                  {d?.lastDividendAmount != null && (
                    <Row label="Jahresdividende" value={`${fmt(d.lastDividendAmount)} ${d.currency || ''}`} />
                  )}
                  {d?.analystTargetPrice != null && (
                    <Row label="Analystenkurs" accent>
                      <CurrencyAmount native={d.analystTargetPrice} eur={toEur(d.analystTargetPrice)} currency={nativeCurrency} />
                    </Row>
                  )}

                  <div className="metric-legend">
                    <div className="metric-legend-group">
                      <span className="metric-legend-title">KGV</span>
                      <span className="metric-badge kgv-low">&lt;10 günstig</span>
                      <span className="metric-badge kgv-mid">10–20 normal</span>
                      <span className="metric-badge kgv-high">20–40 teuer</span>
                      <span className="metric-badge kgv-rocket">40+ Wachstum</span>
                    </div>
                    <div className="metric-legend-group">
                      <span className="metric-legend-title">PEG</span>
                      <span className="metric-badge peg-cheap">&lt;1 günstig</span>
                      <span className="metric-badge peg-fair">≈1 fair</span>
                      <span className="metric-badge peg-expensive">&gt;1.5 teuer</span>
                    </div>
                    <div className="metric-legend-warning">
                      ⚠ KGV allein sagt wenig — Branche und Wachstum beachten. Banken: 6–12 · Industrie: 10–18 · Tech: 20–60+
                    </div>
                  </div>
                </Sec>
              )}
            </div>

            {/* ── Right column ─────────────────────────────────────── */}
            <div className="modal-col">

              <Sec title="Dein Investment">
                <Row label="Menge"             value={position.quantity} />
                <Row label="Kaufkurs / Aktie">
                  <CurrencyAmount native={toNative(kurs)} eur={kurs} currency={nativeCurrency} />
                </Row>
                <Row label="Kaufpreis gesamt">
                  <CurrencyAmount native={toNative(position.purchase_cost)} eur={position.purchase_cost} currency={nativeCurrency} />
                </Row>
                <Row label="Kaufgebühr fix">
                  <CurrencyAmount native={toNative(position.purchase_fee_fixed)} eur={position.purchase_fee_fixed} currency={nativeCurrency} />
                </Row>
                <Row label="Kaufgebühr %"      value={fmtPct(position.purchase_fee_percent)} />
                <Row label="Kaufgebühren ges.">
                  <CurrencyAmount native={toNative(position.purchase_fee)} eur={position.purchase_fee} currency={nativeCurrency} />
                </Row>
                <Row label="Einstandspreis" accent>
                  <CurrencyAmount native={toNative(acquisitionCost)} eur={acquisitionCost} currency={nativeCurrency} />
                </Row>
              </Sec>

              {currentPrice !== null && (
                <Sec title={`Verkauf bei ${formatDual(currentPriceNative, currentPrice, nativeCurrency)}`}>
                  <Row label="Bruttoerlös">
                    <CurrencyAmount native={toNative(saleGross)} eur={saleGross} currency={nativeCurrency} />
                  </Row>
                  <Row label="Verkaufsgebühr fix">
                    <CurrencyAmount native={toNative(sellFeeFixed)} eur={sellFeeFixed} currency={nativeCurrency} />
                  </Row>
                  <Row label="Verkaufsgebühr %"        value={fmtPct(position.sell_fee_percent)} />
                  <Row label="Verkaufsgebühren ges.">
                    <CurrencyAmount native={toNative(sellFeeAmt)} eur={sellFeeAmt} currency={nativeCurrency} />
                  </Row>
                  <Row label="Nettoerlös (vor Steuer)">
                    <CurrencyAmount native={toNative(netSale)} eur={netSale} currency={nativeCurrency} />
                  </Row>
                  <Row label={`Steuer (${fmt(position.tax_rate)} %)`} muted={tax <= 0}>
                    {tax > 0 ? <CurrencyAmount native={toNative(tax)} eur={tax} currency={nativeCurrency} /> : '—'}
                  </Row>
                  <Row label="Nettoerlös" accent>
                    <CurrencyAmount native={toNative(netProceeds)} eur={netProceeds} currency={nativeCurrency} />
                  </Row>
                  <Row label="Nettogewinn/-verlust" accent>
                    <CurrencyAmount native={toNative(netProfit)} eur={netProfit} currency={nativeCurrency} signed />
                  </Row>
                </Sec>
              )}
            </div>
          </div>

          {/* ── Unternehmensbeschreibung ─────────────────────────── */}
          {d?.description && (
            <Sec title="Über das Unternehmen">
              <p className="ds-description">{d.description}</p>
            </Sec>
          )}

          {/* ── Zielpreise ───────────────────────────────────────── */}
          {breakEvenPrice !== null && (
            <Sec title="Zielpreise">
              <div className="target-grid">
                {targets.map(({ label, price }) => {
                  const reached = currentPrice !== null && price !== null && currentPrice >= price;
                  return (
                    <div key={label} className={`target-card ${reached ? 'target-reached' : ''}`}>
                      <div className="tc-label">{label}</div>
                      <div className="tc-price">
                        {price != null
                          ? <CurrencyAmount native={toNative(price)} eur={price} currency={nativeCurrency} />
                          : '—'}
                      </div>
                      <div className="tc-dist">
                        {currentPrice !== null && price !== null
                          ? reached ? '✓ erreicht' : `noch ${formatDual(toNative(price - currentPrice), price - currentPrice, nativeCurrency)}`
                          : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Sec>
          )}

          {/* ── Trailing Stop ─────────────────────────────────────── */}
          {tsActivation !== null && (
            <Sec title="Trailing Stop">
              <div className={`ts-activation-row ${tsActive ? 'ts-active' : ''}`}>
                <span>Aktivierung ab</span>
                <span className="ts-act-price">
                  <CurrencyAmount native={toNative(tsActivation)} eur={tsActivation} currency={nativeCurrency} />
                </span>
                <span className="ts-act-status">{tsActive ? '✓ aktiv' : 'noch nicht aktiv'}</span>
              </div>
              {tsActive && (
                <div className="ts-base-note">
                  Stoppkurse basieren auf aktuellem Kurs {formatDual(toNative(currentPrice), currentPrice, nativeCurrency)}
                </div>
              )}
              <div className="target-grid ts-grid">
                {stops.map(({ label, price }) => (
                  <div key={label} className={`target-card ts-card ${tsActive ? 'ts-triggered' : ''}`}>
                    <div className="tc-label">{label}</div>
                    <div className="tc-price">
                      <CurrencyAmount native={toNative(price)} eur={price} currency={nativeCurrency} />
                    </div>
                    <div className="tc-dist">
                      {tsActive && currentPrice !== null
                        ? `Abstand ${formatDual(toNative(currentPrice - price), currentPrice - price, nativeCurrency)}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </Sec>
          )}
        </div>
      </div>
    </div>
  );
};

export default PositionDetailModal;
