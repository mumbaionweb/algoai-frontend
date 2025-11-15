import { apiClient } from './client';
import type { BacktestRequest, BacktestResponse, BacktestHistoryResponse, BacktestHistoryItem, BacktestJob, BacktestJobStatus } from '@/types';

/**
 * Enhanced logging wrapper for backtest API calls
 */
const logApiCall = (action: string, data?: any, response?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🚀 [Backtest API] ${action}`, data || '');
    if (response) {
      console.log(`✅ [Backtest API] ${action} - Success:`, response);
    }
  }
};

const logError = (action: string, error: any) => {
  console.error(`❌ [Backtest API] ${action} - Error:`, error);
};

/**
 * Run a backtest with full configuration
 * 
 * @param request Backtest request parameters
 * @param brokerType Broker type (default: "zerodha")
 * @param credentialsId Optional credentials ID to use
 * @returns Backtest results
 */
export async function runBacktest(
  request: BacktestRequest,
  brokerType: string = 'zerodha',
  credentialsId?: string
): Promise<BacktestResponse> {
  try {
    logApiCall('Starting backtest', {
      symbol: request.symbol,
      exchange: request.exchange,
      from_date: request.from_date,
      to_date: request.to_date,
      broker_type: brokerType,
      credentials_id: credentialsId || 'none',
      timeout: '120 seconds (2 minutes)',
    });

    const params = new URLSearchParams();
    params.append('broker_type', brokerType);
    if (credentialsId) {
      params.append('credentials_id', credentialsId);
    }

    const url = `/api/backtesting/run?${params.toString()}`;
    
    // Use extended timeout for backtesting (120 seconds = 2 minutes)
    // Backtests can take 30-60 seconds for complex multi-timeframe strategies
    const response = await apiClient.post<BacktestResponse>(url, request, {
      timeout: 120000, // 120 seconds (2 minutes)
    });

    logApiCall('Backtest completed', undefined, {
      backtest_id: response.data.backtest_id,
      total_trades: response.data.total_trades,
      data_bars_count: response.data.data_bars_count || 0,
      transactions_count: response.data.transactions?.length || 0,
      total_return: `${response.data.total_return_pct.toFixed(2)}%`,
    });

    return response.data;
  } catch (error: any) {
    logError('Backtest failed', error);
    
    // Handle timeout errors specifically
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      const timeoutError = new Error(
        'Backtest is taking longer than expected (over 2 minutes). ' +
        'This can happen with complex multi-timeframe strategies or large datasets. ' +
        'Please try again or check your network connection.'
      );
      timeoutError.name = 'BacktestTimeoutError';
      throw timeoutError;
    }
    
    // Enhanced error handling
    if (error.response) {
      const errorMsg = error.response.data?.detail || 'Backtest failed';
      
      if (errorMsg.includes('credentials not found') || errorMsg.includes('Broker credentials not found')) {
        throw new Error('Broker credentials not found. Please add your broker API credentials first.');
      } else if (errorMsg.includes('access token not found') || errorMsg.includes('oauth') || errorMsg.includes('OAuth')) {
        throw new Error('Access token not found. Please complete OAuth flow to connect your broker account.');
      } else if (errorMsg.includes('Instrument not found')) {
        throw new Error(`Invalid symbol: ${request.symbol}. Please check the symbol and try again.`);
      } else if (errorMsg.includes('No historical data found') || errorMsg.includes('No historical data')) {
        throw new Error(`No historical data found for ${request.symbol} in the specified date range.`);
      } else {
        throw new Error(errorMsg);
      }
    }
    
    throw error;
  }
}

/**
 * Get backtest history
 * @param limit Maximum number of backtests to return (default: 50)
 * @returns List of backtest history items
 */
export async function getBacktestHistory(limit: number = 50): Promise<BacktestHistoryResponse> {
  try {
    logApiCall('Fetching backtest history', { limit });

    const response = await apiClient.get<BacktestHistoryResponse>(
      `/api/backtesting/history?limit=${limit}`
    );

    logApiCall('Backtest history fetched', undefined, {
      total: response.data.total,
    });

    return response.data;
  } catch (error: any) {
    logError('Failed to fetch backtest history', error);
    throw error;
  }
}

/**
 * Get a specific backtest by ID
 * @param backtestId Backtest ID
 * @returns Backtest history item with full details
 */
export async function getBacktest(backtestId: string): Promise<BacktestHistoryItem> {
  try {
    logApiCall('Fetching backtest', { backtest_id: backtestId });

    const response = await apiClient.get<BacktestHistoryItem>(
      `/api/backtesting/${backtestId}`
    );

    logApiCall('Backtest fetched', undefined, response.data);
    return response.data;
  } catch (error: any) {
    logError('Failed to fetch backtest', error);
    throw error;
  }
}

/**
 * Historical OHLCV data point
 */
export interface HistoricalDataPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Historical data response
 */
export interface HistoricalDataResponse {
  backtest_id: string;
  symbol: string;
  exchange: string;
  interval: string;
  from_date: string;
  to_date: string;
  data_points: HistoricalDataPoint[];
  total_points: number;
  returned_points: number;
}

/**
 * Get historical OHLCV data for a backtest
 * @param backtestId Backtest ID
 * @param limit Maximum number of data points (default: 1000, max: 5000)
 * @param format Response format: "json" or "csv" (default: "json")
 * @param interval Optional: Specific interval to fetch data for (for multi-timeframe backtests)
 * @returns Historical data response
 */
export async function getBacktestHistoricalData(
  backtestId: string,
  limit: number = 1000,
  format: 'json' | 'csv' = 'json',
  interval?: string
): Promise<HistoricalDataResponse> {
  try {
    logApiCall('Fetching historical data', { 
      backtest_id: backtestId,
      limit,
      format,
      interval: interval || 'default'
    });

    const params = new URLSearchParams();
    if (limit) {
      params.append('limit', limit.toString());
    }
    if (format) {
      params.append('format', format);
    }
    if (interval) {
      params.append('interval', interval);
    }

    const url = `/api/backtesting/${backtestId}/data${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get<HistoricalDataResponse>(url);

    logApiCall('Historical data fetched', undefined, {
      total_points: response.data.total_points,
      returned_points: response.data.returned_points,
      data_points_count: response.data.data_points.length,
      interval: response.data.interval,
    });

    return response.data;
  } catch (error: any) {
    logError('Failed to fetch historical data', error);
    throw error;
  }
}

/**
 * Run a quick backtest with minimal parameters
 * 
 * @param strategyCode Strategy code (Python)
 * @param symbol Trading symbol
 * @param fromDate Start date (YYYY-MM-DD)
 * @param toDate End date (YYYY-MM-DD)
 * @param brokerType Broker type (default: "zerodha")
 * @param credentialsId Optional credentials ID to use
 * @returns Backtest results
 */
export async function quickBacktest(
  strategyCode: string,
  symbol: string,
  fromDate: string,
  toDate: string,
  brokerType: string = 'zerodha',
  credentialsId?: string
): Promise<BacktestResponse> {
  const params = new URLSearchParams();
  params.append('broker_type', brokerType);
  if (credentialsId) {
    params.append('credentials_id', credentialsId);
  }

  const url = `/api/backtesting/quick?${params.toString()}`;
  const response = await apiClient.post<BacktestResponse>(url, {
    strategy_code: strategyCode,
    symbol: symbol,
    from_date: fromDate,
    to_date: toDate,
  });
  return response.data;
}

/**
 * Create async backtest job
 * @param request Backtest request parameters
 * @param brokerType Broker type (default: "zerodha")
 * @param credentialsId Optional credentials ID to use
 * @returns Created backtest job
 */
export async function createBacktestJob(
  request: BacktestRequest,
  brokerType: string = 'zerodha',
  credentialsId?: string
): Promise<BacktestJob> {
  try {
    logApiCall('Creating backtest job', {
      symbol: request.symbol,
      exchange: request.exchange,
      from_date: request.from_date,
      to_date: request.to_date,
      intervals: request.intervals || [request.interval || 'day'],
      broker_type: brokerType,
      credentials_id: credentialsId || 'none',
    });

    const params = new URLSearchParams();
    params.append('broker_type', brokerType);
    if (credentialsId) {
      params.append('credentials_id', credentialsId);
    }

    const url = `/api/backtesting/jobs?${params.toString()}`;
    const response = await apiClient.post<BacktestJob>(url, request);

    logApiCall('Backtest job created', undefined, {
      job_id: response.data.job_id,
      status: response.data.status,
    });

    return response.data;
  } catch (error: any) {
    logError('Failed to create backtest job', error);
    throw error;
  }
}

/**
 * Get backtest job status
 * @param jobId Job ID
 * @returns Backtest job with current status
 */
export async function getBacktestJob(jobId: string): Promise<BacktestJob> {
  try {
    logApiCall('Fetching backtest job', { job_id: jobId });

    const response = await apiClient.get<BacktestJob>(
      `/api/backtesting/jobs/${jobId}`
    );

    logApiCall('Backtest job fetched', undefined, {
      job_id: response.data.job_id,
      status: response.data.status,
      progress: response.data.progress,
    });

    return response.data;
  } catch (error: any) {
    logError('Failed to fetch backtest job', error);
    throw error;
  }
}

/**
 * List backtest jobs
 * @param statusFilter Optional status filter
 * @param limit Maximum number of jobs to return (default: 50)
 * @returns List of backtest jobs
 */
export async function listBacktestJobs(
  statusFilter?: BacktestJobStatus,
  limit: number = 50
): Promise<BacktestJob[]> {
  try {
    logApiCall('Listing backtest jobs', { status_filter: statusFilter, limit });

    const params = new URLSearchParams();
    if (statusFilter) {
      params.append('status_filter', statusFilter);
    }
    params.append('limit', limit.toString());

    const url = `/api/backtesting/jobs?${params.toString()}`;
    const response = await apiClient.get<BacktestJob[]>(url);

    logApiCall('Backtest jobs listed', undefined, {
      count: response.data.length,
    });

    return response.data;
  } catch (error: any) {
    logError('Failed to list backtest jobs', error);
    throw error;
  }
}

/**
 * Cancel backtest job
 * @param jobId Job ID
 * @returns Updated backtest job
 */
export async function cancelBacktestJob(jobId: string): Promise<BacktestJob> {
  try {
    logApiCall('Cancelling backtest job', { job_id: jobId });

    const response = await apiClient.post<BacktestJob>(
      `/api/backtesting/jobs/${jobId}/cancel`,
      {}
    );

    logApiCall('Backtest job cancelled', undefined, {
      job_id: response.data.job_id,
      status: response.data.status,
    });

    return response.data;
  } catch (error: any) {
    logError('Failed to cancel backtest job', error);
    throw error;
  }
}

/**
 * Pause backtest job
 * @param jobId Job ID
 * @param reason Optional pause reason
 * @returns Updated backtest job
 */
export async function pauseBacktestJob(
  jobId: string,
  reason?: string
): Promise<BacktestJob> {
  try {
    logApiCall('Pausing backtest job', { job_id: jobId, reason });

    const params = new URLSearchParams();
    if (reason) {
      params.append('reason', reason);
    }

    const url = `/api/backtesting/jobs/${jobId}/pause${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.post<BacktestJob>(url, {});

    logApiCall('Backtest job paused', undefined, {
      job_id: response.data.job_id,
      status: response.data.status,
    });

    return response.data;
  } catch (error: any) {
    logError('Failed to pause backtest job', error);
    throw error;
  }
}

/**
 * Resume backtest job
 * @param jobId Job ID
 * @returns Updated backtest job
 */
export async function resumeBacktestJob(jobId: string): Promise<BacktestJob> {
  try {
    logApiCall('Resuming backtest job', { job_id: jobId });

    const response = await apiClient.post<BacktestJob>(
      `/api/backtesting/jobs/${jobId}/resume`,
      {}
    );

    logApiCall('Backtest job resumed', undefined, {
      job_id: response.data.job_id,
      status: response.data.status,
    });

    return response.data;
  } catch (error: any) {
    logError('Failed to resume backtest job', error);
    throw error;
  }
}

