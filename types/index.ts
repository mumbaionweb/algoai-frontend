// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  created_at?: string;
  updated_at?: string;
  is_active: boolean;
}

// Strategy Types
export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  strategy_code?: string; // For backward compatibility, also support 'code'
  code?: string; // Legacy field
  status: 'draft' | 'active' | 'paused' | 'stopped' | 'error';
  parameters?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  total_trades: number;
  win_rate: number | null;
  total_pnl: number;
}

export interface StrategyCreate {
  name: string;
  description?: string;
  strategy_code: string;
  parameters: {
    symbol: string;
    exchange?: string;
    from_date?: string;
    to_date?: string;
    initial_cash?: number;
    commission?: number;
    interval?: string;
    live?: boolean;
    [key: string]: any; // Additional strategy parameters
  };
}

export interface StrategyUpdate {
  name?: string;
  description?: string;
  strategy_code?: string;
  parameters?: Record<string, any>;
}

export interface StrategyActionResponse {
  success: boolean;
  message: string;
  strategy_id: string;
  status: string;
}

export interface StrategyPerformance {
  strategy_id: string;
  status: string;
  total_trades: number;
  win_rate: number | null;
  total_pnl: number;
  started_at?: string;
  stopped_at?: string;
}

export interface StrategiesListResponse {
  strategies: Strategy[];
  total: number;
}

export interface StrategyParams {
  broker_type?: string;
  credentials_id?: string;
}

// Order Types
export interface Order {
  id: string;
  user_id: string;
  strategy_id?: string;
  symbol: string;
  exchange: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL' | 'SLM';
  price?: number;
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';
  created_at: string;
}

// Portfolio Types
export interface PortfolioMargins {
  available?: number;
  utilised?: number;
  net?: number;
}

export interface Position {
  tradingsymbol: string;
  exchange: string;
  product: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  pnl_percentage: number;
  instrument_token?: number;
}

export interface Holding {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  average_price: number;
  last_price: number;
  pnl: number;
  pnl_percentage: number;
  instrument_token?: number;
}

export interface Portfolio {
  total_value: number;
  invested_value: number;
  current_value: number;
  total_pnl: number;
  total_pnl_percentage: number;
  margins?: PortfolioMargins;
  positions: Position[];
  holdings: Holding[];
}

// Portfolio API Parameters
export interface PortfolioParams {
  broker_type?: 'zerodha' | string;
  credentials_id?: string;
}

// Backtesting Types
export type IntervalType = 
  | 'day' 
  | '60minute' 
  | '30minute' 
  | '15minute' 
  | '5minute' 
  | '3minute' 
  | 'minute';

export interface IntervalOption {
  value: IntervalType;
  label: string;
  description: string;
  barsPerDay: number;
}

export const INTERVAL_OPTIONS: IntervalOption[] = [
  { value: 'day', label: 'Daily', description: '1 bar per trading day (~250/year)', barsPerDay: 1 },
  { value: '60minute', label: 'Hourly', description: '~6.25 bars per day (~1,562/year)', barsPerDay: 6.25 },
  { value: '30minute', label: '30 Minutes', description: '~12.5 bars per day (~3,125/year)', barsPerDay: 12.5 },
  { value: '15minute', label: '15 Minutes', description: '~25 bars per day (~6,250/year)', barsPerDay: 25 },
  { value: '5minute', label: '5 Minutes', description: '~75 bars per day (~18,750/year)', barsPerDay: 75 },
  { value: '3minute', label: '3 Minutes', description: '~125 bars per day (~31,250/year)', barsPerDay: 125 },
  { value: 'minute', label: '1 Minute', description: '~375 bars per day (~93,750/year)', barsPerDay: 375 },
];

export interface BacktestRequest {
  strategy_code: string;
  symbol: string;
  exchange?: string; // Default: "NSE"
  from_date: string; // Format: "YYYY-MM-DD"
  to_date: string; // Format: "YYYY-MM-DD"
  initial_cash?: number; // Default: 100000.0
  commission?: number; // Default: 0.001
  interval?: string;  // NEW: Data interval (default: "day")
  strategy_params?: Record<string, any>;
  broker_type?: string; // Default: "zerodha"
}

// Transaction interface
export interface Transaction {
  date?: string;
  symbol: string;
  exchange: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  entry_price?: number;
  exit_price?: number;
  pnl?: number;
  pnl_comm?: number;
  status: string;
  // Position and trade tracking fields
  trade_id?: string;
  position_type?: 'LONG' | 'SHORT';
  entry_action?: 'BUY' | 'SELL';
  exit_action?: 'BUY' | 'SELL';
  entry_date?: string;
  exit_date?: string;
}

// Position interface for Position View
export interface Position {
  trade_id: string;
  position_type: 'LONG' | 'SHORT';
  entry_action: string;
  exit_action: string;
  entry_date: string;
  entry_price: number;
  total_quantity: number;
  total_pnl: number;
  total_pnl_comm: number;
  transactions: Transaction[];
  is_closed: boolean;
  remaining_quantity?: number;
  symbol?: string;
  exchange?: string;
}

export interface BacktestResponse {
  backtest_id: string;
  symbol: string;
  exchange: string;
  from_date: string;
  to_date: string;
  initial_cash: number;
  final_value: number;
  total_return: number;
  total_return_pct: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number | null;
  total_pnl: number;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  max_drawdown_pct: number | null;
  system_quality_number: number | null;
  average_return: number | null;
  annual_return: number | null;
  // NEW FIELDS
  data_bars_count?: number;  // Number of historical data bars fetched
  transactions?: Transaction[];  // Individual trade transactions
}

// Backtest History
export interface BacktestHistoryItem {
  id: string;
  user_id: string;
  backtest_id: string;
  symbol: string;
  exchange: string;
  from_date: string;
  to_date: string;
  initial_cash: number;
  final_value: number;
  total_return: number;
  total_trades: number;
  win_rate: number | null;
  total_pnl: number;
  data_bars_count: number;
  transactions_count: number;
  created_at: string;
  updated_at: string;
}

export interface BacktestHistoryResponse {
  backtests: BacktestHistoryItem[];
  total: number;
}

// Legacy interface for backward compatibility
export interface BacktestResult {
  total_return: number;
  win_rate: number;
  total_trades: number;
  sharpe_ratio: number;
  max_drawdown: number;
  sqn: number;
}

// Broker Types
export type BrokerType = 'zerodha' | string;

export interface BrokerInfo {
  type: BrokerType;
  name: string;
  description?: string;
  logo_url?: string;
  website?: string;
}

export interface BrokerCredentials {
  id: string;
  user_id: string;
  broker_type: BrokerType;
  api_key: string;
  is_active: boolean;
  label?: string | null;
  zerodha_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrokerCredentialsFull extends BrokerCredentials {
  api_secret: string;
}

export interface BrokerCredentialsCreate {
  broker_type: BrokerType;
  api_key: string;
  api_secret: string;
  is_active?: boolean;
  label?: string | null;
  zerodha_user_id?: string | null;
}

export interface BrokerCredentialsUpdate {
  api_key?: string;
  api_secret?: string;
  is_active?: boolean;
  label?: string | null;
  zerodha_user_id?: string | null;
}

// OAuth Status Types
export interface OAuthStatus {
  is_connected: boolean;
  has_credentials: boolean;
  has_tokens: boolean;
  user_id: string;
}

// Zerodha User Profile Types
export interface ZerodhaUserProfile {
  user_id: string;
  user_type: string;
  email: string;
  user_name: string;
  user_shortname: string;
  broker: string;
  exchanges: string[];
  products: string[];
  order_types: string[];
  avatar_url: string | null;
  meta: {
    demat_consent: string;
  };
}

