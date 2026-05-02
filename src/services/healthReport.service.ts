/**
 * Health Reports API service (Feature 2).
 *
 * Wraps `/api/health-reports/*` routes through the shared apiClient so token
 * refresh + error shape handling stays consistent with the rest of the app.
 *
 * Patient PDF download uses apiClient.getBlob (auth header is injected
 * automatically — direct window.open won't carry the JWT).
 */

import apiClient from "@/lib/api-client";

// ── Response types ──────────────────────────────────────────────────────────

/** "CONSULTATION" (Feature 2) | "PHASE_PROGRESS" (Feature 4). */
export type HealthReportType = "CONSULTATION" | "PHASE_PROGRESS";

/** Summary stats stored in reportData for PHASE_PROGRESS reports. */
export interface PhaseProgressStats {
    tasksTotal: number;
    tasksDone: number;
    tasksPercent: number;
    painAtStart: number | null;
    painAtEnd: number | null;
    painReduction: number | null;
    wellnessAtStart: number | null;
    wellnessAtEnd: number | null;
    wellnessImprovement: number | null;
    dietAdherencePercent: number | null;
    dietTotal: number;
    dietFollowed: number;
}

/** reportData payload shape for PHASE_PROGRESS reports. */
export interface PhaseProgressReportData {
    stats: PhaseProgressStats;
    phaseName: string | null;
    phaseOrder: number | null;
    journeyTitle: string | null;
    hasPhotos: boolean;
    milestonesAchievedCount: number;
}

export interface HealthReportListItem {
    id: string;
    createdAt: string;
    sentViaWhatsApp: boolean;
    whatsappSentAt: string | null;
    viewedByPatient: boolean;
    doctorName: string | null;
    branchName: string | null;
    appointmentDate: string | null;
    pdfSizeBytes: number | null;
    // Feature 4 — discriminator + JSON payload (CONSULTATION reports leave
    // these as "CONSULTATION" / null / null/{}).
    reportType: HealthReportType;
    journeyPhaseId: string | null;
    reportData: PhaseProgressReportData | Record<string, unknown> | null;
}

export interface PhaseProgressReportItem {
    id: string;
    reportType: HealthReportType;
    createdAt: string;
    sentViaWhatsApp: boolean;
    whatsappSentAt: string | null;
    viewedByPatient: boolean;
    pdfSizeBytes: number | null;
    doctorName: string | null;
    branchName: string | null;
    reportData: PhaseProgressReportData | null;
}

export interface HealthReportPreview {
    hasTriage: boolean;
    painRegionCount: number;
    hasJourney: boolean;
    journeyTitle: string | null;
    prescriptionCount: number;
    hasDiet: boolean;
    dietTitle: string | null;
    hasNextAppointment: boolean;
    nextAppointmentDate: string | null;
    hasConsultationNotes: boolean;
    existingReport: {
        id: string;
        createdAt: string;
        sentViaWhatsApp: boolean;
    } | null;
}

export interface HealthReportGenerateResponse {
    success: boolean;
    alreadyExisted?: boolean;
    report: {
        id: string;
        pdfPath?: string | null;
        sentViaWhatsApp: boolean;
        whatsappSentAt?: string | null;
        whatsappDelivered?: boolean;
        whatsappError?: string | null;
        createdAt: string;
    };
}

export interface HealthReportResendResponse {
    success: boolean;
    whatsappDelivered?: boolean;
    whatsappError?: string | null;
}

// ── API surface ─────────────────────────────────────────────────────────────

export const healthReportService = {
    /** Generate a new health report; idempotent per appointmentId. */
    async generate(payload: {
        appointmentId?: string | null;
        patientId: string;
        sendWhatsApp: boolean;
    }): Promise<HealthReportGenerateResponse> {
        const { data } = await apiClient.post<HealthReportGenerateResponse>(
            "/api/health-reports/generate",
            payload,
        );
        return data;
    },

    /** List all reports for a patient (most-recent first). PATIENT can only fetch their own. */
    async getPatientReports(patientId: string): Promise<HealthReportListItem[]> {
        const { data } = await apiClient.get<HealthReportListItem[]>(
            `/api/health-reports/patient/${patientId}`,
        );
        return data;
    },

    /** Re-send an existing report's PDF via WhatsApp. */
    async resendWhatsApp(reportId: string): Promise<HealthReportResendResponse> {
        const { data } = await apiClient.post<HealthReportResendResponse>(
            `/api/health-reports/${reportId}/resend-whatsapp`,
            {},
        );
        return data;
    },

    /**
     * Lightweight availability check used by the GenerateReportButton modal —
     * what data is on file for this patient + appointment? No PDF generated.
     */
    async getPreview(patientId: string, appointmentId?: string | null): Promise<HealthReportPreview> {
        const { data } = await apiClient.get<HealthReportPreview>(
            "/api/health-reports/preview",
            {
                patientId,
                ...(appointmentId ? { appointmentId } : {}),
            },
        );
        return data;
    },

    /**
     * Download the PDF as a Blob (auth header is injected automatically).
     * Caller is responsible for revoking the object URL it creates.
     */
    async downloadBlob(reportId: string): Promise<Blob> {
        return apiClient.getBlob(`/api/health-reports/${reportId}/download`);
    },

    /** Manually generate (or re-generate) a phase progress report. */
    async generateProgress(payload: {
        phaseId: string;
        patientId: string;
    }): Promise<HealthReportGenerateResponse> {
        const { data } = await apiClient.post<HealthReportGenerateResponse>(
            "/api/health-reports/generate-progress",
            payload,
        );
        return data;
    },

    /**
     * Fetch the PHASE_PROGRESS report for a specific phase (if one exists).
     * Returns null when 404 — used by the doctor-side phase indicator to
     * lazily check whether a report has been generated.
     */
    async getPhaseReport(phaseId: string): Promise<PhaseProgressReportItem | null> {
        try {
            const { data } = await apiClient.get<PhaseProgressReportItem>(
                `/api/health-reports/phase/${phaseId}`,
            );
            return data;
        } catch (err: unknown) {
            // Treat 404 as "no report yet" — caller distinguishes that from
            // a real error using the null return.
            if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 404) {
                return null;
            }
            throw err;
        }
    },
};

export default healthReportService;
