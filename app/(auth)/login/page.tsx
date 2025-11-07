'use client';

import { useState, useEffect, Suspense } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();

  // Prefill email from query parameter (when coming from registration page)
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Sign in with Firebase
      setLoadingStep('Authenticating...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Get ID token (use cached token if available to reduce API calls)
      setLoadingStep('Getting token...');
      const idToken = await userCredential.user.getIdToken(false);

      // Verify with backend
      setLoadingStep('Verifying with server...');
      const response = await apiClient.post('/api/auth/login', {
        id_token: idToken,
      });

      // Store token and user
      setToken(idToken);
      setUser(response.data.user);

      // Redirect to home (dashboard)
      setLoadingStep('Redirecting...');
      router.push('/');
    } catch (err: unknown) {
      console.error('❌ Login error:', err);
      
      // Log detailed error information
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { status?: number; data?: any; statusText?: string } };
        console.error('❌ Backend error details:', {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
        });
      }
      
      // Check for network errors first (Axios network errors)
      if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'ERR_NETWORK') {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
        setError(`Cannot connect to backend server at ${apiUrl}. The server may be down or unreachable. Check the console for more details.`);
        setLoading(false);
        return;
      }
      
      let errorMessage = 'Login failed';
      
      // Handle Firebase Auth errors
      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as { code: string; message: string };
        switch (firebaseError.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email. Please sign up first.';
            break;
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Invalid email or password. Please try again.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address. Please check your email.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection.';
            break;
          default:
            errorMessage = firebaseError.message || `Login failed: ${firebaseError.code}`;
        }
      } else if (err && typeof err === 'object' && 'response' in err) {
        // API error - Enhanced debugging
        const apiError = err as { 
          response?: { 
            status?: number; 
            data?: any; 
            statusText?: string;
            headers?: any;
          };
          config?: {
            url?: string;
            method?: string;
            baseURL?: string;
            data?: any;
            headers?: any;
          };
          code?: string;
          message?: string;
        };
        const status = apiError.response?.status;
        const detail = apiError.response?.data?.detail;
        const statusText = apiError.response?.statusText;
        
        // Always log the error data in a readable format
        console.error('🔴 BACKEND ERROR DATA (Expand this to see details):');
        console.error('Error Response Data:', JSON.stringify(apiError.response?.data, null, 2));
        console.error('Error Detail:', detail || 'No detail field found');
        console.error('Error Message:', apiError.response?.data?.message || 'No message field found');
        console.error('Full Error Response:', apiError.response?.data);
        
        console.error('❌ Backend API Error - Full Debug Info:', {
          // Request details
          request: {
            method: apiError.config?.method,
            url: apiError.config?.url,
            baseURL: apiError.config?.baseURL,
            fullUrl: `${apiError.config?.baseURL || ''}${apiError.config?.url || ''}`,
            data: apiError.config?.data,
            headers: apiError.config?.headers,
          },
          // Response details
          response: {
            status,
            statusText,
            data: apiError.response?.data,
            headers: apiError.response?.headers,
          },
          // Error details
          error: {
            code: apiError.code,
            message: apiError.message,
            detail: detail,
          },
          // Full error object
          fullError: apiError,
        });
        
        // Specific handling for 500 errors
        if (status === 500) {
          console.error('🔍 Step 3 Debug - 500 Error Analysis:', {
            backendUrl: `${apiError.config?.baseURL || ''}${apiError.config?.url || ''}`,
            requestPayload: apiError.config?.data,
            responseData: apiError.response?.data,
            possibleCauses: [
              'Backend server error - check backend logs',
              'Firebase Admin SDK not initialized',
              'Database connection issue',
              'Token verification failing',
              'Missing environment variables on backend',
            ],
          });
        }
        
        if (status === 404) {
          errorMessage = 'User not found. Please register first.';
        } else if (status === 401) {
          errorMessage = 'Invalid credentials. Please check your email and password.';
        } else if (status === 500) {
          // Check if it's the database name issue
          if (detail && detail.includes('database (default) does not exist')) {
            errorMessage = 'Backend database configuration error. The backend is trying to use the wrong database name. Backend team needs to fix: use database "algoai" instead of "default".';
            console.error('🔴 CRITICAL: Backend database configuration error');
            console.error('Error:', detail);
            console.error('Fix Required: Backend must use database="algoai" instead of default');
          } else {
            errorMessage = detail || 'Server error. Please check backend logs for details.';
          }
        } else {
          errorMessage = detail || statusText || 'Login failed';
        }
      } else if (err && typeof err === 'object' && 'code' in err) {
        const errorCode = (err as any).code;
        
        // Timeout error
        if (errorCode === 'ECONNABORTED' || (err as any).message?.includes('timeout')) {
          errorMessage = 'Login request timed out. The backend is taking too long to respond (>30 seconds). This is likely a backend performance issue. Please contact support or try again later.';
          console.error('⏱️ Timeout Error - Backend taking >30 seconds to respond');
          console.error('Backend Issue - Action Items:', {
            backendUrl: process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app',
            endpoint: '/api/auth/login',
            timeout: '30 seconds',
            issue: 'Backend is not responding in time',
            possibleCauses: [
              'Slow Firestore database queries',
              'Firestore database connection issues',
              'Inefficient token verification',
              'Backend code hanging or blocking',
              'Missing Firestore indexes',
              'Database name mismatch (should be "algoai")',
            ],
            actionRequired: 'Backend team needs to investigate and optimize login endpoint performance',
          });
        }
        // Network error - server might not be running
        else if (errorCode === 'ERR_NETWORK' || (err as any).message === 'Network Error') {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
          errorMessage = `Cannot connect to backend server at ${apiUrl}. The server may be down or unreachable. Check the console for more details.`;
          
          console.error('❌ Network Error - Backend server might not be running');
          console.error('Check:', {
            apiUrl: apiUrl,
            error: err
          });
        } else {
          errorMessage = (err as any).message || 'Login failed';
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      console.error('❌ Final error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address');
      setResetLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Password reset email sent! Check your inbox.');
      setShowForgotPassword(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to AlgoAI
          </h2>
        </div>
        {showForgotPassword ? (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            {error && (
              <div className="bg-red-500 text-white p-3 rounded text-sm">{error}</div>
            )}
            {success && (
              <div className="bg-green-500 text-white p-3 rounded text-sm">{success}</div>
            )}
            <div>
              <p className="text-gray-300 text-sm mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-300">
                  Email address
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Email"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="flex-1 py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-500 text-white p-3 rounded text-sm">{error}</div>
            )}
            {success && (
              <div className="bg-green-500 text-white p-3 rounded text-sm">{success}</div>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Email"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-blue-400 hover:text-blue-300"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading && (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? loadingStep || 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-400">
                Don't have an account?{' '}
                <Link
                  href="/register"
                  className="font-medium text-blue-400 hover:text-blue-300"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

