'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { getPortfolio } from '@/lib/api/portfolio';
import { getStoredTransactions } from '@/lib/api/transactions';
import { getDatasetData } from '@/lib/api/datasets';
import { getQuotes } from '@/lib/api/market-data';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { DataTable, ColumnDef } from '@/components/ui/DataTable';
import ImportTradebookModal from '@/components/stocks/ImportTradebookModal';
import type { AggregatedStock } from '@/types';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  EyeIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export default function StocksPage() {
  const [aggregatedStocks, setAggregatedStocks] = useState<AggregatedStock[]>([]);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Render Broker Badge helper
  const renderBrokerBadge = (broker?: string) => {
    const b = (broker || '').toLowerCase();
    const isZerodha = b.includes('zerodha') || b.includes('kite');
    const isPaytm = b.includes('paytm');

    if (isZerodha) {
      return (
        <div className="flex items-center gap-1.5" title="Zerodha">
          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#ff5722]/15 text-[#ff5722] border border-[#ff5722]/30 shrink-0">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L3 11.5l9 9.5 9-9.5L12 2zm0 4.2l5.5 5.8-5.5 5.8-5.5-5.8 5.5-5.8z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            Zerodha
          </span>
        </div>
      );
    }

    if (isPaytm) {
      return (
        <div className="flex items-center gap-1.5" title="Paytm Money">
          <div className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#002e6e]/20 text-[#00baf2] border border-[#00baf2]/35 shrink-0">
            <span className="font-black text-[9px] tracking-tighter leading-none">
              PM
            </span>
          </div>
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            Paytm Money
          </span>
        </div>
      );
    }

    return (
      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
        {broker || '-'}
      </span>
    );
  };

  // Render Source Badge helper
  const renderSourceBadge = (sourceDisplay: string) => {
    const s = sourceDisplay.toLowerCase();
    let badgeClass = 'bg-gray-100 dark:bg-gray-700/70 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600';

    if (s.includes('api')) {
      badgeClass = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    } else if (s.includes('excel') || s.includes('upload')) {
      badgeClass = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
    } else if (s.includes('algoai')) {
      badgeClass = 'bg-profit-subtle text-profit border-profit';
    }

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${badgeClass}`}
      >
        {sourceDisplay}
      </span>
    );
  };

  const fetchStocks = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const portfolioRes = await getPortfolio({ broker_type: 'zerodha' }).catch(() => ({ holdings: [] }));
      const liveHoldings = portfolioRes.holdings || [];
      
      const txRes = await getStoredTransactions().catch(() => ({ transactions: [] }));
      const storedTxs = txRes.transactions || [];
      setRawTransactions(storedTxs);

      // Fetch NSE Equities dataset for stock company names
      const nseRes = await getDatasetData('nse_equities', 5000).catch(() => ({ data: [] }));
      const nseEquities = nseRes.data || [];
      const stockNameMap: Record<string, string> = {};
      nseEquities.forEach((eq: any) => {
        if (eq.SYMBOL && eq['NAME OF COMPANY']) {
          stockNameMap[eq.SYMBOL] = eq['NAME OF COMPANY'];
        }
      });

      // Group all transactions by symbol
      const txBySymbol: Record<string, any[]> = {};
      storedTxs.forEach((tx: any) => {
        const sym = String(tx.symbol || tx.tradingsymbol || '').trim().toUpperCase();
        if (!sym) return;
        if (!txBySymbol[sym]) txBySymbol[sym] = [];
        txBySymbol[sym].push(tx);
      });

      const liveMap: Record<string, any> = {};
      liveHoldings.forEach((h: any) => {
        if (h.tradingsymbol) liveMap[h.tradingsymbol] = h;
      });

      const allSymbols = Array.from(new Set(Object.keys(txBySymbol))).sort();

      // Fetch quotes for symbols not in liveHoldings
      const missingSymbols = allSymbols.filter((sym) => !liveMap[sym]);
      if (missingSymbols.length > 0) {
        const quotesData = await getQuotes(missingSymbols);
        if (Array.isArray(quotesData)) {
          quotesData.forEach((q) => {
            if (q.symbol && q.last_price) {
              liveMap[q.symbol] = {
                quantity: 0,
                average_price: 0,
                last_price: q.last_price,
                pnl: 0,
              };
            }
          });
        }
      }

      const merged: AggregatedStock[] = [];

      allSymbols.forEach((sym) => {
        const h = liveMap[sym] || { quantity: 0, average_price: 0, last_price: 0, pnl: 0 };
        const symTxs = txBySymbol[sym];

        // Sort transactions by date ascending
        const sortedTxs = [...symTxs].sort((a, b) => {
          const dateA = new Date(a.trade_date_raw || 0).getTime();
          const dateB = new Date(b.trade_date_raw || 0).getTime();
          return dateA - dateB;
        });

        const buys = sortedTxs
          .filter((t) => (t.trade_type || '').toLowerCase() === 'buy')
          .map((b) => ({
            ...b,
            allocatedSellQty: 0,
            allocatedSellValue: 0,
            allocatedSellChgs: 0,
          }));

        const sells = sortedTxs.filter((t) => (t.trade_type || '').toLowerCase() === 'sell');

        // FIFO allocation
        sells.forEach((sell) => {
          let remainingToSell = Number(sell.quantity || 0);
          for (const buy of buys) {
            if (remainingToSell <= 0) break;
            const availableInBuy = Number(buy.quantity || 0) - buy.allocatedSellQty;
            if (availableInBuy > 0) {
              const allocate = Math.min(availableInBuy, remainingToSell);
              buy.allocatedSellQty += allocate;
              buy.allocatedSellValue += allocate * Number(sell.price || 0);
              if (Number(sell.quantity || 0) > 0) {
                buy.allocatedSellChgs += (allocate / Number(sell.quantity || 0)) * Number(sell.charges || 0);
              }
              remainingToSell -= allocate;
            }
          }
        });

        // Create a row for each buy lot
        buys.forEach((buy, lotIdx) => {
          const buyQty = Number(buy.quantity || 0);
          const buyPrice = Number(buy.price || 0);
          const buyChgs = Number(buy.charges || 0);
          const currentUnit = buyQty - buy.allocatedSellQty;
          const buyTotal = buyQty * buyPrice + buyChgs;
          const sellTotal = buy.allocatedSellValue;
          const sellChgs = buy.allocatedSellChgs;

          // PnL calculation
          const pnl = buy.allocatedSellValue + currentUnit * Number(h.last_price || 0) - buyQty * buyPrice - buyChgs - sellChgs;
          const costBasis = buyQty * buyPrice;
          const pnlPercentage = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

          const txDateStr = buy.trade_date_raw ? buy.trade_date_raw.split(' ')[0].split('T')[0] : '';
          
          // Normalized Broker Name
          let broker = buy.broker || 'Zerodha';
          if (broker.toLowerCase() === 'kite' || broker.toLowerCase() === 'default') {
            broker = 'Zerodha';
          }

          // Broker User ID
          const brokerUserId = buy.broker_user_id || buy.user_id || 'account';

          // Determine Source Display
          let sourceDisplay = `${broker} (API)`;
          const src = (buy.source || '').toLowerCase();
          if (src.includes('api') || src === 'cron_sync') {
            sourceDisplay = `${broker} (API)`;
          } else if (src === 'file_upload' || src === 'upload') {
            sourceDisplay = `${broker} (Excel)`;
          } else if (src === 'algoai') {
            sourceDisplay = 'AlgoAI System';
          } else if (buy.broker) {
            sourceDisplay = `${buy.broker} (API)`;
          }

          merged.push({
            id: `${sym}-${buy.id || lotIdx}-${lotIdx}`,
            tradingsymbol: sym,
            name: stockNameMap[sym] || sym,
            trxType: buy.product_type || 'Equity',
            buyDate: txDateStr,
            buyQty: buyQty,
            buyAvg: buyPrice,
            buyChgs: buyChgs,
            buyTotal: buyTotal,
            sellQty: buy.allocatedSellQty,
            sellAvg: buy.allocatedSellQty > 0 ? buy.allocatedSellValue / buy.allocatedSellQty : 0,
            sellChgs: sellChgs,
            sellTotal: sellTotal,
            currentUnit: currentUnit,
            currentValue: currentUnit * Number(h.last_price || 0),
            lastPrice: Number(h.last_price || 0),
            pnl: pnl,
            pnlPercentage: pnlPercentage,
            broker: broker,
            brokerUserId: brokerUserId,
            source: buy.source || 'unknown',
            sourceDisplay: sourceDisplay,
          });
        });
      });

      setAggregatedStocks(merged);
    } catch (err: any) {
      console.error('Failed to fetch stocks:', err);
      setError(err.message || 'Failed to fetch stocks data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  // Global Standardized DataTable Columns (Single-level header with Buy/Sell prefixes)
  const columns: ColumnDef<AggregatedStock>[] = useMemo(
    () => [
      {
        key: 'action',
        header: 'Action',
        width: '75px',
        minWidth: '70px',
        align: 'center',
        sortable: false,
        filterable: false,
        reorderable: false,
        hideable: false,
        render: (row) => (
          <div className="flex items-center justify-center">
            <Link
              href={`/dashboard/stocks/${encodeURIComponent(row.tradingsymbol)}`}
              className="p-1.5 rounded-lg text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
              title={`View ${row.name || row.tradingsymbol} details`}
            >
              <EyeIcon className="w-4 h-4" />
            </Link>
          </div>
        ),
      },
      {
        key: 'buyDate',
        header: 'Date',
        width: '105px',
        minWidth: '95px',
        sortable: true,
        filterable: true,
        filterType: 'date',
        accessor: (r) => r.buyDate,
        render: (row) => (
          <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
            {row.buyDate ? row.buyDate.split('-').reverse().join('-') : '-'}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Stock',
        minWidth: '220px',
        sortable: true,
        filterable: true,
        filterType: 'text',
        accessor: (r) => `${r.name} ${r.tradingsymbol}`,
        render: (row) => (
          <div className="flex flex-col">
            <span
              className="font-semibold text-gray-900 dark:text-white tracking-tight line-clamp-1"
              title={row.name || row.tradingsymbol}
            >
              {row.name || row.tradingsymbol}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600/50">
                {row.tradingsymbol}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'trxType',
        header: 'Trx Type',
        width: '95px',
        align: 'center',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { label: 'All', value: '' },
          { label: 'Equity', value: 'equity' },
        ],
        accessor: (r) => r.trxType,
        render: (row) => (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
            {row.trxType}
          </span>
        ),
      },
      {
        key: 'broker',
        header: 'Broker',
        width: '135px',
        minWidth: '120px',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { label: 'All Brokers', value: '' },
          { label: 'Zerodha', value: 'zerodha' },
          { label: 'Paytm Money', value: 'paytm' },
        ],
        accessor: (r) => r.broker,
        render: (row) => renderBrokerBadge(row.broker),
      },
      {
        key: 'brokerUserId',
        header: 'User ID',
        width: '110px',
        minWidth: '100px',
        sortable: true,
        filterable: true,
        filterType: 'text',
        accessor: (r) => r.brokerUserId,
        render: (row) => (
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600/50">
            {row.brokerUserId || '-'}
          </span>
        ),
      },
      {
        key: 'buyAvg',
        header: 'Buy Unit',
        width: '110px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.buyAvg,
        render: (row) => (
          <span className="font-mono text-gray-800 dark:text-gray-200">
            ₹{row.buyAvg.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        ),
      },
      {
        key: 'buyQty',
        header: 'Buy Qty',
        width: '95px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.buyQty,
        render: (row) => (
          <span className="font-mono font-medium text-gray-900 dark:text-white">
            {row.buyQty}
          </span>
        ),
      },
      {
        key: 'buyChgs',
        header: 'Buy Chgs',
        width: '100px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.buyChgs,
        render: (row) => (
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
            {row.buyChgs > 0 ? `₹${row.buyChgs.toFixed(2)}` : '-'}
          </span>
        ),
      },
      {
        key: 'buyTotal',
        header: 'Buy Total Cost',
        width: '135px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.buyTotal,
        render: (row) => (
          <span className="font-mono font-semibold text-gray-900 dark:text-white">
            ₹{row.buyTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        ),
      },
      {
        key: 'sellAvg',
        header: 'Sell Unit',
        width: '110px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.sellAvg,
        render: (row) => (
          <span className="font-mono text-gray-800 dark:text-gray-200">
            {row.sellQty > 0
              ? `₹${row.sellAvg.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : '-'}
          </span>
        ),
      },
      {
        key: 'sellQty',
        header: 'Sell Qty',
        width: '95px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.sellQty,
        render: (row) => (
          <span className="font-mono text-gray-900 dark:text-white">
            {row.sellQty > 0 ? row.sellQty : '-'}
          </span>
        ),
      },
      {
        key: 'sellChgs',
        header: 'Sell Chgs',
        width: '100px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.sellChgs,
        render: (row) => (
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
            {row.sellChgs > 0 ? `₹${row.sellChgs.toFixed(2)}` : '-'}
          </span>
        ),
      },
      {
        key: 'sellTotal',
        header: 'Sell Total Sale',
        width: '135px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.sellTotal,
        render: (row) => (
          <span className="font-mono font-semibold text-gray-900 dark:text-white">
            {row.sellQty > 0 ? `₹${row.sellTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
          </span>
        ),
      },
      {
        key: 'lastPrice',
        header: 'Cur. Price',
        width: '115px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.lastPrice,
        render: (row) => (
          <span className="font-mono font-medium text-gray-900 dark:text-white">
            {row.lastPrice > 0 ? `₹${row.lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
          </span>
        ),
      },
      {
        key: 'pnl',
        header: 'P/L',
        width: '125px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.pnl,
        render: (row) => {
          const isProfit = row.pnl >= 0;
          return (
            <span className={`font-mono font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
              {isProfit ? '+' : ''}₹{row.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          );
        },
      },
      {
        key: 'pnlPercentage',
        header: '% Profit',
        width: '110px',
        align: 'right',
        sortable: true,
        filterable: true,
        filterType: 'number',
        accessor: (r) => r.pnlPercentage,
        render: (row) => {
          const isProfit = row.pnlPercentage >= 0;
          return (
            <span className={`font-mono font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
              {isProfit ? '+' : ''}{row.pnlPercentage.toFixed(2)}%
            </span>
          );
        },
      },
      {
        key: 'source',
        header: 'Source',
        width: '160px',
        minWidth: '150px',
        align: 'center',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { label: 'All Sources', value: '' },
          { label: 'API Synced', value: 'api' },
          { label: 'Excel Upload', value: 'excel' },
          { label: 'AlgoAI System', value: 'algoai' },
        ],
        accessor: (r) => r.sourceDisplay,
        render: (row) => renderSourceBadge(row.sourceDisplay),
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <DashboardNavigation />
      
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Top Header Bar */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1.5 tracking-tight">
              Stocks
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Overview of your transacted stocks and current holdings from connected brokers.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchStocks}
              disabled={loading}
              className="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs"
              title="Refresh Transactions"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-xs"
            >
              <ArrowUpTrayIcon className="w-4 h-4" />
              <span>Import Tradebook (CSV/Excel)</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 p-4 rounded-xl mb-6 flex justify-between items-start animate-in fade-in duration-150">
            <div className="flex items-start gap-2.5">
              <CheckCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Success</h3>
                <p className="text-xs mt-0.5">{successMsg}</p>
              </div>
            </div>
            <button
              onClick={() => setSuccessMsg('')}
              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 p-1"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-xl mb-6 flex justify-between items-start animate-in fade-in duration-150">
            <div className="flex items-start gap-2.5">
              <ExclamationCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Error</h3>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Standardized DataTable Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-xs overflow-hidden">
          <DataTable<AggregatedStock>
            data={aggregatedStocks}
            columns={columns}
            keyExtractor={(stock, idx) => `${stock.id}-${idx}`}
            isLoading={loading}
            loadingMessage="Loading your stock transactions and broker holdings..."
            emptyMessage="No stock transactions found from your connected brokers. Click 'Import Tradebook' to upload trades."
            enableSearch={true}
            searchPlaceholder="Search stock name, symbol, broker, or user ID..."
            enablePagination={true}
            pageSize={50}
            storageKey="stocks_holdings_datatable_v2"
            onRowClick={(row) => setSelectedStock(row.tradingsymbol)}
          />
        </div>
      </main>

      {/* Import Tradebook Modal */}
      <ImportTradebookModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={(msg) => {
          setSuccessMsg(msg);
          fetchStocks();
        }}
      />

      {/* Trades Breakdown Modal */}
      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-200 dark:border-gray-750 flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Trade History: {selectedStock}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {rawTransactions.filter((t) => (t.symbol || t.tradingsymbol) === selectedStock).length} Records
                </span>
              </div>
              <button
                onClick={() => setSelectedStock(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {rawTransactions.filter((t) => (t.symbol || t.tradingsymbol) === selectedStock).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-xs">
                  No individual trade execution records found for {selectedStock}.
                </p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-[11px] uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Order / Trade ID</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Quantity</th>
                        <th className="px-4 py-3 text-right">Price</th>
                        <th className="px-4 py-3 text-right">Charges</th>
                        <th className="px-4 py-3 text-center">Broker</th>
                        <th className="px-4 py-3 text-center">User ID</th>
                        <th className="px-4 py-3 text-center">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700/50">
                      {rawTransactions
                        .filter((t) => (t.symbol || t.tradingsymbol) === selectedStock)
                        .sort(
                          (a, b) =>
                            new Date(b.trade_date_raw || 0).getTime() - new Date(a.trade_date_raw || 0).getTime()
                        )
                        .map((tx, idx) => {
                          const isBuy = (tx.trade_type || '').toLowerCase() === 'buy';
                          return (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-4 py-3 font-mono">{tx.trade_date_raw || '-'}</td>
                              <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400">
                                {tx.order_id || (tx.id ? tx.id.substring(0, 8) : '-')}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`font-semibold uppercase ${
                                    isBuy ? 'text-profit' : 'text-loss'
                                  }`}
                                >
                                  {tx.trade_type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-mono">{tx.quantity}</td>
                              <td className="px-4 py-3 text-right font-mono">
                                ₹{Number(tx.price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-400">
                                {Number(tx.charges || 0) > 0 ? `₹${Number(tx.charges).toFixed(2)}` : '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {renderBrokerBadge(tx.broker)}
                              </td>
                              <td className="px-4 py-3 text-center font-mono text-xs">
                                {tx.broker_user_id || tx.user_id || '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                                  {tx.source === 'api_sync' || tx.source === 'cron_sync'
                                    ? 'API Sync'
                                    : tx.source === 'file_upload'
                                    ? 'Excel Upload'
                                    : tx.source || 'Manual'}
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

            <div className="px-6 py-3.5 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/80">
              <Link
                href={`/dashboard/stocks/${encodeURIComponent(selectedStock)}`}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
              >
                <span>Open Full Stock Analytics & TradingView Chart</span>
                <span>&rarr;</span>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedStock(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white rounded-lg transition-colors font-medium text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
