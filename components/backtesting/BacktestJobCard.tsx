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
  const [progressStuckWarning, setProgressStuckWarning] = React.useState(false);
  const lastProgressRef = React.useRef<{ value: number; timestamp: number } | null>(null);

  // Detect if progress is stuck (hasn't changed for 3 minutes)
  React.useEffect(() => {
    if (job.status === 'running' && job.progress !== undefined && job.progress !== null) {
      const now = Date.now();
      const currentProgress = job.progress;

      if (lastProgressRef.current) {
        const { value: lastProgress, timestamp: lastTimestamp } = lastProgressRef.current;
        
        // If progress hasn't changed (within 0.01% tolerance)
        if (Math.abs(currentProgress - lastProgress) < 0.01) {
          // Don't update timestamp, keep the original timestamp when progress first reached this value
          // This allows us to track how long it's been stuck
        } else {
          // Progress changed, update timestamp
          lastProgressRef.current = { value: currentProgress, timestamp: now };
          setProgressStuckWarning(false);
        }
      } else {
        // First time, initialize
        lastProgressRef.current = { value: currentProgress, timestamp: now };
        setProgressStuckWarning(false);
      }
    } else {
      // Not running, clear warning
      setProgressStuckWarning(false);
      lastProgressRef.current = null;
    }
  }, [job.status, job.progress]);

  // Periodically check if progress is stuck (every 30 seconds)
  React.useEffect(() => {
    if (job.status === 'running' && job.progress !== undefined && job.progress !== null && lastProgressRef.current) {
      const checkInterval = setInterval(() => {
        const now = Date.now();
        const { value: lastProgress, timestamp: lastTimestamp } = lastProgressRef.current!;
        const currentProgress = job.progress!;
        
        // If progress hasn't changed and it's been more than 3 minutes
        if (Math.abs(currentProgress - lastProgress) < 0.01) {
          const timeSinceLastUpdate = now - lastTimestamp;
          const threeMinutes = 3 * 60 * 1000; // 3 minutes in milliseconds
          
          if (timeSinceLastUpdate > threeMinutes) {
            setProgressStuckWarning(true);
          } else {
            setProgressStuckWarning(false);
          }
        } else {
          setProgressStuckWarning(false);
        }
      }, 30000); // Check every 30 seconds

      return () => clearInterval(checkInterval);
    }
  }, [job.status, job.progress]);

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
      // Refresh job state to get updated can_pause flag
      onUpdate();
    } catch (error: any) {
      console.error('Error pausing job:', error);
      const errorDetail = error.response?.data?.detail || error.message || 'Unknown error';
      
      // Show user-friendly error message
      alert(`Failed to pause job: ${errorDetail}\n\nThis may happen if the job status changed. The job state will be refreshed.`);
      
      // Refresh job state immediately to get updated can_pause flag
      // This handles the case where backend incorrectly returned can_pause: true
      onUpdate();
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

      {/* Progress Stuck Warning */}
      {progressStuckWarning && job.status === 'running' && (
        <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-sm text-yellow-300 font-semibold mb-1">
            ⚠️ Progress appears stuck at {job.progress?.toFixed(1)}%
          </p>
          <p className="text-xs text-yellow-400">
            The job is still running and processing transactions, but the progress percentage hasn't updated in a while. 
            This may indicate a backend issue with progress calculation. The job may still complete successfully - 
            please wait or check backend logs if this persists.
          </p>
        </div>
      )}

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
        {job.can_pause && job.status === 'running' && (
          <button
            onClick={handlePause}
            disabled={actionLoading}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Pause the running backtest job"
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
      
      {/* Warning if can_pause is true but status doesn't allow pausing */}
      {job.can_pause && job.status !== 'running' && (
        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
          ⚠️ Backend indicates pause is available, but job status ({job.status}) doesn't allow pausing. This is a backend data inconsistency.
        </div>
      )}

      {/* Failed Status - Show error prominently */}
      {job.status === 'failed' && job.error_message && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded">
          <h4 className="font-semibold mb-2 text-red-400">❌ Job Failed</h4>
          <div className="text-sm text-red-300 whitespace-pre-wrap break-words">
            {job.error_message}
          </div>
          <div className="mt-2 text-xs text-gray-400">
            <p>This is a backend error. Common causes:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Strategy code syntax errors or logic issues</li>
              <li>Missing or incorrect data access (e.g., 'NoneType' object has no attribute 'datas')</li>
              <li>Invalid strategy parameters or configuration</li>
            </ul>
            <p className="mt-2">Check your strategy code and try again.</p>
          </div>
        </div>
      )}

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

