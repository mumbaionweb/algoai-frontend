import { useEffect, useState, useRef } from 'react';
import type { BacktestHistoryItem } from '@/types';

interface UseBacktestHistorySSEProps {
  token: string | null;
  limit?: number;
  enabled?: boolean;
}

export function useBacktestHistorySSE({
  token,
  limit = 10,
  enabled = true
}: UseBacktestHistorySSEProps) {
  const [backtests, setBacktests] = useState<BacktestHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !token) {
      setLoading(false);
      return;
    }

    // Build URL
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
    let baseUrl: string;
    try {
      const apiUrl = new URL(API_URL);
      baseUrl = `${apiUrl.protocol}//${apiUrl.host}`;
    } catch {
      baseUrl = API_URL.replace(/\/$/, '');
    }

    const url = `${baseUrl}/api/sse/backtest/history?token=${token}&limit=${limit}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connection', () => {
      console.log('✅ Connected to history SSE');
      setLoading(false);
      setError(null);
    });

    eventSource.addEventListener('snapshot', (e) => {
      try {
        const data = JSON.parse(e.data);
        setBacktests(data.backtests || []);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error parsing snapshot:', err);
        setError('Failed to parse history');
        setLoading(false);
      }
    });

    eventSource.addEventListener('backtest_added', (e) => {
      try {
        const data = JSON.parse(e.data);
        setBacktests(prev => [data.backtest, ...prev]);
      } catch (err) {
        console.error('Error parsing backtest_added:', err);
      }
    });

    eventSource.addEventListener('backtest_updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        setBacktests(prev => prev.map(bt => 
          (bt.id === data.backtest.id || bt.backtest_id === data.backtest.backtest_id)
            ? data.backtest
            : bt
        ));
      } catch (err) {
        console.error('Error parsing backtest_updated:', err);
      }
    });

    eventSource.addEventListener('error', (e) => {
      // Check if it's a MessageEvent with data (custom error event from server)
      if (e instanceof MessageEvent && e.data) {
        try {
          const data = JSON.parse(e.data);
          console.error('SSE error event:', data);
          setError(data.message || 'Connection error');
          setLoading(false);
        } catch (err) {
          console.error('Error parsing error event:', err);
        }
      }
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        setError('Connection closed. Attempting to reconnect...');
        setLoading(false);
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('🔄 SSE reconnecting...');
      } else {
        setError('Failed to connect to history');
        setLoading(false);
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [token, limit, enabled]);

  return { backtests, loading, error };
}

