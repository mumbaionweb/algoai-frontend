'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getPortfolio } from '@/lib/api/portfolio';
import { uploadTransactionsCSV, getStoredTransactions } from '@/lib/api/transactions';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import type { Holding } from '@/types';

export default function StocksPage() {
  const [aggregatedStocks, setAggregatedStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStocks = useCallback(async () => {
      try {
        setLoading(true);
        const portfolioRes = await getPortfolio({ broker_type: 'zerodha' }).catch(() => ({ holdings: [] }));
        const liveHoldings = portfolioRes.holdings || [];
        
        const txRes = await getStoredTransactions().catch(() => ({ transactions: [] }));
        const storedTxs = txRes.transactions || [];

        const aggMap: Record<string, any> = {};
        storedTxs.forEach((tx: any) => {
          if (!aggMap[tx.symbol]) {
            aggMap[tx.symbol] = {
              buyQty: 0,
              buyCost: 0,
              sellQty: 0,
              sellSale: 0,
            };
          }
          if (tx.trade_type === 'buy') {
            aggMap[tx.symbol].buyQty += tx.quantity;
            aggMap[tx.symbol].buyCost += tx.quantity * tx.price;
          } else if (tx.trade_type === 'sell') {
            aggMap[tx.symbol].sellQty += tx.quantity;
            aggMap[tx.symbol].sellSale += tx.quantity * tx.price;
          }
        });

        const liveMap: Record<string, any> = {};
        liveHoldings.forEach((h: any) => {
           liveMap[h.tradingsymbol] = h;
        });

        const merged: any[] = [];
        const allSymbols = Array.from(new Set([...Object.keys(aggMap), ...Object.keys(liveMap)])).sort();
        
        allSymbols.forEach(sym => {
           const a = aggMap[sym] || { buyQty: 0, buyCost: 0, sellQty: 0, sellSale: 0 };
           const h = liveMap[sym] || { quantity: 0, average_price: 0, last_price: 0, pnl: 0 };
           
           const currentUnit = h.quantity || (a.buyQty - a.sellQty);
           const pnl = (a.sellSale + (currentUnit * h.last_price)) - a.buyCost;
           const pnlPercentage = a.buyCost > 0 ? (pnl / a.buyCost) * 100 : 0;
           
           merged.push({
             tradingsymbol: sym,
             buyQty: a.buyQty,
             buyAvg: a.buyQty > 0 ? (a.buyCost / a.buyQty) : 0,
             buyTotal: a.buyCost,
             sellQty: a.sellQty,
             sellAvg: a.sellQty > 0 ? (a.sellSale / a.sellQty) : 0,
             sellTotal: a.sellSale,
             currentUnit: currentUnit,
             currentValue: currentUnit * h.last_price,
             lastPrice: h.last_price,
             pnl: pnl,
             pnlPercentage: pnlPercentage
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
                <th scope="col" className="px-4 py-3 border-b border-gray-700">Month</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700">S/F</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700">Trx Type</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700">Stock / Symbol</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700 bg-blue-900/10 border-l border-r border-gray-700/50 text-center" colSpan={4}>Buy</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700 bg-orange-900/10 border-r border-gray-700/50 text-center" colSpan={4}>Sell</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700 text-right">Cur. Unit</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700 text-right">Cur. Value</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700 text-right">P/L</th>
                <th scope="col" className="px-4 py-3 border-b border-gray-700 text-right">% Profit</th>
              </tr>
              <tr className="bg-gray-900/30 text-[10px] text-gray-500 border-b border-gray-700">
                <th colSpan={4} className="border-r border-gray-700/50"></th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Chgs</th>
                <th className="px-3 py-2 text-right border-r border-gray-700/50">Total Cost</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Chgs</th>
                <th className="px-3 py-2 text-right border-r border-gray-700/50">Total Sale</th>
                <th colSpan={4}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {aggregatedStocks.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-gray-500">
                    No stock transactions found from your connected broker.
                  </td>
                </tr>
              ) : (
                aggregatedStocks.map((h, i) => {
                  return (
                    <tr key={`${h.tradingsymbol}-${i}`} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">-</td>
                      <td className="px-4 py-3">s</td>
                      <td className="px-4 py-3">Equity</td>
                      <td className="px-4 py-3 font-medium text-white">{h.tradingsymbol}</td>
                      <td className="px-3 py-3 text-right border-l border-gray-700/50">{h.buyAvg.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">{h.buyQty}</td>
                      <td className="px-3 py-3 text-right text-gray-500">-</td>
                      <td className="px-3 py-3 text-right border-r border-gray-700/50 text-blue-300">₹{h.buyTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-3 text-right">{h.sellAvg.toFixed(2)}</td>
                      <td className="px-3 py-3 text-right">{h.sellQty}</td>
                      <td className="px-3 py-3 text-right text-gray-500">-</td>
                      <td className="px-3 py-3 text-right border-r border-gray-700/50 text-orange-300">₹{h.sellTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-right">{h.currentUnit}</td>
                      <td className="px-4 py-3 text-right font-medium">₹{h.currentValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td className={`px-4 py-3 text-right font-medium ${h.pnl >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {h.pnl >= 0 ? '+' : ''}{h.pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${h.pnlPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {h.pnlPercentage >= 0 ? '+' : ''}{h.pnlPercentage.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </main>
    </div>
  );
}
