import React from 'react';
import type { BacktestJobStatus } from '@/types';

interface BacktestProgressProps {
  status: BacktestJobStatus;
  progress: number; // 0-100
  currentBar?: number;
  totalBars?: number;
  message?: string;
  errorMessage?: string;
}

export const BacktestProgress: React.FC<BacktestProgressProps> = ({
  status,
  progress,
  currentBar,
  totalBars,
  message,
  errorMessage,
}) => {
  const getStatusColor = (status: BacktestJobStatus): string => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      case 'paused':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: BacktestJobStatus): string => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'queued':
        return 'Queued';
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'resuming':
        return 'Resuming';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  return (
    <div className="backtest-progress">
      {/* Status Badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${getStatusColor(status)}`} />
        <span className="font-semibold text-white">{getStatusText(status)}</span>
        {status === 'running' && (
          <span className="text-sm text-gray-400">({progress.toFixed(1)}%)</span>
        )}
      </div>

      {/* Progress Bar */}
      {status === 'running' && (
        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Progress Details */}
      {(currentBar !== undefined && totalBars !== undefined) && (
        <div className="text-sm text-gray-400 mb-2">
          Processing bar {currentBar.toLocaleString()} of {totalBars.toLocaleString()}
        </div>
      )}

      {/* Message */}
      {message && (
        <div className="text-sm text-gray-400 mb-2">{message}</div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 p-2 rounded">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

