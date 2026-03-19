/**
 * Prescriptions API service
 */

import apiClient from '@/lib/api-client';
import type { Prescription, PaginatedResponse } from '@/types';

export const prescriptionsApi = {
  async list(params?: Record<string, string | number>): Promise<PaginatedResponse<Prescription> & { prescriptions: Prescription[] }> {
    const { data } = await apiClient.get<PaginatedResponse<Prescription> & { prescriptions: Prescription[] }>('/api/prescriptions', params);
    return data;
  },

  async getById(id: string): Promise<Prescription> {
    const { data } = await apiClient.get<Prescription>(`/api/prescriptions/${id}`);
    return data;
  },

  async create(payload: Partial<Prescription> & { patientId: string }): Promise<Prescription> {
    const { data } = await apiClient.post<Prescription>('/api/prescriptions', payload);
    return data;
  },

  async update(id: string, payload: Partial<Prescription>): Promise<Prescription> {
    const { data } = await apiClient.put<Prescription>(`/api/prescriptions/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/prescriptions/${id}`);
  },
};
