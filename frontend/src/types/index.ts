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
  created_at: string;
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

