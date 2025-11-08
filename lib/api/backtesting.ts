import { apiClient } from './client';
import type { BacktestRequest, BacktestResponse } from '@/types';

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
  const params = new URLSearchParams();
  params.append('broker_type', brokerType);
  if (credentialsId) {
    params.append('credentials_id', credentialsId);
  }

  const url = `/api/backtesting/run?${params.toString()}`;
  const response = await apiClient.post<BacktestResponse>(url, request);
  return response.data;
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

