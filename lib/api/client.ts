import axios, { AxiosError, AxiosResponse } from 'axios';
import { getOrCreateDeviceId } from '@/utils/device';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';

// Log the API URL being used (only in development)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔧 API Client Configuration:', {
    apiUrl: API_URL,
    envVar: process.env.NEXT_PUBLIC_API_URL || 'not set (using default)',
    isProduction: API_URL.includes('algoai-backend'),
  });
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 second timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token and device ID interceptor with detailed logging
apiClient.interceptors.request.use(
  (config) => {
    // Add authentication token
    const token = localStorage.getItem('firebase_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add device ID header for device tracking
    // Only add if we're in browser environment (not SSR)
    if (typeof window !== 'undefined') {
      const deviceId = getOrCreateDeviceId();
      if (deviceId) {
        config.headers['X-Device-ID'] = deviceId;
      }
    }
    
    // Debug: Log request details (only in development)
    if (process.env.NODE_ENV === 'development') {
      const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
      const deviceId = typeof window !== 'undefined' ? getOrCreateDeviceId() : null;
      
      // Log full request details including headers
      const requestDetails = {
        method: config.method?.toUpperCase(),
        url: fullUrl,
        baseURL: config.baseURL,
        endpoint: config.url,
        hasToken: !!token,
        tokenPreview: token ? token.substring(0, 20) + '...' : 'none',
        hasDeviceId: !!deviceId,
        deviceIdPreview: deviceId ? deviceId.substring(0, 8) + '...' : 'none',
        headers: {
          Authorization: token ? `Bearer ${token.substring(0, 20)}...` : '❌ MISSING',
          'X-Device-ID': deviceId || 'missing',
          'Content-Type': config.headers['Content-Type'] || 'missing',
        },
        allHeaders: Object.keys(config.headers || {}),
        apiUrlUsed: API_URL,
      };
      
      console.log('📤 API Request:', requestDetails);
      
      // For OAuth endpoint, log extra details
      if (config.url?.includes('/zerodha/oauth/initiate')) {
        const authHeader = config.headers.Authorization;
        const authHeaderValue = typeof authHeader === 'string' 
          ? authHeader.substring(0, 30) + '...' 
          : authHeader ? String(authHeader).substring(0, 30) + '...' : 'MISSING';
        
        console.log('🔍 OAuth Request Details:', {
          url: config.url,
          fullUrl: fullUrl,
          hasAuthHeader: !!authHeader,
          authHeaderValue: authHeaderValue,
          allRequestHeaders: config.headers,
        });
      }
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

// Handle response errors with detailed logging
apiClient.interceptors.response.use(
  (response) => {
    // Log successful responses only in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📥 API Response (Success):', {
        status: response.status,
        url: `${response.config.baseURL}${response.config.url}`,
      });
    }
    return response;
  },
  (error: unknown) => {
    // Type guard for AxiosError
    const axiosError = error as AxiosError;
    
    // Detailed error logging (only in development to reduce noise)
    if (process.env.NODE_ENV === 'development') {
      const errorDetails: Record<string, any> = {
        // Always include basic error info
        errorType: error?.constructor?.name || typeof error,
        errorString: String(error),
      };
      
      // Request details
      if (axiosError?.config) {
        errorDetails.request = {
          method: axiosError.config.method?.toUpperCase(),
          url: `${axiosError.config.baseURL || ''}${axiosError.config.url || ''}`,
          baseURL: axiosError.config.baseURL,
          fullUrl: axiosError.config.url,
        };
      }
      
      // Response details (if available)
      if (axiosError?.response) {
        errorDetails.response = {
          status: axiosError.response.status,
          statusText: axiosError.response.statusText,
          data: axiosError.response.data,
        };
      }
      
      // Network/connection errors
      if (axiosError?.code || axiosError?.message) {
        errorDetails.network = {
          code: axiosError.code,
          message: axiosError.message,
          name: axiosError.name,
        };
      }
      
      // Try to extract more info from the error
      if (error instanceof Error) {
        errorDetails.message = error.message;
        errorDetails.stack = error.stack;
        errorDetails.name = error.name;
      }
      
      // Log error details
      try {
        console.error('📥 API Response (Error):', errorDetails);
      } catch (logError) {
        // If logging fails, at least log the basic error
        console.error('📥 API Response (Error - Fallback):', {
          errorType: typeof error,
          errorString: String(error),
          logError: String(logError),
        });
      }
    }
    
    // Log timeout errors
    if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
      const timeoutMs = axiosError.config?.timeout || 30000;
      const timeoutSeconds = timeoutMs / 1000;
      
      console.error('⏱️ Request Timeout Error:', {
        message: axiosError.message,
        code: axiosError.code,
        baseURL: API_URL,
        url: axiosError.config?.url,
        fullUrl: `${axiosError.config?.baseURL || ''}${axiosError.config?.url || ''}`,
        timeout: `${timeoutSeconds} seconds (${timeoutMs}ms)`,
        suggestion: axiosError.config?.url?.includes('/data') 
          ? 'Historical data fetch timed out. This can happen if BigQuery is retrying (up to 30s) or broker API is slow. The request may still succeed - check backend logs.'
          : 'Backend is taking too long to respond. Check backend logs or increase timeout.',
      });
    }
    
    // Log network errors for debugging
    if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
      const fullUrl = `${axiosError.config?.baseURL || API_URL}${axiosError.config?.url || ''}`;
      
      const networkErrorDetails: Record<string, any> = {
        errorType: 'Network Error',
        baseURL: API_URL,
        fullUrl: fullUrl,
        troubleshooting: [
          '1. Check if the backend URL is correct: ' + API_URL,
          '2. Verify the backend service is deployed and running on Cloud Run',
          '3. Check CORS configuration on the backend',
          '4. Try accessing the health endpoint: ' + API_URL + '/health',
          '5. Check network connectivity and firewall settings',
          '6. Verify Cloud Run service is active and accessible'
        ],
        nextSteps: 'Verify backend deployment on Cloud Run or check if NEXT_PUBLIC_API_URL is correctly set',
      };
      
      // Add error details if available
      if (axiosError.message) {
        networkErrorDetails.message = axiosError.message;
      }
      if (axiosError.code) {
        networkErrorDetails.code = axiosError.code;
      }
      if (axiosError.config?.url) {
        networkErrorDetails.endpoint = axiosError.config.url;
      }
      if (axiosError.name) {
        networkErrorDetails.name = axiosError.name;
      }
      
      console.error('❌ Network Error - Cannot connect to backend:', networkErrorDetails);
    }
    
    // Log 500 errors with extra details
    if (axiosError.response?.status === 500) {
      // Type the response data to allow property access
      const responseData = axiosError.response.data as { detail?: string; message?: string; [key: string]: any };
      
      // Always log the error data as JSON string for easy reading
      console.error('🔴 BACKEND 500 ERROR DATA (Read this):');
      console.error('Error Response Data:', JSON.stringify(responseData, null, 2));
      console.error('Error Detail Field:', responseData?.detail || 'No detail field');
      console.error('Error Message Field:', responseData?.message || 'No message field');
      
      console.error('❌ Backend 500 Error - Full Details:', {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        responseData: responseData,
        responseHeaders: axiosError.response.headers,
        requestUrl: `${axiosError.config?.baseURL || ''}${axiosError.config?.url || ''}`,
        requestMethod: axiosError.config?.method,
        requestData: axiosError.config?.data,
        requestHeaders: axiosError.config?.headers,
        timestamp: new Date().toISOString(),
      });
    }
    
    // Log 400 errors with extra details (common for portfolio/API validation errors)
    if (axiosError.response?.status === 400) {
      const responseData = axiosError.response.data as { detail?: string; message?: string; [key: string]: any };
      
      console.error('🔴 BACKEND 400 ERROR (Bad Request):');
      console.error('Error Response Data:', JSON.stringify(responseData, null, 2));
      console.error('Error Detail Field:', responseData?.detail || 'No detail field');
      console.error('Error Message Field:', responseData?.message || 'No message field');
      
      const authHeader = axiosError.config?.headers?.Authorization;
      const authHeaderPreview = (() => {
        if (!authHeader) return 'MISSING';
        if (typeof authHeader === 'string') return authHeader.substring(0, 30) + '...';
        return String(authHeader).substring(0, 30) + '...';
      })();
      
      console.error('❌ Backend 400 Error - Full Details:', {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        responseData: responseData,
        requestUrl: `${axiosError.config?.baseURL || ''}${axiosError.config?.url || ''}`,
        requestMethod: axiosError.config?.method,
        hasAuthHeader: !!authHeader,
        authHeaderPreview: authHeaderPreview,
        timestamp: new Date().toISOString(),
      });
      
      // Special handling for portfolio endpoints
      if (axiosError.config?.url?.includes('/portfolio')) {
        console.error('🔍 Portfolio 400 Error Analysis:', {
          possibleCauses: [
            'Zerodha credentials not found',
            'Access token not found (OAuth not completed)',
            'Failed to create KiteConnect instance',
            'Invalid credentials or token expired',
          ],
          checkAuthHeader: authHeader ? '✅ Present' : '❌ MISSING',
          backendErrorDetail: responseData?.detail || 'No detail from backend',
          suggestion: 'Check if user has added Zerodha credentials and completed OAuth',
        });
      }
    }
    
    // Log 404 errors with extra details (common for OAuth endpoints)
    // Always log 404 errors (not just in development) to help diagnose production issues
    if (axiosError.response?.status === 404) {
      const responseData = axiosError.response.data as { detail?: string; message?: string; [key: string]: any };
      
      console.error('🔴 BACKEND 404 ERROR (Resource Not Found):');
      console.error('Error Response Data:', JSON.stringify(responseData, null, 2));
      console.error('Error Detail Field:', responseData?.detail || 'No detail field');
      console.error('Error Message Field:', responseData?.message || 'No message field');
      
      const authHeader = axiosError.config?.headers?.Authorization;
      const authHeaderPreview = (() => {
        if (!authHeader) return 'MISSING';
        if (typeof authHeader === 'string') return authHeader.substring(0, 30) + '...';
        return String(authHeader).substring(0, 30) + '...';
      })();
      
      console.error('❌ Backend 404 Error - Full Details:', {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        responseData: responseData,
        requestUrl: `${axiosError.config?.baseURL || ''}${axiosError.config?.url || ''}`,
        requestMethod: axiosError.config?.method,
        hasAuthHeader: !!authHeader,
        authHeaderPreview: authHeaderPreview,
        timestamp: new Date().toISOString(),
      });
      
      // Special handling for OAuth endpoints
      if (axiosError.config?.url?.includes('/zerodha/oauth/initiate')) {
        const credentialsId = new URLSearchParams(axiosError.config.url?.split('?')[1] || '').get('credentials_id');
        
        console.error('🔍 OAuth 404 Error Analysis:', {
          possibleCauses: [
            'Missing Authorization header (most likely)',
            'Credentials ID does not exist for this user',
            'Route not registered on backend',
            'Backend dependency (get_current_user) failed',
          ],
          checkAuthHeader: authHeader ? '✅ Present' : '❌ MISSING',
          credentialsId: credentialsId,
          backendErrorDetail: responseData?.detail || 'No detail from backend',
          suggestion: 'Check Network tab → Request Headers → Verify Authorization header is present',
        });
        
        // Additional helpful message
        if (!authHeader) {
          console.error('⚠️ CRITICAL: Authorization header is MISSING!');
          console.error('This is likely the cause of the 404 error.');
          console.error('The backend requires: Authorization: Bearer <firebase_token>');
        } else {
          console.error('✅ Authorization header is present, but still getting 404.');
          console.error('Possible causes:');
          console.error('1. Credentials ID does not exist for this user');
          console.error('2. Backend route not registered');
          console.error('3. Backend error in get_current_user dependency');
          console.error('Backend error detail:', responseData?.detail);
        }
      }
    }
    
    if (axiosError.response?.status === 401) {
      // Handle unauthorized - redirect to login
      console.warn('⚠️ Unauthorized (401) - Clearing token and redirecting to login');
      localStorage.removeItem('firebase_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

