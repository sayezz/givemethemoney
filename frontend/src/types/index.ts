export interface User {
  id: number;
  email: string;
}

export interface Position {
  id: number;
  name: string;
  ticker: string;
  quantity: number;
  purchase_cost: number;
  purchase_fee: number;
  purchase_fee_fixed: number;
  purchase_fee_percent: number;
  sell_fee: number;
  sell_fee_fixed: number;
  sell_fee_percent: number;
  tax_rate: number;
  quote_provider: string;
  trailing_stop_active: boolean;
  ts_notification_sent: boolean;
  highest_price?: number | null;
  trailing_stop_percent?: number | null;
  purchase_date?: string | null;
  created_at: string;
}

// A live market quote in the stock's native currency.
export interface Quote {
  price: number;
  currency: string;
}

export type TransactionType = 'buy' | 'sell' | 'dividend';

// A dated cash flow on a position. All monetary values are in EUR.
export interface Transaction {
  id: number;
  position_id: number;
  txn_type: TransactionType;
  txn_date: string;   // YYYY-MM-DD
  quantity: number;   // shares (buy/sell); 0 for dividend
  price: number;      // price per share, EUR
  fee: number;        // EUR
  amount: number;     // dividend cash (EUR); buy/sell gross ± fee
  created_at?: string;
}

export interface HistoryPoint {
  date: string;       // YYYY-MM-DD
  close: number;      // native currency
}

// A broker fee preset (e.g. Trade Republic, Scalable Capital, DEGIRO).
export interface Broker {
  id: number;
  name: string;
  buy_fee_fixed: number;
  buy_fee_percent: number;
  sell_fee_fixed: number;
  sell_fee_percent: number;
  tax_rate: number;
  is_default: boolean;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange?: string;
}

export interface StockDetail {
  name?: string;
  isin?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  currency?: string;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingPE?: number;
  forwardPE?: number;
  pegRatio?: number;
  eps?: number;
  beta?: number;
  dividendYield?: number;
  dividendPerShare?: number;
  lastDividendAmount?: number;
  analystTargetPrice?: number;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

