import { apiClient } from './client';

export async function uploadTransactionsCSV(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/api/transactions/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  return response.data;
}

export async function getStoredTransactions() {
  const response = await apiClient.get('/api/transactions/');
  return response.data;
}
