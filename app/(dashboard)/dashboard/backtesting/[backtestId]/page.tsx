'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getBacktest, listBacktestJobs } from '@/lib/api/backtesting';
import { BacktestJobCard } from '@/components/backtesting/BacktestJobCard';
import type { BacktestHistoryItem, BacktestJob } from '@/types';

export default function BacktestDetailPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const backtestId = params?.backtestId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [backtest, setBacktest] = useState<BacktestHistoryItem | null>(null);
  const [job, setJob] = useState<BacktestJob | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated && backtestId) {
      loadBacktest();
    }
  }, [isAuthenticated, isInitialized, router, backtestId]);

  const loadBacktest = async () => {
    if (!backtestId) return;
    
    try {
      setLoading(true);
      setError('');
      const data = await getBacktest(backtestId);
      setBacktest(data);
      
      // Load associated job if available
      loadJob(data.backtest_id);
    } catch (err: any) {
      console.error('Failed to load backtest:', err);
      const errorDetail = err.response?.data?.detail || '';
      const status = err.response?.status;
      
      if (status === 404) {
        setError('Backtest not found.');
      } else if (status === 401) {
        setError('Authentication failed. Please log in again.');
      } else {
        setError(errorDetail || 'Failed to load backtest. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadJob = async (backtestId: string) => {
    try {
      setLoadingJob(true);
      // Fetch all jobs and find the one that matches this backtest_id
      const jobs = await listBacktestJobs(undefined, 100); // Get more jobs to find the match
      const matchingJob = jobs.find(j => j.result?.backtest_id === backtestId);
      if (matchingJob) {
        setJob(matchingJob);
      }
    } catch (err) {
      console.error('Failed to load job:', err);
      // Don't show error for job loading, it's optional
    } finally {
      setLoadingJob(false);
    }
  };

  const refreshJob = () => {
    if (backtest?.backtest_id) {
      loadJob(backtest.backtest_id);
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
            <p className="text-gray-400">Loading backtest details...</p>
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
          <Link
            href="/dashboard/backtesting"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded inline-block"
          >
            Back to Backtesting
          </Link>
        </main>
      </div>
    );
  }

  if (!backtest) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">Backtest not found.</p>
            <Link
              href="/dashboard/backtesting"
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded inline-block"
            >
              Back to Backtesting
            </Link>
          </div>
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
              <h1 className="text-2xl font-bold text-white">Backtest Details</h1>
            </div>
          </div>

          {/* Backtest Summary Card */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold text-white">{backtest.symbol}</h2>
                  <span className="text-gray-400">({backtest.exchange})</span>
                  {backtest.data_bars_count > 0 && (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                      {backtest.data_bars_count} bars
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-1">
                  {backtest.from_date} to {backtest.to_date}
                </p>
                <p className="text-xs text-gray-500">
                  Created: {new Date(backtest.created_at).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className={`text-3xl font-bold ${backtest.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {backtest.total_return >= 0 ? '+' : ''}{backtest.total_return.toFixed(2)}%
                </p>
                <div className="flex gap-4 text-sm text-gray-400">
                  <span>{backtest.total_trades} trades</span>
                  {backtest.win_rate !== null && (
                    <span>{backtest.win_rate.toFixed(1)}% win rate</span>
                  )}
                </div>
                <p className={`text-lg font-semibold ${backtest.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₹{backtest.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* Job Status Section */}
          {job && (
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Backtest Job Status</h3>
                <button
                  onClick={refreshJob}
                  disabled={loadingJob}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {loadingJob ? 'Loading...' : 'Refresh'}
                </button>
              </div>
              <BacktestJobCard job={job} onUpdate={refreshJob} />
            </div>
          )}

          {/* Additional Details */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Backtest Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400 text-sm">Backtest ID:</span>
                <p className="text-white font-mono text-sm mt-1">{backtest.backtest_id}</p>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Transactions Count:</span>
                <p className="text-white text-sm mt-1">{backtest.transactions_count || 0}</p>
              </div>
            </div>
          </div>

          {/* Note about full results */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              <strong>Note:</strong> This is a summary view. For full backtest results including transaction details, 
              please run a new backtest or check the backtest history page.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

