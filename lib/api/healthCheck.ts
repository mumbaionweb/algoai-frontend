/**
 * Backend Health Check Utility
 * Tests if the backend is reachable and responding
 */

import { apiClient } from './client';

export interface HealthCheckResult {
  success: boolean;
  status?: number;
  message?: string;
  error?: any;
  backendUrl?: string;
  timestamp?: string;
}

/**
 * Test backend connectivity
 */
export async function checkBackendHealth(): Promise<HealthCheckResult> {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  
  console.log('🏥 Backend Health Check:', {
    backendUrl,
    timestamp: new Date().toISOString(),
  });

  try {
    // Try to reach the backend root endpoint
    const response = await apiClient.get('/');
    
    console.log('✅ Backend Health Check - Success:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers,
    });

    return {
      success: true,
      status: response.status,
      message: 'Backend is reachable and responding',
      backendUrl,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('❌ Backend Health Check - Failed:', {
      error,
      backendUrl,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      networkError: error.code === 'ERR_NETWORK' || error.message === 'Network Error',
    });

    return {
      success: false,
      status: error.response?.status,
      message: error.response?.data?.message || error.message || 'Backend is not reachable',
      error: {
        code: error.code,
        message: error.message,
        response: error.response?.data,
      },
      backendUrl,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Test backend auth endpoint (without credentials)
 */
export async function checkAuthEndpoint(): Promise<HealthCheckResult> {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  
  console.log('🔐 Backend Auth Endpoint Check:', {
    backendUrl,
    endpoint: '/api/auth/login',
    timestamp: new Date().toISOString(),
  });

  try {
    // Try to reach the auth endpoint (will fail but confirms endpoint exists)
    const response = await apiClient.post('/api/auth/login', {
      id_token: 'test-token',
    });
    
    return {
      success: true,
      status: response.status,
      message: 'Auth endpoint is reachable',
      backendUrl: `${backendUrl}/api/auth/login`,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    // Even if it fails, check if it's a 400/401 (endpoint exists) vs 404/500
    const status = error.response?.status;
    
    if (status === 400 || status === 401) {
      // Endpoint exists but rejected invalid token - this is expected
      console.log('✅ Auth Endpoint Check - Endpoint exists (rejected invalid token as expected)');
      return {
        success: true,
        status,
        message: 'Auth endpoint exists and is responding',
        backendUrl: `${backendUrl}/api/auth/login`,
        timestamp: new Date().toISOString(),
      };
    }
    
    if (status === 404) {
      console.error('❌ Auth Endpoint Check - Endpoint not found (404)');
      return {
        success: false,
        status: 404,
        message: 'Auth endpoint not found - check backend routes',
        backendUrl: `${backendUrl}/api/auth/login`,
        timestamp: new Date().toISOString(),
      };
    }
    
    if (status === 500) {
      console.error('❌ Auth Endpoint Check - Backend error (500)');
      return {
        success: false,
        status: 500,
        message: 'Backend server error - check backend logs',
        error: error.response?.data,
        backendUrl: `${backendUrl}/api/auth/login`,
        timestamp: new Date().toISOString(),
      };
    }

    console.error('❌ Auth Endpoint Check - Unknown error:', error);
    return {
      success: false,
      status,
      message: error.message || 'Unknown error',
      error,
      backendUrl: `${backendUrl}/api/auth/login`,
      timestamp: new Date().toISOString(),
    };
  }
}

