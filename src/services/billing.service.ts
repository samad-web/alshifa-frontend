import { apiClient } from "@/lib/api-client";
import type { Invoice, Payment } from "@/types";

export const billingApi = {
    async getInvoices(params?: { status?: string; page?: number; limit?: number }) {
        const { data } = await apiClient.get<{ data: Invoice[]; total: number; page: number; totalPages: number }>('/api/invoices', params);
        return data;
    },

    async getInvoice(id: string) {
        const { data } = await apiClient.get<Invoice>(`/api/invoices/${id}`);
        return data;
    },

    async createInvoice(payload: {
        patientId: string;
        appointmentId?: string;
        items: { description: string; quantity: number; unitPrice: number }[];
        tax?: number;
        discount?: number;
        notes?: string;
        dueDate?: string;
    }) {
        const { data } = await apiClient.post<Invoice>('/api/invoices', payload);
        return data;
    },

    async updateInvoiceStatus(id: string, status: string) {
        const { data } = await apiClient.patch<Invoice>(`/api/invoices/${id}/status`, { status });
        return data;
    },

    async recordPayment(invoiceId: string, payload: { amount: number; method: string; transactionId?: string }) {
        const { data } = await apiClient.post<Payment>(`/api/invoices/${invoiceId}/payments`, payload);
        return data;
    },

    async getPatientInvoices(patientId?: string) {
        const { data } = await apiClient.get<Invoice[]>('/api/invoices/my');
        return data;
    },
};
