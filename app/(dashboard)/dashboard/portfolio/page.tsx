'use client';

import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';

export default function PortfolioPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isInitialized, router]);

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
      <DashboardHeader title="Portfolio" backButton />

      <main className="container mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Portfolio View</h2>
          <p className="text-gray-400 mb-6">This feature is coming soon.</p>
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded inline-block"
          >
            Return to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

