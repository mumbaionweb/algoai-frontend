'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import DashboardHeader from '@/components/layout/DashboardHeader';
import {
  getOrders,
  placeOrder,
  cancelOrder,
  modifyOrder,
  syncOrderStatus,
  getOrderHistory,
} from '@/lib/api/orders';
import { getBrokerCredentials } from '@/lib/api/broker';
import type {
  Order,
  OrderCreate,
  OrderUpdate,
  OrderStatus,
  OrderType,
  TransactionType,
  ProductType,
  OrderVariety,
  OrderValidity,
  BrokerCredentials,
} from '@/types';

function OrdersPageContent() {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [credentials, setCredentials] = useState<BrokerCredentials[]>([]);
  const [selectedCredentialsId, setSelectedCredentialsId] = useState<string>('');
  const [showPlaceOrderModal, setShowPlaceOrderModal] = useState(false);
  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);

  // Place order form state
  const [orderForm, setOrderForm] = useState<OrderCreate & { variety?: OrderVariety; validity?: OrderValidity }>({
    symbol: '',
    exchange: 'NSE',
    transaction_type: 'BUY',
    order_type: 'LIMIT',
    product_type: 'MIS',
    quantity: 1,
    price: null,
    trigger_price: null,
    variety: 'regular',
    validity: 'DAY',
  });

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push('/login');
    } else if (isInitialized && isAuthenticated) {
      loadCredentials();
      loadOrders();
    }
  }, [isAuthenticated, isInitialized, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadOrders();
    }
  }, [statusFilter, selectedCredentialsId]);

  const loadCredentials = async () => {
    try {
      const creds = await getBrokerCredentials('zerodha', false);
      setCredentials(creds);
      if (creds.length > 0 && !selectedCredentialsId) {
        setSelectedCredentialsId(creds[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load credentials:', err);
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const params: any = {
        limit: 100,
        sync: false,
      };
      if (statusFilter) {
        params.status_filter = statusFilter;
      }
      if (selectedCredentialsId) {
        params.credentials_id = selectedCredentialsId;
      }
      const data = await getOrders(params);
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      const errorDetail = err.response?.data?.detail || '';
      setError(errorDetail || 'Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    try {
      setError('');
      const params: any = {
        broker_type: 'zerodha',
      };
      if (selectedCredentialsId) {
        params.credentials_id = selectedCredentialsId;
      }
      if (orderForm.variety) {
        params.variety = orderForm.variety;
      }
      if (orderForm.validity) {
        params.validity = orderForm.validity;
      }

      const { variety, validity, ...orderData } = orderForm;
      await placeOrder(orderData, params);
      setShowPlaceOrderModal(false);
      setOrderForm({
        symbol: '',
        exchange: 'NSE',
        transaction_type: 'BUY',
        order_type: 'LIMIT',
        product_type: 'MIS',
        quantity: 1,
        price: null,
        trigger_price: null,
        variety: 'regular',
        validity: 'DAY',
      });
      await loadOrders();
    } catch (err: any) {
      console.error('Failed to place order:', err);
      const errorDetail = err.response?.data?.detail || '';
      setError(errorDetail || 'Failed to place order. Please try again.');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }
    try {
      setError('');
      const params: any = {
        broker_type: 'zerodha',
      };
      if (selectedCredentialsId) {
        params.credentials_id = selectedCredentialsId;
      }
      await cancelOrder(orderId, params);
      await loadOrders();
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      const errorDetail = err.response?.data?.detail || '';
      setError(errorDetail || 'Failed to cancel order. Please try again.');
    }
  };

  const handleSyncOrder = async (orderId: string) => {
    try {
      setSyncingOrderId(orderId);
      setError('');
      const params: any = {
        broker_type: 'zerodha',
      };
      if (selectedCredentialsId) {
        params.credentials_id = selectedCredentialsId;
      }
      await syncOrderStatus(orderId, params);
      await loadOrders();
    } catch (err: any) {
      console.error('Failed to sync order:', err);
      const errorDetail = err.response?.data?.detail || '';
      setError(errorDetail || 'Failed to sync order. Please try again.');
    } finally {
      setSyncingOrderId(null);
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'COMPLETE':
        return 'bg-green-500';
      case 'OPEN':
        return 'bg-blue-500';
      case 'PENDING':
        return 'bg-yellow-500';
      case 'REJECTED':
        return 'bg-red-500';
      case 'CANCELLED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTransactionColor = (type: TransactionType) => {
    return type === 'BUY' ? 'text-green-400' : 'text-red-400';
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardHeader title="Order Management" backButton />
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Filters and Actions */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Broker Credentials
            </label>
            <select
              value={selectedCredentialsId}
              onChange={(e) => setSelectedCredentialsId(e.target.value)}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
            >
              {credentials.map((cred) => (
                <option key={cred.id} value={cred.id}>
                  {cred.label || cred.broker_type} {cred.zerodha_user_id ? `(${cred.zerodha_user_id})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="OPEN">Open</option>
              <option value="COMPLETE">Complete</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={loadOrders}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Refresh
            </button>
            <button
              onClick={() => setShowPlaceOrderModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              Place Order
            </button>
          </div>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No orders found.</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Symbol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Order Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Filled</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3 text-white">{order.symbol}</td>
                      <td className={`px-4 py-3 font-medium ${getTransactionColor(order.transaction_type)}`}>
                        {order.transaction_type}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{order.order_type}</td>
                      <td className="px-4 py-3 text-gray-300">{order.quantity}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {order.price ? `₹${order.price.toFixed(2)}` : 'Market'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {order.filled_quantity} / {order.quantity}
                        {order.average_price && (
                          <span className="text-xs text-gray-400 block">
                            @ ₹{order.average_price.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs text-white ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {(order.status === 'OPEN' || order.status === 'PENDING') && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            onClick={() => handleSyncOrder(order.id)}
                            disabled={syncingOrderId === order.id}
                            className="text-blue-400 hover:text-blue-300 text-sm disabled:opacity-50"
                          >
                            {syncingOrderId === order.id ? 'Syncing...' : 'Sync'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-gray-700 px-4 py-3 text-sm text-gray-300">
              Total: {total} orders
            </div>
          </div>
        )}

        {/* Place Order Modal */}
        {showPlaceOrderModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-white mb-4">Place New Order</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Symbol</label>
                  <input
                    type="text"
                    value={orderForm.symbol}
                    onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                    placeholder="RELIANCE"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Exchange</label>
                  <select
                    value={orderForm.exchange}
                    onChange={(e) => setOrderForm({ ...orderForm, exchange: e.target.value })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                    <option value="NFO">NFO</option>
                    <option value="MCX">MCX</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Transaction</label>
                    <select
                      value={orderForm.transaction_type}
                      onChange={(e) => setOrderForm({ ...orderForm, transaction_type: e.target.value as TransactionType })}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                    >
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Order Type</label>
                    <select
                      value={orderForm.order_type}
                      onChange={(e) => setOrderForm({ ...orderForm, order_type: e.target.value as OrderType })}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                    >
                      <option value="MARKET">MARKET</option>
                      <option value="LIMIT">LIMIT</option>
                      <option value="SL">SL</option>
                      <option value="SLM">SLM</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Product Type</label>
                  <select
                    value={orderForm.product_type}
                    onChange={(e) => setOrderForm({ ...orderForm, product_type: e.target.value as ProductType })}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                  >
                    <option value="MIS">MIS (Intraday)</option>
                    <option value="CNC">CNC (Delivery)</option>
                    <option value="NRML">NRML (Normal)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Price {orderForm.order_type === 'MARKET' ? '(Optional)' : ''}
                    </label>
                    <input
                      type="number"
                      value={orderForm.price || ''}
                      onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                      step="0.01"
                      disabled={orderForm.order_type === 'MARKET'}
                    />
                  </div>
                </div>

                {orderForm.order_type === 'SL' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Trigger Price</label>
                    <input
                      type="number"
                      value={orderForm.trigger_price || ''}
                      onChange={(e) => setOrderForm({ ...orderForm, trigger_price: e.target.value ? parseFloat(e.target.value) : null })}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                      step="0.01"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Variety</label>
                    <select
                      value={orderForm.variety}
                      onChange={(e) => setOrderForm({ ...orderForm, variety: e.target.value as OrderVariety })}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                    >
                      <option value="regular">Regular</option>
                      <option value="bracket">Bracket</option>
                      <option value="cover">Cover</option>
                      <option value="amo">AMO</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Validity</label>
                    <select
                      value={orderForm.validity}
                      onChange={(e) => setOrderForm({ ...orderForm, validity: e.target.value as OrderValidity })}
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600"
                    >
                      <option value="DAY">DAY</option>
                      <option value="IOC">IOC</option>
                      <option value="TTL">TTL</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handlePlaceOrder}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Place Order
                </button>
                <button
                  onClick={() => setShowPlaceOrderModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default OrdersPageContent;
