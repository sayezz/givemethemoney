import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AddPositionForm from '../components/AddPositionForm';
import PositionDetailModal from '../components/PositionDetailModal';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [positions, setPositions] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState(null);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loadQuotes = useCallback(async (posArr) => {
    const results = await Promise.allSettled(
      posArr.map((p) =>
        axios.get(`${API_URL}/stocks/quote?symbol=${encodeURIComponent(p.ticker)}&provider=${p.quote_provider || 'yahoo'}`)
      )
    );
    const map = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        map[posArr[i].id] = r.value.data.quote?.price ?? null;
      }
    });
    setQuotes(map);
    setQuotesUpdatedAt(new Date());
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
      if (p.ts_notification_sent || quotes[p.id] == null) return false;
      const price = quotes[p.id];
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
          current_price: quotes[p.id],
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
          currentPrice={quotes[selectedPosition.id] ?? null}
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
                    const currentPrice = quotes[position.id] ?? null;
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
                      const grossProfit = currentPrice * position.quantity - position.purchase_cost;
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
                          <td>{formatCurrency(kurs)}</td>
                          <td className="total">{formatCurrency(acquisitionCost)}</td>
                          <td>{currentPrice !== null ? formatCurrency(currentPrice) : '…'}</td>
                          <td className={pct === null ? '' : pct >= 0 ? 'gain' : 'loss'}>
                            {pct === null ? '…' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)} %`}
                          </td>
                          <td>{netProceeds === null ? '…' : `${formatCurrency(netProceeds)} €`}</td>
                          <td className={netProfit === null ? '' : netProfit >= 0 ? 'gain' : 'loss'}>
                            {netProfit === null ? '…' : `${netProfit >= 0 ? '+' : ''}${formatCurrency(netProfit)} €`}
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
                              {formatCurrency(position.purchase_fee_fixed)} € fix · {fmtPct(position.purchase_fee_percent)} · {formatCurrency(position.purchase_fee)} € ges.
                            </span>
                            <span className="fee-sep">|</span>
                            <span className="fee-group">
                              <span className="fee-label">Verkauf</span>
                              {formatCurrency(position.sell_fee_fixed)} € fix · {fmtPct(position.sell_fee_percent)} · {formatCurrency(position.sell_fee)} € ges.
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
                                  {formatCurrency(breakEvenPrice)} €
                                </span>
                                <span className="fee-sep">·</span>
                                <span className={`fee-group${currentPrice !== null && currentPrice >= targetPrice(0.01) ? ' fee-achieved' : ''}`}>
                                  <span className="fee-label">+1%</span>
                                  {formatCurrency(targetPrice(0.01))} €
                                </span>
                                <span className="fee-sep">·</span>
                                <span className={`fee-group${currentPrice !== null && currentPrice >= targetPrice(0.05) ? ' fee-achieved' : ''}`}>
                                  <span className="fee-label">+5%</span>
                                  {formatCurrency(targetPrice(0.05))} €
                                </span>
                                <span className="fee-sep">·</span>
                                <span className={`fee-group${currentPrice !== null && currentPrice >= targetPrice(0.10) ? ' fee-achieved' : ''}`}>
                                  <span className="fee-label">+10%</span>
                                  {formatCurrency(targetPrice(0.10))} €
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
                                        {formatCurrency(tsActivation)} €
                                      </span>
                                      <span className="fee-sep">→</span>
                                      <span className={`fee-group${tsActive ? ' fee-ts-stop' : ''}`}>
                                        <span className="fee-label">8 %</span>
                                        {formatCurrency(stopBase * 0.92)} €
                                      </span>
                                      <span className="fee-sep">·</span>
                                      <span className={`fee-group${tsActive ? ' fee-ts-stop' : ''}`}>
                                        <span className="fee-label">10 %</span>
                                        {formatCurrency(stopBase * 0.90)} €
                                      </span>
                                      <span className="fee-sep">·</span>
                                      <span className={`fee-group${tsActive ? ' fee-ts-stop' : ''}`}>
                                        <span className="fee-label">12 %</span>
                                        {formatCurrency(stopBase * 0.88)} €
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
