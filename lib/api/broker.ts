import { apiClient } from './client';
import type {
  BrokerInfo,
  BrokerCredentials,
  BrokerCredentialsCreate,
  BrokerCredentialsUpdate,
  BrokerType,
} from '@/types';

/**
 * Get list of available brokers
 */
export async function getAvailableBrokers(): Promise<BrokerInfo[]> {
  const response = await apiClient.get<BrokerInfo[]>('/broker-credentials/brokers');
  return response.data;
}

/**
 * Get all broker credentials for the current user
 */
export async function getBrokerCredentials(
  brokerType?: BrokerType,
  includeInactive = false
): Promise<BrokerCredentials[]> {
  const params = new URLSearchParams();
  if (brokerType) {
    params.append('broker_type', brokerType);
  }
  if (includeInactive) {
    params.append('include_inactive', 'true');
  }

  const response = await apiClient.get<BrokerCredentials[]>(
    `/broker-credentials${params.toString() ? `?${params.toString()}` : ''}`
  );
  return response.data;
}

/**
 * Get specific broker credentials by ID
 */
export async function getBrokerCredential(credentialsId: string): Promise<BrokerCredentials> {
  const response = await apiClient.get<BrokerCredentials>(`/broker-credentials/${credentialsId}`);
  return response.data;
}

/**
 * Get broker credentials with decrypted secret (use with caution)
 */
export async function getBrokerCredentialFull(credentialsId: string) {
  const response = await apiClient.get(`/broker-credentials/${credentialsId}/full`);
  return response.data;
}

/**
 * Create new broker credentials
 */
export async function createBrokerCredentials(
  credentials: BrokerCredentialsCreate
): Promise<BrokerCredentials> {
  const response = await apiClient.post<BrokerCredentials>(
    '/broker-credentials',
    credentials
  );
  return response.data;
}

/**
 * Update broker credentials
 */
export async function updateBrokerCredentials(
  credentialsId: string,
  updates: BrokerCredentialsUpdate
): Promise<BrokerCredentials> {
  const response = await apiClient.put<BrokerCredentials>(
    `/broker-credentials/${credentialsId}`,
    updates
  );
  return response.data;
}

/**
 * Delete broker credentials
 */
export async function deleteBrokerCredentials(credentialsId: string): Promise<void> {
  await apiClient.delete(`/broker-credentials/${credentialsId}`);
}

/**
 * Initiate Zerodha OAuth flow
 */
export async function initiateZerodhaOAuth(credentialsId?: string): Promise<{ login_url: string }> {
  const params = credentialsId ? `?credentials_id=${credentialsId}` : '';
  const response = await apiClient.get(`/zerodha/oauth/initiate${params}`);
  return response.data;
}

/**
 * Refresh Zerodha access token
 */
export async function refreshZerodhaToken(): Promise<any> {
  const response = await apiClient.post('/zerodha/oauth/refresh');
  return response.data;
}

