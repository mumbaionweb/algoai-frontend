import { apiClient } from './client';
import type {
  BrokerInfo,
  BrokerCredentials,
  BrokerCredentialsCreate,
  BrokerCredentialsUpdate,
  BrokerType,
  OAuthStatus,
  ZerodhaUserProfile,
} from '@/types';

/**
 * Get list of available brokers
 */
export async function getAvailableBrokers(): Promise<BrokerInfo[]> {
  const response = await apiClient.get<BrokerInfo[]>('/api/broker-credentials/brokers');
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
    `/api/broker-credentials${params.toString() ? `?${params.toString()}` : ''}`
  );
  return response.data;
}

/**
 * Get specific broker credentials by ID
 */
export async function getBrokerCredential(credentialsId: string): Promise<BrokerCredentials> {
  const response = await apiClient.get<BrokerCredentials>(`/api/broker-credentials/${credentialsId}`);
  return response.data;
}

/**
 * Get broker credentials with decrypted secret (use with caution)
 */
export async function getBrokerCredentialFull(credentialsId: string) {
  const response = await apiClient.get(`/api/broker-credentials/${credentialsId}/full`);
  return response.data;
}

/**
 * Create new broker credentials
 */
export async function createBrokerCredentials(
  credentials: BrokerCredentialsCreate
): Promise<BrokerCredentials> {
  const response = await apiClient.post<BrokerCredentials>(
    '/api/broker-credentials',
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
    `/api/broker-credentials/${credentialsId}`,
    updates
  );
  return response.data;
}

/**
 * Delete broker credentials
 */
export async function deleteBrokerCredentials(credentialsId: string): Promise<void> {
  await apiClient.delete(`/api/broker-credentials/${credentialsId}`);
}

/**
 * Initiate Zerodha OAuth flow
 * Returns login_url that user should be redirected to
 * 
 * @param credentialsId Optional credentials ID. If not provided, uses the first Zerodha credential.
 */
export async function initiateZerodhaOAuth(credentialsId?: string): Promise<{
  login_url: string;
  redirect_url: string;
  message: string;
}> {
  // Build query parameters
  const params = new URLSearchParams();
  if (credentialsId) {
    params.append('credentials_id', credentialsId);
  }
  const queryString = params.toString();
  const url = `/api/zerodha/oauth/initiate${queryString ? `?${queryString}` : ''}`;
  
  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development') {
    const token = localStorage.getItem('firebase_token');
    console.log('🔍 initiateZerodhaOAuth called:', {
      url,
      credentialsId,
      hasToken: !!token,
      fullUrl: `${apiClient.defaults.baseURL}${url}`,
    });
  }
  
  const response = await apiClient.get(url);
  return response.data;
}

/**
 * Refresh Zerodha access token
 */
export async function refreshZerodhaToken(): Promise<any> {
  const response = await apiClient.post('/api/zerodha/oauth/refresh');
  return response.data;
}

/**
 * Get OAuth status for Zerodha
 * Returns comprehensive status information about OAuth connection
 * 
 * @param credentialsId Optional credentials ID to check status for
 * @returns OAuth status with is_connected, has_credentials, has_tokens, and user_id
 */
export async function getOAuthStatus(credentialsId?: string): Promise<OAuthStatus> {
  const params = new URLSearchParams();
  if (credentialsId) {
    params.append('credentials_id', credentialsId);
  }
  const queryString = params.toString();
  const url = `/api/zerodha/oauth/status${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiClient.get<OAuthStatus>(url);
  return response.data;
}

/**
 * Check if Zerodha OAuth tokens exist and are valid
 * Returns status information about the OAuth connection
 * 
 * @deprecated Use getOAuthStatus instead for more comprehensive status
 */
export async function checkZerodhaTokenStatus(credentialsId?: string): Promise<{
  has_tokens: boolean;
  is_valid: boolean;
  user_id?: string;
  message?: string;
}> {
  const params = new URLSearchParams();
  if (credentialsId) {
    params.append('credentials_id', credentialsId);
  }
  const queryString = params.toString();
  const url = `/api/zerodha/oauth/status${queryString ? `?${queryString}` : ''}`;
  
  try {
    const response = await apiClient.get(url);
    return response.data;
  } catch (err: any) {
    // If endpoint doesn't exist or returns error, assume no tokens
    if (err.response?.status === 404) {
      return { has_tokens: false, is_valid: false };
    }
    throw err;
  }
}

/**
 * Get Zerodha user profile
 * Returns user information including user_id, name, email, exchanges, products, order types, etc.
 * 
 * @param credentialsId Optional credentials ID to use (if user has multiple Zerodha accounts)
 * @returns Zerodha user profile information
 */
export async function getZerodhaUserProfile(credentialsId?: string): Promise<ZerodhaUserProfile> {
  const params = new URLSearchParams();
  if (credentialsId) {
    params.append('credentials_id', credentialsId);
  }
  const queryString = params.toString();
  const url = `/api/zerodha/user/profile${queryString ? `?${queryString}` : ''}`;
  
  const response = await apiClient.get<ZerodhaUserProfile>(url);
  return response.data;
}

