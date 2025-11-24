import { useEffect, useState, useRef } from 'react';

export interface StrategyStatusUpdate {
  strategy_id: string;
  status: string;
  updated_at?: string;
}

export interface StrategyPerformanceUpdate {
  strategy_id: string;
  total_trades: number;
  win_rate?: number;
  total_pnl: number;
}

export function useStrategyStatusSSE(
  token: string | null,
  strategyId?: string
) {
  const [status, setStatus] = useState<string | null>(null);
  const [performance, setPerformance] = useState<{
    total_trades: number;
    win_rate?: number;
    total_pnl: number;
  } | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
    const url = `${API_BASE}/api/sse/strategies/status?token=${token}${strategyId ? `&strategy_id=${strategyId}` : ''}`;
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.addEventListener('connection', () => {
      setConnected(true);
    });

    eventSource.addEventListener('strategies_snapshot', (e) => {
      const data = JSON.parse(e.data);
      if (strategyId && data.strategies) {
        const strategy = data.strategies.find((s: any) => s.id === strategyId);
        if (strategy) {
          setStatus(strategy.status);
          if (strategy.total_trades !== undefined) {
            setPerformance({
              total_trades: strategy.total_trades,
              win_rate: strategy.win_rate,
              total_pnl: strategy.total_pnl
            });
          }
        }
      }
    });

    eventSource.addEventListener('strategy_status_update', (e) => {
      const data: StrategyStatusUpdate = JSON.parse(e.data);
      if (!strategyId || data.strategy_id === strategyId) {
        setStatus(data.status);
      }
    });

    eventSource.addEventListener('strategy_performance_update', (e) => {
      const data: StrategyPerformanceUpdate = JSON.parse(e.data);
      if (!strategyId || data.strategy_id === strategyId) {
        setPerformance({
          total_trades: data.total_trades,
          win_rate: data.win_rate,
          total_pnl: data.total_pnl
        });
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setConnected(false);
      // EventSource will automatically reconnect
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [token, strategyId]);

  return { status, performance, connected };
}

