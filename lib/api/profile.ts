import { apiClient } from './client';

export interface UpdateProfileRequest {
  name?: string;
  phone_number?: string;
}

export interface SendEmailChangeOtpRequest {
  new_email: string;
}

export interface VerifyEmailChangeRequest {
  new_email: string;
  otp: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.put<{ success: boolean; message: string }>('/api/auth/profile', data);
  return response.data;
}

export async function sendEmailChangeOtp(data: SendEmailChangeOtpRequest): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/api/auth/send-email-otp', data);
  return response.data;
}

export async function verifyEmailChange(data: VerifyEmailChangeRequest): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/api/auth/change-email', data);
  return response.data;
}

export async function changePassword(data: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/api/auth/change-password', data);
  return response.data;
}
