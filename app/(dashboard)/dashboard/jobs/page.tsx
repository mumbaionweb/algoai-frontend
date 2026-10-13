'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import {
  getJobs,
  getJobLogs,
  runJob,
  updateJob,
  deleteJob,
  getJobDataPreview,
} from '@/lib/api/jobs';
import type {
  JobItem,
  JobExecutionLog,
  JobUpdatePayload,
  JobDataPreviewResponse,
} from '@/types';
import {
  BoltIcon,
  PlayIcon,
  PauseIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { DataTable, type ColumnDef } from '@/components/ui/DataTable';
import { formatCronSchedule } from '@/lib/utils/cron';

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'logs'>('jobs');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [logs, setLogs] = useState<JobExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [togglingJobId, setTogglingJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Modal State with all configurable features
  const [editingJob, setEditingJob] = useState<JobItem | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    target_url: string;
    cron_schedule: string;
    status: string;
    interval: string;
    primary_broker: string;
    fallback_broker: string;
    max_backfill_years: number;
    max_fetches_per_hour: number;
    market_hours_only: boolean;
  }>({
    name: '',
    description: '',
    target_url: '',
    cron_schedule: '',
    status: 'active',
    interval: '',
    primary_broker: 'zerodha',
    fallback_broker: 'paytm_money',
    max_backfill_years: 10,
    max_fetches_per_hour: 100,
    market_hours_only: true,
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [jobToDelete, setJobToDelete] = useState<JobItem | null>(null);

  // Ingested Data Preview Modal State
  const [viewingDataJob, setViewingDataJob] = useState<{
    jobId: string;
    jobName: string;
    log?: JobExecutionLog;
  } | null>(null);
  const [dataPreview, setDataPreview] = useState<JobDataPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const hasRunningJobs = jobs.some((j) => j.status === 'running') || runningJobId !== null;

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const poll = async () => {
      // Pause polling if browser tab is backgrounded
      if (typeof document !== 'undefined' && document.hidden) {
        timeoutId = setTimeout(poll, 6000);
        return;
      }

      try {
        if (activeTab === 'jobs') {
          const res = await getJobs();
          if (!isCancelled && res.jobs) {
            setJobs(res.jobs);
          }
        } else {
          const res = await getJobLogs();
          if (!isCancelled && res.logs) {
            setLogs(res.logs);
          }
        }
      } catch (err) {
        // Silently catch polling errors
      } finally {
        if (!isCancelled) {
          const nextInterval = hasRunningJobs ? 4000 : 10000;
          timeoutId = setTimeout(poll, nextInterval);
        }
      }
    };

    const initialInterval = hasRunningJobs ? 4000 : 10000;
    timeoutId = setTimeout(poll, initialInterval);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeTab, hasRunningJobs]);

  const handleOpenViewData = async (jobId: string, jobName: string, log?: JobExecutionLog) => {
    setViewingDataJob({ jobId, jobName, log });
    setLoadingPreview(true);
    setPreviewError(null);
    setDataPreview(null);
    try {
      const res = await getJobDataPreview(jobId, 50);
      setDataPreview(res);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to fetch data preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'jobs') {
        const res = await getJobs();
        setJobs(res.jobs || []);
      } else {
        const res = await getJobLogs();
        setLogs(res.logs || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // 1. Run Job Now (Adhoc service execution)
  const handleRunJob = async (jobId: string) => {
    setRunningJobId(jobId);
    setError(null);
    setSuccess(null);
    try {
      const res = await runJob(jobId);
      setSuccess(res.message || 'Job executed successfully in background');
      const updated = await getJobs();
      setJobs(updated.jobs || []);
      if (activeTab === 'logs') {
        fetchData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run job');
    } finally {
      setRunningJobId(null);
    }
  };

  // 2. Start (inactive -> active) / Pause (active -> inactive) schedule
  const handleToggleStatus = async (job: JobItem) => {
    const nextStatus = job.status === 'active' || job.status === 'running' ? 'inactive' : 'active';
    setTogglingJobId(job.id);
    setError(null);
    setSuccess(null);
    try {
      await updateJob(job.id, { status: nextStatus });
      setSuccess(
        `Job "${job.name}" schedule ${nextStatus === 'active' ? 'activated' : 'paused'} successfully`
      );
      const updated = await getJobs();
      setJobs(updated.jobs || []);
    } catch (err: any) {
      setError(err.message || `Failed to update status for ${job.name}`);
    } finally {
      setTogglingJobId(null);
    }
  };

  // 3. Edit modal open & populate all features
  const handleOpenEdit = (job: JobItem) => {
    setEditingJob(job);
    setEditForm({
      name: job.name || '',
      description: job.description || '',
      target_url: job.target_url || '',
      cron_schedule: job.cron_schedule || '',
      status: job.status || 'active',
      interval: job.interval || '',
      primary_broker: job.primary_broker || 'zerodha',
      fallback_broker: job.fallback_broker || 'paytm_money',
      max_backfill_years: job.max_backfill_years !== undefined ? job.max_backfill_years : 10,
      max_fetches_per_hour: job.max_fetches_per_hour !== undefined ? job.max_fetches_per_hour : 100,
      market_hours_only: job.market_hours_only !== false,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;

    if (!editForm.name.trim()) {
      setEditError('Job name is required');
      return;
    }

    setSavingEdit(true);
    setEditError(null);
    try {
      const payload: JobUpdatePayload = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        target_url: editForm.target_url.trim() || undefined,
        cron_schedule: editForm.cron_schedule.trim() || undefined,
        status: editForm.status,
        interval: editForm.interval || undefined,
        primary_broker: editForm.primary_broker || undefined,
        fallback_broker: editForm.fallback_broker || undefined,
        max_backfill_years: Number(editForm.max_backfill_years) || 10,
        max_fetches_per_hour: Number(editForm.max_fetches_per_hour) || 100,
        market_hours_only: editForm.market_hours_only,
      };

      await updateJob(editingJob.id, payload);
      setSuccess(`Job "${editForm.name}" updated successfully`);
      setEditingJob(null);
      const updated = await getJobs();
      setJobs(updated.jobs || []);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update job configuration');
    } finally {
      setSavingEdit(false);
    }
  };

  // 4. Delete job confirmation & execution
  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;

    setDeletingJobId(jobToDelete.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await deleteJob(jobToDelete.id);
      setSuccess(res.message || `Job "${jobToDelete.name}" deleted successfully`);
      setJobToDelete(null);
      const updated = await getJobs();
      setJobs(updated.jobs || []);
    } catch (err: any) {
      setError(err.message || `Failed to delete ${jobToDelete.name}`);
    } finally {
      setDeletingJobId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    status = status?.toLowerCase() || '';
    if (status === 'active') return 'badge-profit';
    if (status === 'running')
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    if (status === 'inactive' || status === 'paused') return 'badge-loss';
    if (status === 'failed' || status === 'error') return 'badge-loss';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700';
  };

  // Column Definitions for Jobs Schedule Table
  const scheduleColumns: ColumnDef<JobItem>[] = useMemo(
    () => [
      {
        key: 'actions',
        header: 'Actions',
        width: '220px',
        minWidth: '210px',
        sortable: false,
        filterable: false,
        render: (job) => (
          <div className="flex items-center space-x-2">
            {/* Run Icon: Adhoc Execution Service */}
            <button
              className="btn-action-icon btn-action-connect"
              onClick={(e) => {
                e.stopPropagation();
                handleRunJob(job.id);
              }}
              disabled={runningJobId === job.id || job.status === 'running'}
              title="Run Job Now (Adhoc Execution)"
              aria-label={`Run ${job.name} adhoc now`}
            >
              {runningJobId === job.id || job.status === 'running' ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <BoltIcon className="w-4 h-4" />
              )}
            </button>

            {/* Start (when inactive) / Pause (when active) */}
            {job.status === 'active' || job.status === 'running' ? (
              <button
                className="btn-action-icon btn-action-history"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStatus(job);
                }}
                disabled={togglingJobId === job.id}
                title="Pause Schedule (Active → Inactive)"
                aria-label={`Pause ${job.name} schedule`}
              >
                {togglingJobId === job.id ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PauseIcon className="w-4 h-4" />
                )}
              </button>
            ) : (
              <button
                className="btn-action-icon btn-action-profit"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStatus(job);
                }}
                disabled={togglingJobId === job.id}
                title="Start Schedule (Inactive → Active)"
                aria-label={`Start ${job.name} schedule`}
              >
                {togglingJobId === job.id ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PlayIcon className="w-4 h-4" />
                )}
              </button>
            )}

            {/* View Ingested Data Icon */}
            <button
              className="btn-action-icon btn-action-neutral"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenViewData(job.id, job.name);
              }}
              title="View Ingested Data & BigQuery Records"
              aria-label={`View data for ${job.name}`}
            >
              <EyeIcon className="w-4 h-4" />
            </button>

            {/* Edit Icon: Opens Configuration Pop-up */}
            <button
              className="btn-action-icon btn-action-neutral"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEdit(job);
              }}
              title="Edit Job Configuration"
              aria-label={`Edit ${job.name} config`}
            >
              <PencilSquareIcon className="w-4 h-4" />
            </button>

            {/* Delete Icon: Confirmation & Removal */}
            <button
              className="btn-action-icon btn-action-loss"
              onClick={(e) => {
                e.stopPropagation();
                setJobToDelete(job);
              }}
              title="Delete Job"
              aria-label={`Delete ${job.name}`}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ),
      },
      {
        key: 'name',
        header: 'Job Name',
        width: '280px',
        minWidth: '220px',
        sortable: true,
        filterable: true,
        accessor: (job) => job.name,
        render: (job) => (
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{job.name}</span>
            {job.interval && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                interval: {job.interval}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'description',
        header: 'Description',
        minWidth: '260px',
        sortable: true,
        filterable: true,
        accessor: (job) => job.description,
        render: (job) => (
          <span className="text-gray-600 dark:text-gray-300 max-w-sm block">
            {job.description || '-'}
          </span>
        ),
      },
      {
        key: 'target_url',
        header: 'Target URL',
        minWidth: '180px',
        sortable: true,
        filterable: true,
        accessor: (job) => job.target_url,
        render: (job) => (
          <span
            className="text-xs font-mono text-gray-500 dark:text-gray-400 max-w-xs truncate block"
            title={job.target_url}
          >
            {job.target_url || '-'}
          </span>
        ),
      },
      {
        key: 'cron_schedule',
        header: 'Schedule (Cron)',
        minWidth: '300px',
        sortable: true,
        filterable: true,
        accessor: (job) => job.cron_schedule,
        render: (job) => {
          const humanReadable = formatCronSchedule(job.cron_schedule);
          return (
            <div className="flex flex-col gap-1 items-start">
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                {humanReadable}
              </span>
              {job.cron_schedule && (
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 font-mono text-[11px] text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {job.cron_schedule}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        width: '160px',
        minWidth: '140px',
        sortable: true,
        filterable: true,
        filterType: 'select',
        accessor: (job) => job.status,
        render: (job) => (
          <div className="flex flex-col gap-1.5">
            <span
              className={`px-2.5 py-1 border rounded text-xs font-semibold uppercase w-max ${getStatusBadge(
                job.status
              )}`}
            >
              {job.status === 'running' ? (
                <span className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-[1.5px] border-blue-600 border-t-transparent rounded-full animate-spin" />
                  RUNNING{' '}
                  {job.progress_percent !== undefined
                    ? `(${job.progress_percent}%)`
                    : ''}
                </span>
              ) : (
                job.status
              )}
            </span>
            {job.status === 'running' && job.progress_percent !== undefined && (
              <div className="w-28 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${job.progress_percent}%` }}
                />
              </div>
            )}
            {job.status === 'running' && job.message && (
              <span
                className="text-[10px] text-gray-500 dark:text-gray-400 font-medium max-w-xs truncate"
                title={job.message}
              >
                {job.message}
              </span>
            )}
          </div>
        ),
      },
    ],
    [runningJobId, togglingJobId]
  );

  // Column Definitions for Execution Logs Table
  const logColumns: ColumnDef<JobExecutionLog>[] = useMemo(
    () => [
      {
        key: 'action',
        header: 'Action',
        width: '110px',
        minWidth: '100px',
        sortable: false,
        filterable: false,
        render: (log, index) => (
          <div className="flex items-center space-x-2.5">
            {/* 1 - Progress circle: Real-time animated indicator */}
            {log.status === 'running' || (runningJobId === log.job_id && index === 0) ? (
              <div
                className="relative flex items-center justify-center w-7 h-7"
                title="Job execution is currently running in background..."
              >
                <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                <span className="absolute w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              </div>
            ) : log.status === 'success' || log.status === 'completed' ? (
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-profit transition-transform hover:scale-110"
                title="Completed successfully"
              >
                <CheckCircleIcon className="w-4 h-4 text-profit" />
              </div>
            ) : log.status === 'error' || log.status === 'failed' ? (
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-loss transition-transform hover:scale-110"
                title="Execution error"
              >
                <ExclamationTriangleIcon className="w-4 h-4 text-loss" />
              </div>
            ) : (
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 transition-transform hover:scale-110"
                title={`Status: ${log.status}`}
              >
                <ClockIcon className="w-4 h-4 text-amber-500" />
              </div>
            )}

            {/* 2 - View icon: Inspect ingested data & records */}
            <button
              type="button"
              className="btn-action-icon btn-action-neutral"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenViewData(log.job_id, log.job_name, log);
              }}
              title="View Ingested Data & Execution Details"
              aria-label={`View ingested data for ${log.job_name}`}
            >
              <EyeIcon className="w-4 h-4" />
            </button>
          </div>
        ),
      },
      {
        key: 'executed_at',
        header: 'Time Executed',
        width: '220px',
        minWidth: '200px',
        sortable: true,
        filterable: true,
        accessor: (log) => log.executed_at,
        render: (log) => (
          <span className="whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">
            {formatDate(log.executed_at)}
          </span>
        ),
      },
      {
        key: 'job_name',
        header: 'Job Name',
        width: '280px',
        minWidth: '220px',
        sortable: true,
        filterable: true,
        accessor: (log) => log.job_name,
        render: (log) => (
          <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap block">
            {log.job_name}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        width: '140px',
        minWidth: '130px',
        sortable: true,
        filterable: true,
        filterType: 'select',
        accessor: (log) => log.status,
        render: (log) => (
          <span
            className={`px-2 py-0.5 border rounded text-xs font-semibold uppercase ${getStatusBadge(
              log.status
            )}`}
          >
            {log.status}
          </span>
        ),
      },
      {
        key: 'executed_by',
        header: 'Executed By',
        width: '150px',
        minWidth: '130px',
        sortable: true,
        filterable: true,
        accessor: (log) => log.executed_by,
        render: (log) => (
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
            {log.executed_by || '-'}
          </span>
        ),
      },
      {
        key: 'message',
        header: 'Message',
        minWidth: '320px',
        sortable: true,
        filterable: true,
        accessor: (log) => log.message,
        render: (log) => (
          <span
            className="text-gray-500 dark:text-gray-400 text-sm max-w-lg block truncate"
            title={log.message}
          >
            {log.message || '-'}
          </span>
        ),
      },
    ],
    [runningJobId]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans transition-colors">
      <DashboardNavigation title="Algo AI" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Job Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage, configure, execute adhoc runs, and monitor background data ingestion jobs.
          </p>
        </div>

        {error && (
          <div className="bg-loss-subtle border border-loss text-loss px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-loss hover:opacity-80 p-1">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-profit-subtle border border-profit text-profit px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-profit hover:opacity-80 p-1">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tabs & Live Refresh Indicator */}
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex">
            <button
              className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'jobs'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('jobs')}
            >
              Jobs Schedule
            </button>
            <button
              className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab('logs')}
            >
              Execution Logs
            </button>
          </div>

          <div className="flex items-center gap-2 pr-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${hasRunningJobs ? 'bg-blue-400' : 'bg-emerald-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${hasRunningJobs ? 'bg-blue-500' : 'bg-emerald-500'}`} />
            </span>
            <span>{hasRunningJobs ? 'Sync in progress' : 'Live updates active'}</span>
          </div>
        </div>

        {/* Tab Content with Global Reusable DataTable */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {activeTab === 'jobs' && (
            <DataTable<JobItem>
              data={jobs}
              columns={scheduleColumns}
              keyExtractor={(job) => job.id}
              isLoading={loading}
              loadingMessage="Loading jobs..."
              emptyMessage="No jobs configured."
              enableSearch={true}
              searchPlaceholder="Search jobs by name, schedule, description..."
            />
          )}

          {activeTab === 'logs' && (
            <DataTable<JobExecutionLog>
              data={logs}
              columns={logColumns}
              keyExtractor={(log) => log.id}
              isLoading={loading}
              loadingMessage="Loading execution logs..."
              emptyMessage="No execution logs found."
              enableSearch={true}
              searchPlaceholder="Search logs by job, status, message..."
            />
          )}
        </div>
      </main>

      {/* Comprehensive Edit Job Pop-up Modal with All Features */}
      {editingJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Edit Job Configuration
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Configure schedule, broker failover, backfill depth, and execution rails.
                </p>
              </div>
              <button
                onClick={() => setEditingJob(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Close modal"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
              {editError && (
                <div className="p-3 rounded-lg bg-loss-subtle border border-loss text-loss text-sm">
                  {editError}
                </div>
              )}

              {/* Section 1: General Job Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/60 pb-1">
                  1. General Information
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Job Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="e.g. Daily Trades Sync"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Brief explanation of what this job does"
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Job Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active (Scheduled & Executing)</option>
                    <option value="inactive">Inactive (Paused)</option>
                  </select>
                </div>
              </div>

              {/* Section 2: Scheduling & Execution Rails */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/60 pb-1">
                  2. Scheduling & Execution Rails
                </h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Schedule (Cron Expression)
                  </label>
                  <input
                    type="text"
                    value={editForm.cron_schedule}
                    onChange={(e) => setEditForm({ ...editForm, cron_schedule: e.target.value })}
                    placeholder="e.g. */15 3-10 * * 1-5"
                    className="w-full px-3.5 py-2 font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, cron_schedule: '*/15 3-10 * * 1-5' })}
                      className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-mono transition-colors"
                    >
                      Preset: 15-Min Market Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, cron_schedule: '30 16 * * 1-5' })}
                      className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-mono transition-colors"
                    >
                      Preset: Daily 4:30 PM IST
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, cron_schedule: '0 18 * * 1-5' })}
                      className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-mono transition-colors"
                    >
                      Preset: Daily 6:00 PM IST
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="market_hours_only"
                    checked={editForm.market_hours_only}
                    onChange={(e) => setEditForm({ ...editForm, market_hours_only: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-blue-500"
                  />
                  <label htmlFor="market_hours_only" className="text-xs text-gray-700 dark:text-gray-300">
                    Enforce Market Hours Window (Skip cron runs outside 08:45 – 16:00 IST Mon–Fri)
                  </label>
                </div>
              </div>

              {/* Section 3: Data Pipeline & Backfill Settings */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/60 pb-1">
                  3. Data Interval & Rate Limiting
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Data Interval
                    </label>
                    <select
                      value={editForm.interval}
                      onChange={(e) => setEditForm({ ...editForm, interval: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">None / Web Fetch</option>
                      <option value="minute">1-Minute (minute)</option>
                      <option value="3minute">3-Minute (3minute)</option>
                      <option value="5minute">5-Minute (5minute)</option>
                      <option value="15minute">15-Minute (15minute)</option>
                      <option value="60minute">60-Minute (60minute)</option>
                      <option value="day">Daily (day)</option>
                      <option value="week">Weekly (week)</option>
                      <option value="month">Monthly (month)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Backfill Depth
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={editForm.max_backfill_years}
                      onChange={(e) => setEditForm({ ...editForm, max_backfill_years: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">Max historical years (1-20)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Hourly Rate Limit
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={500}
                      value={editForm.max_fetches_per_hour}
                      onChange={(e) => setEditForm({ ...editForm, max_fetches_per_hour: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">Max API calls/hour cap</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Target URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={editForm.target_url}
                    onChange={(e) => setEditForm({ ...editForm, target_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2 font-mono text-xs bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Section 4: Broker Selection & Failover */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700/60 pb-1">
                  4. Broker Providers & Failover
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Primary Broker
                    </label>
                    <select
                      value={editForm.primary_broker}
                      onChange={(e) => setEditForm({ ...editForm, primary_broker: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="zerodha">Zerodha Kite Connect</option>
                      <option value="paytm_money">Paytm Money</option>
                      <option value="none">None / Web Source</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Fallback Broker (On Failure)
                    </label>
                    <select
                      value={editForm.fallback_broker}
                      onChange={(e) => setEditForm({ ...editForm, fallback_broker: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="paytm_money">Paytm Money</option>
                      <option value="zerodha">Zerodha Kite Connect</option>
                      <option value="none">None (Fail Fast)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 5: Architecture & Storage Details */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs space-y-1.5">
                <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px] block">
                  ⚙️ System Architecture & Guarantees
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600 dark:text-gray-400">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Destination:</span> BigQuery (`historical_data`)
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Deduplication:</span> Atomic SQL MERGE
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Universe:</span> User Traded Cash Equities
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Checkpoint State:</span> Firestore `historical_sync_state`
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingJob(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-action-icon btn-action-connect px-5 py-2 text-sm font-medium rounded-lg"
                >
                  {savingEdit ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    'Save Configuration'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {jobToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-loss-subtle border border-loss flex items-center justify-center shrink-0">
                  <ExclamationTriangleIcon className="w-6 h-6 text-loss" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Delete Job</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Are you sure you want to delete{' '}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      "{jobToDelete.name}"
                    </span>
                    ?
                  </p>
                  <p className="mt-1 text-xs text-loss">
                    This will permanently remove the job schedule and state from the system.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setJobToDelete(null)}
                  disabled={deletingJobId === jobToDelete.id}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deletingJobId === jobToDelete.id}
                  className="btn-action-icon btn-action-loss px-5 py-2 text-sm font-medium rounded-lg"
                >
                  {deletingJobId === jobToDelete.id ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    'Delete Job'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Ingested Data & Records Verification Modal */}
      {viewingDataJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <EyeIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{viewingDataJob.jobName}</span>
                    <span className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 font-mono text-gray-700 dark:text-gray-300">
                      {viewingDataJob.jobId}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Storage: <span className="font-semibold text-gray-700 dark:text-gray-300">{dataPreview?.storage_destination || 'BigQuery historical_data'}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingDataJob(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Close modal"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Optional Execution Log Context */}
              {viewingDataJob.log && (
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700/60 pb-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[11px]">
                      Execution Run Details
                    </span>
                    <span className="text-gray-500 font-mono">
                      Executed at: {formatDate(viewingDataJob.log.executed_at)}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span
                      className={`px-2 py-0.5 border rounded text-xs font-semibold uppercase shrink-0 ${getStatusBadge(
                        viewingDataJob.log.status
                      )}`}
                    >
                      {viewingDataJob.log.status}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 font-mono text-[12px] break-words">
                      {viewingDataJob.log.message}
                    </span>
                  </div>
                </div>
              )}

              {/* Checkpoint & Quota Telemetry Cards */}
              {dataPreview?.state && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 block text-[11px]">Current Symbol</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                      {dataPreview.state.current_symbol || 'None'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 block text-[11px]">Completed Symbols</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                      {dataPreview.state.completed_symbols_count ?? 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 block text-[11px]">Total Bars Synced</span>
                    <span className="text-sm font-bold text-profit font-mono">
                      {dataPreview.state.total_bars_synced?.toLocaleString() ?? 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500 block text-[11px]">Hourly API Quota</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                      {dataPreview.state.hourly_fetches_count ?? 0} / 100
                    </span>
                  </div>
                </div>
              )}

              {/* Data Table / State */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ingested Records Preview ({dataPreview?.total_records ?? 0} loaded)
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleOpenViewData(viewingDataJob.jobId, viewingDataJob.jobName, viewingDataJob.log)}
                    disabled={loadingPreview}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${loadingPreview ? 'animate-spin' : ''}`} />
                    Refresh Records
                  </button>
                </div>

                {loadingPreview ? (
                  <div className="py-12 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Querying storage for ingested records...</span>
                  </div>
                ) : previewError ? (
                  <div className="p-4 rounded-xl bg-loss-subtle border border-loss text-loss text-xs">
                    Failed to fetch preview: {previewError}
                  </div>
                ) : dataPreview && dataPreview.records.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 max-h-80">
                    <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                      <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 uppercase font-semibold text-[11px] text-gray-500 sticky top-0">
                        <tr>
                          {dataPreview.columns.map((col) => (
                            <th key={col} className="px-4 py-2.5 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                        {dataPreview.records.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            {dataPreview.columns.map((col) => {
                              const val = row[col];
                              const isNumeric = typeof val === 'number';
                              return (
                                <td key={col} className="px-4 py-2 whitespace-nowrap text-gray-900 dark:text-gray-200">
                                  {isNumeric ? Number(val).toFixed(2) : String(val ?? '-')}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 space-y-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      No Records Ingested in Storage Yet
                    </p>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      {viewingDataJob.log?.message?.includes('Outside operational window')
                        ? 'The scheduled job execution skipped because market hours (08:45 – 16:00 IST Mon-Fri) were closed.'
                        : viewingDataJob.log?.message || 'Data sync has not yet written bars to storage. Trigger an adhoc run to begin fetching immediately.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const jId = viewingDataJob.jobId;
                        setViewingDataJob(null);
                        handleRunJob(jId);
                      }}
                      className="btn-action-icon btn-action-connect px-4 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                    >
                      <BoltIcon className="w-4 h-4" />
                      Run Sync Adhoc Now
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-900/40 shrink-0">
              <button
                type="button"
                onClick={() => setViewingDataJob(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-medium transition-colors"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
