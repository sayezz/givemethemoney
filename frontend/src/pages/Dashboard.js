import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AddPositionForm from '../components/AddPositionForm';
import PositionDetailModal from '../components/PositionDetailModal';
import { normalizeQuote, formatAmount } from '../utils/currency';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [positions, setPositions] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [fxRates, setFxRates] = useState({});
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState(null);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [showEur, setShowEur] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fxRatesRef = useRef({});
  useEffect(() => { fxRatesRef.current = fxRates; }, [fxRates]);

  // EUR-equivalent of a {price, currency} quote, using the cached FX rate (native units per 1 EUR)
  const priceInEur = useCallback((quote) => {
    if (!quote) return null;
    if (quote.currency === 'EUR') return quote.price;
    const rate = fxRatesRef.current[quote.currency];
    return rate ? quote.price / rate : null;
  }, []);

  const loadQuotes = useCallback(async (posArr) => {
    const results = await Promise.allSettled(
      posArr.map((p) =>
        axios.get(`${API_URL}/stocks/quote?symbol=${encodeURIComponent(p.ticker)}&provider=${p.quote_provider || 'yahoo'}`)
      )
    );
    const map = {};
    const currenciesNeeded = new Set();
    results.forEach((r, i) => {
      const q = r.status === 'fulfilled' ? r.value.data.quote : null;
      if (q && q.price != null) {
        const normalized = normalizeQuote(q.price, q.currency);
        map[posArr[i].id] = normalized;
        if (normalized.currency !== 'EUR') currenciesNeeded.add(normalized.currency);
      } else {
        map[posArr[i].id] = null;
      }
    });
    setQuotes(map);
    setQuotesUpdatedAt(new Date());

    const toFetch = [...currenciesNeeded].filter((c) => !fxRatesRef.current[c]);
    if (toFetch.length > 0) {
      // Note: the backend doesn't URL-decode query params, so '=' must be sent
      // unencoded here (encodeURIComponent would turn it into %3D and 404).
      const fxResults = await Promise.allSettled(
        toFetch.map((c) => axios.get(`${API_URL}/stocks/quote?symbol=EUR${c}=X`))
      );
      const newRates = {};
      fxResults.forEach((r, i) => {
        const rate = r.status === 'fulfilled' ? r.value.data.quote?.price : null;
        if (rate && rate > 0) newRates[toFetch[i]] = rate;
      });
      if (Object.keys(newRates).length > 0) {
        fxRatesRef.current = { ...fxRatesRef.current, ...newRates };
        setFxRates((prev) => ({ ...prev, ...newRates }));
      }
    }
  }, []);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await axios.get(`${API_URL}/positions`);
      const loaded = response.data.positions || [];
      setPositions(loaded);
      if (loaded.length > 0) {
        loadQuotes(loaded);
      }
    } catch (err) {
      setLoadError(err.response?.data?.message || 'Positionen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [loadQuotes]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    if (positions.length === 0 || !autoUpdate) return;
    const interval = setInterval(() => {
      loadQuotes(positions);
    }, 20000);
    return () => clearInterval(interval);
  }, [positions, loadQuotes, autoUpdate]);

  // Fire trailing stop email notification (once per position)
  useEffect(() => {
    if (positions.length === 0 || Object.keys(quotes).length === 0) return;
    const toNotify = positions.filter((p) => {
      const quote = quotes[p.id];
      if (p.ts_notification_sent || quote == null) return false;
      const price = priceInEur(quote);
      if (price == null) return false;
      const acq = p.purchase_cost + (p.purchase_fee || 0);
      const sfpd = (p.sell_fee_percent || 0) / 100;
      const sff = p.sell_fee_fixed || 0;
      const trd = (p.tax_rate || 26.375) / 100;
      const sd = p.quantity * (1 - sfpd);
      if (sd <= 0 || trd >= 1) return false;
      const tsAct = (acq * (1 + 0.01 - trd) / (1 - trd) + sff) / sd;
      return price >= tsAct;
    });
    if (toNotify.length === 0) return;
    Promise.allSettled(
      toNotify.map((p) =>
        axios.post(`${API_URL}/positions/${p.id}/notify-trailing-stop`, {
          current_price: priceInEur(quotes[p.id]),
          ticker: p.ticker,
          name: p.name,
        })
      )
    ).then(() => loadPositions());
  }, [quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreated = () => {
    setShowForm(false);
    loadPositions();
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_URL}/positions/${id}`);
      loadPositions();
    } catch (err) {
      alert(err.response?.data?.message || 'Löschen fehlgeschlagen.');
    }
  };

  const handleProviderChange = async (id, provider) => {
    try {
      await axios.patch(`${API_URL}/positions/${id}/provider`, { quote_provider: provider });
      loadPositions();
    } catch (err) {
      alert(err.response?.data?.message || 'Provider konnte nicht aktualisiert werden.');
    }
  };

  const handleToggleTrailingStop = async (id, current) => {
    try {
      await axios.patch(`${API_URL}/positions/${id}/trailing-stop`, {
        trailing_stop_active: !current,
      });
      loadPositions();
    } catch (err) {
      alert(err.response?.data?.message || 'Trailing Stop konnte nicht aktualisiert werden.');
    }
  };

  return (
    <div className="dashboard">
      {selectedPosition && (
        <PositionDetailModal
          position={selectedPosition}
          quote={quotes[selectedPosition.id] ?? null}
          fxRate={
            quotes[selectedPosition.id] && quotes[selectedPosition.id].currency !== 'EUR'
              ? fxRates[quotes[selectedPosition.id].currency]
              : 1
          }
          onClose={() => setSelectedPosition(null)}
        />
      )}
      <header className="dashboard-header">
        <h1>Give me the money</h1>
        <div className="user-info">
          <span>Welcome, {user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="positions-section">
          <div className="positions-header">
            <h2>Deine Investments</h2>
            <button className="btn-primary" onClick={() => setShowForm((value) => !value)}>
              {showForm ? 'Schließen' : '+ Investment hinzufügen'}
            </button>
          </div>

          {showForm && (
            <AddPositionForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
          )}

          {loading && <p className="info-text">Lade Positionen...</p>}
          {!loading && loadError && <p className="error-text">{loadError}</p>}

          {!loading && !loadError && positions.length === 0 && (
            <div className="coming-soon">
              <p>Noch keine Investments hinzugefügt.</p>
            </div>
          )}

          {!loading && !loadError && positions.length > 0 && (
            <div className="row-legend">
              <span className="legend-item legend-red">Kursverlust</span>
              <span className="legend-item legend-green">Break-even erreicht</span>
              <span className="legend-item legend-blue">Nettorendite ≥ 1 %</span>
              <button
                className={`btn-auto-update ${autoUpdate ? 'auto-update-on' : 'auto-update-off'}`}
                onClick={() => setAutoUpdate((v) => !v)}
                title={autoUpdate ? 'Auto-Update deaktivieren' : 'Auto-Update alle 20 s aktivieren'}
              >
                ⟳ Auto-Update {autoUpdate ? 'an' : 'aus'}
              </button>
              <button
                className="btn-currency-toggle"
                onClick={() => setShowEur((v) => !v)}
                title={showEur ? 'Originalwährung anzeigen' : 'Alle Werte in € anzeigen'}
              >
                {showEur ? '→ Original' : '→ €'}
              </button>
              {quotesUpdatedAt && (
                <span className="quotes-updated">
                  Kurse aktualisiert: {quotesUpdatedAt.toLocaleTimeString('de-DE')}
                </span>
              )}
            </div>
          )}

          {!loading && !loadError && positions.length > 0 && (
            <div className="positions-table-wrapper">
              <table className="positions-table">
                <thead>
                  <tr>
                    <th>Hinzugefügt</th>
                    <th>Ticker</th>
                    <th>Name</th>
                    <th>Menge</th>
                    <th>Kurs</th>
                    <th>Kaufpreis</th>
                    <th>Akt. Kurs</th>
                    <th>+/−</th>
                    <th>Erlös</th>
                    <th>Netto</th>
                    <th>Rendite</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const kurs = position.quantity > 0
                      ? position.purchase_cost / position.quantity
                      : 0;
                    const acquisitionCost = position.purchase_cost + position.purchase_fee;

                    const quote = quotes[position.id] ?? null;
                    const nativeCurrency = quote?.currency || 'EUR';
                    const fxRate = nativeCurrency === 'EUR' ? 1 : fxRates[nativeCurrency];
                    const currentPrice = priceInEur(quote);

                    // EUR-baseline value -> stock's native currency, using the cached FX rate
                    const toNative = (v) => (v == null) ? null : (nativeCurrency === 'EUR' ? v : (fxRate ? v * fxRate : null));

                    const pct = currentPrice !== null && kurs > 0
                      ? ((currentPrice - kurs) / kurs) * 100
                      : null;
                    const fmtPct = (v) => `${Number(v || 0).toFixed(2).replace(/\.?0+$/, '')} %`;

                    const sellFeePercentDec = (position.sell_fee_percent || 0) / 100;
                    const sellFeeFixed = position.sell_fee_fixed || 0;
                    const taxRateDec = (position.tax_rate || 26) / 100;
                    const sellDenom = position.quantity * (1 - sellFeePercentDec);

                    let netProfit = null;
                    let netProceeds = null;
                    if (currentPrice !== null) {
                      const saleGross = currentPrice * position.quantity;
                      const sellFeeAmt = sellFeeFixed + sellFeePercentDec * saleGross;
                      const netSale = saleGross - sellFeeAmt;
                      const tax = Math.max(0, netSale - acquisitionCost) * taxRateDec;
                      netProceeds = netSale - tax;
                      netProfit = netProceeds - acquisitionCost;
                    }

                    const breakEvenPrice = sellDenom > 0
                      ? (acquisitionCost + sellFeeFixed) / sellDenom
                      : null;

                    const targetPrice = (r) => {
                      if (sellDenom <= 0 || taxRateDec >= 1) return null;
                      const targetNetSale = acquisitionCost * (1 + r - taxRateDec) / (1 - taxRateDec);
                      return (targetNetSale + sellFeeFixed) / sellDenom;
                    };

                    let rowClass = '';
                    if (currentPrice !== null && netProfit !== null) {
                      if (acquisitionCost > 0 && netProfit / acquisitionCost >= 0.01) rowClass = 'row-blue';
                      else if (netProfit >= 0) rowClass = 'row-green';
                      else rowClass = 'row-red';
                    }

                    return (
                      <React.Fragment key={position.id}>
                        <tr className={`${rowClass} row-clickable`} onClick={() => setSelectedPosition(position)}>
                          <td>{position.created_at ? position.created_at.substring(0, 10).split('-').reverse().join('.') : ''}</td>
                          <td className="ticker">{position.ticker}</td>
                          <td>{position.name}</td>
                          <td>{position.quantity}</td>
                          <td>{formatAmount(toNative(kurs), kurs, nativeCurrency, showEur)}</td>
                          <td className="total">{formatAmount(toNative(acquisitionCost), acquisitionCost, nativeCurrency, showEur)}</td>
                          <td>{formatAmount(quote?.price ?? null, currentPrice, nativeCurrency, showEur)}</td>
                          <td className={pct === null ? '' : pct >= 0 ? 'gain' : 'loss'}>
                            {pct === null ? '…' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)} %`}
                          </td>
                          <td>{formatAmount(toNative(netProceeds), netProceeds, nativeCurrency, showEur)}</td>
                          <td className={netProfit === null ? '' : netProfit >= 0 ? 'gain' : 'loss'}>
                            {formatAmount(toNative(netProfit), netProfit, nativeCurrency, showEur, 2, true)}
                          </td>
                          <td className={netProfit === null ? '' : netProfit >= 0 ? 'gain' : 'loss'}>
                            {netProfit === null || acquisitionCost <= 0 ? '…' : `${netProfit >= 0 ? '+' : ''}${((netProfit / acquisitionCost) * 100).toFixed(2)} %`}
                          </td>
                          <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`btn-trailing-stop ${position.trailing_stop_active ? 'active' : ''}`}
                              onClick={() => handleToggleTrailingStop(position.id, position.trailing_stop_active)}
                              title={position.trailing_stop_active ? 'Trailing Stop aktiv' : 'Trailing Stop inaktiv'}
                            >⚑</button>
                            <button
                              className="btn-delete"
                              onClick={() => handleDelete(position.id)}
                              title="Investment löschen"
                            >✕</button>
                          </td>
                        </tr>
                        <tr className={`position-fees-row ${rowClass}`}>
                          <td colSpan="12">
                            <span className="fee-group">
                              <span className="fee-label">Kauf</span>
                              {formatAmount(toNative(position.purchase_fee_fixed), position.purchase_fee_fixed, nativeCurrency, showEur)} fix · {fmtPct(position.purchase_fee_percent)} · {formatAmount(toNative(position.purchase_fee), position.purchase_fee, nativeCurrency, showEur)} ges.
                            </span>
                            <span className="fee-sep">|</span>
                            <span className="fee-group">
                              <span className="fee-label">Verkauf</span>
                              {formatAmount(toNative(position.sell_fee_fixed), position.sell_fee_fixed, nativeCurrency, showEur)} fix · {fmtPct(position.sell_fee_percent)} · {formatAmount(toNative(position.sell_fee), position.sell_fee, nativeCurrency, showEur)} ges.
                            </span>
                            <span className="fee-sep">|</span>
                            <span className="fee-group">
                              <span className="fee-label">Steuer</span>
                              {fmtPct(position.tax_rate)}
                            </span>
                            {breakEvenPrice !== null && (
                              <>
                                <span className="fee-sep">|</span>
                                <span className={`fee-group${currentPrice !== null && currentPrice >= breakEvenPrice ? ' fee-achieved' : ''}`}>
                                  <span className="fee-label">Break-even</span>
                                  {formatAmount(toNative(breakEvenPrice), breakEvenPrice, nativeCurrency, showEur)}
                                </span>
                                <span className="fee-sep">·</span>
                                <span className={`fee-group${currentPrice !== null && currentPrice >= targetPrice(0.01) ? ' fee-achieved' : ''}`}>
                                  <span className="fee-label">+1%</span>
                                  {formatAmount(toNative(targetPrice(0.01)), targetPrice(0.01), nativeCurrency, showEur)}
                                </span>
                                <span className="fee-sep">·</span>
                                <span className={`fee-group${currentPrice !== null && currentPrice >= targetPrice(0.05) ? ' fee-achieved' : ''}`}>
                                  <span className="fee-label">+5%</span>
                                  {formatAmount(toNative(targetPrice(0.05)), targetPrice(0.05), nativeCurrency, showEur)}
                                </span>
                                <span className="fee-sep">·</span>
                                <span className={`fee-group${currentPrice !== null && currentPrice >= targetPrice(0.10) ? ' fee-achieved' : ''}`}>
                                  <span className="fee-label">+10%</span>
                                  {formatAmount(toNative(targetPrice(0.10)), targetPrice(0.10), nativeCurrency, showEur)}
                                </span>
                                {(() => {
                                  const tsActivation = targetPrice(0.01);
                                  const tsActive = currentPrice !== null && currentPrice >= tsActivation;
                                  const stopBase = tsActive ? currentPrice : tsActivation;
                                  return (
                                    <>
                                      <span className="fee-sep">|</span>
                                      <span className={`fee-group${tsActive ? ' fee-achieved' : ''}`}>
                                        <span className="fee-label">TS ab</span>
                                        {formatAmount(toNative(tsActivation), tsActivation, nativeCurrency, showEur)}
                                      </span>
                                      <span className="fee-sep">→</span>
                                      <span className={`fee-group${tsActive ? ' fee-ts-stop' : ''}`}>
                                        <span className="fee-label">8 %</span>
                                        {formatAmount(toNative(stopBase * 0.92), stopBase * 0.92, nativeCurrency, showEur)}
                                      </span>
                                      <span className="fee-sep">·</span>
                                      <span className={`fee-group${tsActive ? ' fee-ts-stop' : ''}`}>
                                        <span className="fee-label">10 %</span>
                                        {formatAmount(toNative(stopBase * 0.90), stopBase * 0.90, nativeCurrency, showEur)}
                                      </span>
                                      <span className="fee-sep">·</span>
                                      <span className={`fee-group${tsActive ? ' fee-ts-stop' : ''}`}>
                                        <span className="fee-label">12 %</span>
                                        {formatAmount(toNative(stopBase * 0.88), stopBase * 0.88, nativeCurrency, showEur)}
                                      </span>
                                    </>
                                  );
                                })()}
                              </>
                            )}
                            <span className="fee-sep">|</span>
                            <span className="fee-group" onClick={(e) => e.stopPropagation()}>
                              <span className="fee-label">Quelle</span>
                              <select
                                className="provider-select"
                                value={position.quote_provider || 'yahoo'}
                                onChange={(e) => handleProviderChange(position.id, e.target.value)}
                              >
                                <option value="yahoo">Yahoo Finance</option>
                                <option value="fmp">FMP</option>
                                <option value="alphavantage">Alpha Vantage</option>
                              </select>
                            </span>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
