import type { HistoricalDataPoint } from '@/lib/api/backtesting';

export interface IntervalStartEvent {
  interval: string;
  total_points: number;
  total_chunks: number;
  chunk_size: number;
  backtest_id: string | null; // null for running jobs
  job_id?: string | null; // For running jobs
  symbol: string;
  exchange: string;
  is_partial?: boolean; // true for running jobs
  current_bar?: number | null; // Current bar being processed (for running jobs)
  job_status?: string; // 'running', 'queued', 'paused', 'completed', etc.
}

export interface DataChunkEvent {
  chunk_id: number;
  interval: string;
  backtest_id: string | null; // null for running jobs
  job_id?: string | null; // For running jobs
  data_points: HistoricalDataPoint[];
  total_chunks: number;
  chunk_size: number;
  points_sent: number;
  total_points: number;
  is_last_chunk: boolean;
  is_partial?: boolean; // true for running jobs
  current_bar?: number | null; // Current bar being processed (for running jobs)
  job_status?: string; // 'running', 'queued', 'paused', 'completed', etc.
}

export interface CompleteEvent {
  interval: string;
  total_points: number;
  total_chunks: number;
  status: 'completed';
  backtest_id: string | null; // null for running jobs
  job_id?: string | null; // For running jobs
}

// Multi-interval types
export interface MultiIntervalStartEvent extends IntervalStartEvent {
  interval_index: number;
  total_intervals: number;
}

export interface MultiIntervalDataChunkEvent extends DataChunkEvent {
  interval_index: number;
  total_intervals: number;
  progress: {
    intervals: Record<string, {
      total_points: number;
      total_chunks: number;
      chunks_sent: number;
      points_sent: number;
    }>;
    completed_intervals: string[];
  };
}

export interface IntervalCompleteEvent {
  interval: string;
  total_points: number;
  total_chunks: number;
  status: 'completed';
  backtest_id: string | null; // null for running jobs
  job_id?: string | null; // For running jobs
  interval_index: number;
  total_intervals: number;
  progress: {
    intervals: Record<string, any>;
    completed_intervals: string[];
  };
  is_partial?: boolean; // true for running jobs
  job_status?: string; // 'running', 'queued', 'paused', 'completed', etc.
}

export interface AllCompleteEvent {
  intervals: string[];
  completed_intervals: string[];
  status: 'completed';
  backtest_id: string | null; // null for running jobs (until job completes)
  job_id?: string | null; // For running jobs
  progress: {
    intervals: Record<string, any>;
    completed_intervals: string[];
  };
  is_partial?: boolean; // true for running jobs until job completes
  job_status?: string; // 'running', 'queued', 'paused', 'completed', etc.
}

export interface ErrorEvent {
  error: string;
  message: string;
  timestamp?: string;
  backtest_id?: string;
  interval?: string;
  chunk_id?: number;
  available_intervals?: string[]; // Intervals that are available when requested interval is not found
}

export type IntervalStartCallback = (meta: IntervalStartEvent | MultiIntervalStartEvent) => void;
export type DataChunkCallback = (chunk: DataChunkEvent | MultiIntervalDataChunkEvent) => void;
export type CompleteCallback = (result: CompleteEvent | AllCompleteEvent) => void;
export type ErrorCallback = (error: ErrorEvent) => void;

/**
 * SSE Client for streaming historical data for a single interval
 * Supports both backtest_id (starts with 'bt_') and job_id (does not start with 'bt_')
 */
export class HistoricalDataSSEClient {
  private eventSource: EventSource | null = null;
  private id: string; // Can be backtest_id or job_id
  private token: string;
  private interval: string;
  private limit: number;
  private chunkSize: number;
  private isIntentionallyClosed = false;
  private isStreamComplete = false; // Track if stream is complete (even after error)

  constructor(
    id: string, // backtest_id (starts with 'bt_') or job_id (does not start with 'bt_')
    token: string,
    interval: string,
    limit: number = 1000,
    chunkSize: number = 500
  ) {
    this.id = id;
    this.token = token;
    this.interval = interval;
    this.limit = limit;
    this.chunkSize = chunkSize;
  }

  connect(
    onIntervalStart: IntervalStartCallback,
    onDataChunk: DataChunkCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback
  ): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      console.warn('SSE already connected for historical data');
      return;
    }

    this.isIntentionallyClosed = false;
    this.isStreamComplete = false; // Reset stream complete flag
    const sseUrl = this.getSSEUrl();

    try {
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.addEventListener('interval_start', (event) => {
        try {
          const data = JSON.parse(event.data) as IntervalStartEvent;
          console.log(`📊 Starting interval ${data.interval}: ${data.total_points} points in ${data.total_chunks} chunks`);
          onIntervalStart(data);
        } catch (error) {
          console.error('Error parsing interval_start event:', error);
          onError({
            error: 'parse_error',
            message: 'Failed to parse interval_start event',
          });
        }
      });

      this.eventSource.addEventListener('data_chunk', (event) => {
        try {
          const data = JSON.parse(event.data) as DataChunkEvent;
          const progress = (data.points_sent / data.total_points) * 100;
          console.log(`📊 Data chunk ${data.chunk_id}/${data.total_chunks} for ${data.interval}: ${data.data_points.length} points (${progress.toFixed(1)}%)`);
          onDataChunk(data);
        } catch (error) {
          console.error('Error parsing data_chunk event:', error);
          onError({
            error: 'parse_error',
            message: 'Failed to parse data_chunk event',
          });
        }
      });

      this.eventSource.addEventListener('complete', (event) => {
        try {
          const data = JSON.parse(event.data) as CompleteEvent;
          console.log(`✅ Completed streaming ${data.interval}: ${data.total_points} points in ${data.total_chunks} chunks`);
          this.isStreamComplete = true; // Mark stream as complete
          onComplete(data);
          this.disconnect(); // Stop reconnecting
        } catch (error) {
          console.error('Error parsing complete event:', error);
          onError({
            error: 'parse_error',
            message: 'Failed to parse complete event',
          });
        }
      });

      this.eventSource.addEventListener('error', (event) => {
        // Check if event is a MessageEvent with data (custom error event from server)
        if (event instanceof MessageEvent && event.data) {
          try {
            const data = JSON.parse(event.data) as ErrorEvent;
            console.error(`❌ SSE [${this.interval}] error:`, data);
            
            // Log available intervals if provided
            if (data.available_intervals && data.available_intervals.length > 0) {
              console.warn(`⚠️ Available intervals: ${data.available_intervals.join(', ')}`);
            }
            
            onError(data);
            
            // After error, wait for complete event to stop reconnecting
            // The backend will send a complete event after error to signal stream is done
            // We'll handle it in the complete event listener above
          } catch (error) {
            console.error('❌ SSE error parsing failed:', error);
            onError({
              error: 'parse_error',
              message: 'Failed to parse error event',
            });
          }
        } else {
          // Standard EventSource connection error (no data)
          // Only reconnect if stream is not complete
          if (this.isStreamComplete) {
            console.log('🔌 SSE stream already complete, not reconnecting');
            return;
          }
          
          if (this.eventSource?.readyState === EventSource.CONNECTING) {
            console.log('🔄 SSE reconnecting...');
          } else if (this.eventSource?.readyState === EventSource.CLOSED) {
            if (!this.isIntentionallyClosed && !this.isStreamComplete) {
              console.log('🔌 SSE connection closed (will auto-reconnect)');
            } else if (this.isStreamComplete) {
              console.log('🔌 SSE connection closed (stream complete, not reconnecting)');
            }
          } else {
            console.error('❌ SSE connection error');
            if (!this.isStreamComplete) {
              onError({
                error: 'connection_error',
                message: 'SSE connection error',
              });
            }
          }
        }
      });

      this.eventSource.onerror = (error) => {
        // Only log if stream is not complete
        if (!this.isStreamComplete) {
          console.error('❌ SSE onerror:', error);
          // SSE will auto-reconnect unless stream is complete
        } else {
          console.log('🔌 SSE onerror (stream complete, ignoring):', error);
        }
      };

    } catch (error) {
      console.error('Error creating SSE connection for historical data:', error);
      onError({
        error: 'connection_error',
        message: 'Failed to create SSE connection',
      });
    }
  }

  private getSSEUrl(): string {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
    
    // Extract base URL from API_URL
    let baseUrl: string;
    try {
      const apiUrl = new URL(API_URL);
      baseUrl = `${apiUrl.protocol}//${apiUrl.host}`;
    } catch {
      // Fallback if API_URL is not a valid URL
      baseUrl = API_URL.replace(/\/$/, '');
    }
    
    const params = new URLSearchParams({
      interval: this.interval,
      limit: this.limit.toString(),
      chunk_size: this.chunkSize.toString(),
      token: this.token,
    });
    
    return `${baseUrl}/api/sse/backtest/${this.id}/data?${params.toString()}`;
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

/**
 * SSE Client for streaming historical data for multiple intervals
 * Supports both backtest_id (starts with 'bt_') and job_id (does not start with 'bt_')
 */
export class MultiIntervalHistoricalDataSSEClient {
  private eventSource: EventSource | null = null;
  private id: string; // Can be backtest_id or job_id
  private token: string;
  private intervals: string[];
  private limit: number;
  private chunkSize: number;
  private isIntentionallyClosed = false;
  private isStreamComplete = false; // Track if stream is complete (even after error)

  constructor(
    id: string, // backtest_id (starts with 'bt_') or job_id (does not start with 'bt_')
    token: string,
    intervals: string[],
    limit: number = 1000,
    chunkSize: number = 500
  ) {
    this.id = id;
    this.token = token;
    this.intervals = intervals;
    this.limit = limit;
    this.chunkSize = chunkSize;
  }

  connect(
    onIntervalStart: IntervalStartCallback,
    onDataChunk: DataChunkCallback,
    onIntervalComplete: (result: IntervalCompleteEvent) => void,
    onAllComplete: CompleteCallback,
    onError: ErrorCallback
  ): void {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      console.warn('SSE already connected for multi-interval historical data');
      return;
    }

    this.isIntentionallyClosed = false;
    this.isStreamComplete = false; // Reset stream complete flag
    const sseUrl = this.getSSEUrl();

    try {
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.addEventListener('interval_start', (event) => {
        try {
          const data = JSON.parse(event.data) as MultiIntervalStartEvent;
          console.log(`📊 Starting interval ${data.interval_index + 1}/${data.total_intervals}: ${data.interval} (${data.total_points} points)`);
          onIntervalStart(data);
        } catch (error) {
          console.error('Error parsing interval_start event:', error);
          onError({
            error: 'parse_error',
            message: 'Failed to parse interval_start event',
          });
        }
      });

      this.eventSource.addEventListener('data_chunk', (event) => {
        try {
          const data = JSON.parse(event.data) as MultiIntervalDataChunkEvent;
          const progress = data.progress;
          console.log(`📊 Data chunk for ${data.interval}: ${data.points_sent}/${data.total_points} points (${progress.completed_intervals.length}/${data.total_intervals} intervals done)`);
          onDataChunk(data);
        } catch (error) {
          console.error('Error parsing data_chunk event:', error);
          onError({
            error: 'parse_error',
            message: 'Failed to parse data_chunk event',
          });
        }
      });

      this.eventSource.addEventListener('interval_complete', (event) => {
        try {
          const data = JSON.parse(event.data) as IntervalCompleteEvent;
          console.log(`✅ Completed interval ${data.interval}: ${data.total_points} points`);
          onIntervalComplete(data);
        } catch (error) {
          console.error('Error parsing interval_complete event:', error);
          onError({
            error: 'parse_error',
            message: 'Failed to parse interval_complete event',
          });
        }
      });

      this.eventSource.addEventListener('all_complete', (event) => {
        try {
          const data = JSON.parse(event.data) as AllCompleteEvent;
          console.log(`✅ All intervals complete: ${data.completed_intervals.join(', ')}`);
          this.isStreamComplete = true; // Mark stream as complete
          onAllComplete(data);
          this.disconnect(); // Stop reconnecting
        } catch (error) {
          console.error('Error parsing all_complete event:', error);
          onError({
            error: 'parse_error',
            message: 'Failed to parse all_complete event',
          });
        }
      });

      this.eventSource.addEventListener('error', (event) => {
        // Check if event is a MessageEvent with data (custom error event from server)
        if (event instanceof MessageEvent && event.data) {
          try {
            const data = JSON.parse(event.data) as ErrorEvent;
            console.error('❌ SSE error event:', data);
            
            // Log available intervals if provided
            if (data.available_intervals && data.available_intervals.length > 0) {
              console.warn(`⚠️ Available intervals: ${data.available_intervals.join(', ')}`);
            }
            
            // Don't close on error - continue with other intervals
            // But wait for complete event to stop reconnecting
            onError(data);
          } catch (error) {
            console.error('❌ SSE error parsing failed:', error);
            onError({
              error: 'parse_error',
              message: 'Failed to parse error event',
            });
          }
        } else {
          // Standard EventSource connection error (no data)
          // Only reconnect if stream is not complete
          if (this.isStreamComplete) {
            console.log('🔌 SSE stream already complete, not reconnecting');
            return;
          }
          
          if (this.eventSource?.readyState === EventSource.CONNECTING) {
            console.log('🔄 SSE reconnecting...');
          } else if (this.eventSource?.readyState === EventSource.CLOSED) {
            if (!this.isIntentionallyClosed && !this.isStreamComplete) {
              console.log('🔌 SSE connection closed (will auto-reconnect)');
            } else if (this.isStreamComplete) {
              console.log('🔌 SSE connection closed (stream complete, not reconnecting)');
            }
          } else {
            console.error('❌ SSE connection error');
            if (!this.isStreamComplete) {
              onError({
                error: 'connection_error',
                message: 'SSE connection error',
              });
            }
          }
        }
      });

      this.eventSource.onerror = (error) => {
        // Only log if stream is not complete
        if (!this.isStreamComplete) {
          console.error('❌ SSE onerror:', error);
          // SSE will auto-reconnect unless stream is complete
        } else {
          console.log('🔌 SSE onerror (stream complete, ignoring):', error);
        }
      };

    } catch (error) {
      console.error('Error creating SSE connection for multi-interval historical data:', error);
      onError({
        error: 'connection_error',
        message: 'Failed to create SSE connection',
      });
    }
  }

  private getSSEUrl(): string {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
    
    // Extract base URL from API_URL
    let baseUrl: string;
    try {
      const apiUrl = new URL(API_URL);
      baseUrl = `${apiUrl.protocol}//${apiUrl.host}`;
    } catch {
      // Fallback if API_URL is not a valid URL
      baseUrl = API_URL.replace(/\/$/, '');
    }
    
    const params = new URLSearchParams({
      intervals: this.intervals.join(','),
      limit: this.limit.toString(),
      chunk_size: this.chunkSize.toString(),
      token: this.token,
    });
    
    return `${baseUrl}/api/sse/backtest/${this.id}/data/multi?${params.toString()}`;
  }

  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

