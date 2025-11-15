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
  // Direct intervals (from Zerodha)
  | 'minute' 
  | '3minute' 
  | '5minute' 
  | '15minute' 
  | '30minute' 
  | '60minute' 
  | 'day'
  // Aggregated intervals (built from daily data)
  | 'week' 
  | 'month' 
  | 'quarter' 
  | 'year';

export interface IntervalOption {
  value: IntervalType;
  label: string;
  description: string;
  category: 'intraday' | 'daily' | 'aggregated';
  barsPerDay: number; // Approximate bars per trading day (for aggregated, this is based on daily data)
  dateRangeRecommendation?: string; // Recommended date range for this interval
}

export const INTERVAL_OPTIONS: IntervalOption[] = [
  // Intraday intervals
  { value: 'minute', label: '1 Minute', description: 'Intraday (60 days max)', category: 'intraday', barsPerDay: 375, dateRangeRecommendation: '1-60 days' },
  { value: '3minute', label: '3 Minutes', description: 'Intraday (60 days max)', category: 'intraday', barsPerDay: 125, dateRangeRecommendation: '1-60 days' },
  { value: '5minute', label: '5 Minutes', description: 'Intraday (60 days max)', category: 'intraday', barsPerDay: 75, dateRangeRecommendation: '1-60 days' },
  { value: '15minute', label: '15 Minutes', description: 'Intraday (60 days max)', category: 'intraday', barsPerDay: 25, dateRangeRecommendation: '1-60 days' },
  { value: '30minute', label: '30 Minutes', description: 'Intraday (60 days max)', category: 'intraday', barsPerDay: 12.5, dateRangeRecommendation: '1-60 days' },
  { value: '60minute', label: '1 Hour', description: 'Intraday (60 days max)', category: 'intraday', barsPerDay: 6.25, dateRangeRecommendation: '1-60 days' },
  
  // Daily
  { value: 'day', label: 'Daily', description: 'Long-term (5 years max)', category: 'daily', barsPerDay: 1, dateRangeRecommendation: 'Up to 5 years' },
  
  // Aggregated intervals (built from daily data)
  { value: 'week', label: 'Weekly', description: 'Built from daily data', category: 'aggregated', barsPerDay: 1/5, dateRangeRecommendation: '1-10 years (recommended)' },
  { value: 'month', label: 'Monthly', description: 'Built from daily data', category: 'aggregated', barsPerDay: 1/20, dateRangeRecommendation: '1-20 years (recommended)' },
  { value: 'quarter', label: 'Quarterly', description: 'Built from daily data', category: 'aggregated', barsPerDay: 1/60, dateRangeRecommendation: '1-20 years (recommended)' },
  { value: 'year', label: 'Annual', description: 'Built from daily data', category: 'aggregated', barsPerDay: 1/250, dateRangeRecommendation: '5+ years (recommended)' },
];

export interface BacktestRequest {
  strategy_code: string;
  symbol: string;
  exchange?: string; // Default: "NSE"
  from_date: string; // Format: "YYYY-MM-DD"
  to_date: string; // Format: "YYYY-MM-DD"
  initial_cash?: number; // Default: 100000.0
  commission?: number; // Default: 0.001
  interval?: string;  // Optional: Single interval (for backward compatibility)
  intervals?: string[];  // NEW: Multiple intervals for multi-timeframe strategies (takes precedence over interval)
  strategy_params?: Record<string, any>;
  broker_type?: string; // Default: "zerodha"
}

// Transaction interface
export interface Transaction {
  date?: string;
  symbol: string;
  exchange: string;
  type: 'BUY' | 'SELL';  // Entry action (BUY for longs, SELL for shorts)
  quantity: number;
  entry_price?: number;
  exit_price?: number;
  pnl?: number;  // Gross Profit/Loss (before fees)
  pnl_comm?: number;  // Net Profit/Loss (after brokerage and platform fees)
  status: string;
  // Position and trade tracking fields
  trade_id?: string;
  position_type?: 'LONG' | 'SHORT';
  entry_action?: 'BUY' | 'SELL';
  exit_action?: 'BUY' | 'SELL';
  entry_date?: string;
  exit_date?: string;
  // Fee breakdown fields
  transaction_amount?: number;  // Transaction value (exit_price × quantity)
  brokerage?: number;  // Zerodha brokerage charges (always >= 0, per transaction)
  platform_fees?: number;  // Platform fees (currently 0, always >= 0)
  total_amount?: number;  // Total amount (transaction_amount + brokerage + platform_fees)
  order_ref?: string;  // Original order reference (for debugging/tracking)
}

// Position interface for Position View (backtest positions)
export interface BacktestPosition {
  trade_id: string;
  position_type: 'LONG' | 'SHORT';
  entry_action: string;
  exit_action: string;
  entry_date: string;
  entry_price: number;
  total_quantity: number;  // Entry quantity from entry transaction ONLY (not sum of all transactions)
  total_pnl: number;
  total_pnl_comm: number;
  total_brokerage: number;
  total_platform_fees: number;
  total_transaction_amount: number;
  total_amount: number;
  transactions: Transaction[];
  is_closed: boolean;  // All quantity closed? (entryQuantity === totalClosedQuantity)
  remaining_quantity?: number;  // Remaining = entryQuantity - sum of exits
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
  interval?: string;  // Primary interval (backward compatibility)
  intervals?: string[];  // NEW: All intervals used in multi-timeframe strategy
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
  token_details?: {
    access_token_present: boolean;
    access_token_length: number;
    refresh_token_present: boolean;
    refresh_token_length: number;
  };
}

// Token Health Check Types
export interface TokenHealthResponse {
  user_id: string;
  timestamp: string;
  checks: {
    credentials: {
      exists: boolean;
      status: string;
    };
    tokens_storage: {
      exists: boolean;
      access_token_present: boolean;
      access_token_length: number;
      refresh_token_present: boolean;
      refresh_token_length: number;
      status: string;
    };
    token_validation?: {
      valid: boolean;
      status: string;
      user_name?: string;
      user_id?: string;
      error?: string;
      is_expired?: boolean;
    };
    token_refresh?: {
      success: boolean;
      status: string;
      error?: string;
    };
  };
  overall_status: string;
  recommendation?: string;
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

