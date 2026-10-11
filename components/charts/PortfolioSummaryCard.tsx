'use client';

import { useState, useRef, useEffect } from 'react';
import type { Portfolio } from '@/types';
import { ChevronDown, Check, RefreshCw, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface BrokerOption {
  id: string;
  brokerType: 'all' | 'zerodha' | 'paytm_money' | string;
  name: string;
  subText?: string;
}

interface PortfolioSummaryCardProps {
  portfolio: Portfolio;
  selectedOption: BrokerOption;
  brokerOptions: BrokerOption[];
  onSelectBroker: (opt: BrokerOption) => void;
  onRefresh: () => void;
  refreshing: boolean;
  loading: boolean;
}

export default function PortfolioSummaryCard({
  portfolio,
  selectedOption,
  brokerOptions,
  onSelectBroker,
  onRefresh,
  refreshing,
  loading,
}: PortfolioSummaryCardProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isProfit = portfolio.total_pnl >= 0;

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/60 shadow-lg flex flex-col justify-between h-full">
      {/* Top Header: Title & Broker Selector */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-gray-700/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">
              Portfolio Summary
            </h3>
            <p className="text-[11px] text-gray-400">
              Aggregated Overview
            </p>
          </div>
        </div>

        {/* Broker Dropdown & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors focus:outline-none"
              aria-expanded={isDropdownOpen}
            >
              <span>{selectedOption.name}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-lg bg-gray-800 border border-gray-700 shadow-xl p-1 z-50">
                <div className="px-3 py-1.5 border-b border-gray-700 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  Select Broker
                </div>
                <div className="py-1">
                  {brokerOptions.map((opt) => {
                    const isSelected = selectedOption.id === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          onSelectBroker(opt);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs text-white hover:bg-gray-700 transition-colors ${
                          isSelected ? 'bg-gray-700 font-semibold' : ''
                        }`}
                      >
                        <div className="flex flex-col text-left">
                          <span className="text-white">{opt.name}</span>
                          {opt.subText && (
                            <span className="text-[10px] text-gray-400">
                              {opt.subText}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || loading}
            className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs disabled:opacity-50 transition-colors"
            title="Refresh Portfolio"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 3 Metrics Stacked Inside the Single Widget */}
      <div className="space-y-3.5 py-3">
        {/* Metric 1: Total Value */}
        <div className="p-3 rounded-lg bg-gray-700/40 border border-gray-700/50 hover:border-gray-600/70 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-300">Total Value</span>
            <span className="text-[10px] text-gray-400">Current Market Value</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ₹{portfolio.total_value.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Metric 2: Invested Value */}
        <div className="p-3 rounded-lg bg-gray-700/40 border border-gray-700/50 hover:border-gray-600/70 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-300">Invested Value</span>
            <span className="text-[10px] text-gray-400">Capital Deployed</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              ₹{portfolio.invested_value.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Metric 3: Total P&L with Status Indicator */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            isProfit
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-300">Total P&L</span>
            <div className="flex items-center gap-1 text-[11px] font-bold">
              {isProfit ? (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">PROFIT</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-rose-400">LOSS</span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
                isProfit ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {isProfit ? '+' : ''}₹
              {portfolio.total_pnl.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-sm sm:text-base font-bold px-2 py-0.5 rounded ${
                isProfit
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {portfolio.total_pnl_percentage >= 0 ? '+' : ''}
              {portfolio.total_pnl_percentage.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Clean Margin / Net Cash summary row if present */}
      {portfolio.margins?.net !== undefined && (
        <div className="pt-2 border-t border-gray-700/60 flex items-center justify-between text-xs text-gray-400">
          <span>Net Cash / Margin:</span>
          <span className="font-semibold text-gray-200">
            ₹
            {portfolio.margins.net.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      )}
    </div>
  );
}
