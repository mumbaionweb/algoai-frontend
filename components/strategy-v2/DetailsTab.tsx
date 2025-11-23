'use client';

import type { Strategy } from '@/types';

interface DetailsTabProps {
  currentStrategy: Strategy | null;
}

export default function DetailsTab({ currentStrategy }: DetailsTabProps) {
  if (!currentStrategy) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-sm">No strategy selected</p>
          <p className="text-gray-500 text-xs mt-1">Create or select a strategy to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Basic Information</h3>
          <div className="bg-gray-700 rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Name:</span>
              <span className="text-sm text-white">{currentStrategy.name}</span>
            </div>
            {currentStrategy.description && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Description:</span>
                <span className="text-sm text-white">{currentStrategy.description}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Status:</span>
              <span className="text-sm text-white capitalize">{currentStrategy.status}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Performance</h3>
          <div className="bg-gray-700 rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Total Trades:</span>
              <span className="text-sm text-white">{currentStrategy.total_trades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Win Rate:</span>
              <span className="text-sm text-white">
                {currentStrategy.win_rate !== null ? `${currentStrategy.win_rate.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-400">Total P&L:</span>
              <span className={`text-sm font-semibold ${currentStrategy.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ₹{currentStrategy.total_pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {currentStrategy.parameters && Object.keys(currentStrategy.parameters).length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Parameters</h3>
            <div className="bg-gray-700 rounded-lg p-3 space-y-2">
              {Object.entries(currentStrategy.parameters).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-gray-400">{key}:</span>
                  <span className="text-sm text-white">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Timestamps</h3>
          <div className="bg-gray-700 rounded-lg p-3 space-y-2">
            {currentStrategy.created_at && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Created:</span>
                <span className="text-sm text-white">
                  {new Date(currentStrategy.created_at).toLocaleString()}
                </span>
              </div>
            )}
            {currentStrategy.updated_at && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-400">Updated:</span>
                <span className="text-sm text-white">
                  {new Date(currentStrategy.updated_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

