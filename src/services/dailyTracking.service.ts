// Sheizen-inspired daily tracking — frontend service.
//
// Wraps the /api/daily-tracking/* endpoints behind a typed surface so the
// dashboard cards and the doctor's PatientTimeline view can call without
// duplicating the URL strings.

import { apiClient } from "@/lib/api-client";

export type ActivityType =
  | "YOGA"
  | "AEROBIC"
  | "STRENGTH"
  | "FLEXIBILITY"
  | "MEDITATION"
  | "WALKING"
  | "PRANAYAMA"
  | "OTHER";

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "MORNING_EMPTY";

export interface WaterIntakeLog {
  id: string;
  patientId: string;
  amount: number;
  loggedAt: string;
  date: string;
  createdAt: string;
}

export interface BodyMeasurementLog {
  id: string;
  patientId: string;
  arm: number | null;
  chest: number | null;
  waist: number | null;
  hip: number | null;
  thigh: number | null;
  weight: number | null;
  notes: string | null;
  loggedAt: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  patientId: string;
  activityType: ActivityType;
  durationMins: number;
  notes: string | null;
  loggedAt: string;
  date: string;
  zenPointsAwarded: number;
  createdAt: string;
}

export interface MealPhotoLog {
  id: string;
  patientId: string;
  mealType: MealType;
  photoPath: string;
  photoUrl: string | null;
  notes: string | null;
  loggedAt: string;
  date: string;
  createdAt: string;
}

export interface WaterTodayResponse {
  logs: WaterIntakeLog[];
  todayTotal: number;
  goalMl: number;
  percentage: number;
}

export interface WaterLogResponse extends WaterTodayResponse {
  log: WaterIntakeLog;
  zenPointsAwarded: number;
}

export interface DoctorTrackingSummary {
  waterLogs: WaterIntakeLog[];
  activityLogs: ActivityLog[];
  measurementLogs: BodyMeasurementLog[];
  mealPhotos: MealPhotoLog[];
  goalMl: number;
}

export const dailyTrackingService = {
  // ── Water ─────────────────────────────────────────────────────────────
  logWater: (amount: number) =>
    apiClient.post<WaterLogResponse>("/api/daily-tracking/water", { amount }),
  getWaterToday: () =>
    apiClient.get<WaterTodayResponse>("/api/daily-tracking/water/today"),
  getWaterHistory: () =>
    apiClient.get<{ logs: WaterIntakeLog[] }>("/api/daily-tracking/water/history"),

  // ── Measurements ──────────────────────────────────────────────────────
  logMeasurements: (data: {
    arm?: number;
    chest?: number;
    waist?: number;
    hip?: number;
    thigh?: number;
    weight?: number;
    notes?: string;
  }) =>
    apiClient.post<{ log: BodyMeasurementLog; zenPointsAwarded: number }>(
      "/api/daily-tracking/measurements",
      data,
    ),
  getMeasurementHistory: () =>
    apiClient.get<{ logs: BodyMeasurementLog[] }>("/api/daily-tracking/measurements/history"),

  // ── Activity ──────────────────────────────────────────────────────────
  logActivity: (data: { activityType: ActivityType; durationMins: number; notes?: string }) =>
    apiClient.post<{ log: ActivityLog; zenPointsAwarded: number }>(
      "/api/daily-tracking/activity",
      data,
    ),
  getActivityToday: () =>
    apiClient.get<{ logs: ActivityLog[]; totalMinutes: number }>(
      "/api/daily-tracking/activity/today",
    ),
  getActivityHistory: () =>
    apiClient.get<{ logs: ActivityLog[] }>("/api/daily-tracking/activity/history"),

  // ── Meal photos ───────────────────────────────────────────────────────
  uploadMealPhoto: (mealType: MealType, photo: File, notes?: string) => {
    const fd = new FormData();
    fd.append("mealType", mealType);
    fd.append("photo", photo);
    if (notes) fd.append("notes", notes);
    return apiClient.upload<{ log: MealPhotoLog; zenPointsAwarded: number }>(
      "/api/daily-tracking/meal-photo",
      fd,
    );
  },
  getMealPhotosToday: () =>
    apiClient.get<{ logs: MealPhotoLog[] }>("/api/daily-tracking/meal-photos/today"),
  getMealPhotosHistory: () =>
    apiClient.get<{ logs: MealPhotoLog[] }>("/api/daily-tracking/meal-photos/history"),

  // ── Doctor ────────────────────────────────────────────────────────────
  getPatientSummary: (patientId: string) =>
    apiClient.get<DoctorTrackingSummary>(`/api/daily-tracking/patient/${patientId}/summary`),
};
