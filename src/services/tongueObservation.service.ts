/**
 * tongueObservation.service — thin client wrapper for the F03 read endpoint.
 *
 * Mirrors the F04 dosha-forecast service shape so the consultation room can
 * fetch both with the same React Query pattern.
 */

import { apiClient } from "@/lib/api-client";

export interface TongueObservation {
    id: string;
    photoUrl: string | null;
    observedAt: string;
    aiCoatingColour: string | null;    // e.g. WHITE | YELLOW | GREY | BROWN | NONE
    aiCoatingThickness: string | null; // e.g. THIN | MODERATE | THICK
    aiMoisture: string | null;         // e.g. DRY | NORMAL | WET
    cracks: boolean;
    doshaIndication: string | null;    // VATA | PITTA | KAPHA | TRIDOSHA | BALANCED
    confidence: number | null;         // 0..1
    analysisNotes: string | null;
    alertEmitted: boolean;
}

export async function getPatientTongueObservations(patientId: string): Promise<TongueObservation[]> {
    const { data } = await apiClient.get<{ observations: TongueObservation[] }>(
        `/api/patients/${patientId}/tongue-observations`,
    );
    return data?.observations ?? [];
}
