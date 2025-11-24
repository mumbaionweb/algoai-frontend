import { apiClient } from './client';
import type {
  Strategy,
  StrategyCreate,
  StrategyUpdate,
  StrategyActionResponse,
  StrategyPerformance,
  StrategiesListResponse,
  StrategyParams,
} from '@/types';

/**
 * Get all strategies for the current user
 * @param params Optional parameters (status_filter, limit, offset, sort_by, order)
 * @returns List of strategies with total count
 */
export async function getStrategies(params?: {
  status_filter?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'updated_at' | 'name' | 'status';
  order?: 'asc' | 'desc';
}): Promise<StrategiesListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.status_filter) {
    queryParams.append('status_filter', params.status_filter);
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params?.offset) {
    queryParams.append('offset', params.offset.toString());
  }
  if (params?.sort_by) {
    queryParams.append('sort_by', params.sort_by);
  }
  if (params?.order) {
    queryParams.append('order', params.order);
  }
  const queryString = queryParams.toString();
  const url = `/api/strategies${queryString ? `?${queryString}` : ''}`;

  const response = await apiClient.get<StrategiesListResponse>(url);
  return response.data;
}

/**
 * Get a specific strategy by ID
 * @param strategyId Strategy ID
 * @returns Strategy details
 */
export async function getStrategy(strategyId: string): Promise<Strategy> {
  const response = await apiClient.get<Strategy>(`/api/strategies/${strategyId}`);
  return response.data;
}

/**
 * Create a new strategy
 * @param strategy Strategy creation data
 * @returns Created strategy
 */
export async function createStrategy(strategy: StrategyCreate): Promise<Strategy> {
  const response = await apiClient.post<Strategy>('/api/strategies', strategy);
  return response.data;
}

/**
 * Update an existing strategy
 * @param strategyId Strategy ID
 * @param updates Strategy update data
 * @param autoSave Whether this is an auto-save (default: false)
 * @returns Updated strategy
 */
export async function updateStrategy(
  strategyId: string,
  updates: StrategyUpdate,
  autoSave: boolean = false
): Promise<Strategy> {
  const payload = { ...updates, auto_save: autoSave };
  const response = await apiClient.put<Strategy>(`/api/strategies/${strategyId}`, payload);
  return response.data;
}

/**
 * Delete a strategy
 * @param strategyId Strategy ID
 */
export async function deleteStrategy(strategyId: string): Promise<void> {
  await apiClient.delete(`/api/strategies/${strategyId}`);
}

/**
 * Start a strategy
 * @param strategyId Strategy ID
 * @param brokerType Broker type (default: "zerodha")
 * @param credentialsId Optional credentials ID to use
 * @returns Action response with status
 */
export async function startStrategy(
  strategyId: string,
  brokerType: string = 'zerodha',
  credentialsId?: string
): Promise<StrategyActionResponse> {
  const params = new URLSearchParams();
  params.append('broker_type', brokerType);
  if (credentialsId) {
    params.append('credentials_id', credentialsId);
  }

  const url = `/api/strategies/${strategyId}/start?${params.toString()}`;
  const response = await apiClient.post<StrategyActionResponse>(url);
  return response.data;
}

/**
 * Stop a strategy
 * @param strategyId Strategy ID
 * @returns Action response with status
 */
export async function stopStrategy(strategyId: string): Promise<StrategyActionResponse> {
  const response = await apiClient.post<StrategyActionResponse>(`/api/strategies/${strategyId}/stop`);
  return response.data;
}

/**
 * Pause a strategy
 * @param strategyId Strategy ID
 * @returns Action response with status
 */
export async function pauseStrategy(strategyId: string): Promise<StrategyActionResponse> {
  const response = await apiClient.post<StrategyActionResponse>(`/api/strategies/${strategyId}/pause`);
  return response.data;
}

/**
 * Resume a paused strategy
 * @param strategyId Strategy ID
 * @param brokerType Broker type (default: "zerodha")
 * @param credentialsId Optional credentials ID to use
 * @returns Action response with status
 */
export async function resumeStrategy(
  strategyId: string,
  brokerType: string = 'zerodha',
  credentialsId?: string
): Promise<StrategyActionResponse> {
  const params = new URLSearchParams();
  params.append('broker_type', brokerType);
  if (credentialsId) {
    params.append('credentials_id', credentialsId);
  }

  const url = `/api/strategies/${strategyId}/resume?${params.toString()}`;
  const response = await apiClient.post<StrategyActionResponse>(url);
  return response.data;
}

/**
 * Get strategy performance metrics
 * @param strategyId Strategy ID
 * @returns Performance data
 */
export async function getStrategyPerformance(strategyId: string): Promise<StrategyPerformance> {
  const response = await apiClient.get<StrategyPerformance>(`/api/strategies/${strategyId}/performance`);
  return response.data;
}

