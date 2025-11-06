'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardHeader from '@/components/layout/DashboardHeader';

export default function DashboardPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

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
            href="/dashboard/backtesting"
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

