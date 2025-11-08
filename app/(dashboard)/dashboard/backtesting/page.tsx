'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { runBacktest } from '@/lib/api/backtesting';
import { getOAuthStatus, getBrokerCredentials } from '@/lib/api/broker';
import type { BacktestResponse, BrokerCredentials } from '@/types';

export default function BacktestingPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<BacktestResponse | null>(null);
  
  // OAuth and credentials state
  const [checkingOAuth, setCheckingOAuth] = useState(true);
  const [oauthStatus, setOauthStatus] = useState<{ is_connected: boolean; has_credentials: boolean; has_tokens: boolean } | null>(null);
  const [credentials, setCredentials] = useState<BrokerCredentials[]>([]);
  const [selectedCredentialsId, setSelectedCredentialsId] = useState<string>('');

  // Form state
  const [strategyCode, setStrategyCode] = useState(`import backtrader as bt

class MyStrategy(bt.Strategy):
    """
    Simple Moving Average Crossover Strategy
    Buy when short MA crosses above long MA
    Sell when short MA crosses below long MA
    """
    
    params = (
        ('short_window', 20),
        ('long_window', 50),
    )
    
    def __init__(self):
        # Create moving averages
        self.short_ma = bt.indicators.SMA(self.data.close, period=self.params.short_window)
        self.long_ma = bt.indicators.SMA(self.data.close, period=self.params.long_window)
        
        # Crossover signal
        self.crossover = bt.indicators.CrossOver(self.short_ma, self.long_ma)
    
    def next(self):
        # Check if we have enough data
        if len(self.data) < self.params.long_window:
            return
        
        # Buy signal: short MA crosses above long MA (crossover > 0)
        if self.crossover > 0 and not self.position:
            # Buy with all available cash
            self.buy()
        
        # Sell signal: short MA crosses below long MA (crossover < 0)
        elif self.crossover < 0 and self.position:
            # Sell all positions
            self.sell()
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
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      checkOAuthAndLoadCredentials();
    }
  }, [isAuthenticated, isInitialized, router]);

  const checkOAuthAndLoadCredentials = async () => {
    try {
      setCheckingOAuth(true);
      
      // Load Zerodha credentials
      const creds = await getBrokerCredentials('zerodha');
      setCredentials(creds);
      
      // Check OAuth status if credentials exist
      if (creds.length > 0) {
        const activeCred = creds.find(c => c.is_active) || creds[0];
        setSelectedCredentialsId(activeCred.id);
        
        try {
          const status = await getOAuthStatus(activeCred.id);
          setOauthStatus(status);
        } catch (err) {
          console.error('Failed to check OAuth status:', err);
          setOauthStatus({ is_connected: false, has_credentials: true, has_tokens: false });
        }
      } else {
        setOauthStatus({ is_connected: false, has_credentials: false, has_tokens: false });
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
      setOauthStatus({ is_connected: false, has_credentials: false, has_tokens: false });
    } finally {
      setCheckingOAuth(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults(null);

    try {
      // Check OAuth status before running backtest
      if (!oauthStatus?.is_connected) {
        if (!oauthStatus?.has_credentials) {
          setError('Please add your Zerodha API credentials first. Go to Broker Settings to add them.');
          return;
        } else if (!oauthStatus?.has_tokens) {
          setError('Please complete OAuth flow to connect your Zerodha account. Go to Broker Settings to connect.');
          return;
        }
      }

      const request = {
        strategy_code: strategyCode,
        symbol: symbol.toUpperCase(),
        exchange: exchange.toUpperCase(),
        from_date: fromDate,
        to_date: toDate,
        initial_cash: initialCash,
        commission: commission,
      };

      const result = await runBacktest(
        request,
        'zerodha',
        selectedCredentialsId || undefined
      );
      setResults(result);
    } catch (err: any) {
      console.error('Backtest error:', err);
      const errorDetail = err.response?.data?.detail || '';
      
      // Handle specific errors
      if (err.response?.status === 400) {
        if (errorDetail.includes('credentials not found') || errorDetail.includes('Broker credentials not found')) {
          setError('Zerodha credentials not found. Please add your Zerodha API credentials first.');
        } else if (errorDetail.includes('Access token not found') || errorDetail.includes('OAuth')) {
          setError('Please complete OAuth flow to connect your Zerodha account.');
        } else if (errorDetail.includes('Instrument not found')) {
          // Extract symbol from error message if available
          const symbolMatch = errorDetail.match(/Instrument not found for (\w+):(\w+)/);
          if (symbolMatch) {
            const [, exchange, symbol] = symbolMatch;
            setError(`Instrument not found: ${symbol} on ${exchange}. Please check if the symbol is correct and available on this exchange.`);
          } else {
            setError('Invalid symbol or exchange. Please check and try again.');
          }
        } else if (errorDetail.includes('No historical data')) {
          setError('No historical data available for the selected symbol and date range.');
        } else if (errorDetail.includes('Strategy class not found') || errorDetail.includes('strategy class')) {
          setError('Strategy class not found in code. Your strategy must define a class that inherits from bt.Strategy. Please check the example code in the textarea above.');
        } else {
          setError(errorDetail || 'Failed to run backtest. Please check your strategy code and parameters.');
        }
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else {
        setError(errorDetail || err.message || 'Failed to run backtest. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardHeader title="Backtesting" backButton />

      <main className="container mx-auto px-4 py-8">
        {/* OAuth Status Alert */}
        {!checkingOAuth && oauthStatus && !oauthStatus.is_connected && (
          <div className="mb-6 bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg">
            {!oauthStatus.has_credentials ? (
              <div>
                <p className="mb-2">Please add your Zerodha API credentials first.</p>
                <Link
                  href="/dashboard/broker"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  Go to Broker Settings
                </Link>
              </div>
            ) : !oauthStatus.has_tokens ? (
              <div>
                <p className="mb-2">Please complete OAuth flow to connect your Zerodha account.</p>
                <Link
                  href="/dashboard/broker"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  Connect to Zerodha
                </Link>
              </div>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Backtest Configuration</h2>
            
            {checkingOAuth ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                <p className="text-gray-400">Checking connection status...</p>
              </div>
            ) : (
              <form onSubmit={handleRunBacktest} className="space-y-4">
                {/* Credentials Selection */}
                {credentials.length > 1 && (
                  <div>
                    <label htmlFor="credentials_id" className="block text-sm font-medium text-gray-300 mb-2">
                      Zerodha Account
                    </label>
                    <select
                      id="credentials_id"
                      value={selectedCredentialsId}
                      onChange={async (e) => {
                        const newCredId = e.target.value;
                        setSelectedCredentialsId(newCredId);
                        // Re-check OAuth status for selected credentials
                        try {
                          const status = await getOAuthStatus(newCredId);
                          setOauthStatus(status);
                        } catch (err) {
                          console.error('Failed to check OAuth status:', err);
                          setOauthStatus({ is_connected: false, has_credentials: true, has_tokens: false });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      {credentials.map((cred) => (
                        <option key={cred.id} value={cred.id}>
                          {cred.label || `Zerodha Account (${cred.api_key.substring(0, 8)}...)`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              <div>
                <label htmlFor="strategy_code" className="block text-sm font-medium text-gray-300 mb-2">
                  Strategy Code (Python - Backtrader Format)
                </label>
                <textarea
                  id="strategy_code"
                  value={strategyCode}
                  onChange={(e) => setStrategyCode(e.target.value)}
                  rows={15}
                  required
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white font-mono text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your trading strategy code using backtrader format..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  Your strategy must define a class that inherits from <code className="text-blue-400">bt.Strategy</code>.
                  Use the <code className="text-blue-400">next()</code> method for trading logic.
                </p>
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
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">
                  <p className="whitespace-pre-wrap">{error}</p>
                  {(error.includes('credentials') || error.includes('OAuth')) && (
                    <div className="mt-3">
                      <Link
                        href="/dashboard/broker"
                        className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                      >
                        Go to Broker Settings
                      </Link>
                    </div>
                  )}
                  {error.includes('Strategy class not found') && (
                    <div className="mt-3 p-3 bg-gray-700 rounded text-xs font-mono text-gray-300">
                      <p className="mb-2">Example format:</p>
                      <pre className="whitespace-pre-wrap">{`import backtrader as bt

class MyStrategy(bt.Strategy):
    def next(self):
        # Your trading logic here
        if self.data.close[0] > self.data.close[-1]:
            self.buy()
        else:
            self.sell()`}</pre>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !oauthStatus?.is_connected}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Running Backtest...' : 'Run Backtest'}
              </button>
            </form>
            )}
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
                {/* Backtest Info */}
                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Backtest Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Symbol:</span>
                      <span className="text-white ml-2">{results.symbol}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Exchange:</span>
                      <span className="text-white ml-2">{results.exchange}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Period:</span>
                      <span className="text-white ml-2">{results.from_date} to {results.to_date}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Initial Capital:</span>
                      <span className="text-white ml-2">₹{results.initial_cash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Total Return</div>
                    <div className={`text-2xl font-bold ${results.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {results.total_return_pct.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ₹{results.total_return.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Final Value</div>
                    <div className="text-2xl font-bold text-white">
                      ₹{results.final_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Total P&L</div>
                    <div className={`text-2xl font-bold ${results.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ₹{results.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Win Rate</div>
                    <div className="text-2xl font-bold text-white">
                      {results.win_rate !== null ? `${results.win_rate.toFixed(2)}%` : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {results.winning_trades}W / {results.losing_trades}L
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Total Trades</div>
                    <div className="text-2xl font-bold text-white">
                      {results.total_trades}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Sharpe Ratio</div>
                    <div className="text-2xl font-bold text-white">
                      {results.sharpe_ratio !== null ? results.sharpe_ratio.toFixed(2) : 'N/A'}
                    </div>
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Max Drawdown</div>
                    <div className="text-2xl font-bold text-red-400">
                      {results.max_drawdown_pct !== null ? `${results.max_drawdown_pct.toFixed(2)}%` : 'N/A'}
                    </div>
                    {results.max_drawdown !== null && (
                      <div className="text-xs text-gray-500 mt-1">
                        ₹{Math.abs(results.max_drawdown).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">System Quality Number</div>
                    <div className="text-2xl font-bold text-white">
                      {results.system_quality_number !== null ? results.system_quality_number.toFixed(2) : 'N/A'}
                    </div>
                  </div>
                </div>

                {results.annual_return !== null && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Annual Return</div>
                    <div className={`text-2xl font-bold ${results.annual_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {results.annual_return.toFixed(2)}%
                    </div>
                  </div>
                )}

                {results.average_return !== null && (
                  <div className="bg-gray-700 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Average Return</div>
                    <div className={`text-2xl font-bold ${results.average_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {results.average_return.toFixed(4)}
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

