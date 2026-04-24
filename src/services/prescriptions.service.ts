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

  async getAdherence(id: string): Promise<PrescriptionAdherence> {
    const { data } = await apiClient.get<PrescriptionAdherence>(`/api/prescriptions/${id}/adherence`);
    return data;
  },

  async discontinue(id: string, reason?: string): Promise<Prescription> {
    const { data } = await apiClient.post<Prescription>(`/api/prescriptions/${id}/discontinue`, { reason: reason || '' });
    return data;
  },
};

// ── Adherence types ──────────────────────────────────────────────────────

export interface PrescriptionDispenseHistoryItem {
  id: string;
  createdAt: string;
  totalAmount: number;
  items: Array<{ quantity: number; medicine: { name: string } | null }>;
}

export interface PrescriptionMissedSlot {
  id: string;
  date: string;
  notes: string | null;
}

export interface PrescriptionAdherence {
  prescriptionId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  dailyDoseCount: number;
  adherenceRate7d: number | null;
  adherenceRate30d: number | null;
  logsLast7d: number;
  logsLast30d: number;
  missedSlots: PrescriptionMissedSlot[];
  dispenseHistory: PrescriptionDispenseHistoryItem[];
  dispensedQty: number;
  consumedQty: number;
  startDate: string | null;
  expectedEndDate: string | null;
}
