'use client';

import { useState, useEffect } from 'react';
import DashboardNavigation from '@/components/layout/DashboardNavigation';
import { getJobs, getJobLogs, runJob, updateJob } from '@/lib/api/jobs';
import { format } from 'date-fns';

export default function JobsPage() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'logs'>('jobs');
  const [jobs, setJobs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

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

  const handleRunJob = async (jobId: string) => {
    setRunningJobId(jobId);
    setError(null);
    setSuccess(null);
    try {
      const res = await runJob(jobId);
      setSuccess(res.message || 'Job executed successfully');
      if (activeTab === 'logs') {
        fetchData();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run job');
    } finally {
      setRunningJobId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy HH:mm:ss');
    } catch (e) {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    status = status?.toLowerCase() || '';
    if (status === 'active' || status === 'success') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'failed' || status === 'error') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-[#F5F2E8] font-sans">
      <DashboardNavigation />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Job Management</h1>
          <p className="text-gray-600">Manage, execute, and monitor background data ingestion jobs.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">×</button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex justify-between items-center">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">×</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'jobs' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('jobs')}
          >
            Jobs Schedule
          </button>
          <button
            className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'logs' 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('logs')}
          >
            Execution Logs
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {activeTab === 'jobs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="px-6 py-4">Job Name</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Target URL</th>
                    <th className="px-6 py-4">Schedule (Cron)</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading jobs...</td></tr>
                  ) : jobs.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No jobs configured.</td></tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">{job.name}</td>
                        <td className="px-6 py-4">{job.description}</td>
                        <td className="px-6 py-4 text-xs font-mono text-gray-500 max-w-xs truncate" title={job.target_url}>
                          {job.target_url || '-'}
                        </td>
                        <td className="px-6 py-4 font-mono">{job.cron_schedule || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 border rounded text-xs font-semibold uppercase ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          <button 
                            className="text-blue-600 hover:text-blue-800 disabled:opacity-50 inline-flex items-center"
                            onClick={() => handleRunJob(job.id)}
                            disabled={runningJobId === job.id}
                            title="Run Job Now"
                          >
                            {runningJobId === job.id ? (
                              <div className="w-4 h-4 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                            )}
                          </button>
                          <button 
                            className="text-gray-500 hover:text-gray-800 inline-flex items-center"
                            onClick={() => alert("Edit functionality coming soon")}
                            title="Edit Job Config"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                            </svg>
                          </button>
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
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                  <tr>
                    <th className="px-6 py-4">Time Executed</th>
                    <th className="px-6 py-4">Job Name</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading logs...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No execution logs found.</td></tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(log.executed_at)}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{log.job_name}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 border rounded text-xs font-semibold uppercase ${getStatusColor(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-sm max-w-lg truncate" title={log.message}>
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
    </div>
  );
}
