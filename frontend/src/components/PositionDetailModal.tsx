import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog, DialogContent, DialogTitle, IconButton, Box, Typography,
  Grid, Chip, CircularProgress, Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Position, StockDetail } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const fmt = (v: number | null | undefined, dec = 2): string =>
  Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtEur = (v: number | null | undefined): string => `${fmt(v)} €`;
const fmtPct = (v: number | null | undefined): string => `${fmt(v)} %`;
const fmtVol = (v: number | null | undefined): string => {
  if (v == null) return '—';
  if (v >= 1000000) return `${fmt(v / 1000000, 1)} Mio.`;
  if (v >= 1000) return `${fmt(v / 1000, 1)} Tsd.`;
  return fmt(v, 0);
};

const kgvColor = (pe: number | undefined): 'success' | 'warning' | 'error' | 'default' => {
  if (pe == null) return 'default';
  if (pe < 10) return 'success';
  if (pe < 20) return 'default';
  if (pe < 40) return 'warning';
  return 'error';
};
const pegColor = (peg: number | undefined): 'success' | 'warning' | 'error' | 'default' => {
  if (peg == null) return 'default';
  if (peg < 1) return 'success';
  if (peg <= 1.5) return 'warning';
  return 'error';
};

interface DataRowProps { label: string; value?: React.ReactNode; accent?: boolean; muted?: boolean; }
const DataRow: React.FC<DataRowProps> = ({ label, value, accent, muted }) => (
  <Box display="flex" justifyContent="space-between" py={0.4} px={1}
    sx={{ opacity: muted ? 0.5 : 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={accent ? 700 : 400} color={accent ? 'primary.main' : 'text.primary'}>
      {value ?? '—'}
    </Typography>
  </Box>
);

interface SectionProps { title: string; children: React.ReactNode; }
const Section: React.FC<SectionProps> = ({ title, children }) => (
  <Box mb={2}>
    <Typography variant="caption" fontWeight={700} color="text.secondary"
      sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', pl: 1 }}>{title}</Typography>
    <Paper variant="outlined" sx={{ mt: 0.5, overflow: 'hidden' }}>{children}</Paper>
  </Box>
);

interface Props { position: Position; currentPrice: number | null; onClose: () => void; }

const PositionDetailModal: React.FC<Props> = ({ position, currentPrice, onClose }) => {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_URL}/stocks/details`, { params: { symbol: position.ticker } })
      .then((r) => setDetail(r.data.detail))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [position.ticker]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    globalThis.addEventListener('keydown', onKey);
    return () => globalThis.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Calculations ────────────────────────────────────────────────────────
  const kurs = position.quantity > 0 ? position.purchase_cost / position.quantity : 0;
  const acquisitionCost = position.purchase_cost + (position.purchase_fee || 0);
  const sellFeePercentDec = (position.sell_fee_percent || 0) / 100;
  const sellFeeFixed = position.sell_fee_fixed || 0;
  const taxRateDec = (position.tax_rate || 26.375) / 100;
  const sellDenom = position.quantity * (1 - sellFeePercentDec);

  let saleGross = 0, sellFeeAmt = 0, netSale = 0, tax = 0, netProceeds = 0, netProfit = 0;
  const hasSaleData = currentPrice !== null;
  if (hasSaleData) {
    saleGross   = currentPrice * position.quantity;
    sellFeeAmt  = sellFeeFixed + sellFeePercentDec * saleGross;
    netSale     = saleGross - sellFeeAmt;
    tax         = Math.max(0, netSale - acquisitionCost) * taxRateDec;
    netProceeds = netSale - tax;
    netProfit   = netProceeds - acquisitionCost;
  }

  const breakEvenPrice = sellDenom > 0 ? (acquisitionCost + sellFeeFixed) / sellDenom : null;
  const targetPrice = (r: number): number | null => {
    if (sellDenom <= 0 || taxRateDec >= 1) return null;
    return (acquisitionCost * (1 + r - taxRateDec) / (1 - taxRateDec) + sellFeeFixed) / sellDenom;
  };
  const pct = currentPrice !== null && kurs > 0 ? ((currentPrice - kurs) / kurs) * 100 : null;
  const tsActivation = targetPrice(0.01);
  const tsActive = currentPrice !== null && tsActivation !== null && currentPrice >= tsActivation;
  const stopBase: number | null = tsActive ? currentPrice : tsActivation;

  const targets = [
    { label: 'Break-even', price: breakEvenPrice },
    { label: '+1 %', price: targetPrice(0.01) },
    { label: '+5 %', price: targetPrice(0.05) },
    { label: '+10 %', price: targetPrice(0.1) },
  ];
  const stops = stopBase === null ? [] : [
    { label: 'Stopp 8 %', price: stopBase * 0.92 },
    { label: 'Stopp 10 %', price: stopBase * 0.9 },
    { label: 'Stopp 12 %', price: stopBase * 0.88 },
  ];

  const d = detail;

  // Pre-computed display values to avoid nested ternaries in JSX
  const kursPriceDisplay = currentPrice === null ? '…' : fmtEur(currentPrice);
  const veraenderungDisplay = pct === null ? '…' : `${pct >= 0 ? '+' : ''}${fmt(pct)} %`;
  const netProfitDisplay = hasSaleData ? `${netProfit >= 0 ? '+' : ''}${fmtEur(netProfit)}` : '—';

  return (
    <Dialog open maxWidth="lg" fullWidth onClose={onClose} scroll="paper">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" component="span" fontWeight={700} mr={1}>{position.ticker}</Typography>
          <Typography variant="body1" component="span" color="text.secondary">{d?.name || position.name}</Typography>
        </Box>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {loading && <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}

        <Grid container spacing={3}>
          {/* ── Left column ─────────────────────────────── */}
          <Grid item xs={12} md={6}>
            <Section title="Wertpapier">
              <DataRow label="Symbol" value={position.ticker} />
              {d?.isin && <DataRow label="ISIN" value={d.isin} />}
              {d?.exchange && <DataRow label="Börse" value={d.exchange} />}
              {d?.sector && <DataRow label="Sektor" value={d.sector} />}
              {d?.industry && <DataRow label="Branche" value={d.industry} />}
            </Section>

            <Section title="Marktdaten">
              <DataRow label="Aktueller Kurs" value={kursPriceDisplay} accent />
              <DataRow label="Veränderung ggü. Kauf" value={veraenderungDisplay} />
              {d?.dayHigh != null && d?.dayLow != null && <DataRow label="Tageshoch / -tief" value={`${fmtEur(d.dayHigh)} / ${fmtEur(d.dayLow)}`} />}
              {d?.volume != null && <DataRow label="Volumen" value={fmtVol(d.volume)} />}
              {d?.fiftyTwoWeekHigh != null && d?.fiftyTwoWeekLow != null && (
                <DataRow label="52-Wochen-Spanne" value={`${fmt(d.fiftyTwoWeekLow)} – ${fmt(d.fiftyTwoWeekHigh)}`} />
              )}
            </Section>

            {(d?.trailingPE != null || d?.eps != null || d?.dividendYield != null) && (
              <Section title="Kennzahlen">
                {d?.trailingPE != null && <DataRow label="KGV (trailing)" value={<Chip label={fmt(d.trailingPE)} size="small" color={kgvColor(d.trailingPE)} />} />}
                {d?.forwardPE != null && <DataRow label="KGV (forward)" value={<Chip label={fmt(d.forwardPE)} size="small" color={kgvColor(d.forwardPE)} />} />}
                {d?.pegRatio != null && <DataRow label="PEG-Ratio" value={<Chip label={fmt(d.pegRatio)} size="small" color={pegColor(d.pegRatio)} />} />}
                {d?.eps != null && <DataRow label="EPS" value={`${fmt(d.eps)} ${d.currency || ''}`} />}
                {d?.beta != null && <DataRow label="Beta" value={fmt(d.beta)} />}
                {d?.dividendYield != null && <DataRow label="Dividendenrendite" value={fmtPct(d.dividendYield * 100)} />}
                {d?.dividendPerShare != null && <DataRow label="Dividende / Aktie" value={`${fmt(d.dividendPerShare)} ${d.currency || ''}`} />}
                {d?.analystTargetPrice != null && <DataRow label="Analystenkurs" value={fmtEur(d.analystTargetPrice)} accent />}
                <Box px={1} py={1}>
                  <Typography variant="caption" color="text.secondary">
                    ⚠ KGV allein sagt wenig — Branche und Wachstum beachten. Banken: 6–12 · Industrie: 10–18 · Tech: 20–60+
                  </Typography>
                </Box>
              </Section>
            )}
          </Grid>

          {/* ── Right column ────────────────────────────── */}
          <Grid item xs={12} md={6}>
            <Section title="Dein Investment">
              <DataRow label="Menge" value={position.quantity} />
              <DataRow label="Kaufkurs / Aktie" value={fmtEur(kurs)} />
              <DataRow label="Kaufpreis gesamt" value={fmtEur(position.purchase_cost)} />
              <DataRow label="Kaufgebühr fix" value={fmtEur(position.purchase_fee_fixed)} />
              <DataRow label="Kaufgebühr %" value={fmtPct(position.purchase_fee_percent)} />
              <DataRow label="Kaufgebühren ges." value={fmtEur(position.purchase_fee)} />
              <DataRow label="Einstandspreis" value={fmtEur(acquisitionCost)} accent />
            </Section>

            {currentPrice !== null && (
              <Section title={`Verkauf bei ${fmtEur(currentPrice)}`}>
                <DataRow label="Bruttoerlös" value={fmtEur(saleGross)} />
                <DataRow label="Verkaufsgebühr fix" value={fmtEur(sellFeeFixed)} />
                <DataRow label="Verkaufsgebühr %" value={fmtPct(position.sell_fee_percent)} />
                <DataRow label="Verkaufsgebühren ges." value={fmtEur(sellFeeAmt)} />
                <DataRow label="Nettoerlös (vor Steuer)" value={fmtEur(netSale)} />
                <DataRow label={`Steuer (${fmt(position.tax_rate)} %)`} value={tax != null && tax > 0 ? fmtEur(tax) : '—'} muted={tax === null || tax <= 0} />
                <DataRow label="Nettoerlös" value={fmtEur(netProceeds)} accent />
                <DataRow label="Nettogewinn/-verlust" value={netProfitDisplay} accent />
              </Section>
            )}
          </Grid>
        </Grid>

        {/* ── Description ─────────────────────────────── */}
        {d?.description && (
          <Section title="Über das Unternehmen">
            <Box px={1.5} py={1}><Typography variant="body2" color="text.secondary">{d.description}</Typography></Box>
          </Section>
        )}

        {/* ── Target prices ───────────────────────────── */}
        {breakEvenPrice !== null && (
          <Section title="Zielpreise">
            <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={1.5} p={1.5}>
              {targets.map(({ label, price }) => {
                const reached = currentPrice !== null && price !== null && currentPrice >= price;
                const priceDisplay = price == null ? '—' : fmtEur(price);
                const distColor = reached ? 'success.main' : 'text.secondary';
                const distDisplay = currentPrice === null || price === null
                  ? ''
                  : reached ? '✓ erreicht' : `noch ${fmtEur(price - currentPrice)}`;
                return (
                  <Paper key={label} variant="outlined"
                    sx={{ p: 1.5, textAlign: 'center', borderColor: reached ? 'success.main' : 'divider', bgcolor: reached ? 'rgba(46,125,50,0.12)' : 'background.paper' }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{priceDisplay}</Typography>
                    <Typography variant="caption" color={distColor}>{distDisplay}</Typography>
                  </Paper>
                );
              })}
            </Box>
          </Section>
        )}

        {/* ── Trailing Stop ───────────────────────────── */}
        {tsActivation !== null && (
          <Section title="Trailing Stop">
            <Box px={1.5} py={1}>
              <Box display="flex" alignItems="center" gap={2} mb={1.5}>
                <Typography variant="body2">Aktivierung ab <strong>{fmtEur(tsActivation)}</strong></Typography>
                <Chip label={tsActive ? '✓ aktiv' : 'noch nicht aktiv'} size="small" color={tsActive ? 'warning' : 'default'} />
              </Box>
              {tsActive && <Typography variant="caption" color="text.secondary" display="block" mb={1}>Stoppkurse basieren auf aktuellem Kurs {fmtEur(currentPrice)}</Typography>}
              <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={1.5}>
                {stops.map(({ label, price }) => (
                  <Paper key={label} variant="outlined"
                    sx={{ p: 1.5, textAlign: 'center', borderColor: tsActive ? 'warning.main' : 'divider', bgcolor: tsActive ? 'rgba(255,167,38,0.08)' : 'background.paper' }}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{fmtEur(price)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tsActive && currentPrice !== null ? `Abstand ${fmtEur(currentPrice - price)}` : ''}
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </Box>
          </Section>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PositionDetailModal;

