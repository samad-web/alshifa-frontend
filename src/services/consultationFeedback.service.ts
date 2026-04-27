/**
 * Post-consultation 4-question feedback flow (banner on Today dashboard,
 * expands to full-screen modal). Backend writes ConsultationFeedback rows
 * and credits XP to the doctor via ClinicianXPService.
 */

import apiClient from '@/lib/api-client';

export type FeedbackMcqOption = 'A' | 'B' | 'C' | 'D';

export interface PendingConsultationFeedback {
  appointmentId: string;
  completedAt:   string;
  expiresAt:     string;
  doctor: {
    id:   string;
    name: string;
  };
}

export interface ConsultationFeedbackSubmission {
  appointment_id:         string;
  face_scale_emotional:   number  | null;
  face_scale_confidence:  number  | null;
  mcq_listening:          FeedbackMcqOption | null;
  mcq_return:             FeedbackMcqOption | null;
}

export interface ConsultationFeedbackResult {
  xp_awarded:       number;
  alreadySubmitted: boolean;
}

export const consultationFeedbackApi = {
  async getPending(): Promise<PendingConsultationFeedback | null> {
    const { data } = await apiClient.get<{ success: boolean; data: PendingConsultationFeedback | null }>(
      '/api/feedback/consultation/pending',
    );
    return data.data;
  },

  async submit(body: ConsultationFeedbackSubmission): Promise<ConsultationFeedbackResult> {
    const { data } = await apiClient.post<{ success: boolean; data: ConsultationFeedbackResult }>(
      '/api/feedback/consultation',
      body,
    );
    return data.data;
  },
};
