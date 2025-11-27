'use client';

import type { Strategy } from '@/types';

interface LeftSidebarProps {
  strategies: Strategy[];
  currentStrategy: Strategy | null;
  onStrategySelect: (strategy: Strategy | null) => void;
  onPlayStrategy: (strategy: Strategy) => void;
  onPauseStrategy: (strategy: Strategy) => void;
  onDeleteStrategy: (strategy: Strategy) => void;
  onCollapse: () => void;
}

export default function LeftSidebar({
  strategies,
  currentStrategy,
  onStrategySelect,
  onPlayStrategy,
  onPauseStrategy,
  onDeleteStrategy,
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
        {strategies.map((strategy) => {
          const isActive = strategy.status === 'active';
          const isPaused = strategy.status === 'paused';
          const canPlay = !isActive;
          const playLabel = isPaused ? 'Resume strategy' : 'Start strategy';

          return (
            <div
              key={strategy.id}
              role="button"
              tabIndex={0}
              onClick={() => onStrategySelect(strategy)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onStrategySelect(strategy);
                }
              }}
              className={`px-4 py-3 border-b border-gray-700 hover:bg-gray-700 transition-colors cursor-pointer ${
                currentStrategy?.id === strategy.id ? 'bg-gray-700 border-l-4 border-blue-500' : ''
              }`}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{strategy.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${getStatusColor(strategy.status)}`}
                    title={getStatusLabel(strategy.status)}
                  />
                </div>
                {strategy.description && (
                  <p className="text-xs text-gray-400 truncate">{strategy.description}</p>
                )}
                <div className="flex items-center justify-between text-xs mt-1.5">
                  <div className="flex items-center gap-3 text-gray-500">
                    <span>{getStatusLabel(strategy.status)}</span>
                    {strategy.total_trades > 0 && (
                      <>
                        <span>•</span>
                        <span>{strategy.total_trades} trades</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canPlay) return;
                        onPlayStrategy(strategy);
                      }}
                      disabled={!canPlay}
                      title={playLabel}
                      className={`p-1 rounded border border-gray-600 hover:bg-gray-600 transition-colors ${
                        !canPlay ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg className="w-3 h-3 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {isPaused ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 4v16M19 12L5 4v16z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                        )}
                      </svg>
                      <span className="sr-only">{playLabel}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isActive) return;
                        onPauseStrategy(strategy);
                      }}
                      disabled={!isActive}
                      title="Pause strategy"
                      className={`p-1 rounded border border-gray-600 hover:bg-gray-600 transition-colors ${
                        !isActive ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg className="w-3 h-3 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 5v14m4-14v14" />
                      </svg>
                      <span className="sr-only">Pause</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isActive) return;
                        onDeleteStrategy(strategy);
                      }}
                      disabled={isActive}
                      title={isActive ? 'Stop strategy before deleting' : 'Delete strategy'}
                      className={`p-1 rounded border border-gray-600 hover:bg-red-600 hover:border-red-500 transition-colors ${
                        isActive ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      <svg className="w-3 h-3 text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 7h12M10 11v6m4-6v6M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7"
                        />
                      </svg>
                      <span className="sr-only">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {strategies.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No strategies yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
