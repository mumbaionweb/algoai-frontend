import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { HistoricalDataPoint } from '@/lib/api/backtesting';
import {
  HistoricalDataSSEClient,
  type IntervalStartEvent,
  type DataChunkEvent,
} from '@/lib/services/historicalDataSSE';

interface UseHistoricalDataSSEOptions {
  id: string | null; // Can be backtest_id (starts with 'bt_') or job_id (does not start with 'bt_')
  token: string | null;
  interval?: string; // Single interval
  intervals?: string[]; // Multiple intervals
  limit?: number;
  chunkSize?: number;
  enabled?: boolean; // Whether to start streaming immediately
  jobStatus?: string | null; // Job status: 'running', 'queued', 'paused', 'completed', etc. (for logging/debugging)
}

interface UseHistoricalDataSSEReturn {
  // Single interval state
  data: HistoricalDataPoint[];
  progress: number; // 0-100
  loading: boolean;
  error: string | null;
  metadata: IntervalStartEvent | null;
  
  // Multi-interval state (now using multiple single-interval SSE connections)
  intervalData: Record<string, HistoricalDataPoint[]>;
  intervalProgress: Record<string, number>; // Progress per interval (0-100)
  intervalLoading: Record<string, boolean>; // Loading state per interval
  intervalMetadata: Record<string, IntervalStartEvent>;
  currentInterval: string | null; // Not used anymore, but kept for backward compatibility
  completedIntervals: string[];
  
  // Common
  isMultiInterval: boolean;
  refresh: () => void;
}

/**
 * React hook for streaming historical data via SSE
 * Uses multiple single-interval SSE connections for parallel loading
 * Supports both single and multi-interval backtests
 * 
 * Strategy: Multiple Single-Interval SSE Connections (Parallel Loading)
 * - For multiple intervals, creates one SSE connection per interval
 * - All connections run in parallel for independent and faster loading
 * - Works for both running jobs and completed backtests
 */
export function useHistoricalDataSSE({
  id, // Can be backtest_id or job_id
  token,
  interval,
  intervals,
  limit = 1000,
  chunkSize = 500,
  enabled = true,
  jobStatus = null, // For logging/debugging only
}: UseHistoricalDataSSEOptions): UseHistoricalDataSSEReturn {
  // Determine if we have multiple intervals
  const isMultiInterval = intervals && intervals.length > 1;
  
  // Create stable intervals key for dependency comparison
  const intervalsKey = useMemo(() => {
    if (!intervals || intervals.length === 0) return '';
    return [...intervals].sort().join(',');
  }, [intervals]);
  
  // Single interval state
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<IntervalStartEvent | null>(null);
  
  // Multi-interval state (using multiple single-interval SSE connections)
  const [intervalData, setIntervalData] = useState<Record<string, HistoricalDataPoint[]>>({});
  const [intervalProgress, setIntervalProgress] = useState<Record<string, number>>({});
  const [intervalLoading, setIntervalLoading] = useState<Record<string, boolean>>({});
  const [intervalMetadata, setIntervalMetadata] = useState<Record<string, IntervalStartEvent>>({});
  const [completedIntervals, setCompletedIntervals] = useState<string[]>([]);
  
  // Refs to track clients for cleanup
  const singleClientRef = useRef<HistoricalDataSSEClient | null>(null);
  const multiClientsRef = useRef<Map<string, HistoricalDataSSEClient>>(new Map());
  const connectionConfigRef = useRef<{ id: string; intervals: string[] } | null>(null);

  const resetState = useCallback(() => {
    if (isMultiInterval) {
      setIntervalData({});
      setIntervalProgress({});
      setIntervalLoading({});
      setIntervalMetadata({});
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
        
        // Log available intervals if provided
        if (errorEvent.available_intervals && errorEvent.available_intervals.length > 0) {
          console.warn(`⚠️ SSE: Available intervals: ${errorEvent.available_intervals.join(', ')}`);
        }
        
        setError(errorEvent.message || 'Failed to stream historical data');
        setLoading(false);
      }
    );

    return () => {
      client.disconnect();
      singleClientRef.current = null;
    };
  }, [id, token, interval, limit, chunkSize, enabled, isMultiInterval, resetState]);

  // Multiple single-interval SSE connections for parallel loading
  // ✅ Strategy: Create one SSE connection per interval, all running in parallel
  // ✅ Works for both running jobs and completed backtests
  useEffect(() => {
    if (!enabled || !id || !token || !isMultiInterval || !intervals || intervals.length === 0) {
      return;
    }

    // Normalize intervals for comparison
    const normalizedIntervals = [...intervals].sort();
    const intervalsKey = normalizedIntervals.join(',');
    
    // Check if we already have connections for this exact configuration
    const currentConfig = connectionConfigRef.current;
    if (currentConfig && 
        currentConfig.id === id && 
        currentConfig.intervals.join(',') === intervalsKey) {
      // Configuration hasn't changed, don't recreate connections
      return;
    }

    // Configuration changed - clean up old connections
    multiClientsRef.current.forEach((client, intervalValue) => {
      client.disconnect();
      multiClientsRef.current.delete(intervalValue);
    });

    // Update connection config
    connectionConfigRef.current = { id, intervals: normalizedIntervals };

    // Initialize interval data structures
    const initialData: Record<string, HistoricalDataPoint[]> = {};
    const initialProgress: Record<string, number> = {};
    const initialLoading: Record<string, boolean> = {};
    const initialMetadata: Record<string, IntervalStartEvent> = {};
    intervals.forEach(interval => {
      initialData[interval] = [];
      initialProgress[interval] = 0;
      initialLoading[interval] = true;
    });
    setIntervalData(initialData);
    setIntervalProgress(initialProgress);
    setIntervalLoading(initialLoading);
    setIntervalMetadata(initialMetadata);

    // Track loading state per interval (for internal state management)
    const intervalLoadingState = new Map<string, boolean>();
    intervals.forEach(interval => {
      intervalLoadingState.set(interval, true);
    });

    // Create one SSE client per interval for parallel loading
    const clients = new Map<string, HistoricalDataSSEClient>();
    intervals.forEach(intervalValue => {
      const client = new HistoricalDataSSEClient(id, token, intervalValue, limit, chunkSize);
      clients.set(intervalValue, client);
      multiClientsRef.current.set(intervalValue, client);

      // Connect each client independently
      client.connect(
        (meta) => {
          const isPartial = meta.is_partial || false;
          const status = meta.job_status || jobStatus || 'unknown';
          const statusInfo = isPartial ? ` (${status}, partial data)` : '';
          console.log(`📊 SSE [${intervalValue}]: Starting: ${meta.total_points} points${statusInfo}`);
          
          setIntervalMetadata(prev => ({
            ...prev,
            [intervalValue]: meta,
          }));
          
          intervalLoadingState.set(intervalValue, true);
          setIntervalLoading(prev => ({
            ...prev,
            [intervalValue]: true,
          }));
          // Update overall loading state
          const allLoading = Array.from(intervalLoadingState.values()).some(loading => loading);
          setLoading(allLoading);
        },
        (chunk) => {
          const chunkData = chunk as DataChunkEvent;
          
          setIntervalData(prev => {
            const existingPoints = new Set(
              (prev[intervalValue] || []).map(p => p.time)
            );
            const newPoints = chunkData.data_points.filter(
              p => !existingPoints.has(p.time)
            );
            return {
              ...prev,
              [intervalValue]: [...(prev[intervalValue] || []), ...newPoints],
            };
          });
          
          const progressPercent = (chunkData.points_sent / chunkData.total_points) * 100;
          setIntervalProgress(prev => ({
            ...prev,
            [intervalValue]: progressPercent,
          }));
          
          if (chunkData.is_last_chunk) {
            intervalLoadingState.set(intervalValue, false);
            setIntervalLoading(prev => ({
              ...prev,
              [intervalValue]: false,
            }));
            // Update overall loading state
            const allLoading = Array.from(intervalLoadingState.values()).some(loading => loading);
            setLoading(allLoading);
          }
        },
        (result) => {
          // Interval complete
          if ('interval' in result) {
            console.log(`✅ SSE [${result.interval}]: Completed: ${result.total_points} points`);
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
            intervalLoadingState.set(result.interval, false);
            setIntervalLoading(prev => ({
              ...prev,
              [result.interval]: false,
            }));
            
            // Update overall loading state
            const allLoading = Array.from(intervalLoadingState.values()).some(loading => loading);
            setLoading(allLoading);
          }
        },
        (errorEvent) => {
          console.error(`❌ SSE [${intervalValue}] error:`, errorEvent);
          
          // Log available intervals if provided
          if (errorEvent.available_intervals && errorEvent.available_intervals.length > 0) {
            console.warn(`⚠️ SSE [${intervalValue}]: Available intervals: ${errorEvent.available_intervals.join(', ')}`);
          }
          
          // Don't set global error - other intervals can continue
          // Only set error if it's a critical connection error and this is the only interval
          if (errorEvent.error === 'connection_error' && intervals.length === 1) {
            setError(errorEvent.message || 'Failed to stream historical data');
            setLoading(false);
          }
          
          // Mark interval as complete (even if error) - the complete event will follow
          // This prevents reconnection attempts
          intervalLoadingState.set(intervalValue, false);
          setIntervalLoading(prev => ({
            ...prev,
            [intervalValue]: false,
          }));
          
          // Update overall loading state
          const allLoading = Array.from(intervalLoadingState.values()).some(loading => loading);
          setLoading(allLoading);
        }
      );
    });

    // Cleanup: disconnect all clients when effect dependencies change
    return () => {
      // Only cleanup if the configuration actually changed
      const currentConfig = connectionConfigRef.current;
      if (currentConfig && currentConfig.id === id && 
          currentConfig.intervals.join(',') === [...intervals].sort().join(',')) {
        // Configuration is the same, don't cleanup (might be a false positive re-run)
        return;
      }
      
      // Configuration changed, cleanup all connections
      multiClientsRef.current.forEach((client) => {
        client.disconnect();
      });
      multiClientsRef.current.clear();
      connectionConfigRef.current = null;
    };
  }, [id, token, intervalsKey, limit, chunkSize, enabled, isMultiInterval]);

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
    intervalLoading,
    intervalMetadata,
    currentInterval: null, // Not used anymore, but kept for backward compatibility
    completedIntervals,
    
    // Common
    isMultiInterval: !!isMultiInterval,
    refresh,
  };
}

