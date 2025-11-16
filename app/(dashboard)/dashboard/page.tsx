'use client';

import { useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';

function DashboardPageContent() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle OAuth callback from Zerodha (backend redirects to /dashboard?oauth=success)
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const broker = searchParams.get('broker');
    const message = searchParams.get('message');

    if (oauthStatus === 'success' && broker === 'zerodha') {
      // Redirect to broker page to show success and updated status
      router.replace('/dashboard/broker?oauth=success&broker=zerodha');
    } else if (oauthStatus === 'error') {
      // Redirect to broker page to show error
      router.replace(`/dashboard/broker?oauth=error&message=${encodeURIComponent(message || 'Unknown error')}`);
    }
  }, [searchParams, router]);

  useEffect(() => {
    // Wait for auth to initialize before checking
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isInitialized, router]);

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardHeader />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/dashboard/strategies"
            className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition"
          >
            <h2 className="text-xl font-semibold text-white mb-2">Strategies</h2>
            <p className="text-gray-400">Manage your trading strategies</p>
          </Link>

          <Link
            href="/dashboard/portfolio"
            className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition"
          >
            <h2 className="text-xl font-semibold text-white mb-2">Portfolio</h2>
            <p className="text-gray-400">View your portfolio and positions</p>
          </Link>

          <Link
            href="/dashboard/orders"
            className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition"
          >
            <h2 className="text-xl font-semibold text-white mb-2">Orders</h2>
            <p className="text-gray-400">View and manage orders</p>
          </Link>

          <Link
            href="/backtesting"
            className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition"
          >
            <h2 className="text-xl font-semibold text-white mb-2">Backtesting</h2>
            <p className="text-gray-400">Test your strategies</p>
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}

