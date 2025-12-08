'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useBacktestJobsSSE } from '@/hooks/useBacktestJobsSSE';
import { useBacktestHistorySSE } from '@/hooks/useBacktestHistorySSE';
import type { BacktestHistoryItem, BacktestJob, BacktestJobStatus } from '@/types';

interface DashboardNavigationProps {
  title?: string;
}

export default function DashboardNavigation({ title = 'Algo AI' }: DashboardNavigationProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [backtestMenuOpen, setBacktestMenuOpen] = useState(false);
  const [strategiesMenuOpen, setStrategiesMenuOpen] = useState(false);
  const [ordersMenuOpen, setOrdersMenuOpen] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const backtestMenuRef = useRef<HTMLDivElement>(null);

  // Get Firebase token for SSE
  const token = typeof window !== 'undefined' ? localStorage.getItem('firebase_token') : null;

  // Use SSE hooks for real-time updates (replaces REST polling)
  const { backtests: backtestHistory, loading: loadingHistory } = useBacktestHistorySSE({
    token,
    limit: 5,
    enabled: !!token,
  });

  const { jobs: allJobs, loading: loadingJobs } = useBacktestJobsSSE({
    token,
    limit: 10,
    enabled: !!token,
  });

  // Filter to show only active jobs (running, pending, queued, paused, resuming)
  const backtestJobs = allJobs.filter(job => 
    ['running', 'pending', 'queued', 'paused', 'resuming'].includes(job.status)
  );

  const loadingBacktests = loadingHistory || loadingJobs;

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (backtestMenuRef.current && !backtestMenuRef.current.contains(event.target as Node)) {
        setBacktestMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  // Get user display name
  const getUserName = () => {
    return user?.name || user?.email || 'User';
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Get status badge color
  const getStatusColor = (status: BacktestJobStatus | string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'running':
      case 'resuming':
        return 'bg-blue-500/20 text-blue-400';
      case 'pending':
      case 'queued':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'failed':
        return 'bg-red-500/20 text-red-400';
      case 'paused':
        return 'bg-orange-500/20 text-orange-400';
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Combine history and jobs, sort by date
  // For completed jobs, use backtest_id from result if available
  const allBacktests = [
    ...backtestHistory.map(item => ({
      id: item.backtest_id,
      type: 'history' as const,
      symbol: item.symbol,
      exchange: item.exchange,
      from_date: item.from_date,
      to_date: item.to_date,
      total_return: item.total_return,
      total_pnl: item.total_pnl,
      total_trades: item.total_trades,
      win_rate: item.win_rate,
      data_bars_count: item.data_bars_count,
      created_at: item.created_at,
      status: 'completed' as BacktestJobStatus,
      backtest_id: item.backtest_id,
    })),
    ...backtestJobs.map(job => ({
      id: job.job_id,
      type: 'job' as const,
      symbol: job.symbol,
      exchange: job.exchange,
      from_date: job.from_date,
      to_date: job.to_date,
      total_return: job.result?.total_return_pct || 0,
      total_pnl: job.result?.total_pnl || 0,
      total_trades: job.result?.total_trades || 0,
      win_rate: job.result?.win_rate || null,
      data_bars_count: job.result?.data_bars_count || 0,
      created_at: job.created_at,
      status: job.status,
      progress: job.progress,
      backtest_id: job.result?.backtest_id, // Use backtest_id from result if job is completed
      job_id: job.job_id,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          {/* Left side - Logo and Navigation */}
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-white hover:text-blue-400 transition">
              {title}
            </Link>
            
            {/* Navigation Menu Items */}
            <div className="hidden md:flex items-center gap-1">
              {/* Portfolio - Direct Link */}
              <Link
                href="/"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === '/'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                Portfolio
              </Link>

              {/* Backtesting - Dropdown */}
              <div className="relative" ref={backtestMenuRef}>
                <button
                  onClick={() => {
                    setBacktestMenuOpen(!backtestMenuOpen);
                    setStrategiesMenuOpen(false);
                    setOrdersMenuOpen(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    pathname?.startsWith('/backtesting')
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  Backtesting
                  <svg
                    className={`w-4 h-4 transition-transform ${backtestMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Backtesting Dropdown Menu */}
                {backtestMenuOpen && (
                  <div className="absolute left-0 mt-2 w-96 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50 max-h-[600px] overflow-y-auto">
                    {/* New Backtest Button */}
                    <div className="px-4 py-3 border-b border-gray-700">
                      <Link
                        href="/backtesting"
                        onClick={() => setBacktestMenuOpen(false)}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        New Backtest
                      </Link>
                    </div>

                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-700">
                      <h3 className="text-sm font-semibold text-white">Recent Backtests</h3>
                    </div>

                    {/* Backtest Items */}
                    {loadingBacktests ? (
                      <div className="px-4 py-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        <p className="text-gray-400 text-xs mt-2">Loading...</p>
                      </div>
                    ) : allBacktests.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-gray-400 text-sm">No backtests yet</p>
                      </div>
                    ) : (
                      <div className="py-2">
                        {allBacktests.map((backtest) => {
                          // For completed backtests, use backtest_id; for active jobs, use job_id
                          const href = backtest.status === 'completed' && backtest.backtest_id
                            ? `/backtesting/${backtest.backtest_id}`
                            : backtest.type === 'job' && backtest.job_id
                            ? `/backtesting/${backtest.job_id}`
                            : '/backtesting';
                          const isClickable = (backtest.status === 'completed' && backtest.backtest_id) || 
                                             (backtest.type === 'job' && backtest.job_id);
                          
                          const content = (
                            <div className="block px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-b-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-white text-sm">
                                    {backtest.symbol}
                                  </span>
                                  <span className="text-gray-400 text-xs">({backtest.exchange})</span>
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(backtest.status)}`}>
                                    {backtest.status === 'completed' ? 'Complete' : 
                                     backtest.status === 'running' ? 'Running' :
                                     backtest.status === 'pending' ? 'Pending' :
                                     backtest.status === 'queued' ? 'Queued' :
                                     backtest.status === 'failed' ? 'Failed' :
                                     backtest.status === 'paused' ? 'Paused' :
                                     backtest.status === 'cancelled' ? 'Cancelled' :
                                     backtest.status}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mb-1">
                                  {backtest.from_date} to {backtest.to_date}
                                </p>
                                {backtest.status === 'completed' && (
                                  <>
                                    <p className={`text-sm font-semibold ${backtest.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {backtest.total_return >= 0 ? '+' : ''}{backtest.total_return.toFixed(2)}%
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {backtest.total_trades} trades • {backtest.win_rate !== null ? `${backtest.win_rate.toFixed(1)}% win rate` : 'N/A'}
                                    </p>
                                    <p className={`text-xs font-medium ${backtest.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      ₹{backtest.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </>
                                )}
                                {backtest.status === 'running' && 'progress' in backtest && (
                                  <div className="mt-2">
                                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                                      <div
                                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                                        style={{ width: `${backtest.progress || 0}%` }}
                                      ></div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">{backtest.progress || 0}%</p>
                                  </div>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatDate(backtest.created_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                          );
                          
                          return isClickable ? (
                            <Link
                              key={backtest.id}
                              href={href}
                              onClick={() => setBacktestMenuOpen(false)}
                            >
                              {content}
                            </Link>
                          ) : (
                            <div
                              key={backtest.id}
                              onClick={() => {
                                if (!isClickable) {
                                  setBacktestMenuOpen(false);
                                  router.push('/backtesting');
                                }
                              }}
                              className="cursor-pointer"
                            >
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Footer - View All Link */}
                    <div className="border-t border-gray-700 pt-2">
                      <Link
                        href="/backtesting/list"
                        onClick={() => setBacktestMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4 mr-2 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        View All Backtests
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Strategies - Dropdown (placeholder for future) */}
              <div className="relative">
                <button
                  onClick={() => {
                    setStrategiesMenuOpen(!strategiesMenuOpen);
                    setBacktestMenuOpen(false);
                    setOrdersMenuOpen(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    pathname?.startsWith('/dashboard/strategies')
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  Strategies
                  <svg
                    className={`w-4 h-4 transition-transform ${strategiesMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {strategiesMenuOpen && (
                  <div className="absolute left-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
                    <Link
                      href="/dashboard/strategies"
                      onClick={() => setStrategiesMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      All Strategies
                    </Link>
                    <Link
                      href="/dashboard/strategies?action=create"
                      onClick={() => setStrategiesMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Create New Strategy
                    </Link>
                    <button
                      onClick={async () => {
                        setStrategiesMenuOpen(false);
                        try {
                          // Import createStrategy dynamically to avoid circular dependencies
                          const { createStrategy } = await import('@/lib/api/strategies');
                          
                          // Create a new strategy with a temporary name
                          const newStrategy = await createStrategy({
                            name: 'New Strategy', // Temporary name, will be updated
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
                            parameters: {
                              symbol: 'RELIANCE',
                              exchange: 'NSE',
                              market_type: 'equity',
                            },
                          });
                          
                          // Update the name to include the strategy ID
                          const { updateStrategy } = await import('@/lib/api/strategies');
                          await updateStrategy(newStrategy.id, {
                            name: `untitled-strategy-${newStrategy.id}`,
                          });
                          
                          // Navigate to the new strategy page
                          router.push(`/dashboard/strategies/v2/${newStrategy.id}`);
                        } catch (err: any) {
                          console.error('Failed to create strategy:', err);
                          // Fallback to the old route if creation fails
                          router.push('/dashboard/strategies/v2');
                        }
                      }}
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors w-full text-left"
                    >
                      Add Strategy v2
                    </button>
                  </div>
                )}
              </div>

              {/* Orders - Dropdown (placeholder for future) */}
              <div className="relative">
                <button
                  onClick={() => {
                    setOrdersMenuOpen(!ordersMenuOpen);
                    setBacktestMenuOpen(false);
                    setStrategiesMenuOpen(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    pathname?.startsWith('/dashboard/orders')
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  Orders
                  <svg
                    className={`w-4 h-4 transition-transform ${ordersMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {ordersMenuOpen && (
                  <div className="absolute left-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
                    <Link
                      href="/dashboard/orders"
                      onClick={() => setOrdersMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      All Orders
                    </Link>
                    <Link
                      href="/dashboard/orders?status=pending"
                      onClick={() => setOrdersMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Pending Orders
                    </Link>
                    <Link
                      href="/dashboard/orders?status=executed"
                      onClick={() => setOrdersMenuOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Executed Orders
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right side - Profile Avatar Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              aria-label="User menu"
            >
              <span className="text-white font-semibold text-sm">
                {getInitials()}
              </span>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-700">
                  <p className="text-sm font-semibold text-white">{getUserName()}</p>
                  <p className="text-xs text-gray-400 mt-1">{user?.email}</p>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <svg
                      className="w-5 h-5 mr-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Profile
                  </Link>

                  <Link
                    href="/dashboard/broker"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <svg
                      className="w-5 h-5 mr-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    Broker
                  </Link>

                  <Link
                    href="/dashboard/marketplace"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                  >
                    <svg
                      className="w-5 h-5 mr-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                    Marketplace
                  </Link>
                </div>

                {/* Logout */}
                <div className="border-t border-gray-700 pt-1">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
                  >
                    <svg
                      className="w-5 h-5 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

