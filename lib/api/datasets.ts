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

export const getBigqueryCacheRawData = async (symbol: string, exchange: string = 'NSE', interval: string = 'minute', limit: number = 5000) => {
  const response = await api.get('/api/datasets/bigquery_cache/data', {
    params: { symbol, exchange, interval, limit }
  });
  return response.data;
};

export const getBigqueryCacheIntervals = async (symbol: string, exchange: string = 'NSE') => {
  const response = await api.get('/api/datasets/bigquery_cache/intervals', {
    params: { symbol, exchange }
  });
  return response.data;
};

export const getStockNameMap = async (): Promise<Record<string, string>> => {
  const response = await api.get('/api/datasets/nse_equities/names');
  return response.data || {};
};
