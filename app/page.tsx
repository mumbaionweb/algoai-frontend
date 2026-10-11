'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getPortfolio } from '@/lib/api/portfolio';
import { getBrokerCredentials, getBrokerOAuthStatus } from '@/lib/api/broker';
import type { Portfolio, PortfolioParams } from '@/types';
import { ChevronDown, Check, RefreshCw } from 'lucide-react';

interface BrokerOption {
  id: string; // 'all' or specific credential ID
  brokerType: 'all' | 'zerodha' | 'paytm_money' | string;
  name: string;
  subText?: string;
}

const DEFAULT_ALL_OPTION: BrokerOption = {
  id: 'all',
  brokerType: 'all',
  name: 'All',
};

function HomePageContent() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  // Broker selection dropdown state
  const [brokerOptions, setBrokerOptions] = useState<BrokerOption[]>([DEFAULT_ALL_OPTION]);
  const [selectedOption, setSelectedOption] = useState<BrokerOption>(DEFAULT_ALL_OPTION);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle OAuth callback redirects
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth');
    const broker = searchParams.get('broker');
    const message = searchParams.get('message');

    if (oauthStatus === 'success') {
      router.replace(`/dashboard/broker?oauth=success&broker=${broker || 'zerodha'}`);
    } else if (oauthStatus === 'error') {
      router.replace(`/dashboard/broker?oauth=error&broker=${broker || ''}&message=${encodeURIComponent(message || 'Unknown error')}`);
    }
  }, [searchParams, router]);

  // Auth check and data initialization
  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      initData();
    }
  }, [isAuthenticated, isInitialized, router]);

  const initData = async () => {
    await loadBrokerOptions();
    await loadPortfolio(DEFAULT_ALL_OPTION);
  };

  const loadBrokerOptions = async () => {
    try {
      const creds = await getBrokerCredentials(undefined, false);
      const activeCreds = creds.filter((c) => c.is_active);

      const statusChecks = await Promise.allSettled(
        activeCreds.map(async (cred) => {
          try {
            const status = await getBrokerOAuthStatus(cred.broker_type, cred.id);
            return { cred, isConnected: status.is_connected && status.has_tokens };
          } catch {
            return { cred, isConnected: true };
          }
        })
      );

      const optionsList: BrokerOption[] = [DEFAULT_ALL_OPTION];

      statusChecks.forEach((res) => {
        if (res.status === 'fulfilled' && res.value.isConnected) {
          const { cred } = res.value;
          const isZerodha = cred.broker_type === 'zerodha';
          const isPaytm = cred.broker_type === 'paytm_money';
          const name = isZerodha ? 'Zerodha' : isPaytm ? 'Paytm Money' : cred.broker_type;
          const sub = cred.broker_user_id || cred.zerodha_user_id || cred.label || undefined;

          optionsList.push({
            id: cred.id,
            brokerType: cred.broker_type,
            name,
            subText: sub || undefined,
          });
        }
      });

      setBrokerOptions(optionsList);
    } catch (err) {
      console.warn('Could not load broker credentials list:', err);
      setBrokerOptions([DEFAULT_ALL_OPTION]);
    }
  };

  const loadPortfolio = async (option: BrokerOption = selectedOption, isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      const params: PortfolioParams = {};
      if (option.id === 'all') {
        params.broker_type = 'all';
      } else {
        params.broker_type = option.brokerType;
        params.credentials_id = option.id;
      }

      const data = await getPortfolio(params);
      setPortfolio(data);
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail || '';
      const status = err.response?.status;

      if (status === 400) {
        console.warn('ℹ️ Portfolio notice:', errorDetail);
        setError(errorDetail || 'Please connect your broker account to view portfolio data.');
      } else if (status === 401) {
        setError('Authentication session expired. Please log in again.');
      } else if (status === 503) {
        setError('Broker API is currently unavailable or undergoing maintenance. Please try again later.');
      } else {
        setError(errorDetail || 'Failed to fetch portfolio data. Please check your broker connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSelectBroker = (option: BrokerOption) => {
    setSelectedOption(option);
    setIsDropdownOpen(false);
    loadPortfolio(option, false);
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
          {error.includes('credentials') || error.includes('OAuth') || error.includes('connect') ? (
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-400 mb-4">
                You need to configure and connect your broker account to view your portfolio.
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
              onClick={() => loadPortfolio(selectedOption, false)}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-2xl font-semibold text-white">Portfolio Summary</h2>

              {/* Top Right Controls: Broker Dropdown & Refresh */}
              <div className="flex items-center gap-3">
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 focus:outline-none"
                    aria-expanded={isDropdownOpen}
                  >
                    <span>{selectedOption.name}{selectedOption.subText ? ` (${selectedOption.subText})` : ''}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-lg bg-gray-800 border border-gray-700 shadow-xl p-1 z-50">
                      <div className="px-3 py-1.5 border-b border-gray-700 text-[11px] font-semibold text-gray-400 uppercase">
                        Select Broker
                      </div>
                      <div className="py-1">
                        {brokerOptions.map((opt) => {
                          const isSelected = selectedOption.id === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSelectBroker(opt)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded text-sm text-white hover:bg-gray-700 transition-colors ${
                                isSelected ? 'bg-gray-700 font-medium' : ''
                              }`}
                            >
                              <div className="flex flex-col text-left">
                                <span className="text-white">{opt.name}</span>
                                {opt.subText && (
                                  <span className="text-[11px] text-gray-400">{opt.subText}</span>
                                )}
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => loadPortfolio(selectedOption, true)}
                  disabled={refreshing || loading}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

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
                onClick={() => loadPortfolio(selectedOption, true)}
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
                      {selectedOption.id === 'all' && (
                        <th className="text-left py-3 px-4 text-gray-300 font-semibold">Broker</th>
                      )}
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Quantity</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Avg Price</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Last Price</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map((pos, idx) => (
                      <tr key={`${pos.tradingsymbol}-${pos.product}-${idx}`} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-white font-medium">{pos.tradingsymbol}</td>
                        <td className="py-3 px-4 text-gray-400">{pos.exchange}</td>
                        <td className="py-3 px-4 text-gray-400">{pos.product}</td>
                        {selectedOption.id === 'all' && (
                          <td className="py-3 px-4">
                            {pos.broker ? (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-white">
                                {pos.broker}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        )}
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
                onClick={() => loadPortfolio(selectedOption, true)}
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
                      {selectedOption.id === 'all' && (
                        <th className="text-left py-3 px-4 text-gray-300 font-semibold">Broker</th>
                      )}
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Quantity</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Avg Price</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">Last Price</th>
                      <th className="text-right py-3 px-4 text-gray-300 font-semibold">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.map((holding, idx) => (
                      <tr key={`${holding.tradingsymbol}-${idx}`} className="border-b border-gray-700 hover:bg-gray-700/50">
                        <td className="py-3 px-4 text-white font-medium">{holding.tradingsymbol}</td>
                        <td className="py-3 px-4 text-gray-400">{holding.exchange}</td>
                        {selectedOption.id === 'all' && (
                          <td className="py-3 px-4">
                            {holding.broker ? (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-white">
                                {holding.broker}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                        )}
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
