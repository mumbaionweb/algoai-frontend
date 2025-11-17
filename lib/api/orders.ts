import { apiClient } from './client';
import type {
  Order,
  OrderCreate,
  OrderUpdate,
  OrdersListResponse,
  OrderParams,
  BrokerOrderHistory,
  OrderVariety,
  OrderValidity,
} from '@/types';

/**
 * Place a new order
 * 
 * @param orderData Order creation data
 * @param params Optional parameters (broker_type, credentials_id, variety, validity, disclosed_quantity)
 * @returns Created order
 */
export async function placeOrder(
  orderData: OrderCreate,
  params?: OrderParams & {
    variety?: OrderVariety;
    validity?: OrderValidity;
    disclosed_quantity?: number;
  }
): Promise<Order> {
  const queryParams = new URLSearchParams();
  
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }
  if (params?.variety) {
    queryParams.append('variety', params.variety);
  }
  if (params?.validity) {
    queryParams.append('validity', params.validity);
  }
  if (params?.disclosed_quantity !== undefined) {
    queryParams.append('disclosed_quantity', params.disclosed_quantity.toString());
  }

  const url = `/api/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.post<Order>(url, orderData);
  return response.data;
}

/**
 * List orders
 * 
 * @param params Optional parameters (broker_type, credentials_id, limit, status_filter, sync)
 * @returns List of orders with total count
 */
export async function getOrders(params?: OrderParams): Promise<OrdersListResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }
  if (params?.limit) {
    queryParams.append('limit', params.limit.toString());
  }
  if (params?.status_filter) {
    queryParams.append('status_filter', params.status_filter);
  }
  if (params?.sync !== undefined) {
    queryParams.append('sync', params.sync.toString());
  }

  const url = `/api/orders${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<OrdersListResponse>(url);
  return response.data;
}

/**
 * Get order by ID
 * 
 * @param orderId Order ID
 * @param params Optional parameters (broker_type, credentials_id, sync)
 * @returns Order details
 */
export async function getOrder(
  orderId: string,
  params?: OrderParams
): Promise<Order> {
  const queryParams = new URLSearchParams();
  
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }
  if (params?.sync !== undefined) {
    queryParams.append('sync', params.sync.toString());
  }

  const url = `/api/orders/${orderId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<Order>(url);
  return response.data;
}

/**
 * Modify an existing order
 * 
 * @param orderId Order ID
 * @param updateData Order update data
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns Updated order
 */
export async function modifyOrder(
  orderId: string,
  updateData: OrderUpdate,
  params?: OrderParams
): Promise<Order> {
  const queryParams = new URLSearchParams();
  
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/orders/${orderId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.put<Order>(url, updateData);
  return response.data;
}

/**
 * Cancel an order
 * 
 * @param orderId Order ID
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns Cancelled order
 */
export async function cancelOrder(
  orderId: string,
  params?: OrderParams
): Promise<Order> {
  const queryParams = new URLSearchParams();
  
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/orders/${orderId}/cancel${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.post<Order>(url);
  return response.data;
}

/**
 * Sync order status from broker
 * 
 * @param orderId Order ID
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns Updated order with synced status
 */
export async function syncOrderStatus(
  orderId: string,
  params?: OrderParams
): Promise<Order> {
  const queryParams = new URLSearchParams();
  
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/orders/${orderId}/sync${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.post<Order>(url);
  return response.data;
}

/**
 * Get order history from broker
 * 
 * @param params Optional parameters (broker_type, credentials_id)
 * @returns Array of orders from broker
 */
export async function getOrderHistory(
  params?: OrderParams
): Promise<BrokerOrderHistory[]> {
  const queryParams = new URLSearchParams();
  
  if (params?.broker_type) {
    queryParams.append('broker_type', params.broker_type);
  }
  if (params?.credentials_id) {
    queryParams.append('credentials_id', params.credentials_id);
  }

  const url = `/api/orders/history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<BrokerOrderHistory[]>(url);
  return response.data;
}

