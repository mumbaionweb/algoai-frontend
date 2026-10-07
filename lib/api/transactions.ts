import { apiClient } from './client';

export async function uploadTransactionsCSV(file: File, profileId: string = "default", brokerId: string = "default") {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('profile_id', profileId);
  formData.append('broker_id', brokerId);

  const token = localStorage.getItem('firebase_token');
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
  
  const response = await fetch(`${baseUrl}/api/transactions/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = 'Upload failed';
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
    } catch (e) {
      errorMsg = errorText || `Upload failed with status ${response.status}`;
    }
    throw new Error(errorMsg);
  }

  return await response.json();
}

export async function getStoredTransactions() {
  const response = await apiClient.get('/api/transactions/');
  return response.data;
}

export async function deleteTransaction(transactionId: string) {
  const response = await apiClient.delete(`/api/transactions/${transactionId}`);
  return response.data;
}

export async function updateTransaction(transactionId: string, data: any) {
  const response = await apiClient.put(`/api/transactions/${transactionId}`, data);
  return response.data;
}

export async function bulkDeleteTransactions(transactionIds: string[]) {
  const response = await apiClient.post('/api/transactions/bulk_delete', { transaction_ids: transactionIds });
  return response.data;
}
