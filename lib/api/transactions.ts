import { getAuth } from 'firebase/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';

export async function uploadTransactionsCSV(file: File) {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error('User not authenticated');
  const token = await user.getIdToken();

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/transactions/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload CSV');
  }

  return response.json();
}

export async function getStoredTransactions() {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) throw new Error('User not authenticated');
  const token = await user.getIdToken();

  const response = await fetch(`${API_BASE_URL}/transactions/`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to fetch transactions');
  }

  return response.json();
}
