// Wellness service — thin wrapper over /api/wellness/* endpoints used by the
// patient dashboard. Kept separate from dailyTracking.service so callers can
// import just the surface they need.

import { apiClient } from "@/lib/api-client";

export interface DailyCheckInRecord {
  id: string;
  patientId: string;
  painLevel: number;
  sleepHours: number;
  mood: string;
  notes: string | null;
  createdAt: string;
}

export interface TodayCheckInData {
  hasSubmittedToday: boolean;
  checkIn: DailyCheckInRecord | null;
}

export interface SubmitCheckInBody {
  painLevel: number;
  sleepHours: number;
  mood: string;
  notes?: string;
}

export const wellnessService = {
  getCheckInToday: () => apiClient.get<TodayCheckInData>("/api/wellness/check-in/today"),

  submitCheckIn: (body: SubmitCheckInBody) =>
    apiClient.post<{ message: string; data: DailyCheckInRecord }>(
      "/api/wellness/check-in",
      body,
    ),
};
