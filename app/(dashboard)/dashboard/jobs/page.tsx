'use client';

import { useState, useEffect } from 'react';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getJobs, getJobLogs, runJob, updateJob, deleteJob } from '@/lib/api/jobs';
import type { JobItem, JobExecutionLog, JobUpdatePayload } from '@/types';
import {
  BoltIcon,
  PlayIcon,
  PauseIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

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

  // Edit Modal State
  const [editingJob, setEditingJob] = useState<JobItem | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    description: string;
    target_url: string;
    cron_schedule: string;
    status: string;
    interval: string;
  }>({
    name: '',
    description: '',
    target_url: '',
    cron_schedule: '',
    status: 'active',
    interval: '',
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [jobToDelete, setJobToDelete] = useState<JobItem | null>(null);

  const hasRunningJobs = jobs.some((j) => j.status === 'running');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (activeTab === 'jobs' && hasRunningJobs) {
      intervalId = setInterval(() => {
        getJobs()
          .then((res) => setJobs(res.jobs || []))
          .catch(console.error);
      }, 2000);
    }
    return () => clearInterval(intervalId);
  }, [activeTab, hasRunningJobs]);

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
      // Refresh jobs list to reflect running state
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

  // 3. Edit modal open & submit
  const handleOpenEdit = (job: JobItem) => {
    setEditingJob(job);
    setEditForm({
      name: job.name || '',
      description: job.description || '',
      target_url: job.target_url || '',
      cron_schedule: job.cron_schedule || '',
      status: job.status || 'active',
      interval: job.interval || '',
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
      };

      if (editForm.interval) {
        payload.interval = editForm.interval;
      }

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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
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

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {activeTab === 'jobs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4 text-left">Actions</th>
                    <th className="px-6 py-4">Job Name</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Target URL</th>
                    <th className="px-6 py-4">Schedule (Cron)</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        Loading jobs...
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No jobs configured.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        {/* Action Column on the LEFT */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            {/* Run Icon: Adhoc Execution Service */}
                            <button
                              className="btn-action-icon btn-action-connect"
                              onClick={() => handleRunJob(job.id)}
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
                                onClick={() => handleToggleStatus(job)}
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
                                onClick={() => handleToggleStatus(job)}
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

                            {/* Edit Icon: Opens Configuration Pop-up */}
                            <button
                              className="btn-action-icon btn-action-neutral"
                              onClick={() => handleOpenEdit(job)}
                              title="Edit Job Configuration"
                              aria-label={`Edit ${job.name} config`}
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>

                            {/* Delete Icon: Confirmation & Removal */}
                            <button
                              className="btn-action-icon btn-action-loss"
                              onClick={() => setJobToDelete(job)}
                              title="Delete Job"
                              aria-label={`Delete ${job.name}`}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                        {/* Job Name */}
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{job.name}</span>
                            {job.interval && (
                              <span className="text-[11px] text-gray-500 font-mono mt-0.5">
                                interval: {job.interval}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Description */}
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-300 max-w-sm">
                          {job.description || '-'}
                        </td>

                        {/* Target URL */}
                        <td
                          className="px-6 py-4 text-xs font-mono text-gray-500 max-w-xs truncate"
                          title={job.target_url}
                        >
                          {job.target_url || '-'}
                        </td>

                        {/* Schedule (Cron) */}
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 font-mono text-xs text-gray-700 dark:text-gray-300">
                            {job.cron_schedule || '-'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
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
                                className="text-[10px] text-gray-500 font-medium max-w-xs truncate"
                                title={job.message}
                              >
                                {job.message}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4">Time Executed</th>
                    <th className="px-6 py-4">Job Name</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Executed By</th>
                    <th className="px-6 py-4">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        Loading logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No execution logs found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(log.executed_at)}</td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          {log.job_name}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 border rounded text-xs font-semibold uppercase ${getStatusBadge(
                              log.status
                            )}`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-gray-500 dark:text-gray-400">
                          {log.executed_by || '-'}
                        </td>
                        <td
                          className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm max-w-lg truncate"
                          title={log.message}
                        >
                          {log.message}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Edit Job Pop-up Modal */}
      {editingJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Edit Job Configuration
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Modify job name, schedule, target URL, and execution settings.
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

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-loss-subtle border border-loss text-loss text-sm">
                  {editError}
                </div>
              )}

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Schedule (Cron)
                  </label>
                  <input
                    type="text"
                    value={editForm.cron_schedule}
                    onChange={(e) => setEditForm({ ...editForm, cron_schedule: e.target.value })}
                    placeholder="e.g. 30 16 * * 1-5"
                    className="w-full px-3.5 py-2 font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">min hr day month weekday</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
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

              {editingJob.interval !== undefined && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                    Data Interval
                  </label>
                  <select
                    value={editForm.interval}
                    onChange={(e) => setEditForm({ ...editForm, interval: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="minute">1-Minute (minute)</option>
                    <option value="3minute">3-Minute (3minute)</option>
                    <option value="5minute">5-Minute (5minute)</option>
                    <option value="15minute">15-Minute (15minute)</option>
                    <option value="60minute">60-Minute (60minute)</option>
                    <option value="day">Daily (day)</option>
                  </select>
                </div>
              )}

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
                    'Save Changes'
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
    </div>
  );
}
