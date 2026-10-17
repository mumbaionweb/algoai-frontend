'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import type { Holding } from '@/types';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import { ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline';

interface HoldingsTableProps {
  holdings: Holding[];
  onRefresh: () => void;
  refreshing: boolean;
  selectedBroker?: string;
}

export default function HoldingsTable({
  holdings,
  onRefresh,
  refreshing,
  selectedBroker = 'all',
}: HoldingsTableProps) {
  // Filter by selectedBroker if set and not 'all'
  const filteredData = useMemo(() => {
    if (!selectedBroker || selectedBroker === 'all') return holdings;
    const target = selectedBroker.toLowerCase();
    return holdings.filter((h) => (h.broker || '').toLowerCase().includes(target));
  }, [holdings, selectedBroker]);

  // Render Broker Badge
  const renderBrokerBadge = (broker?: string) => {
    const b = (broker || '').toLowerCase();
    const isZerodha = b.includes('zerodha');
    const isPaytm = b.includes('paytm');

    if (isZerodha) {
      return (
        <div
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#ff5722]/15 text-[#ff5722] border border-[#ff5722]/30 shadow-xs"
          title="Zerodha"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L3 11.5l9 9.5 9-9.5L12 2zm0 4.2l5.5 5.8-5.5 5.8-5.5-5.8 5.5-5.8z" />
          </svg>
        </div>
      );
    }

    if (isPaytm) {
      return (
        <div
          className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#002e6e]/20 text-[#00baf2] border border-[#00baf2]/35 shadow-xs"
          title="Paytm Money"
        >
          <span className="font-black text-[10px] tracking-tighter leading-none">
            PM
          </span>
        </div>
      );
    }

    return (
      <span className="text-xs text-gray-500 dark:text-gray-400" title={broker || 'Unknown'}>
        {broker || '-'}
      </span>
    );
  };

  const columns: ColumnDef<Holding>[] = useMemo(
    () => [
      {
        key: 'action',
        header: 'Action',
        width: '80px',
        minWidth: '70px',
        align: 'center',
        sortable: false,
        filterable: false,
        reorderable: false,
        hideable: false,
        render: (holding) => (
          <div className="flex items-center justify-center">
            <Link
              href={`/dashboard/stocks/${encodeURIComponent(holding.tradingsymbol)}`}
              className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              title={`View ${holding.stock_name || holding.tradingsymbol} page`}
            >
              <EyeIcon className="w-4 h-4" />
            </Link>
          </div>
        ),
      },
      {
        key: 'stock_name',
        header: 'Stock Name',
        minWidth: '220px',
        sortable: true,
        filterable: true,
        filterType: 'text',
        accessor: (h) => `${h.stock_name || ''} ${h.tradingsymbol}`,
        render: (holding) => {
          const displayName = holding.stock_name || holding.tradingsymbol;
          return (
            <div className="flex flex-col">
              <span className="font-semibold text-gray-900 dark:text-white tracking-tight line-clamp-1">
                {displayName}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600/50">
                  {holding.tradingsymbol}
                </span>
                {holding.exchange && (
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 font-mono">
                    {holding.exchange}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: 'broker',
        header: 'Broker',
        width: '90px',
        minWidth: '80px',
        align: 'center',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { label: 'All Brokers', value: '' },
          { label: 'Zerodha', value: 'zerodha' },
          { label: 'Paytm Money', value: 'paytm' },
        ],
        accessor: (h) => h.broker || '',
        render: (holding) => renderBrokerBadge(holding.broker),
      },
      {
        key: 'quantity',
        header: 'Quantity',
        width: '100px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (h) => h.quantity,
        render: (holding) => (
          <span className="font-medium text-gray-900 dark:text-white font-mono">
            {holding.quantity}
          </span>
        ),
      },
      {
        key: 'average_price',
        header: 'Avg Price',
        width: '130px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (h) => h.average_price,
        render: (holding) => (
          <span className="font-mono text-gray-700 dark:text-gray-300">
            ₹
            {holding.average_price.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: 'last_price',
        header: 'Last Price',
        width: '130px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (h) => h.last_price,
        render: (holding) => (
          <span className="font-mono font-medium text-gray-900 dark:text-white">
            ₹
            {holding.last_price.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: 'pnl',
        header: 'P&L Amt',
        width: '140px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (h) => h.pnl,
        render: (holding) => {
          const isProfit = holding.pnl >= 0;
          return (
            <span
              className={`font-mono font-semibold ${
                isProfit ? 'text-profit' : 'text-loss'
              }`}
            >
              {isProfit ? '+' : ''}₹
              {holding.pnl.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          );
        },
      },
      {
        key: 'pnl_percentage',
        header: 'P&L %',
        width: '120px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (h) => h.pnl_percentage,
        render: (holding) => {
          const isProfit = holding.pnl_percentage >= 0;
          return (
            <span
              className={`font-mono font-semibold ${
                isProfit ? 'text-profit' : 'text-loss'
              }`}
            >
              {isProfit ? '+' : ''}
              {holding.pnl_percentage.toFixed(2)}%
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-sm overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-750 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Holdings
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            {filteredData.length}
          </span>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          title="Refresh Holdings"
        >
          <ArrowPathIcon
            className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Global Standardized DataTable */}
      <DataTable<Holding>
        data={filteredData}
        columns={columns}
        keyExtractor={(holding, idx) =>
          `${holding.tradingsymbol}-${holding.broker || ''}-${idx}`
        }
        isLoading={refreshing}
        loadingMessage="Refreshing holdings..."
        emptyMessage="No holdings found in your portfolio."
        enableSearch={true}
        searchPlaceholder="Search stock name or symbol..."
        enablePagination={true}
        pageSize={50}
        storageKey="portfolio_holdings_table"
      />
    </div>
  );
}
