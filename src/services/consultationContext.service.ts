/**
 * Consultation Room patient-history aggregate.
 *
 * One efficient API call → six tabs of context (prescriptions,
 * appointments, visit summaries, triage history, pain & vitals, active
 * journey) so the doctor's panel doesn't waterfall.
 */

import { apiClient } from "@/lib/api-client";
import type { CheckInPainRegion } from "@/services/enhancedDashboard.service";

export interface ConsultationContextPatient {
  id: string;
  fullName: string | null;
  dob: string | null;
  gender: string | null;
  phoneNumber: string | null;
  profilePhoto: string | null;
  email: string | null;
}

export interface ContextPrescription {
  id: string;
  medicationName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  notes: string | null;
  totalQuantity: number | null;
  createdAt: string;
  doctor: { id: string; fullName: string | null; specialization: string | null } | null;
  therapist: { id: string; fullName: string | null } | null;
}

export interface ContextAppointment {
  id: string;
  date: string;
  status: string;
  consultationType: string;
  consultationMode: string;
  sessionNotes: string | null;
  notes: string | null;
  doctor: { id: string; fullName: string | null; specialization: string | null } | null;
  therapist: { id: string; fullName: string | null } | null;
}

export interface ContextVisitSummary {
  id: string;
  diagnosis: string | null;
  treatmentNotes: string | null;
  dietaryAdvice: string | null;
  nextSteps: string | null;
  followUpDate: string | null;
  clinicianName: string | null;
  sentAt: string | null;
  createdAt: string;
  appointmentId: string | null;
}

export interface ContextTriageSession {
  id: string;
  severity: string | null;
  urgencyLevel: string | null;
  compositeScore: number | null;
  painRegions: CheckInPainRegion[] | null;
  responses: Record<string, unknown> | null;
  createdAt: string;
}

export interface ContextPainCheckIn {
  id: string;
  painLevel: number;
  painRegions: CheckInPainRegion[] | null;
  mood: string;
  sleepHours: number;
  createdAt: string;
}

export interface ContextVital {
  type: string;
  value: number | null;
  unit: string | null;
  recordedAt: string | null;
}

export interface ContextJourneyPhase {
  id: string;
  name: string;
  order: number;
  durationDays: number;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "SKIPPED";
}

export interface ContextActiveJourney {
  id: string;
  title: string;
  condition: string | null;
  startDate: string;
  targetDate: string | null;
  status: string;
  wellnessScore: number | null;
  phases: ContextJourneyPhase[];
  milestones: Array<{
    id: string;
    title: string;
    targetDate: string | null;
    achievedAt: string | null;
  }>;
}

export interface ConsultationContextResponse {
  patient: ConsultationContextPatient;
  prescriptions: ContextPrescription[];
  appointments: ContextAppointment[];
  visitSummaries: ContextVisitSummary[];
  triageSessions: ContextTriageSession[];
  painCheckIns: ContextPainCheckIn[];
  latestVitals: ContextVital[];
  activeJourney: ContextActiveJourney | null;
}

export const consultationContextApi = {
  get(patientId: string): Promise<ConsultationContextResponse> {
    return apiClient
      .get<ConsultationContextResponse>(`/api/patient/${patientId}/consultation-context`)
      .then((r) => r.data);
  },
};

export default consultationContextApi;
