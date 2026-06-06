/**
 * triage.service — thin client wrapper over the backend triage endpoints.
 *
 * For F08 (Explainable AI) we only need the read-by-id endpoint that returns
 * the explainability surface: composite + confidence scores, red flags,
 * routing-quality dimensions, and the triageNotes narrative. The shape below
 * mirrors the live DB rows observed via the probe — see schema.prisma's
 * TriageSession model. All AI-output fields are optional because older or
 * partially-completed sessions may lack any of them.
 */

import { apiClient } from "@/lib/api-client";

export interface TriageSessionDetail {
    id: string;
    patientId: string;
    severity: string;
    suggestedSpecialty: string | null;
    alternativeSpecialties: string[];

    // Score header (Section 1)
    compositeScore: number | null;       // 0-10 typical range
    urgencyLevel: string | null;         // CRITICAL | URGENT | MODERATE | LOW
    confidenceScore: number | null;      // 0-1

    // Routing-quality dimensions (Section 3)
    inputCompleteness: number | null;    // 0-1
    routingMatchStrength: number | null; // 0-1

    // Red flags (Section 2)
    redFlagsMatched: string[];
    redFlagForced: boolean;
    flags: string[];

    // Narrative (Section 3 footer)
    triageNotes: string | null;

    isEscalated: boolean;
    reviewCount: number;
    overriddenUrgencyLevel: string | null;
    overriddenSpecialty: string | null;
    overrideReason: string | null;
    createdAt: string;
}

export async function getTriageSession(id: string): Promise<TriageSessionDetail> {
    const { data } = await apiClient.get<TriageSessionDetail>(`/api/triage/sessions/${id}`);
    return data;
}
