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

export const getBigqueryCacheRawData = async (symbol: string, exchange: string, interval: string, limit: number = 1000) => {
  const response = await api.get('/api/datasets/bigquery_cache/data', {
    params: { symbol, exchange, interval, limit }
  });
  return response.data;
};
