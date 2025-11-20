'use client';

import { useState, useEffect, useRef } from 'react';
import type { HistoricalDataPoint } from '@/lib/api/backtesting';
import { useHistoricalDataSSE } from '@/hooks/useHistoricalDataSSE';
import type { BacktestResponse, Transaction, BacktestPosition, IntervalOption } from '@/types';
import { INTERVAL_OPTIONS } from '@/types';
import { formatDate, formatDateShort } from '@/utils/dateUtils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BacktestResultsDisplayProps {
  results: BacktestResponse;
  hideTransactionDetails?: boolean; // Hide transaction/position details (for real-time updates during job execution)
  jobId?: string; // Optional job_id to use as fallback for charts when backtest_id is not available yet
  jobStatus?: string | null; // Optional job status to determine if multi-interval SSE is allowed
}

export default function BacktestResultsDisplay({ results, hideTransactionDetails = false, jobId, jobStatus }: BacktestResultsDisplayProps) {
  const [viewMode, setViewMode] = useState<'position' | 'transaction'>('position');

  return (
    <div className="space-y-4">
      {/* Warning for suspicious results */}
      {results.total_trades === 0 && results.total_return_pct === 0 && results.final_value === results.initial_cash && (
        <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 px-4 py-3 rounded-lg text-sm">
          <p className="font-semibold mb-2">⚠️ No trades executed</p>
          <p className="mb-2">The backtest completed but no trades were executed. This could mean:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>The strategy found no trading opportunities in the selected date range</li>
            <li>Historical data may not be available for this symbol/date range</li>
            <li>The strategy conditions were not met during this period</li>
            <li>Check the console logs for more details</li>
          </ul>
        </div>
      )}
      
      {/* Data Verification Section */}
      {(results.data_bars_count !== undefined || results.transactions !== undefined) && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Data Verification</h3>
          {results.intervals && results.intervals.length > 1 && (
            <div className="mb-3 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <p className="text-sm font-medium text-purple-300 mb-1">
                Multi-Timeframe Strategy:
              </p>
              <div className="flex flex-wrap gap-2">
                {results.intervals.map((intervalValue, idx) => (
                  <span
                    key={intervalValue}
                    className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs"
                  >
                    datas[{idx}]: {INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left side - Data info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-400">Historical Data Bars:</span>
                <span className={`font-bold text-sm ${(results.data_bars_count || 0) === 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {results.data_bars_count || 0}
                </span>
              </div>
              
              {(results.data_bars_count || 0) === 0 && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500 rounded text-red-400 text-xs">
                  ⚠️ No historical data found for this symbol/date range. Please check:
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Symbol is correct (e.g., "RELIANCE" not "RELI")</li>
                    <li>Date range is valid</li>
                    <li>Exchange is correct</li>
                  </ul>
                </div>
              )}
              
              {(results.data_bars_count || 0) > 0 && results.total_trades === 0 && (
                <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500 rounded text-yellow-400 text-xs">
                  ℹ️ Data found but no trades generated. Your strategy didn't produce any buy/sell signals in this period.
                </div>
              )}
            </div>
            
            {/* Right side - Timeseries Charts */}
            {(results.data_bars_count || 0) > 0 && (
              <div className="flex-1 min-w-0 lg:min-w-[300px]">
                <DataBarsChart 
                  backtestId={results.backtest_id || jobId || ''} // Use job_id as fallback if backtest_id not available
                  dataBarsCount={results.data_bars_count || 0}
                  fromDate={results.from_date}
                  toDate={results.to_date}
                  symbol={results.symbol}
                  intervals={results.intervals}
                  primaryInterval={results.interval}
                  jobStatus={jobStatus || null} // Pass job status to prevent multi-interval SSE for running jobs
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backtest Info */}
      <div className="bg-gray-700 rounded-lg p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">Backtest Information</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-400">Symbol:</span>
            <span className="text-white ml-2">{results.symbol}</span>
          </div>
          <div>
            <span className="text-gray-400">Exchange:</span>
            <span className="text-white ml-2">{results.exchange}</span>
          </div>
          <div>
            <span className="text-gray-400">Period:</span>
            <span className="text-white ml-2">{results.from_date} to {results.to_date}</span>
          </div>
          <div>
            <span className="text-gray-400">Data Interval:</span>
            <span className="text-white ml-2">
              {results.intervals && results.intervals.length > 1 ? (
                <div className="flex flex-wrap gap-1">
                  {results.intervals.map((intervalValue, idx) => (
                    <span key={intervalValue} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                      datas[{idx}]: {INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}
                    </span>
                  ))}
                </div>
              ) : (
                results.intervals && results.intervals.length === 1 ? (
                  INTERVAL_OPTIONS.find(opt => opt.value === results.intervals?.[0])?.label || results.intervals?.[0] || 'Daily'
                ) : (
                  INTERVAL_OPTIONS.find(opt => opt.value === results.interval)?.label || results.interval || 'Daily'
                )
              )}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Initial Capital:</span>
            <span className="text-white ml-2">₹{results.initial_cash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>


      {/* Transaction History - Only show if not hiding transaction details */}
      {!hideTransactionDetails && results.transactions && results.transactions.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4 mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">
              Transaction History ({results.transactions.length} transactions)
            </h3>
          </div>
          
          {/* Capital Allocation */}
          {(results.open_positions_count !== undefined || results.total_invested_capital !== undefined) && (
            <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
              <p className="font-semibold text-blue-400 mb-2">💰 Capital Allocation</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {results.open_positions_count !== undefined && (
                  <div>
                    <span className="text-gray-400">Open Positions:</span>
                    <span className="text-white ml-2 font-semibold">{results.open_positions_count}</span>
                  </div>
                )}
                {results.closed_positions_count !== undefined && (
                  <div>
                    <span className="text-gray-400">Closed Positions:</span>
                    <span className="text-white ml-2 font-semibold">{results.closed_positions_count}</span>
                  </div>
                )}
                {results.total_invested_capital !== undefined && (
                  <div>
                    <span className="text-gray-400">Total Invested:</span>
                    <span className="text-white ml-2 font-semibold">₹{results.total_invested_capital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {results.available_capital !== undefined && (
                  <div>
                    <span className="text-gray-400">Available Capital:</span>
                    <span className="text-white ml-2 font-semibold">₹{results.available_capital.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {results.total_open_positions_value !== undefined && (
                  <div>
                    <span className="text-gray-400">Open Positions Value:</span>
                    <span className="text-white ml-2 font-semibold">₹{results.total_open_positions_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {results.positions && (
                  <div>
                    <span className="text-gray-400">Total Positions:</span>
                    <span className="text-white ml-2 font-semibold">{results.positions.length}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Summary Statistics */}
          {(() => {
            const positions = results.positions || (results.transactions ? buildPositionView(results.transactions) : []);
            const usingBackendPositions = !!results.positions;
            
            if (usingBackendPositions && positions.length !== results.total_trades) {
              const closedPositions = positions.filter(p => p.is_closed);
              const openPositions = positions.filter(p => !p.is_closed);
              
              return (
                <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="font-semibold text-yellow-400 mb-3">🔍 Diagnostic: Discrepancy Detected</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Backend total_trades:</span>
                      <span className="text-white ml-2 font-semibold">{results.total_trades}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Backend positions:</span>
                      <span className="text-white ml-2 font-semibold">{positions.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Closed positions:</span>
                      <span className="text-white ml-2 font-semibold">{closedPositions.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Open positions:</span>
                      <span className="text-white ml-2 font-semibold">{openPositions.length}</span>
                    </div>
                  </div>
                </div>
              );
            }
            
            return null;
          })()}
          
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4 border-b border-gray-600">
            <button
              onClick={() => setViewMode('position')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'position'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              📊 Position View
            </button>
            <button
              onClick={() => setViewMode('transaction')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'transaction'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              📋 Transaction View
            </button>
          </div>

          {/* Position View */}
          {viewMode === 'position' && (
            <PositionView 
              positions={results.positions} 
              transactions={results.transactions}
            />
          )}

          {/* Transaction View */}
          {viewMode === 'transaction' && (
            <TransactionView transactions={results.transactions} />
          )}
        </div>
      )}

      {!hideTransactionDetails && (!results.transactions || results.transactions.length === 0) && (
        <div className="bg-gray-700 rounded-lg p-4 mt-4">
          <div className="text-center text-gray-400 text-sm">
            <p className="font-semibold text-yellow-400 mb-2">⚠️ No Transaction Details Available</p>
            {results.total_trades > 0 ? (
              <>
                <p className="mb-2">
                  The backtest executed <span className="font-bold text-white">{results.total_trades} trades</span>, but transaction details are not available.
                </p>
              </>
            ) : (
              <p className="mb-2">
                No trades were executed during this backtest. The strategy did not generate any buy/sell signals.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to calculate duration
function calculateDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  } else {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
}

// Helper function to build Position View from transactions
function buildPositionView(transactions: Transaction[]): BacktestPosition[] {
  const grouped = transactions.reduce((acc, txn) => {
    const tradeId = txn.trade_id || 'unlinked';
    if (!acc[tradeId]) {
      acc[tradeId] = [];
    }
    acc[tradeId].push(txn);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const positions: BacktestPosition[] = [];

  Object.entries(grouped).forEach(([tradeId, txns]) => {
    txns.sort((a, b) => {
      const dateA = a.exit_date || a.entry_date || '';
      const dateB = b.exit_date || b.entry_date || '';
      return dateA.localeCompare(dateB);
    });

    const entryTxn = txns.find(t => t.status === 'OPENED' || (t.type === t.entry_action && t.status !== 'CLOSED'));
    const exitTxns = txns.filter(t => t.status === 'CLOSED' || (t.type === t.exit_action && t.status !== 'OPENED'));

    const entryQuantity = entryTxn ? entryTxn.quantity : 0;
    const totalPnl = txns.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalPnlComm = txns.reduce((sum, t) => sum + (t.pnl_comm || 0), 0);
    const totalBrokerage = txns.reduce((sum, t) => sum + (t.brokerage || 0), 0);
    const totalPlatformFees = txns.reduce((sum, t) => sum + (t.platform_fees || 0), 0);
    const totalTransactionAmount = txns.reduce((sum, t) => sum + (t.transaction_amount || 0), 0);
    const totalAmount = txns.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const totalClosedQuantity = exitTxns.reduce((sum, t) => sum + t.quantity, 0);

    const firstTxn = txns[0];

    positions.push({
      trade_id: tradeId,
      position_type: entryTxn?.position_type || firstTxn?.position_type || 'LONG',
      entry_action: entryTxn?.entry_action || firstTxn?.entry_action || 'BUY',
      exit_action: entryTxn?.exit_action || firstTxn?.exit_action || 'SELL',
      entry_date: entryTxn?.entry_date || firstTxn?.entry_date || '',
      entry_price: entryTxn?.entry_price || firstTxn?.entry_price || 0,
      total_quantity: entryQuantity,
      total_pnl: totalPnl,
      total_pnl_comm: totalPnlComm,
      total_brokerage: totalBrokerage,
      total_platform_fees: totalPlatformFees,
      total_transaction_amount: totalTransactionAmount,
      total_amount: totalAmount,
      transactions: txns,
      is_closed: entryQuantity === totalClosedQuantity,
      remaining_quantity: Math.max(0, entryQuantity - totalClosedQuantity),
      symbol: firstTxn?.symbol,
      exchange: firstTxn?.exchange,
    });
  });

  positions.sort((a, b) => {
    return (a.entry_date || '').localeCompare(b.entry_date || '');
  });

  return positions;
}

// Helper function to build Transaction View
function buildTransactionView(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const getSortDate = (txn: Transaction): string => {
      if (txn.type === 'BUY') {
        return txn.entry_date || txn.exit_date || txn.date || '';
      } else {
        return txn.exit_date || txn.entry_date || txn.date || '';
      }
    };

    const dateA = getSortDate(a);
    const dateB = getSortDate(b);

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    const entryA = a.entry_date || '';
    const entryB = b.entry_date || '';
    return entryA.localeCompare(entryB);
  });
}

// Position View Component
function PositionView({ 
  positions: backendPositions, 
  transactions 
}: { 
  positions?: BacktestPosition[];
  transactions: Transaction[];
}) {
  const positions = backendPositions || (transactions ? buildPositionView(transactions) : []);

  return (
    <div className="overflow-x-auto">
      <div 
        className={`${
          positions.length > 5 
            ? 'max-h-[500px] overflow-y-auto transaction-table-scroll' 
            : ''
        }`}
        style={{
          scrollbarWidth: positions.length > 5 ? 'thin' : 'none',
          scrollbarColor: positions.length > 5 ? '#4B5563 #374151' : 'transparent transparent',
        }}
      >
        <div className={`space-y-4 ${positions.length > 5 ? 'py-1' : ''}`}>
          {positions.map((position) => {
            const totalValue = position.transactions.reduce(
              (sum, t) => sum + (t.exit_price || 0) * t.quantity,
              0
            );
            const avgExitPrice = position.total_quantity > 0 
              ? totalValue / position.total_quantity 
              : 0;

            const lastExit = position.transactions
              .map(t => t.exit_date || t.entry_date || t.date || '')
              .sort()
              .pop() || '';
            const duration = position.entry_date && lastExit
              ? calculateDuration(position.entry_date, lastExit)
              : null;

            return (
              <div 
                key={position.trade_id} 
                className={`bg-gray-800 rounded-lg p-4 border ${
                  position.position_type === 'SHORT' 
                    ? 'border-orange-500/30' 
                    : 'border-blue-500/30'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${
                      position.position_type === 'SHORT' ? 'text-orange-400' : 'text-blue-400'
                    }`}>
                      {position.position_type === 'SHORT' ? '🔻' : '🔺'}
                    </span>
                    <span className="font-semibold text-white">
                      {position.position_type} Position: {position.trade_id}
                    </span>
                    {position.symbol && (
                      <span className="text-gray-400 text-sm">
                        ({position.symbol}{position.exchange ? `, ${position.exchange}` : ''})
                      </span>
                    )}
                  </div>
                  <div className={`text-lg font-bold ${
                    position.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {position.total_pnl >= 0 ? '+' : ''}₹{position.total_pnl.toFixed(2)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-gray-700/50 rounded p-2">
                    <div className="text-gray-400 text-xs mb-1">Entry</div>
                    <div className="text-white">
                      {position.entry_action} {position.total_quantity} shares @ ₹{position.entry_price.toFixed(2)}
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      {formatDateShort(position.entry_date)}
                    </div>
                  </div>
                  <div className="bg-gray-700/50 rounded p-2">
                    <div className="text-gray-400 text-xs mb-1">P&L Summary</div>
                    <div className={`text-white font-semibold ${
                      position.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      Total P&L: {position.total_pnl >= 0 ? '+' : ''}₹{position.total_pnl.toFixed(2)}
                    </div>
                    {position.total_pnl_comm !== position.total_pnl && (
                      <div className="text-gray-400 text-xs mt-1">
                        After Fees: ₹{position.total_pnl_comm.toFixed(2)}
                      </div>
                    )}
                    <div className="text-gray-400 text-xs mt-1">
                      Total Brokerage: ₹{position.total_brokerage.toFixed(2)}
                      {position.total_platform_fees > 0 && (
                        <span> | Platform Fees: ₹{position.total_platform_fees.toFixed(2)}</span>
                      )}
                    </div>
                    {duration && (
                      <div className="text-gray-400 text-xs mt-1">
                        Duration: {duration}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-600 pt-3">
                  {(() => {
                    const exitTxns = position.transactions.filter(t => 
                      t.status === 'CLOSED' || (t.type === t.exit_action && t.status !== 'OPENED')
                    );
                    exitTxns.sort((a, b) => {
                      const dateA = a.exit_date || a.entry_date || '';
                      const dateB = b.exit_date || b.entry_date || '';
                      return dateA.localeCompare(dateB);
                    });

                    return (
                      <>
                        <h4 className="text-sm font-semibold text-gray-300 mb-2">
                          Closures ({exitTxns.length}):
                        </h4>
                        <div className="space-y-2">
                          {exitTxns.map((txn, idx) => (
                            <div 
                              key={idx} 
                              className="flex items-center justify-between bg-gray-700/30 rounded p-2 text-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                <div>
                                  <span className="text-white">
                                    {txn.exit_action || txn.type} {txn.quantity} shares @ ₹{txn.exit_price?.toFixed(2) || 'N/A'}
                                  </span>
                                  <div className="text-gray-400 text-xs mt-0.5">
                                    {formatDateShort(txn.exit_date || txn.entry_date || txn.date)}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className={`font-semibold ${
                                  (txn.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {txn.pnl !== null && txn.pnl !== undefined 
                                    ? `P&L: ${txn.pnl >= 0 ? '+' : ''}₹${txn.pnl.toFixed(2)}` 
                                    : 'N/A'}
                                </div>
                                <div className="text-gray-400 text-xs">
                                  Brokerage: ₹{(txn.brokerage || 0).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {positions.length > 5 && (
        <div className="mt-2 text-xs text-gray-500">
          Showing all {positions.length} positions. Scroll to view more.
        </div>
      )}
    </div>
  );
}

// Transaction View Component
function TransactionView({ transactions }: { transactions: Transaction[] }) {
  const sortedTransactions = buildTransactionView(transactions);

  const grandTotalPnl = sortedTransactions.reduce((sum, txn) => sum + (txn.pnl || 0), 0);
  const grandTotalPnlComm = sortedTransactions.reduce((sum, txn) => sum + (txn.pnl_comm || 0), 0);
  const grandTotalBrokerage = sortedTransactions.reduce((sum, txn) => sum + (txn.brokerage || 0), 0);
  const grandTotalPlatformFees = sortedTransactions.reduce((sum, txn) => sum + (txn.platform_fees || 0), 0);
  const grandTotalTransactionAmount = sortedTransactions.reduce((sum, txn) => sum + (txn.transaction_amount || 0), 0);
  const grandTotalAmount = sortedTransactions.reduce((sum, txn) => sum + (txn.total_amount || 0), 0);

  return (
    <div className="overflow-x-auto">
      <div 
        className={`${
          sortedTransactions.length > 10 
            ? 'max-h-[500px] overflow-y-auto transaction-table-scroll' 
            : ''
        }`}
        style={{
          scrollbarWidth: sortedTransactions.length > 10 ? 'thin' : 'none',
          scrollbarColor: sortedTransactions.length > 10 ? '#4B5563 #374151' : 'transparent transparent',
        }}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-800 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Date</th>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Type</th>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Quantity</th>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Price</th>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Amount</th>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">P&L</th>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Brokerage</th>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((txn, idx) => (
              <tr key={idx} className="border-b border-gray-700 hover:bg-gray-800/50">
                <td className="px-4 py-2 text-gray-300">
                  {formatDateShort(txn.entry_date || txn.exit_date || txn.date || '')}
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    txn.type === 'BUY' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {txn.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-white">{txn.quantity}</td>
                <td className="px-4 py-2 text-white">
                  ₹{(txn.entry_price || txn.exit_price || 0).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-white">
                  ₹{(txn.transaction_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`px-4 py-2 font-semibold ${
                  (txn.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {txn.pnl !== null && txn.pnl !== undefined 
                    ? `${txn.pnl >= 0 ? '+' : ''}₹${txn.pnl.toFixed(2)}` 
                    : 'N/A'}
                </td>
                <td className="px-4 py-2 text-gray-400">
                  ₹{(txn.brokerage || 0).toFixed(2)}
                </td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    txn.status === 'CLOSED' ? 'bg-green-500/20 text-green-400' :
                    txn.status === 'OPENED' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {txn.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-800 sticky bottom-0">
            <tr className="font-semibold">
              <td colSpan={5} className="px-4 py-3 text-right text-gray-300">Grand Total:</td>
              <td className={`px-4 py-3 font-bold ${
                grandTotalPnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {grandTotalPnl >= 0 ? '+' : ''}₹{grandTotalPnl.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-gray-400">
                ₹{grandTotalBrokerage.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-gray-400">
                {sortedTransactions.length} transactions
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {sortedTransactions.length > 10 && (
        <div className="mt-2 text-xs text-gray-500">
          Showing all {sortedTransactions.length} transactions. Scroll to view more.
        </div>
      )}
    </div>
  );
}

// DataBarsChart Component - Uses SSE for streaming historical data
function DataBarsChart({ 
  backtestId,
  dataBarsCount, 
  fromDate, 
  toDate, 
  symbol,
  intervals,
  primaryInterval,
  jobStatus
}: { 
  backtestId: string;
  dataBarsCount: number; 
  fromDate: string; 
  toDate: string; 
  symbol: string;
  intervals?: string[];
  primaryInterval?: string;
  jobStatus?: string | null; // Job status to determine if multi-interval SSE is allowed
}) {
  // Get Firebase token for SSE
  const token = typeof window !== 'undefined' ? localStorage.getItem('firebase_token') : null;
  
  // Determine if this is a multi-timeframe backtest
  const isMultiTimeframe = intervals && intervals.length > 1;
  
  // Use SSE hook for streaming historical data
  const {
    // Single interval
    data: sseData,
    progress: sseProgress,
    loading: sseLoading,
    error: sseError,
    metadata: sseMetadata,
    // Multi-interval
    intervalData: sseIntervalData,
    intervalProgress: sseIntervalProgress,
    intervalMetadata: sseIntervalMetadata,
    currentInterval: sseCurrentInterval,
    completedIntervals: sseCompletedIntervals,
    // Common
    isMultiInterval: sseIsMultiInterval,
  } = useHistoricalDataSSE({
    id: backtestId || null,
    token: token || null,
    interval: !isMultiTimeframe ? (primaryInterval || intervals?.[0]) : undefined,
    intervals: isMultiTimeframe ? intervals : undefined,
    limit: dataBarsCount || 10000,
    chunkSize: 500,
    enabled: !!backtestId && !!token,
    useRestApiFallback: false, // Use SSE only, no REST API fallback
    jobStatus: jobStatus || null, // Pass job status to prevent multi-interval SSE for running jobs
  });
  
  // For backward compatibility: map SSE data to old state structure
  const chartsData = new Map<string, {
    loading: boolean;
    error: string | null;
    historicalData: HistoricalDataPoint[] | null;
    dataInfo: { total_points: number; returned_points: number } | null;
    isPartial?: boolean;
    currentBar?: number | null;
    jobStatus?: string | null;
  }>();
  
  if (isMultiTimeframe && intervals) {
    intervals.forEach(interval => {
      const intervalData = sseIntervalData[interval] || [];
      const intervalMeta = sseIntervalMetadata[interval];
      chartsData.set(interval, {
        loading: sseLoading && sseCurrentInterval === interval,
        error: sseError,
        historicalData: intervalData.length > 0 ? intervalData : null,
        dataInfo: intervalMeta ? {
          total_points: intervalMeta.total_points,
          returned_points: intervalData.length,
        } : null,
        isPartial: false, // TODO: Get from SSE metadata if available
        currentBar: null, // TODO: Get from SSE metadata if available
        jobStatus: null, // TODO: Get from SSE metadata if available
      });
    });
  }
  
  // Single interval state (backward compatibility)
  const loading = sseLoading;
  const error = sseError;
  const historicalData = sseData.length > 0 ? sseData : null;
  const dataInfo = sseMetadata ? {
    total_points: sseMetadata.total_points,
    returned_points: sseData.length,
  } : null;
  const isPartial = false; // Single-interval doesn't track partial status
  const currentBar = null; // Single-interval doesn't track current bar

  const renderSingleChart = (
    intervalValue: string,
    intervalData: HistoricalDataPoint[] | null,
    intervalDataInfo: { total_points: number; returned_points: number } | null,
    isLoading: boolean,
    hasError: string | null
  ) => {
    const chartData = intervalData
      ? {
          labels: intervalData.map(() => ''),
          datasets: [
            {
              label: 'Close Price',
              data: intervalData.map((point) => {
                if (point.close === null || point.close === undefined || isNaN(point.close)) {
                  return null;
                }
                return point.close;
              }),
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.1,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
          ],
        }
      : null;

    const intervalLabel = INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue;

    // Get partial data status for this interval
    const intervalChartData = chartsData.get(intervalValue);
    const isIntervalPartial = intervalChartData?.isPartial || false;
    const intervalCurrentBar = intervalChartData?.currentBar;
    const intervalJobStatus = intervalChartData?.jobStatus;
    
    return (
      <div key={intervalValue} className="mb-4 last:mb-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-400 font-medium">
            {intervalValue === intervals?.[0] ? `datas[0]: ${intervalLabel}` : 
             intervalValue === intervals?.[1] ? `datas[1]: ${intervalLabel}` :
             intervalValue === intervals?.[2] ? `datas[2]: ${intervalLabel}` :
             intervalLabel} ({symbol})
          </div>
          <div className="flex items-center gap-2">
            {isIntervalPartial && (
              <div className="flex items-center gap-1 text-xs text-blue-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
                </span>
                <span>Live</span>
                {intervalCurrentBar !== null && intervalCurrentBar !== undefined && (
                  <span className="text-gray-500">
                    ({intervalCurrentBar} / {intervalChartData?.dataInfo?.total_points || '?'})
                  </span>
                )}
              </div>
            )}
            {isLoading && (
              <div className="text-xs text-gray-500">Loading...</div>
            )}
          </div>
        </div>
        
        {isLoading && (
          <div className="w-full flex items-center justify-center" style={{ height: '75px' }}>
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mb-2"></div>
              <p className="text-xs text-gray-400">Loading historical data...</p>
            </div>
          </div>
        )}
        
        {hasError && (
          <div className={`w-full p-4 border rounded text-xs ${
            hasError.includes('Backend returned') 
              ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
              : hasError.includes('Charts will be available')
              ? 'bg-blue-500/10 border-blue-500 text-blue-400'
              : 'bg-red-500/10 border-red-500 text-red-400'
          }`} style={{ minHeight: '75px' }}>
            <p className="font-semibold mb-2">
              {hasError.includes('Backend returned') 
                ? '⚠️ Interval Mismatch'
                : hasError.includes('Charts will be available')
                ? 'ℹ️ Charts Pending'
                : '⚠️ Failed to load historical data'}
            </p>
            <p>{hasError}</p>
          </div>
        )}
        
        {!isLoading && !hasError && chartData && (
          <>
            <div className="w-full overflow-x-auto chart-horizontal-scroll" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#4B5563 #374151',
            }}>
              <div 
                style={{ 
                  height: '75px',
                  minWidth: intervalData && intervalData.length > 0
                    ? `${Math.max(400, intervalData.length * 3)}px`
                    : '100%',
                  width: intervalData && intervalData.length > 0
                    ? `${Math.max(400, intervalData.length * 3)}px`
                    : '100%',
                }}
              >
                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#1F2937',
                        titleColor: '#9CA3AF',
                        bodyColor: '#F3F4F6',
                        borderColor: '#4B5563',
                        borderWidth: 1,
                        callbacks: {
                          title: (tooltipItems) => {
                            if (tooltipItems.length > 0) {
                              const dataIndex = tooltipItems[0].dataIndex;
                              if (intervalData && intervalData[dataIndex] && intervalData[dataIndex].time) {
                                const timeValue = intervalData[dataIndex].time;
                                if (timeValue) {
                                  const date = new Date(timeValue);
                                  if (!isNaN(date.getTime())) {
                                    return date.toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    });
                                  }
                                }
                              }
                            }
                            return '';
                          },
                          label: (context) => {
                            return `Close Price: ₹${context.parsed.y?.toFixed(2) || 'N/A'}`;
                          },
                        },
                      },
                    },
                    scales: {
                      x: { display: false, grid: { display: false } },
                      y: {
                        display: true,
                        grid: { color: '#4B5563' },
                        ticks: { color: '#9CA3AF', font: { size: 10 } },
                      },
                    },
                    elements: { line: { borderJoinStyle: 'round' as const } },
                  }}
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Historical data: {intervalData?.length || 0} bars
              {intervalDataInfo && intervalDataInfo.total_points > intervalDataInfo.returned_points && (
                <span className="ml-2 text-yellow-400">
                  ⚠️ Showing {intervalDataInfo.returned_points} of {intervalDataInfo.total_points} total data points
                </span>
              )}
              {intervalData && intervalData.length > 50 && (
                <span className="ml-2 text-gray-400">
                  (Scroll horizontally to view all data)
                </span>
              )}
            </div>
          </>
        )}
        
        {!isLoading && !hasError && !intervalData && (
          <div className="w-full p-4 bg-yellow-500/10 border border-yellow-500 rounded text-yellow-400 text-xs" style={{ minHeight: '75px' }}>
            <p className="font-semibold mb-2">⚠️ No data available</p>
            <p>Historical data was not returned from the API.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      {isMultiTimeframe && intervals ? (
        <div className="space-y-4">
          {intervals.map((intervalValue, idx) => {
            const chartState = chartsData.get(intervalValue);
            
            if (!chartState) {
              return (
                <div key={intervalValue} className="mb-4">
                  <div className="text-xs text-gray-400 mb-2">
                    {idx === 0 ? `datas[0]: ${INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}` :
                     idx === 1 ? `datas[1]: ${INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}` :
                     idx === 2 ? `datas[2]: ${INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}` :
                     INTERVAL_OPTIONS.find(opt => opt.value === intervalValue)?.label || intervalValue}
                  </div>
                  <div className="w-full flex items-center justify-center" style={{ height: '75px' }}>
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mb-2"></div>
                      <p className="text-xs text-gray-400">Loading...</p>
                    </div>
                  </div>
                </div>
              );
            }
            
            return renderSingleChart(
              intervalValue,
              chartState.historicalData,
              chartState.dataInfo,
              chartState.loading,
              chartState.error
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400">Price Trend ({symbol})</div>
            <div className="flex items-center gap-2">
              {isPartial && (
                <div className="flex items-center gap-1 text-xs text-blue-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
                  </span>
                  <span>Live</span>
                  {currentBar !== null && currentBar !== undefined && dataInfo && (
                    <span className="text-gray-500">
                      ({currentBar} / {dataInfo.total_points})
                    </span>
                  )}
                </div>
              )}
              {loading && (
                <div className="text-xs text-gray-500">Loading...</div>
              )}
            </div>
          </div>
          
          {loading && (
            <div className="w-full flex items-center justify-center" style={{ height: '75px' }}>
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mb-2"></div>
                <p className="text-xs text-gray-400">Loading historical data...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="w-full p-4 bg-red-500/10 border border-red-500 rounded text-red-400 text-xs" style={{ minHeight: '75px' }}>
              <p className="font-semibold mb-2">⚠️ Failed to load historical data</p>
              <p>{error}</p>
            </div>
          )}
          
          {!loading && !error && historicalData && (
            <>
              <div className="w-full overflow-x-auto chart-horizontal-scroll" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#4B5563 #374151',
              }}>
                <div 
                  style={{ 
                    height: '75px',
                    minWidth: historicalData.length > 0
                      ? `${Math.max(400, historicalData.length * 3)}px`
                      : '100%',
                    width: historicalData.length > 0
                      ? `${Math.max(400, historicalData.length * 3)}px`
                      : '100%',
                  }}
                >
                  <Line
                    data={{
                      labels: historicalData.map(() => ''),
                      datasets: [
                        {
                          label: 'Close Price',
                          data: historicalData.map((point) => {
                            if (point.close === null || point.close === undefined || isNaN(point.close)) {
                              return null;
                            }
                            return point.close;
                          }),
                          borderColor: '#10B981',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          borderWidth: 2,
                          fill: true,
                          tension: 0.1,
                          pointRadius: 0,
                          pointHoverRadius: 4,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      animation: { duration: 0 },
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          enabled: true,
                          mode: 'index',
                          intersect: false,
                          backgroundColor: '#1F2937',
                          titleColor: '#9CA3AF',
                          bodyColor: '#F3F4F6',
                          borderColor: '#4B5563',
                          borderWidth: 1,
                          callbacks: {
                            title: (tooltipItems) => {
                              if (tooltipItems.length > 0) {
                                const dataIndex = tooltipItems[0].dataIndex;
                                if (historicalData && historicalData[dataIndex] && historicalData[dataIndex].time) {
                                  const timeValue = historicalData[dataIndex].time;
                                  if (timeValue) {
                                    const date = new Date(timeValue);
                                    if (!isNaN(date.getTime())) {
                                      return date.toLocaleString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true,
                                      });
                                    }
                                  }
                                }
                              }
                              return '';
                            },
                            label: (context) => {
                              return `Close Price: ₹${context.parsed.y?.toFixed(2) || 'N/A'}`;
                            },
                          },
                        },
                      },
                      scales: {
                        x: { display: false, grid: { display: false } },
                        y: {
                          display: true,
                          grid: { color: '#4B5563' },
                          ticks: { color: '#9CA3AF', font: { size: 10 } },
                        },
                      },
                      elements: { line: { borderJoinStyle: 'round' as const } },
                    }}
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Historical data: {historicalData.length} bars
                {dataInfo && dataInfo.total_points > dataInfo.returned_points && (
                  <span className="ml-2 text-yellow-400">
                    ⚠️ Showing {dataInfo.returned_points} of {dataInfo.total_points} total data points
                  </span>
                )}
                {historicalData.length > 50 && (
                  <span className="ml-2 text-gray-400">
                    (Scroll horizontally to view all data)
                  </span>
                )}
              </div>
            </>
          )}
          
          {!loading && !error && !historicalData && (
            <div className="w-full p-4 bg-yellow-500/10 border border-yellow-500 rounded text-yellow-400 text-xs" style={{ minHeight: '75px' }}>
              <p className="font-semibold mb-2">⚠️ No data available</p>
              <p>Historical data was not returned from the API.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

