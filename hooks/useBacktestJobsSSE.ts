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

    // Create SSE connection
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    // Handle connection
    eventSource.addEventListener('connection', () => {
      console.log('✅ Connected to job listings SSE');
      setLoading(false);
      setError(null);
    });

    // Handle initial snapshot
    eventSource.addEventListener('snapshot', (e) => {
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
          setError(data.message || 'Connection error');
          setLoading(false);
        } catch (err) {
          console.error('Error parsing error event:', err);
        }
      }
    });

    // Handle connection errors
    eventSource.onerror = (err) => {
      console.error('EventSource error:', err);
      if (eventSource.readyState === EventSource.CLOSED) {
        setError('Connection closed. Attempting to reconnect...');
        setLoading(false);
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        console.log('🔄 SSE reconnecting...');
      } else {
        setError('Failed to connect to job listings');
        setLoading(false);
      }
    };

    // Cleanup
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [token, statusFilter, limit, enabled]);

  return { jobs, loading, error };
}

