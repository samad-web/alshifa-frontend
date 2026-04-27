import { apiClient } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────

export type BannerSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO" | "SUCCESS";
export type TaskStatus = "DONE" | "ACTIVE" | "PENDING" | "OVERDUE";
export type MedSlot = "morning" | "afternoon" | "evening";
export type MedStatus = "TAKEN" | "DUE" | "PENDING" | "MISSED";
export type VitalStatus = "OK" | "STALE" | "NOT_LOGGED";
export type SmartMessageType = "CLINICAL" | "REMINDER" | "ALERT" | "REWARD" | "INSIGHT";

export interface BannerCTA {
  label: string;
  kind: string;
  appointmentId?: string;
}

export interface DashboardBanner {
  severity: BannerSeverity;
  title: string;
  cta: BannerCTA | null;
}

export interface DashboardTask {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  status: TaskStatus;
  completedAt?: string | null;
  priority: number;
  action: { kind: string; [k: string]: unknown };
  points: number;
}

export interface DashboardMedication {
  prescriptionId: string;
  medicationName: string;
  dosage: string;
  instructions: string | null;
  slot: MedSlot;
  scheduledHour: number;
  status: MedStatus;
  takenAt: string | null;
}

export interface DashboardVital {
  type: string;
  value: number | null;
  unit: string | null;
  lastLoggedAt: string | null;
  status: VitalStatus;
  /** Set when the tile comes from a doctor's prescription. */
  prescriptionId?: string;
  frequency?: string;
  notes?: string | null;
  prescribedBy?: string | null;
}

export interface DashboardJourneyPhase {
  id: string;
  name: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "SKIPPED";
  order: number;
  durationDays: number;
}

export interface DashboardJourney {
  id: string;
  title: string;
  condition: string;
  wellnessScore: number;
  targetDate: string | null;
  overallPct: number;
  phaseHeader: { name: string; currentDay: number | null; durationDays: number } | null;
  phases: DashboardJourneyPhase[];
  milestones: Array<{
    id: string;
    title: string;
    achieved: boolean;
    targetDate: string | null;
    achievedAt: string | null;
  }>;
}

export interface ZenChallenge {
  id: string;
  title: string;
  points: number;
  completed: boolean;
  action: { kind: string; [k: string]: unknown };
}

export interface DashboardZen {
  points: number;
  level: { name: string; tier: number; nextLevel: string | null; nextAt: number | null; progress: number };
  streak: { current: number; longest: number };
  challenges: ZenChallenge[];
  pointsEarnedToday: number;
}

/** Single pain region as captured by the body-map step of the daily
 *  check-in. Mirrors the structure persisted in DailyCheckIn.painRegions
 *  and TriageSession.painRegions. */
export interface CheckInPainRegion {
  regionId: string;
  regionLabel: string;
  intensity: number;
  characters: string[];
  radiates?: boolean;
  radiatesTo?: string;
  duration?: string;
}

export interface DashboardPainMap {
  /** Simplified shape kept for the legacy severity-bar tile layout. */
  regions: Array<{ region: string; severity: number }>;
  /** Full structured regions for the BodyMapPainSelector renderer. */
  regionsRaw: CheckInPainRegion[];
  lastUpdated: string | null;
}

export interface SmartInsight {
  id: string;
  title: string;
  message: string;
  severity: "HIGH" | "MEDIUM" | "INFO";
  regionId?: string;
}

export interface LastPainRegionsResponse {
  painRegions: CheckInPainRegion[];
  source: "check_in" | "triage" | null;
  recordedAt: string | null;
}

export type AssignmentType = "PRIMARY" | "CONSULTING" | "TEMPORARY";

export interface CareTeamMember {
  assignmentId: string;
  type: AssignmentType;
  assignedAt: string;
  doctor: {
    id: string;
    fullName: string | null;
    specialization: string | null;
    qualification: string | null;
    profilePhoto: string | null;
    email: string | null;
  };
}

export interface DashboardCareTeam {
  primary: CareTeamMember | null;
  additional: CareTeamMember[];
}

export interface SmartMessage {
  id: string;
  type: SmartMessageType;
  sender: string;
  title: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  action: { kind: string; [k: string]: unknown } | null;
}

export interface DashboardSummary {
  patient: { id: string; fullName: string | null };
  banner: DashboardBanner;
  tasks: DashboardTask[];
  checkIn: { completedToday: boolean; record: Record<string, unknown> | null };
  medications: { items: DashboardMedication[]; adherenceWeekPct: number | null };
  vitals: { items: DashboardVital[]; loggedTodayCount: number };
  journey: DashboardJourney | null;
  zen: DashboardZen;
  painMap: DashboardPainMap;
  smartMessages: SmartMessage[];
  careTeam: DashboardCareTeam;
  channels: {
    pushEnabled: boolean;
    whatsappEnabled: boolean;
  };
  unreadNotifications: number;
  generatedAt: string;
}

// ── API ───────────────────────────────────────────────────────────────────

export const enhancedDashboardApi = {
  getSummary(): Promise<DashboardSummary> {
    return apiClient.get<DashboardSummary>("/api/patient/dashboard/summary").then((r) => r.data);
  },

  submitCheckIn(body: {
    mood: "TERRIBLE" | "LOW" | "OKAY" | "GOOD" | "GREAT";
    /** Body-map pain regions captured in Step 2. Empty array = no pain
     *  today (a valid, saveable state). */
    painRegions: CheckInPainRegion[];
    /** Legacy scalar — derived server-side from painRegions when the body
     *  map is non-empty, but still accepted for compatibility. */
    painLevel?: number;
    sleepQuality: "POOR" | "FAIR" | "GOOD" | "GREAT";
    notes?: string;
  }): Promise<unknown> {
    return apiClient.post("/api/patient/dashboard/check-in", body).then((r) => r.data);
  },

  getLastPainRegions(): Promise<LastPainRegionsResponse> {
    return apiClient
      .get<LastPainRegionsResponse>("/api/patient/dashboard/last-pain-regions")
      .then((r) => r.data);
  },

  getInsight(): Promise<SmartInsight | null> {
    return apiClient
      .get<SmartInsight | null>("/api/patient/dashboard/insight")
      .then((r) => r.data);
  },

  markMedicationTaken(prescriptionId: string, slot: MedSlot): Promise<unknown> {
    return apiClient
      .post("/api/patient/dashboard/medications/mark-taken", { prescriptionId, slot })
      .then((r) => r.data);
  },

  quickLogVital(body: { type: string; value: number; unit?: string }): Promise<unknown> {
    return apiClient.post("/api/patient/dashboard/vitals/quick-log", body).then((r) => r.data);
  },

  logPainPoint(body: { region: string; severity: number }): Promise<unknown> {
    return apiClient.post("/api/patient/dashboard/pain/log", body).then((r) => r.data);
  },

  completeTask(taskId: string): Promise<unknown> {
    return apiClient.post(`/api/patient/dashboard/tasks/${taskId}/complete`, {}).then((r) => r.data);
  },

  getSmartMessages(): Promise<{ data: SmartMessage[] }> {
    return apiClient.get<{ data: SmartMessage[] }>("/api/patient/dashboard/smart-messages").then((r) => r.data);
  },

  // ── Medication lifecycle ─────────────────────────────────────────────────

  getMedicationForecast(): Promise<{ data: MedicationForecast[] }> {
    return apiClient
      .get<{ data: MedicationForecast[] }>("/api/patient/dashboard/medications/forecast")
      .then((r) => r.data);
  },

  requestMedicationRefill(prescriptionId: string, notes?: string): Promise<RefillRequestResponse> {
    return apiClient
      .post<RefillRequestResponse>(
        `/api/patient/dashboard/medications/${prescriptionId}/request-refill`,
        { notes: notes || "" },
      )
      .then((r) => r.data);
  },
};

// ── Medication lifecycle types ────────────────────────────────────────────

export type MedicationLifecycleStatus =
  | "PRN"
  | "NOT_STARTED"
  | "ACTIVE"
  | "NEARING_DEPLETION"
  | "DEPLETED"
  | "DISCONTINUED";

export interface MedicationForecast {
  prescriptionId: string;
  medicationName: string;
  dailyDoseCount: number;
  dispensedQty: number;
  consumedQty: number;
  remainingDoses: number;
  daysRemaining: number | null;
  predictedRunOutDate: string | null;
  adherenceRate: number | null;
  status: MedicationLifecycleStatus;
}

export interface RefillRequestResponse {
  id: string;
  prescriptionId: string;
  patientId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export default enhancedDashboardApi;
