/**
 * Communication & Portal API service — announcements, handoff notes,
 * patient portal, visit summaries.
 */

import apiClient from '@/lib/api-client';
import type {
  AnnouncementEntry, HandoffNoteEntry,
  VisitSummaryEntry, Prescription
} from '@/types';

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PortalDocument {
  id: string;
  fileName: string;
  fileUrl?: string;
  fileType?: string;
  category: string;
  description?: string | null;
  createdAt: string;
}

export interface PortalAppointment {
  id: string;
  date: string;
  status: string;
  consultationType: string;
  consultationMode?: string;
  meetingLink?: string | null;
  doctor?: { id: string; fullName: string | null; user?: { name: string | null } } | null;
  therapist?: { id: string; fullName: string | null; user?: { name: string | null } } | null;
  branch?: { id: string; name: string } | null;
  visitSummary?: { id: string; sentToPatient: boolean } | null;
}

export const communicationApi = {
  // ── Announcements (Feature 33) ────────────────────────────────────────────

  async createAnnouncement(data: {
    /** Empty/omitted = broadcast to every branch. */
    branchIds?: string[]; title: string; message: string;
    priority?: string; targetRoles?: string[]; isPinned?: boolean; expiresAt?: string;
  }): Promise<AnnouncementEntry> {
    const { data: result } = await apiClient.post<AnnouncementEntry>('/api/announcements', data);
    return result;
  },

  async getAnnouncements(params?: { page?: number; limit?: number }): Promise<{ announcements: AnnouncementEntry[]; total: number }> {
    type BackendShape =
      | { announcements: AnnouncementEntry[]; total: number }
      | { data: AnnouncementEntry[]; pagination?: { total?: number } };
    const { data } = await apiClient.get<BackendShape>('/api/announcements', params);
    if ('announcements' in data) return data;
    const list = data.data ?? [];
    return { announcements: list, total: data.pagination?.total ?? list.length };
  },

  async markAnnouncementRead(id: string): Promise<void> {
    await apiClient.patch(`/api/announcements/${id}/read`, {});
  },

  async updateAnnouncement(id: string, data: Partial<{
    title: string; message: string; priority: string; isPinned: boolean;
    branchIds: string[]; targetRoles: string[]; expiresAt: string | null;
  }>): Promise<AnnouncementEntry> {
    const { data: result } = await apiClient.put<AnnouncementEntry>(`/api/announcements/${id}`, data);
    return result;
  },

  async deleteAnnouncement(id: string): Promise<void> {
    await apiClient.delete(`/api/announcements/${id}`);
  },

  // ── Handoff Notes (Feature 35) ────────────────────────────────────────────

  async createHandoffNote(data: {
    patientId: string;
    /** Required for SENT handoffs (the only flow the form exposes today). */
    toClinicianId: string;
    toBranchId?: string;
    /** DD/MM/YYYY string — backend converts to ISO before persisting. */
    handoffDate: string;
    summary: string; currentMedications?: { name: string; dosage: string; frequency: string }[];
    activeConditions?: string[]; nextSteps?: string; urgency?: string;
  }): Promise<HandoffNoteEntry> {
    const { data: result } = await apiClient.post<HandoffNoteEntry>('/api/handoff', data);
    return result;
  },

  async getReceivedHandoffs(params?: { page?: number; limit?: number; isRead?: boolean }): Promise<{ handoffs: HandoffNoteEntry[]; total: number }> {
    type Shape = { handoffs: HandoffNoteEntry[]; total: number } | { data: HandoffNoteEntry[]; pagination?: { total?: number } };
    const { data } = await apiClient.get<Shape>('/api/handoff/received', params);
    if ('handoffs' in data) return data;
    const list = data.data ?? [];
    return { handoffs: list, total: data.pagination?.total ?? list.length };
  },

  async getSentHandoffs(params?: { page?: number; limit?: number }): Promise<{ handoffs: HandoffNoteEntry[]; total: number }> {
    type Shape = { handoffs: HandoffNoteEntry[]; total: number } | { data: HandoffNoteEntry[]; pagination?: { total?: number } };
    const { data } = await apiClient.get<Shape>('/api/handoff/sent', params);
    if ('handoffs' in data) return data;
    const list = data.data ?? [];
    return { handoffs: list, total: data.pagination?.total ?? list.length };
  },

  async getPatientHandoffs(patientId: string): Promise<HandoffNoteEntry[]> {
    const { data } = await apiClient.get<HandoffNoteEntry[]>(`/api/handoff/patient/${patientId}`);
    return data;
  },

  async markHandoffRead(id: string): Promise<void> {
    await apiClient.patch(`/api/handoff/${id}/read`, {});
  },

  async autoPopulateHandoff(appointmentId: string): Promise<Partial<HandoffNoteEntry>> {
    const { data } = await apiClient.get<Partial<HandoffNoteEntry>>(`/api/handoff/auto-populate/${appointmentId}`);
    return data;
  },

  async updateHandoffNote(id: string, data: {
    summary?: string;
    currentMedications?: { name: string; dosage: string; frequency: string }[];
    activeConditions?: string[];
    nextSteps?: string;
    urgency?: string;
    toClinicianId?: string | null;
    toBranchId?: string | null;
  }): Promise<HandoffNoteEntry> {
    const { data: result } = await apiClient.patch<HandoffNoteEntry>(`/api/handoff/${id}`, data);
    return result;
  },

  async sendHandoffDraft(id: string): Promise<HandoffNoteEntry> {
    const { data } = await apiClient.post<HandoffNoteEntry>(`/api/handoff/${id}/send`, {});
    return data;
  },

  // ── Patient Portal (Feature 37) ───────────────────────────────────────────
  // Note: getPortalDashboard() removed — superseded by EnhancedPatientDashboard
  // (`/api/patient/dashboard/summary`) and the records-archive PatientPortal
  // (which only calls getMyAppointmentHistory / getMyPrescriptions / getMyReports).

  async getMyPrescriptions(params?: { page?: number; limit?: number }): Promise<{ prescriptions: Prescription[]; total: number }> {
    type Shape = { prescriptions: Prescription[]; total: number } | { data: Prescription[]; pagination?: { total?: number } };
    const { data } = await apiClient.get<Shape>('/api/portal/prescriptions', params);
    if ('prescriptions' in data) return data;
    const list = data.data ?? [];
    return { prescriptions: list, total: data.pagination?.total ?? list.length };
  },

  async getMyReports(params?: { page?: number; limit?: number }): Promise<{
    summaries: { data: VisitSummaryEntry[]; pagination: PaginationInfo };
    documents: { data: PortalDocument[]; pagination: PaginationInfo };
  }> {
    type NewShape = {
      visitSummaries: { data: VisitSummaryEntry[]; pagination: PaginationInfo };
      documents: { data: PortalDocument[]; pagination: PaginationInfo };
    };
    type LegacyShape = {
      summaries?: VisitSummaryEntry[];
      visitSummaries?: VisitSummaryEntry[];
      documents?: PortalDocument[];
    };
    const { data } = await apiClient.get<NewShape | LegacyShape>('/api/portal/reports', params);
    // New paginated shape
    if (
      data &&
      typeof data === 'object' &&
      'documents' in data &&
      data.documents &&
      typeof data.documents === 'object' &&
      'data' in (data.documents as object)
    ) {
      const d = data as NewShape;
      return { summaries: d.visitSummaries, documents: d.documents };
    }
    // Legacy flat-array fallback
    const legacy = data as LegacyShape;
    const sList = legacy.summaries ?? legacy.visitSummaries ?? [];
    const dList = legacy.documents ?? [];
    const empty: PaginationInfo = { page: 1, limit: sList.length || 1, total: sList.length, totalPages: 1 };
    return {
      summaries: { data: sList, pagination: { ...empty, total: sList.length } },
      documents: { data: dList, pagination: { ...empty, total: dList.length, limit: dList.length || 1 } },
    };
  },

  async getMyAppointmentHistory(params?: {
    page?: number; limit?: number; status?: string;
  }): Promise<{ data: PortalAppointment[]; pagination: PaginationInfo }> {
    const { data } = await apiClient.get<{ data: PortalAppointment[]; pagination: PaginationInfo }>(
      '/api/portal/appointments', params,
    );
    return data;
  },

  async getMyTreatmentProgress(): Promise<unknown> {
    const { data } = await apiClient.get('/api/portal/treatment-progress');
    return data;
  },

  // ── Visit Summaries (Feature 39) ──────────────────────────────────────────

  async createVisitSummary(data: {
    appointmentId: string; diagnosis?: string; treatmentNotes?: string;
    prescriptions?: { medication: string; dosage: string; frequency: string; duration: string }[];
    exercisePlan?: { exercise: string; sets: number; reps: number; frequency: string }[];
    dietaryAdvice?: string; nextSteps?: string; followUpDate?: string;
  }): Promise<VisitSummaryEntry> {
    const { data: result } = await apiClient.post<VisitSummaryEntry>('/api/visit-summary', data);
    return result;
  },

  async getVisitSummary(appointmentId: string): Promise<VisitSummaryEntry> {
    const { data } = await apiClient.get<VisitSummaryEntry>(`/api/visit-summary/appointment/${appointmentId}`);
    return data;
  },

  async getPatientVisitSummaries(patientId: string, params?: { page?: number; limit?: number }): Promise<{ summaries: VisitSummaryEntry[]; total: number }> {
    type Shape = { summaries: VisitSummaryEntry[]; total: number } | { data: VisitSummaryEntry[]; pagination?: { total?: number } };
    const { data } = await apiClient.get<Shape>(`/api/visit-summary/patient/${patientId}`, params);
    if ('summaries' in data) return data;
    const list = data.data ?? [];
    return { summaries: list, total: data.pagination?.total ?? list.length };
  },

  // Doctor view — visit summaries authored by the calling clinician.
  async getMyVisitSummaries(params?: { page?: number; limit?: number; startDate?: string; endDate?: string }): Promise<{ summaries: VisitSummaryEntry[]; total: number }> {
    type Shape = { summaries: VisitSummaryEntry[]; total: number } | { data: VisitSummaryEntry[]; pagination?: { total?: number } };
    const { data } = await apiClient.get<Shape>('/api/visit-summary/mine', params);
    if ('summaries' in data) return data;
    const list = data.data ?? [];
    return { summaries: list, total: data.pagination?.total ?? list.length };
  },

  // Patient view — visit summaries belonging to the calling patient. The
  // backend resolves User.id → Patient.id so we don't need to know the
  // Patient record id on the client.
  async getMySharedVisitSummaries(params?: { page?: number; limit?: number }): Promise<{ summaries: VisitSummaryEntry[]; total: number }> {
    type Shape = { summaries: VisitSummaryEntry[]; total: number } | { data: VisitSummaryEntry[]; pagination?: { total?: number } };
    const { data } = await apiClient.get<Shape>('/api/visit-summary/me', params);
    if ('summaries' in data) return data;
    const list = data.data ?? [];
    return { summaries: list, total: data.pagination?.total ?? list.length };
  },

  async sendSummaryToPatient(summaryId: string): Promise<VisitSummaryEntry> {
    const { data } = await apiClient.post<VisitSummaryEntry>(`/api/visit-summary/${summaryId}/send`, {});
    return data;
  },

  async autoGenerateVisitSummary(appointmentId: string): Promise<Partial<VisitSummaryEntry>> {
    const { data } = await apiClient.get<Partial<VisitSummaryEntry>>(`/api/visit-summary/auto-generate/${appointmentId}`);
    return data;
  },
};
