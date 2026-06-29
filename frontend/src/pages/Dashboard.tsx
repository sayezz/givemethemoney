import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AppBar, Toolbar, Typography, Box, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip, Alert,
  CircularProgress, Switch, FormControlLabel, Tooltip, Select, useTheme,
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import InsightsIcon from '@mui/icons-material/Insights';
import SettingsIcon from '@mui/icons-material/Settings';
import AddPositionForm from '../components/AddPositionForm';
import PositionDetailModal from '../components/PositionDetailModal';
import PortfolioAnalysis from '../components/PortfolioAnalysis';
import BrokerSettings from '../components/BrokerSettings';
import { normalizeQuote, formatAmount } from '../utils/currency';
import { positionMetrics } from '../utils/metrics';
import type { Position, Quote, Transaction } from '../types';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

type Quotes = Record<number, Quote | null>;
type FxRates = Record<string, number>; // native currency units per 1 EUR

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const muiTheme = useTheme();
  const navigate = useNavigate();

  const [positions, setPositions] = useState<Position[]>([]);
  const [txnsByPos, setTxnsByPos] = useState<Record<number, Transaction[]>>({});
  const [quotes, setQuotes] = useState<Quotes>({});
  const [fxRates, setFxRates] = useState<FxRates>({});
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<Date | null>(null);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [showEur, setShowEur] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const fxRatesRef = useRef<FxRates>({});
  useEffect(() => { fxRatesRef.current = fxRates; }, [fxRates]);

  // EUR-equivalent of a quote, using the cached FX rate (native units per 1 EUR).
  const priceInEur = useCallback((quote: Quote | null): number | null => {
    if (!quote) return null;
    if (quote.currency === 'EUR') return quote.price;
    const rate = fxRatesRef.current[quote.currency];
    return rate ? quote.price / rate : null;
  }, []);

  const loadQuotes = useCallback(async (posArr: Position[]) => {
    const results = await Promise.allSettled(
      posArr.map((p) =>
        axios.get(`${API_URL}/stocks/quote?symbol=${encodeURIComponent(p.ticker)}&provider=${p.quote_provider || 'yahoo'}`)
      )
    );
    const map: Quotes = {};
    const currenciesNeeded = new Set<string>();
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

    const toFetch = Array.from(currenciesNeeded).filter((c) => !fxRatesRef.current[c]);
    if (toFetch.length > 0) {
      // EUR{cur}=X gives how many `cur` per 1 EUR.
      const fxResults = await Promise.allSettled(
        toFetch.map((c) => axios.get(`${API_URL}/stocks/quote?symbol=EUR${c}=X`))
      );
      const newRates: FxRates = {};
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
      const { data } = await axios.get(`${API_URL}/positions`);
      const loaded: Position[] = data.positions || [];
      setPositions(loaded);
      if (loaded.length > 0) loadQuotes(loaded);
      // Load transactions for per-position IRR in the table.
      axios.get(`${API_URL}/transactions`).then((r) => {
        const grouped: Record<number, Transaction[]> = {};
        for (const t of (r.data.transactions || []) as Transaction[]) {
          (grouped[t.position_id] ||= []).push(t);
        }
        setTxnsByPos(grouped);
      }).catch(() => {});
    } catch (err: any) {
      setLoadError(err.response?.data?.message || 'Positionen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [loadQuotes]);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  useEffect(() => {
    if (positions.length === 0 || !autoUpdate) return;
    const interval = setInterval(() => loadQuotes(positions), 20000);
    return () => clearInterval(interval);
  }, [positions, loadQuotes, autoUpdate]);

  // Fire trailing-stop email notification (once per position), in EUR.
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
          current_price: priceInEur(quotes[p.id]), ticker: p.ticker, name: p.name,
        })
      )
    ).then(() => loadPositions());
  }, [quotes]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = () => { logout(); navigate('/login'); };
  const handleCreated = () => { setShowForm(false); loadPositions(); };

  const handleDelete = async (id: number) => {
    try { await axios.delete(`${API_URL}/positions/${id}`); loadPositions(); }
    catch (err: any) { alert(err.response?.data?.message || 'Löschen fehlgeschlagen.'); }
  };

  const handleProviderChange = async (id: number, provider: string) => {
    try { await axios.patch(`${API_URL}/positions/${id}/provider`, { quote_provider: provider }); loadPositions(); }
    catch (err: any) { alert(err.response?.data?.message || 'Provider konnte nicht aktualisiert werden.'); }
  };

  const handleToggleTrailingStop = async (id: number, current: boolean) => {
    try { await axios.patch(`${API_URL}/positions/${id}/trailing-stop`, { trailing_stop_active: !current }); loadPositions(); }
    catch (err: any) { alert(err.response?.data?.message || 'Trailing Stop konnte nicht aktualisiert werden.'); }
  };

  const headers = ['Kaufdatum', 'Ticker', 'Name', 'Menge', 'Kurs', 'Kaufpreis', 'Akt. Kurs', '+/−', 'Erlös', 'Netto', 'Rendite', 'IRR p.a.', 'Quelle', ''];
  const rightCols = new Set(['Menge', 'Kurs', 'Kaufpreis', 'Akt. Kurs', '+/−', 'Erlös', 'Netto', 'Rendite', 'IRR p.a.']);
  const gainColor = muiTheme.palette.mode === 'dark' ? '#81c784' : '#2e7d32';
  const lossColor = muiTheme.palette.mode === 'dark' ? '#e57373' : '#c62828';
  const fmtPct = (v: number | null | undefined) => `${Number(v || 0).toFixed(2).replace(/\.?0+$/, '')} %`;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {showSettings && <BrokerSettings onClose={() => setShowSettings(false)} />}
      {selectedPosition && (
        <PositionDetailModal
          position={selectedPosition}
          quote={quotes[selectedPosition.id] ?? null}
          fxRate={
            quotes[selectedPosition.id] && quotes[selectedPosition.id]!.currency !== 'EUR'
              ? fxRates[quotes[selectedPosition.id]!.currency] ?? null
              : 1
          }
          onClose={() => setSelectedPosition(null)}
        />
      )}

      <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>Give me the money</Typography>
          <Typography variant="body2" color="text.secondary" mr={2}>{user?.email}</Typography>
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
            <IconButton color="inherit" onClick={toggleMode}>
              {mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Broker & Standard-Gebühren">
            <IconButton color="inherit" onClick={() => setShowSettings(true)}><SettingsIcon /></IconButton>
          </Tooltip>
          <Button startIcon={<LogoutIcon />} color="inherit" onClick={handleLogout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" fontWeight={600}>Deine Investments</Typography>
          <Button
            variant={showForm ? 'outlined' : 'contained'}
            startIcon={showForm ? <CloseIcon /> : <AddIcon />}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? 'Schließen' : 'Investment hinzufügen'}
          </Button>
        </Box>

        {showForm && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <AddPositionForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
          </Paper>
        )}

        {loading && <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>}
        {!loading && loadError && <Alert severity="error">{loadError}</Alert>}
        {!loading && !loadError && positions.length === 0 && (
          <Alert severity="info">Noch keine Investments hinzugefügt.</Alert>
        )}

        {!loading && !loadError && positions.length > 0 && (
          <>
            <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
              <Box display="flex" gap={1}>
                <Chip label="Kursverlust" size="small" sx={{ bgcolor: 'rgba(198,40,40,0.8)', color: '#fff' }} />
                <Chip label="Break-even" size="small" sx={{ bgcolor: 'rgba(46,125,50,0.8)', color: '#fff' }} />
                <Chip label="Nettorendite ≥ 1 %" size="small" sx={{ bgcolor: 'rgba(21,101,192,0.8)', color: '#fff' }} />
              </Box>
              <FormControlLabel
                control={<Switch checked={autoUpdate} onChange={(e) => setAutoUpdate(e.target.checked)} size="small" />}
                label={<Typography variant="body2">Auto-Update (20s)</Typography>}
              />
              <FormControlLabel
                control={<Switch checked={showEur} onChange={(e) => setShowEur(e.target.checked)} size="small" />}
                label={<Typography variant="body2">Werte in €</Typography>}
              />
              <Button size="small" startIcon={<RefreshIcon />} onClick={() => loadQuotes(positions)}>
                Aktualisieren
              </Button>
              <Button size="small" variant={showAnalysis ? 'contained' : 'outlined'} startIcon={<InsightsIcon />} onClick={() => setShowAnalysis((v) => !v)}>
                Analyse
              </Button>
              {quotesUpdatedAt && (
                <Typography variant="caption" color="text.secondary">
                  Kurse: {quotesUpdatedAt.toLocaleTimeString('de-DE')}
                </Typography>
              )}
            </Box>

            {showAnalysis && (
              <Box mb={3}>
                <PortfolioAnalysis
                  positions={positions}
                  priceEurById={positions.reduce((acc, p) => {
                    acc[p.id] = priceInEur(quotes[p.id] ?? null);
                    return acc;
                  }, {} as Record<number, number | null>)}
                  fxRates={fxRates}
                />
              </Box>
            )}

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {headers.map((h) => (
                      <TableCell key={h} align={rightCols.has(h) ? 'right' : 'left'}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {positions.map((position) => {
                    const kurs = position.quantity > 0 ? position.purchase_cost / position.quantity : 0;
                    const acquisitionCost = position.purchase_cost + position.purchase_fee;

                    const quote = quotes[position.id] ?? null;
                    const nativeCurrency = quote?.currency || 'EUR';
                    const fxRate = nativeCurrency === 'EUR' ? 1 : fxRates[nativeCurrency];
                    const currentPrice = priceInEur(quote); // EUR baseline

                    // EUR baseline value -> native currency, using the cached FX rate.
                    const toNative = (v: number | null): number | null =>
                      v == null ? null : (nativeCurrency === 'EUR' ? v : (fxRate ? v * fxRate : null));

                    const pct = currentPrice !== null && kurs > 0 ? ((currentPrice - kurs) / kurs) * 100 : null;

                    const sellFeePercentDec = (position.sell_fee_percent || 0) / 100;
                    const sellFeeFixed = position.sell_fee_fixed || 0;
                    const taxRateDec = (position.tax_rate || 26) / 100;

                    let netProfit: number | null = null;
                    let netProceeds: number | null = null;
                    if (currentPrice !== null) {
                      const saleGross = currentPrice * position.quantity;
                      const sellFeeAmt = sellFeeFixed + sellFeePercentDec * saleGross;
                      const netSale = saleGross - sellFeeAmt;
                      const tax = Math.max(0, netSale - acquisitionCost) * taxRateDec;
                      netProceeds = netSale - tax;
                      netProfit = netProceeds - acquisitionCost;
                    }

                    const sellDenom = position.quantity * (1 - sellFeePercentDec);
                    const breakEvenPrice = sellDenom > 0 ? (acquisitionCost + sellFeeFixed) / sellDenom : null;
                    const targetPrice = (r: number): number | null => {
                      if (sellDenom <= 0 || taxRateDec >= 1) return null;
                      const targetNetSale = acquisitionCost * (1 + r - taxRateDec) / (1 - taxRateDec);
                      return (targetNetSale + sellFeeFixed) / sellDenom;
                    };

                    let rowBg = 'inherit';
                    if (netProfit !== null) {
                      if (acquisitionCost > 0 && netProfit / acquisitionCost >= 0.01) rowBg = 'rgba(21,101,192,0.15)';
                      else if (netProfit >= 0) rowBg = 'rgba(46,125,50,0.15)';
                      else rowBg = 'rgba(198,40,40,0.15)';
                    }

                    const pctColor = pct === null ? 'inherit' : pct >= 0 ? gainColor : lossColor;
                    const pctDisplay = pct === null ? '…' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)} %`;
                    const netColor = netProfit === null ? 'inherit' : netProfit >= 0 ? gainColor : lossColor;
                    const retDisplay = netProfit === null || acquisitionCost <= 0
                      ? '…'
                      : `${netProfit >= 0 ? '+' : ''}${((netProfit / acquisitionCost) * 100).toFixed(2)} %`;

                    // Money-weighted annualized return (IRR/XIRR) from this
                    // position's transactions + current EUR value.
                    const irrPct = positionMetrics(txnsByPos[position.id] || [], currentPrice).xirrPct;
                    const irrColor = irrPct == null ? 'inherit' : irrPct >= 0 ? gainColor : lossColor;
                    const irrDisplay = irrPct == null ? '…' : `${irrPct >= 0 ? '+' : ''}${irrPct.toFixed(2)} %`;

                    const tsActivation = targetPrice(0.01);
                    const tsActive = currentPrice !== null && tsActivation !== null && currentPrice >= tsActivation;
                    const stopBase = tsActive ? currentPrice! : tsActivation;

                    return (
                      <React.Fragment key={position.id}>
                        <TableRow hover sx={{ bgcolor: rowBg, cursor: 'pointer' }} onClick={() => setSelectedPosition(position)}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {(() => {
                              const d = position.purchase_date || position.created_at;
                              return d ? d.substring(0, 10).split('-').reverse().join('.') : '';
                            })()}
                          </TableCell>
                          <TableCell><strong>{position.ticker}</strong></TableCell>
                          <TableCell>{position.name}</TableCell>
                          <TableCell align="right">{position.quantity}</TableCell>
                          <TableCell align="right">{formatAmount(toNative(kurs), kurs, nativeCurrency, showEur)}</TableCell>
                          <TableCell align="right">{formatAmount(toNative(acquisitionCost), acquisitionCost, nativeCurrency, showEur)}</TableCell>
                          <TableCell align="right">{formatAmount(quote?.price ?? null, currentPrice, nativeCurrency, showEur)}</TableCell>
                          <TableCell align="right" sx={{ color: pctColor }}>{pctDisplay}</TableCell>
                          <TableCell align="right">{formatAmount(toNative(netProceeds), netProceeds, nativeCurrency, showEur)}</TableCell>
                          <TableCell align="right" sx={{ color: netColor }}>{formatAmount(toNative(netProfit), netProfit, nativeCurrency, showEur, 2, true)}</TableCell>
                          <TableCell align="right" sx={{ color: netColor }}>{retDisplay}</TableCell>
                          <TableCell align="right" sx={{ color: irrColor }}>{irrDisplay}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select
                              native
                              variant="standard"
                              value={position.quote_provider || 'yahoo'}
                              onChange={(e) => handleProviderChange(position.id, e.target.value as string)}
                              sx={{ fontSize: '0.72rem' }}
                            >
                              <option value="yahoo">Yahoo</option>
                              <option value="fmp">FMP</option>
                              <option value="alphavantage">AlphaV</option>
                            </Select>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title={position.trailing_stop_active ? 'Trailing Stop aktiv' : 'Trailing Stop inaktiv'}>
                              <IconButton size="small" color={position.trailing_stop_active ? 'warning' : 'default'} onClick={() => handleToggleTrailingStop(position.id, position.trailing_stop_active)}>
                                <FlagIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Investment löschen">
                              <IconButton size="small" color="error" onClick={() => handleDelete(position.id)}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: rowBg }} onClick={() => setSelectedPosition(position)}>
                          <TableCell colSpan={14} sx={{ pt: 0, pb: '6px', borderTop: 'none', fontSize: '0.72rem', color: 'text.disabled', cursor: 'pointer' }}>
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
                                {([0.01, 0.05, 0.10] as const).map((r) => {
                                  const tp = targetPrice(r);
                                  return tp !== null ? (
                                    <React.Fragment key={r}>
                                      <span className="fee-sep">·</span>
                                      <span className={`fee-group${currentPrice !== null && currentPrice >= tp ? ' fee-achieved' : ''}`}>
                                        <span className="fee-label">+{r * 100}%</span>
                                        {formatAmount(toNative(tp), tp, nativeCurrency, showEur)}
                                      </span>
                                    </React.Fragment>
                                  ) : null;
                                })}
                                {tsActivation !== null && stopBase !== null && (
                                  <>
                                    <span className="fee-sep">|</span>
                                    <span className={`fee-group${tsActive ? ' fee-achieved' : ''}`}>
                                      <span className="fee-label">TS ab</span>
                                      {formatAmount(toNative(tsActivation), tsActivation, nativeCurrency, showEur)}
                                    </span>
                                    {([0.08, 0.10, 0.12] as const).map((drop, i) => (
                                      <React.Fragment key={drop}>
                                        <span className="fee-sep">{i === 0 ? '→' : '·'}</span>
                                        <span className={`fee-group${tsActive ? ' fee-ts-stop' : ''}`}>
                                          <span className="fee-label">{drop * 100}%</span>
                                          {formatAmount(toNative(stopBase * (1 - drop)), stopBase * (1 - drop), nativeCurrency, showEur)}
                                        </span>
                                      </React.Fragment>
                                    ))}
                                  </>
                                )}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Werte werden in EUR berechnet; mit „Werte in €“ zwischen Originalwährung und Euro umschalten.
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;
