/**
 * doshaForecast.service — thin client wrapper for the F04 read endpoint.
 *
 * Backend gates the endpoint with PREDICTIVE_DOSHA_ENGINE; the frontend
 * also gates the panel UI via useTenantFeatures. Both checks must agree
 * before any UI renders.
 */

import { apiClient } from "@/lib/api-client";

export interface DoshaForecast {
    id: string;
    generatedAt: string;
    daysUntilSymp: number;
    confidence: number;            // 0..0.95
    dominantDosha: "VATA" | "PITTA" | "KAPHA";
    imbalanceType: "AGGRAVATION" | "DEPLETION";
    triggerFactors: string[];
    alertEmitted: boolean;
    alertEmittedAt: string | null;
    resolved: boolean;
    resolvedAt: string | null;
}

export async function getPatientDoshaForecasts(patientId: string): Promise<DoshaForecast[]> {
    const { data } = await apiClient.get<{ forecasts: DoshaForecast[] }>(
        `/api/patients/${patientId}/dosha-forecast`,
    );
    return data?.forecasts ?? [];
}
