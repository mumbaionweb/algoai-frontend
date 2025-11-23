import { useEffect, useState, useRef } from 'react';
import type { BacktestJob } from '@/types';

interface UseBacktestJobsSSEProps {
  token: string | null;
  statusFilter?: string;
  limit?: number;
  enabled?: boolean;
}

export function useBacktestJobsSSE({
  token,
  statusFilter,
  limit = 10,
  enabled = true
}: UseBacktestJobsSSEProps) {
  const [jobs, setJobs] = useState<BacktestJob[]>([]);
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

    const params = new URLSearchParams({
      token,
      limit: limit.toString(),
    });
    if (statusFilter) {
      params.append('status_filter', statusFilter);
    }
    const url = `${baseUrl}/api/sse/backtest/jobs?${params.toString()}`;

    // Reset flags
    isIntentionallyClosedRef.current = false;
    hasReceivedConnectionRef.current = false;

    // Create SSE connection
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

    // Handle connection
    eventSource.addEventListener('connection', () => {
      hasReceivedConnectionRef.current = true;
      clearTimeout(connectionTimeout);
      console.log('✅ Connected to job listings SSE');
      setLoading(false);
      setError(null);
    });

    // Handle initial snapshot
    eventSource.addEventListener('snapshot', (e) => {
      hasReceivedConnectionRef.current = true;
      clearTimeout(connectionTimeout);
      try {
        const data = JSON.parse(e.data);
        setJobs(data.jobs || []);
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Error parsing snapshot:', err);
        setError('Failed to parse initial job list');
        setLoading(false);
      }
    });

    // Handle new job
    eventSource.addEventListener('job_added', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobs(prev => [data.job, ...prev]);
      } catch (err) {
        console.error('Error parsing job_added:', err);
      }
    });

    // Handle job update
    eventSource.addEventListener('job_updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobs(prev => prev.map(job => 
          job.job_id === data.job.job_id ? data.job : job
        ));
      } catch (err) {
        console.error('Error parsing job_updated:', err);
      }
    });

    // Handle job removal
    eventSource.addEventListener('job_removed', (e) => {
      try {
        const data = JSON.parse(e.data);
        setJobs(prev => prev.filter(job => job.job_id !== data.job_id));
      } catch (err) {
        console.error('Error parsing job_removed:', err);
      }
    });

    // Handle errors
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

    // Handle connection errors
    eventSource.onerror = (err) => {
      // Don't reconnect if intentionally closed (e.g., due to 401)
      if (isIntentionallyClosedRef.current) {
        console.log('🔌 SSE connection error (intentionally closed, not reconnecting)');
        return;
      }
      
      console.error('EventSource error:', err);
      
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
        setError('Failed to connect to job listings');
        setLoading(false);
      }
    };

    // Cleanup
    return () => {
      clearTimeout(connectionTimeout);
      if (eventSourceRef.current) {
        isIntentionallyClosedRef.current = true;
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [token, statusFilter, limit, enabled]);

  return { jobs, loading, error };
}

