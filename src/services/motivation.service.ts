// Daily Ayurvedic Motivation Card — frontend service.
//
// Wraps /api/motivation/* endpoints. The card is fetched on dashboard
// mount, marked read on "Got it" tap (+5 Zen Points the first time),
// and saved tips power the "My Tips" tab in PatientPortal.

import { apiClient } from "@/lib/api-client";

export type Prakriti = "VATA" | "PITTA" | "KAPHA" | "GENERAL";
export type Season =
  | "HEMANTA"
  | "SHISHIRA"
  | "VASANTA"
  | "GRISHMA"
  | "VARSHA"
  | "SHARAD";

export interface MotivationCard {
  id: string;
  patientId: string;
  tip: string;
  prakriti: Prakriti;
  season: Season;
  date: string;
  isRead: boolean;
  readAt: string | null;
  isSaved: boolean;
  savedAt: string | null;
  createdAt: string;
}

interface TodayResponse { card: MotivationCard }
interface SavedResponse { cards: MotivationCard[] }
interface ReadResponse {
  card: MotivationCard;
  zenPointsAwarded: number;
  newTotal: number | null;
}
interface SaveResponse { card: MotivationCard }

export const motivationService = {
  async getToday() {
    return apiClient.get<TodayResponse>("/api/motivation/today");
  },

  async markRead(cardId: string) {
    return apiClient.post<ReadResponse>(`/api/motivation/${cardId}/read`, {});
  },

  async toggleSave(cardId: string) {
    return apiClient.post<SaveResponse>(`/api/motivation/${cardId}/save`, {});
  },

  async getSaved() {
    return apiClient.get<SavedResponse>("/api/motivation/saved");
  },
};
