/**
 * Patient queue API client + types — wraps /api/queue/* endpoints used by
 * the doctor dashboard's Today's Queue panel and the admin / branch admin
 * Live Queue Board.
 */

import { apiClient } from "@/lib/api-client";

export type ArrivalStatus =
  | "NOT_ARRIVED"
  | "ARRIVED"
  | "IN_CONSULTATION"
  | "COMPLETED"
  | "ABSENT"
  | "CONTACTED";

/** Joined patient details surfaced on every queue row. */
export interface QueuePatient {
  id: string;
  fullName: string | null;
  profilePhoto: string | null;
  phoneNumber: string | null;
  dob?: string | null;
  gender?: string | null;
  user: { id: string; email: string | null } | null;
}

export interface QueueDoctor {
  id: string;
  fullName: string | null;
  profilePhoto: string | null;
  specialization: string | null;
}

export interface QueueAppointment {
  id: string;
  date: string;
  status: string;
  consultationType: string;
  consultationMode: string;
  triageSession?: {
    id: string;
    urgencyLevel: string | null;
    severity: string | null;
    compositeScore: number | null;
  } | null;
  patient: QueuePatient;
}

export interface QueueEntry {
  id: string;
  appointmentId: string;
  doctorId: string;
  branchId: string;
  date: string;
  queuePosition: number;
  arrivalStatus: ArrivalStatus;
  arrivedAt: string | null;
  consultationStartedAt: string | null;
  consultationEndedAt: string | null;
  absentContactedAt: string | null;
  contactNote: string | null;
  contactedById: string | null;
  appointment: QueueAppointment;
  doctor: QueueDoctor;
}

export interface LiveBoardSummary {
  scheduled: number;
  arrived: number;
  inConsultation: number;
  completed: number;
  absent: number;
  contacted: number;
  waiting: number;
}

export interface LiveBoardDoctor {
  doctor: QueueDoctor;
  entries: QueueEntry[];
}

export interface LiveBoardResponse {
  doctors: LiveBoardDoctor[];
  summary: LiveBoardSummary;
}

export const queueApi = {
  /** Doctor dashboard Today's Queue panel — defaults to the calling
   *  doctor's own queue when doctorId is omitted. */
  getToday(params: { doctorId?: string; branchId?: string; date?: string } = {}): Promise<{ data: QueueEntry[] }> {
    return apiClient
      .get<{ data: QueueEntry[] }>("/api/queue/today", params as Record<string, string>)
      .then((r) => r.data);
  },

  /**
   * Branch-wide snapshot grouped by doctor — Live Queue Board.
   * Pass branchId for a single-branch view; omit it when the cross-branch
   * admin has selected "All Branches" (the backend treats absent branchId
   * as cross-branch when the caller is ADMIN / ADMIN_DOCTOR / SUPER_ADMIN).
   */
  getLiveBoard(params: { branchId?: string | null; date?: string } = {}): Promise<LiveBoardResponse> {
    const cleaned: Record<string, string> = {};
    if (params.branchId) cleaned.branchId = params.branchId;
    if (params.date) cleaned.date = params.date;
    return apiClient
      .get<LiveBoardResponse>("/api/queue/live-board", cleaned)
      .then((r) => r.data);
  },

  markArrived(appointmentId: string): Promise<QueueEntry> {
    return apiClient.post<QueueEntry>(`/api/queue/${appointmentId}/arrived`, {}).then((r) => r.data);
  },
  startConsultation(appointmentId: string): Promise<QueueEntry> {
    return apiClient.post<QueueEntry>(`/api/queue/${appointmentId}/start-consultation`, {}).then((r) => r.data);
  },
  endConsultation(appointmentId: string): Promise<QueueEntry> {
    return apiClient.post<QueueEntry>(`/api/queue/${appointmentId}/end-consultation`, {}).then((r) => r.data);
  },
  markAbsent(appointmentId: string): Promise<QueueEntry> {
    return apiClient.post<QueueEntry>(`/api/queue/${appointmentId}/mark-absent`, {}).then((r) => r.data);
  },
  contactAbsent(appointmentId: string, contactNote: string): Promise<QueueEntry> {
    return apiClient
      .post<QueueEntry>(`/api/queue/${appointmentId}/contact-absent`, { contactNote })
      .then((r) => r.data);
  },
};

export default queueApi;
