'use client';

import { useState, useEffect, Suspense } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
import { auth } from '@/lib/firebase/config';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getDeviceInfo } from '@/utils/device';

function LoginForm() {
  const searchParams = useSearchParams();
  
  // Smart Flow States
  const [step, setStep] = useState<'identifier' | 'password' | 'otp' | 'forgot-password'>('identifier');
  const [identifier, setIdentifier] = useState(''); // Email or Phone
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  // Firebase Phone Auth State
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();
  const { setUser, setToken } = useAuthStore();

  // Prefill email from query parameter (when coming from registration page)
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setIdentifier(emailParam);
    }
  }, [searchParams]);

  // Handle successful login (common for both email and phone)
  const processSuccessfulAuth = async (userCredential: any) => {
    try {
      setLoadingStep('Getting token...');
      const idToken = await userCredential.user.getIdToken(false);

      const deviceInfo = getDeviceInfo();

      setLoadingStep('Verifying with server...');
      const response = await apiClient.post('/api/auth/login', {
        id_token: idToken,
        device_info: deviceInfo,
      });

      setToken(idToken);
      setUser(response.data.user);

      setLoadingStep('Redirecting...');
      router.push('/');
    } catch (err: any) {
      console.error('❌ Backend verification error:', err);
      throw err; // Caught by the parent try/catch
    }
  };

  // Step 1: Handle Identifier Submission
  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const idValue = identifier.trim();
    if (!idValue) return;

    // Determine if Email or Phone
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(idValue);
    const isPhone = /^\+?[1-9]\d{9,14}$/.test(idValue);

    if (isEmail) {
      setStep('password');
    } else if (isPhone) {
      // Start Phone Auth
      setLoading(true);
      setLoadingStep('Sending OTP...');
      try {
        // Ensure phone starts with + if missing. We default to +91 if no country code was typed and length is 10.
        const phoneToUse = idValue.startsWith('+') ? idValue : (idValue.length === 10 ? `+91${idValue}` : `+${idValue}`);

        if (!window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
          });
        }
        const appVerifier = window.recaptchaVerifier;
        const result = await signInWithPhoneNumber(auth, phoneToUse, appVerifier);
        setConfirmationResult(result);
        setStep('otp');
        setSuccess('OTP sent successfully!');
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to send SMS OTP. Please ensure your number includes the country code (e.g., +91).');
        // Reset recaptcha on error
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = undefined;
        }
      } finally {
        setLoading(false);
      }
    } else {
      setError('Please enter a valid email address or phone number (with country code, e.g. +919876543210).');
    }
  };

  // Step 2a: Handle Email + Password Login
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      setLoadingStep('Authenticating...');
      const userCredential = await signInWithEmailAndPassword(auth, identifier.trim(), password);
      await processSuccessfulAuth(userCredential);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid password. Please try again.');
      } else {
        setError(err.message || 'Login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2b: Handle Phone OTP Login
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    setLoading(true);
    setError('');
    try {
      setLoadingStep('Verifying OTP...');
      const userCredential = await confirmationResult.confirm(otp.trim());
      await processSuccessfulAuth(userCredential);
    } catch (err: any) {
      console.error(err);
      setError('Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    // Only send reset if it's an email
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim());
    if (!isEmail) {
      setError('Please enter a valid email address to reset password.');
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, identifier.trim());
      setSuccess('Password reset email sent! Check your inbox.');
      setStep('identifier');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  // Clean up reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = undefined;
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
      <div id="recaptcha-container"></div>

      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to AlgoAI
          </h2>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-md text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-md text-sm">{success}</div>
        )}

        {/* STEP 1: Identifier (Email or Phone) */}
        {step === 'identifier' && (
          <form className="mt-8 space-y-6" onSubmit={handleIdentifierSubmit}>
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-300">
                Email Address or Phone Number
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 block w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Email or +91XXXXXXXXXX"
              />
              <p className="text-xs text-gray-500 mt-2">
                For phone numbers, include country code (e.g. +91).
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? loadingStep || 'Continuing...' : 'Continue'}
            </button>
          </form>
        )}

        {/* STEP 2a: Password */}
        {step === 'password' && (
          <form className="mt-8 space-y-6" onSubmit={handlePasswordSubmit}>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-300">{identifier}</span>
                <button type="button" onClick={() => setStep('identifier')} className="text-xs text-blue-400 hover:text-blue-300">
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between mt-4">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => { setError(''); setSuccess(''); setStep('forgot-password'); }}
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
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? loadingStep || 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* STEP 2b: Phone OTP */}
        {step === 'otp' && (
          <form className="mt-8 space-y-6" onSubmit={handleOtpSubmit}>
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-gray-300">Code sent to {identifier}</span>
                <button type="button" onClick={() => { setStep('identifier'); setOtp(''); }} className="text-xs text-blue-400 hover:text-blue-300">
                  Change
                </button>
              </div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-300">
                6-Digit OTP
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                required
                autoFocus
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="mt-1 block w-full px-4 py-3 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-xl tracking-[0.5em] font-mono"
                placeholder="XXXXXX"
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? loadingStep || 'Verifying...' : 'Verify & Sign In'}
            </button>
          </form>
        )}

        {/* STEP 3: Forgot Password */}
        {step === 'forgot-password' && (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            <div>
              <p className="text-gray-300 text-sm mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-300">
                Email address
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="mt-1 block w-full px-4 py-2.5 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep('identifier'); setError(''); setSuccess(''); }}
                className="flex-1 py-2 px-4 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Link'}
              </button>
            </div>
          </form>
        )}

        {step === 'identifier' && (
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

