'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { runBacktest, getBacktestHistory } from '@/lib/api/backtesting';
import { getOAuthStatus, getBrokerCredentials } from '@/lib/api/broker';
import type { BacktestResponse, BrokerCredentials, Transaction, BacktestHistoryItem, IntervalType, IntervalOption } from '@/types';
import { INTERVAL_OPTIONS } from '@/types';

export default function BacktestingPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<BacktestResponse | null>(null);
  const [history, setHistory] = useState<BacktestHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // OAuth and credentials state
  const [checkingOAuth, setCheckingOAuth] = useState(true);
  const [oauthStatus, setOauthStatus] = useState<{ is_connected: boolean; has_credentials: boolean; has_tokens: boolean } | null>(null);
  const [credentials, setCredentials] = useState<BrokerCredentials[]>([]);
  const [selectedCredentialsId, setSelectedCredentialsId] = useState<string>('');

  // Default strategy code
  const defaultStrategyCode = `import backtrader as bt

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
`;

  // Load from localStorage or use defaults
  const loadFromStorage = (key: string, defaultValue: any) => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(`backtest_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const saveToStorage = (key: string, value: any) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`backtest_${key}`, JSON.stringify(value));
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
  };

  // Form state with localStorage persistence
  const [strategyCode, setStrategyCode] = useState(() => 
    loadFromStorage('strategy_code', defaultStrategyCode)
  );
  const [symbol, setSymbol] = useState(() => 
    loadFromStorage('symbol', 'RELIANCE')
  );
  const [exchange, setExchange] = useState(() => 
    loadFromStorage('exchange', 'NSE')
  );
  const [fromDate, setFromDate] = useState(() => {
    const stored = loadFromStorage('from_date', null);
    if (stored) return stored;
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const stored = loadFromStorage('to_date', null);
    if (stored) return stored;
    return new Date().toISOString().split('T')[0];
  });
  const [initialCash, setInitialCash] = useState(() => 
    loadFromStorage('initial_cash', 100000)
  );
  const [commission, setCommission] = useState(() => 
    loadFromStorage('commission', 0.001)
  );
  const [interval, setInterval] = useState<IntervalType>(() => {
    const stored = loadFromStorage('interval', 'day');
    // Validate stored interval
    if (INTERVAL_OPTIONS.some(opt => opt.value === stored)) {
      return stored as IntervalType;
    }
    return 'day';
  });

  // Save to localStorage when values change
  useEffect(() => {
    saveToStorage('strategy_code', strategyCode);
    console.log('💾 Saved strategy code to localStorage');
  }, [strategyCode]);

  useEffect(() => {
    saveToStorage('symbol', symbol);
    console.log('💾 Saved symbol to localStorage:', symbol);
  }, [symbol]);

  useEffect(() => {
    saveToStorage('exchange', exchange);
    console.log('💾 Saved exchange to localStorage:', exchange);
  }, [exchange]);

  useEffect(() => {
    saveToStorage('from_date', fromDate);
    console.log('💾 Saved from_date to localStorage:', fromDate);
  }, [fromDate]);

  useEffect(() => {
    saveToStorage('to_date', toDate);
    console.log('💾 Saved to_date to localStorage:', toDate);
  }, [toDate]);

  useEffect(() => {
    saveToStorage('initial_cash', initialCash);
    console.log('💾 Saved initial_cash to localStorage:', initialCash);
  }, [initialCash]);

  useEffect(() => {
    saveToStorage('commission', commission);
    console.log('💾 Saved commission to localStorage:', commission);
  }, [commission]);

  useEffect(() => {
    saveToStorage('interval', interval);
    console.log('💾 Saved interval to localStorage:', interval);
  }, [interval]);
  
  // Symbol validation state
  const [symbolError, setSymbolError] = useState('');

  // Validate symbol format
  const validateSymbol = (symbolValue: string): string => {
    const trimmed = symbolValue.trim().toUpperCase();
    
    if (!trimmed) {
      return 'Symbol is required';
    }
    
    if (trimmed.length < 2) {
      return 'Symbol must be at least 2 characters';
    }
    
    if (trimmed.length > 20) {
      return 'Symbol must be 20 characters or less';
    }
    
    // Allow alphanumeric and hyphens (for suffixes like -EQ, -BE)
    if (!/^[A-Z0-9-]+$/.test(trimmed)) {
      return 'Symbol can only contain letters, numbers, and hyphens';
    }
    
    return '';
  };

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      console.log('📄 Backtesting page loaded');
      // Note: This log shows initial state values, not necessarily what was loaded from localStorage
      // The actual localStorage values are loaded in useState initializers above
      checkOAuthAndLoadCredentials();
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, isAuthenticated, router]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const historyData = await getBacktestHistory(50);
      setHistory(historyData.backtests);
      console.log('📜 Loaded backtest history:', historyData.total, 'items');
    } catch (err: any) {
      console.error('Failed to load history:', err);
      const errorDetail = err.response?.data?.detail || '';
      
      // Handle Firestore index error gracefully
      if (errorDetail.includes('requires an index') || errorDetail.includes('index')) {
        console.warn('⚠️ Firestore index required for backtest history. This is a backend configuration issue.');
        console.warn('The backend team needs to create the Firestore composite index.');
        // Don't show error to user - history is optional
        setHistory([]);
      } else {
        // Other errors - could show a non-blocking message
        console.error('History loading error:', errorDetail);
      }
    } finally {
      setLoadingHistory(false);
    }
  };

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
    setSymbolError('');

    console.log('🚀 Backtest submission started');
    console.log('📋 Current form state values (at submission time):');
    console.log('  - Symbol state:', symbol);
    console.log('  - Symbol trimmed/uppercase:', symbol.trim().toUpperCase());
    console.log('  - Exchange:', exchange);
    console.log('  - From Date:', fromDate);
    console.log('  - To Date:', toDate);
    console.log('  - Initial Cash:', initialCash);
    console.log('  - Commission:', commission);
    console.log('  - Strategy Code Length:', strategyCode.length);
    
    // Also check localStorage to see what's stored
    if (typeof window !== 'undefined') {
      const storedSymbol = localStorage.getItem('backtest_symbol');
      console.log('  - Symbol in localStorage:', storedSymbol ? JSON.parse(storedSymbol) : 'not found');
    }

    // Validate symbol before sending
    const symbolValidation = validateSymbol(symbol);
    if (symbolValidation) {
      console.error('❌ Symbol validation failed:', symbolValidation);
      setSymbolError(symbolValidation);
      setLoading(false);
      return;
    }

    try {
      // Check OAuth status before running backtest
      if (!oauthStatus?.is_connected) {
        if (!oauthStatus?.has_credentials) {
          console.error('❌ OAuth check failed: No credentials');
          setError('Please add your Zerodha API credentials first. Go to Broker Settings to add them.');
          setLoading(false);
          return;
        } else if (!oauthStatus?.has_tokens) {
          console.error('❌ OAuth check failed: No tokens');
          setError('Please complete OAuth flow to connect your Zerodha account. Go to Broker Settings to connect.');
          setLoading(false);
          return;
        }
      }

      // Get current symbol value (ensure we're using the latest state)
      const currentSymbol = symbol.trim().toUpperCase();
      
      console.log('📤 Preparing backtest request with current form values:');
      console.log('  - Symbol:', currentSymbol);
      console.log('  - Exchange:', exchange.toUpperCase());
      console.log('  - From Date:', fromDate);
      console.log('  - To Date:', toDate);
      console.log('  - Interval:', interval);
      console.log('  - Strategy Code Length:', strategyCode.length);
      console.log('  - Initial Cash:', initialCash);
      console.log('  - Commission:', commission);

      const request = {
        strategy_code: strategyCode,
        symbol: currentSymbol,
        exchange: exchange.toUpperCase(),
        from_date: fromDate,
        to_date: toDate,
        initial_cash: initialCash,
        commission: commission,
        interval: interval, // Include interval
      };

      // Log the exact symbol being sent
      console.log('🔍 FINAL SYMBOL CHECK - Symbol being sent to backend:', currentSymbol);
      console.log('🔍 Symbol state value:', symbol);
      console.log('🔍 Symbol after trim/uppercase:', currentSymbol);

      console.log('📤 Sending backtest request (strategy code truncated):', {
        ...request,
        strategy_code: request.strategy_code.substring(0, 200) + '... (truncated)',
      });
      console.log('🔧 Request config:', {
        brokerType: 'zerodha',
        credentialsId: selectedCredentialsId || 'none',
      });

      const startTime = Date.now();
      const result = await runBacktest(
        request,
        'zerodha',
        selectedCredentialsId || undefined
      );
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('✅ Backtest completed successfully');
      console.log('⏱️ Duration:', duration, 'ms', `(${(duration / 1000).toFixed(2)} seconds)`);
      console.log('📊 Backtest results:', {
        backtest_id: result.backtest_id,
        symbol: result.symbol,
        exchange: result.exchange,
        total_trades: result.total_trades,
        total_return_pct: result.total_return_pct,
        total_pnl: result.total_pnl,
        win_rate: result.win_rate,
        final_value: result.final_value,
        initial_cash: result.initial_cash,
        data_bars_count: result.data_bars_count || 0,
        transactions_count: result.transactions?.length || 0,
        fullResult: result,
      });

      // Check if results look suspicious (0 trades, 0 return, same as initial capital)
      if (result.total_trades === 0 && result.total_return_pct === 0 && result.final_value === result.initial_cash) {
        console.warn('⚠️ Suspicious results detected: 0 trades, 0 return, final value equals initial capital');
        console.warn('Data bars count:', result.data_bars_count || 0);
        console.warn('Transactions count:', result.transactions?.length || 0);
        console.warn('This could mean:');
        if ((result.data_bars_count || 0) === 0) {
          console.warn('1. ❌ NO HISTORICAL DATA - The backend could not fetch data for this symbol/date range');
        } else {
          console.warn('1. ✅ Data was fetched but the strategy found no trading opportunities in the date range');
        }
        console.warn('2. There was an error but the backend returned default values');
        console.warn('3. The strategy code has an issue preventing trades');
        console.warn('4. The date range might be too short or invalid');
      }

      setResults(result);
      
      // Refresh history after successful backtest
      await loadHistory();
    } catch (err: any) {
      console.error('❌ Backtest error occurred');
      console.error('Error object:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      console.error('Error config:', err.config);
      
      const errorDetail = err.response?.data?.detail || '';
      const errorMessage = err.message || '';
      
      console.error('Error details:', {
        detail: errorDetail,
        message: errorMessage,
        status: err.response?.status,
        statusText: err.response?.statusText,
        fullError: err,
      });
      
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
            const [, errorExchange, errorSymbol] = symbolMatch;
            setError(`Instrument not found: ${errorSymbol} on ${errorExchange}. Please verify the symbol is correct and available on this exchange. Common issues: typos (e.g., LTF vs LTFS), symbol may need a suffix (e.g., ${errorSymbol}-EQ for equity), or the symbol might not be available for the selected date range.`);
          } else {
            setError('Invalid symbol or exchange. Please check and try again.');
          }
          
          // Log detailed error for debugging
          console.error('🔍 Instrument Not Found - Debug Info:', {
            requestedSymbol: symbol.toUpperCase(),
            requestedExchange: exchange.toUpperCase(),
            errorDetail: errorDetail,
            requestPayload: {
              symbol: symbol.toUpperCase(),
              exchange: exchange.toUpperCase(),
              from_date: fromDate,
              to_date: toDate,
            },
            suggestion: 'Please verify the symbol spelling and format. Common issues: typos, missing suffix, or symbol not available for the date range.',
          });
        } else if (errorDetail.includes('No historical data found') || errorDetail.includes('No historical data')) {
          setError(`No historical data found for ${symbol} in the specified date range. Please check the symbol and date range.`);
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
                    onChange={(e) => {
                      const newCode = e.target.value;
                      console.log('📝 Strategy code changed, length:', newCode.length);
                      setStrategyCode(newCode);
                    }}
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
                    onChange={(e) => {
                      const newValue = e.target.value.toUpperCase().replace(/\s/g, '');
                      console.log('📝 Symbol changed:', newValue);
                      setSymbol(newValue);
                      // Validate on change
                      const validation = validateSymbol(newValue);
                      setSymbolError(validation);
                      if (validation) {
                        console.warn('⚠️ Symbol validation error:', validation);
                      } else {
                        console.log('✅ Symbol is valid');
                      }
                    }}
                    onBlur={() => {
                      // Final validation on blur
                      const validation = validateSymbol(symbol);
                      setSymbolError(validation);
                    }}
                    required
                    className={`w-full px-3 py-2 border rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                      symbolError ? 'border-red-500' : 'border-gray-600'
                    }`}
                    placeholder="RELIANCE"
                  />
                  {symbolError && (
                    <p className="mt-1 text-xs text-red-400">{symbolError}</p>
                  )}
                  {!symbolError && symbol && (
                    <p className="mt-1 text-xs text-green-400">
                      ✓ Valid format: {symbol.trim().toUpperCase()}
                    </p>
                  )}
                  {!symbol && (
                    <p className="mt-1 text-xs text-gray-400">
                      Enter a valid NSE/BSE symbol (e.g., RELIANCE, TCS, INFY)
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="exchange" className="block text-sm font-medium text-gray-300 mb-2">
                    Exchange
                  </label>
                  <select
                    id="exchange"
                    value={exchange}
                      onChange={(e) => {
                        const newExchange = e.target.value;
                        console.log('📝 Exchange changed:', newExchange);
                        setExchange(newExchange);
                      }}
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

              {/* Data Interval Selector */}
              <div>
                <label htmlFor="interval" className="block text-sm font-medium text-gray-300 mb-2">
                  Data Interval
                  <span className="ml-2 text-gray-400 text-xs" title="Select the time granularity for historical data">
                    (ℹ️ affects data granularity)
                  </span>
                </label>
                <select
                  id="interval"
                  value={interval}
                  onChange={(e) => {
                    const newInterval = e.target.value as IntervalType;
                    console.log('📝 Interval changed:', newInterval);
                    setInterval(newInterval);
                  }}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {INTERVAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.description}
                    </option>
                  ))}
                </select>
                {fromDate && toDate && (() => {
                  // Estimate data bars
                  const start = new Date(fromDate);
                  const end = new Date(toDate);
                  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  const tradingDays = Math.floor(daysDiff * 5 / 7); // Approximate trading days
                  const selectedInterval = INTERVAL_OPTIONS.find(opt => opt.value === interval);
                  const estimatedBars = selectedInterval ? Math.floor(tradingDays * selectedInterval.barsPerDay) : 0;
                  
                  return (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400">
                        Estimated data bars: <span className="text-white font-medium">{estimatedBars.toLocaleString()}</span>
                        {interval !== 'day' && estimatedBars > 10000 && (
                          <span className="ml-2 text-yellow-400">
                            ⚠️ Large dataset - may take longer to process
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })()}
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
                disabled={loading || !oauthStatus?.is_connected || !!symbolError}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Running Backtest...' : 'Run Backtest'}
              </button>
              {symbolError && (
                <p className="text-xs text-red-400 text-center mt-2">
                  Please fix the symbol error before running the backtest
                </p>
              )}
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
                {/* Warning for suspicious results */}
                {results.total_trades === 0 && results.total_return_pct === 0 && results.final_value === results.initial_cash && (
                  <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg text-sm">
                    <p className="font-semibold mb-2">⚠️ No trades executed</p>
                    <p className="mb-2">The backtest completed but no trades were executed. This could mean:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>The strategy found no trading opportunities in the selected date range</li>
                      <li>Historical data may not be available for this symbol/date range</li>
                      <li>The strategy conditions were not met during this period</li>
                      <li>Check the console logs for more details</li>
                    </ul>
                  </div>
                )}
                
                {/* Data Verification Section */}
                {(results.data_bars_count !== undefined || results.transactions !== undefined) && (
                  <div className="bg-gray-700 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3">Data Verification</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-400">Historical Data Bars:</span>
                      <span className={`font-bold text-sm ${(results.data_bars_count || 0) === 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {results.data_bars_count || 0}
                      </span>
                    </div>
                    
                    {(results.data_bars_count || 0) === 0 && (
                      <div className="mt-2 p-2 bg-red-500/10 border border-red-500 rounded text-red-400 text-xs">
                        ⚠️ No historical data found for this symbol/date range. Please check:
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Symbol is correct (e.g., "RELIANCE" not "RELI")</li>
                          <li>Date range is valid</li>
                          <li>Exchange is correct</li>
                        </ul>
                      </div>
                    )}
                    
                    {(results.data_bars_count || 0) > 0 && results.total_trades === 0 && (
                      <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500 rounded text-yellow-400 text-xs">
                        ℹ️ Data found but no trades generated. Your strategy didn't produce any buy/sell signals in this period.
                      </div>
                    )}
                  </div>
                )}

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
                      <span className="text-gray-400">Data Interval:</span>
                      <span className="text-white ml-2">
                        {INTERVAL_OPTIONS.find(opt => opt.value === interval)?.label || interval || 'Daily'}
                      </span>
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

                {/* Transactions Table */}
                {results.transactions && results.transactions.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4 mt-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Transaction History</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-600">
                            <th className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Date</th>
                            <th className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Type</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Quantity</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Entry Price</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Exit Price</th>
                            <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">P&L</th>
                            <th className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.transactions.map((txn, idx) => (
                            <tr 
                              key={idx} 
                                className={`border-b border-gray-600 hover:bg-gray-600/50 ${
                                  txn.pnl && txn.pnl > 0 ? 'bg-green-500/5' : txn.pnl && txn.pnl < 0 ? 'bg-red-500/5' : ''
                                }`}
                              >
                              <td className="py-3 px-4 text-white text-sm">
                                {txn.date ? new Date(txn.date).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                  txn.type === 'BUY' 
                                    ? 'bg-blue-500/20 text-blue-300' 
                                    : 'bg-red-500/20 text-red-300'
                                }`}>
                                  {txn.type}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-white text-sm text-right">{txn.quantity}</td>
                              <td className="py-3 px-4 text-white text-sm text-right">
                                {txn.entry_price ? `₹${txn.entry_price.toFixed(2)}` : 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-white text-sm text-right">
                                {txn.exit_price ? `₹${txn.exit_price.toFixed(2)}` : 'N/A'}
                              </td>
                              <td className={`py-3 px-4 text-sm font-semibold text-right ${
                                txn.pnl && txn.pnl > 0 
                                  ? 'text-green-400' 
                                  : txn.pnl && txn.pnl < 0 
                                  ? 'text-red-400' 
                                  : 'text-gray-400'
                              }`}>
                                {txn.pnl !== null && txn.pnl !== undefined 
                                  ? `₹${txn.pnl.toFixed(2)}` 
                                  : 'N/A'}
                              </td>
                              <td className="py-3 px-4 text-gray-400 text-sm">{txn.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 text-sm text-gray-400">
                      <p>Total Transactions: {results.transactions.length}</p>
                    </div>
                  </div>
                )}

                {results.transactions && results.transactions.length === 0 && (
                  <div className="bg-gray-700 rounded-lg p-4 mt-4 text-center text-gray-400 text-sm">
                    <p>No transaction details available.</p>
                    <p className="mt-2 text-xs">
                      Note: Transaction details may not be available if the strategy doesn't log trades.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History Section */}
          <div className="bg-gray-800 rounded-lg p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Recent Backtests</h2>
              <button
                onClick={loadHistory}
                disabled={loadingHistory}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {loadingHistory ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            
            {loadingHistory ? (
              <div className="text-gray-400 text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                <p>Loading history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                <p>No backtest history yet.</p>
                <p className="text-sm mt-2">Run a backtest to see it here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-white">{item.symbol}</p>
                          <span className="text-gray-400 text-sm">({item.exchange})</span>
                          {(item.data_bars_count || 0) > 0 && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                              {item.data_bars_count} bars
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {item.from_date} to {item.to_date}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(item.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-1">
                        <p className={`font-semibold text-lg ${item.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {item.total_return >= 0 ? '+' : ''}{item.total_return.toFixed(2)}%
                        </p>
                        <div className="flex gap-4 text-sm text-gray-400">
                          <span>{item.total_trades} trades</span>
                          {item.win_rate !== null && (
                            <span>{item.win_rate.toFixed(1)}% win rate</span>
                          )}
                        </div>
                        <p className={`text-sm font-medium ${item.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ₹{item.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

