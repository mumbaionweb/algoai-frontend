import { apiClient } from './client';
import type { Portfolio, Position, Holding, PortfolioParams } from '@/types';

/**
 * Get full portfolio summary
 * 
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns Portfolio summary with positions and holdings
 */
export async function getPortfolio(params?: PortfolioParams): Promise<Portfolio> {
  const queryParams = new URLSearchParams();
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/portfolio${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<Portfolio>(url);
  return response.data;
}

/**
 * Get current positions
 * 
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns Array of current positions
 */
export async function getPositions(params?: PortfolioParams): Promise<Position[]> {
  const queryParams = new URLSearchParams();
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/portfolio/positions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<Position[]>(url);
  return response.data;
}

/**
 * Get holdings (CNC)
 * 
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns Array of holdings
 */
export async function getHoldings(params?: PortfolioParams): Promise<Holding[]> {
  const queryParams = new URLSearchParams();
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/portfolio/holdings${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<Holding[]>(url);
  return response.data;
}

/**
 * Get P&L summary
 * 
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns P&L summary
 */
export async function getPnL(params?: PortfolioParams): Promise<{
  total_pnl: number;
  total_pnl_percentage: number;
  day_pnl?: number;
  day_pnl_percentage?: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/portfolio/pnl${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get(url);
  return response.data;
}

/**
 * Get margin information
 * 
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns Margin information
 */
export async function getMargins(params?: PortfolioParams): Promise<{
  available?: number;
  utilised?: number;
  net?: number;
  equity?: number;
  commodity?: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/portfolio/margins${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get(url);
  return response.data;
}

