import { useState, useEffect, useRef, useCallback } from 'react';
import type { BacktestJob, BacktestResponse } from '@/types';
import { BacktestProgressClient } from '@/lib/services/backtestWebSocket';
import { getBacktestJob } from '@/lib/api/backtesting';

interface UseBacktestProgressOptions {
  jobId: string | null;
  token: string | null;
  useWebSocket?: boolean; // Default: true
  pollInterval?: number; // For polling fallback (ms)
}

interface UseBacktestProgressReturn {
  job: BacktestJob | null;
  progress: number;
  status: string;
  error: string | null;
  completed: boolean;
  result: BacktestResponse | null;
  refresh: () => void;
}

export function useBacktestProgress({
  jobId,
  token,
  useWebSocket = true,
  pollInterval = 2000,
}: UseBacktestProgressOptions): UseBacktestProgressReturn {
  const [job, setJob] = useState<BacktestJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const wsClientRef = useRef<BacktestProgressClient | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJob = useCallback(async () => {
    if (!jobId || !token) return;

    try {
      const jobData = await getBacktestJob(jobId);
      setJob(jobData);
      
      if (jobData.status === 'completed') {
        console.log('✅ Backtest job completed (from API fetch), result:', jobData.result);
        setCompleted(true);
        // If we have a result, ensure it's set
        if (jobData.result) {
          setJob((prev) => prev ? { ...prev, result: jobData.result } : jobData);
        }
      } else if (jobData.status === 'failed' || jobData.status === 'cancelled') {
        const errorMsg = jobData.error_message || 'Job failed';
        console.error('❌ Backtest job status:', jobData.status, 'Error:', errorMsg);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('Error fetching job:', err);
      setError(err.message || 'Failed to fetch job status');
    }
  }, [jobId, token]);

  // WebSocket connection
  useEffect(() => {
    if (!jobId || !token || !useWebSocket) return;

    const client = new BacktestProgressClient(jobId, token);
    wsClientRef.current = client;

    client.connect(
      (progress) => {
        // Update job with progress
        setJob((prev) => prev ? {
          ...prev,
          status: progress.status as any,
          progress: progress.progress,
          current_bar: progress.current_bar,
          total_bars: progress.total_bars,
          progress_message: progress.message, // Store progress message from WebSocket
        } : null);
      },
      async (result) => {
        // Job completed via WebSocket
        // Note: WebSocket sends result_summary, but BacktestProgressClient
        // automatically fetches full result via REST API before calling this callback
        console.log('✅ Backtest job completed via WebSocket, full result received:', {
          backtest_id: result?.backtest_id,
          total_trades: result?.total_trades,
          transactions_count: result?.transactions?.length || 0,
          has_transactions: !!result?.transactions,
        });
        setJob((prev) => prev ? {
          ...prev,
          status: 'completed',
          progress: 100,
          result,
        } : null);
        setCompleted(true);
        // Fetch job again to ensure we have the latest data (in case result wasn't fully populated)
        // This is a safety measure - the WebSocket client should have already fetched the full result
        setTimeout(() => {
          fetchJob();
        }, 500);
      },
      (errorMsg) => {
        console.error('❌ Backtest job failed:', errorMsg);
        setError(errorMsg);
        // Update job with error message
        setJob((prev) => prev ? {
          ...prev,
          status: 'failed' as any,
          error_message: errorMsg,
        } : null);
      }
    );

    // Initial fetch
    fetchJob();

    return () => {
      client.disconnect();
      wsClientRef.current = null;
    };
  }, [jobId, token, useWebSocket, fetchJob]);

  // Polling fallback
  useEffect(() => {
    if (!jobId || !token || useWebSocket) return;

    // Initial fetch
    fetchJob();

    // Set up polling
    pollIntervalRef.current = setInterval(() => {
      fetchJob();
    }, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobId, token, useWebSocket, pollInterval, fetchJob]);

  const refresh = useCallback(() => {
    if (wsClientRef.current) {
      wsClientRef.current.refresh();
    } else {
      fetchJob();
    }
  }, [fetchJob]);

  // Debug logging for job state
  useEffect(() => {
    if (job) {
      console.log('📊 Job state update:', {
        status: job.status,
        progress: job.progress,
        has_result: !!job.result,
        result_keys: job.result ? Object.keys(job.result) : [],
        total_trades: job.result?.total_trades,
        transactions_count: job.result?.transactions?.length || 0,
        completed,
      });
    }
  }, [job, completed]);

  return {
    job,
    progress: job?.progress || 0,
    status: job?.status || 'pending',
    error,
    completed,
    result: job?.result || null,
    refresh,
  };
}

