import api from './config';

export const getJobs = async () => {
  const response = await api.get('/api/jobs');
  return response.data;
};

export const getJobLogs = async () => {
  const response = await api.get('/api/jobs/logs');
  return response.data;
};

export const runJob = async (jobId: string) => {
  const response = await api.post(`/api/jobs/${jobId}/run`);
  return response.data;
};

export const updateJob = async (jobId: string, jobData: any) => {
  const response = await api.put(`/api/jobs/${jobId}`, jobData);
  return response.data;
};
