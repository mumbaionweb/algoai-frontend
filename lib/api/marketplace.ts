import { apiClient } from './client';
import type {
  MarketplaceApiInfo,
  MarketplaceApiStatus,
  MarketplaceApiStatusCreate,
  MarketplaceApiStatusUpdate,
  MarketplaceApiType,
} from '@/types';

/**
 * Get list of available marketplace APIs
 */
export async function getAvailableMarketplaceApis(): Promise<MarketplaceApiInfo[]> {
  const response = await apiClient.get<MarketplaceApiInfo[]>('/api/marketplace/apis');
  return response.data;
}

/**
 * Get all marketplace API statuses for the current user
 */
export async function getMarketplaceApiStatuses(
  apiType?: MarketplaceApiType
): Promise<MarketplaceApiStatus[]> {
  const params = new URLSearchParams();
  if (apiType) {
    params.append('api_type', apiType);
  }

  const response = await apiClient.get<MarketplaceApiStatus[]>(
    `/api/marketplace/status${params.toString() ? `?${params.toString()}` : ''}`
  );
  return response.data;
}

/**
 * Get specific marketplace API status by ID
 */
export async function getMarketplaceApiStatus(statusId: string): Promise<MarketplaceApiStatus> {
  const response = await apiClient.get<MarketplaceApiStatus>(`/api/marketplace/status/${statusId}`);
  return response.data;
}

/**
 * Get marketplace API status by API type
 */
export async function getMarketplaceApiStatusByType(
  apiType: MarketplaceApiType
): Promise<MarketplaceApiStatus | null> {
  const statuses = await getMarketplaceApiStatuses(apiType);
  return statuses.length > 0 ? statuses[0] : null;
}

/**
 * Create or update marketplace API status
 */
export async function upsertMarketplaceApiStatus(
  data: MarketplaceApiStatusCreate
): Promise<MarketplaceApiStatus> {
  const response = await apiClient.post<MarketplaceApiStatus>('/api/marketplace/status', data);
  return response.data;
}

/**
 * Update marketplace API status
 */
export async function updateMarketplaceApiStatus(
  statusId: string,
  data: MarketplaceApiStatusUpdate
): Promise<MarketplaceApiStatus> {
  const response = await apiClient.patch<MarketplaceApiStatus>(
    `/api/marketplace/status/${statusId}`,
    data
  );
  return response.data;
}

/**
 * Enable or disable a marketplace API
 */
export async function toggleMarketplaceApi(
  apiType: MarketplaceApiType,
  isEnabled: boolean,
  credentials?: Record<string, string>
): Promise<MarketplaceApiStatus> {
  // First, try to get existing status
  const existing = await getMarketplaceApiStatusByType(apiType);

  if (existing) {
    // Update existing status
    return updateMarketplaceApiStatus(existing.id, {
      is_enabled: isEnabled,
      ...(credentials && { credentials }),
    });
  } else {
    // Create new status
    return upsertMarketplaceApiStatus({
      api_type: apiType,
      is_enabled: isEnabled,
      ...(credentials && { credentials }),
    });
  }
}

/**
 * Delete marketplace API status
 */
export async function deleteMarketplaceApiStatus(statusId: string): Promise<void> {
  await apiClient.delete(`/api/marketplace/status/${statusId}`);
}

