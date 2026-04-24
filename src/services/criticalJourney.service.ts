import { apiClient } from "@/lib/api-client";

export type CriticalReasonType =
    | "MISSED_MEDICATION"
    | "MISSED_VITAL_UPLOAD"
    | "MISSED_DAILY_CHECKIN"
    | "MISSED_FOLLOWUP"
    | "WELLNESS_DECLINE"
    | "OVERDUE_JOURNEY_PHASE";

export interface CriticalReason {
    type: CriticalReasonType;
    detail: string;
    lastDetectedAt: string;
    value?: unknown;
}

export interface CriticalPatient {
    id: string;
    patient: {
        id: string;
        userId: string;
        fullName: string | null;
        phoneNumber: string | null;
        profilePhoto: string | null;
        age: number | null;
        gender: string | null;
        branch: { id: string; name: string } | null;
    };
    severity: "LOW" | "MEDIUM" | "HIGH";
    status: "ACTIVE" | "RESOLVED";
    reasons: CriticalReason[];
    firstDetectedAt: string;
    lastDetectedAt: string;
    notes: string | null;
}

export interface CriticalStats {
    total: number;
    high: number;
    medium: number;
    low: number;
}

export const CRITICAL_REASON_LABELS: Record<CriticalReasonType, string> = {
    MISSED_MEDICATION: "Missed medications",
    MISSED_VITAL_UPLOAD: "Missed required vital uploads",
    MISSED_DAILY_CHECKIN: "Skipped daily check-ins",
    MISSED_FOLLOWUP: "Missed scheduled follow-up",
    WELLNESS_DECLINE: "Wellness decline",
    OVERDUE_JOURNEY_PHASE: "Overdue treatment phase",
};

export const criticalJourneyService = {
    list(params?: { branchId?: string; severity?: string }) {
        return apiClient
            .get<{ data: CriticalPatient[] }>("/api/critical-journey", params)
            .then((r) => r.data?.data ?? []);
    },
    stats(params?: { branchId?: string }) {
        return apiClient
            .get<{ data: CriticalStats }>("/api/critical-journey/stats", params)
            .then((r) => r.data?.data ?? { total: 0, high: 0, medium: 0, low: 0 });
    },
    scan(params?: { branchId?: string }) {
        return apiClient
            .post<{ data: { flagged: number; resolved: number; scanned: number } }>(
                `/api/critical-journey/scan${params?.branchId ? `?branchId=${encodeURIComponent(params.branchId)}` : ""}`,
                {},
            )
            .then((r) => r.data?.data);
    },
    resolve(patientId: string, note?: string) {
        return apiClient
            .post<{ data: CriticalPatient }>(`/api/critical-journey/${patientId}/resolve`, { note })
            .then((r) => r.data?.data);
    },
};

export default criticalJourneyService;
