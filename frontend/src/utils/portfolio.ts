import type { Position, Transaction, HistoryPoint } from '../types';

export interface SeriesPoint {
  date: string;   // YYYY-MM-DD
  value: number;  // portfolio value in EUR
}

interface PosHistory {
  currency: string;
  points: HistoryPoint[]; // ascending by date
}

// Shares held by a position as of (and including) a given ISO date.
const sharesAsOf = (txns: Transaction[], iso: string): number =>
  txns.reduce((acc, t) => {
    if (t.txn_date > iso) return acc;
    if (t.txn_type === 'buy') return acc + t.quantity;
    if (t.txn_type === 'sell') return acc - t.quantity;
    return acc;
  }, 0);

// Last close on or before an ISO date (forward-fill across gaps/holidays).
const closeAsOf = (points: HistoryPoint[], iso: string): number | null => {
  let val: number | null = null;
  for (const p of points) {
    if (p.date <= iso) val = p.close; else break;
  }
  return val;
};

// Build a daily EUR portfolio-value series.
// fxRates: native currency units per 1 EUR (current rates, used as approximation
// for historical conversion). historyByPos: per-position native closes.
export const buildValueSeries = (
  positions: Position[],
  txnsByPos: Record<number, Transaction[]>,
  historyByPos: Record<number, PosHistory>,
  fxRates: Record<string, number>,
): SeriesPoint[] => {
  // Union of all history dates.
  const dateSet = new Set<string>();
  for (const pid of Object.keys(historyByPos)) {
    for (const pt of historyByPos[Number(pid)].points) dateSet.add(pt.date);
  }
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) return [];

  // Earliest transaction date — don't plot before the first purchase.
  let earliest = '9999-12-31';
  for (const pid of Object.keys(txnsByPos)) {
    for (const t of txnsByPos[Number(pid)]) if (t.txn_date < earliest) earliest = t.txn_date;
  }

  const eurFactor = (currency: string): number => {
    if (!currency || currency === 'EUR') return 1;
    const r = fxRates[currency];
    return r && r > 0 ? 1 / r : 1; // EUR = native / rate
  };

  const series: SeriesPoint[] = [];
  for (const iso of dates) {
    if (iso < earliest) continue;
    let value = 0;
    for (const pos of positions) {
      const txns = txnsByPos[pos.id] || [];
      const shares = sharesAsOf(txns, iso);
      if (shares === 0) continue;
      const hist = historyByPos[pos.id];
      if (!hist) continue;
      const close = closeAsOf(hist.points, iso);
      if (close == null) continue;
      value += shares * close * eurFactor(hist.currency);
    }
    series.push({ date: iso, value });
  }
  return series;
};
