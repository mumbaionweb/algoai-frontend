import { apiClient } from './client';
import type {
  BrokerInfo,
  BrokerCredentials,
  BrokerCredentialsCreate,
  BrokerCredentialsUpdate,
  BrokerType,
  OAuthStatus,
  BrokerUserProfile,
  ZerodhaUserProfile,
  TokenHealthResponse,
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
export async function refreshZerodhaToken(credentialsId?: string): Promise<any> {
  const params = new URLSearchParams();
  if (credentialsId) params.append('credentials_id', credentialsId);
  const queryString = params.toString();
  const url = `/api/zerodha/oauth/refresh${queryString ? `?${queryString}` : ''}`;
  const response = await apiClient.post(url);
  return response.data;
}

/**
 * Get OAuth status for Zerodha
 * Returns comprehensive status information about OAuth connection
 * 
 * @param credentialsId Optional credentials ID to check status for
 * @returns OAuth status with is_connected, has_credentials, has_tokens, and user_id
 */
export function getBrokerRoutePrefix(brokerType?: string): string {
  if (brokerType === 'paytm_money') {
    return 'paytm_money';
  }
  return 'zerodha';
}

/**
 * Unified Broker OAuth Initiation
 */
export async function initiateBrokerOAuth(
  brokerType: string,
  credentialsId?: string
): Promise<{
  login_url: string;
  redirect_url?: string;
  session_id?: string;
  message?: string;
}> {
  const prefix = getBrokerRoutePrefix(brokerType);
  const params = new URLSearchParams();
  if (credentialsId) params.append('credentials_id', credentialsId);
  const queryString = params.toString();
  const url = `/api/${prefix}/oauth/initiate${queryString ? `?${queryString}` : ''}`;
  const response = await apiClient.get(url);
  return response.data;
}

/**
 * Unified Broker OAuth Status Check
 */
export async function getBrokerOAuthStatus(
  brokerType: string,
  credentialsId: string
): Promise<OAuthStatus> {
  const prefix = getBrokerRoutePrefix(brokerType);
  const params = new URLSearchParams();
  params.append('credentials_id', credentialsId);
  const url = `/api/${prefix}/oauth/status?${params.toString()}`;
  const response = await apiClient.get<OAuthStatus>(url);
  return response.data;
}

/**
 * Unified Broker User Profile
 */
export async function getBrokerUserProfile(
  brokerType: string,
  credentialsId: string
): Promise<BrokerUserProfile> {
  const prefix = getBrokerRoutePrefix(brokerType);
  const params = new URLSearchParams();
  params.append('credentials_id', credentialsId);
  const url = `/api/${prefix}/user/profile?${params.toString()}`;
  const response = await apiClient.get<BrokerUserProfile>(url);
  return response.data;
}

/**
 * Unified Broker Token Health Diagnostics
 */
export async function getBrokerTokenHealth(
  brokerType: string,
  credentialsId: string
): Promise<TokenHealthResponse> {
  const prefix = getBrokerRoutePrefix(brokerType);
  const params = new URLSearchParams();
  params.append('credentials_id', credentialsId);
  const url = `/api/${prefix}/oauth/health?${params.toString()}`;
  const response = await apiClient.get<TokenHealthResponse>(url);
  return response.data;
}

/**
 * Refresh Broker Token
 */
export async function refreshBrokerToken(
  brokerType: string,
  credentialsId?: string
): Promise<any> {
  const prefix = getBrokerRoutePrefix(brokerType);
  if (prefix === 'zerodha') {
    return refreshZerodhaToken(credentialsId);
  }
  // For Paytm Money, re-initiate OAuth flow as refresh requires login
  return initiateBrokerOAuth(brokerType, credentialsId);
}

// Backward compatibility wrappers
export async function getOAuthStatus(credentialsId?: string): Promise<OAuthStatus> {
  return getBrokerOAuthStatus('zerodha', credentialsId || '');
}

export async function checkZerodhaTokenStatus(credentialsId?: string): Promise<{
  has_tokens: boolean;
  is_valid: boolean;
  user_id?: string;
  message?: string;
}> {
  const params = new URLSearchParams();
  if (credentialsId) params.append('credentials_id', credentialsId);
  const queryString = params.toString();
  const url = `/api/zerodha/oauth/status${queryString ? `?${queryString}` : ''}`;
  try {
    const response = await apiClient.get(url);
    return response.data;
  } catch (err: any) {
    if (err.response?.status === 404) {
      return { has_tokens: false, is_valid: false };
    }
    throw err;
  }
}

export async function getZerodhaUserProfile(credentialsId?: string): Promise<ZerodhaUserProfile> {
  return getBrokerUserProfile('zerodha', credentialsId || '');
}

export async function getTokenHealth(credentialsId?: string): Promise<TokenHealthResponse> {
  return getBrokerTokenHealth('zerodha', credentialsId || '');
}

export async function initiatePaytmMoneyOAuth(credentialsId?: string) {
  return initiateBrokerOAuth('paytm_money', credentialsId);
}

export async function getPaytmMoneyOAuthStatus(credentialsId: string): Promise<OAuthStatus> {
  return getBrokerOAuthStatus('paytm_money', credentialsId);
}

export async function getPaytmMoneyUserProfile(credentialsId: string): Promise<any> {
  return getBrokerUserProfile('paytm_money', credentialsId);
}

export async function getPaytmMoneyTokenHealth(credentialsId: string): Promise<TokenHealthResponse> {
  return getBrokerTokenHealth('paytm_money', credentialsId);
}
