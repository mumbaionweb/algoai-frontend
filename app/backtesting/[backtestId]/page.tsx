'use client';

import { useState, useEffect, useRef } from 'react';
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
  const redirectingRef = useRef(false);
  const renderCountRef = useRef(0); // Debug: Track render count (must be at top level)

  // Use progress hook if we have a job
  // Note: We maintain local job state for initial load, but use hook's job for real-time updates
  const { job: hookJob, completed, result, progress } = useBacktestProgress({
    jobId: job?.job_id || '',
    token: token || '',
    useWebSocket: true,
  });
  
  // Increment render count (for debugging)
  renderCountRef.current += 1;

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated && id) {
      loadData();
    }
  }, [isAuthenticated, isInitialized, router, id]);

  // Sync hook's job state to local state (only when hookJob changes meaningfully)
  const prevHookJobRef = useRef<{ status?: string; progress?: number; hasResult?: boolean; error_message?: string } | null>(null);
  useEffect(() => {
    if (hookJob) {
      const prev = prevHookJobRef.current;
      // Only update if status, progress, result, or error_message changed
      const shouldUpdate = !prev || 
        prev.status !== hookJob.status ||
        prev.progress !== hookJob.progress ||
        prev.hasResult !== !!hookJob.result ||
        prev.error_message !== hookJob.error_message;
      
      if (shouldUpdate) {
        prevHookJobRef.current = {
          status: hookJob.status,
          progress: hookJob.progress,
          hasResult: !!hookJob.result,
          error_message: hookJob.error_message,
        };
        setJob(hookJob);
        
        // If job has result (completed), set results
        if (hookJob.result) {
          setResults(hookJob.result);
        }
        // Note: During execution, results will be set when available via SSE or when job completes
      }
    }
  }, [hookJob?.status, hookJob?.progress, hookJob?.result, hookJob?.error_message]); // Use specific fields instead of entire object

  // When job completes, use the result (no redirect - user stays on job page)
  useEffect(() => {
    if (completed && result && isJobId) {
      setResults(result);
      // Note: We no longer redirect to backtest_id page - user stays on job page with full results
      console.log('✅ Job completed, results available on job page:', {
        job_id: id,
        backtest_id: result.backtest_id,
      });
    }
  }, [completed, result, isJobId, id]);

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
        
        // If job completed, use full result (no redirect - user stays on job page)
        if (jobData.status === 'completed' && jobData.result) {
          setResults(jobData.result);
          // Also load history item for metadata (optional)
          try {
            const backtestData = await getBacktest(jobData.result.backtest_id);
            setBacktest(backtestData);
            // Note: We no longer redirect - user stays on job page with full results
            console.log('✅ Job completed, results available on job page (refresh):', {
              job_id: id,
              backtest_id: jobData.result.backtest_id,
            });
          } catch (err) {
            console.warn('Failed to load backtest history (optional):', err);
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
      <div className="min-h-screen bg-gray-900" style={{ pointerEvents: 'auto' }}>
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
    // Debug: Log render to identify what's causing re-renders (throttled)
    if (process.env.NODE_ENV === 'development' && (renderCountRef.current % 10 === 0 || renderCountRef.current === 1)) {
      console.log(`📄 Rendering job detail page (render #${renderCountRef.current}):`, {
        job_id: job.job_id,
        status: job.status,
        progress: job.progress,
        has_results: !!results,
        isJobId,
        id,
        timestamp: new Date().toISOString(),
      });
    }
    return (
      <div className="min-h-screen bg-gray-900" style={{ pointerEvents: 'auto', position: 'relative' }}>
        <DashboardNavigation />

        <main className="container mx-auto px-4 py-8">
          {/* Header with back link */}
          <div className="mb-6">
            <Link
              href="/backtesting"
              className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block cursor-pointer"
              onClick={(e) => {
                console.log('🖱️ Back link clicked (job view)');
                // Let default behavior happen
              }}
              style={{ pointerEvents: 'auto' }}
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
                  style={{ pointerEvents: 'auto' }}
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
                        console.log('🖱️ Copy strategy code button clicked');
                        if (job.strategy_code) {
                          navigator.clipboard.writeText(job.strategy_code).then(() => {
                            alert('Strategy code copied to clipboard!');
                          }).catch((err) => {
                            console.error('Failed to copy:', err);
                            alert('Failed to copy strategy code');
                          });
                        }
                      }}
                      className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded cursor-pointer"
                      type="button"
                      style={{ pointerEvents: 'auto' }}
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

              {/* Performance Metrics Card */}
              {results && (
                <div className="bg-gray-700 rounded-lg p-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Total Return</div>
                      <div className={`text-xl font-bold ${results.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {results.total_return_pct.toFixed(2)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ₹{results.total_return.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Final Value</div>
                      <div className="text-xl font-bold text-white">
                        ₹{results.final_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Total P&L</div>
                      <div className={`text-xl font-bold ${results.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ₹{results.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Win Rate</div>
                      <div className="text-xl font-bold text-white">
                        {results.win_rate !== null ? `${results.win_rate.toFixed(2)}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {results.winning_trades}W / {results.losing_trades}L
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Total Trades</div>
                      <div className="text-xl font-bold text-white">
                        {results.total_trades}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Sharpe Ratio</div>
                      <div className="text-xl font-bold text-white">
                        {results.sharpe_ratio !== null ? results.sharpe_ratio.toFixed(2) : 'N/A'}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Max Drawdown</div>
                      <div className="text-xl font-bold text-red-400">
                        {results.max_drawdown_pct !== null ? `${results.max_drawdown_pct.toFixed(2)}%` : 'N/A'}
                      </div>
                      {results.max_drawdown !== null && (
                        <div className="text-xs text-gray-500 mt-1">
                          ₹{Math.abs(results.max_drawdown).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">System Quality Number</div>
                      <div className="text-xl font-bold text-white">
                        {results.system_quality_number !== null ? results.system_quality_number.toFixed(2) : 'N/A'}
                      </div>
                    </div>

                    {results.annual_return !== null && (
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">Annual Return</div>
                        <div className={`text-xl font-bold ${results.annual_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {results.annual_return.toFixed(2)}%
                        </div>
                      </div>
                    )}

                    {results.average_return !== null && (
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">Average Return</div>
                        <div className={`text-xl font-bold ${results.average_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {results.average_return.toFixed(4)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

              {/* Show backtest results - charts update in real-time, transaction details only when completed */}
              {results ? (
                <BacktestResultsDisplay 
                  results={results} 
                  hideTransactionDetails={job.status !== 'completed'}
                  jobId={job?.job_id} // Pass job_id so charts can use it as fallback if backtest_id not available
                />
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

              {/* Strategy & Configuration Card (if job data is available) */}
              {job && (
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
                          console.log('🖱️ Copy strategy code button clicked');
                          if (job.strategy_code) {
                            navigator.clipboard.writeText(job.strategy_code).then(() => {
                              alert('Strategy code copied to clipboard!');
                            }).catch((err) => {
                              console.error('Failed to copy:', err);
                              alert('Failed to copy strategy code');
                            });
                          }
                        }}
                        className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded cursor-pointer"
                        type="button"
                        style={{ pointerEvents: 'auto' }}
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
              )}

              {/* Performance Metrics Card */}
              {results && (
                <div className="bg-gray-700 rounded-lg p-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Performance Metrics</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Total Return</div>
                      <div className={`text-xl font-bold ${results.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {results.total_return_pct.toFixed(2)}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        ₹{results.total_return.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Final Value</div>
                      <div className="text-xl font-bold text-white">
                        ₹{results.final_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Total P&L</div>
                      <div className={`text-xl font-bold ${results.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ₹{results.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Win Rate</div>
                      <div className="text-xl font-bold text-white">
                        {results.win_rate !== null ? `${results.win_rate.toFixed(2)}%` : 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {results.winning_trades}W / {results.losing_trades}L
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Total Trades</div>
                      <div className="text-xl font-bold text-white">
                        {results.total_trades}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Sharpe Ratio</div>
                      <div className="text-xl font-bold text-white">
                        {results.sharpe_ratio !== null ? results.sharpe_ratio.toFixed(2) : 'N/A'}
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">Max Drawdown</div>
                      <div className="text-xl font-bold text-red-400">
                        {results.max_drawdown_pct !== null ? `${results.max_drawdown_pct.toFixed(2)}%` : 'N/A'}
                      </div>
                      {results.max_drawdown !== null && (
                        <div className="text-xs text-gray-500 mt-1">
                          ₹{Math.abs(results.max_drawdown).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-800 rounded-lg p-3">
                      <div className="text-gray-400 text-xs mb-1">System Quality Number</div>
                      <div className="text-xl font-bold text-white">
                        {results.system_quality_number !== null ? results.system_quality_number.toFixed(2) : 'N/A'}
                      </div>
                    </div>

                    {results.annual_return !== null && (
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">Annual Return</div>
                        <div className={`text-xl font-bold ${results.annual_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {results.annual_return.toFixed(2)}%
                        </div>
                      </div>
                    )}

                    {results.average_return !== null && (
                      <div className="bg-gray-800 rounded-lg p-3">
                        <div className="text-gray-400 text-xs mb-1">Average Return</div>
                        <div className={`text-xl font-bold ${results.average_return >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {results.average_return.toFixed(4)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Job Status Section (if available) */}
              {job && (
                <div className="bg-gray-700 rounded-lg p-4 mt-4">
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
