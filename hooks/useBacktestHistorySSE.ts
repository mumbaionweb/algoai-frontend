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
  const isIntentionallyClosedRef = useRef(false);
  const hasReceivedConnectionRef = useRef(false);

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

    // Reset flags
    isIntentionallyClosedRef.current = false;
    hasReceivedConnectionRef.current = false;

    const url = `${baseUrl}/api/sse/backtest/history?token=${token}&limit=${limit}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Track connection timeout to detect 401 errors
    const connectionTimeout = setTimeout(() => {
      // If we haven't received a connection event after 5 seconds and connection is closed,
      // it's likely a 401 error
      if (!hasReceivedConnectionRef.current && eventSource.readyState === EventSource.CLOSED) {
        console.error('❌ SSE connection failed - likely 401 Unauthorized (token expired)');
        setError('Authentication failed. Please refresh the page.');
        setLoading(false);
        isIntentionallyClosedRef.current = true;
        eventSource.close();
      }
    }, 5000);

    eventSource.addEventListener('connection', () => {
      hasReceivedConnectionRef.current = true;
      clearTimeout(connectionTimeout);
      console.log('✅ Connected to history SSE');
      setLoading(false);
      setError(null);
    });

    eventSource.addEventListener('snapshot', (e) => {
      hasReceivedConnectionRef.current = true;
      clearTimeout(connectionTimeout);
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
          
          // Check if it's an authentication error
          if (data.error === 'Unauthorized' || data.status === 401 || data.message?.includes('401') || data.message?.includes('Unauthorized')) {
            console.error('❌ SSE 401 Unauthorized - stopping reconnection');
            setError('Authentication failed. Please refresh the page.');
            setLoading(false);
            isIntentionallyClosedRef.current = true;
            eventSource.close();
            return;
          }
          
          setError(data.message || 'Connection error');
          setLoading(false);
        } catch (err) {
          console.error('Error parsing error event:', err);
        }
      }
    });

    eventSource.onerror = () => {
      // Don't reconnect if intentionally closed (e.g., due to 401)
      if (isIntentionallyClosedRef.current) {
        console.log('🔌 SSE connection error (intentionally closed, not reconnecting)');
        return;
      }
      
      // If connection closes immediately without receiving connection event, likely 401
      if (eventSource.readyState === EventSource.CLOSED && !hasReceivedConnectionRef.current) {
        console.error('❌ SSE connection closed immediately - likely 401 Unauthorized');
        setError('Authentication failed. Please refresh the page.');
        setLoading(false);
        isIntentionallyClosedRef.current = true;
        return;
      }
      
      if (eventSource.readyState === EventSource.CLOSED) {
        if (!isIntentionallyClosedRef.current) {
          setError('Connection closed. Attempting to reconnect...');
          setLoading(false);
        }
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('🔄 SSE reconnecting...');
      } else {
        setError('Failed to connect to history');
        setLoading(false);
      }
    };

    return () => {
      clearTimeout(connectionTimeout);
      if (eventSourceRef.current) {
        isIntentionallyClosedRef.current = true;
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [token, limit, enabled]);

  return { backtests, loading, error };
}

