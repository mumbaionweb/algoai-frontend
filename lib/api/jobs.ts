import api from './client';
import type { JobItem, JobUpdatePayload, JobExecutionLog, JobDataPreviewResponse } from '@/types';

export interface JobsResponse {
  jobs: JobItem[];
}

export interface JobLogsResponse {
  logs: JobExecutionLog[];
}

export const getJobs = async (): Promise<JobsResponse> => {
  const response = await api.get('/api/jobs');
  return response.data;
};

export const getJobLogs = async (): Promise<JobLogsResponse> => {
  const response = await api.get('/api/jobs/logs');
  return response.data;
};

export const runJob = async (jobId: string): Promise<{ status: string; message: string }> => {
  const response = await api.post(`/api/jobs/${jobId}/run`);
  return response.data;
};

export const updateJob = async (
  jobId: string,
  jobData: JobUpdatePayload
): Promise<{ status: string; message: string; job?: JobItem }> => {
  const response = await api.put(`/api/jobs/${jobId}`, jobData);
  return response.data;
};

export const deleteJob = async (
  jobId: string
): Promise<{ status: string; message: string }> => {
  const response = await api.delete(`/api/jobs/${jobId}`);
  return response.data;
};

export interface JobDataPreviewParams {
  limit?: number;
  page?: number;
  search?: string;
  symbol?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
  filters?: Record<string, any>;
  refresh?: boolean;
}

export const getJobDataPreview = async (
  jobId: string,
  params: number | JobDataPreviewParams = 50
): Promise<JobDataPreviewResponse> => {
  let queryStr = '';
  if (typeof params === 'number') {
    queryStr = `limit=${params}&page=1`;
  } else {
    const qp = new URLSearchParams();
    if (params.limit !== undefined) qp.append('limit', String(params.limit));
    if (params.page !== undefined) qp.append('page', String(params.page));
    if (params.search) qp.append('search', params.search);
    if (params.symbol) qp.append('symbol', params.symbol);
    if (params.status) qp.append('status', params.status);
    if (params.from_date) qp.append('from_date', params.from_date);
    if (params.to_date) qp.append('to_date', params.to_date);
    if (params.filters && Object.keys(params.filters).length > 0) {
      qp.append('filters', JSON.stringify(params.filters));
    }
    if (params.refresh) qp.append('refresh', 'true');
    queryStr = qp.toString();
  }
  const response = await api.get(`/api/jobs/${jobId}/data-preview?${queryStr}`);
  return response.data;
};
