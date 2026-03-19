/**
 * Appointments API service — all HTTP calls related to appointments.
 *
 * Replaces direct fetch() calls in:
 *   Appointments.tsx, PatientAppointments.tsx, DoctorDashboard.tsx, etc.
 */

import apiClient from '@/lib/api-client';
import type {
  Appointment,
  AppointmentListResponse,
  CreateAppointmentPayload,
  UpdateAppointmentPayload,
  AvailableSlot,
} from '@/types';

export interface GetAppointmentsParams {
  status?: string;
  date?: string;
  page?: number;
  limit?: number;
  /** ADMIN / ADMIN_DOCTOR only — filter to a specific branch */
  branchId?: string;
  /** Sort order: 'branch' sorts by branch name asc then date desc; defaults to date desc */
  sort?: 'date' | 'branch';
}

export const appointmentsApi = {
  /** List appointments (role-scoped by backend) */
  async list(params?: GetAppointmentsParams): Promise<AppointmentListResponse> {
    const { data } = await apiClient.get<AppointmentListResponse>('/api/appointments', params as Record<string, string | number>);
    // Handle both paginated and plain array responses gracefully
    if (Array.isArray(data)) {
      return { appointments: data as unknown as Appointment[], pagination: { total: (data as unknown as Appointment[]).length, page: 1, limit: 100, totalPages: 1 } };
    }
    return data;
  },

  /** Get single appointment */
  async getById(id: string): Promise<Appointment> {
    const { data } = await apiClient.get<Appointment>(`/api/appointments/${id}`);
    return data;
  },

  /** Create appointment */
  async create(payload: CreateAppointmentPayload): Promise<Appointment> {
    const { data } = await apiClient.post<Appointment>('/api/appointments', payload);
    return data;
  },

  /** Update appointment */
  async update(id: string, payload: UpdateAppointmentPayload): Promise<Appointment> {
    const { data } = await apiClient.put<Appointment>(`/api/appointments/${id}`, payload);
    return data;
  },

  /** Cancel/delete appointment */
  async cancel(id: string): Promise<void> {
    await apiClient.delete(`/api/appointments/${id}`);
  },

  /** Get available time slots for booking */
  async getAvailableSlots(clinicianId: string, date: string): Promise<AvailableSlot[]> {
    const { data } = await apiClient.get<AvailableSlot[]>('/api/appointments/available-slots', { clinicianId, date });
    return data;
  },

  /** Get available staff for booking */
  async getAvailableStaff(params: Record<string, string | number>): Promise<unknown> {
    const { data } = await apiClient.get('/api/appointments/available-staff', params);
    return data;
  },

  /** Approve an appointment (doctor/therapist) */
  async approve(id: string, payload: { status: string; notes?: string }): Promise<Appointment> {
    const { data } = await apiClient.put<Appointment>(`/api/appointments/${id}`, payload);
    return data;
  },
};
