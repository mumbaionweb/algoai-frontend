import axios, { AxiosError, AxiosResponse } from 'axios';

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

// Add auth token interceptor with detailed logging
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('firebase_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Debug: Log request details (only in development)
    if (process.env.NODE_ENV === 'development') {
      const fullUrl = `${config.baseURL || ''}${config.url || ''}`;
      console.log('📤 API Request:', {
        method: config.method?.toUpperCase(),
        url: fullUrl,
        baseURL: config.baseURL,
        endpoint: config.url,
        hasToken: !!token,
        apiUrlUsed: API_URL,
      });
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
      console.error('⏱️ Request Timeout Error:', {
        message: axiosError.message,
        code: axiosError.code,
        baseURL: API_URL,
        url: axiosError.config?.url,
        fullUrl: `${axiosError.config?.baseURL || ''}${axiosError.config?.url || ''}`,
        timeout: '30 seconds',
        suggestion: 'Backend is taking too long to respond. Check backend logs or increase timeout.',
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

