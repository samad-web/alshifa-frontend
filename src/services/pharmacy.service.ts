/**
 * Pharmacy API service — medicines, stock, orders, dispenses.
 *
 * Replaces fetch() calls in:
 *   MedicineInventory.tsx, PharmacyDashboard.tsx, PharmacyDispense.tsx,
 *   PharmacyOrders.tsx, PharmacyHistory.tsx
 */

import apiClient from '@/lib/api-client';
import type { Medicine, MedicineStock, PharmacyOrder, PaginatedResponse } from '@/types';

export const pharmacyApi = {
  // ── Medicines ──────────────────────────────────────────────────────────────

  async getMedicines(params?: Record<string, string | number>): Promise<PaginatedResponse<Medicine> & { medicines: Medicine[] }> {
    const { data } = await apiClient.get<PaginatedResponse<Medicine> & { medicines: Medicine[] }>('/api/pharmacy/medicines', params);
    return data;
  },

  async getMedicineById(id: string): Promise<Medicine> {
    const { data } = await apiClient.get<Medicine>(`/api/pharmacy/medicines/${id}`);
    return data;
  },

  async createMedicine(payload: Partial<Medicine>): Promise<Medicine> {
    const { data } = await apiClient.post<Medicine>('/api/pharmacy/medicines', payload);
    return data;
  },

  async updateMedicine(id: string, payload: Partial<Medicine>): Promise<Medicine> {
    const { data } = await apiClient.put<Medicine>(`/api/pharmacy/medicines/${id}`, payload);
    return data;
  },

  // ── Stock ──────────────────────────────────────────────────────────────────

  async getStock(params?: Record<string, string>): Promise<MedicineStock[]> {
    const { data } = await apiClient.get<MedicineStock[]>('/api/pharmacy/stock', params);
    return data;
  },

  async getLowStockAlerts(): Promise<MedicineStock[]> {
    const { data } = await apiClient.get<MedicineStock[]>('/api/pharmacy/stock/low');
    return data;
  },

  async adjustStock(stockId: string, payload: { quantityDelta: number; reason?: string }): Promise<MedicineStock> {
    const { data } = await apiClient.put<MedicineStock>(`/api/pharmacy/stock/${stockId}/adjust`, payload);
    return data;
  },

  // ── Orders ─────────────────────────────────────────────────────────────────

  async getOrders(params?: Record<string, string | number>): Promise<PaginatedResponse<PharmacyOrder> & { orders: PharmacyOrder[] }> {
    const { data } = await apiClient.get<PaginatedResponse<PharmacyOrder> & { orders: PharmacyOrder[] }>('/api/pharmacy/orders', params);
    return data;
  },

  async createOrder(payload: Record<string, unknown>): Promise<PharmacyOrder> {
    const { data } = await apiClient.post<PharmacyOrder>('/api/pharmacy/orders', payload);
    return data;
  },

  async updateOrderStatus(orderId: string, status: string): Promise<PharmacyOrder> {
    const { data } = await apiClient.put<PharmacyOrder>(`/api/pharmacy/orders/${orderId}`, { status });
    return data;
  },

  // ── Dispense ───────────────────────────────────────────────────────────────

  async dispense(payload: Record<string, unknown>): Promise<unknown> {
    const { data } = await apiClient.post('/api/pharmacy/dispense', payload);
    return data;
  },

  async getDispenseHistory(params?: Record<string, string | number>): Promise<unknown> {
    const { data } = await apiClient.get('/api/pharmacy/dispense/history', params);
    return data;
  },
};
