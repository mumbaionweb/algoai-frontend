import { apiClient } from './client';
import type { DeviceInfo } from '@/utils/device';

/**
 * Device information from backend
 */
export interface Device {
  id: string;
  user_id: string;
  device_id: string;
  platform: string;
  device_name: string;
  user_agent?: string;
  os_version?: string;
  app_version?: string;
  ip_address?: string;
  last_active_at: string;
  created_at: string;
  is_revoked: boolean;
  revoked_at?: string;
  revoked_reason?: string;
}

/**
 * List devices response
 */
export interface ListDevicesResponse {
  devices: Device[];
  total: number;
}

/**
 * Track device after login
 * This is called automatically by the backend on login, but can be called manually
 * 
 * @param deviceInfo Device information
 * @returns Tracked device information
 */
export async function trackDevice(deviceInfo: DeviceInfo): Promise<Device> {
  const response = await apiClient.post<Device>('/api/devices/track', deviceInfo);
  return response.data;
}

/**
 * List all devices for the current user
 * 
 * @param includeRevoked Whether to include revoked devices (default: false)
 * @returns List of devices
 */
export async function listDevices(includeRevoked: boolean = false): Promise<ListDevicesResponse> {
  const response = await apiClient.get<ListDevicesResponse>('/api/devices', {
    params: {
      include_revoked: includeRevoked,
    },
  });
  return response.data;
}

/**
 * Get device details by device ID
 * 
 * @param deviceId Device ID
 * @returns Device information
 */
export async function getDeviceDetails(deviceId: string): Promise<Device> {
  const response = await apiClient.get<Device>(`/api/devices/${deviceId}`);
  return response.data;
}

/**
 * Revoke a specific device
 * This will force logout from that device
 * 
 * @param deviceId Device ID to revoke
 * @param reason Optional reason for revocation
 */
export async function revokeDevice(deviceId: string, reason?: string): Promise<void> {
  await apiClient.delete(`/api/devices/${deviceId}`, {
    data: reason ? { reason } : undefined,
  });
}

/**
 * Revoke all devices except the current one
 * This will force logout from all other devices
 * 
 * @param reason Optional reason for revocation
 */
export async function revokeAllDevices(reason?: string): Promise<void> {
  await apiClient.post('/api/devices/revoke-all', {
    reason: reason || 'User requested logout from all devices',
  });
}

