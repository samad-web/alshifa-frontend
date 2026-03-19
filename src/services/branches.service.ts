/**
 * Branches API service
 */

import apiClient from '@/lib/api-client';
import type { Branch } from '@/types';

export const branchesApi = {
  async list(): Promise<Branch[]> {
    const { data } = await apiClient.get<Branch[]>('/api/branches');
    return data;
  },

  async getById(id: string): Promise<Branch> {
    const { data } = await apiClient.get<Branch>(`/api/branches/${id}`);
    return data;
  },

  async create(payload: Partial<Branch>): Promise<Branch> {
    const { data } = await apiClient.post<Branch>('/api/branches', payload);
    return data;
  },

  async update(id: string, payload: Partial<Branch>): Promise<Branch> {
    const { data } = await apiClient.put<Branch>(`/api/branches/${id}`, payload);
    return data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/branches/${id}`);
  },
};
