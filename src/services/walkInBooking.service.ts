/**
 * Walk-In Booking API client.
 *
 * Wraps the five endpoints the walk-in modal hits. Each method destructures
 * `.data` from the shared apiClient response (which is `{ data, status }`)
 * so consumers can `const patient = await walkInBookingService.createGuestPatient(...)`.
 *
 * `searchPatients` and `listClinicians` reuse the existing patient/staff
 * endpoints — there's no walk-in-specific list endpoint. Only
 * `createGuestPatient`, `getSlots`, and `createWalkIn` hit walk-in-specific
 * backend routes.
 */

import { apiClient } from '@/lib/api-client';

export type SlotStatus = 'AVAILABLE' | 'BOOKED' | 'BLOCKED' | 'PAST';

export interface WalkInSlot {
  time: string;          // "HH:mm"
  dateTime: string;      // full ISO
  status: SlotStatus;
  patientName?: string;
  appointmentId?: string | null;
  blockReason?: string;
}

export interface SlotsResponse {
  slots: WalkInSlot[];
  nextAvailable: string | null;
  doctorId: string;
  date: string;
  dayOfWeek: number;
  workingHours: { start: string | null; end: string | null };
}

export interface GuestPatientPayload {
  name: string;
  phone: string;
  age: number;
  gender: string;
  prakriti?: string;
}

export interface WalkInPayload {
  patientId?: string;
  guestPatientId?: string;
  doctorId: string;
  therapistId?: string;
  consultationType: 'DOCTOR' | 'THERAPIST' | 'COMBINED';
  date: string;
  time: string;
  notes?: string;
  overrideReason?: string;
}

export const walkInBookingService = {
  /** Search existing patients by free-text query (name / phone / patient id). */
  searchPatients: async (search: string): Promise<unknown[]> => {
    const res = await apiClient.get<unknown[]>('/api/user/list-patients', { search });
    return res.data;
  },

  /** Create or reuse a guest patient for a walk-in booking. */
  createGuestPatient: async (data: GuestPatientPayload): Promise<{ patient: { id: string; fullName: string | null; phoneNumber: string | null }; alreadyExists: boolean; message?: string }> => {
    const res = await apiClient.post<{ patient: { id: string; fullName: string | null; phoneNumber: string | null }; alreadyExists: boolean; message?: string }>('/api/patients/guest', data);
    return res.data;
  },

  /** Slot grid for one clinician on one date. */
  getSlots: async (doctorId: string, date: string): Promise<SlotsResponse> => {
    const res = await apiClient.get<SlotsResponse>('/api/availability/slots', { doctorId, date });
    return res.data;
  },

  /** Returns { doctors: [], therapists: [] } via the existing staff list endpoint. */
  listClinicians: async (allBranches = false): Promise<{ doctors: Array<{ id: string; fullName?: string | null; user?: { email?: string } }>; therapists: Array<{ id: string; fullName?: string | null; user?: { email?: string } }> }> => {
    const res = await apiClient.get<{ doctors: Array<{ id: string; fullName?: string | null; user?: { email?: string } }>; therapists: Array<{ id: string; fullName?: string | null; user?: { email?: string } }> }>(
      '/api/appointments/available-staff',
      allBranches ? { allBranches: 'true' } : undefined,
    );
    return res.data;
  },

  /** Create the walk-in appointment (CONFIRMED, bypasses approval). */
  createWalkIn: async (data: WalkInPayload): Promise<{ appointment: { id: string } }> => {
    const res = await apiClient.post<{ appointment: { id: string } }>('/api/appointments/walk-in', data);
    return res.data;
  },
};
