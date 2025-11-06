import axios, { AxiosError, AxiosResponse } from 'axios';

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
  (error: unknown) => {
    // Type guard for AxiosError
    const axiosError = error as AxiosError;
    
    // Detailed error logging
    console.error('📥 API Response (Error):', {
      // Request details
      request: axiosError.config ? {
        method: axiosError.config.method?.toUpperCase(),
        url: `${axiosError.config.baseURL || ''}${axiosError.config.url || ''}`,
        baseURL: axiosError.config.baseURL,
        fullUrl: axiosError.config.url,
        data: axiosError.config.data,
        headers: axiosError.config.headers,
      } : null,
      // Response details (if available)
      response: axiosError.response ? {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        data: axiosError.response.data,
        headers: axiosError.response.headers,
      } : null,
      // Network/connection errors
      network: axiosError.code || axiosError.message ? {
        code: axiosError.code,
        message: axiosError.message,
        name: axiosError.name,
      } : null,
    });
    
    // Log network errors for debugging
    if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
      console.error('❌ Network Error Details:', {
        message: axiosError.message,
        code: axiosError.code,
        baseURL: API_URL,
        url: axiosError.config?.url,
        fullUrl: `${axiosError.config?.baseURL || ''}${axiosError.config?.url || ''}`,
        isBackendReachable: 'Check if backend is running and accessible',
      });
    }
    
    // Log 500 errors with extra details
    if (axiosError.response?.status === 500) {
      // Always log the error data as JSON string for easy reading
      console.error('🔴 BACKEND 500 ERROR DATA (Read this):');
      console.error('Error Response Data:', JSON.stringify(axiosError.response.data, null, 2));
      console.error('Error Detail Field:', axiosError.response.data?.detail || 'No detail field');
      console.error('Error Message Field:', axiosError.response.data?.message || 'No message field');
      
      console.error('❌ Backend 500 Error - Full Details:', {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        responseData: axiosError.response.data,
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

