import { useEffect, useState, useRef } from 'react';
import type { Order } from '@/types';

export function useOrdersSSE(
  token: string | null,
  strategyId?: string
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';
    const url = `${API_BASE}/api/sse/orders?token=${token}${strategyId ? `&strategy_id=${strategyId}` : ''}`;
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.addEventListener('connection', () => {
      setConnected(true);
    });

    eventSource.addEventListener('orders_snapshot', (e) => {
      const data = JSON.parse(e.data);
      const ordersList = data.orders || [];
      if (strategyId) {
        setOrders(ordersList.filter((order: Order) => order.strategy_id === strategyId));
      } else {
        setOrders(ordersList);
      }
    });

    eventSource.addEventListener('new_order', (e) => {
      const newOrder: Order = JSON.parse(e.data);
      if (!strategyId || newOrder.strategy_id === strategyId) {
        setOrders(prev => {
          // Filter out if already exists, then add new
          const filtered = prev.filter(o => o.id !== newOrder.id);
          return [newOrder, ...filtered];
        });
      }
    });

    eventSource.addEventListener('order_update', (e) => {
      const updatedOrder: Order = JSON.parse(e.data);
      if (!strategyId || updatedOrder.strategy_id === strategyId) {
        setOrders(prev => 
          prev.map(order => 
            order.id === updatedOrder.id ? updatedOrder : order
          )
        );
      }
    });

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setConnected(false);
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [token, strategyId]);

  return { orders, connected };
}

