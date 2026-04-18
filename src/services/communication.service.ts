/**
 * Communication & Portal API service — announcements, handoff notes,
 * patient portal, visit summaries.
 */

import apiClient from '@/lib/api-client';
import type {
  AnnouncementEntry, HandoffNoteEntry,
  PatientPortalDashboard, VisitSummaryEntry, Prescription
} from '@/types';

export const communicationApi = {
  // ── Announcements (Feature 33) ────────────────────────────────────────────

  async createAnnouncement(data: {
    branchId?: string; title: string; message: string;
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
  }>): Promise<AnnouncementEntry> {
    const { data: result } = await apiClient.put<AnnouncementEntry>(`/api/announcements/${id}`, data);
    return result;
  },

  async deleteAnnouncement(id: string): Promise<void> {
    await apiClient.delete(`/api/announcements/${id}`);
  },

  // ── Handoff Notes (Feature 35) ────────────────────────────────────────────

  async createHandoffNote(data: {
    patientId: string; toClinicianId?: string; toBranchId?: string;
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

  // ── Patient Portal (Feature 37) ───────────────────────────────────────────

  async getPortalDashboard(): Promise<PatientPortalDashboard> {
    const { data } = await apiClient.get<PatientPortalDashboard>('/api/portal/dashboard');
    return data;
  },

  async getMyPrescriptions(params?: { page?: number; limit?: number }): Promise<{ prescriptions: Prescription[]; total: number }> {
    type Shape = { prescriptions: Prescription[]; total: number } | { data: Prescription[]; pagination?: { total?: number } };
    const { data } = await apiClient.get<Shape>('/api/portal/prescriptions', params);
    if ('prescriptions' in data) return data;
    const list = data.data ?? [];
    return { prescriptions: list, total: data.pagination?.total ?? list.length };
  },

  async getMyReports(): Promise<{ summaries: VisitSummaryEntry[]; documents: { id: string; fileName: string; category: string; createdAt: string }[] }> {
    type Doc = { id: string; fileName: string; category: string; createdAt: string };
    type Shape =
      | { summaries: VisitSummaryEntry[]; documents: Doc[] }
      | { visitSummaries: VisitSummaryEntry[]; documents: Doc[] };
    const { data } = await apiClient.get<Shape>('/api/portal/reports');
    if ('summaries' in data) return data;
    return { summaries: data.visitSummaries ?? [], documents: data.documents ?? [] };
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

  async sendSummaryToPatient(summaryId: string): Promise<VisitSummaryEntry> {
    const { data } = await apiClient.post<VisitSummaryEntry>(`/api/visit-summary/${summaryId}/send`, {});
    return data;
  },

  async autoGenerateVisitSummary(appointmentId: string): Promise<Partial<VisitSummaryEntry>> {
    const { data } = await apiClient.get<Partial<VisitSummaryEntry>>(`/api/visit-summary/auto-generate/${appointmentId}`);
    return data;
  },
};
