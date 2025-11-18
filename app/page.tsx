'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getPortfolio } from '@/lib/api/portfolio';
import type { Portfolio } from '@/types';

function HomePageContent() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  // Handle OAuth callback from Zerodha (backend redirects to /?oauth=success)
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
    } else if (isInitialized && isAuthenticated) {
      loadPortfolio();
    }
  }, [isAuthenticated, isInitialized, router]);

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getPortfolio();
      setPortfolio(data);
    } catch (err: any) {
      console.error('Failed to load portfolio:', err);
      console.error('Portfolio error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        config: err.config,
      });
      
      const errorDetail = err.response?.data?.detail || '';
      const status = err.response?.status;

      // Log the full error response for debugging
      if (err.response?.data) {
        console.error('🔴 Portfolio API Error Response:', JSON.stringify(err.response.data, null, 2));
        console.error('Error Detail Field:', errorDetail || 'No detail field');
      }

      // Handle specific errors
      if (status === 400) {
        if (errorDetail.includes('credentials not found') || errorDetail.includes('Zerodha credentials not found')) {
          setError('Please add your Zerodha API credentials first.');
        } else if (errorDetail.includes('Access token not found') || errorDetail.includes('access token')) {
          setError('Please connect your Zerodha account first by completing the OAuth flow.');
        } else if (errorDetail.includes('KiteConnect') || errorDetail.includes('Failed to create')) {
          setError('Failed to connect to Zerodha. Please check your credentials and try again.');
        } else {
          setError(errorDetail || 'Failed to fetch portfolio. Please check your Zerodha connection.');
        }
      } else if (status === 401) {
        setError('Authentication failed. Please log in again.');
      } else if (status === 500) {
        const responseData = err.response?.data as { detail?: string; message?: string; [key: string]: any };
        console.error('🔴 BACKEND 500 ERROR DATA (Portfolio):');
        console.error('Error Response Data:', JSON.stringify(responseData, null, 2));
        console.error('Error Detail Field:', responseData?.detail || 'No detail field');
        setError(responseData?.detail || 'Server error. Please try again later.');
      } else {
        setError(errorDetail || 'Failed to load portfolio. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">Loading portfolio...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
  return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
          {error.includes('credentials') || error.includes('OAuth') ? (
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-400 mb-4">
                {error.includes('credentials') 
                  ? 'You need to add your Zerodha API credentials to view your portfolio.'
                  : 'You need to connect your Zerodha account to view your portfolio.'}
              </p>
            <Link
                href="/dashboard/broker"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded inline-block"
            >
                Go to Broker Settings
            </Link>
            </div>
          ) : (
            <button
              onClick={loadPortfolio}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
            >
              Retry
            </button>
          )}
        </main>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-gray-900">
        <DashboardNavigation />
        <main className="container mx-auto px-4 py-8">
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No portfolio data available.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Portfolio Summary */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Portfolio Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Total Value</p>
                <p className="text-2xl font-bold text-white">₹{portfolio.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Invested Value</p>
                <p className="text-2xl font-bold text-white">₹{portfolio.invested_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className={`bg-gray-700 rounded-lg p-4 ${portfolio.total_pnl >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
                <p className="text-gray-400 text-sm mb-1">Total P&L</p>
                <p className={`text-2xl font-bold ${portfolio.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₹{portfolio.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                  <span className="text-lg ml-2">({portfolio.total_pnl_percentage >= 0 ? '+' : ''}{portfolio.total_pnl_percentage.toFixed(2)}%)</span>
                </p>
              </div>
            </div>

            {/* Margins */}
            {portfolio.margins && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3">Margins</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {portfolio.margins.available !== undefined && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Available</p>
                      <p className="text-xl font-semibold text-white">₹{portfolio.margins.available.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {portfolio.margins.utilised !== undefined && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Utilised</p>
                      <p className="text-xl font-semibold text-white">₹{portfolio.margins.utilised.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  )}
                  {portfolio.margins.net !== undefined && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <p className="text-gray-400 text-sm mb-1">Net</p>
                      <p className="text-xl font-semibold text-white">₹{portfolio.margins.net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Positions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-white">Positions ({portfolio.positions.length})</h2>
              <button
                onClick={loadPortfolio}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Refresh
              </button>
            </div>
            {portfolio.positions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No open positions</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-300 font-semibold">Symbol</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-semibold">Exchange</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-semibold">Product</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Quantity</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Avg Price</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Last Price</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map((pos) => (
                      <tr key={pos.tradingsymbol} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-white font-medium">{pos.tradingsymbol}</td>
                        <td className="py-3 px-4 text-gray-400">{pos.exchange}</td>
                        <td className="py-3 px-4 text-gray-400">{pos.product}</td>
                        <td className="py-3 px-4 text-white text-right">{pos.quantity}</td>
                        <td className="py-3 px-4 text-white text-right">₹{pos.average_price.toFixed(2)}</td>
                        <td className="py-3 px-4 text-white text-right">₹{pos.last_price.toFixed(2)}</td>
                        <td className={`py-3 px-4 text-right font-semibold ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ₹{pos.pnl.toFixed(2)} ({pos.pnl_percentage >= 0 ? '+' : ''}{pos.pnl_percentage.toFixed(2)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Holdings */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-semibold text-white">Holdings ({portfolio.holdings.length})</h2>
              <button
                onClick={loadPortfolio}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Refresh
              </button>
            </div>
            {portfolio.holdings.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No holdings</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-300 font-semibold">Symbol</th>
                      <th className="text-left py-3 px-4 text-gray-300 font-semibold">Exchange</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Quantity</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Avg Price</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Last Price</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.map((holding) => (
                      <tr key={holding.tradingsymbol} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-white font-medium">{holding.tradingsymbol}</td>
                        <td className="py-3 px-4 text-gray-400">{holding.exchange}</td>
                        <td className="py-3 px-4 text-white text-right">{holding.quantity}</td>
                        <td className="py-3 px-4 text-white text-right">₹{holding.average_price.toFixed(2)}</td>
                        <td className="py-3 px-4 text-white text-right">₹{holding.last_price.toFixed(2)}</td>
                        <td className={`py-3 px-4 text-right font-semibold ${holding.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ₹{holding.pnl.toFixed(2)} ({holding.pnl_percentage >= 0 ? '+' : ''}{holding.pnl_percentage.toFixed(2)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
