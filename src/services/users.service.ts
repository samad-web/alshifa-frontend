/**
 * Users API service — profiles, user management, clinician lists.
 */

import apiClient from '@/lib/api-client';
import type { UserProfile, DoctorProfile, TherapistProfile, PatientProfile, PaginatedResponse } from '@/types';

export const usersApi = {
  async getMe(): Promise<UserProfile> {
    const { data } = await apiClient.get<UserProfile>('/api/user/me');
    return data;
  },

  async updateMe(payload: Partial<UserProfile>): Promise<UserProfile> {
    const { data } = await apiClient.put<UserProfile>('/api/user/me', payload);
    return data;
  },

  async list(params?: Record<string, string | number>): Promise<PaginatedResponse<UserProfile> & { users: UserProfile[] }> {
    const { data } = await apiClient.get<PaginatedResponse<UserProfile> & { users: UserProfile[] }>('/api/user', params);
    return data;
  },

  async getById(id: string): Promise<UserProfile> {
    const { data } = await apiClient.get<UserProfile>(`/api/user/${id}`);
    return data;
  },

  async update(id: string, payload: Partial<UserProfile>): Promise<UserProfile> {
    const { data } = await apiClient.put<UserProfile>(`/api/user/${id}`, payload);
    return data;
  },

  async deactivate(id: string): Promise<void> {
    await apiClient.delete(`/api/user/${id}`);
  },

  async getDoctors(params?: Record<string, string>): Promise<DoctorProfile[]> {
    const { data } = await apiClient.get<DoctorProfile[]>('/api/user/doctors', params);
    return data;
  },

  async getTherapists(params?: Record<string, string>): Promise<TherapistProfile[]> {
    const { data } = await apiClient.get<TherapistProfile[]>('/api/user/therapists', params);
    return data;
  },

  async getPatients(params?: Record<string, string | number>): Promise<{ patients: PatientProfile[]; total: number; page: number; limit: number }> {
    const { data } = await apiClient.get<{ patients: PatientProfile[]; total: number; page: number; limit: number }>('/api/user/patients', params);
    return data;
  },

  async createUser(payload: Record<string, unknown>): Promise<UserProfile> {
    const { data } = await apiClient.post<UserProfile>('/api/auth/register', payload);
    return data;
  },
};
