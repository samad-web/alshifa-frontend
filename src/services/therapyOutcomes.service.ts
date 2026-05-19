// Structured per-session therapy outcomes — frontend wrapper for the
// /api/therapy-outcomes endpoints. Used by:
//   – pages/TherapistPatients.tsx "Log Outcome" dialog
//   – pages/PatientTimeline.tsx TherapyOutcomesSection (doctor + therapist views)

import { apiClient } from "@/lib/api-client";

export interface TherapyOutcome {
  id: string;
  therapistId: string;
  patientId: string;
  appointmentId: string | null;
  sessionDate: string;
  mobilityScore: number | null;
  painScore: number | null;
  swellingReduced: boolean | null;
  functionalImprovement: string | null;
  therapistObservation: string | null;
  nextSessionGoal: string | null;
  createdAt: string;
  updatedAt: string;
  therapist?: {
    id: string;
    fullName: string | null;
    profilePhoto: string | null;
  };
}

export interface CreateOutcomePayload {
  patientId: string;
  appointmentId?: string;
  /** YYYY-MM-DD; the backend converts to a Date. */
  sessionDate: string;
  mobilityScore?: number;
  painScore?: number;
  swellingReduced?: boolean;
  functionalImprovement?: string;
  therapistObservation?: string;
  nextSessionGoal?: string;
}

interface OutcomeEnvelope { data: { outcome: TherapyOutcome } }
interface OutcomeListEnvelope { data: { outcomes: TherapyOutcome[] } }

export const therapyOutcomesApi = {
  /** All outcomes for a patient. THERAPIST role only sees their own;
   *  DOCTOR / ADMIN_DOCTOR / ADMIN see every therapist's entries. */
  list: async (patientId: string): Promise<TherapyOutcome[]> => {
    const { data } = await apiClient.get<OutcomeListEnvelope>(
      `/api/therapy-outcomes/${encodeURIComponent(patientId)}`,
    );
    return data.data.outcomes;
  },

  /** Caller's own outcomes. PATIENT role only — server derives patientId
   *  from the JWT so the URL carries no id. Powers the My Progress tab. */
  mine: async (): Promise<TherapyOutcome[]> => {
    const { data } = await apiClient.get<OutcomeListEnvelope>(
      "/api/therapy-outcomes/me",
    );
    return data.data.outcomes;
  },

  create: async (payload: CreateOutcomePayload): Promise<TherapyOutcome> => {
    const { data } = await apiClient.post<OutcomeEnvelope>(
      "/api/therapy-outcomes",
      payload,
    );
    return data.data.outcome;
  },
};
