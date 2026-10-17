'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import StockTradingViewChart from '@/components/stocks/StockTradingViewChart';
import StockTradesHistory from '@/components/stocks/StockTradesHistory';
import { getStockNameMap } from '@/lib/api/datasets';
import { getQuotes } from '@/lib/api/market-data';
import { getPortfolio } from '@/lib/api/portfolio';
import type { Holding } from '@/types';
import {
  ArrowLeftIcon,
  ChartBarIcon,
  ShoppingBagIcon,
  BuildingOffice2Icon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawSymbol = params?.symbol as string;
  const symbol = useMemo(() => {
    if (!rawSymbol) return '';
    return decodeURIComponent(rawSymbol).trim().toUpperCase();
  }, [rawSymbol]);

  const [companyName, setCompanyName] = useState<string>('');
  const [holding, setHolding] = useState<Holding | null>(null);
  const [quote, setQuote] = useState<any | null>(null);
  const [loadingHeader, setLoadingHeader] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'chart' | 'trades'>('all');

  const fetchHeaderDetails = useCallback(async () => {
    if (!symbol) return;
    try {
      setLoadingHeader(true);

      // 1. Fetch Company Name map
      const nameMapPromise = getStockNameMap().catch((): Record<string, string> => ({}));

      // 2. Fetch User Portfolio Holdings
      const portfolioPromise = getPortfolio().catch(() => ({ holdings: [] }));

      // 3. Fetch Quote
      const quotePromise = getQuotes([symbol]).catch((): any => []);

      const [nameMap, portfolioRes, quoteRes]: [Record<string, string>, any, any] = await Promise.all([
        nameMapPromise,
        portfolioPromise,
        quotePromise,
      ]);

      if (nameMap && nameMap[symbol]) {
        setCompanyName(nameMap[symbol]);
      }

      const foundHolding = (portfolioRes?.holdings || []).find(
        (h: Holding) => (h.tradingsymbol || '').toUpperCase() === symbol
      );
      if (foundHolding) {
        setHolding(foundHolding);
        if (foundHolding.stock_name && !nameMap[symbol]) {
          setCompanyName(foundHolding.stock_name);
        }
      }

      if (Array.isArray(quoteRes) && quoteRes.length > 0) {
        setQuote(quoteRes[0]);
      } else if (quoteRes && typeof quoteRes === 'object' && quoteRes[`NSE:${symbol}`]) {
        setQuote(quoteRes[`NSE:${symbol}`]);
      }
    } catch (e) {
      console.warn('Failed to fetch header info for symbol:', e);
    } finally {
      setLoadingHeader(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchHeaderDetails();
  }, [fetchHeaderDetails]);

  // Quote metrics
  const lastPrice = quote?.last_price || holding?.last_price || 0;
  const netChange = quote?.net_change ?? (holding ? holding.last_price - holding.average_price : 0);
  const changePercent = quote?.change_percent ?? (holding ? holding.pnl_percentage : 0);
  const isPositive = netChange >= 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <DashboardNavigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Breadcrumb Navigation & Back Link */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Link
              href="/"
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Home
            </Link>
            <span>/</span>
            <Link
              href="/dashboard/portfolio"
              className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Holdings
            </Link>
            <span>/</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {symbol}
            </span>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-xs"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        {/* Stock Hero Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Identity & Badges */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                <BuildingOffice2Icon className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    {symbol}
                  </h1>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                    NSE
                  </span>
                  {holding && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-profit-subtle text-profit border border-profit">
                      In Portfolio ({holding.quantity} shares)
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                  {companyName || holding?.stock_name || 'National Stock Exchange Equities'}
                </p>
              </div>
            </div>

            {/* Right: Real-time Price & Day Change */}
            <div className="flex flex-wrap items-center gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-100 dark:border-gray-700">
              {lastPrice > 0 && (
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Market Price
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-mono font-bold text-gray-900 dark:text-white">
                      ₹
                      {lastPrice.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold flex items-center ${
                        isPositive ? 'text-profit' : 'text-loss'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      ₹{netChange.toFixed(2)} ({isPositive ? '+' : ''}
                      {changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Holding Specific Metrics */}
              {holding && (
                <div className="flex flex-wrap items-center gap-4 pl-0 lg:pl-6 border-l-0 lg:border-l border-gray-200 dark:border-gray-700">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      Avg Buy Price
                    </span>
                    <span className="text-sm font-mono font-semibold text-gray-900 dark:text-white">
                      ₹{holding.average_price.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                      Holding P&L
                    </span>
                    <span
                      className={`text-sm font-mono font-bold ${
                        holding.pnl >= 0 ? 'text-profit' : 'text-loss'
                      }`}
                    >
                      {holding.pnl >= 0 ? '+' : ''}₹
                      {holding.pnl.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                      {' '}({holding.pnl_percentage >= 0 ? '+' : ''}
                      {holding.pnl_percentage.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span>Overview (All)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'chart'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <ChartBarIcon className="w-4 h-4" />
            <span>TradingView Chart (BigQuery)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trades')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'trades'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <ShoppingBagIcon className="w-4 h-4" />
            <span>Trades History</span>
          </button>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
          {/* Feature 1: TradingView Chart Referencing BigQuery */}
          {(activeTab === 'all' || activeTab === 'chart') && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5 text-blue-500" />
                    <span>TradingView Candlestick Chart</span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Live timeseries data sourced directly from BigQuery cache for data validation across all intervals
                  </p>
                </div>
              </div>

              <StockTradingViewChart
                symbol={symbol}
                companyName={companyName}
                exchange="NSE"
              />
            </section>
          )}

          {/* Feature 2: Trades History from Firestore Transactions */}
          {(activeTab === 'all' || activeTab === 'trades') && (
            <section className="space-y-2">
              <StockTradesHistory symbol={symbol} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
