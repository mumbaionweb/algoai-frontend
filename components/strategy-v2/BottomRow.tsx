'use client';

import type { Strategy } from '@/types';
import { useStrategyStatusSSE } from '@/hooks/useStrategyStatusSSE';

interface BottomRowProps {
  currentStrategy: Strategy | null;
}

export default function BottomRow({ currentStrategy }: BottomRowProps) {
  // Get Firebase token for SSE
  const token = typeof window !== 'undefined' ? localStorage.getItem('firebase_token') : null;
  
  // Use SSE for real-time updates
  const { status, performance, connected } = useStrategyStatusSSE(token, currentStrategy?.id);

  // Use SSE data if available, otherwise fall back to strategy data
  const displayStatus = status || currentStrategy?.status || 'Draft';
  const displayTrades = performance?.total_trades ?? currentStrategy?.total_trades ?? 0;
  const displayWinRate = performance?.win_rate ?? currentStrategy?.win_rate ?? null;
  const displayPnl = performance?.total_pnl ?? currentStrategy?.total_pnl ?? 0;

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-gray-400">Status:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs ${
              displayStatus === 'active' ? 'bg-green-500/20 text-green-400' :
              displayStatus === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
              displayStatus === 'error' ? 'bg-red-500/20 text-red-400' :
              displayStatus === 'stopped' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {displayStatus}
            </span>
          </div>
          {currentStrategy && (
            <>
              <div>
                <span className="text-gray-400">Total Trades:</span>
                <span className="ml-2 text-white">{displayTrades}</span>
              </div>
              <div>
                <span className="text-gray-400">Win Rate:</span>
                <span className="ml-2 text-white">
                  {displayWinRate !== null ? `${displayWinRate.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Total P&L:</span>
                <span className={`ml-2 ${displayPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₹{displayPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Last updated: {currentStrategy?.updated_at ? new Date(currentStrategy.updated_at).toLocaleString() : 'Never'}
          </div>
        </div>
      </div>
    </div>
  );
}

