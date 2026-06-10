import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AppBar, Toolbar, Typography, Box, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Button, IconButton, Chip, Alert,
  CircularProgress, Switch, FormControlLabel, Collapse, Tooltip, Select,
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../context/AuthContext';
import AddPositionForm from '../components/AddPositionForm';
import PositionDetailModal from '../components/PositionDetailModal';
import type { Position } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const fmt = (v: number | null | undefined, dec = 2): string =>
  Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtEur = (v: number | null | undefined): string => `${fmt(v)} €`;
const fmtPct = (v: number | null | undefined): string => `${fmt(v)} %`;

type Quotes = Record<number, number | null>;

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [positions, setPositions] = useState<Position[]>([]);
  const [quotes, setQuotes] = useState<Quotes>({});
  const [quotesUpdatedAt, setQuotesUpdatedAt] = useState<Date | null>(null);
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loadQuotes = useCallback(async (posArr: Position[]) => {
    const results = await Promise.allSettled(
      posArr.map((p) =>
        axios.get(`${API_URL}/stocks/quote?symbol=${encodeURIComponent(p.ticker)}&provider=${p.quote_provider || 'yahoo'}`)
      )
    );
    const map: Quotes = {};
    for (const [i, r] of results.entries()) {
      if (r.status === 'fulfilled') map[posArr[i].id] = r.value.data.quote?.price ?? null;
    }
    setQuotes(map);
    setQuotesUpdatedAt(new Date());
  }, []);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await axios.get(`${API_URL}/positions`);
      const loaded: Position[] = data.positions || [];
      setPositions(loaded);
      if (loaded.length > 0) loadQuotes(loaded);
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

  useEffect(() => {
    if (positions.length === 0 || Object.keys(quotes).length === 0) return;
    const toNotify = positions.filter((p) => {
      if (p.ts_notification_sent || quotes[p.id] == null) return false;
      const price = quotes[p.id] as number;
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
          current_price: quotes[p.id], ticker: p.ticker, name: p.name,
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {selectedPosition && (
        <PositionDetailModal
          position={selectedPosition}
          currentPrice={quotes[selectedPosition.id] ?? null}
          onClose={() => setSelectedPosition(null)}
        />
      )}

      <AppBar position="static" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>💰 Give me the money</Typography>
          <Typography variant="body2" color="text.secondary" mr={2}>{user?.email}</Typography>
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

        <Collapse in={showForm}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <AddPositionForm onCreated={handleCreated} onCancel={() => setShowForm(false)} />
          </Paper>
        </Collapse>

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
              <Button size="small" startIcon={<RefreshIcon />} onClick={() => loadQuotes(positions)}>
                Aktualisieren
              </Button>
              {quotesUpdatedAt && (
                <Typography variant="caption" color="text.secondary">
                  Kurse: {quotesUpdatedAt.toLocaleTimeString('de-DE')}
                </Typography>
              )}
            </Box>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Hinzugefügt', 'Ticker', 'Name', 'Menge', 'Kurs', 'Kaufpreis', 'Akt. Kurs', '+/−', 'Erlös', 'Netto', 'Rendite', 'Quelle', ''].map((h) => (
                      <TableCell key={h} align={['Menge', 'Kurs', 'Kaufpreis', 'Akt. Kurs', '+/−', 'Erlös', 'Netto', 'Rendite'].includes(h) ? 'right' : 'left'}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {positions.map((position) => {
                    const kurs = position.quantity > 0 ? position.purchase_cost / position.quantity : 0;
                    const acquisitionCost = position.purchase_cost + position.purchase_fee;
                    const currentPrice = quotes[position.id] ?? null;
                    const pct = currentPrice !== null && kurs > 0 ? ((currentPrice - kurs) / kurs) * 100 : null;

                    const sellFeePercentDec = (position.sell_fee_percent || 0) / 100;
                    const sellFeeFixed = position.sell_fee_fixed || 0;
                    const taxRateDec = (position.tax_rate || 26) / 100;
                    const sellDenom = position.quantity * (1 - sellFeePercentDec);

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

                    const targetPrice = (r: number): number | null => {
                      if (sellDenom <= 0 || taxRateDec >= 1) return null;
                      return (acquisitionCost * (1 + r - taxRateDec) / (1 - taxRateDec) + sellFeeFixed) / sellDenom;
                    };
                    const breakEvenPrice = sellDenom > 0 ? (acquisitionCost + sellFeeFixed) / sellDenom : null;
                    const tsActivation = targetPrice(0.01);
                    const tsActive = currentPrice !== null && tsActivation !== null && currentPrice >= tsActivation;
                    const stopBase: number | null = tsActive ? currentPrice : tsActivation;

                    let rowBg = 'inherit';
                    if (netProfit !== null) {
                      if (acquisitionCost > 0 && netProfit / acquisitionCost >= 0.01) rowBg = 'rgba(21,101,192,0.15)';
                      else if (netProfit >= 0) rowBg = 'rgba(46,125,50,0.15)';
                      else rowBg = 'rgba(198,40,40,0.15)';
                    }

                    const gainColor = '#81c784';
                    const lossColor = '#e57373';

                    // Pre-computed display helpers (avoid nested ternaries in JSX)
                    const priceDisplay = currentPrice !== null ? fmtEur(currentPrice) : '…';
                    const pctColor = pct === null ? 'inherit' : pct >= 0 ? gainColor : lossColor;
                    const pctDisplay = pct === null ? '…' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)} %`;
                    const netColor = netProfit === null ? 'inherit' : netProfit >= 0 ? gainColor : lossColor;
                    const netDisplay = netProfit === null ? '…' : `${netProfit >= 0 ? '+' : ''}${fmtEur(netProfit)}`;
                    const retDisplay = netProfit === null || acquisitionCost <= 0
                      ? '…'
                      : `${netProfit >= 0 ? '+' : ''}${((netProfit / acquisitionCost) * 100).toFixed(2)} %`;

                    return (
                      <React.Fragment key={position.id}>
                        <TableRow hover sx={{ bgcolor: rowBg, cursor: 'pointer' }} onClick={() => setSelectedPosition(position)}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {position.created_at ? position.created_at.substring(0, 10).split('-').reverse().join('.') : ''}
                          </TableCell>
                          <TableCell><strong>{position.ticker}</strong></TableCell>
                          <TableCell>{position.name}</TableCell>
                          <TableCell align="right">{position.quantity}</TableCell>
                          <TableCell align="right">{fmt(kurs)}</TableCell>
                          <TableCell align="right">{fmtEur(acquisitionCost)}</TableCell>
                          <TableCell align="right">{priceDisplay}</TableCell>
                          <TableCell align="right" sx={{ color: pctColor }}>{pctDisplay}</TableCell>
                          <TableCell align="right">{netProceeds === null ? '…' : fmtEur(netProceeds)}</TableCell>
                          <TableCell align="right" sx={{ color: netColor }}>{netDisplay}</TableCell>
                          <TableCell align="right" sx={{ color: netColor }}>{retDisplay}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select
                              native
                              variant="standard"
                              value={position.quote_provider || 'yahoo'}
                              onChange={(e) => handleProviderChange(position.id, e.target.value)}
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

                        {/* Fee detail sub-row */}
                        <TableRow sx={{ bgcolor: rowBg }}>
                          <TableCell colSpan={13} sx={{ py: 0.5, fontSize: '0.72rem', color: 'text.secondary', borderBottom: '2px solid rgba(255,255,255,0.06)' }}>
                            <Box display="flex" flexWrap="wrap" gap={1.5}>
                              <span><strong>Kauf:</strong> {fmtEur(position.purchase_fee_fixed)} fix · {fmtPct(position.purchase_fee_percent)} · {fmtEur(position.purchase_fee)} ges.</span>
                              <span>|</span>
                              <span><strong>Verkauf:</strong> {fmtEur(position.sell_fee_fixed)} fix · {fmtPct(position.sell_fee_percent)} · {fmtEur(position.sell_fee)} ges.</span>
                              <span>|</span>
                              <span><strong>Steuer:</strong> {fmtPct(position.tax_rate)}</span>
                              {breakEvenPrice !== null && (() => {
                                const tp1 = targetPrice(0.01);
                                const tp5 = targetPrice(0.05);
                                const tp10 = targetPrice(0.1);
                                return (
                                  <>
                                    <span>|</span>
                                    <span style={{ color: currentPrice !== null && currentPrice >= breakEvenPrice ? gainColor : 'inherit' }}><strong>Break-even:</strong> {fmtEur(breakEvenPrice)}</span>
                                    <span>·</span>
                                    <span style={{ color: currentPrice !== null && tp1 !== null && currentPrice >= tp1 ? gainColor : 'inherit' }}><strong>+1%:</strong> {fmtEur(tp1)}</span>
                                    <span>·</span>
                                    <span style={{ color: currentPrice !== null && tp5 !== null && currentPrice >= tp5 ? gainColor : 'inherit' }}><strong>+5%:</strong> {fmtEur(tp5)}</span>
                                    <span>·</span>
                                    <span style={{ color: currentPrice !== null && tp10 !== null && currentPrice >= tp10 ? gainColor : 'inherit' }}><strong>+10%:</strong> {fmtEur(tp10)}</span>
                                    {stopBase !== null && (
                                      <>
                                        <span>|</span>
                                        <span style={{ color: tsActive ? '#ffb74d' : 'inherit' }}>
                                          <strong>TS ab:</strong> {fmtEur(tsActivation)} → <strong>8%:</strong> {fmtEur(stopBase * 0.92)} · <strong>10%:</strong> {fmtEur(stopBase * 0.9)} · <strong>12%:</strong> {fmtEur(stopBase * 0.88)}
                                        </span>
                                      </>
                                    )}
                                  </>
                                );
                              })()}
                            </Box>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;

