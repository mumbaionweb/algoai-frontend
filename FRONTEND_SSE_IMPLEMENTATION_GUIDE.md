# Frontend SSE Implementation Guide



## 📋 Overview



This guide provides step-by-step instructions for implementing Server-Sent Events (SSE) in the frontend to replace REST API polling and WebSocket connections.



**Why SSE?**

- ✅ Real-time updates without polling

- ✅ Lower latency (instant updates)

- ✅ Simpler than WebSocket

- ✅ Built-in auto-reconnect

- ✅ Standard HTTP (easier debugging)



---



## 🚀 Quick Start



### Basic SSE Connection



```javascript

// Connect to job listings SSE

const eventSource = new EventSource(

  `/api/sse/backtest/jobs?limit=10&token=${firebaseToken}`

);



// Listen for events

eventSource.addEventListener('snapshot', (e) => {

  const data = JSON.parse(e.data);

  console.log('Initial jobs:', data.jobs);

});



eventSource.addEventListener('job_added', (e) => {

  const data = JSON.parse(e.data);

  console.log('New job:', data.job);

});



// Clean up when done

eventSource.close();

```



---



## 📦 React Implementation



### 1. Custom Hook for Job Listings



```typescript

// hooks/useBacktestJobsSSE.ts

import { useEffect, useState, useRef } from 'react';



interface Job {

  job_id: string;

  status: string;

  progress: number;

  symbol: string;

  // ... other fields

}



interface UseBacktestJobsSSEProps {

  token: string;

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

  const [jobs, setJobs] = useState<Job[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);



  useEffect(() => {

    if (!enabled || !token) return;



    // Build URL

    const params = new URLSearchParams({

      token,

      limit: limit.toString(),

    });

    if (statusFilter) {

      params.append('status_filter', statusFilter);

    }

    const url = `/api/sse/backtest/jobs?${params.toString()}`;



    // Create SSE connection

    const eventSource = new EventSource(url);

    eventSourceRef.current = eventSource;



    // Handle connection

    eventSource.addEventListener('connection', (e) => {

      console.log('✅ Connected to job listings SSE');

      setLoading(false);

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

      console.error('SSE error:', e);

      setError('Connection error. Attempting to reconnect...');

      setLoading(false);

    });



    // Handle connection errors

    eventSource.onerror = (err) => {

      console.error('EventSource error:', err);

      setError('Failed to connect to job listings');

      setLoading(false);

      

      // Auto-reconnect after 5 seconds

      setTimeout(() => {

        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {

          eventSource.close();

          // Reconnect by re-running effect

          setLoading(true);

        }

      }, 5000);

    };



    // Cleanup

    return () => {

      eventSource.close();

      eventSourceRef.current = null;

    };

  }, [token, statusFilter, limit, enabled]);



  return { jobs, loading, error };

}

```



**Usage:**

```tsx

function JobListPage() {

  const { token } = useAuth();

  const { jobs, loading, error } = useBacktestJobsSSE({

    token,

    statusFilter: 'running',

    limit: 10

  });



  if (loading) return <div>Loading jobs...</div>;

  if (error) return <div>Error: {error}</div>;



  return (

    <div>

      {jobs.map(job => (

        <JobCard key={job.job_id} job={job} />

      ))}

    </div>

  );

}

```



---



### 2. Custom Hook for Backtest History



```typescript

// hooks/useBacktestHistorySSE.ts

import { useEffect, useState, useRef } from 'react';



interface Backtest {

  id: string;

  backtest_id: string;

  symbol: string;

  status: string;

  // ... other fields

}



interface UseBacktestHistorySSEProps {

  token: string;

  limit?: number;

  enabled?: boolean;

}



export function useBacktestHistorySSE({

  token,

  limit = 10,

  enabled = true

}: UseBacktestHistorySSEProps) {

  const [backtests, setBacktests] = useState<Backtest[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);



  useEffect(() => {

    if (!enabled || !token) return;



    const url = `/api/sse/backtest/history?token=${token}&limit=${limit}`;

    const eventSource = new EventSource(url);

    eventSourceRef.current = eventSource;



    eventSource.addEventListener('connection', () => {

      console.log('✅ Connected to history SSE');

      setLoading(false);

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

      console.error('SSE error:', e);

      setError('Connection error');

      setLoading(false);

    });



    eventSource.onerror = () => {

      setError('Failed to connect to history');

      setLoading(false);

    };



    return () => {

      eventSource.close();

      eventSourceRef.current = null;

    };

  }, [token, limit, enabled]);



  return { backtests, loading, error };

}

```



**Usage:**

```tsx

function HistoryPage() {

  const { token } = useAuth();

  const { backtests, loading, error } = useBacktestHistorySSE({

    token,

    limit: 10

  });



  if (loading) return <div>Loading history...</div>;

  if (error) return <div>Error: {error}</div>;



  return (

    <div>

      {backtests.map(backtest => (

        <BacktestCard key={backtest.id} backtest={backtest} />

      ))}

    </div>

  );

}

```



---



### 3. Custom Hook for Job Progress



```typescript

// hooks/useBacktestProgressSSE.ts

import { useEffect, useState, useRef } from 'react';



interface ProgressData {

  status: string;

  progress: number;

  current_bar?: number;

  total_bars?: number;

  message?: string;

}



interface Transaction {

  // ... transaction fields

}



interface UseBacktestProgressSSEProps {

  jobId: string;

  token: string;

  enabled?: boolean;

}



export function useBacktestProgressSSE({

  jobId,

  token,

  enabled = true

}: UseBacktestProgressSSEProps) {

  const [progress, setProgress] = useState<ProgressData | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [result, setResult] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);



  useEffect(() => {

    if (!enabled || !token || !jobId) return;



    const url = `/api/sse/backtest/${jobId}?token=${token}`;

    const eventSource = new EventSource(url);

    eventSourceRef.current = eventSource;



    eventSource.addEventListener('connection', () => {

      console.log(`✅ Connected to progress SSE for job ${jobId}`);

      setLoading(false);

    });



    eventSource.addEventListener('progress', (e) => {

      try {

        const data = JSON.parse(e.data);

        setProgress(data);

      } catch (err) {

        console.error('Error parsing progress:', err);

      }

    });



    eventSource.addEventListener('transaction', (e) => {

      try {

        const data = JSON.parse(e.data);

        setTransactions(prev => [...prev, ...data.transactions]);

      } catch (err) {

        console.error('Error parsing transaction:', err);

      }

    });



    eventSource.addEventListener('completed', (e) => {

      try {

        const data = JSON.parse(e.data);

        setResult(data.result_summary || data);

        setProgress(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);

      } catch (err) {

        console.error('Error parsing completed:', err);

      }

    });



    eventSource.addEventListener('failed', (e) => {

      try {

        const data = JSON.parse(e.data);

        setError(data.error_message || 'Job failed');

        setProgress(prev => prev ? { ...prev, status: 'failed' } : null);

      } catch (err) {

        console.error('Error parsing failed:', err);

      }

    });



    eventSource.addEventListener('cancelled', (e) => {

      setProgress(prev => prev ? { ...prev, status: 'cancelled' } : null);

    });



    eventSource.addEventListener('error', (e) => {

      console.error('SSE error:', e);

      setError('Connection error');

      setLoading(false);

    });



    eventSource.onerror = () => {

      setError('Failed to connect to job progress');

      setLoading(false);

    };



    return () => {

      eventSource.close();

      eventSourceRef.current = null;

    };

  }, [jobId, token, enabled]);



  return { progress, transactions, result, loading, error };

}

```



**Usage:**

```tsx

function JobDetailPage({ jobId }: { jobId: string }) {

  const { token } = useAuth();

  const { progress, transactions, result, loading, error } = useBacktestProgressSSE({

    jobId,

    token

  });



  if (loading) return <div>Loading progress...</div>;

  if (error) return <div>Error: {error}</div>;



  return (

    <div>

      <ProgressBar value={progress?.progress || 0} />

      <StatusBadge status={progress?.status} />

      <TransactionList transactions={transactions} />

      {result && <ResultsSummary result={result} />}

    </div>

  );

}

```



---



### 4. Custom Hook for Historical Data (Charts)



```typescript

// hooks/useBacktestDataSSE.ts

import { useEffect, useState, useRef } from 'react';



interface DataPoint {

  time: string;

  open: number;

  high: number;

  low: number;

  close: number;

  volume: number;

}



interface UseBacktestDataSSEProps {

  id: string; // job_id or backtest_id

  interval: string;

  token: string;

  limit?: number;

  enabled?: boolean;

}



export function useBacktestDataSSE({

  id,

  interval,

  token,

  limit = 1000,

  enabled = true

}: UseBacktestDataSSEProps) {

  const [data, setData] = useState<DataPoint[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [progress, setProgress] = useState({ points_sent: 0, total_points: 0 });

  const eventSourceRef = useRef<EventSource | null>(null);



  useEffect(() => {

    if (!enabled || !token || !id || !interval) return;



    const url = `/api/sse/backtest/${id}/data?interval=${interval}&limit=${limit}&token=${token}`;

    const eventSource = new EventSource(url);

    eventSourceRef.current = eventSource;



    eventSource.addEventListener('interval_start', (e) => {

      try {

        const data = JSON.parse(e.data);

        setData([]); // Reset data

        setLoading(true);

        setProgress({ points_sent: 0, total_points: data.total_points || 0 });

      } catch (err) {

        console.error('Error parsing interval_start:', err);

      }

    });



    eventSource.addEventListener('data_chunk', (e) => {

      try {

        const data = JSON.parse(e.data);

        setData(prev => [...prev, ...data.data_points]);

        setProgress({

          points_sent: data.points_sent || 0,

          total_points: data.total_points || 0

        });

      } catch (err) {

        console.error('Error parsing data_chunk:', err);

      }

    });



    eventSource.addEventListener('complete', (e) => {

      try {

        const data = JSON.parse(e.data);

        setLoading(false);

        setProgress(prev => ({ ...prev, points_sent: data.total_points || 0 }));

      } catch (err) {

        console.error('Error parsing complete:', err);

      }

    });



    eventSource.addEventListener('error', (e) => {

      try {

        const data = JSON.parse(e.data);

        setError(data.message || 'Error loading data');

        setLoading(false);

      } catch (err) {

        console.error('Error parsing error event:', err);

      }

    });



    eventSource.onerror = () => {

      setError('Failed to connect to data stream');

      setLoading(false);

    };



    return () => {

      eventSource.close();

      eventSourceRef.current = null;

    };

  }, [id, interval, token, limit, enabled]);



  return { data, loading, error, progress };

}

```



**Usage:**

```tsx

function ChartComponent({ backtestId, interval }: { backtestId: string; interval: string }) {

  const { token } = useAuth();

  const { data, loading, error, progress } = useBacktestDataSSE({

    id: backtestId,

    interval,

    token

  });



  useEffect(() => {

    if (data.length > 0) {

      // Update chart with new data

      updateChart(data);

    }

  }, [data]);



  if (loading) return <div>Loading chart data... {progress.points_sent}/{progress.total_points}</div>;

  if (error) return <div>Error: {error}</div>;



  return <Chart data={data} />;

}

```



---



### 5. Custom Hook for Multi-Interval Data (Using Multiple Single-Interval Connections)



> **Note:** This implementation uses multiple single-interval SSE connections for parallel loading, which is the recommended approach for better performance and independence.

```typescript

// hooks/useBacktestMultiIntervalSSE.ts

import { useEffect, useState, useRef } from 'react';



interface DataPoint {

  time: string;

  open: number;

  high: number;

  low: number;

  close: number;

  volume: number;

}



interface UseBacktestMultiIntervalSSEProps {

  id: string;

  intervals: string[]; // e.g., ['day', 'minute', '3minute']

  token: string;

  limit?: number;

  enabled?: boolean;

}



export function useBacktestMultiIntervalSSE({

  id,

  intervals,

  token,

  limit = 1000,

  enabled = true

}: UseBacktestMultiIntervalSSEProps) {

  const [dataByInterval, setDataByInterval] = useState<Record<string, DataPoint[]>>({});

  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const [error, setError] = useState<string | null>(null);

  const clientsRef = useRef<Map<string, EventSource>>(new Map());



  useEffect(() => {

    if (!enabled || !token || !id || intervals.length === 0) return;



    // Initialize loading state for all intervals

    const initialLoading: Record<string, boolean> = {};

    intervals.forEach(interval => {

      initialLoading[interval] = true;

      setDataByInterval(prev => ({ ...prev, [interval]: [] }));

    });

    setLoading(initialLoading);



    // Create one SSE connection per interval for parallel loading

    intervals.forEach(interval => {

      const url = `/api/sse/backtest/${id}/data?interval=${interval}&limit=${limit}&token=${token}`;

      const eventSource = new EventSource(url);

      clientsRef.current.set(interval, eventSource);



      eventSource.addEventListener('interval_start', (e) => {

        try {

          const data = JSON.parse(e.data);

          setLoading(prev => ({ ...prev, [interval]: true }));

          setDataByInterval(prev => ({ ...prev, [interval]: [] }));

        } catch (err) {

          console.error(`Error parsing interval_start for ${interval}:`, err);

        }

      });



      eventSource.addEventListener('data_chunk', (e) => {

        try {

          const data = JSON.parse(e.data);

          setDataByInterval(prev => ({

            ...prev,

            [interval]: [...(prev[interval] || []), ...data.data_points]

          }));

        } catch (err) {

          console.error(`Error parsing data_chunk for ${interval}:`, err);

        }

      });



      eventSource.addEventListener('complete', (e) => {

        try {

          setLoading(prev => ({ ...prev, [interval]: false }));

        } catch (err) {

          console.error(`Error parsing complete for ${interval}:`, err);

        }

      });



      eventSource.addEventListener('error', (e) => {

        try {

          const data = JSON.parse(e.data);

          setError(data.message || `Error loading ${interval} data`);

          setLoading(prev => ({ ...prev, [interval]: false }));

        } catch (err) {

          console.error(`Error parsing error event for ${interval}:`, err);

        }

      });



      eventSource.onerror = () => {

        setError(`Failed to connect to ${interval} data stream`);

        setLoading(prev => ({ ...prev, [interval]: false }));

      };

    });



    // Cleanup: close all connections

    return () => {

      clientsRef.current.forEach((eventSource, interval) => {

        eventSource.close();

      });

      clientsRef.current.clear();

    };

  }, [id, intervals.join(','), token, limit, enabled]);



  return { dataByInterval, loading, error };

}

```



**Usage:**

```tsx

function MultiChartComponent({ backtestId }: { backtestId: string }) {

  const { token } = useAuth();

  const intervals = ['day', 'minute', '3minute'];

  const { dataByInterval, loading, error } = useBacktestMultiIntervalSSE({

    id: backtestId,

    intervals,

    token

  });



  return (

    <div>

      {intervals.map(interval => (

        <div key={interval}>

          <h3>{interval} Chart</h3>

          {loading[interval] ? (

            <div>Loading {interval}...</div>

          ) : (

            <Chart data={dataByInterval[interval] || []} />

          )}

        </div>

      ))}

    </div>

  );

}

```



---



## 🔧 Utility Functions



### SSE Connection Manager



```typescript

// utils/sseManager.ts

class SSEManager {

  private connections: Map<string, EventSource> = new Map();



  connect(key: string, url: string, handlers: Record<string, (e: MessageEvent) => void>) {

    // Close existing connection if any

    this.disconnect(key);



    // Create new connection

    const eventSource = new EventSource(url);

    this.connections.set(key, eventSource);



    // Register handlers

    Object.entries(handlers).forEach(([event, handler]) => {

      eventSource.addEventListener(event, handler);

    });



    // Handle errors

    eventSource.onerror = () => {

      console.error(`SSE connection error for ${key}`);

    };



    return eventSource;

  }



  disconnect(key: string) {

    const connection = this.connections.get(key);

    if (connection) {

      connection.close();

      this.connections.delete(key);

    }

  }



  disconnectAll() {

    this.connections.forEach((connection, key) => {

      connection.close();

    });

    this.connections.clear();

  }



  isConnected(key: string): boolean {

    const connection = this.connections.get(key);

    return connection?.readyState === EventSource.OPEN;

  }

}



export const sseManager = new SSEManager();

```



**Usage:**

```typescript

// Connect

sseManager.connect('jobs', url, {

  snapshot: (e) => { /* handle snapshot */ },

  job_added: (e) => { /* handle job_added */ }

});



// Disconnect

sseManager.disconnect('jobs');



// Disconnect all on logout

sseManager.disconnectAll();

```



---



## 🛡️ Error Handling & Reconnection



### Robust SSE Hook with Auto-Reconnect



```typescript

// hooks/useSSE.ts (Generic SSE hook)

import { useEffect, useState, useRef, useCallback } from 'react';



interface UseSSEOptions {

  url: string;

  enabled?: boolean;

  reconnectInterval?: number;

  maxReconnectAttempts?: number;

  handlers: Record<string, (data: any) => void>;

}



export function useSSE({

  url,

  enabled = true,

  reconnectInterval = 5000,

  maxReconnectAttempts = 5,

  handlers

}: UseSSEOptions) {

  const [connected, setConnected] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const reconnectAttemptsRef = useRef(0);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);



  const connect = useCallback(() => {

    if (!enabled) return;



    // Close existing connection

    if (eventSourceRef.current) {

      eventSourceRef.current.close();

    }



    const eventSource = new EventSource(url);

    eventSourceRef.current = eventSource;



    // Register handlers

    Object.entries(handlers).forEach(([event, handler]) => {

      eventSource.addEventListener(event, (e: MessageEvent) => {

        try {

          const data = JSON.parse(e.data);

          handler(data);

        } catch (err) {

          console.error(`Error parsing ${event} event:`, err);

        }

      });

    });



    // Handle connection

    eventSource.addEventListener('connection', () => {

      setConnected(true);

      setError(null);

      reconnectAttemptsRef.current = 0;

    });



    // Handle errors

    eventSource.onerror = () => {

      setConnected(false);

      

      if (eventSource.readyState === EventSource.CLOSED) {

        // Connection closed, attempt reconnect

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {

          reconnectAttemptsRef.current++;

          setError(`Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

          

          reconnectTimeoutRef.current = setTimeout(() => {

            connect();

          }, reconnectInterval);

        } else {

          setError('Max reconnection attempts reached');

        }

      }

    };



    return eventSource;

  }, [url, enabled, handlers, reconnectInterval, maxReconnectAttempts]);



  useEffect(() => {

    if (!enabled) return;



    const eventSource = connect();



    return () => {

      if (reconnectTimeoutRef.current) {

        clearTimeout(reconnectTimeoutRef.current);

      }

      if (eventSource) {

        eventSource.close();

      }

    };

  }, [connect, enabled]);



  const disconnect = useCallback(() => {

    if (reconnectTimeoutRef.current) {

      clearTimeout(reconnectTimeoutRef.current);

    }

    if (eventSourceRef.current) {

      eventSourceRef.current.close();

      eventSourceRef.current = null;

    }

    setConnected(false);

  }, []);



  return { connected, error, disconnect, reconnect: connect };

}

```



---



## 🔄 Migration Guide



### Step 1: Replace Job Listings Polling



**Before (REST Polling):**

```typescript

useEffect(() => {

  const fetchJobs = async () => {

    const response = await fetch(`/api/backtesting/jobs?limit=10&token=${token}`);

    const jobs = await response.json();

    setJobs(jobs);

  };



  fetchJobs();

  const interval = setInterval(fetchJobs, 5000); // Poll every 5 seconds



  return () => clearInterval(interval);

}, [token]);

```



**After (SSE):**

```typescript

const { jobs } = useBacktestJobsSSE({ token, limit: 10 });

// No polling needed! Updates stream automatically

```



### Step 2: Replace History Polling



**Before (REST Polling):**

```typescript

useEffect(() => {

  const fetchHistory = async () => {

    const response = await fetch(`/api/backtesting/history?limit=5&token=${token}`);

    const history = await response.json();

    setHistory(history);

  };



  fetchHistory();

  const interval = setInterval(fetchHistory, 5000);



  return () => clearInterval(interval);

}, [token]);

```



**After (SSE):**

```typescript

const { backtests } = useBacktestHistorySSE({ token, limit: 5 });

// No polling needed!

```



### Step 3: Replace WebSocket for Progress



**Before (WebSocket):**

```typescript

useEffect(() => {

  const ws = new WebSocket(`/ws/backtest/${jobId}?token=${token}`);

  

  ws.onmessage = (e) => {

    const data = JSON.parse(e.data);

    if (data.type === 'progress') {

      setProgress(data);

    }

  };



  return () => ws.close();

}, [jobId, token]);

```



**After (SSE):**

```typescript

const { progress } = useBacktestProgressSSE({ jobId, token });

// Simpler and more reliable!

```



---



## 📝 Best Practices



### 1. Token Refresh



```typescript

// Refresh token and reconnect all SSE connections

function refreshTokenAndReconnect() {

  // Close all connections

  sseManager.disconnectAll();

  

  // Get new token

  const newToken = await getNewToken();

  

  // Reconnect with new token

  // (React hooks will automatically reconnect when token changes)

}

```



### 2. Conditional Connections



```typescript

// Only connect when component is visible

const { jobs } = useBacktestJobsSSE({

  token,

  enabled: isPageVisible // Only connect when page is visible

});

```



### 3. Cleanup on Unmount



```typescript

useEffect(() => {

  // Connection is automatically cleaned up by the hook

  return () => {

    // Additional cleanup if needed

  };

}, []);

```



### 4. Error Boundaries



```typescript

// Wrap SSE components in error boundaries

<ErrorBoundary>

  <JobListPage />

</ErrorBoundary>

```



### 5. Loading States



```typescript

const { jobs, loading, error } = useBacktestJobsSSE({ token });



if (loading) return <Spinner />;

if (error) return <ErrorMessage error={error} />;

return <JobList jobs={jobs} />;

```



---



## 🎯 Complete Example: Job List Page



```tsx

// pages/BacktestJobsPage.tsx

import { useBacktestJobsSSE } from '@/hooks/useBacktestJobsSSE';

import { useAuth } from '@/hooks/useAuth';

import { JobCard } from '@/components/JobCard';

import { Spinner } from '@/components/Spinner';

import { ErrorMessage } from '@/components/ErrorMessage';



export function BacktestJobsPage() {

  const { token } = useAuth();

  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  

  const { jobs, loading, error } = useBacktestJobsSSE({

    token: token!,

    statusFilter,

    limit: 10

  });



  return (

    <div>

      <h1>Backtest Jobs</h1>

      

      <div>

        <button onClick={() => setStatusFilter(undefined)}>All</button>

        <button onClick={() => setStatusFilter('running')}>Running</button>

        <button onClick={() => setStatusFilter('completed')}>Completed</button>

      </div>



      {loading && <Spinner />}

      {error && <ErrorMessage error={error} />}

      

      <div>

        {jobs.map(job => (

          <JobCard key={job.job_id} job={job} />

        ))}

      </div>

    </div>

  );

}

```



---



## 🔗 API Reference



### Job Listings SSE



**Endpoint**: `GET /api/sse/backtest/jobs`



**Query Parameters**:

- `token` (required): Firebase ID token

- `status_filter` (optional): Filter by status

- `limit` (optional, default: 10): Max jobs



**Events**:

- `connection`: Connection established

- `snapshot`: Initial job list

- `job_added`: New job created

- `job_updated`: Job updated

- `job_removed`: Job deleted

- `error`: Error occurred



### History SSE



**Endpoint**: `GET /api/sse/backtest/history`



**Query Parameters**:

- `token` (required): Firebase ID token

- `limit` (optional, default: 10): Max backtests



**Events**:

- `connection`: Connection established

- `snapshot`: Initial history

- `backtest_added`: New backtest completed

- `backtest_updated`: Backtest updated

- `error`: Error occurred



### Progress SSE



**Endpoint**: `GET /api/sse/backtest/{job_id}`



**Query Parameters**:

- `token` (required): Firebase ID token



**Events**:

- `connection`: Connection established

- `progress`: Progress update

- `transaction`: New transactions

- `completed`: Job completed

- `failed`: Job failed

- `cancelled`: Job cancelled

- `error`: Error occurred



### Historical Data SSE



**Endpoint**: `GET /api/sse/backtest/{id}/data`



**Query Parameters**:

- `interval` (required): Data interval

- `limit` (optional, default: 1000): Max data points

- `chunk_size` (optional, default: 500): Points per chunk

- `token` (required): Firebase ID token



**Events**:

- `interval_start`: Starting to stream

- `data_chunk`: Chunk of data

- `complete`: All data streamed

- `error`: Error occurred



---



## 📚 Additional Resources



- `docs/SSE_FIRST_ARCHITECTURE.md` - Architecture overview

- `docs/SSE_ARCHITECTURE_INDEPENDENCE.md` - Connection independence

- `docs/FRONTEND_SSE_INTEGRATION.md` - Integration details



---



## ❓ FAQ



**Q: Can I use multiple SSE connections simultaneously?**

A: Yes! All SSE connections are independent and can run in parallel.



**Q: What happens if the connection drops?**

A: SSE has built-in auto-reconnect. The browser will automatically attempt to reconnect.



**Q: How do I handle token expiration?**

A: Close all connections, refresh the token, and reconnect. React hooks will automatically reconnect when the token changes.



**Q: Can I use SSE with React Query or SWR?**

A: Yes, but SSE is better for real-time updates. Use SSE for streaming, REST for one-time fetches.



**Q: What's the difference between SSE and WebSocket?**

A: SSE is one-way (server → client), simpler, and uses standard HTTP. WebSocket is bidirectional but more complex.



**Q: For multi-interval charts, should I use the multi-interval SSE endpoint or multiple single-interval connections?**

A: **Use multiple single-interval SSE connections** for parallel loading. This provides:
- Independent loading per chart
- True parallel streaming
- Better performance
- Works for both running jobs and completed backtests

The multi-interval SSE endpoint processes intervals sequentially, which is slower.

