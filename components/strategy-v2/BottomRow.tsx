'use client';

import type { Strategy } from '@/types';

interface BottomRowProps {
  currentStrategy: Strategy | null;
}

export default function BottomRow({ currentStrategy }: BottomRowProps) {
  return (
    <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-gray-400">Status:</span>
            <span className="ml-2 text-white">
              {currentStrategy ? currentStrategy.status : 'Draft'}
            </span>
          </div>
          {currentStrategy && (
            <>
              <div>
                <span className="text-gray-400">Total Trades:</span>
                <span className="ml-2 text-white">{currentStrategy.total_trades}</span>
              </div>
              <div>
                <span className="text-gray-400">Win Rate:</span>
                <span className="ml-2 text-white">
                  {currentStrategy.win_rate !== null ? `${currentStrategy.win_rate.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-gray-400">Total P&L:</span>
                <span className={`ml-2 ${currentStrategy.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ₹{currentStrategy.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Last updated: {currentStrategy?.updated_at ? new Date(currentStrategy.updated_at).toLocaleString() : 'Never'}
        </div>
      </div>
    </div>
  );
}

