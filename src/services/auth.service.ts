/**
 * Auth API service — login, register, token refresh, profile fetch.
 *
 * Replaces direct fetch calls in useAuth.tsx / Login.tsx.
 */

import apiClient from '@/lib/api-client';
import type { LoginResponse, RefreshTokenResponse, UserProfile } from '@/types';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/api/auth/login', { email, password });
    return data;
  },

  async register(payload: Record<string, unknown>): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>('/api/auth/register', payload);
    return data;
  },

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const { data } = await apiClient.post<RefreshTokenResponse>('/api/auth/refresh', { refreshToken });
    return data;
  },

  async getProfile(): Promise<UserProfile> {
    const { data } = await apiClient.get<UserProfile>('/api/user/me');
    return data;
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/api/auth/change-password', { oldPassword, newPassword });
  },
};
