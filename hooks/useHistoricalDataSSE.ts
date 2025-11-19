import { useState, useEffect, useRef, useCallback } from 'react';
import type { HistoricalDataPoint } from '@/lib/api/backtesting';
import {
  HistoricalDataSSEClient,
  MultiIntervalHistoricalDataSSEClient,
  type IntervalStartEvent,
  type MultiIntervalStartEvent,
  type DataChunkEvent,
  type MultiIntervalDataChunkEvent,
} from '@/lib/services/historicalDataSSE';

interface UseHistoricalDataSSEOptions {
  backtestId: string | null;
  token: string | null;
  interval?: string; // Single interval
  intervals?: string[]; // Multiple intervals
  limit?: number;
  chunkSize?: number;
  enabled?: boolean; // Whether to start streaming immediately
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
  backtestId,
  token,
  interval,
  intervals,
  limit = 1000,
  chunkSize = 500,
  enabled = true,
}: UseHistoricalDataSSEOptions): UseHistoricalDataSSEReturn {
  const isMultiInterval = intervals && intervals.length > 1;
  
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
    if (!enabled || !backtestId || !token || isMultiInterval || !interval) {
      return;
    }

    resetState();

    const client = new HistoricalDataSSEClient(backtestId, token, interval, limit, chunkSize);
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
  }, [backtestId, token, interval, limit, chunkSize, enabled, isMultiInterval, resetState]);

  // Multi-interval SSE connection
  useEffect(() => {
    if (!enabled || !backtestId || !token || !isMultiInterval || !intervals || intervals.length === 0) {
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

    const client = new MultiIntervalHistoricalDataSSEClient(backtestId, token, intervals, limit, chunkSize);
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
  }, [backtestId, token, intervals, limit, chunkSize, enabled, isMultiInterval, resetState]);

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

