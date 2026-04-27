/**
 * 7-stage end-of-journey feedback flow.
 *
 * Triggered when a TreatmentJourney is marked COMPLETED. The patient sees
 * a full-screen takeover the next time they open the app. Backend writes
 * one JourneyFeedback row per journey, computes up to 7 XP server-side,
 * and credits the lead doctor (with proportional split to qualifying
 * co-treaters when present).
 */

import apiClient from '@/lib/api-client';

export type JourneyMcqOption = 'A' | 'B' | 'C' | 'D';

// Garden levels (Stage 4) — 5 visual ladders mapped to score 1/3/5/7/10.
export type GardenScore = 1 | 3 | 5 | 7 | 10;

// Face-of-care experience (Stage 5) — 1 (lowest) to 5 (highest).
export type FaceScaleExperience = 1 | 2 | 3 | 4 | 5;

export interface AvailableJourneyFeedback {
  available: true;
  journey_id: string;
  expires_at: string;
  lead_doctor: {
    id: string;
    name: string;
  };
  journey_title: string | null;
  has_photos: boolean;
}

export interface NoAvailableJourneyFeedback {
  available: false;
  journey_id: null;
  expires_at: null;
}

export type JourneyFeedbackAvailability =
  | AvailableJourneyFeedback
  | NoAvailableJourneyFeedback;

export interface JourneyFeedbackPhotos {
  before: { id: string; filePath: string; takenAt: string; bodyRegion?: string | null };
  late:   { id: string; filePath: string; takenAt: string; stage: string; bodyRegion?: string | null };
}

export interface JourneyFeedbackSubmission {
  journey_id: string;
  mcq_appointments:           JourneyMcqOption | null;
  mcq_reminders:              JourneyMcqOption | null;
  mcq_medications:            JourneyMcqOption | null;
  mcq_family_recommendation:  JourneyMcqOption | null;
  garden_score:               GardenScore | null;
  face_scale_experience:      FaceScaleExperience | null;
  thank_you_card_text:        string | null;
  thank_you_card_public:      boolean;
  photos_viewed:              boolean;
}

export interface JourneyFeedbackXpDistribution {
  leadDoctorId:     string;
  leadDoctorXp:     number;
  leadDoctorBaseXp: number;
  leadDoctorCardXp: number;
  coTreaters: Array<{
    userId: string;
    role:   string;
    xp:     number;
    share:  number;
  }>;
  totalDistributed: number;
}

export interface JourneyFeedbackResult {
  xp_awarded:               number;
  xp_distribution:          JourneyFeedbackXpDistribution;
  thank_you_card_delivered: boolean;
}

export interface RecognitionLetter {
  id:           string;
  content:      string;
  createdAt:    string;
  journeyTitle: string | null;
  condition:    string | null;
}

export interface DoctorLetter {
  id:         string;
  content:    string;
  visibility: 'PRIVATE' | 'PUBLIC';
  createdAt:  string;
  feedback:   { journey: { id: string; title: string } | null } | null;
}

export const journeyFeedbackApi = {
  async getAvailable(): Promise<JourneyFeedbackAvailability> {
    const { data } = await apiClient.get<{ success: boolean; data: JourneyFeedbackAvailability }>(
      '/api/feedback/journey/available',
    );
    return data.data;
  },

  async getPhotos(journeyId: string): Promise<JourneyFeedbackPhotos | null> {
    const { data } = await apiClient.get<{ success: boolean; data: JourneyFeedbackPhotos | null }>(
      `/api/feedback/journey/${journeyId}/photos`,
    );
    return data.data;
  },

  async submit(body: JourneyFeedbackSubmission): Promise<JourneyFeedbackResult> {
    const { data } = await apiClient.post<{ success: boolean; data: JourneyFeedbackResult }>(
      '/api/feedback/journey',
      body,
    );
    return data.data;
  },

  async getRecognition(sinceDays = 7): Promise<RecognitionLetter[]> {
    const { data } = await apiClient.get<{ success: boolean; data: RecognitionLetter[] }>(
      '/api/feedback/journey/recognition',
      { sinceDays },
    );
    return data.data;
  },

  async getLetters(take = 20): Promise<DoctorLetter[]> {
    const { data } = await apiClient.get<{ success: boolean; data: DoctorLetter[] }>(
      '/api/feedback/journey/letters',
      { take },
    );
    return data.data;
  },
};
