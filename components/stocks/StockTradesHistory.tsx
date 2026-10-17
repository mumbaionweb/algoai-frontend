'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getStoredTransactions } from '@/lib/api/transactions';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import {
  ArrowPathIcon,
  ShoppingBagIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline';

export interface StockTradesHistoryProps {
  symbol: string;
}

export default function StockTradesHistory({ symbol }: StockTradesHistoryProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getStoredTransactions({ symbol });
      setTransactions(res?.transactions || []);
    } catch (e: any) {
      console.error('Failed to load stock transactions:', e);
      setError(e.message || 'Failed to fetch trades history');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  // Aggregate Metrics
  const summary = useMemo(() => {
    let totalBuyQty = 0;
    let totalBuyVal = 0;
    let totalSellQty = 0;
    let totalSellVal = 0;

    transactions.forEach((tx) => {
      const qty = Number(tx.quantity || 0);
      const price = Number(tx.price || 0);
      const val = qty * price;
      const type = (tx.trade_type || '').toLowerCase();

      if (type.includes('buy') || type === 'b') {
        totalBuyQty += qty;
        totalBuyVal += val;
      } else if (type.includes('sell') || type === 's') {
        totalSellQty += qty;
        totalSellVal += val;
      }
    });

    const netQty = totalBuyQty - totalSellQty;
    const avgBuyPrice = totalBuyQty > 0 ? totalBuyVal / totalBuyQty : 0;
    const avgSellPrice = totalSellQty > 0 ? totalSellVal / totalSellQty : 0;

    return {
      totalCount: transactions.length,
      totalBuyQty,
      totalBuyVal,
      totalSellQty,
      totalSellVal,
      netQty,
      avgBuyPrice,
      avgSellPrice,
    };
  }, [transactions]);

  // Broker Badge renderer
  const renderBrokerBadge = (broker?: string) => {
    const b = (broker || '').toLowerCase();
    const isZerodha = b.includes('zerodha');
    const isPaytm = b.includes('paytm');

    if (isZerodha) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ff5722]/15 text-[#ff5722] border border-[#ff5722]/30">
          Zerodha
        </span>
      );
    }

    if (isPaytm) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#002e6e]/20 text-[#00baf2] border border-[#00baf2]/35">
          Paytm Money
        </span>
      );
    }

    return (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {broker || '-'}
      </span>
    );
  };

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: 'trade_date_raw',
        header: 'Date & Time',
        minWidth: '160px',
        sortable: true,
        filterable: true,
        filterType: 'text',
        accessor: (tx) => tx.trade_date_raw || '',
        render: (tx) => {
          const raw = tx.trade_date_raw || '';
          return (
            <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
              {raw || '-'}
            </span>
          );
        },
      },
      {
        key: 'trade_type',
        header: 'Type',
        width: '90px',
        align: 'center',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { label: 'All Types', value: '' },
          { label: 'BUY', value: 'buy' },
          { label: 'SELL', value: 'sell' },
        ],
        accessor: (tx) => (tx.trade_type || '').toLowerCase(),
        render: (tx) => {
          const isBuy = (tx.trade_type || '').toLowerCase().includes('buy');
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isBuy
                  ? 'bg-profit-subtle text-profit border border-profit'
                  : 'bg-loss-subtle text-loss border border-loss'
              }`}
            >
              {isBuy ? 'BUY' : 'SELL'}
            </span>
          );
        },
      },
      {
        key: 'quantity',
        header: 'Quantity',
        width: '100px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (tx) => tx.quantity,
        render: (tx) => (
          <span className="font-mono font-medium text-gray-900 dark:text-white">
            {tx.quantity}
          </span>
        ),
      },
      {
        key: 'price',
        header: 'Price',
        width: '120px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (tx) => tx.price,
        render: (tx) => (
          <span className="font-mono text-gray-800 dark:text-gray-200">
            ₹
            {Number(tx.price || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: 'value',
        header: 'Total Value',
        width: '130px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (tx) => Number(tx.quantity || 0) * Number(tx.price || 0),
        render: (tx) => {
          const totalVal = Number(tx.quantity || 0) * Number(tx.price || 0);
          return (
            <span className="font-mono font-semibold text-gray-900 dark:text-white">
              ₹
              {totalVal.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          );
        },
      },
      {
        key: 'broker',
        header: 'Broker',
        width: '120px',
        align: 'center',
        sortable: true,
        filterable: true,
        filterType: 'text',
        accessor: (tx) => tx.broker || '',
        render: (tx) => renderBrokerBadge(tx.broker),
      },
      {
        key: 'order_id',
        header: 'Order ID',
        minWidth: '150px',
        sortable: true,
        filterable: true,
        filterType: 'text',
        accessor: (tx) => tx.order_id || tx.id || '',
        render: (tx) => (
          <span
            className="font-mono text-[11px] text-gray-500 dark:text-gray-400 block truncate max-w-[140px]"
            title={tx.order_id || tx.id}
          >
            {tx.order_id || tx.id || '-'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-sm p-6 flex flex-col gap-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShoppingBagIcon className="w-5 h-5 text-blue-500" />
            <span>Trades History</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              {transactions.length}
            </span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Historical buy & sell transactions recorded in Firestore for {symbol}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTrades}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          title="Refresh Trades"
        >
          <ArrowPathIcon
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
          />
          <span>Refresh</span>
        </button>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/50">
          <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <ArrowTrendingUpIcon className="w-3.5 h-3.5 text-profit" />
            <span>Total Bought</span>
          </div>
          <div className="text-base font-bold font-mono text-gray-900 dark:text-white">
            {summary.totalBuyQty}{' '}
            <span className="text-xs font-normal text-gray-500 font-sans">
              shares
            </span>
          </div>
          <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
            ₹{summary.totalBuyVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/50">
          <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <ArrowTrendingDownIcon className="w-3.5 h-3.5 text-loss" />
            <span>Total Sold</span>
          </div>
          <div className="text-base font-bold font-mono text-gray-900 dark:text-white">
            {summary.totalSellQty}{' '}
            <span className="text-xs font-normal text-gray-500 font-sans">
              shares
            </span>
          </div>
          <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
            ₹{summary.totalSellVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/50">
          <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
            Net Quantity
          </div>
          <div
            className={`text-base font-bold font-mono ${
              summary.netQty > 0
                ? 'text-profit'
                : summary.netQty === 0
                ? 'text-gray-700 dark:text-gray-300'
                : 'text-loss'
            }`}
          >
            {summary.netQty}{' '}
            <span className="text-xs font-normal text-gray-500 font-sans">
              {summary.netQty === 0 ? '(Squared Off)' : 'shares'}
            </span>
          </div>
          <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
            {summary.totalCount} total executions
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/50">
          <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            <ReceiptPercentIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Avg Buy Price</span>
          </div>
          <div className="text-base font-bold font-mono text-gray-900 dark:text-white">
            ₹{summary.avgBuyPrice.toFixed(2)}
          </div>
          <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-0.5">
            Avg Sell: ₹{summary.avgSellPrice.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Standardized DataTable */}
      <DataTable<any>
        data={transactions}
        columns={columns}
        keyExtractor={(tx, idx) => tx.id || tx.order_id || `tx-${idx}`}
        isLoading={loading}
        loadingMessage="Loading transactions from Firestore..."
        emptyMessage={`No transaction history found for ${symbol} in Firestore.`}
        enableSearch={true}
        searchPlaceholder="Search trades by date, order id, broker..."
        storageKey={`stock_trades_${symbol}`}
      />
    </div>
  );
}
