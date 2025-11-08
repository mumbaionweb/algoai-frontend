import { apiClient } from './client';
import type { BacktestRequest, BacktestResponse, BacktestHistoryResponse, BacktestHistoryItem } from '@/types';

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
    });

    const params = new URLSearchParams();
    params.append('broker_type', brokerType);
    if (credentialsId) {
      params.append('credentials_id', credentialsId);
    }

    const url = `/api/backtesting/run?${params.toString()}`;
    const response = await apiClient.post<BacktestResponse>(url, request);

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

