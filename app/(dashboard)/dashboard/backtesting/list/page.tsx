'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getBacktestHistory } from '@/lib/api/backtesting';
import { formatDate } from '@/utils/dateUtils';
import type { BacktestHistoryItem } from '@/types';

export default function BacktestListPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<BacktestHistoryItem[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      loadHistory();
    }
  }, [isAuthenticated, isInitialized, router]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError('');
      // Use a reasonable limit (100) - backend may have a max limit
      // If there are more backtests, we'll show a message
      const data = await getBacktestHistory(100);
      setHistory(data.backtests || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      console.error('Failed to load backtest history:', err);
      
      // Handle error detail - it might be a string or an object
      let errorDetail = '';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorDetail = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          // Pydantic validation errors are arrays
          errorDetail = err.response.data.detail.map((e: any) => 
            e.msg || e.message || JSON.stringify(e)
          ).join(', ');
        } else if (typeof err.response.data.detail === 'object') {
          errorDetail = JSON.stringify(err.response.data.detail);
        }
      }
      
      const status = err.response?.status;
      
      if (status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (status === 422) {
        // Validation error - likely limit too high, try with smaller limit
        try {
          const data = await getBacktestHistory(50);
          setHistory(data.backtests || []);
          setTotal(data.total || 0);
          setError(''); // Clear error if retry succeeds
        } catch (retryErr: any) {
          setError(errorDetail || 'Failed to load backtest history. The backend may have restrictions on the number of items returned.');
        }
      } else {
        setError(errorDetail || 'Failed to load backtest history. Please try again.');
      }
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
            <p className="text-gray-400">Loading backtest history...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
          <button
            onClick={loadHistory}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
          >
            Retry
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/dashboard/backtesting"
                className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block"
              >
                ← Back to Backtesting
              </Link>
              <h1 className="text-2xl font-bold text-white">All Backtests</h1>
              <p className="text-gray-400 text-sm mt-1">
                Total: {total} backtest{total !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={loadHistory}
              disabled={loading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Backtests List */}
          <div className="bg-gray-800 rounded-lg p-6">
            {history.length === 0 ? (
              <div className="text-gray-400 text-center py-12">
                <p className="text-lg mb-2">No backtests found</p>
                <p className="text-sm">Run a backtest to see it here.</p>
                <Link
                  href="/dashboard/backtesting"
                  className="mt-4 inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
                >
                  Create New Backtest
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <Link
                    key={item.id}
                    href={`/dashboard/backtesting/${item.backtest_id}`}
                    className="block bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 hover:bg-gray-700/80 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white text-lg">{item.symbol}</h3>
                          <span className="text-gray-400 text-sm">({item.exchange})</span>
                          {item.data_bars_count > 0 && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">
                              {item.data_bars_count} bars
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mb-1">
                          {item.from_date} to {item.to_date}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created: {formatDate(item.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-1">
                        <p className={`font-semibold text-xl ${item.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
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
                        <p className="text-xs text-gray-500 font-mono mt-1">
                          ID: {item.backtest_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Pagination Note */}
          {total > history.length && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-blue-300">
                Showing {history.length} of {total} backtests. 
                {total > 1000 && ' Use filters or pagination to view more.'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

