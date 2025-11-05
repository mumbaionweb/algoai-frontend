'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isAuthenticated, logout } = useAuthStore();
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
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-bold text-white">AlgoAI Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">{user?.email}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

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

