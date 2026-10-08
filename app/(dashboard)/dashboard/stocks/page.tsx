'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getPortfolio } from '@/lib/api/portfolio';
import { uploadTransactionsCSV, getStoredTransactions } from '@/lib/api/transactions';
import { getDatasetData } from '@/lib/api/datasets';
import { getQuotes } from '@/lib/api/market-data';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import type { Holding } from '@/types';

export default function StocksPage() {
  const [aggregatedStocks, setAggregatedStocks] = useState<any[]>([]);
  const [rawTransactions, setRawTransactions] = useState<any[]>([]);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' }>({ key: 'buyDate', direction: 'desc' });

  const fetchStocks = useCallback(async () => {
      try {
        setLoading(true);
        const portfolioRes = await getPortfolio({ broker_type: 'zerodha' }).catch(() => ({ holdings: [] }));
        const liveHoldings = portfolioRes.holdings || [];
        
        const txRes = await getStoredTransactions().catch(() => ({ transactions: [] }));
        const storedTxs = txRes.transactions || [];
        setRawTransactions(storedTxs);

        // Fetch NSE Equities dataset for stock names
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
            if (!txBySymbol[tx.symbol]) txBySymbol[tx.symbol] = [];
            txBySymbol[tx.symbol].push(tx);
        });

        const liveMap: Record<string, any> = {};
        liveHoldings.forEach((h: any) => {
           liveMap[h.tradingsymbol] = h;
        });

        const allSymbols = Array.from(new Set(Object.keys(txBySymbol))).sort();

        // Fetch quotes for symbols not in liveHoldings
        const missingSymbols = allSymbols.filter(sym => !liveMap[sym]);
        if (missingSymbols.length > 0) {
           const quotesData = await getQuotes(missingSymbols);
           if (Array.isArray(quotesData)) {
               quotesData.forEach(q => {
                   if (q.symbol && q.last_price) {
                       liveMap[q.symbol] = {
                           quantity: 0,
                           average_price: 0,
                           last_price: q.last_price,
                           pnl: 0
                       };
                   }
               });
           }
        }

        const merged: any[] = [];
        
        allSymbols.forEach(sym => {
            const h = liveMap[sym] || { quantity: 0, average_price: 0, last_price: 0, pnl: 0 };
            const symTxs = txBySymbol[sym];
            
            // Sort transactions by date ascending
            const sortedTxs = symTxs.sort((a, b) => {
                const dateA = new Date(a.trade_date_raw || 0).getTime();
                const dateB = new Date(b.trade_date_raw || 0).getTime();
                return dateA - dateB;
            });
            
            const buys = sortedTxs.filter(t => t.trade_type === 'buy').map(b => ({
                ...b,
                allocatedSellQty: 0,
                allocatedSellValue: 0
            }));
            
            const sells = sortedTxs.filter(t => t.trade_type === 'sell');
            
            // FIFO allocation
            sells.forEach(sell => {
                let remainingToSell = sell.quantity;
                for (const buy of buys) {
                    if (remainingToSell <= 0) break;
                    const availableInBuy = buy.quantity - buy.allocatedSellQty;
                    if (availableInBuy > 0) {
                        const allocate = Math.min(availableInBuy, remainingToSell);
                        buy.allocatedSellQty += allocate;
                        buy.allocatedSellValue += allocate * sell.price;
                        remainingToSell -= allocate;
                    }
                }
            });
            
            // Create a row for each buy lot
            buys.forEach(buy => {
                const currentUnit = buy.quantity - buy.allocatedSellQty;
                const buyTotal = buy.quantity * buy.price;
                const pnl = (buy.allocatedSellValue + (currentUnit * h.last_price)) - buyTotal;
                const pnlPercentage = buyTotal > 0 ? (pnl / buyTotal) * 100 : 0;
                
                const txDateStr = buy.trade_date_raw ? buy.trade_date_raw.split(' ')[0].split('T')[0] : '';
                const sourceStr = buy.source === 'file_upload' ? 'Upload' : (buy.source === 'api_sync' ? 'API' : 'Unknown');

                merged.push({
                    tradingsymbol: sym,
                    name: stockNameMap[sym] || sym,
                    buyDate: txDateStr,
                    buyQty: buy.quantity,
                    buyAvg: buy.price,
                    buyTotal: buyTotal,
                    sellQty: buy.allocatedSellQty,
                    sellAvg: buy.allocatedSellQty > 0 ? buy.allocatedSellValue / buy.allocatedSellQty : 0,
                    sellTotal: buy.allocatedSellValue,
                    currentUnit: currentUnit,
                    currentValue: currentUnit * h.last_price,
                    lastPrice: h.last_price,
                    pnl: pnl,
                    pnlPercentage: pnlPercentage,
                    firstPurchaseDate: txDateStr, // Map for compatibility if needed
                    sourceDisplay: sourceStr
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError('');
      setSuccessMsg('');
      const res = await uploadTransactionsCSV(file);
      setSuccessMsg(res.message || 'Successfully imported transactions!');
      await fetchStocks();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.message || 'Failed to upload CSV.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset input
      }
    }
  };

  const sortedStocks = useMemo(() => {
    let sortableItems = [...aggregatedStocks];
    sortableItems.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
    });
    return sortableItems;
  }, [aggregatedStocks, sortConfig]);

  const SortableHeader = ({ label, sortKey, className = '' }: { label: string, sortKey: string, className?: string }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        scope="col" 
        className={`px-4 py-3 border-b border-gray-700 cursor-pointer hover:bg-gray-700/50 transition-colors group ${className}`} 
        onClick={() => setSortConfig({ key: sortKey, direction: isActive && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
      >
        <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : 'justify-between'}`}>
          <span>{label}</span>
          <span className="flex-shrink-0 w-4 inline-flex justify-center">
            {isActive ? (
              sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-400">Loading your stock transactions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNavigation />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Stocks</h1>
          <p className="text-gray-400 text-sm">
            Overview of your transacted stocks and current holdings from connected brokers.
          </p>
        </div>
        
        {/* CSV Upload Section */}
        <div>
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                </svg>
                Import Tradebook (CSV/Excel)
              </>
            )}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 p-4 rounded-lg mb-6 flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg mb-2">Success</h3>
            <p>{successMsg}</p>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-green-400 hover:text-green-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg mb-6 flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg mb-2">Error</h3>
            <p>{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-900/50 text-xs uppercase font-semibold text-gray-400 sticky top-0">
              <tr>
                <SortableHeader label="Date" sortKey="buyDate" />
                <SortableHeader label="Stock" sortKey="name" className="min-w-[200px]" />
                <th scope="col" className="px-4 py-3 border-b border-gray-700">Trx Type</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700 bg-blue-900/20 border-l border-r border-gray-700/50 text-center" colSpan={4}>Buy</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700 bg-orange-900/20 border-r border-gray-700/50 text-center" colSpan={4}>Sell</th>
                <SortableHeader label="Cur. Price" sortKey="lastPrice" className="text-right" />
                <SortableHeader label="P/L" sortKey="pnl" className="text-right" />
                <SortableHeader label="% Profit" sortKey="pnlPercentage" className="text-right" />
                <SortableHeader label="Source" sortKey="sourceDisplay" className="text-right" />
              </tr>
              <tr className="bg-gray-900/40 text-[11px] text-gray-300 border-b border-gray-700 font-semibold tracking-wider">
                <th colSpan={3} className="border-r border-gray-700/50"></th>
                <th className="px-3 py-2 text-right bg-blue-900/10">Unit</th>
                <th className="px-3 py-2 text-right bg-blue-900/10">Qty</th>
                <th className="px-3 py-2 text-right bg-blue-900/10">Chgs</th>
                <th className="px-3 py-2 text-right bg-blue-900/10 border-r border-gray-700/50">Total Cost</th>
                <th className="px-3 py-2 text-right bg-orange-900/10">Unit</th>
                <th className="px-3 py-2 text-right bg-orange-900/10">Qty</th>
                <th className="px-3 py-2 text-right bg-orange-900/10">Chgs</th>
                <th className="px-3 py-2 text-right bg-orange-900/10 border-r border-gray-700/50">Total Sale</th>
                <th colSpan={4}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {sortedStocks.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                    No stock transactions found from your connected broker.
                  </td>
                </tr>
              ) : (
                sortedStocks.map((h, i) => {
                  const isCompleted = h.buyQty > 0 && h.buyQty === h.sellQty;
                  return (
                    <tr 
                      key={`${h.tradingsymbol}-${i}`} 
                      className={`transition-colors cursor-pointer ${isCompleted ? 'bg-black/10 hover:bg-black/20' : 'hover:bg-gray-800'}`}
                      onClick={() => setSelectedStock(h.tradingsymbol)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">{h.buyDate ? h.buyDate.split('-').reverse().join('-') : '-'}</td>
                      <td className="px-4 py-3 min-w-[200px] truncate" title={h.name || h.tradingsymbol}>
                        <div className="font-medium text-gray-200">{h.name || h.tradingsymbol}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{h.tradingsymbol}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">Equity</td>
                      <td className="px-3 py-3 text-right border-l border-gray-700/50">{h.buyAvg.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">{h.buyQty}</td>
                      <td className="px-3 py-3 text-right text-gray-500">-</td>
                      <td className="px-3 py-3 text-right border-r border-gray-700/50 font-semibold">₹{h.buyTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right">{h.sellQty > 0 ? h.sellAvg.toFixed(2) : ''}</td>
                      <td className="px-3 py-3 text-right">{h.sellQty > 0 ? h.sellQty : ''}</td>
                      <td className="px-3 py-3 text-right text-gray-500">{h.sellQty > 0 ? '-' : ''}</td>
                      <td className="px-3 py-3 text-right border-r border-gray-700/50 font-semibold">{h.sellQty > 0 ? `₹${h.sellTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : ''}</td>
                      <td className="px-4 py-3 text-right font-medium">{h.lastPrice > 0 ? `₹${h.lastPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${h.pnl >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {h.pnl >= 0 ? '+' : ''}{h.pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${h.pnlPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {h.pnlPercentage >= 0 ? '+' : ''}{h.pnlPercentage.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{h.sourceDisplay}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </main>

      {/* Trades Breakdown Modal */}
      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Trade History: {selectedStock}</h2>
              <button 
                onClick={() => setSelectedStock(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {rawTransactions.filter(t => t.symbol === selectedStock).length === 0 ? (
                <p className="text-gray-400 text-center py-8">No specific trade records found for {selectedStock}. (It might only exist in your broker holding)</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-gray-900/50 text-xs uppercase font-semibold text-gray-400">
                      <tr>
                        <th className="px-4 py-3 border-b border-gray-700">Date</th>
                        <th className="px-4 py-3 border-b border-gray-700">Trade ID</th>
                        <th className="px-4 py-3 border-b border-gray-700">Type</th>
                        <th className="px-4 py-3 border-b border-gray-700 text-right">Quantity</th>
                        <th className="px-4 py-3 border-b border-gray-700 text-right">Price</th>
                        <th className="px-4 py-3 border-b border-gray-700 text-center">Status</th>
                        <th className="px-4 py-3 border-b border-gray-700 text-right">P/L</th>
                        <th className="px-4 py-3 border-b border-gray-700 text-center">Strategy</th>
                        <th className="px-4 py-3 border-b border-gray-700 text-center">Strategy ID</th>
                        <th className="px-4 py-3 border-b border-gray-700 text-center">Broker</th>
                        <th className="px-4 py-3 border-b border-gray-700 text-center">Profile Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                      {rawTransactions
                        .filter(t => t.symbol === selectedStock)
                        .sort((a, b) => new Date(a.trade_date_raw || 0).getTime() - new Date(b.trade_date_raw || 0).getTime())
                        .map((tx, idx) => (
                        <tr key={idx} className="hover:bg-gray-700/30">
                          <td className="px-4 py-3">{tx.trade_date_raw}</td>
                          <td className="px-4 py-3 font-mono text-gray-400">{tx.order_id || tx.id.substring(0, 8)}</td>
                          <td className={`px-4 py-3 font-medium uppercase ${tx.trade_type === 'buy' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {tx.trade_type}
                          </td>
                          <td className="px-4 py-3 text-right">{tx.quantity}</td>
                          <td className="px-4 py-3 text-right">₹{tx.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-1 bg-gray-700/50 text-gray-300 text-xs rounded-full">
                              {tx.status || 'COMPLETE'}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-medium ${tx.pnl && tx.pnl >= 0 ? 'text-emerald-400' : tx.pnl && tx.pnl < 0 ? 'text-rose-400' : 'text-gray-500'}`}>
                            {tx.pnl !== undefined ? (tx.pnl >= 0 ? '+' : '') + tx.pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-gray-400">{tx.strategy_type || 'Manual'}</td>
                          <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs">{tx.strategy_id || '-'}</td>
                          <td className="px-4 py-3 text-center text-gray-400 capitalize">{tx.broker || tx.broker_id || 'Zerodha'}</td>
                          <td className="px-4 py-3 text-center text-gray-400">{tx.profile_name || tx.profile_id || 'Priyam Vinod Nagadiya'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button 
                onClick={() => setSelectedStock(null)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium text-sm"
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
