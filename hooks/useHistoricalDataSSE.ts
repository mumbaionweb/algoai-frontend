import { useState, useEffect, useRef, useCallback } from 'react';
import type { HistoricalDataPoint } from '@/lib/api/backtesting';
import { getBacktestHistoricalData } from '@/lib/api/backtesting';
import {
  HistoricalDataSSEClient,
  MultiIntervalHistoricalDataSSEClient,
  type IntervalStartEvent,
  type MultiIntervalStartEvent,
  type DataChunkEvent,
  type MultiIntervalDataChunkEvent,
} from '@/lib/services/historicalDataSSE';

interface UseHistoricalDataSSEOptions {
  id: string | null; // Can be backtest_id (starts with 'bt_') or job_id (does not start with 'bt_')
  token: string | null;
  interval?: string; // Single interval
  intervals?: string[]; // Multiple intervals
  limit?: number;
  chunkSize?: number;
  enabled?: boolean; // Whether to start streaming immediately
  useRestApiFallback?: boolean; // Fallback to REST API polling for running jobs
  pollInterval?: number; // Polling interval in ms (default: 5000) for REST API fallback
  jobStatus?: string | null; // Job status: 'running', 'queued', 'paused', 'completed', etc. Used to determine if multi-interval SSE is allowed
}

interface UseHistoricalDataSSEReturn {
  // Single interval state
  data: HistoricalDataPoint[];
  progress: number; // 0-100
  loading: boolean;
  error: string | null;
  metadata: IntervalStartEvent | null;
  
  // Multi-interval state
  intervalData: Record<string, HistoricalDataPoint[]>;
  intervalProgress: Record<string, number>; // Progress per interval (0-100)
  intervalMetadata: Record<string, IntervalStartEvent | MultiIntervalStartEvent>;
  currentInterval: string | null;
  completedIntervals: string[];
  
  // Common
  isMultiInterval: boolean;
  refresh: () => void;
}

/**
 * React hook for streaming historical data via SSE
 * Supports both single and multi-interval backtests
 */
export function useHistoricalDataSSE({
  id, // Can be backtest_id or job_id
  token,
  interval,
  intervals,
  limit = 1000,
  chunkSize = 500,
  enabled = true,
  useRestApiFallback = false, // Use REST API polling as fallback for running jobs
  pollInterval = 5000, // Poll every 5 seconds for running jobs
  jobStatus = null, // Job status to determine if multi-interval SSE is allowed
}: UseHistoricalDataSSEOptions): UseHistoricalDataSSEReturn {
  // Check if this is a job_id (doesn't start with 'bt_')
  const isJobId = id && !id.startsWith('bt_');
  
  // Multi-interval SSE is ONLY allowed for completed backtests (backtest_id)
  // For running jobs, we must use single-interval SSE or REST API for each interval
  const isRunningJob = isJobId && (jobStatus === 'running' || jobStatus === 'queued' || jobStatus === 'paused');
  const canUseMultiIntervalSSE = intervals && intervals.length > 1 && !isRunningJob;
  
  // If it's a running job with multi-interval, we'll use single-interval SSE for each interval
  // Otherwise, use multi-interval SSE if applicable
  const isMultiInterval = canUseMultiIntervalSSE;
  
  // Single interval state
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<IntervalStartEvent | null>(null);
  
  // Multi-interval state
  const [intervalData, setIntervalData] = useState<Record<string, HistoricalDataPoint[]>>({});
  const [intervalProgress, setIntervalProgress] = useState<Record<string, number>>({});
  const [intervalMetadata, setIntervalMetadata] = useState<Record<string, IntervalStartEvent | MultiIntervalStartEvent>>({});
  const [currentInterval, setCurrentInterval] = useState<string | null>(null);
  const [completedIntervals, setCompletedIntervals] = useState<string[]>([]);
  
  const singleClientRef = useRef<HistoricalDataSSEClient | null>(null);
  const multiClientRef = useRef<MultiIntervalHistoricalDataSSEClient | null>(null);

  const resetState = useCallback(() => {
    if (isMultiInterval) {
      setIntervalData({});
      setIntervalProgress({});
      setIntervalMetadata({});
      setCurrentInterval(null);
      setCompletedIntervals([]);
    } else {
      setData([]);
      setProgress(0);
      setMetadata(null);
    }
    setLoading(true);
    setError(null);
  }, [isMultiInterval]);

  // Single interval SSE connection
  useEffect(() => {
    if (!enabled || !id || !token || isMultiInterval || !interval) {
      return;
    }

    resetState();

    const client = new HistoricalDataSSEClient(id, token, interval, limit, chunkSize);
    singleClientRef.current = client;

    client.connect(
      (meta) => {
        console.log(`📊 SSE: Starting interval ${meta.interval}: ${meta.total_points} points`);
        setMetadata(meta);
        setLoading(true);
      },
      (chunk) => {
        const chunkData = chunk as DataChunkEvent;
        setData(prev => {
          // Avoid duplicates by checking if we already have this chunk
          const existingPoints = new Set(prev.map(p => p.time));
          const newPoints = chunkData.data_points.filter(
            p => !existingPoints.has(p.time)
          );
          return [...prev, ...newPoints];
        });
        
        const progressPercent = (chunkData.points_sent / chunkData.total_points) * 100;
        setProgress(progressPercent);
        
        if (chunkData.is_last_chunk) {
          setLoading(false);
        }
      },
      (result) => {
        // For single-interval, result should always be CompleteEvent
        if ('interval' in result) {
          console.log(`✅ SSE: Completed streaming ${result.interval}: ${result.total_points} points`);
        } else {
          console.log(`✅ SSE: Completed streaming all intervals`);
        }
        setLoading(false);
        setProgress(100);
      },
      (errorEvent) => {
        console.error('❌ SSE error:', errorEvent);
        setError(errorEvent.message || 'Failed to stream historical data');
        setLoading(false);
      }
    );

    return () => {
      client.disconnect();
      singleClientRef.current = null;
    };
  }, [id, token, interval, limit, chunkSize, enabled, isMultiInterval, resetState]);

  // Multi-interval REST API fallback for running jobs
  // For running jobs with multi-interval, we must use REST API for each interval separately
  // Multi-interval SSE is ONLY available for completed backtests
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningJobRef = useRef<boolean>(false);
  const initializedForJobRef = useRef<string | null>(null); // Track which job we've initialized for
  
  useEffect(() => {
    if (!enabled || !id || !token || !intervals || intervals.length <= 1) {
      // Clean up if conditions not met
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      isRunningJobRef.current = false;
      initializedForJobRef.current = null;
      return;
    }

    // Only use REST API fallback for running jobs with multi-interval
    if (!isJobId || !isRunningJob) {
      // Clean up polling if job is no longer running
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      isRunningJobRef.current = false;
      // Reset initialization if job changed or completed
      if (initializedForJobRef.current !== id) {
        initializedForJobRef.current = null;
      }
      return; // Let the multi-interval SSE effect handle it
    }

    // Prevent multiple initializations for the same job
    if (initializedForJobRef.current === id && pollIntervalRef.current) {
      // Update the running job ref but don't re-initialize
      isRunningJobRef.current = true;
      return; // Already initialized for this job
    }

    console.log('⚠️ Running job with multi-interval detected. Using REST API for each interval separately (multi-interval SSE not available for running jobs).');

    initializedForJobRef.current = id;
    isRunningJobRef.current = true;
    resetState();

    // Initialize interval data structures
    const initialData: Record<string, HistoricalDataPoint[]> = {};
    const initialProgress: Record<string, number> = {};
    intervals.forEach(interval => {
      initialData[interval] = [];
      initialProgress[interval] = 0;
    });
    setIntervalData(initialData);
    setIntervalProgress(initialProgress);
    setLoading(true);

    // Fetch each interval separately via REST API
    const fetchPromises = intervals.map(async (intervalValue) => {
      try {
        const dataLimit = limit || 10000;
        const data = await getBacktestHistoricalData(id, dataLimit, 'json', intervalValue);
        
        return {
          interval: intervalValue,
          data,
          error: null,
        };
      } catch (err: any) {
        const errorDetail = err.response?.data?.detail || '';
        const errorMessage = err.message || '';
        const isTimeout = err.code === 'ECONNABORTED' || errorMessage.includes('timeout');
        
        if (isTimeout) {
          // Timeout is expected for large datasets - provide helpful message
          console.warn(`⏱️ Timeout fetching interval ${intervalValue} for running job (large dataset, will retry). This is normal for minute/3minute intervals with many data points.`);
        } else {
          console.error(`❌ Failed to fetch interval ${intervalValue} for running job:`, errorDetail || errorMessage);
        }
        
        return {
          interval: intervalValue,
          data: null,
          error: isTimeout ? 'Request timeout (large dataset)' : (errorDetail || errorMessage || 'Failed to load historical data'),
        };
      }
    });

    Promise.all(fetchPromises).then((results) => {
      const updatedData: Record<string, HistoricalDataPoint[]> = {};
      const updatedProgress: Record<string, number> = {};
      const updatedMetadata: Record<string, IntervalStartEvent> = {};
      let hasError = false;

      results.forEach(({ interval, data, error: fetchError }) => {
        if (data && data.data_points && data.data_points.length > 0) {
          updatedData[interval] = data.data_points;
          updatedProgress[interval] = 100;
          updatedMetadata[interval] = {
            interval: data.interval || interval,
            total_points: data.total_points,
            total_chunks: 1,
            chunk_size: data.data_points.length,
            backtest_id: data.backtest_id || id,
            symbol: data.symbol || '',
            exchange: data.exchange || '',
          };
        } else {
          // For running jobs, it's normal for some intervals to not have data yet
          // Don't set error state, just log it
          updatedData[interval] = [];
          updatedProgress[interval] = 0;
          hasError = true;
          if (fetchError) {
            // Only set error if it's a critical error (not just "no data yet")
            const isServerError = fetchError.includes('500') || fetchError.includes('Internal Server Error');
            if (isServerError) {
              console.error(`❌ Server error fetching interval ${interval}:`, fetchError);
              // Don't set global error - let other intervals continue
            } else {
              console.warn(`⚠️ No data yet for interval ${interval} (job still running)`);
            }
          }
        }
      });

      setIntervalData(updatedData);
      setIntervalProgress(updatedProgress);
      setIntervalMetadata(updatedMetadata);
      setLoading(false);

      if (hasError) {
        console.warn('⚠️ Some intervals failed to load for running job');
      } else {
        console.log('✅ All intervals loaded for running job via REST API');
      }
    });

    // Set up polling for running jobs (refresh every 5 seconds)
    // Only poll if job is still running
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(() => {
      // Check if job is still running (use ref to avoid stale closure)
      if (!isRunningJobRef.current || !isJobId || !isRunningJob) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        isRunningJobRef.current = false;
        return;
      }

      intervals.forEach(async (intervalValue) => {
        try {
          const dataLimit = limit || 10000;
          const data = await getBacktestHistoricalData(id, dataLimit, 'json', intervalValue);
          
          if (data && data.data_points && data.data_points.length > 0) {
            setIntervalData(prev => ({
              ...prev,
              [intervalValue]: data.data_points,
            }));
            setIntervalProgress(prev => ({
              ...prev,
              [intervalValue]: 100,
            }));
          }
        } catch (err: any) {
          // Handle timeout errors specifically
          const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
          const isServerError = err.response?.status === 500;
          
          if (isTimeout) {
            // Timeout is expected for large datasets - log but don't spam console
            console.warn(`⏱️ Timeout fetching interval ${intervalValue} for running job (this is normal for large datasets). Will retry on next poll.`);
          } else if (!isServerError) {
            // Log other errors (but not 500 server errors)
            console.warn(`Polling error for interval ${intervalValue}:`, err.message || err);
          }
          // Silently continue - will retry on next poll
        }
      });
    }, 5000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      isRunningJobRef.current = false;
      // Reset initialization flag when job ID changes (new job)
      if (initializedForJobRef.current === id) {
        initializedForJobRef.current = null;
      }
    };
  }, [id, token, intervals, limit, enabled, isJobId, isRunningJob]);

  // Multi-interval SSE connection
  // IMPORTANT: Only use multi-interval SSE for completed backtests (backtest_id)
  // For running jobs, the REST API effect above handles it
  useEffect(() => {
    if (!enabled || !id || !token || !isMultiInterval || !intervals || intervals.length === 0) {
      return;
    }

    // Safety check: Don't use multi-interval SSE for running jobs
    if (isJobId && isRunningJob) {
      // This should be handled by the REST API effect above
      return;
    }

    resetState();

    // Initialize interval data structures
    const initialData: Record<string, HistoricalDataPoint[]> = {};
    const initialProgress: Record<string, number> = {};
    intervals.forEach(interval => {
      initialData[interval] = [];
      initialProgress[interval] = 0;
    });
    setIntervalData(initialData);
    setIntervalProgress(initialProgress);

    const client = new MultiIntervalHistoricalDataSSEClient(id, token, intervals, limit, chunkSize);
    multiClientRef.current = client;

    client.connect(
      (meta) => {
        const multiMeta = meta as MultiIntervalStartEvent;
        console.log(`📊 SSE: Starting interval ${multiMeta.interval_index + 1}/${multiMeta.total_intervals}: ${multiMeta.interval}`);
        setCurrentInterval(multiMeta.interval);
        setIntervalMetadata(prev => ({
          ...prev,
          [multiMeta.interval]: multiMeta,
        }));
        setLoading(true);
      },
      (chunk) => {
        const multiChunk = chunk as MultiIntervalDataChunkEvent;
        const interval = multiChunk.interval;
        
        setIntervalData(prev => {
          const existingPoints = new Set(
            (prev[interval] || []).map(p => p.time)
          );
          const newPoints = multiChunk.data_points.filter(
            p => !existingPoints.has(p.time)
          );
          return {
            ...prev,
            [interval]: [...(prev[interval] || []), ...newPoints],
          };
        });
        
        const progressPercent = (multiChunk.points_sent / multiChunk.total_points) * 100;
        setIntervalProgress(prev => ({
          ...prev,
          [interval]: progressPercent,
        }));
        
        // Update overall loading state
        const allCompleted = multiChunk.progress.completed_intervals.length === multiChunk.total_intervals;
        if (allCompleted) {
          setLoading(false);
        }
      },
      (result) => {
        // Interval complete
        console.log(`✅ SSE: Completed interval ${result.interval}: ${result.total_points} points`);
        setCompletedIntervals(prev => {
          if (!prev.includes(result.interval)) {
            return [...prev, result.interval];
          }
          return prev;
        });
        setIntervalProgress(prev => ({
          ...prev,
          [result.interval]: 100,
        }));
      },
      (allComplete) => {
        // All intervals complete
        // Type guard: check if it's AllCompleteEvent (has completed_intervals property)
        if ('completed_intervals' in allComplete && 'intervals' in allComplete) {
          console.log(`✅ SSE: All intervals complete: ${allComplete.completed_intervals.join(', ')}`);
          setLoading(false);
          setCompletedIntervals(allComplete.completed_intervals);
          // Set all progress to 100
          const finalProgress: Record<string, number> = {};
          allComplete.intervals.forEach(interval => {
            finalProgress[interval] = 100;
          });
          setIntervalProgress(finalProgress);
        } else {
          // This shouldn't happen for multi-interval, but handle gracefully
          console.log(`✅ SSE: All intervals complete`);
          setLoading(false);
        }
      },
      (errorEvent) => {
        console.error('❌ SSE error:', errorEvent);
        // Don't set error for multi-interval - continue with other intervals
        // Only set error if it's a critical connection error
        if (errorEvent.error === 'connection_error') {
          setError(errorEvent.message || 'Failed to stream historical data');
          setLoading(false);
        }
      }
    );

    return () => {
      client.disconnect();
      multiClientRef.current = null;
    };
  }, [id, token, intervals, limit, chunkSize, enabled, isMultiInterval, resetState, isJobId, isRunningJob]);

  const refresh = useCallback(() => {
    // Reset and reconnect
    resetState();
    // The useEffect will automatically reconnect
  }, [resetState]);

  return {
    // Single interval
    data,
    progress,
    loading,
    error,
    metadata,
    
    // Multi-interval
    intervalData,
    intervalProgress,
    intervalMetadata,
    currentInterval,
    completedIntervals,
    
    // Common
    isMultiInterval: !!isMultiInterval,
    refresh,
  };
}

