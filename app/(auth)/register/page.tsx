'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, AuthError } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailExists, setEmailExists] = useState(false);
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create user with Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // Register with backend - send ID token and name only
      // Backend will verify token and create Firestore record
      const response = await apiClient.post('/api/auth/register', {
        id_token: idToken,
        name: name,
      });

      // Store token and user
      setToken(idToken);
      // Backend returns { uid, email, name } directly
      setUser({
        id: response.data.uid,
        email: response.data.email,
        name: response.data.name,
        is_active: true,
      });

      // Redirect to home (dashboard)
      router.push('/');
    } catch (err: unknown) {
      console.error('Registration error:', err);
      // Handle Firebase Auth errors
      let errorMessage = 'Registration failed';
      let showEmailExists = false;
      
      // Check if it's a Firebase Auth error
      if (err && typeof err === 'object' && 'code' in err) {
        const firebaseError = err as AuthError;
        switch (firebaseError.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email is already registered.';
            showEmailExists = true;
            setEmailExists(true);
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address. Please check your email.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/Password sign-in is not enabled. Please contact support.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use at least 6 characters.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Network error. Please check your connection.';
            break;
          default:
            errorMessage = firebaseError.message || `Registration failed: ${firebaseError.code}`;
        }
      } else if (err && typeof err === 'object' && 'response' in err) {
        // Axios/API error
        const apiError = err as { response?: { data?: { detail?: string } } };
        errorMessage = apiError.response?.data?.detail || 'Registration failed';
      } else if (err instanceof Error) {
        // Generic Error object
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Create your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          {error && (
            <div className={`p-4 rounded ${emailExists ? 'bg-blue-600' : 'bg-red-500'} text-white`}>
              <div className="font-medium">{error}</div>
              {emailExists && (
                <div className="mt-3 text-sm">
                  <p className="mb-2">This email address is already registered. Would you like to sign in instead?</p>
                  <div className="flex gap-2">
                    <Link
                      href={`/login?email=${encodeURIComponent(email)}`}
                      className="inline-block px-4 py-2 bg-white text-blue-600 rounded hover:bg-gray-100 font-medium transition-colors"
                    >
                      Sign In
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setEmailExists(false);
                        setEmail('');
                        setPassword('');
                        setName('');
                      }}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-400 font-medium transition-colors"
                    >
                      Try Different Email
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Your Name"
              />
            </div>
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Clear email exists error when user changes email
                  if (emailExists) {
                    setEmailExists(false);
                    setError('');
                  }
                }}
                className="mt-1 block w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Email"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
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
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-400">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-blue-400 hover:text-blue-300"
              >
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

