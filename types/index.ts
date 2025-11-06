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
export interface Portfolio {
  total_value: number;
  available_cash: number;
  invested_amount: number;
  profit_loss: number;
  profit_loss_percent: number;
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
}

export interface BrokerCredentialsUpdate {
  api_key?: string;
  api_secret?: string;
  is_active?: boolean;
  label?: string | null;
}

