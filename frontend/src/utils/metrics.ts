import type { Transaction } from '../types';

export interface CashFlow {
  date: Date;
  amount: number; // negative = money out (buy), positive = money in (sell/dividend/current value)
}

const DAY = 1000 * 60 * 60 * 24;

export const yearsBetween = (a: Date, b: Date): number =>
  (b.getTime() - a.getTime()) / (365 * DAY);

// Net present value of dated cash flows at an annual rate (Actual/365).
const xnpv = (rate: number, flows: CashFlow[]): number => {
  const t0 = flows[0].date.getTime();
  return flows.reduce(
    (acc, cf) => acc + cf.amount / Math.pow(1 + rate, (cf.date.getTime() - t0) / (365 * DAY)),
    0,
  );
};

const dxnpv = (rate: number, flows: CashFlow[]): number => {
  const t0 = flows[0].date.getTime();
  return flows.reduce((acc, cf) => {
    const t = (cf.date.getTime() - t0) / (365 * DAY);
    return acc - (t * cf.amount) / Math.pow(1 + rate, t + 1);
  }, 0);
};

// Internal rate of return for irregular cash flows (annualized, money-weighted).
// Newton-Raphson with a bisection fallback. Returns a decimal (0.1 = 10%) or null.
export const xirr = (flows: CashFlow[]): number | null => {
  if (flows.length < 2) return null;
  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const hasPos = sorted.some((f) => f.amount > 0);
  const hasNeg = sorted.some((f) => f.amount < 0);
  if (!hasPos || !hasNeg) return null;

  // Newton-Raphson
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const v = xnpv(rate, sorted);
    const d = dxnpv(rate, sorted);
    if (Math.abs(d) < 1e-12) break;
    const next = rate - v / d;
    if (!isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-8) return next > -0.9999 ? next : null;
    rate = next;
  }

  // Bisection fallback on [-0.9999, 100]
  let lo = -0.9999;
  let hi = 100;
  let flo = xnpv(lo, sorted);
  let fhi = xnpv(hi, sorted);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = xnpv(mid, sorted);
    if (Math.abs(fmid) < 1e-7) return mid;
    if (flo * fmid < 0) { hi = mid; fhi = fmid; } else { lo = mid; flo = fmid; }
  }
  return (lo + hi) / 2;
};

// Compound annual growth rate from invested cost to current value over `years`.
export const cagr = (cost: number, currentValue: number, years: number): number | null => {
  if (cost <= 0 || years <= 0 || currentValue <= 0) return null;
  return Math.pow(currentValue / cost, 1 / years) - 1;
};

export interface PositionMetrics {
  shares: number;          // current shares held
  invested: number;        // total cash invested (buys incl. fees)
  realized: number;        // proceeds from sells (net of fees)
  dividends: number;       // total dividends received
  currentValue: number | null;
  totalReturnAbs: number | null;  // (currentValue + realized + dividends) - invested
  totalReturnPct: number | null;
  cagrPct: number | null;         // annualized (time-weighted-ish on net invested)
  xirrPct: number | null;         // annualized money-weighted
  firstDate: Date | null;
  holdingYears: number | null;
  dividendOnCostPct: number | null;
}

// Compute all indicators for one position from its transactions + current EUR price.
export const positionMetrics = (
  txns: Transaction[],
  currentPriceEur: number | null,
): PositionMetrics => {
  let shares = 0, invested = 0, realized = 0, dividends = 0;
  const flows: CashFlow[] = [];
  let firstDate: Date | null = null;

  for (const t of [...txns].sort((a, b) => a.txn_date.localeCompare(b.txn_date))) {
    const d = new Date(t.txn_date);
    if (!firstDate) firstDate = d;
    if (t.txn_type === 'buy') {
      shares += t.quantity;
      invested += t.amount;            // gross + fee
      flows.push({ date: d, amount: -t.amount });
    } else if (t.txn_type === 'sell') {
      shares -= t.quantity;
      realized += t.amount;            // gross - fee
      flows.push({ date: d, amount: t.amount });
    } else { // dividend
      dividends += t.amount;
      flows.push({ date: d, amount: t.amount });
    }
  }

  const currentValue = currentPriceEur != null ? shares * currentPriceEur : null;
  const totalReturnAbs = currentValue != null ? (currentValue + realized + dividends) - invested : null;
  const totalReturnPct = (totalReturnAbs != null && invested > 0) ? (totalReturnAbs / invested) * 100 : null;
  const holdingYears = firstDate ? yearsBetween(firstDate, new Date()) : null;

  let cagrPct: number | null = null;
  if (currentValue != null && holdingYears && holdingYears > 0) {
    const endVal = currentValue + realized + dividends;
    const c = cagr(invested, endVal, holdingYears);
    cagrPct = c != null ? c * 100 : null;
  }

  let xirrPct: number | null = null;
  if (currentValue != null) {
    const all = [...flows, { date: new Date(), amount: currentValue }];
    const r = xirr(all);
    xirrPct = r != null ? r * 100 : null;
  }

  const dividendOnCostPct = invested > 0 && dividends > 0 ? (dividends / invested) * 100 : null;

  return {
    shares, invested, realized, dividends, currentValue,
    totalReturnAbs, totalReturnPct, cagrPct, xirrPct,
    firstDate, holdingYears, dividendOnCostPct,
  };
};
