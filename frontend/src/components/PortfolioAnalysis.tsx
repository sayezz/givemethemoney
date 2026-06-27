import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Box, Paper, Typography, Grid, CircularProgress, Divider,
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import type { Position, Transaction } from '../types';
import { positionMetrics, xirr, cagr, type CashFlow } from '../utils/metrics';
import { buildValueSeries } from '../utils/portfolio';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const fmtEur = (v: number | null | undefined): string =>
  `${Number(v || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fmtPct = (v: number | null | undefined): string =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

interface PosHistory { currency: string; points: { date: string; close: number }[]; }

interface Props {
  positions: Position[];
  priceEurById: Record<number, number | null>;
  fxRates: Record<string, number>;
}

const Stat: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center', minWidth: 140, flex: 1 }}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="h6" fontWeight={700} sx={{ color: color || 'text.primary' }}>{value}</Typography>
  </Paper>
);

const PortfolioAnalysis: React.FC<Props> = ({ positions, priceEurById, fxRates }) => {
  const [loading, setLoading] = useState(true);
  const [txnsByPos, setTxnsByPos] = useState<Record<number, Transaction[]>>({});
  const [historyByPos, setHistoryByPos] = useState<Record<number, PosHistory>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/transactions`);
      const grouped: Record<number, Transaction[]> = {};
      for (const t of (data.transactions || []) as Transaction[]) {
        (grouped[t.position_id] ||= []).push(t);
      }
      setTxnsByPos(grouped);

      const hist: Record<number, PosHistory> = {};
      await Promise.allSettled(
        positions.map(async (p) => {
          const r = await axios.get(`${API_URL}/stocks/history`, { params: { symbol: p.ticker, range: '2y' } });
          hist[p.id] = { currency: r.data.currency || 'EUR', points: r.data.points || [] };
        })
      );
      setHistoryByPos(hist);
    } finally {
      setLoading(false);
    }
  }, [positions]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>;
  }

  // Per-position metrics + portfolio aggregates
  const gainColor = '#81c784';
  const lossColor = '#e57373';
  let invested = 0, currentValue = 0, realized = 0, dividends = 0;
  const allFlows: CashFlow[] = [];
  const alloc: { id: number; value: number; label: string }[] = [];
  const returnsBar: { ticker: string; pct: number }[] = [];

  for (const p of positions) {
    const txns = txnsByPos[p.id] || [];
    const m = positionMetrics(txns, priceEurById[p.id] ?? null);
    invested += m.invested;
    realized += m.realized;
    dividends += m.dividends;
    if (m.currentValue != null) {
      currentValue += m.currentValue;
      if (m.currentValue > 0) alloc.push({ id: p.id, value: m.currentValue, label: p.ticker });
    }
    if (m.totalReturnPct != null) returnsBar.push({ ticker: p.ticker, pct: m.totalReturnPct });
    for (const t of txns) {
      const d = new Date(t.txn_date);
      if (t.txn_type === 'buy') allFlows.push({ date: d, amount: -t.amount });
      else allFlows.push({ date: d, amount: t.amount });
    }
  }
  if (currentValue > 0) allFlows.push({ date: new Date(), amount: currentValue });

  const totalPL = currentValue + realized + dividends - invested;
  const totalPLpct = invested > 0 ? (totalPL / invested) * 100 : null;
  const portfolioXirr = xirr(allFlows);
  // Portfolio CAGR uses the earliest transaction date.
  let earliest: Date | null = null;
  for (const list of Object.values(txnsByPos)) for (const t of list) {
    const d = new Date(t.txn_date); if (!earliest || d < earliest) earliest = d;
  }
  const years = earliest ? (Date.now() - earliest.getTime()) / (365 * 86400000) : 0;
  const portfolioCagr = years > 0 ? cagr(invested, currentValue + realized + dividends, years) : null;

  const series = buildValueSeries(positions, txnsByPos, historyByPos, fxRates);

  return (
    <Box>
      <Box display="flex" gap={1.5} flexWrap="wrap" mb={2}>
        <Stat label="Investiert" value={fmtEur(invested)} />
        <Stat label="Aktueller Wert" value={fmtEur(currentValue)} />
        <Stat label="Gewinn/Verlust" value={`${fmtEur(totalPL)} (${fmtPct(totalPLpct)})`} color={totalPL >= 0 ? gainColor : lossColor} />
        <Stat label="IRR p.a." value={fmtPct(portfolioXirr != null ? portfolioXirr * 100 : null)} color={(portfolioXirr ?? 0) >= 0 ? gainColor : lossColor} />
        <Stat label="CAGR p.a." value={fmtPct(portfolioCagr != null ? portfolioCagr * 100 : null)} />
        {dividends > 0 && <Stat label="Dividenden" value={fmtEur(dividends)} color={gainColor} />}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Allokation (aktueller Wert)</Typography>
            {alloc.length > 0 ? (
              <PieChart
                height={260}
                series={[{
                  data: alloc.map((a) => ({ id: a.id, value: Math.round(a.value * 100) / 100, label: a.label })),
                  innerRadius: 40, paddingAngle: 2, cornerRadius: 4,
                  highlightScope: { faded: 'global', highlighted: 'item' },
                }]}
              />
            ) : <Typography variant="caption" color="text.secondary">Keine Kurse verfügbar.</Typography>}
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Gesamtrendite je Position (%)</Typography>
            {returnsBar.length > 0 ? (
              <BarChart
                height={260}
                xAxis={[{ scaleType: 'band', data: returnsBar.map((r) => r.ticker) }]}
                series={[{ data: returnsBar.map((r) => Math.round(r.pct * 100) / 100), label: 'Rendite %' }]}
              />
            ) : <Typography variant="caption" color="text.secondary">Keine Daten.</Typography>}
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Depotwert über Zeit (€)</Typography>
            {series.length > 1 ? (
              <LineChart
                height={300}
                xAxis={[{ scaleType: 'point', data: series.map((s) => s.date) }]}
                series={[{ data: series.map((s) => Math.round(s.value * 100) / 100), label: 'Depotwert €', area: true, showMark: false }]}
              />
            ) : <Typography variant="caption" color="text.secondary">Nicht genügend Verlaufsdaten.</Typography>}
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" color="text.secondary">
              Historische Fremdwährungswerte werden mit dem aktuellen Wechselkurs umgerechnet (Näherung).
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PortfolioAnalysis;
