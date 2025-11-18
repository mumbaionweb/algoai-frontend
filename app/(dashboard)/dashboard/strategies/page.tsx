'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import {
  getStrategies,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  startStrategy,
  stopStrategy,
  pauseStrategy,
  resumeStrategy,
  getStrategyPerformance,
} from '@/lib/api/strategies';
import { getOAuthStatus, getBrokerCredentials } from '@/lib/api/broker';
import { formatDate } from '@/utils/dateUtils';
import type {
  Strategy,
  StrategyCreate,
  StrategyUpdate,
  BrokerCredentials,
} from '@/types';

function StrategiesPageContent() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [credentials, setCredentials] = useState<BrokerCredentials[]>([]);
  const [selectedCredentialsId, setSelectedCredentialsId] = useState<string>('');

  // OAuth status
  const [checkingOAuth, setCheckingOAuth] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{ is_connected: boolean; has_credentials: boolean; has_tokens: boolean } | null>(null);

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    strategy_code: `import backtrader as bt

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
`,
    symbol: 'RELIANCE',
    exchange: 'NSE',
    from_date: '',
    to_date: '',
    initial_cash: 100000,
    commission: 0.001,
  });

  // Performance modal state
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState('');
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [performanceStrategyId, setPerformanceStrategyId] = useState<string | null>(null);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      loadData();
      checkOAuthAndLoadCredentials();
    }
  }, [isAuthenticated, isInitialized, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getStrategies();
      setStrategies(response.strategies);
    } catch (err: any) {
      console.error('Failed to load strategies:', err);
      setError(err.response?.data?.detail || 'Failed to load strategies');
    } finally {
      setLoading(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const strategyData: StrategyCreate = {
        name: formData.name,
        description: formData.description || undefined,
        strategy_code: formData.strategy_code,
        parameters: {
          symbol: formData.symbol.toUpperCase(),
          exchange: formData.exchange.toUpperCase(),
          from_date: formData.from_date || undefined,
          to_date: formData.to_date || undefined,
          initial_cash: formData.initial_cash,
          commission: formData.commission,
        },
      };

      if (editingId) {
        const updateData: StrategyUpdate = {
          name: formData.name,
          description: formData.description || undefined,
          strategy_code: formData.strategy_code,
          parameters: strategyData.parameters,
        };
        await updateStrategy(editingId, updateData);
        setSuccess('Strategy updated successfully');
      } else {
        await createStrategy(strategyData);
        setSuccess('Strategy created successfully');
      }

      // Reset form and reload
      setFormData({
        name: '',
        description: '',
        strategy_code: formData.strategy_code, // Keep the default code
        symbol: 'RELIANCE',
        exchange: 'NSE',
        from_date: '',
        to_date: '',
        initial_cash: 100000,
        commission: 0.001,
      });
      setShowAddForm(false);
      setEditingId(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save strategy:', err);
      const errorDetail = err.response?.data?.detail || '';
      
      // Handle specific errors
      if (err.response?.status === 400) {
        if (errorDetail.includes('credentials not found') || errorDetail.includes('Broker credentials not found')) {
          setError('Zerodha credentials not found. Please add your Zerodha API credentials first.');
        } else if (errorDetail.includes('Access token not found') || errorDetail.includes('OAuth')) {
          setError('Please complete OAuth flow to connect your Zerodha account.');
        } else if (errorDetail.includes('Instrument not found')) {
          setError('Invalid symbol or exchange. Please check and try again.');
        } else if (errorDetail.includes('Strategy class not found') || errorDetail.includes('strategy class')) {
          setError('Strategy class not found in code. Your strategy must define a class that inherits from bt.Strategy.');
        } else if (errorDetail.includes('Cannot update active strategy')) {
          setError('Cannot update active strategy. Stop it first.');
        } else {
          setError(errorDetail || 'Failed to save strategy');
        }
      } else {
        setError(errorDetail || 'Failed to save strategy');
      }
    }
  };

  const handleEdit = (strategy: Strategy) => {
    setEditingId(strategy.id);
    setFormData({
      name: strategy.name,
      description: strategy.description || '',
      strategy_code: strategy.strategy_code || strategy.code || formData.strategy_code,
      symbol: strategy.parameters?.symbol || 'RELIANCE',
      exchange: strategy.parameters?.exchange || 'NSE',
      from_date: strategy.parameters?.from_date || '',
      to_date: strategy.parameters?.to_date || '',
      initial_cash: strategy.parameters?.initial_cash || 100000,
      commission: strategy.parameters?.commission || 0.001,
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this strategy?')) {
      return;
    }

    try {
      await deleteStrategy(id);
      setSuccess('Strategy deleted successfully');
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete strategy:', err);
      setError(err.response?.data?.detail || 'Failed to delete strategy');
    }
  };

  const handleStart = async (strategyId: string) => {
    try {
      setError('');
      setSuccess('');
      
      // Check OAuth status before starting
      if (!oauthStatus?.is_connected) {
        if (!oauthStatus?.has_credentials) {
          setError('Please add your Zerodha API credentials first. Go to Broker Settings to add them.');
          return;
        } else if (!oauthStatus?.has_tokens) {
          setError('Please complete OAuth flow to connect your Zerodha account. Go to Broker Settings to connect.');
          return;
        }
      }

      await startStrategy(strategyId, 'zerodha', selectedCredentialsId || undefined);
      setSuccess('Strategy started successfully');
      await loadData();
    } catch (err: any) {
      console.error('Failed to start strategy:', err);
      const errorDetail = err.response?.data?.detail || '';
      
      if (err.response?.status === 400) {
        if (errorDetail.includes('credentials not found') || errorDetail.includes('Broker credentials not found')) {
          setError('Zerodha credentials not found. Please add your Zerodha API credentials first.');
        } else if (errorDetail.includes('Access token not found') || errorDetail.includes('OAuth')) {
          setError('Please complete OAuth flow to connect your Zerodha account.');
        } else if (errorDetail.includes('already active')) {
          setError('Strategy is already running. Stop it first if you want to restart.');
        } else if (errorDetail.includes('Instrument not found')) {
          setError('Invalid symbol or exchange in strategy parameters. Please update the strategy.');
        } else {
          setError(errorDetail || 'Failed to start strategy');
        }
      } else {
        setError(errorDetail || 'Failed to start strategy');
      }
    }
  };

  const handleStop = async (strategyId: string) => {
    try {
      setError('');
      setSuccess('');
      await stopStrategy(strategyId);
      setSuccess('Strategy stopped successfully');
      await loadData();
    } catch (err: any) {
      console.error('Failed to stop strategy:', err);
      setError(err.response?.data?.detail || 'Failed to stop strategy');
    }
  };

  const handlePause = async (strategyId: string) => {
    try {
      setError('');
      setSuccess('');
      await pauseStrategy(strategyId);
      setSuccess('Strategy paused successfully');
      await loadData();
    } catch (err: any) {
      console.error('Failed to pause strategy:', err);
      setError(err.response?.data?.detail || 'Failed to pause strategy');
    }
  };

  const handleResume = async (strategyId: string) => {
    try {
      setError('');
      setSuccess('');
      
      // Check OAuth status before resuming
      if (!oauthStatus?.is_connected) {
        if (!oauthStatus?.has_credentials) {
          setError('Please add your Zerodha API credentials first. Go to Broker Settings to add them.');
          return;
        } else if (!oauthStatus?.has_tokens) {
          setError('Please complete OAuth flow to connect your Zerodha account. Go to Broker Settings to connect.');
          return;
        }
      }

      await resumeStrategy(strategyId, 'zerodha', selectedCredentialsId || undefined);
      setSuccess('Strategy resumed successfully');
      await loadData();
    } catch (err: any) {
      console.error('Failed to resume strategy:', err);
      const errorDetail = err.response?.data?.detail || '';
      
      if (err.response?.status === 400) {
        if (errorDetail.includes('credentials not found') || errorDetail.includes('Broker credentials not found')) {
          setError('Zerodha credentials not found. Please add your Zerodha API credentials first.');
        } else if (errorDetail.includes('Access token not found') || errorDetail.includes('OAuth')) {
          setError('Please complete OAuth flow to connect your Zerodha account.');
        } else {
          setError(errorDetail || 'Failed to resume strategy');
        }
      } else {
        setError(errorDetail || 'Failed to resume strategy');
      }
    }
  };

  const handleViewPerformance = async (strategyId: string) => {
    try {
      setPerformanceLoading(true);
      setPerformanceError('');
      setPerformanceData(null);
      setPerformanceStrategyId(strategyId);
      setShowPerformanceModal(true);

      const performance = await getStrategyPerformance(strategyId);
      setPerformanceData(performance);
    } catch (err: any) {
      console.error('Failed to fetch performance:', err);
      setPerformanceError(err.response?.data?.detail || 'Failed to fetch performance');
    } finally {
      setPerformanceLoading(false);
    }
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      strategy_code: formData.strategy_code, // Keep the default code
      symbol: 'RELIANCE',
      exchange: 'NSE',
      from_date: '',
      to_date: '',
      initial_cash: 100000,
      commission: 0.001,
    });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'stopped':
        return 'bg-gray-500/10 text-gray-400';
      case 'error':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-blue-500/10 text-blue-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Alerts */}
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
              {error}
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
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          {/* OAuth Status Alert */}
          {!checkingOAuth && oauthStatus && !oauthStatus.is_connected && (
            <div className="mb-6 bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg">
              {!oauthStatus.has_credentials ? (
                <div>
                  <p className="mb-2">Please add your Zerodha API credentials first to start strategies.</p>
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

          {/* Header */}
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-semibold text-white mb-2">Trading Strategies</h2>
                <p className="text-gray-400">
                  Create, manage, and monitor your automated trading strategies.
                </p>
              </div>
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  Create Strategy
                </button>
              )}
            </div>
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                {editingId ? 'Edit Strategy' : 'Create New Strategy'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="My Trading Strategy"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Strategy description..."
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Strategy Code (Python - Backtrader Format) *
                  </label>
                  <textarea
                    value={formData.strategy_code}
                    onChange={(e) => setFormData({ ...formData, strategy_code: e.target.value })}
                    rows={20}
                    required
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your trading strategy code..."
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Your strategy must define a class that inherits from <code className="text-blue-400">bt.Strategy</code>.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Symbol *
                    </label>
                    <input
                      type="text"
                      value={formData.symbol}
                      onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                      required
                      placeholder="RELIANCE"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Exchange *
                    </label>
                    <select
                      value={formData.exchange}
                      onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="NSE">NSE</option>
                      <option value="BSE">BSE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      From Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.from_date}
                      onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      To Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={formData.to_date}
                      onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Initial Capital (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.initial_cash}
                      onChange={(e) => setFormData({ ...formData, initial_cash: parseFloat(e.target.value) })}
                      min="1000"
                      step="1000"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Commission (%)
                    </label>
                    <input
                      type="number"
                      value={formData.commission}
                      onChange={(e) => setFormData({ ...formData, commission: parseFloat(e.target.value) })}
                      min="0"
                      max="1"
                      step="0.001"
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    {editingId ? 'Update' : 'Create'} Strategy
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Strategies List */}
          {loading ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">Loading strategies...</p>
            </div>
          ) : strategies.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 mb-4">No strategies created yet.</p>
              <p className="text-sm text-gray-500">
                Click "Create Strategy" to start building your first trading strategy.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {strategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                >
                  <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{strategy.name}</h3>
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded whitespace-nowrap ${getStatusColor(strategy.status)}`}
                        >
                          {strategy.status.toUpperCase()}
                        </span>
                      </div>
                      {strategy.description && (
                        <p className="text-sm text-gray-400 mb-2">{strategy.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span>Total Trades: <span className="text-white font-medium">{strategy.total_trades}</span></span>
                        {strategy.win_rate !== null && (
                          <span>Win Rate: <span className="text-white font-medium">{strategy.win_rate.toFixed(2)}%</span></span>
                        )}
                        <span>Total P&L: <span className={`font-medium ${strategy.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>₹{strategy.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                      </div>
                      {strategy.parameters?.symbol && (
                        <p className="text-xs text-gray-500 mt-2">
                          Symbol: {strategy.parameters.symbol} ({strategy.parameters.exchange || 'NSE'})
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:flex-nowrap">
                      {strategy.status === 'draft' && (
                        <button
                          onClick={() => handleStart(strategy.id)}
                          disabled={!oauthStatus?.is_connected}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                          title={!oauthStatus?.is_connected ? 'Please connect to Zerodha first' : 'Start strategy'}
                        >
                          Start
                        </button>
                      )}
                      {strategy.status === 'active' && (
                        <>
                          <button
                            onClick={() => handlePause(strategy.id)}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                          >
                            Pause
                          </button>
                          <button
                            onClick={() => handleStop(strategy.id)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                          >
                            Stop
                          </button>
                        </>
                      )}
                      {strategy.status === 'paused' && (
                        <>
                          <button
                            onClick={() => handleResume(strategy.id)}
                            disabled={!oauthStatus?.is_connected}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                            title={!oauthStatus?.is_connected ? 'Please connect to Zerodha first' : 'Resume strategy'}
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => handleStop(strategy.id)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                          >
                            Stop
                          </button>
                        </>
                      )}
                      {(strategy.status === 'stopped' || strategy.status === 'error') && (
                        <button
                          onClick={() => handleStart(strategy.id)}
                          disabled={!oauthStatus?.is_connected}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                          title={!oauthStatus?.is_connected ? 'Please connect to Zerodha first' : 'Restart strategy'}
                        >
                          Restart
                        </button>
                      )}
                      <button
                        onClick={() => handleViewPerformance(strategy.id)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                      >
                        Performance
                      </button>
                      <button
                        onClick={() => handleEdit(strategy)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors whitespace-nowrap"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(strategy.id)}
                        disabled={strategy.status === 'active'}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                        title={strategy.status === 'active' ? 'Stop strategy before deleting' : 'Delete strategy'}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Performance Modal */}
      {showPerformanceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Strategy Performance</h2>
              <button
                onClick={() => {
                  setShowPerformanceModal(false);
                  setPerformanceData(null);
                  setPerformanceError('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {performanceLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  <p className="mt-4 text-gray-400">Loading performance...</p>
                </div>
              ) : performanceError ? (
                <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
                  {performanceError}
                </div>
              ) : performanceData ? (
                <div className="space-y-6">
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Performance Metrics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Status</p>
                        <p className="text-white font-medium capitalize">{performanceData.status}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Total Trades</p>
                        <p className="text-white font-medium">{performanceData.total_trades}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Win Rate</p>
                        <p className="text-white font-medium">
                          {performanceData.win_rate !== null ? `${performanceData.win_rate.toFixed(2)}%` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Total P&L</p>
                        <p className={`font-medium ${performanceData.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ₹{performanceData.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      {performanceData.started_at && (
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Started At</p>
                          <p className="text-white font-medium">
                            {formatDate(performanceData.started_at)}
                          </p>
                        </div>
                      )}
                      {performanceData.stopped_at && (
                        <div>
                          <p className="text-sm text-gray-400 mb-1">Stopped At</p>
                          <p className="text-white font-medium">
                            {formatDate(performanceData.stopped_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StrategiesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <StrategiesPageContent />
    </Suspense>
  );
}
