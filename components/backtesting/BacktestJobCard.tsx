import React from 'react';
import type { BacktestJob } from '@/types';
import { BacktestProgress } from './BacktestProgress';
import { 
  cancelBacktestJob, 
  pauseBacktestJob, 
  resumeBacktestJob 
} from '@/lib/api/backtesting';
import { formatDate } from '@/utils/dateUtils';

interface BacktestJobCardProps {
  job: BacktestJob;
  onUpdate: () => void;
}

export const BacktestJobCard: React.FC<BacktestJobCardProps> = ({
  job,
  onUpdate,
}) => {
  const [actionLoading, setActionLoading] = React.useState(false);

  const handleCancel = async () => {
    try {
      setActionLoading(true);
      await cancelBacktestJob(job.job_id);
      onUpdate();
    } catch (error: any) {
      console.error('Error cancelling job:', error);
      alert('Failed to cancel job: ' + (error.response?.data?.detail || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      setActionLoading(true);
      await pauseBacktestJob(job.job_id, 'User requested');
      onUpdate();
    } catch (error: any) {
      console.error('Error pausing job:', error);
      alert('Failed to pause job: ' + (error.response?.data?.detail || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await resumeBacktestJob(job.job_id);
      onUpdate();
    } catch (error: any) {
      console.error('Error resuming job:', error);
      alert('Failed to resume job: ' + (error.response?.data?.detail || error.message));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="border border-gray-700 rounded-lg p-4 mb-4 bg-gray-800">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg text-white">
            {job.symbol} ({job.exchange})
          </h3>
          <p className="text-sm text-gray-400">
            {job.from_date} to {job.to_date}
          </p>
          <p className="text-sm text-gray-400">
            Intervals: {job.intervals.join(', ')}
          </p>
        </div>
        <div className="text-xs text-gray-500">
          {formatDate(job.created_at)}
          {job.started_at && (
            <> | Started: {formatDate(job.started_at)}</>
          )}
          {job.completed_at && (
            <> | Completed: {formatDate(job.completed_at)}</>
          )}
          {job.paused_at && (
            <> | Paused: {formatDate(job.paused_at)}</>
          )}
        </div>
      </div>

      <BacktestProgress
        status={job.status}
        progress={job.progress}
        currentBar={job.current_bar}
        totalBars={job.total_bars}
        message={job.progress_message}
        errorMessage={job.error_message}
      />

      {/* Action Buttons */}
      <div className="flex gap-2 mt-4">
        {job.can_cancel && (
          <button
            onClick={handleCancel}
            disabled={actionLoading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        )}
        {job.can_pause && (
          <button
            onClick={handlePause}
            disabled={actionLoading}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Pause
          </button>
        )}
        {job.can_resume && (
          <button
            onClick={handleResume}
            disabled={actionLoading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Resume
          </button>
        )}
      </div>

      {/* Results */}
      {job.status === 'completed' && job.result && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded">
          <h4 className="font-semibold mb-2 text-green-400">Results</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-300">
              <span className="text-gray-400">Final Value:</span> ₹{job.result.final_value != null ? job.result.final_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">Total Return:</span> {job.result.total_return_pct.toFixed(2)}%
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">Total Trades:</span> {job.result.total_trades}
            </div>
            <div className="text-gray-300">
              <span className="text-gray-400">Win Rate:</span> {job.result.win_rate?.toFixed(2) || 'N/A'}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

