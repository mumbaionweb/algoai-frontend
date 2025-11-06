'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';

interface BacktestRequest {
  strategy_code: string;
  symbol: string;
  exchange: string;
  from_date: string;
  to_date: string;
  initial_cash: number;
  commission: number;
  strategy_params?: Record<string, any>;
}

interface BacktestResponse {
  total_return?: number;
  win_rate?: number;
  total_trades?: number;
  sharpe_ratio?: number;
  max_drawdown?: number;
  sqn?: number;
  annual_return?: number;
}

export default function BacktestingPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<BacktestResponse | null>(null);

  // Form state
  const [strategyCode, setStrategyCode] = useState(`# Simple Moving Average Crossover Strategy
# Buy when short MA crosses above long MA
# Sell when short MA crosses below long MA

def initialize(context):
    context.short_window = 20
    context.long_window = 50
    context.position = None

def handle_data(context, data):
    # Get historical data
    prices = data.historical(context.symbol, context.long_window + 1)
    
    if len(prices) < context.long_window:
        return
    
    # Calculate moving averages
    short_ma = prices[-context.short_window:].mean()
    long_ma = prices[-context.long_window:].mean()
    
    # Trading logic
    if short_ma > long_ma and context.position is None:
        # Buy signal
        order_target_percent(context.symbol, 1.0)
        context.position = 'long'
    elif short_ma < long_ma and context.position == 'long':
        # Sell signal
        order_target_percent(context.symbol, 0.0)
        context.position = None
`);
  const [symbol, setSymbol] = useState('RELIANCE');
  const [exchange, setExchange] = useState('NSE');
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [initialCash, setInitialCash] = useState(100000);
  const [commission, setCommission] = useState(0.001);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const request: BacktestRequest = {
        strategy_code: strategyCode,
        symbol: symbol.toUpperCase(),
        exchange: exchange.toUpperCase(),
        from_date: fromDate,
        to_date: toDate,
        initial_cash: initialCash,
        commission: commission,
      };

      const response = await apiClient.post<BacktestResponse>('/api/backtesting/run', request);
      setResults(response.data);
    } catch (err: any) {
      console.error('Backtest error:', err);
      setError(
        err.response?.data?.detail || 
        err.message || 
        'Failed to run backtest. Please check your strategy code and parameters.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardHeader title="Backtesting" backButton />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Backtest Configuration</h2>
            
            <form onSubmit={handleRunBacktest} className="space-y-4">
              <div>
                <label htmlFor="strategy_code" className="block text-sm font-medium text-gray-300 mb-2">
                  Strategy Code (Python)
                </label>
                <textarea
                  id="strategy_code"
                  value={strategyCode}
                  onChange={(e) => setStrategyCode(e.target.value)}
                  rows={12}
                  required
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white font-mono text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your trading strategy code..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="symbol" className="block text-sm font-medium text-gray-300 mb-2">
                    Symbol
                  </label>
                  <input
                    id="symbol"
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="RELIANCE"
                  />
                </div>

                <div>
                  <label htmlFor="exchange" className="block text-sm font-medium text-gray-300 mb-2">
                    Exchange
                  </label>
                  <select
                    id="exchange"
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="from_date" className="block text-sm font-medium text-gray-300 mb-2">
                    From Date
                  </label>
                  <input
                    id="from_date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="to_date" className="block text-sm font-medium text-gray-300 mb-2">
                    To Date
                  </label>
                  <input
                    id="to_date"
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="initial_cash" className="block text-sm font-medium text-gray-300 mb-2">
                    Initial Capital (₹)
                  </label>
                  <input
                    id="initial_cash"
                    type="number"
                    value={initialCash}
                    onChange={(e) => setInitialCash(parseFloat(e.target.value))}
                    min="1000"
                    step="1000"
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="commission" className="block text-sm font-medium text-gray-300 mb-2">
                    Commission (%)
                  </label>
                  <input
                    id="commission"
                    type="number"
                    value={commission}
                    onChange={(e) => setCommission(parseFloat(e.target.value))}
                    min="0"
                    max="1"
                    step="0.001"
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500 text-white p-3 rounded text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Running Backtest...' : 'Run Backtest'}
              </button>
            </form>
          </div>

          {/* Results Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Backtest Results</h2>
            
            {!results && !loading && (
              <div className="text-gray-400 text-center py-12">
                <p>No results yet. Run a backtest to see results here.</p>
              </div>
            )}

            {loading && (
              <div className="text-gray-400 text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>Running backtest...</p>
              </div>
            )}

            {results && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Total Return</div>
                    <div className={`text-2xl font-bold ${(results.total_return || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {results.total_return !== undefined ? `${results.total_return.toFixed(2)}%` : 'N/A'}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Win Rate</div>
                    <div className="text-2xl font-bold text-white">
                      {results.win_rate !== undefined ? `${(results.win_rate * 100).toFixed(2)}%` : 'N/A'}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Total Trades</div>
                    <div className="text-2xl font-bold text-white">
                      {results.total_trades !== undefined ? results.total_trades : 'N/A'}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Sharpe Ratio</div>
                    <div className="text-2xl font-bold text-white">
                      {results.sharpe_ratio !== undefined ? results.sharpe_ratio.toFixed(2) : 'N/A'}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Max Drawdown</div>
                    <div className="text-2xl font-bold text-red-400">
                      {results.max_drawdown !== undefined ? `${(results.max_drawdown * 100).toFixed(2)}%` : 'N/A'}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">System Quality Number</div>
                    <div className="text-2xl font-bold text-white">
                      {results.sqn !== undefined ? results.sqn.toFixed(2) : 'N/A'}
                    </div>
                  </div>
                </div>

                {results.annual_return !== undefined && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Annual Return</div>
                    <div className={`text-2xl font-bold ${(results.annual_return || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {results.annual_return.toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

