'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getStoredTransactions } from '@/lib/api/transactions';

export default function OrdersPage() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      loadTransactions();
    }
  }, [isAuthenticated, isInitialized, router]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getStoredTransactions();
      setTransactions(data.transactions || []);
    } catch (err: any) {
      console.error('Failed to load transactions:', err);
      setError(err.message || 'Failed to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionColor = (type: string) => {
    return type?.toLowerCase() === 'buy' ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-orange-600 bg-orange-50 border-orange-200';
  };

  if (!isInitialized) return null;

  return (
    <div className="min-h-screen bg-[#F5F2E8] font-sans">
      <DashboardNavigation />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Transactions History</h1>
          <p className="text-gray-600">Overview of all your executed trades and historical transactions.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Symbol</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Qty</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-right">Total Value</th>
                  <th className="px-6 py-4">Broker / Profile</th>
                  <th className="px-6 py-4">Order ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                      <p>Loading transactions...</p>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No historical transactions found. Upload a tradebook from the Stocks page to get started.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">{tx.trade_date_raw?.split(' ')[0] || '-'}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{tx.symbol}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 border rounded text-xs font-semibold uppercase ${getTransactionColor(tx.trade_type)}`}>
                          {tx.trade_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{tx.quantity}</td>
                      <td className="px-6 py-4 text-right text-gray-900">₹{tx.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">₹{(tx.quantity * tx.price)?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 capitalize text-gray-500">
                        {tx.broker_id || tx.broker || 'Default'} <span className="text-gray-300 mx-1">|</span> {tx.profile_id || 'Default'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-gray-400">{tx.order_id || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && transactions.length > 0 && (
            <div className="bg-gray-50 px-6 py-4 text-sm text-gray-500 border-t border-gray-200">
              Showing {transactions.length} historical transactions
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
