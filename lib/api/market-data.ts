import { apiClient } from './client';

export async function getQuotes(symbols: string[]) {
  if (!symbols || symbols.length === 0) return {};
  const query = symbols.map(s => `NSE:${s}`).join(',');
  try {
    const response = await apiClient.get<any>(`/api/market-data/quote?symbols=${encodeURIComponent(query)}`);
    return response || [];
  } catch (err) {
    console.error('Failed to fetch quotes:', err);
    return [];
  }
}
