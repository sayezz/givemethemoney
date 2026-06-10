import React from 'react';

const CURRENCY_SYMBOLS = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
};

export const currencySymbol = (code) => CURRENCY_SYMBOLS[code] || (code || '€');

// Yahoo/FMP report London-listed prices in pence (GBp/GBX) — normalize to GBP.
export const normalizeQuote = (price, currency) => {
  const c = currency || 'EUR';
  if (c === 'GBp' || c === 'GBX') {
    return { price: price / 100, currency: 'GBP' };
  }
  return { price, currency: c };
};

export const formatNumber = (value, decimals = 2) =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Renders a monetary value in the stock's native currency, with the EUR
// equivalent shown as smaller secondary info when the currency isn't EUR.
export const CurrencyAmount = ({ native, eur, currency, decimals = 2, signed = false }) => {
  if (native == null) return '…';
  const symbol = currencySymbol(currency || 'EUR');
  const sign = signed && native >= 0 ? '+' : '';
  if (!currency || currency === 'EUR') {
    return `${sign}${formatNumber(native, decimals)} ${symbol}`;
  }
  return (
    <span className="currency-amount">
      <span className="cur-primary">{sign}{formatNumber(native, decimals)} {symbol}</span>
      {eur != null && <span className="cur-secondary">≈ {sign}{formatNumber(eur, decimals)} €</span>}
    </span>
  );
};

// Single-value display that switches between the native currency and its EUR
// equivalent based on a global toggle — used on the dashboard table.
export const formatAmount = (native, eur, currency, showEur, decimals = 2, signed = false) => {
  const value = showEur ? eur : native;
  if (value == null) return '…';
  const symbol = showEur ? '€' : currencySymbol(currency || 'EUR');
  const sign = signed && value >= 0 ? '+' : '';
  return `${sign}${formatNumber(value, decimals)} ${symbol}`;
};

// Compact inline string form, e.g. "250.00 $ (≈ 215.00 €)" — for dense rows.
export const formatDual = (native, eur, currency, decimals = 2) => {
  if (native == null) return '…';
  const symbol = currencySymbol(currency || 'EUR');
  if (!currency || currency === 'EUR') {
    return `${formatNumber(native, decimals)} ${symbol}`;
  }
  return eur != null
    ? `${formatNumber(native, decimals)} ${symbol} (≈ ${formatNumber(eur, decimals)} €)`
    : `${formatNumber(native, decimals)} ${symbol}`;
};
