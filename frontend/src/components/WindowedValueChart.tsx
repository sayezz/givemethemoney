import React, { useState } from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { LineChart } from '@mui/x-charts/LineChart';
import type { SeriesPoint } from '../utils/portfolio';

// Window length in trading days (~21/month). The caller passes the full daily
// buffer; the period buttons set the visible width and the arrows slide it.
const RANGES: { value: string; label: string; points: number }[] = [
  { value: '1mo', label: '1M', points: 21 },
  { value: '3mo', label: '3M', points: 63 },
  { value: '6mo', label: '6M', points: 126 },
  { value: '1y', label: '1J', points: 252 },
  { value: '2y', label: '2J', points: 504 },
  { value: '5y', label: '5J', points: 1300 },
  { value: 'max', label: 'Max', points: Number.MAX_SAFE_INTEGER },
];

interface Props {
  series: SeriesPoint[];     // full buffer, ascending by date
  buyDates?: string[];       // ISO dates of buy transactions
  sellDates?: string[];      // ISO dates of sell transactions
  height?: number;
  defaultRange?: string;
  valueLabel?: string;
}

const WindowedValueChart: React.FC<Props> = ({
  series: full, buyDates = [], sellDates = [], height = 300,
  defaultRange = '1y', valueLabel = 'Wert €',
}) => {
  const [range, setRange] = useState(defaultRange);
  const [offset, setOffset] = useState(0);

  if (full.length < 2) {
    return <Typography variant="caption" color="text.secondary">Nicht genügend Verlaufsdaten für diesen Zeitraum.</Typography>;
  }

  const windowLen = Math.min(RANGES.find((r) => r.value === range)?.points ?? 252, full.length);
  const maxOffset = Math.max(0, full.length - windowLen);
  const clampedOffset = Math.min(offset, maxOffset);
  const endIdx = full.length - clampedOffset;
  const startIdx = Math.max(0, endIdx - windowLen);
  const series = full.slice(startIdx, endIdx);

  const canPanOlder = clampedOffset < maxOffset;
  const canPanNewer = clampedOffset > 0;
  const panStep = Math.max(1, Math.floor(windowLen / 2));

  const mark = (dates: string[]): (number | null)[] => {
    const data: (number | null)[] = series.map(() => null);
    for (const d of dates) {
      let idx = series.findIndex((s) => s.date >= d);
      if (idx < 0) continue; // outside the visible window
      if (series[idx].date < d) continue;
      data[idx] = series[idx].value;
    }
    return data;
  };
  const buyData = mark(buyDates);
  const sellData = mark(sellDates);
  const hasBuys = buyData.some((v) => v != null);
  const hasSells = sellData.some((v) => v != null);

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={1}>
        <Box display="flex" alignItems="center" gap={0.5}>
          <IconButton size="small" onClick={() => setOffset(Math.min(maxOffset, clampedOffset + panStep))} disabled={!canPanOlder} title="Früherer Zeitraum">
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 160, textAlign: 'center' }}>
            {series[0].date} – {series[series.length - 1].date}
          </Typography>
          <IconButton size="small" onClick={() => setOffset(Math.max(0, clampedOffset - panStep))} disabled={!canPanNewer} title="Späterer Zeitraum">
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>
        <ToggleButtonGroup size="small" exclusive value={range} onChange={(_e, v) => { if (v) { setRange(v); setOffset(0); } }}>
          {RANGES.map((r) => (
            <ToggleButton key={r.value} value={r.value} sx={{ px: 1.2, py: 0.2 }}>{r.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <LineChart
        height={height}
        xAxis={[{ scaleType: 'point', data: series.map((s) => s.date) }]}
        series={[
          { data: series.map((s) => Math.round(s.value * 100) / 100), label: valueLabel, area: true, showMark: false, color: '#667eea' },
          ...(hasBuys ? [{ data: buyData, label: 'Kauf', showMark: true, connectNulls: false, color: '#66bb6a' } as const] : []),
          ...(hasSells ? [{ data: sellData, label: 'Verkauf', showMark: true, connectNulls: false, color: '#e57373' } as const] : []),
        ]}
      />
    </Box>
  );
};

export default WindowedValueChart;
