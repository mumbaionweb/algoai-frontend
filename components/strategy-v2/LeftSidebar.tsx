'use client';

import { useState } from 'react';
import type { Strategy } from '@/types';

interface LeftSidebarProps {
  strategies: Strategy[];
  currentStrategy: Strategy | null;
  onStrategySelect: (strategy: Strategy | null) => void;
  onCollapse: () => void;
}

export default function LeftSidebar({
  strategies,
  currentStrategy,
  onStrategySelect,
  onCollapse,
}: LeftSidebarProps) {
  const getStatusColor = (status: Strategy['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'stopped':
        return 'bg-red-500';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: Strategy['status']) => {
    switch (status) {
      case 'active':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'stopped':
        return 'Stopped';
      case 'error':
        return 'Error';
      default:
        return 'Draft';
    }
  };

  return (
    <div className="h-full bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-white">Strategies</h2>
        <button
          onClick={onCollapse}
          className="text-gray-400 hover:text-white transition-colors"
          title="Collapse sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Strategies List */}
      <div className="flex-1 overflow-y-auto">
        {/* New Strategy Button */}
        <button
          onClick={() => onStrategySelect(null)}
          className={`w-full text-left px-4 py-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${
            currentStrategy === null ? 'bg-gray-700' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm text-gray-300">New Strategy</span>
          </div>
        </button>

        {/* Strategy Items */}
        {strategies.map((strategy) => (
          <button
            key={strategy.id}
            onClick={() => onStrategySelect(strategy)}
            className={`w-full text-left px-4 py-3 border-b border-gray-700 hover:bg-gray-700 transition-colors ${
              currentStrategy?.id === strategy.id ? 'bg-gray-700 border-l-4 border-blue-500' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white truncate">{strategy.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${getStatusColor(strategy.status)}`}
                    title={getStatusLabel(strategy.status)}
                  />
                </div>
                {strategy.description && (
                  <p className="text-xs text-gray-400 truncate">{strategy.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{getStatusLabel(strategy.status)}</span>
                  {strategy.total_trades > 0 && (
                    <>
                      <span>•</span>
                      <span>{strategy.total_trades} trades</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}

        {strategies.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No strategies yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

