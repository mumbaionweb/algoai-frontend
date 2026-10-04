import api from './client';

export const getDatasets = async () => {
  const response = await api.get('/api/datasets');
  return response.data;
};

export const getDatasetData = async (datasetId: string, limit: number = 100) => {
  const response = await api.get(`/api/datasets/${datasetId}`, {
    params: { limit }
  });
  return response.data;
};
