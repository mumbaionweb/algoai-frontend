/**
 * Device tracking utilities for web app
 * Generates and manages device ID and collects device information
 */

/**
 * Get or create a unique device ID
 * Device ID is stored in localStorage and persists across sessions
 * 
 * @returns Device ID (UUID v4)
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    // Generate UUID v4
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

/**
 * Device information interface
 */
export interface DeviceInfo {
  platform: 'web';
  device_id: string;
  device_name: string;
  user_agent: string;
  os_version: string;
  app_version?: string;
}

/**
 * Get device information for tracking
 * Collects minimal information about the device/browser
 * 
 * @returns Device information object
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      platform: 'web',
      device_id: '',
      device_name: 'Unknown',
      user_agent: 'Unknown',
      os_version: 'Unknown',
    };
  }

  const deviceId = getOrCreateDeviceId();
  const userAgent = navigator.userAgent;
  
  // Extract OS version from user agent (basic detection)
  let osVersion = 'Unknown';
  if (userAgent.includes('Windows')) {
    osVersion = 'Windows';
    if (userAgent.includes('Windows NT 10.0')) osVersion = 'Windows 10/11';
    else if (userAgent.includes('Windows NT 6.3')) osVersion = 'Windows 8.1';
    else if (userAgent.includes('Windows NT 6.2')) osVersion = 'Windows 8';
    else if (userAgent.includes('Windows NT 6.1')) osVersion = 'Windows 7';
  } else if (userAgent.includes('Mac OS X')) {
    osVersion = 'macOS';
  } else if (userAgent.includes('Linux')) {
    osVersion = 'Linux';
  } else if (userAgent.includes('Android')) {
    osVersion = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    osVersion = 'iOS';
  }

  // Extract browser/device name
  let deviceName = 'Unknown Browser';
  if (userAgent.includes('Chrome')) {
    deviceName = 'Chrome Browser';
  } else if (userAgent.includes('Firefox')) {
    deviceName = 'Firefox Browser';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    deviceName = 'Safari Browser';
  } else if (userAgent.includes('Edge')) {
    deviceName = 'Edge Browser';
  } else if (userAgent.includes('Opera')) {
    deviceName = 'Opera Browser';
  }

  return {
    platform: 'web',
    device_id: deviceId,
    device_name: deviceName,
    user_agent: userAgent,
    os_version: osVersion,
    // app_version can be added if you have version tracking
    // app_version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
  };
}

/**
 * Clear device ID (useful for logout or device reset)
 */
export function clearDeviceId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('device_id');
  }
}

