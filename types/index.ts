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

