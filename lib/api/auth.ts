import { apiClient } from './client';
import type { User } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://algoai-backend-606435458040.asia-south1.run.app';

/**
 * Response from /api/auth/verify-token endpoint
 */
export interface VerifyTokenResponse {
  valid: boolean;
  uid: string;
  email: string;
  email_verified: boolean;
}

/**
 * Response from /api/auth/me endpoint
 */
export interface UserInfoResponse {
  uid: string;
  email: string;
  name: string;
}

/**
 * Quick authentication check (fast, no Firestore)
 * Use this for initial page load
 * Performance: ~100-200ms (no Firestore query)
 * 
 * @param token Firebase ID token
 * @returns Token verification result
 */
export async function verifyToken(token: string): Promise<VerifyTokenResponse> {
  // Set token in localStorage so the interceptor can use it
  // (The interceptor reads from localStorage automatically)
  localStorage.setItem('firebase_token', token);
  
  const response = await apiClient.get<VerifyTokenResponse>('/api/auth/verify-token');
  return response.data;
}

/**
 * Get full user information (includes name from Firestore)
 * Use this after verifyToken succeeds
 * Performance: ~200-400ms (1 Firestore query for name only)
 * 
 * @param token Firebase ID token
 * @returns User information
 */
export async function getCurrentUser(token: string): Promise<UserInfoResponse> {
  // Set token in localStorage so the interceptor can use it
  // (The interceptor reads from localStorage automatically)
  localStorage.setItem('firebase_token', token);
  
  const response = await apiClient.get<UserInfoResponse>('/api/auth/me');
  return response.data;
}

/**
 * Convert backend UserInfoResponse to frontend User type
 * Maps uid -> id and adds default values
 */
export function mapUserInfoToUser(userInfo: UserInfoResponse): User {
  return {
    id: userInfo.uid,
    email: userInfo.email,
    name: userInfo.name,
    is_active: true, // Default to active if not provided
  };
}

