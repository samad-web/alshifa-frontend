/**
 * Home Therapy frontend client.
 *
 * Mirrors the 13 endpoints under `/api/home-therapy/*` defined in
 * routes/homeTherapy.js. Used by:
 *   - Admin approval dashboard (Task 5)
 *   - Therapist dashboard (Task 6)
 *   - Live map page (Task 7)
 *   - Session completion + feedback flow (Task 8)
 *   - Patient profile location card (Task 10)
 */

import { apiClient } from "@/lib/api-client";

export type HomeTherapyStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type HomeTherapySessionStatus =
  | "SCHEDULED"
  | "THERAPIST_EN_ROUTE"
  | "THERAPIST_ARRIVED"
  | "IN_SESSION"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type SessionMode = "HOME" | "HOSPITAL";

export interface HomeTherapyPatient {
  id: string;
  fullName?: string | null;
  patientId?: string | null;
  userId?: string | null;
  branchId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  primaryPhone?: string | null;
  alternativePhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
}

export interface HomeTherapyDoctor {
  id: string;
  fullName?: string | null;
  specialization?: string | null;
  userId?: string | null;
}

export interface HomeTherapyTherapist {
  id: string;
  fullName?: string | null;
  specialization?: string | null;
  userId?: string | null;
}

export interface HomeTherapyAppointment {
  id: string;
  date: string;
  status: string;
  meetingLink?: string | null;
}

export interface HomeTherapySession {
  id: string;
  requestId: string;
  therapistId: string;
  patientId: string;
  branchId: string;
  sessionNumber: number;
  scheduledDate: string;
  scheduledTime: string;
  mode: SessionMode;
  status: HomeTherapySessionStatus;
  therapistDepartedAt?: string | null;
  therapistArrivedAt?: string | null;
  sessionStartedAt?: string | null;
  sessionCompletedAt?: string | null;
  appointmentId?: string | null;
  request?: {
    id: string;
    branchId: string;
    totalSessions: number;
    intervalDays?: number | null;
    notes?: string | null;
    requestingDoctor?: HomeTherapyDoctor;
  };
  therapist?: HomeTherapyTherapist;
  patient?: HomeTherapyPatient;
  appointment?: HomeTherapyAppointment | null;
}

export interface HomeTherapyRequest {
  id: string;
  prescriptionId: string;
  patientId: string;
  requestingDoctorId: string;
  branchId: string;
  totalSessions: number;
  sessionMode: SessionMode[];
  intervalDays?: number | null;
  notes?: string | null;
  status: HomeTherapyStatus;
  approvedById?: string | null;
  approvedByRole?: string | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: HomeTherapyPatient;
  requestingDoctor?: HomeTherapyDoctor;
  branch?: { id: string; name: string };
  prescription?: { id: string; medicationName: string; createdAt: string };
  sessions?: HomeTherapySession[];
}

export interface ScheduledSession {
  sessionNumber: number;
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM
}

export interface ApprovePayload {
  therapistId: string;
  scheduledSessions: ScheduledSession[];
}

export interface EditScheduledSession extends ScheduledSession {
  mode: SessionMode;
}

export interface EditPayload {
  /** Optional therapist reassignment — applies to every still-SCHEDULED session. */
  therapistId?: string;
  /** Optional cadence; persisted on the request for transparency. */
  intervalDays?: number | null;
  notes?: string | null;
  /**
   * Complete post-edit list. sessionNumbers must be contiguous 1..N. Existing
   * sessions are matched by sessionNumber; new sessionNumbers create new
   * sessions; missing sessionNumbers drop the existing one (provided it is
   * still SCHEDULED — server enforces the immutability rule for COMPLETED /
   * IN_PROGRESS sessions).
   */
  scheduledSessions: EditScheduledSession[];
}

export interface LocationPing {
  id: string;
  sessionId: string;
  therapistId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  timestamp: string;
}

// All methods strip the ApiResponse<T> wrapper before returning so callers
// get the data directly (matches the canonical pattern in iwis.service.ts,
// appointments.service.ts, etc.).
export const homeTherapyService = {
  // ── Requests ──────────────────────────────────────────────────────────
  listRequests: async (params: { branchId?: string; status?: HomeTherapyStatus } = {}) =>
    (await apiClient.get<HomeTherapyRequest[]>("/api/home-therapy/requests", params)).data,
  getRequest: async (id: string) =>
    (await apiClient.get<HomeTherapyRequest>(`/api/home-therapy/requests/${id}`)).data,
  approve: async (id: string, body: ApprovePayload) =>
    (await apiClient.post<{ approved: HomeTherapyRequest; sessions: HomeTherapySession[] }>(
      `/api/home-therapy/requests/${id}/approve`, body,
    )).data,
  assignTherapist: async (id: string, body: ApprovePayload) =>
    (await apiClient.post<{ approved: HomeTherapyRequest; sessions: HomeTherapySession[] }>(
      `/api/home-therapy/requests/${id}/assign-therapist`, body,
    )).data,
  edit: async (id: string, body: EditPayload) =>
    (await apiClient.patch<{
      request: HomeTherapyRequest;
      created: HomeTherapySession[];
      updated: HomeTherapySession[];
      dropped: number[];
    }>(`/api/home-therapy/requests/${id}`, body)).data,
  reject: async (id: string, reason: string) =>
    (await apiClient.post<HomeTherapyRequest>(`/api/home-therapy/requests/${id}/reject`, { reason })).data,

  // ── Sessions ──────────────────────────────────────────────────────────
  listSessions: async (params: { therapistId?: string; date?: string; from?: string; to?: string; branchId?: string } = {}) =>
    (await apiClient.get<HomeTherapySession[]>("/api/home-therapy/sessions", params)).data,
  getSession: async (id: string) =>
    (await apiClient.get<HomeTherapySession>(`/api/home-therapy/sessions/${id}`)).data,
  depart: async (id: string) =>
    (await apiClient.post<HomeTherapySession>(`/api/home-therapy/sessions/${id}/depart`, {})).data,
  arrive: async (id: string) =>
    (await apiClient.post<HomeTherapySession>(`/api/home-therapy/sessions/${id}/arrive`, {})).data,
  start: async (id: string) =>
    (await apiClient.post<HomeTherapySession>(`/api/home-therapy/sessions/${id}/start`, {})).data,
  complete: async (id: string) =>
    (await apiClient.post<HomeTherapySession>(`/api/home-therapy/sessions/${id}/complete`, {})).data,
  getLastLocation: async (id: string) =>
    (await apiClient.get<LocationPing | null>(`/api/home-therapy/sessions/${id}/location`)).data,
  ping: async (id: string, body: { latitude: number; longitude: number; accuracy?: number }) =>
    (await apiClient.post<LocationPing>(`/api/home-therapy/sessions/${id}/location-ping`, body)).data,
  getNext: async (currentSessionId: string) =>
    (await apiClient.get<HomeTherapySession | null>(
      `/api/home-therapy/sessions/${currentSessionId}/next`,
    )).data,

  // ── Scorecard stats (Task 12) ────────────────────────────────────────
  getBranchScorecards: async (branchId: string, period: 'month' | 'quarter' = 'month') =>
    (await apiClient.get<{
      period: string;
      periodStart: string;
      branchId: string;
      rows: Array<{
        therapistId: string;
        fullName: string | null;
        specialization: string | null;
        completed: number;
        scheduled: number;
        completionRate: number;
        avgPatientRating: number;
        feedbackCount: number;
        onTimeRate: number;
      }>;
    }>("/api/home-therapy/scorecards/branch", { branchId, period })).data,
};

export default homeTherapyService;
