// SOAP-format therapist session notes — frontend wrapper for the four
// /api/therapist-notes endpoints. Used by:
//   – pages/therapist/TherapistSessionNotes.tsx for the author surface
//   – pages/PatientTimeline.tsx to surface shared notes to the doctor

import { apiClient } from "@/lib/api-client";

export type SessionType = "INDIVIDUAL" | "GROUP" | "HOME_THERAPY";

export interface TherapistSessionNote {
  id: string;
  therapistId: string;
  patientId: string;
  appointmentId: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  sessionType: SessionType | null;
  duration: number | null;
  nextSessionPlan: string | null;
  isVisibleToDoctor: boolean;
  createdAt: string;
  updatedAt: string;
  therapist?: {
    id: string;
    fullName: string | null;
    profilePhoto: string | null;
  };
  patient?: {
    id: string;
    fullName: string | null;
    patientId: string | null;
  };
  appointment?: {
    id: string;
    date: string;
    status: string;
  } | null;
}

export interface CreateNotePayload {
  patientId: string;
  appointmentId?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  sessionType?: SessionType;
  duration?: number;
  nextSessionPlan?: string;
  isVisibleToDoctor?: boolean;
}

export type UpdateNotePayload = Partial<Omit<CreateNotePayload, "patientId">>;

interface NoteEnvelope { data: { note: TherapistSessionNote } }
interface NoteListEnvelope { data: { notes: TherapistSessionNote[] } }

export const therapistNotesApi = {
  list: async (params: { patientId?: string } = {}): Promise<TherapistSessionNote[]> => {
    const cleaned: Record<string, string> = {};
    if (params.patientId) cleaned.patientId = params.patientId;
    const { data } = await apiClient.get<NoteListEnvelope>("/api/therapist-notes", cleaned);
    return data.data.notes;
  },

  get: async (id: string): Promise<TherapistSessionNote> => {
    const { data } = await apiClient.get<NoteEnvelope>(`/api/therapist-notes/${id}`);
    return data.data.note;
  },

  create: async (payload: CreateNotePayload): Promise<TherapistSessionNote> => {
    const { data } = await apiClient.post<NoteEnvelope>("/api/therapist-notes", payload);
    return data.data.note;
  },

  update: async (id: string, payload: UpdateNotePayload): Promise<TherapistSessionNote> => {
    const { data } = await apiClient.patch<NoteEnvelope>(`/api/therapist-notes/${id}`, payload);
    return data.data.note;
  },
};
