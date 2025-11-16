'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { runBacktest, getBacktestHistory, getBacktestHistoricalData, createBacktestJob, listBacktestJobs, type HistoricalDataPoint } from '@/lib/api/backtesting';
import { getOAuthStatus, getBrokerCredentials } from '@/lib/api/broker';
import type { BacktestResponse, BrokerCredentials, Transaction, BacktestHistoryItem, IntervalType, IntervalOption, BacktestPosition, BacktestJob } from '@/types';
import { INTERVAL_OPTIONS } from '@/types';
import { useBacktestProgress } from '@/hooks/useBacktestProgress';
import { BacktestJobCard } from '@/components/backtesting/BacktestJobCard';
import { formatDate, formatDateShort } from '@/utils/dateUtils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Helper function to analyze strategy code for multi-timeframe usage
function analyzeStrategyCode(code: string): { isMultiTimeframe: boolean; requiredIntervals: number } {
  // Check for multi-timeframe patterns: datas[1], datas[2], etc.
  const multiTimeframePattern = /datas\[(\d+)\]/g;
  const matches = Array.from(code.matchAll(multiTimeframePattern));
  
  if (matches.length === 0) {
    return { isMultiTimeframe: false, requiredIntervals: 1 };
  }
  
  // Find the highest index used (e.g., datas[2] means we need at least 3 intervals: 0, 1, 2)
  const maxIndex = Math.max(...matches.map(m => parseInt(m[1], 10)));
  const requiredIntervals = maxIndex + 1; // +1 because indices are 0-based
  
  return {
    isMultiTimeframe: true,
    requiredIntervals,
  };
}

export default function BacktestingPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<BacktestResponse | null>(null);
  const [history, setHistory] = useState<BacktestHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Async job management
  const [useAsyncMode, setUseAsyncMode] = useState(true); // Default to async mode
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<BacktestJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  
  // Get Firebase token for WebSocket
  const token = typeof window !== 'undefined' ? localStorage.getItem('firebase_token') : null;
  
  // Use progress hook for active job
  const { job: activeJob, progress, status, completed, result: jobResult } = useBacktestProgress({
    jobId: activeJobId,
    token,
    useWebSocket: true,
  });
  
  // Update results when job completes
  useEffect(() => {
    console.log('🔍 Results update check:', { completed, jobResult: !!jobResult, activeJob: !!activeJob, activeJobResult: !!activeJob?.result });
    if (completed) {
      // Try to get result from jobResult first, then from activeJob.result
      const result = jobResult || activeJob?.result || null;
      if (result) {
        console.log('✅ Setting results from completed job:', result);
        setResults(result);
        setLoading(false);
        loadHistory(); // Refresh history
      } else {
        console.warn('⚠️ Job completed but no result available yet. Job status:', activeJob?.status, 'Job result:', activeJob?.result);
        // If job is completed but no result, try fetching the job again
        if (activeJobId && activeJob?.status === 'completed' && !activeJob.result) {
          console.log('🔄 Fetching job again to get result...');
          // The useBacktestProgress hook will handle fetching
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, jobResult, activeJob]);
  
  // Transaction view mode: 'position' (default) or 'transaction'
  const [viewMode, setViewMode] = useState<'position' | 'transaction'>('position');
  
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
  // Interval selection (always multi-select UI, but can select single or multiple)
  const [intervals, setIntervals] = useState<string[]>(() => {
    const stored = loadFromStorage('intervals', null);
    return stored && Array.isArray(stored) && stored.length > 0 ? stored : ['day'];
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
    saveToStorage('intervals', intervals);
    console.log('💾 Saved intervals to localStorage:', intervals);
  }, [intervals]);
  
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

  const loadJobs = async () => {
    try {
      setLoadingJobs(true);
      const jobList = await listBacktestJobs(undefined, 20); // Get last 20 jobs
      setJobs(jobList);
      console.log('📋 Loaded backtest jobs:', jobList.length, 'jobs');
    } catch (err: any) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const historyData = await getBacktestHistory(5); // Limit to 5 recent backtests
      setHistory(historyData.backtests.slice(0, 5)); // Ensure max 5 items
      console.log('📜 Loaded backtest history:', historyData.total, 'items (showing max 5)');
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

    // Analyze strategy code to determine if multi-timeframe is required
    const strategyAnalysis = analyzeStrategyCode(strategyCode);
    console.log('📊 Strategy code analysis:', strategyAnalysis);

    // Validate intervals based on strategy code requirements
    if (!intervals || intervals.length === 0) {
      console.error('❌ No intervals selected');
      setError('Please select at least one interval.');
      setLoading(false);
      return;
    }

    if (strategyAnalysis.isMultiTimeframe) {
      if (intervals.length < strategyAnalysis.requiredIntervals) {
        console.error(`❌ Strategy requires ${strategyAnalysis.requiredIntervals} intervals but only ${intervals.length} selected`);
        setError(`Your strategy code uses multi-timeframe (detected usage of datas[${strategyAnalysis.requiredIntervals - 1}]). Please select at least ${strategyAnalysis.requiredIntervals} intervals.`);
        setLoading(false);
        return;
      }
      console.log(`✅ Multi-timeframe strategy detected: ${intervals.length} intervals selected (required: ${strategyAnalysis.requiredIntervals})`);
    } else {
      console.log('✅ Single timeframe strategy detected');
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
      console.log('  - Intervals:', intervals);
      console.log('  - Strategy Code Length:', strategyCode.length);
      console.log('  - Initial Cash:', initialCash);
      console.log('  - Commission:', commission);

      const request: any = {
        strategy_code: strategyCode,
        symbol: currentSymbol,
        exchange: exchange.toUpperCase(),
        from_date: fromDate,
        to_date: toDate,
        initial_cash: initialCash,
        commission: commission,
      };

      // Always send intervals array (backend handles both single and multi-timeframe)
      if (intervals.length === 1) {
        // Single interval: send as both interval (backward compatibility) and intervals array
        request.interval = intervals[0];
        request.intervals = intervals;
        console.log('  - Interval:', intervals[0]);
        console.log('  - Intervals:', intervals);
      } else {
        // Multiple intervals: send as intervals array
        request.intervals = intervals;
        console.log('  - Intervals:', intervals);
      }

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
        useAsyncMode,
      });

      // Use async mode if enabled
      if (useAsyncMode) {
        try {
          console.log('🚀 Creating async backtest job...');
          const newJob = await createBacktestJob(
            request,
            'zerodha',
            selectedCredentialsId || undefined
          );
          console.log('✅ Backtest job created:', {
            job_id: newJob.job_id,
            status: newJob.status,
          });
          setActiveJobId(newJob.job_id);
          setLoading(false); // Don't keep loading state, let progress hook handle it
          setError(''); // Clear any previous errors
          return; // Exit early, progress will be handled by WebSocket
        } catch (jobErr: any) {
          console.error('❌ Failed to create backtest job:', jobErr);
          const errorDetail = jobErr.response?.data?.detail || '';
          const errorMessage = jobErr.message || '';
          
          // Handle specific errors
          if (jobErr.response?.status === 400) {
            if (errorDetail.includes('credentials not found') || errorDetail.includes('Broker credentials not found')) {
              setError('Zerodha credentials not found. Please add your Zerodha API credentials first.');
            } else if (errorDetail.includes('Access token not found') || errorDetail.includes('OAuth')) {
              setError('Please complete OAuth flow to connect your Zerodha account.');
            } else if (errorDetail.includes('Instrument not found')) {
              setError(`Invalid symbol: ${currentSymbol}. Please check the symbol and try again.`);
            } else {
              setError(errorDetail || 'Failed to create backtest job. Please check your parameters.');
            }
          } else if (jobErr.response?.status === 500) {
            setError('Server error. Please try again later.');
          } else {
            setError(errorDetail || errorMessage || 'Failed to create backtest job. Please try again.');
          }
          setLoading(false);
          return; // Exit early on error
        }
      }

      // Synchronous mode (backward compatibility)
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
      
      // 🔍 DEBUG: Detailed transaction logging
      console.log('🔍 Transaction Details Debug:', {
        has_transactions: !!result.transactions,
        transactions_type: typeof result.transactions,
        transactions_is_array: Array.isArray(result.transactions),
        transactions_length: result.transactions?.length || 0,
        transactions_value: result.transactions,
        total_trades: result.total_trades,
        mismatch: result.total_trades > 0 && (!result.transactions || result.transactions.length === 0) 
          ? '⚠️ WARNING: total_trades > 0 but no transactions array!' 
          : 'OK',
      });
      
      if (result.transactions && result.transactions.length > 0) {
        console.log('✅ Transactions found:', {
          count: result.transactions.length,
          first_transaction: result.transactions[0],
          last_transaction: result.transactions[result.transactions.length - 1],
        });
      } else if (result.total_trades > 0) {
        console.warn('⚠️ WARNING: Backend reports', result.total_trades, 'trades but transactions array is missing or empty!');
        console.warn('This could mean:');
        console.warn('1. Backend is not including transactions in the response');
        console.warn('2. Transactions need to be fetched from a separate endpoint');
        console.warn('3. Backend is not logging transactions in the strategy');
      }

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
      <DashboardNavigation />

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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Backtest Configuration</h2>
              {/* Async Mode Toggle */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAsyncMode}
                    onChange={(e) => setUseAsyncMode(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span>Async Mode (Real-time Progress)</span>
                </label>
              </div>
            </div>
            
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

              {/* Data Interval Selector - Always Multi-Select UI */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data Intervals
                  <span className="ml-2 text-gray-400 text-xs" title="Select one or more intervals based on your strategy code">
                    (ℹ️ Select intervals based on your strategy code)
                  </span>
                </label>
                
                {/* Group intervals by category */}
                {(() => {
                  const intradayOptions = INTERVAL_OPTIONS.filter(opt => opt.category === 'intraday');
                  const dailyOptions = INTERVAL_OPTIONS.filter(opt => opt.category === 'daily');
                  const aggregatedOptions = INTERVAL_OPTIONS.filter(opt => opt.category === 'aggregated');
                  
                  return (
                    <div className="space-y-4">
                      {/* Intraday Intervals */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Intraday</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                          {intradayOptions.map((option) => {
                            const isSelected = intervals.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    if (intervals.length > 1) {
                                      setIntervals(intervals.filter(i => i !== option.value));
                                    }
                                  } else {
                                    setIntervals([...intervals, option.value]);
                                  }
                                }}
                                className={`p-2 rounded-lg border-2 transition-all text-sm ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                                }`}
                                title={option.dateRangeRecommendation ? `Recommended: ${option.dateRangeRecommendation}` : undefined}
                              >
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{option.description}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Daily Interval */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Daily</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                          {dailyOptions.map((option) => {
                            const isSelected = intervals.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    if (intervals.length > 1) {
                                      setIntervals(intervals.filter(i => i !== option.value));
                                    }
                                  } else {
                                    setIntervals([...intervals, option.value]);
                                  }
                                }}
                                className={`p-2 rounded-lg border-2 transition-all text-sm ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                                }`}
                                title={option.dateRangeRecommendation ? `Recommended: ${option.dateRangeRecommendation}` : undefined}
                              >
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-gray-400 mt-0.5">{option.description}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Aggregated Intervals */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Aggregated (from Daily Data)</h4>
                          <span 
                            className="text-xs text-gray-500 cursor-help" 
                            title="Weekly, Monthly, Quarterly, and Annual bars are built from daily data. For date ranges > 5 years, data is fetched in parallel chunks."
                          >
                            ⓘ
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {aggregatedOptions.map((option) => {
                            const isSelected = intervals.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    if (intervals.length > 1) {
                                      setIntervals(intervals.filter(i => i !== option.value));
                                    }
                                  } else {
                                    setIntervals([...intervals, option.value]);
                                  }
                                }}
                                className={`p-2 rounded-lg border-2 transition-all text-sm relative ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                                }`}
                                title={option.dateRangeRecommendation ? `Recommended: ${option.dateRangeRecommendation}. Built from daily data.` : 'Built from daily data'}
                              >
                                <div className="font-medium flex items-center gap-1">
                                  {option.label}
                                  <span className="text-xs text-gray-500" title="Built from daily data">ⓘ</span>
                                </div>
                                <div className="text-xs text-gray-400 mt-0.5">{option.description}</div>
                                {option.dateRangeRecommendation && (
                                  <div className="text-xs text-blue-400 mt-1">
                                    {option.dateRangeRecommendation}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {intervals.length > 0 && (() => {
                  // Analyze strategy code to show appropriate messages
                  const strategyAnalysis = analyzeStrategyCode(strategyCode);
                  
                  return (
                    <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm font-medium text-blue-300 mb-2">
                        Selected Intervals ({intervals.length}):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {intervals.map((intervalValue, idx) => (
                          <span
                            key={intervalValue}
                            className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-medium"
                          >
                            datas[{idx}]: {INTERVAL_OPTIONS.find(o => o.value === intervalValue)?.label || intervalValue}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-blue-400 mt-2">
                        💡 In your strategy code: <code className="bg-gray-800 px-1 rounded">self.datas[0]</code> = {intervals[0]}, {intervals[1] ? `<code className="bg-gray-800 px-1 rounded">self.datas[1]</code> = ${intervals[1]}` : ''}, etc.
                      </p>
                      {strategyAnalysis.isMultiTimeframe && intervals.length < strategyAnalysis.requiredIntervals && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                          ⚠️ <strong>Strategy requires {strategyAnalysis.requiredIntervals} intervals:</strong> Your strategy code uses <code className="bg-gray-800 px-1 rounded">datas[{strategyAnalysis.requiredIntervals - 1}]</code>, but you've only selected {intervals.length} interval{intervals.length !== 1 ? 's' : ''}. Please select at least {strategyAnalysis.requiredIntervals} intervals.
                        </div>
                      )}
                      {strategyAnalysis.isMultiTimeframe && intervals.length >= strategyAnalysis.requiredIntervals && intervals.length > 1 && (
                        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
                          ⚠️ <strong>Multi-timeframe backtest:</strong> This will fetch data for {intervals.length} intervals. Estimated processing time may be longer.
                        </div>
                      )}
                      {/* Show warning for aggregated intervals */}
                      {intervals.some(i => {
                        const option = INTERVAL_OPTIONS.find(opt => opt.value === i);
                        return option?.category === 'aggregated';
                      }) && (
                        <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-400">
                          ℹ️ <strong>Aggregated intervals selected:</strong> The backend will fetch daily data first, then aggregate to {intervals.filter(i => {
                            const option = INTERVAL_OPTIONS.find(opt => opt.value === i);
                            return option?.category === 'aggregated';
                          }).map(i => INTERVAL_OPTIONS.find(opt => opt.value === i)?.label).join(', ')}. This may take longer for large date ranges.
                        </div>
                      )}
                      {/* Show date range recommendations */}
                      {intervals.length > 0 && fromDate && toDate && (() => {
                        const selectedOptions = intervals.map(i => INTERVAL_OPTIONS.find(opt => opt.value === i)).filter(Boolean);
                        const recommendations = selectedOptions
                          .map(opt => opt?.dateRangeRecommendation)
                          .filter(Boolean)
                          .filter((v, i, a) => a.indexOf(v) === i); // Unique values
                        
                        if (recommendations.length > 0) {
                          return (
                            <div className="mt-2 p-2 bg-gray-700/50 border border-gray-600 rounded text-xs text-gray-300">
                              💡 <strong>Recommended date ranges:</strong> {recommendations.join(', ')}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  );
                })()}

                {fromDate && toDate && (() => {
                  // Estimate data bars
                  const start = new Date(fromDate);
                  const end = new Date(toDate);
                  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                  const tradingDays = Math.floor(daysDiff * 5 / 7); // Approximate trading days
                  
                  const totalBars = intervals.reduce((sum, intervalValue) => {
                    const option = INTERVAL_OPTIONS.find(opt => opt.value === intervalValue);
                    return sum + (option ? Math.floor(tradingDays * option.barsPerDay) : 0);
                  }, 0);
                  
                  return (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400">
                        Estimated total data bars: <span className="text-white font-medium">{totalBars.toLocaleString()}</span>
                        {intervals.some(i => i !== 'day') && totalBars > 10000 && (
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
                <div className={`border px-4 py-3 rounded-lg text-sm ${
                  error.includes('taking longer than expected') || error.includes('timeout')
                    ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
                    : 'bg-red-500/10 border-red-500 text-red-400'
                }`}>
                  <p className="whitespace-pre-wrap">{error}</p>
                  {(error.includes('taking longer than expected') || error.includes('timeout')) && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-gray-300">
                        💡 <strong>Tips:</strong>
                      </p>
                      <ul className="list-disc list-inside text-xs text-gray-300 space-y-1 ml-2">
                        <li>Complex multi-timeframe strategies with large datasets can take 30-60 seconds</li>
                        <li>Try reducing the date range or number of intervals</li>
                        <li>Check your network connection</li>
                        <li>Wait a moment and try again - the backend may still be processing</li>
                      </ul>
                    </div>
                  )}
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
                disabled={loading || !oauthStatus?.is_connected || !!symbolError || !intervals || intervals.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading 
                  ? (useAsyncMode ? 'Creating Job...' : 'Running Backtest...') 
                  : (useAsyncMode ? 'Create Backtest Job' : 'Run Backtest')}
              </button>
              {symbolError && (
                <p className="text-xs text-red-400 text-center mt-2">
                  Please fix the symbol error before running the backtest
                </p>
              )}
              {(!intervals || intervals.length === 0) && (
                <p className="text-xs text-red-400 text-center mt-2">
                  Please select at least one interval
                </p>
              )}
              {(() => {
                const strategyAnalysis = analyzeStrategyCode(strategyCode);
                if (strategyAnalysis.isMultiTimeframe && intervals && intervals.length < strategyAnalysis.requiredIntervals) {
                  return (
                    <p className="text-xs text-red-400 text-center mt-2">
                      Your strategy requires {strategyAnalysis.requiredIntervals} intervals but you've selected {intervals.length}. Please select more intervals.
                    </p>
                  );
                }
                return null;
              })()}
            </form>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Backtest Results</h2>
            
            {/* Active Job Progress (Async Mode) */}
            {useAsyncMode && activeJobId && activeJob && (
              <div className="mb-6 bg-gray-700 rounded-lg p-4 border border-gray-600">
                <h3 className="text-lg font-semibold text-white mb-4">Current Backtest Job</h3>
                <BacktestJobCard job={activeJob} onUpdate={() => {}} />
              </div>
            )}
            
            {!results && !loading && !activeJob && (
              <div className="text-gray-400 text-center py-12">
                <p>No results yet. {useAsyncMode ? 'Create a backtest job' : 'Run a backtest'} to see results here.</p>
              </div>
            )}

            {/* Show message if job completed but results not loaded yet */}
            {useAsyncMode && activeJob && activeJob.status === 'completed' && !results && !activeJob.result && (
              <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg text-sm">
                <p className="font-semibold mb-2">⏳ Results Loading...</p>
                <p>The backtest job has completed, but results are still being processed. Please wait a moment or refresh the page.</p>
              </div>
            )}

            {loading && !useAsyncMode && (
              <div className="text-gray-400 text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>Running backtest...</p>
                {intervals.some(i => {
                  const option = INTERVAL_OPTIONS.find(opt => opt.value === i);
                  return option?.category === 'aggregated';
                }) && (
                  <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg max-w-md mx-auto">
                    <p className="text-sm text-purple-300 font-medium mb-1">
                      Fetching daily data and aggregating...
                    </p>
                    <p className="text-xs text-purple-400">
                      This may take a moment for large date ranges. The backend handles chunking and parallel fetching automatically.
                    </p>
                  </div>
                )}
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
                    {results.intervals && results.intervals.length > 1 && (
                      <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <p className="text-sm font-medium text-purple-300 mb-1">
                          Multi-Timeframe Strategy:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {results.intervals.map((intervalValue, idx) => (
                            <span
                              key={intervalValue}
                              className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs"
                            >
                              datas[{idx}]: {INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col lg:flex-row gap-4">
                      {/* Left side - Data info */}
                      <div className="flex-1 min-w-0">
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
                      
                      {/* Right side - Timeseries Charts (one per interval for multi-timeframe) */}
                      {(results.data_bars_count || 0) > 0 && (
                        <div className="flex-1 min-w-0 lg:min-w-[300px]">
                          <DataBarsChart 
                            backtestId={results.backtest_id}
                            dataBarsCount={results.data_bars_count || 0}
                            fromDate={results.from_date}
                            toDate={results.to_date}
                            symbol={results.symbol}
                            intervals={results.intervals}
                            primaryInterval={results.interval}
                          />
                        </div>
                      )}
                    </div>
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
                        {results.intervals && results.intervals.length > 1 ? (
                          <div className="flex flex-wrap gap-1">
                            {results.intervals.map((intervalValue, idx) => (
                              <span key={intervalValue} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                                datas[{idx}]: {INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}
                              </span>
                            ))}
                          </div>
                        ) : (
                          results.intervals && results.intervals.length === 1 ? (
                            INTERVAL_OPTIONS.find(opt => opt.value === results.intervals?.[0])?.label || results.intervals?.[0] || 'Daily'
                          ) : (
                            INTERVAL_OPTIONS.find(opt => opt.value === results.interval)?.label || results.interval || 'Daily'
                          )
                        )}
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

                {/* Transaction History with Position and Transaction Views */}
                {results.transactions && results.transactions.length > 0 && (
                  <div className="bg-gray-700 rounded-lg p-4 mt-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">
                        Transaction History ({results.transactions.length} transactions)
                      </h3>
                    </div>
                    
                    {/* Capital Allocation (if available from backend) */}
                    {(results.open_positions_count !== undefined || results.total_invested_capital !== undefined) && (
                      <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                        <p className="font-semibold text-blue-400 mb-2">💰 Capital Allocation</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                          {results.open_positions_count !== undefined && (
                            <div>
                              <span className="text-gray-400">Open Positions:</span>
                              <span className="text-white ml-2 font-semibold">{results.open_positions_count}</span>
                            </div>
                          )}
                          {results.closed_positions_count !== undefined && (
                            <div>
                              <span className="text-gray-400">Closed Positions:</span>
                              <span className="text-white ml-2 font-semibold">{results.closed_positions_count}</span>
                            </div>
                          )}
                          {results.total_invested_capital !== undefined && (
                            <div>
                              <span className="text-gray-400">Total Invested:</span>
                              <span className="text-white ml-2 font-semibold">₹{results.total_invested_capital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {results.available_capital !== undefined && (
                            <div>
                              <span className="text-gray-400">Available Capital:</span>
                              <span className="text-white ml-2 font-semibold">₹{results.available_capital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {results.total_open_positions_value !== undefined && (
                            <div>
                              <span className="text-gray-400">Open Positions Value:</span>
                              <span className="text-white ml-2 font-semibold">₹{results.total_open_positions_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          )}
                          {results.positions && (
                            <div>
                              <span className="text-gray-400">Total Positions:</span>
                              <span className="text-white ml-2 font-semibold">{results.positions.length}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Summary Statistics (only show if using client-side calculation) */}
                    {(() => {
                      // Use backend positions if available, otherwise calculate client-side
                      const positions = results.positions || (results.transactions ? buildPositionView(results.transactions) : []);
                      const usingBackendPositions = !!results.positions;
                      
                      // Diagnostic logging for backend positions
                      if (usingBackendPositions) {
                        const closedPositions = positions.filter(p => p.is_closed);
                        const openPositions = positions.filter(p => !p.is_closed);
                        const uniqueTradeIds = new Set(positions.map(p => p.trade_id));
                        const positionsWithMultipleClosures = positions.filter(p => {
                          const exitTxns = p.transactions.filter(t => 
                            t.status === 'CLOSED' || (t.type === t.exit_action && t.status !== 'OPENED')
                          );
                          return exitTxns.length > 1;
                        });
                        
                        console.log('🔍 DIAGNOSTIC: Backend positions vs total_trades discrepancy:', {
                          total_trades_from_backend: results.total_trades,
                          positions_count: positions.length,
                          open_positions_count: openPositions.length,
                          closed_positions_count: closedPositions.length,
                          unique_trade_ids: uniqueTradeIds.size,
                          positions_with_multiple_closures: positionsWithMultipleClosures.length,
                          backend_open_positions_count: results.open_positions_count,
                          backend_closed_positions_count: results.closed_positions_count,
                          discrepancy: positions.length !== results.total_trades,
                          sample_positions: positions.slice(0, 5).map(p => ({
                            trade_id: p.trade_id,
                            is_closed: p.is_closed,
                            total_quantity: p.total_quantity,
                            closures_count: p.transactions.filter(t => 
                              t.status === 'CLOSED' || (t.type === t.exit_action && t.status !== 'OPENED')
                            ).length,
                          })),
                        });
                        
                        // Show diagnostic banner if there's a discrepancy
                        if (positions.length !== results.total_trades) {
                          return (
                            <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                              <p className="font-semibold text-yellow-400 mb-3">🔍 Diagnostic: Discrepancy Detected</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                                <div>
                                  <span className="text-gray-400">Backend total_trades:</span>
                                  <span className="text-white ml-2 font-semibold">{results.total_trades}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Backend positions:</span>
                                  <span className="text-white ml-2 font-semibold">{positions.length}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Closed positions:</span>
                                  <span className="text-white ml-2 font-semibold">{closedPositions.length}</span>
                                </div>
                                <div>
                                  <span className="text-gray-400">Open positions:</span>
                                  <span className="text-white ml-2 font-semibold">{openPositions.length}</span>
                                </div>
                              </div>
                              <div className="text-xs text-yellow-300 bg-yellow-500/5 p-3 rounded border border-yellow-500/20">
                                <p className="font-semibold mb-2">Possible Causes:</p>
                                <ul className="list-disc list-inside space-y-1 text-gray-300">
                                  <li><strong>Backend `total_trades`</strong> may count only fully closed trades (round-trip trades)</li>
                                  <li><strong>Backend `positions`</strong> includes all positions: open, closed, and partially closed</li>
                                  <li>If positions have multiple partial closures, each closure might be counted separately in positions but not in total_trades</li>
                                  <li>Check backend logic: Does `total_trades` count unique trade_ids or completed trade cycles?</li>
                                </ul>
                                <p className="mt-2 text-gray-400">
                                  <strong>Action:</strong> Review backend code that calculates `total_trades` vs `positions`. 
                                  The discrepancy suggests different counting logic between these two metrics.
                                </p>
                              </div>
                            </div>
                          );
                        }
                        
                        return null;
                      }
                      
                      // Client-side calculation fallback
                      const uniqueTradeIds = new Set(results.transactions.map(t => t.trade_id || 'unlinked')).size;
                      const hasDiscrepancy = results.total_trades !== uniqueTradeIds;
                      
                      return hasDiscrepancy ? (
                        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm">
                          <p className="font-semibold text-yellow-400 mb-2">📊 Data Summary (Client-Side Calculation)</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-400">Backend Total Trades:</span>
                              <span className="text-white ml-2 font-semibold">{results.total_trades}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Unique Trade IDs:</span>
                              <span className="text-white ml-2 font-semibold">{uniqueTradeIds}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Total Transactions:</span>
                              <span className="text-white ml-2 font-semibold">{results.transactions.length}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">Positions (Grouped):</span>
                              <span className="text-white ml-2 font-semibold">{positions.length}</span>
                            </div>
                          </div>
                          <p className="text-yellow-300 mt-2 text-xs">
                            ℹ️ <strong>Note:</strong> Using client-side position calculation (backend positions not available). Backend's "total_trades" may count only fully closed trades, while we show all positions (including partial closures).
                          </p>
                        </div>
                      ) : null;
                    })()}
                    
                    {/* Tab Navigation */}
                    <div className="flex gap-2 mb-4 border-b border-gray-600">
                      <button
                        onClick={() => setViewMode('position')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          viewMode === 'position'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        📊 Position View
                      </button>
                      <button
                        onClick={() => setViewMode('transaction')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          viewMode === 'transaction'
                            ? 'text-blue-400 border-b-2 border-blue-400'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        📋 Transaction View
                      </button>
                    </div>

                    {/* Position View */}
                    {viewMode === 'position' && (
                      <PositionView 
                        positions={results.positions} 
                        transactions={results.transactions}
                      />
                    )}

                    {/* Transaction View */}
                    {viewMode === 'transaction' && (
                      <TransactionView transactions={results.transactions} />
                    )}
                  </div>
                )}

                {(!results.transactions || results.transactions.length === 0) && (
                  <div className="bg-gray-700 rounded-lg p-4 mt-4">
                    <div className="text-center text-gray-400 text-sm">
                      <p className="font-semibold text-yellow-400 mb-2">⚠️ No Transaction Details Available</p>
                      {results.total_trades > 0 ? (
                        <>
                          <p className="mb-2">
                            The backtest executed <span className="font-bold text-white">{results.total_trades} trades</span>, but transaction details are not available.
                          </p>
                          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500 rounded text-xs text-yellow-400">
                            <p className="font-semibold mb-1">🔍 Possible Reasons:</p>
                            <ul className="list-disc list-inside space-y-1 text-left mt-2">
                              <li>TradeTracker observer may not be capturing trades correctly</li>
                              <li>Trades were executed but not properly closed</li>
                              <li>Backtrader's broker trades may not be accessible</li>
                              <li>Strategy may be using buy/sell methods incorrectly</li>
                            </ul>
                            <p className="text-gray-400 mt-3">
                              <strong>Note:</strong> Check backend logs for transaction extraction messages. 
                              Look for: <code className="bg-gray-800 px-1 rounded">"Successfully extracted N transactions"</code> or 
                              <code className="bg-gray-800 px-1 rounded">"No transactions extracted"</code>
                    </p>
                  </div>
                        </>
                      ) : (
                        <p className="mb-2">
                          No trades were executed during this backtest. The strategy did not generate any buy/sell signals.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Note: Job history is now shown on individual backtest detail pages */}

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
                          {formatDate(item.created_at)}
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

// Helper function to build Position View from transactions
function buildPositionView(transactions: Transaction[]): BacktestPosition[] {
  // Log transaction analysis
  console.log('📊 Building Position View from transactions:', {
    total_transactions: transactions.length,
    unique_trade_ids: new Set(transactions.map(t => t.trade_id || 'unlinked')).size,
    transactions_with_trade_id: transactions.filter(t => t.trade_id).length,
    transactions_without_trade_id: transactions.filter(t => !t.trade_id).length,
    trade_id_distribution: (() => {
      const counts: Record<string, number> = {};
      transactions.forEach(t => {
        const id = t.trade_id || 'unlinked';
        counts[id] = (counts[id] || 0) + 1;
      });
      return counts;
    })(),
    sample_transactions: transactions.slice(0, 5).map(t => ({
      type: t.type,
      trade_id: t.trade_id,
      status: t.status,
      quantity: t.quantity,
    })),
  });

  // Group by trade_id
  const grouped = transactions.reduce((acc, txn) => {
    const tradeId = txn.trade_id || 'unlinked';
    if (!acc[tradeId]) {
      acc[tradeId] = [];
    }
    acc[tradeId].push(txn);
    return acc;
  }, {} as Record<string, Transaction[]>);

  console.log('📊 Grouped transactions:', {
    total_groups: Object.keys(grouped).length,
    groups_with_multiple_txns: Object.entries(grouped).filter(([_, txns]) => txns.length > 1).length,
    groups_with_single_txn: Object.entries(grouped).filter(([_, txns]) => txns.length === 1).length,
    unlinked_count: grouped['unlinked']?.length || 0,
    largest_group: Math.max(...Object.values(grouped).map(txns => txns.length)),
    group_sizes: Object.entries(grouped).map(([id, txns]) => ({ trade_id: id, count: txns.length })),
  });

  // Build position objects
  const positions: BacktestPosition[] = [];

  Object.entries(grouped).forEach(([tradeId, txns]) => {
    // Sort transactions by exit_date (or entry_date if exit_date is missing) - oldest first
    txns.sort((a, b) => {
      const dateA = a.exit_date || a.entry_date || '';
      const dateB = b.exit_date || b.entry_date || '';
      return dateA.localeCompare(dateB);
    });

    // Find entry transaction (status: "OPENED" or type matches entry_action)
    const entryTxn = txns.find(t => t.status === 'OPENED' || (t.type === t.entry_action && t.status !== 'CLOSED'));
    // Find all exit transactions (status: "CLOSED" or type matches exit_action)
    const exitTxns = txns.filter(t => t.status === 'CLOSED' || (t.type === t.exit_action && t.status !== 'OPENED'));

    // Entry quantity should be from the entry transaction ONLY (not sum of all transactions)
    const entryQuantity = entryTxn ? entryTxn.quantity : 0;

    // Calculate totals from ALL transactions (entry + exits)
    const totalPnl = txns.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalPnlComm = txns.reduce((sum, t) => sum + (t.pnl_comm || 0), 0);
    const totalBrokerage = txns.reduce((sum, t) => sum + (t.brokerage || 0), 0);
    const totalPlatformFees = txns.reduce((sum, t) => sum + (t.platform_fees || 0), 0);
    const totalTransactionAmount = txns.reduce((sum, t) => sum + (t.transaction_amount || 0), 0);
    const totalAmount = txns.reduce((sum, t) => sum + (t.total_amount || 0), 0);

    // Calculate total closed quantity from exit transactions
    const totalClosedQuantity = exitTxns.reduce((sum, t) => sum + t.quantity, 0);

    const firstTxn = txns[0];

    positions.push({
      trade_id: tradeId,
      position_type: entryTxn?.position_type || firstTxn?.position_type || 'LONG',
      entry_action: entryTxn?.entry_action || firstTxn?.entry_action || 'BUY',
      exit_action: entryTxn?.exit_action || firstTxn?.exit_action || 'SELL',
      entry_date: entryTxn?.entry_date || firstTxn?.entry_date || '',
      entry_price: entryTxn?.entry_price || firstTxn?.entry_price || 0,
      total_quantity: entryQuantity,  // Use entry transaction quantity, NOT sum of all transactions
      total_pnl: totalPnl,
      total_pnl_comm: totalPnlComm,
      total_brokerage: totalBrokerage,
      total_platform_fees: totalPlatformFees,
      total_transaction_amount: totalTransactionAmount,
      total_amount: totalAmount,
      transactions: txns,
      is_closed: entryQuantity === totalClosedQuantity,  // All quantity closed if entry = sum of exits
      remaining_quantity: Math.max(0, entryQuantity - totalClosedQuantity),  // Remaining = entry - sum of exits
      symbol: firstTxn?.symbol,
      exchange: firstTxn?.exchange,
    });
  });

  // Sort positions by entry_date (oldest first - ascending order)
  positions.sort((a, b) => {
    return (a.entry_date || '').localeCompare(b.entry_date || '');
  });

  console.log('📊 Final positions:', {
    total_positions: positions.length,
    positions_summary: positions.slice(0, 5).map(p => ({
      trade_id: p.trade_id,
      position_type: p.position_type,
      total_quantity: p.total_quantity,
      transaction_count: p.transactions.length,
      is_closed: p.is_closed,
    })),
  });

  return positions;
}

// Helper function to build Transaction View (sorted by date - oldest first)
function buildTransactionView(transactions: Transaction[]): Transaction[] {
  // IMPORTANT: Always sort oldest first (ascending order)
  // Sort by date based on transaction type:
  // - BUY transactions: sorted by entry_date
  // - SELL transactions: sorted by exit_date
  return [...transactions].sort((a, b) => {
    // Get date for sorting: entry_date for BUY, exit_date for SELL
    const getSortDate = (txn: Transaction): string => {
      if (txn.type === 'BUY') {
        return txn.entry_date || txn.exit_date || txn.date || '';
      } else {
        return txn.exit_date || txn.entry_date || txn.date || '';
      }
    };

    const dateA = getSortDate(a);
    const dateB = getSortDate(b);

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);  // Ascending: oldest first
    }

    // Secondary sort: entry_date (if primary dates are same) - oldest first
    const entryA = a.entry_date || '';
    const entryB = b.entry_date || '';
    return entryA.localeCompare(entryB);  // Ascending: oldest first
  });
}

// Position View Component
function PositionView({ 
  positions: backendPositions, 
  transactions 
}: { 
  positions?: BacktestPosition[];
  transactions: Transaction[];
}) {
  // Use backend positions if available, otherwise calculate client-side (backward compatibility)
  const positions = backendPositions || (transactions ? buildPositionView(transactions) : []);
  
  if (backendPositions) {
    console.log('✅ Using backend positions:', {
      positions_count: positions.length,
      open_positions: positions.filter(p => !p.is_closed).length,
      closed_positions: positions.filter(p => p.is_closed).length,
    });
  } else {
    console.log('⚠️ Using client-side position calculation (backend positions not available)');
  }

  return (
    <div className="overflow-x-auto">
      <div 
        className={`${
          positions.length > 5 
            ? 'max-h-[500px] overflow-y-auto transaction-table-scroll' 
            : ''
        }`}
        style={{
          scrollbarWidth: positions.length > 5 ? 'thin' : 'none',
          scrollbarColor: positions.length > 5 ? '#4B5563 #374151' : 'transparent transparent',
        }}
      >
        {/* Position View: No sticky header, so add padding for better spacing */}
        <div className={`space-y-4 ${positions.length > 5 ? 'py-1' : ''}`}>
          {positions.map((position) => {
        // Calculate average exit price
        const totalValue = position.transactions.reduce(
          (sum, t) => sum + (t.exit_price || 0) * t.quantity,
          0
        );
        const avgExitPrice = position.total_quantity > 0 
          ? totalValue / position.total_quantity 
          : 0;

        // Calculate duration
        const lastExit = position.transactions
          .map(t => t.exit_date || t.entry_date || t.date || '')
          .sort()
          .pop() || '';
        const duration = position.entry_date && lastExit
          ? calculateDuration(position.entry_date, lastExit)
          : null;

        return (
          <div 
            key={position.trade_id} 
            className={`bg-gray-800 rounded-lg p-4 border ${
              position.position_type === 'SHORT' 
                ? 'border-orange-500/30' 
                : 'border-blue-500/30'
            }`}
          >
            {/* Position Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-2">
                <span className={`text-lg ${
                  position.position_type === 'SHORT' ? 'text-orange-400' : 'text-blue-400'
                }`}>
                  {position.position_type === 'SHORT' ? '🔻' : '🔺'}
                </span>
                <span className="font-semibold text-white">
                  {position.position_type} Position: {position.trade_id}
                </span>
                {position.symbol && (
                  <span className="text-gray-400 text-sm">
                    ({position.symbol}{position.exchange ? `, ${position.exchange}` : ''})
                  </span>
                )}
              </div>
              <div className={`text-lg font-bold ${
                position.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {position.total_pnl >= 0 ? '+' : ''}₹{position.total_pnl.toFixed(2)}
              </div>
            </div>

            {/* Position Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">Entry</div>
                <div className="text-white">
                  {position.entry_action} {position.total_quantity} shares @ ₹{position.entry_price.toFixed(2)}
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {formatDateShort(position.entry_date)}
                </div>
              </div>
              <div className="bg-gray-700/50 rounded p-2">
                <div className="text-gray-400 text-xs mb-1">P&L Summary</div>
                <div className={`text-white font-semibold ${
                  position.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  Total P&L: {position.total_pnl >= 0 ? '+' : ''}₹{position.total_pnl.toFixed(2)}
                </div>
                {position.total_pnl_comm !== position.total_pnl && (
                  <div className="text-gray-400 text-xs mt-1">
                    After Fees: ₹{position.total_pnl_comm.toFixed(2)}
                  </div>
                )}
                <div className="text-gray-400 text-xs mt-1">
                  Total Brokerage: ₹{position.total_brokerage.toFixed(2)}
                  {position.total_platform_fees > 0 && (
                    <span> | Platform Fees: ₹{position.total_platform_fees.toFixed(2)}</span>
                  )}
                </div>
                {duration && (
                  <div className="text-gray-400 text-xs mt-1">
                    Duration: {duration}
                  </div>
                )}
              </div>
            </div>

            {/* Closures Timeline */}
            <div className="border-t border-gray-600 pt-3">
              {/* Filter to only show exit transactions (status: "CLOSED" or type matches exit_action) */}
              {(() => {
                const exitTxns = position.transactions.filter(t => 
                  t.status === 'CLOSED' || (t.type === t.exit_action && t.status !== 'OPENED')
                );
                // Sort exit transactions by exit_date (oldest first)
                exitTxns.sort((a, b) => {
                  const dateA = a.exit_date || a.entry_date || '';
                  const dateB = b.exit_date || b.entry_date || '';
                  return dateA.localeCompare(dateB);
                });

                return (
                  <>
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">
                      Closures ({exitTxns.length}):
                    </h4>
                    <div className="space-y-2">
                      {exitTxns.map((txn, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between bg-gray-700/30 rounded p-2 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                            <div>
                              <span className="text-white">
                                {txn.exit_action || txn.type} {txn.quantity} shares @ ₹{txn.exit_price?.toFixed(2) || 'N/A'}
                              </span>
                              <div className="text-gray-400 text-xs mt-0.5">
                                {formatDateShort(txn.exit_date || txn.entry_date || txn.date)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className={`font-semibold ${
                              (txn.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {txn.pnl !== null && txn.pnl !== undefined 
                                ? `P&L: ${txn.pnl >= 0 ? '+' : ''}₹${txn.pnl.toFixed(2)}` 
                                : 'N/A'}
                            </div>
                            <div className="text-gray-400 text-xs">
                              Brokerage: ₹{(txn.brokerage || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        );
        })}
        </div>
      </div>
      {positions.length > 5 && (
        <div className="mt-2 text-xs text-gray-500">
          Showing all {positions.length} positions. Scroll to view more.
        </div>
      )}
    </div>
  );
}

// Transaction View Component
function TransactionView({ transactions }: { transactions: Transaction[] }) {
  const sortedTransactions = buildTransactionView(transactions);

  // Calculate grand totals
  const grandTotalPnl = sortedTransactions.reduce((sum, txn) => sum + (txn.pnl || 0), 0);
  const grandTotalPnlComm = sortedTransactions.reduce((sum, txn) => sum + (txn.pnl_comm || 0), 0);
  const grandTotalBrokerage = sortedTransactions.reduce((sum, txn) => sum + (txn.brokerage || 0), 0);
  const grandTotalPlatformFees = sortedTransactions.reduce((sum, txn) => sum + (txn.platform_fees || 0), 0);
  const grandTotalTransactionAmount = sortedTransactions.reduce((sum, txn) => sum + (txn.transaction_amount || 0), 0);
  const grandTotalAmount = sortedTransactions.reduce((sum, txn) => sum + (txn.total_amount || 0), 0);

  return (
    <div className="overflow-x-auto">
      <div 
        className={`${
          sortedTransactions.length > 10 
            ? 'max-h-[500px] overflow-y-auto transaction-table-scroll' 
            : ''
        }`}
        style={{
          scrollbarWidth: sortedTransactions.length > 10 ? 'thin' : 'none',
          scrollbarColor: sortedTransactions.length > 10 ? '#4B5563 #374151' : 'transparent transparent',
        }}
      >
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-700 z-10">
            <tr className="border-b border-gray-600">
              <th className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Date/Time</th>
              <th className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Trx Type</th>
              <th className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Position</th>
              <th className="text-left py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Position Type</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Quantity</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Transaction Amount</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Brokerage</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Platform Fees</th>
              <th className="text-right py-3 px-4 text-gray-300 font-semibold text-xs uppercase">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((txn, idx) => {
              // Date/Time: entry_date for BUY, exit_date for SELL
              let dateStr = '';
              if (txn.type === 'BUY') {
                dateStr = txn.entry_date || txn.exit_date || txn.date || '';
              } else {
                dateStr = txn.exit_date || txn.entry_date || txn.date || '';
              }
              const date = formatDateShort(dateStr);

              // Use transaction_amount from API (or calculate if missing)
              // Transaction amount logic:
              // - If type is BUY → entry_price × quantity
              // - If type is SELL → exit_price × quantity
              let transactionAmount = txn.transaction_amount;
              if (!transactionAmount) {
                if (txn.type === 'BUY') {
                  transactionAmount = (txn.entry_price || 0) * txn.quantity;
                } else {
                  transactionAmount = (txn.exit_price || 0) * txn.quantity;
                }
              }
              
              const brokerage = txn.brokerage || 0;
              const platformFees = txn.platform_fees || 0;
              const totalAmount = txn.total_amount || (transactionAmount + brokerage + platformFees);

              return (
                <tr 
                  key={idx}
                  className={`border-b border-gray-600 hover:bg-gray-600/50 ${
                    txn.pnl && txn.pnl > 0 ? 'bg-green-500/5' : txn.pnl && txn.pnl < 0 ? 'bg-red-500/5' : ''
                  } ${txn.position_type === 'SHORT' ? 'bg-orange-500/5' : ''}`}
                >
                  <td className="py-3 px-4 text-white text-sm">{date}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      txn.type === 'BUY' 
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {txn.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm">{txn.trade_id || '-'}</td>
                  <td className="py-3 px-4">
                    {txn.position_type ? (
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        txn.position_type === 'SHORT' 
                          ? 'bg-orange-500/20 text-orange-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {txn.position_type === 'SHORT' ? '🔻 SHORT' : '🔺 LONG'}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-white text-sm text-right">{txn.quantity}</td>
                  <td className="py-3 px-4 text-white text-sm text-right">₹{transactionAmount.toFixed(2)}</td>
                  <td className="py-3 px-4 text-gray-400 text-sm text-right">₹{brokerage.toFixed(2)}</td>
                  <td className="py-3 px-4 text-gray-400 text-sm text-right">₹{platformFees.toFixed(2)}</td>
                  <td className="py-3 px-4 text-white text-sm text-right">₹{totalAmount.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="sticky bottom-0 bg-gray-800 border-t-2 border-gray-600 z-10">
            <tr className="bg-gray-800">
              <td colSpan={5} className="py-3 px-4 text-right">
                <strong className="text-white">Grand Totals:</strong>
              </td>
              <td className="py-3 px-4 text-white text-sm text-right font-semibold">
                ₹{grandTotalTransactionAmount.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-gray-400 text-sm text-right font-semibold">
                ₹{grandTotalBrokerage.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-gray-400 text-sm text-right font-semibold">
                ₹{grandTotalPlatformFees.toFixed(2)}
              </td>
              <td className="py-3 px-4 text-white text-sm text-right font-semibold">
                ₹{grandTotalAmount.toFixed(2)}
              </td>
            </tr>
            <tr className="bg-gray-800 border-t border-gray-600">
              <td colSpan={5} className="py-3 px-4 text-right">
                <strong className="text-white">P&L Summary:</strong>
              </td>
              <td colSpan={2} className="py-3 px-4 text-right">
                <div className="text-gray-300 text-xs mb-1 text-right">
                  <strong>P&L (Before Fees):</strong>
                </div>
                <div className={`text-sm font-bold text-right ${
                  grandTotalPnl >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {grandTotalPnl >= 0 ? '+' : ''}₹{grandTotalPnl.toFixed(2)}
                </div>
              </td>
              <td colSpan={2} className="py-3 px-4 text-right">
                <div className="text-gray-300 text-xs mb-1 text-right">
                  <strong>P&L (After Fees):</strong>
                </div>
                <div className={`text-sm font-bold text-right ${
                  grandTotalPnlComm >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {grandTotalPnlComm >= 0 ? '+' : ''}₹{grandTotalPnlComm.toFixed(2)}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {sortedTransactions.length > 10 && (
        <div className="mt-2 text-xs text-gray-500">
          Showing all {sortedTransactions.length} transactions. Scroll to view more.
        </div>
      )}
    </div>
  );
}

// Helper function to calculate duration between two dates
function calculateDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
}

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Timeseries Chart Component for Data Verification (supports multi-timeframe)
function DataBarsChart({ 
  backtestId,
  dataBarsCount, 
  fromDate, 
  toDate, 
  symbol,
  intervals,
  primaryInterval
}: { 
  backtestId: string;
  dataBarsCount: number; 
  fromDate: string; 
  toDate: string; 
  symbol: string;
  intervals?: string[];
  primaryInterval?: string;
}) {
  // For multi-timeframe: track data for each interval
  const [chartsData, setChartsData] = useState<Map<string, {
    loading: boolean;
    error: string | null;
    historicalData: HistoricalDataPoint[] | null;
    dataInfo: { total_points: number; returned_points: number } | null;
  }>>(new Map());
  
  // For single interval (backward compatibility)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[] | null>(null);
  const [dataInfo, setDataInfo] = useState<{ total_points: number; returned_points: number } | null>(null);
  
  // Determine if this is a multi-timeframe backtest
  const isMultiTimeframe = intervals && intervals.length > 1;

  // Fetch historical data from backend
  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!backtestId) {
        if (isMultiTimeframe) {
          // Initialize all intervals with error state
          const newChartsData = new Map<string, {
            loading: boolean;
            error: string | null;
            historicalData: HistoricalDataPoint[] | null;
            dataInfo: { total_points: number; returned_points: number } | null;
          }>();
          intervals.forEach(interval => {
            newChartsData.set(interval, {
              loading: false,
              error: 'Backtest ID is missing',
              historicalData: null,
              dataInfo: null,
            });
          });
          setChartsData(newChartsData);
        } else {
          setError('Backtest ID is missing');
          setLoading(false);
        }
        return;
      }

      if (isMultiTimeframe && intervals) {
        // Multi-timeframe: fetch data for each interval
        console.log('📊 Fetching historical data for multi-timeframe backtest:', backtestId);
        console.log('📊 Intervals:', intervals);
        
        const newChartsData = new Map<string, {
          loading: boolean;
          error: string | null;
          historicalData: HistoricalDataPoint[] | null;
          dataInfo: { total_points: number; returned_points: number } | null;
        }>();
        
        // Initialize all intervals with loading state
        intervals.forEach(interval => {
          newChartsData.set(interval, {
            loading: true,
            error: null,
            historicalData: null,
            dataInfo: null,
          });
        });
        setChartsData(newChartsData);
        
        // Fetch data for each interval in parallel
        const fetchPromises = intervals.map(async (interval) => {
          try {
            const limit = dataBarsCount || 10000;
            console.log(`📊 Requesting historical data for interval: "${interval}"`);
            const data = await getBacktestHistoricalData(backtestId, limit, 'json', interval);
            
            // Verify backend returned the correct interval
            if (data.interval !== interval) {
              console.warn(`⚠️ Interval mismatch! Requested: "${interval}", Backend returned: "${data.interval}"`);
            }
            
            // Log first and last data points to verify data is different
            const firstPoint = data.data_points.length > 0 ? data.data_points[0] : null;
            const lastPoint = data.data_points.length > 0 ? data.data_points[data.data_points.length - 1] : null;
            
            console.log(`✅ Historical data fetched for ${interval}:`, {
              requested_interval: interval,
              returned_interval: data.interval,
              total_points: data.total_points,
              returned_points: data.returned_points,
              data_points_count: data.data_points.length,
              first_point: firstPoint ? { time: firstPoint.time, close: firstPoint.close } : null,
              last_point: lastPoint ? { time: lastPoint.time, close: lastPoint.close } : null,
            });
            
            return {
              interval,
              data,
              error: null,
            };
          } catch (err: any) {
            console.error(`❌ Failed to fetch historical data for ${interval}:`, err);
            const errorDetail = err.response?.data?.detail || '';
            const errorMessage = err.message || '';
            
            return {
              interval,
              data: null,
              error: errorDetail || errorMessage || 'Failed to load historical data',
            };
          }
        });
        
        const results = await Promise.all(fetchPromises);
        
        // Update charts data with results - create a fresh Map to ensure data isolation
        const updatedChartsData = new Map<string, {
          loading: boolean;
          error: string | null;
          historicalData: HistoricalDataPoint[] | null;
          dataInfo: { total_points: number; returned_points: number } | null;
        }>();
        
        console.log(`📊 Processing ${results.length} interval results for charts`);
        
        // Track interval mismatches for UI warnings
        const intervalMismatches: Array<{ requested: string; returned: string }> = [];
        
        results.forEach(({ interval, data, error: fetchError }) => {
          if (data && data.data_points && data.data_points.length > 0) {
            // Check for interval mismatch
            const hasMismatch = data.interval !== interval;
            if (hasMismatch) {
              intervalMismatches.push({ requested: interval, returned: data.interval });
            }
            
            // Create a deep copy of the data points to ensure each chart has its own data
            const dataCopy = data.data_points.map(point => ({ ...point }));
            
            console.log(`💾 Storing data for interval "${interval}" in Map:`, {
              interval,
              returned_interval: data.interval,
              has_mismatch: hasMismatch,
              data_points_count: dataCopy.length,
              first_point_time: dataCopy[0]?.time,
              first_point_close: dataCopy[0]?.close,
            });
            
            updatedChartsData.set(interval, {
              loading: false,
              error: hasMismatch ? `⚠️ Backend returned "${data.interval}" data instead of "${interval}"` : null,
              historicalData: dataCopy,
              dataInfo: {
                total_points: data.total_points,
                returned_points: data.returned_points,
              },
            });
          } else {
            updatedChartsData.set(interval, {
              loading: false,
              error: fetchError || 'Failed to load historical data',
              historicalData: null,
              dataInfo: null,
            });
          }
        });
        
        // Log interval mismatches summary
        if (intervalMismatches.length > 0) {
          console.error(`🔴 Interval Mismatches Detected:`, intervalMismatches);
        }
        
        console.log(`📊 Charts data Map after processing:`, {
          map_size: updatedChartsData.size,
          map_keys: Array.from(updatedChartsData.keys()),
          map_entries: Array.from(updatedChartsData.entries()).map(([key, value]) => ({
            interval: key,
            has_data: !!value.historicalData,
            data_count: value.historicalData?.length || 0,
            first_point: value.historicalData?.[0] ? { time: value.historicalData[0].time, close: value.historicalData[0].close } : null,
          })),
        });
        
        setChartsData(updatedChartsData);
      } else {
        // Single interval (backward compatibility)
        try {
          setLoading(true);
          setError(null);
          
          console.log('📊 Fetching historical data for backtest:', backtestId);
          console.log('📊 Total data bars available:', dataBarsCount);
          
          const limit = dataBarsCount || 10000;
          const data = await getBacktestHistoricalData(backtestId, limit, 'json', primaryInterval);
          
          console.log('✅ Historical data fetched:', {
            backtest_id: data.backtest_id,
            symbol: data.symbol,
            exchange: data.exchange,
            interval: data.interval,
            total_points: data.total_points,
            returned_points: data.returned_points,
            data_points_count: data.data_points.length,
            requested_limit: limit,
          });

          if (data.total_points > data.returned_points) {
            console.warn(`⚠️ Backend returned only ${data.returned_points} of ${data.total_points} total data points.`);
          }

          setDataInfo({
            total_points: data.total_points,
            returned_points: data.returned_points,
          });

          if (data.data_points.length === 0) {
            setError('No historical data points returned from API');
            setHistoricalData(null);
          } else {
            setHistoricalData(data.data_points);
          }
        } catch (err: any) {
          console.error('❌ Failed to fetch historical data:', err);
          const errorDetail = err.response?.data?.detail || '';
          const errorMessage = err.message || '';
          const status = err.response?.status;
          
          console.error('🔴 Historical Data API Error Details:', {
            backtest_id: backtestId,
            status: status,
            errorDetail: errorDetail,
            errorMessage: errorMessage,
          });
          
          if (status === 404) {
            setError(`Backtest not found (404). Backtest ID: ${backtestId}`);
          } else if (status === 401) {
            setError('Authentication failed. Please refresh and try again.');
          } else if (status === 403) {
            setError('Access denied. You may not have permission to view this backtest data.');
          } else if (status === 500) {
            setError(`Server error (500): ${errorDetail || 'Internal server error. Please check backend logs.'}`);
          } else if (errorDetail) {
            setError(errorDetail);
          } else if (errorMessage) {
            setError(errorMessage);
          } else {
            setError('Failed to load historical data. Please check console for details.');
          }
          
          setHistoricalData(null);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchHistoricalData();
  }, [backtestId, dataBarsCount, intervals, primaryInterval, isMultiTimeframe]);

  // Helper function to render a single chart
  const renderSingleChart = (
    intervalValue: string,
    intervalData: HistoricalDataPoint[] | null,
    intervalDataInfo: { total_points: number; returned_points: number } | null,
    isLoading: boolean,
    hasError: string | null
  ) => {
    const chartData = intervalData
      ? {
          labels: intervalData.map(() => ''),
          datasets: [
            {
              label: 'Close Price',
              data: intervalData.map((point) => {
                if (point.close === null || point.close === undefined || isNaN(point.close)) {
                  return null;
                }
                return point.close;
              }),
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.1,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
          ],
        }
      : null;

    const intervalLabel = INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue;

    return (
      <div key={intervalValue} className="mb-4 last:mb-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400 font-medium">
            {intervalValue === intervals?.[0] ? `datas[0]: ${intervalLabel}` : 
             intervalValue === intervals?.[1] ? `datas[1]: ${intervalLabel}` :
             intervalValue === intervals?.[2] ? `datas[2]: ${intervalLabel}` :
             intervalLabel} ({symbol})
          </div>
          {isLoading && (
            <div className="text-xs text-gray-500">Loading...</div>
          )}
        </div>
        
        {isLoading && (
          <div className="w-full flex items-center justify-center" style={{ height: '75px' }}>
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mb-2"></div>
              <p className="text-xs text-gray-400">Loading historical data...</p>
            </div>
          </div>
        )}
        
        {hasError && (
          <div className={`w-full p-4 border rounded text-xs ${hasError.includes('Backend returned') ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400' : 'bg-red-500/10 border-red-500 text-red-400'}`} style={{ minHeight: '75px' }}>
            <p className="font-semibold mb-2">{hasError.includes('Backend returned') ? '⚠️ Interval Mismatch' : '⚠️ Failed to load historical data'}</p>
            <p className="mb-2">{hasError}</p>
            {hasError.includes('Backend returned') && (
              <p className="text-gray-400 mt-2 text-xs">
                This is a backend issue. The historical data endpoint is not respecting the interval parameter for multi-timeframe backtests.
              </p>
            )}
          </div>
        )}
        
        {!isLoading && !hasError && chartData && (
          <>
            <div className="w-full overflow-x-auto chart-horizontal-scroll" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4B5563 #374151',
            }}>
              <div 
                style={{ 
                  height: '75px',
                  minWidth: intervalData && intervalData.length > 0
                    ? `${Math.max(400, intervalData.length * 3)}px`
                    : '100%',
                  width: intervalData && intervalData.length > 0
                    ? `${Math.max(400, intervalData.length * 3)}px`
                    : '100%',
                }}
              >
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                      duration: 0,
                    },
                    plugins: {
                      legend: {
                        display: false,
                      },
                      tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1F2937',
                        titleColor: '#9CA3AF',
                        bodyColor: '#F3F4F6',
                        borderColor: '#4B5563',
                        borderWidth: 1,
                        callbacks: {
                          title: (tooltipItems) => {
                            if (tooltipItems.length > 0) {
                              const dataIndex = tooltipItems[0].dataIndex;
                              if (intervalData && intervalData[dataIndex] && intervalData[dataIndex].time) {
                                const timeValue = intervalData[dataIndex].time;
                                if (timeValue) {
                                  const date = new Date(timeValue);
                                  if (!isNaN(date.getTime())) {
                                    return date.toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    });
                                  }
                                }
                              }
                            }
                            return '';
                          },
                          label: (context) => {
                            return `Close Price: ₹${context.parsed.y?.toFixed(2) || 'N/A'}`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        display: false,
                        grid: {
                          display: false,
                        },
                      },
                      y: {
                        display: true,
                        grid: {
                          color: '#4B5563',
                        },
                        ticks: {
                          color: '#9CA3AF',
                          font: {
                            size: 10,
                          },
                        },
                      },
                    },
                    elements: {
                      line: {
                        borderJoinStyle: 'round' as const,
                      },
                    },
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Historical data: {intervalData?.length || 0} bars
              {intervalDataInfo && intervalDataInfo.total_points > intervalDataInfo.returned_points && (
                <span className="ml-2 text-yellow-400">
                  ⚠️ Showing {intervalDataInfo.returned_points} of {intervalDataInfo.total_points} total data points
                </span>
              )}
              {intervalData && intervalData.length > 50 && (
                <span className="ml-2 text-gray-400">
                  (Scroll horizontally to view all data)
                </span>
              )}
            </div>
          </>
        )}
        
        {!isLoading && !hasError && !intervalData && (
          <div className="w-full p-4 bg-yellow-500/10 border border-yellow-500 rounded text-yellow-400 text-xs" style={{ minHeight: '75px' }}>
            <p className="font-semibold mb-2">⚠️ No data available</p>
            <p>Historical data was not returned from the API.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      {isMultiTimeframe && intervals ? (
        // Multi-timeframe: render one chart per interval
        <div className="space-y-4">
          {intervals.map((intervalValue, idx) => {
            console.log(`🎨 Rendering chart for interval "${intervalValue}" (index ${idx})`);
            const chartState = chartsData.get(intervalValue);
            
            if (!chartState) {
              console.warn(`⚠️ No chart state found for interval "${intervalValue}" in Map. Available keys:`, Array.from(chartsData.keys()));
              return (
                <div key={intervalValue} className="mb-4">
                  <div className="text-xs text-gray-400 mb-2">
                    {idx === 0 ? `datas[0]: ${INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}` :
                     idx === 1 ? `datas[1]: ${INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}` :
                     idx === 2 ? `datas[2]: ${INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}` :
                     INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}
                  </div>
                  <div className="w-full flex items-center justify-center" style={{ height: '75px' }}>
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mb-2"></div>
                      <p className="text-xs text-gray-400">Loading...</p>
                    </div>
                  </div>
                </div>
              );
            }
            
            console.log(`📊 Chart state for interval "${intervalValue}":`, {
              interval: intervalValue,
              has_data: !!chartState.historicalData,
              data_count: chartState.historicalData?.length || 0,
              first_point: chartState.historicalData?.[0] ? { time: chartState.historicalData[0].time, close: chartState.historicalData[0].close } : null,
              loading: chartState.loading,
              error: chartState.error,
            });
            
            return renderSingleChart(
              intervalValue,
              chartState.historicalData,
              chartState.dataInfo,
              chartState.loading,
              chartState.error
            );
          })}
        </div>
      ) : (
        // Single interval (backward compatibility)
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400">Price Trend ({symbol})</div>
            {loading && (
              <div className="text-xs text-gray-500">Loading...</div>
            )}
          </div>
          
          {loading && (
            <div className="w-full flex items-center justify-center" style={{ height: '75px' }}>
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mb-2"></div>
                <p className="text-xs text-gray-400">Loading historical data...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="w-full p-4 bg-red-500/10 border border-red-500 rounded text-red-400 text-xs" style={{ minHeight: '75px' }}>
              <p className="font-semibold mb-2">⚠️ Failed to load historical data</p>
              <p className="mb-2">{error}</p>
              <p className="text-gray-500 mt-3">Troubleshooting:</p>
              <ul className="list-disc list-inside mt-1 space-y-1 text-gray-400">
                <li>Check browser console for detailed error logs</li>
                <li>Verify the backtest ID is correct: {backtestId}</li>
                <li>Check network tab for API request/response details</li>
                <li>Ensure backend endpoint is accessible: GET /api/backtesting/{backtestId}/data</li>
                <li>Verify authentication token is valid</li>
              </ul>
            </div>
          )}
          
          {!loading && !error && historicalData && (
            <>
              <div className="w-full overflow-x-auto chart-horizontal-scroll" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#4B5563 #374151',
              }}>
                <div 
                  style={{ 
                    height: '75px',
                    minWidth: historicalData.length > 0
                      ? `${Math.max(400, historicalData.length * 3)}px`
                      : '100%',
                    width: historicalData.length > 0
                      ? `${Math.max(400, historicalData.length * 3)}px`
                      : '100%',
                  }}
                >
                  <Line
                    data={{
                      labels: historicalData.map(() => ''),
                      datasets: [
                        {
                          label: 'Close Price',
                          data: historicalData.map((point) => {
                            if (point.close === null || point.close === undefined || isNaN(point.close)) {
                              return null;
                            }
                            return point.close;
                          }),
                          borderColor: '#10B981',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          borderWidth: 2,
                          fill: true,
                          tension: 0.1,
                          pointRadius: 0,
                          pointHoverRadius: 4,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      animation: {
                        duration: 0,
                      },
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          enabled: true,
                          mode: 'index',
                          intersect: false,
                          backgroundColor: '#1F2937',
                          titleColor: '#9CA3AF',
                          bodyColor: '#F3F4F6',
                          borderColor: '#4B5563',
                          borderWidth: 1,
                          callbacks: {
                            title: (tooltipItems) => {
                              if (tooltipItems.length > 0) {
                                const dataIndex = tooltipItems[0].dataIndex;
                                if (historicalData && historicalData[dataIndex] && historicalData[dataIndex].time) {
                                  const timeValue = historicalData[dataIndex].time;
                                  if (timeValue) {
                                    const date = new Date(timeValue);
                                    if (!isNaN(date.getTime())) {
                                      return date.toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true,
                                      });
                                    }
                                  }
                                }
                              }
                              return '';
                            },
                            label: (context) => {
                              return `Close Price: ₹${context.parsed.y?.toFixed(2) || 'N/A'}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          display: false,
                          grid: {
                            display: false,
                          },
                        },
                        y: {
                          display: true,
                          grid: {
                            color: '#4B5563',
                          },
                          ticks: {
                            color: '#9CA3AF',
                            font: {
                              size: 10,
                            },
                          },
                        },
                      },
                      elements: {
                        line: {
                          borderJoinStyle: 'round' as const,
                        },
                      },
                    }}
                  />
                </div>
              </div>
      <div className="text-xs text-gray-500 mt-1">
                Historical data: {historicalData.length} bars
                {dataInfo && dataInfo.total_points > dataInfo.returned_points && (
                  <span className="ml-2 text-yellow-400">
                    ⚠️ Showing {dataInfo.returned_points} of {dataInfo.total_points} total data points
                  </span>
                )}
                {historicalData.length > 50 && (
                  <span className="ml-2 text-gray-400">
                    (Scroll horizontally to view all data)
                  </span>
                )}
      </div>
            </>
          )}
          
          {!loading && !error && !historicalData && (
            <div className="w-full p-4 bg-yellow-500/10 border border-yellow-500 rounded text-yellow-400 text-xs" style={{ minHeight: '75px' }}>
              <p className="font-semibold mb-2">⚠️ No data available</p>
              <p>Historical data was not returned from the API.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

