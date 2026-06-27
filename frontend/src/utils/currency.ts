import type { Quote } from '../types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

export const currencySymbol = (code?: string | null): string =>
  (code && CURRENCY_SYMBOLS[code]) || code || '€';

// Yahoo/FMP report London-listed prices in pence (GBp/GBX) — normalize to GBP.
export const normalizeQuote = (price: number, currency?: string | null): Quote => {
  const c = currency || 'EUR';
  if (c === 'GBp' || c === 'GBX') {
    return { price: price / 100, currency: 'GBP' };
  }
  return { price, currency: c };
};

export const formatNumber = (value: number | null | undefined, decimals = 2): string =>
  Number(value || 0).toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

// Single-value display that switches between the native currency and its EUR
// equivalent based on the global toggle — used on the dashboard table.
export const formatAmount = (
  native: number | null | undefined,
  eur: number | null | undefined,
  currency: string | null | undefined,
  showEur: boolean,
  decimals = 2,
  signed = false,
): string => {
  const value = showEur ? eur : native;
  if (value == null) return '…';
  const symbol = showEur ? '€' : currencySymbol(currency || 'EUR');
  const sign = signed && value >= 0 ? '+' : '';
  return `${sign}${formatNumber(value, decimals)} ${symbol}`;
};

// Compact inline string form, e.g. "250.00 $ (≈ 215.00 €)" — for dense rows.
export const formatDual = (
  native: number | null | undefined,
  eur: number | null | undefined,
  currency: string | null | undefined,
  decimals = 2,
): string => {
  if (native == null) return '…';
  const symbol = currencySymbol(currency || 'EUR');
  if (!currency || currency === 'EUR') {
    return `${formatNumber(native, decimals)} ${symbol}`;
  }
  return eur != null
    ? `${formatNumber(native, decimals)} ${symbol} (≈ ${formatNumber(eur, decimals)} €)`
    : `${formatNumber(native, decimals)} ${symbol}`;
};
