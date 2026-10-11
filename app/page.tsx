'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getPortfolio } from '@/lib/api/portfolio';
import { getBrokerCredentials, getBrokerOAuthStatus } from '@/lib/api/broker';
import type { Portfolio, PortfolioParams } from '@/types';
import {
  ChevronDown,
  Check,
  Layers,
  RefreshCw,
  Wallet,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface BrokerOption {
  id: string; // 'all' or specific credential ID
  brokerType: 'all' | 'zerodha' | 'paytm_money' | string;
  name: string;
  subText?: string;
  badge?: string;
  iconType: 'all' | 'zerodha' | 'paytm_money' | 'other';
}

const DEFAULT_ALL_OPTION: BrokerOption = {
  id: 'all',
  brokerType: 'all',
  name: 'All Brokers',
  subText: 'Consolidated View',
  badge: 'Combined',
  iconType: 'all',
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
            subText: sub ? `Account: ${sub}` : undefined,
            badge: 'Connected',
            iconType: isZerodha ? 'zerodha' : isPaytm ? 'paytm_money' : 'other',
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
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <DashboardNavigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header Row with Title and Top-Right Broker Selector Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-800">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Portfolio Dashboard
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Real-time performance and asset allocation across trading accounts
              </p>
            </div>

            {/* Top Right Controls: Broker Dropdown & Refresh Button */}
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-3 px-4 py-2.5 bg-gray-800/90 hover:bg-gray-700/80 text-white rounded-xl border border-gray-700/80 shadow-lg backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  aria-expanded={isDropdownOpen}
                >
                  <div className="flex items-center gap-2.5">
                    {selectedOption.iconType === 'all' && (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-sm">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                    )}
                    {selectedOption.iconType === 'zerodha' && (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-sm font-bold text-xs">
                        Z
                      </div>
                    )}
                    {selectedOption.iconType === 'paytm_money' && (
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-sm font-bold text-xs">
                        P
                      </div>
                    )}
                    {selectedOption.iconType === 'other' && (
                      <div className="w-6 h-6 rounded-lg bg-gray-600 flex items-center justify-center text-white shadow-sm">
                        <Wallet className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold text-gray-100 leading-tight">
                        {selectedOption.name}
                      </span>
                      {selectedOption.subText && (
                        <span className="text-[11px] text-gray-400 font-mono leading-tight">
                          {selectedOption.subText}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ml-1.5 ${
                      isDropdownOpen ? 'rotate-180 text-blue-400' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl bg-gray-800/95 backdrop-blur-xl border border-gray-700/80 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-2 border-b border-gray-700/50 mb-1 flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        Filter by Account
                      </p>
                      <Link
                        href="/dashboard/broker"
                        className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                      >
                        Manage <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    <div className="space-y-1">
                      {brokerOptions.map((option) => {
                        const isSelected = selectedOption.id === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleSelectBroker(option)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                              isSelected
                                ? 'bg-blue-600/20 text-white border border-blue-500/30 font-medium'
                                : 'text-gray-300 hover:bg-gray-700/60 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {option.iconType === 'all' && (
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                                  <Layers className="w-4 h-4" />
                                </div>
                              )}
                              {option.iconType === 'zerodha' && (
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm font-bold text-xs">
                                  Z
                                </div>
                              )}
                              {option.iconType === 'paytm_money' && (
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm font-bold text-xs">
                                  P
                                </div>
                              )}
                              {option.iconType === 'other' && (
                                <div className="w-7 h-7 rounded-lg bg-gray-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                                  <Wallet className="w-4 h-4" />
                                </div>
                              )}
                              <div className="flex flex-col text-left">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-gray-100">{option.name}</span>
                                  {option.badge && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                        option.badge === 'Combined'
                                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      }`}
                                    >
                                      {option.badge}
                                    </span>
                                  )}
                                </div>
                                {option.subText && (
                                  <span className="text-[11px] text-gray-400 font-mono">
                                    {option.subText}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => loadPortfolio(selectedOption, true)}
                disabled={refreshing || loading}
                className="flex items-center justify-center p-2.5 bg-gray-800/90 hover:bg-gray-700/80 text-gray-300 hover:text-white rounded-xl border border-gray-700/80 shadow-lg backdrop-blur-md transition-all duration-200 disabled:opacity-50"
                title="Refresh portfolio data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700/50">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
              <p className="text-gray-300 font-medium">Fetching portfolio data from {selectedOption.name}...</p>
              <p className="text-gray-500 text-xs mt-1">Connecting to broker APIs</p>
            </div>
          )}

          {/* Error Banner */}
          {!loading && error && (
            <div className="bg-gray-800 rounded-xl p-6 border border-red-500/30 bg-red-950/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-red-400 font-semibold text-lg flex items-center gap-2">
                    Unable to load portfolio
                  </h3>
                  <p className="text-gray-300 text-sm mt-1">{error}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => loadPortfolio(selectedOption, false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                  <Link
                    href="/dashboard/broker"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Broker Settings
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && !portfolio && (
            <div className="bg-gray-800 rounded-xl p-8 text-center border border-gray-700">
              <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-300 font-medium text-lg">No portfolio data available</p>
              <p className="text-gray-500 text-sm mt-1">
                Make sure your broker account is connected and has active holdings or positions.
              </p>
              <Link
                href="/dashboard/broker"
                className="mt-4 inline-block bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Go to Broker Settings
              </Link>
            </div>
          )}

          {/* Main Portfolio Content */}
          {!loading && !error && portfolio && (
            <>
              {/* Portfolio Summary Card */}
              <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-700/80 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      Portfolio Summary
                    </h2>
                    <span className="text-xs text-gray-400">
                      Scope: {selectedOption.name}
                    </span>
                  </div>

                  {portfolio.brokers && portfolio.brokers.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        Active Sources:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {portfolio.brokers.map((brokerName) => {
                          const isZero = brokerName.toLowerCase().includes('zerodha');
                          const isPay = brokerName.toLowerCase().includes('paytm');
                          return (
                            <span
                              key={brokerName}
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                                isZero
                                  ? 'bg-orange-500/10 text-orange-300 border-orange-500/30'
                                  : isPay
                                  ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                  : 'bg-gray-700 text-gray-300 border-gray-600'
                              }`}
                            >
                              {brokerName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Main Metrics 3-Card Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-700/60 rounded-xl p-5 border border-gray-600/40">
                    <p className="text-gray-400 text-xs uppercase font-medium tracking-wider mb-1">
                      Total Portfolio Value
                    </p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-white">
                      ₹{portfolio.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="bg-gray-700/60 rounded-xl p-5 border border-gray-600/40">
                    <p className="text-gray-400 text-xs uppercase font-medium tracking-wider mb-1">
                      Invested Capital
                    </p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-white">
                      ₹{portfolio.invested_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div
                    className={`bg-gray-700/60 rounded-xl p-5 border ${
                      portfolio.total_pnl >= 0
                        ? 'border-emerald-500/40 bg-emerald-950/10'
                        : 'border-rose-500/40 bg-rose-950/10'
                    }`}
                  >
                    <p className="text-gray-400 text-xs uppercase font-medium tracking-wider mb-1">
                      Total Profit / Loss
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p
                        className={`text-2xl sm:text-3xl font-extrabold flex items-center gap-1.5 ${
                          portfolio.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {portfolio.total_pnl >= 0 ? (
                          <TrendingUp className="w-6 h-6 shrink-0" />
                        ) : (
                          <TrendingDown className="w-6 h-6 shrink-0" />
                        )}
                        ₹{portfolio.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span
                        className={`text-sm font-semibold ${
                          portfolio.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        ({portfolio.total_pnl_percentage >= 0 ? '+' : ''}
                        {portfolio.total_pnl_percentage.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Margins Row */}
                {portfolio.margins && (
                  <div className="mt-6 pt-5 border-t border-gray-700/60">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-blue-400" />
                      Margin & Funds
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {portfolio.margins.available !== undefined && (
                        <div className="bg-gray-700/40 rounded-lg p-3.5 border border-gray-600/30">
                          <p className="text-gray-400 text-xs mb-1">Available Cash</p>
                          <p className="text-lg font-bold text-white">
                            ₹{portfolio.margins.available.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      {portfolio.margins.utilised !== undefined && (
                        <div className="bg-gray-700/40 rounded-lg p-3.5 border border-gray-600/30">
                          <p className="text-gray-400 text-xs mb-1">Utilised Margin</p>
                          <p className="text-lg font-bold text-white">
                            ₹{portfolio.margins.utilised.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      {portfolio.margins.net !== undefined && (
                        <div className="bg-gray-700/40 rounded-lg p-3.5 border border-gray-600/30">
                          <p className="text-gray-400 text-xs mb-1">Net Balance</p>
                          <p className="text-lg font-bold text-white">
                            ₹{portfolio.margins.net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Open Positions Card */}
              <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-700/80 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Positions ({portfolio.positions.length})
                    </h2>
                    <p className="text-xs text-gray-400">Intraday & derivative open trades</p>
                  </div>
                </div>

                {portfolio.positions.length === 0 ? (
                  <div className="text-center py-10 bg-gray-900/30 rounded-lg border border-gray-800">
                    <p className="text-gray-400 text-sm">No open positions found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-400">
                          <th className="text-left py-3 px-4">Symbol</th>
                          <th className="text-left py-3 px-4">Exchange</th>
                          <th className="text-left py-3 px-4">Product</th>
                          {selectedOption.id === 'all' && (
                            <th className="text-left py-3 px-4">Broker</th>
                          )}
                          <th className="text-right py-3 px-4">Qty</th>
                          <th className="text-right py-3 px-4">Avg Price</th>
                          <th className="text-right py-3 px-4">Last Price</th>
                          <th className="text-right py-3 px-4">P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/60">
                        {portfolio.positions.map((pos, idx) => {
                          const isZero = (pos.broker || '').toLowerCase().includes('zerodha');
                          const isPay = (pos.broker || '').toLowerCase().includes('paytm');
                          return (
                            <tr
                              key={`${pos.tradingsymbol}-${pos.product}-${idx}`}
                              className="hover:bg-gray-700/40 transition-colors"
                            >
                              <td className="py-3 px-4 font-semibold text-white">
                                {pos.tradingsymbol}
                              </td>
                              <td className="py-3 px-4 text-gray-400 font-mono text-xs">{pos.exchange}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-xs font-mono bg-gray-700 text-gray-300">
                                  {pos.product}
                                </span>
                              </td>
                              {selectedOption.id === 'all' && (
                                <td className="py-3 px-4">
                                  {pos.broker ? (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                        isZero
                                          ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                                          : isPay
                                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                          : 'bg-gray-700 text-gray-300 border-gray-600'
                                      }`}
                                    >
                                      {pos.broker}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">-</span>
                                  )}
                                </td>
                              )}
                              <td className="py-3 px-4 text-right font-mono font-medium text-white">
                                {pos.quantity}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-gray-300">
                                ₹{pos.average_price.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-white font-medium">
                                ₹{pos.last_price.toFixed(2)}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-bold ${
                                  pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                ₹{pos.pnl.toFixed(2)}{' '}
                                <span className="text-xs font-normal">
                                  ({pos.pnl_percentage >= 0 ? '+' : ''}
                                  {pos.pnl_percentage.toFixed(2)}%)
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Holdings Card */}
              <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border border-gray-700/80 shadow-lg">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Holdings ({portfolio.holdings.length})
                    </h2>
                    <p className="text-xs text-gray-400">Equity delivery investments (CNC)</p>
                  </div>
                </div>

                {portfolio.holdings.length === 0 ? (
                  <div className="text-center py-10 bg-gray-900/30 rounded-lg border border-gray-800">
                    <p className="text-gray-400 text-sm">No equity holdings found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700 text-xs font-semibold uppercase tracking-wider text-gray-400">
                          <th className="text-left py-3 px-4">Symbol</th>
                          <th className="text-left py-3 px-4">Exchange</th>
                          {selectedOption.id === 'all' && (
                            <th className="text-left py-3 px-4">Broker</th>
                          )}
                          <th className="text-right py-3 px-4">Quantity</th>
                          <th className="text-right py-3 px-4">Avg Cost</th>
                          <th className="text-right py-3 px-4">Current Price</th>
                          <th className="text-right py-3 px-4">P&L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700/60">
                        {portfolio.holdings.map((holding, idx) => {
                          const isZero = (holding.broker || '').toLowerCase().includes('zerodha');
                          const isPay = (holding.broker || '').toLowerCase().includes('paytm');
                          return (
                            <tr
                              key={`${holding.tradingsymbol}-${idx}`}
                              className="hover:bg-gray-700/40 transition-colors"
                            >
                              <td className="py-3 px-4 font-semibold text-white">
                                {holding.tradingsymbol}
                              </td>
                              <td className="py-3 px-4 text-gray-400 font-mono text-xs">
                                {holding.exchange}
                              </td>
                              {selectedOption.id === 'all' && (
                                <td className="py-3 px-4">
                                  {holding.broker ? (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                        isZero
                                          ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                                          : isPay
                                          ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                                          : 'bg-gray-700 text-gray-300 border-gray-600'
                                      }`}
                                    >
                                      {holding.broker}
                                    </span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">-</span>
                                  )}
                                </td>
                              )}
                              <td className="py-3 px-4 text-right font-mono font-medium text-white">
                                {holding.quantity}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-gray-300">
                                ₹{holding.average_price.toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-white font-medium">
                                ₹{holding.last_price.toFixed(2)}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-bold ${
                                  holding.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                ₹{holding.pnl.toFixed(2)}{' '}
                                <span className="text-xs font-normal">
                                  ({holding.pnl_percentage >= 0 ? '+' : ''}
                                  {holding.pnl_percentage.toFixed(2)}%)
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
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
