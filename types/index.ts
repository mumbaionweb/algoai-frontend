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
  code: string;
  status: 'active' | 'inactive' | 'paused';
  parameters?: Record<string, any>;
  created_at: string;
  updated_at: string;
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

