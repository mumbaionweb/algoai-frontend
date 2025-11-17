import { useState, useEffect, useRef, useCallback } from 'react';
import type { BacktestJob, BacktestResponse, Transaction } from '@/types';
import { BacktestSSEClient } from '@/lib/services/backtestSSE';
import { getBacktestJob } from '@/lib/api/backtesting';

interface UseBacktestProgressOptions {
  jobId: string | null;
  token: string | null;
  useWebSocket?: boolean; // Default: true (uses SSE, kept for backward compatibility)
  pollInterval?: number; // For polling fallback (ms)
  onTransaction?: (transactions: Transaction[]) => void; // Callback for streaming transactions
}

interface UseBacktestProgressReturn {
  job: BacktestJob | null;
  progress: number;
  status: string;
  error: string | null;
  completed: boolean;
  result: BacktestResponse | null;
  streamingTransactions: Transaction[]; // Accumulated streaming transactions
  refresh: () => void;
}

export function useBacktestProgress({
  jobId,
  token,
  useWebSocket = true,
  pollInterval = 2000,
  onTransaction,
}: UseBacktestProgressOptions): UseBacktestProgressReturn {
  const [job, setJob] = useState<BacktestJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [streamingTransactions, setStreamingTransactions] = useState<Transaction[]>([]);
  const sseClientRef = useRef<BacktestSSEClient | null>(null);
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

  // SSE connection (replaces WebSocket)
  useEffect(() => {
    if (!jobId || !token || !useWebSocket) return;

    const client = new BacktestSSEClient(jobId, token);
    sseClientRef.current = client;

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
      },
      (transactionData) => {
        // Handle streaming transactions
        console.log(`📊 Streaming transactions received: ${transactionData.new_transactions_count} new, ${transactionData.total_transactions} total`);
        
        // Add new transactions to accumulated list
        setStreamingTransactions((prev) => {
          // Create a map of existing transactions by a unique key (trade_id + date + type)
          const existingKeys = new Set(
            prev.map(t => `${t.trade_id || 'unlinked'}_${t.entry_date || t.date}_${t.type}_${t.quantity}`)
          );
          
          // Filter out duplicates
          const newTxns = transactionData.transactions.filter(
            t => !existingKeys.has(`${t.trade_id || 'unlinked'}_${t.entry_date || t.date}_${t.type}_${t.quantity}`)
          );
          
          if (newTxns.length > 0) {
            console.log(`✅ Adding ${newTxns.length} new unique transactions to stream`);
            const updated = [...prev, ...newTxns];
            
            // Call external callback if provided
            if (onTransaction) {
              onTransaction(newTxns);
            }
            
            return updated;
          }
          
          return prev;
        });
      }
    );

    // Initial fetch
    fetchJob();

    return () => {
      client.disconnect();
      sseClientRef.current = null;
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
    // SSE doesn't have a refresh method like WebSocket
    // Just fetch the job status directly
    fetchJob();
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
    streamingTransactions,
    refresh,
  };
}

