'use client';

import { useState, useEffect } from 'react';
import { getOrders } from '@/lib/api/orders';
import type { Strategy, Order } from '@/types';

interface OrdersTabProps {
  currentStrategy: Strategy | null;
}

export default function OrdersTab({ currentStrategy }: OrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentStrategy) {
      loadOrders();
    } else {
      setOrders([]);
    }
  }, [currentStrategy]);

  const loadOrders = async () => {
    if (!currentStrategy) return;
    try {
      setLoading(true);
      const response = await getOrders({ limit: 50 });
      const strategyOrders = response.orders.filter(
        (order) => order.strategy_id === currentStrategy.id
      );
      setOrders(strategyOrders);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'COMPLETE':
        return 'text-green-400';
      case 'PENDING':
      case 'OPEN':
        return 'text-yellow-400';
      case 'REJECTED':
      case 'CANCELLED':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400 text-sm">Loading orders...</div>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-400 text-sm">No orders found</p>
            {!currentStrategy && (
              <p className="text-gray-500 text-xs mt-1">Create or select a strategy to view orders</p>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-gray-700 rounded-lg p-3 border border-gray-600"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{order.symbol}</span>
                <span className={`text-xs font-semibold ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div>
                  <span className="text-gray-500">Type:</span> {order.transaction_type} {order.order_type}
                </div>
                <div>
                  <span className="text-gray-500">Qty:</span> {order.quantity}
                </div>
                {order.price && (
                  <div>
                    <span className="text-gray-500">Price:</span> ₹{order.price.toFixed(2)}
                  </div>
                )}
                {order.average_price && (
                  <div>
                    <span className="text-gray-500">Avg:</span> ₹{order.average_price.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

