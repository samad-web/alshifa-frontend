/**
 * digitalTwin.service — thin client wrapper for the F01 read endpoint.
 *
 * Mirrors the F03 / F04 service shape so DigitalTwinPanel uses the same
 * React Query pattern. All fields are nullable on the receiving end so the
 * panel can render whatever subset is available.
 */

import { apiClient } from "@/lib/api-client";

export interface TrendPoint { date: string; value: number }

export interface DigitalTwin {
    patientId: string;
    prakriti: string | null;
    agniType: string | null;
    satvaRating: number | null;

    painTrend:     TrendPoint[];
    sleepTrend:    TrendPoint[];
    moodTrend:     TrendPoint[];
    mobilityTrend: TrendPoint[];

    doshaBalance: { vata: number; pitta: number; kapha: number };

    forecast: {
        dominantDosha: "VATA" | "PITTA" | "KAPHA";
        daysUntilSymp: number;
        confidence: number;
        triggerFactors: string[];
    } | null;

    tongueSummary: {
        latestDosha: string | null;
        latestColour: string | null;
        trend: "STABLE" | "IMPROVING" | "WORSENING";
    } | null;

    activeMedCount: number;
    activeMeds: { name: string; dosage: string; frequency: string }[];

    wellnessScore: number | null;
    journeyCondition: string | null;
    journeyStatus: string | null;

    similarPatientsCount: number;
    privacyFloor: number;
}

export async function getDigitalTwin(patientId: string): Promise<DigitalTwin> {
    const { data } = await apiClient.get<DigitalTwin>(
        `/api/patients/${patientId}/digital-twin`,
    );
    return data;
}
