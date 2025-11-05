import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
      console.log('📤 API Request:', {
        method: config.method?.toUpperCase(),
        url: `${config.baseURL}${config.url}`,
        baseURL: config.baseURL,
        hasToken: !!token,
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
  (error) => {
    // Detailed error logging
    console.error('📥 API Response (Error):', {
      // Request details
      request: {
        method: error.config?.method?.toUpperCase(),
        url: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
        baseURL: error.config?.baseURL,
        fullUrl: error.config?.url,
        data: error.config?.data,
        headers: error.config?.headers,
      },
      // Response details (if available)
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
      } : null,
      // Network/connection errors
      network: error.code || error.message ? {
        code: error.code,
        message: error.message,
        name: error.name,
      } : null,
      // Full error object
      fullError: error,
    });
    
    // Log network errors for debugging
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('❌ Network Error Details:', {
        message: error.message,
        code: error.code,
        baseURL: API_URL,
        url: error.config?.url,
        fullUrl: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
        isBackendReachable: 'Check if backend is running and accessible',
      });
    }
    
    // Log 500 errors with extra details
    if (error.response?.status === 500) {
      // Always log the error data as JSON string for easy reading
      console.error('🔴 BACKEND 500 ERROR DATA (Read this):');
      console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
      console.error('Error Detail Field:', error.response.data?.detail || 'No detail field');
      console.error('Error Message Field:', error.response.data?.message || 'No message field');
      
      console.error('❌ Backend 500 Error - Full Details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        responseData: error.response.data,
        responseHeaders: error.response.headers,
        requestUrl: `${error.config?.baseURL || ''}${error.config?.url || ''}`,
        requestMethod: error.config?.method,
        requestData: error.config?.data,
        requestHeaders: error.config?.headers,
        timestamp: new Date().toISOString(),
      });
    }
    
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      console.warn('⚠️ Unauthorized (401) - Clearing token and redirecting to login');
      localStorage.removeItem('firebase_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;

