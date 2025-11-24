'use client';

import type { Strategy } from '@/types';

interface TopRowProps {
  currentStrategy: Strategy | null;
  marketType: 'equity' | 'commodity' | 'currency' | 'futures';
  onMarketTypeChange: (marketType: 'equity' | 'commodity' | 'currency' | 'futures') => void;
}

export default function TopRow({ currentStrategy, marketType, onMarketTypeChange }: TopRowProps) {

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-white">
          {currentStrategy ? currentStrategy.name : 'New Strategy'}
        </h1>
        {currentStrategy && (
          <span className="text-xs text-gray-400">ID: {currentStrategy.id.slice(0, 8)}...</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Market Type Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">Market Type:</label>
          <select
            value={marketType}
            onChange={(e) => onMarketTypeChange(e.target.value as typeof marketType)}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="equity">Equity</option>
            <option value="commodity" disabled>Commodity</option>
            <option value="currency" disabled>Currency</option>
            <option value="futures" disabled>Futures</option>
          </select>
        </div>
      </div>
    </div>
  );
}

