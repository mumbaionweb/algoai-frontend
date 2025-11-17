'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getBacktest, getBacktestJob, listBacktestJobs } from '@/lib/api/backtesting';
import { BacktestJobCard } from '@/components/backtesting/BacktestJobCard';
import BacktestResultsDisplay from '@/components/backtesting/BacktestResultsDisplay';
import { useBacktestProgress } from '@/hooks/useBacktestProgress';
import type { BacktestHistoryItem, BacktestJob, BacktestResponse } from '@/types';

export default function BacktestDetailPage() {
  const { isAuthenticated, isInitialized, token } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const id = params?.backtestId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [backtest, setBacktest] = useState<BacktestHistoryItem | null>(null);
  const [job, setJob] = useState<BacktestJob | null>(null);
  const [isJobId, setIsJobId] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [results, setResults] = useState<BacktestResponse | null>(null);

  // Use progress hook if we have a job
  const { completed, result, progress } = useBacktestProgress({
    jobId: job?.job_id || '',
    token: token || '',
    useWebSocket: true,
  });

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated && id) {
      loadData();
    }
  }, [isAuthenticated, isInitialized, router, id]);

  // Update job when progress updates
  useEffect(() => {
    if (job && progress !== null) {
      setJob(prev => prev ? { ...prev, progress } : null);
    }
  }, [progress, job]);

  // When job completes, use the result
  useEffect(() => {
    if (completed && result && isJobId) {
      setResults(result);
      // Redirect to backtest_id URL
      if (result.backtest_id) {
        router.replace(`/backtesting/${result.backtest_id}`);
      }
    }
  }, [completed, result, isJobId, router]);

  const loadData = async () => {
    if (!id) return;
    
    // First, try to load it as a job_id
    try {
      setLoading(true);
      setError('');
      setLoadingJob(true);
      
      const jobData = await getBacktestJob(id);
      setJob(jobData);
      setIsJobId(true);
      
      // If job has completed and has a result, use it (full BacktestResponse)
      if (jobData.status === 'completed' && jobData.result) {
        setResults(jobData.result);
        // Also load history item for metadata
        try {
          const backtestData = await getBacktest(jobData.result.backtest_id);
          setBacktest(backtestData);
        } catch (err) {
          console.warn('Failed to load backtest history for completed job:', err);
        }
      }
      
      setLoading(false);
      setLoadingJob(false);
      return;
    } catch (jobErr: any) {
      // If it's not a job (404), try to load as backtest_id
      if (jobErr.response?.status === 404) {
        try {
          const backtestData = await getBacktest(id);
          console.log('✅ Loaded backtest history item:', {
            backtest_id: backtestData.backtest_id,
            symbol: backtestData.symbol,
            total_trades: backtestData.total_trades,
          });
          setBacktest(backtestData);
          setIsJobId(false);
          
          // Try to find associated job to get full results
          if (backtestData.backtest_id) {
            console.log('🔍 Attempting to load full results from associated job...');
            await loadJobByBacktestId(backtestData.backtest_id);
          }
        } catch (backtestErr: any) {
          console.error('Failed to load backtest:', backtestErr);
          const errorDetail = backtestErr.response?.data?.detail || '';
          const status = backtestErr.response?.status;
          
          if (status === 404) {
            setError('Backtest or job not found.');
          } else if (status === 401) {
            setError('Authentication failed. Please log in again.');
          } else {
            setError(errorDetail || 'Failed to load backtest. Please try again.');
          }
        }
      } else {
        // Other error loading job
        console.error('Failed to load job:', jobErr);
        setError('Failed to load backtest job. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingJob(false);
    }
  };

  const loadJobByBacktestId = async (backtestId: string) => {
    try {
      console.log('🔍 Searching for job with backtest_id:', backtestId);
      // Try to fetch more jobs to find the match (increase limit)
      const jobs = await listBacktestJobs(undefined, 200);
      console.log(`📋 Found ${jobs.length} jobs to search through`);
      
      const matchingJob = jobs.find(j => j.result?.backtest_id === backtestId);
      if (matchingJob) {
        console.log('✅ Found matching job:', {
          job_id: matchingJob.job_id,
          status: matchingJob.status,
          has_result: !!matchingJob.result,
          backtest_id: matchingJob.result?.backtest_id,
        });
        setJob(matchingJob);
        // If job has completed result, use it
        if (matchingJob.status === 'completed' && matchingJob.result) {
          console.log('✅ Loading full results from job:', {
            total_trades: matchingJob.result.total_trades,
            transactions_count: matchingJob.result.transactions?.length || 0,
            has_positions: !!matchingJob.result.positions,
          });
          setResults(matchingJob.result);
        } else {
          console.log('⚠️ Job found but not completed or missing result:', {
            status: matchingJob.status,
            has_result: !!matchingJob.result,
          });
        }
      } else {
        console.log('⚠️ No matching job found for backtest_id:', backtestId);
        console.log('📋 Searched through jobs:', jobs.map(j => ({
          job_id: j.job_id,
          status: j.status,
          backtest_id: j.result?.backtest_id,
        })));
      }
    } catch (err: any) {
      // Silently fail for job loading
      if (err.response?.status !== 500) {
        console.error('❌ Failed to load job:', err);
      } else {
        console.warn('⚠️ Backend 500 error when searching for job (this is expected if jobs endpoint has issues)');
      }
    }
  };

  const refreshJob = async () => {
    console.log('🔄 refreshJob called', { job_id: job?.job_id });
    if (job?.job_id) {
      try {
        setLoadingJob(true);
        const jobData = await getBacktestJob(job.job_id);
        setJob(jobData);
        
        // If job completed, use full result
        if (jobData.status === 'completed' && jobData.result) {
          setResults(jobData.result);
          // Also load history item
          try {
            const backtestData = await getBacktest(jobData.result.backtest_id);
            setBacktest(backtestData);
            // Redirect to backtest_id URL
            router.replace(`/backtesting/${jobData.result.backtest_id}`);
          } catch (err) {
            console.warn('Failed to load backtest after job completion:', err);
          }
        }
      } catch (err: any) {
        console.error('Failed to refresh job:', err);
      } finally {
        setLoadingJob(false);
      }
    } else {
      console.warn('⚠️ refreshJob called but no job_id available');
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

  if (error && !job && !backtest) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
          <Link
            href="/backtesting"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded inline-block"
          >
            Back to Backtesting
          </Link>
        </main>
      </div>
    );
  }

  // If we have a job (running or completed), show job status with same layout as main page
  if (job && isJobId) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />

        <main className="container mx-auto px-4 py-8">
          {/* Header with back link */}
          <div className="mb-6">
            <Link
              href="/backtesting"
              className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block"
            >
              ← Back to Backtesting
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side - Job Details Only */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Job Details</h2>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Refresh button clicked');
                    refreshJob();
                  }}
                  disabled={loadingJob}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm disabled:opacity-50 cursor-pointer"
                  type="button"
                >
                  {loadingJob ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {/* Job Details Card */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Job ID:</span>
                    <span className="text-white ml-2 font-mono text-xs break-all">{job.job_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Symbol:</span>
                    <span className="text-white ml-2">{job.symbol}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Exchange:</span>
                    <span className="text-white ml-2">{job.exchange}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Period:</span>
                    <span className="text-white ml-2">{job.from_date} to {job.to_date}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Intervals:</span>
                    <span className="text-white ml-2">{job.intervals.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <span className={`ml-2 font-semibold ${
                      job.status === 'completed' ? 'text-green-400' :
                      job.status === 'failed' ? 'text-red-400' :
                      job.status === 'running' ? 'text-blue-400' :
                      'text-yellow-400'
                    }`}>
                      {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  {job.created_at && (
                    <div>
                      <span className="text-gray-400">Created:</span>
                      <span className="text-white ml-2 text-xs">
                        {new Date(job.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                  {job.started_at && (
                    <div>
                      <span className="text-gray-400">Started:</span>
                      <span className="text-white ml-2 text-xs">
                        {new Date(job.started_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                  {job.completed_at && (
                    <div>
                      <span className="text-gray-400">Completed:</span>
                      <span className="text-white ml-2 text-xs">
                        {new Date(job.completed_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Strategy & Configuration Card */}
              <div className="bg-gray-700 rounded-lg p-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Strategy & Configuration</h3>
                
                {/* Configuration Parameters */}
                <div className="space-y-2 text-sm mb-4">
                  <div>
                    <span className="text-gray-400">Initial Cash:</span>
                    <span className="text-white ml-2">₹{job.initial_cash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Commission:</span>
                    <span className="text-white ml-2">{(job.commission * 100).toFixed(3)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Broker Type:</span>
                    <span className="text-white ml-2 capitalize">{job.broker_type}</span>
                  </div>
                  {job.strategy_params && Object.keys(job.strategy_params).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <span className="text-gray-400 text-xs block mb-2">Additional Parameters:</span>
                      <div className="space-y-1">
                        {Object.entries(job.strategy_params).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-gray-500">{key}:</span>
                            <span className="text-white ml-2">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Strategy Code */}
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm font-semibold">Strategy Code:</span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (job.strategy_code) {
                          navigator.clipboard.writeText(job.strategy_code);
                          alert('Strategy code copied to clipboard!');
                        }
                      }}
                      className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded"
                      type="button"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="bg-gray-900 rounded p-3 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                      {job.strategy_code || 'No strategy code available'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Results Section (same as main page) */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Backtest Results</h2>
              
              {/* Active Job Progress */}
              {job && (
                <div className="mb-6 bg-gray-700 rounded-lg p-4 border border-gray-600">
                  <h3 className="text-lg font-semibold text-white mb-4">Current Backtest Job</h3>
                  <BacktestJobCard job={job} onUpdate={refreshJob} />
                </div>
              )}

              {/* Show full backtest results if job is completed and we have results */}
              {job.status === 'completed' && results ? (
                <BacktestResultsDisplay results={results} />
              ) : job.status === 'failed' ? (
                <div className="space-y-4">
                  <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg">
                    <p className="font-semibold mb-2">❌ Backtest Job Failed</p>
                    <p className="mb-2">The backtest job failed and no results are available.</p>
                    {job.error_message && (
                      <div className="mt-3 p-3 bg-gray-900 rounded text-sm">
                        <p className="font-semibold mb-1">Error Details:</p>
                        <p className="font-mono text-xs break-all">{job.error_message}</p>
                      </div>
                    )}
                    <p className="text-sm mt-3 text-gray-400">
                      Please fix the error in your strategy code and create a new backtest.
                    </p>
                  </div>
                  <div className="text-gray-400 text-center py-12">
                    <p>No results available for failed backtest.</p>
                    <Link
                      href="/backtesting"
                      className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm cursor-pointer"
                      onClick={(e) => {
                        console.log('🖱️ Create New Backtest link clicked (failed job)');
                      }}
                    >
                      Create New Backtest
                    </Link>
                  </div>
                </div>
              ) : job.status === 'running' || job.status === 'queued' || job.status === 'pending' ? (
                <div className="text-gray-400 text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p>Backtest job is {job.status}...</p>
                  <p className="text-sm mt-2">Results will appear here when the job completes.</p>
                </div>
              ) : (
                <div className="text-gray-400 text-center py-12">
                  <p>No results yet. {job.status === 'paused' ? 'Job is paused.' : 'Waiting for job to complete.'}</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // If we have a completed backtest (viewed by backtest_id), show backtest details with same layout
  if (backtest && !isJobId) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />

        <main className="container mx-auto px-4 py-8">
          {/* Header with back link */}
          <div className="mb-6">
            <Link
              href="/backtesting"
              className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block cursor-pointer"
              onClick={(e) => {
                console.log('🖱️ Back link clicked (backtest view)');
              }}
            >
              ← Back to Backtesting
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side - Backtest Information (similar to form section) */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">Backtest Information</h2>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Search for Full Results button clicked');
                    if (backtest?.backtest_id) {
                      console.log('🔄 Manually refreshing job search...');
                      await loadJobByBacktestId(backtest.backtest_id);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm cursor-pointer"
                  type="button"
                >
                  🔄 Search for Full Results
                </button>
              </div>

              {/* Backtest Summary */}
              <div className="bg-gray-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-bold text-white">{backtest.symbol}</h3>
                  <span className="text-gray-400">({backtest.exchange})</span>
                  {backtest.data_bars_count > 0 && (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                      {backtest.data_bars_count} bars
                    </span>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Period:</span>
                    <span className="text-white ml-2">{backtest.from_date} to {backtest.to_date}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Return:</span>
                    <span className={`ml-2 font-semibold ${backtest.total_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {backtest.total_return >= 0 ? '+' : ''}{backtest.total_return.toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Total Trades:</span>
                    <span className="text-white ml-2">{backtest.total_trades}</span>
                  </div>
                  {backtest.win_rate !== null && (
                    <div>
                      <span className="text-gray-400">Win Rate:</span>
                      <span className="text-white ml-2">{backtest.win_rate.toFixed(1)}%</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Total P&L:</span>
                    <span className={`ml-2 font-semibold ${backtest.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ₹{backtest.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Backtest ID:</span>
                    <span className="text-white ml-2 font-mono text-xs break-all">{backtest.backtest_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Created:</span>
                    <span className="text-white ml-2 text-xs">
                      {new Date(backtest.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Job Status Section (if available) */}
              {job && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-300">Associated Job</h3>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🖱️ Refresh button clicked (associated job)');
                        refreshJob();
                      }}
                      disabled={loadingJob}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs disabled:opacity-50 cursor-pointer"
                      type="button"
                    >
                      {loadingJob ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  <BacktestJobCard job={job} onUpdate={refreshJob} />
                </div>
              )}
            </div>

            {/* Right Side - Results Section (same as main page) */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Backtest Results</h2>
              
              {/* Show full results if available */}
              {results ? (
                <BacktestResultsDisplay results={results} />
              ) : (
                <div className="space-y-4">
                  {/* Job Status if available */}
                  {job && (
                    <div className="mb-6 bg-gray-700 rounded-lg p-4 border border-gray-600">
                      <h3 className="text-lg font-semibold text-white mb-4">Current Backtest Job</h3>
                      <BacktestJobCard job={job} onUpdate={refreshJob} />
                    </div>
                  )}

                  {/* Limited view message */}
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-sm text-yellow-300 mb-2">
                      <strong>⚠️ Limited View:</strong> Full backtest results with transaction details, charts, and positions are not available.
                    </p>
                    <p className="text-xs text-yellow-400 mb-3">
                      This usually means the associated backtest job could not be found. Full results are only available when viewing from a completed job.
                    </p>
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🖱️ Retry Loading Full Results button clicked');
                        if (backtest?.backtest_id) {
                          console.log('🔄 Retrying job search...');
                          await loadJobByBacktestId(backtest.backtest_id);
                        }
                      }}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm cursor-pointer"
                      type="button"
                    >
                      🔄 Retry Loading Full Results
                    </button>
                  </div>

                  <div className="text-gray-400 text-center py-12">
                    <p>No results available. Full results require the associated job to be found.</p>
                    <Link
                      href="/backtesting"
                      className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm cursor-pointer"
                      onClick={(e) => {
                        console.log('🖱️ Create New Backtest link clicked (no results)');
                      }}
                    >
                      Create New Backtest
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Fallback - should not reach here, but show error if we do
  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />
      <main className="container mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
          Unable to load backtest details. Please check the URL and try again.
        </div>
        <Link
          href="/backtesting"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded inline-block"
        >
          Back to Backtesting
        </Link>
      </main>
    </div>
  );
}
