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

export const getJobDataPreview = async (
  jobId: string,
  limit: number = 50
): Promise<JobDataPreviewResponse> => {
  const response = await api.get(`/api/jobs/${jobId}/data-preview?limit=${limit}`);
  return response.data;
};
