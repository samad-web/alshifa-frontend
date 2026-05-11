/**
 * Patient History & Health Passport API client.
 *
 * Wraps the five backend endpoints under /api/patient-history. Used by:
 *   - /admin/patient-history (list + stats)
 *   - /admin/patient-history/:id (full passport)
 *   - PatientTimeline (Health Passport panel for DOCTOR/ADMIN_DOCTOR)
 *   - Patient Portal (My Journey History tab)
 */

import { apiClient } from '@/lib/api-client';

export type ReturnRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PatientHistoryRecord {
    id: string;
    patientId: string;
    journeyId: string;
    doctorId: string;
    branchId: string;
    journeyTitle: string;
    condition: string | null;
    startDate: string;
    completedDate: string;
    durationDays: number;
    painAtStart: number | null;
    painAtEnd: number | null;
    painReduction: number | null;
    wellnessAtStart: number | null;
    wellnessAtEnd: number | null;
    wellnessChange: number | null;
    totalPhases: number;
    completedPhases: number;
    totalTasks: number;
    completedTasks: number;
    taskCompletionRate: number | null;
    totalAppointments: number;
    attendedAppointments: number;
    totalPrescriptions: number;
    dietAdherencePercent: number | null;
    totalMilestones: number;
    achievedMilestones: number;
    beforePhotosCount: number;
    afterPhotosCount: number;
    zenPointsEarned: number;
    returnRiskScore: number;
    returnRiskLevel: ReturnRiskLevel;
    returnRiskNotes: string | null;
    prakriti: string | null;
    patientAge: number | null;
    patientGender: string | null;
    certificateSent: boolean;
    certificateSentAt: string | null;
    certificatePdfPath: string | null;
    followUpScheduled: boolean;
    followUpAppointmentId: string | null;
    reEnteredTreatment: boolean;
    reEntryJourneyId: string | null;
    createdAt: string;
    patient?: {
        id: string;
        fullName: string | null;
        profilePhoto: string | null;
        patientId: string | null;
        phoneNumber?: string | null;
        user?: { email?: string };
    };
    doctor?: {
        id: string;
        userId?: string;
        fullName: string | null;
        specialization?: string | null;
    };
    branch?: { name: string };
    journey?: {
        id: string;
        title: string;
        condition: string;
        startDate: string;
        wellnessScore: number;
        phases: Array<{
            id: string;
            name: string;
            order: number;
            status: string;
            durationDays: number;
            startedAt: string | null;
            completedAt: string | null;
            tasks: Array<{ id: string; title: string; type: string; frequency: string }>;
        }>;
        milestones: Array<{ id: string; title: string; description: string | null; achievedAt: string | null; isAchieved: boolean }>;
    };
}

export interface HistoryListStats {
    totalCompleted: number;
    avgPainReduction: number;
    avgDuration: number;
    returnedPatients: number;
}

export interface HistoryListResponse {
    records: PatientHistoryRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: HistoryListStats;
}

export interface HistoryDetailResponse {
    record: PatientHistoryRecord;
    appointments: Array<{
        id: string;
        date: string;
        status: string;
        consultationType?: string;
        notes?: string | null;
        doctor?: { id: string; fullName?: string | null };
    }>;
    prescriptions: Array<{
        id: string;
        medicationName: string;
        dosage: string;
        frequency: string;
        duration: string;
        notes?: string | null;
        createdAt: string;
    }>;
    photos: Array<{
        id: string;
        filePath: string;
        stage: string;
        category: string;
        bodyRegion?: string | null;
        notes?: string | null;
        takenAt: string;
    }>;
}

export const patientHistoryService = {
    list: async (params: {
        doctorId?: string;
        riskLevel?: ReturnRiskLevel;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<HistoryListResponse> => {
        const query: Record<string, string | number> = {};
        if (params.doctorId) query.doctorId = params.doctorId;
        if (params.riskLevel) query.riskLevel = params.riskLevel;
        if (params.search) query.search = params.search;
        if (params.page) query.page = params.page;
        if (params.limit) query.limit = params.limit;
        const res = await apiClient.get<HistoryListResponse>('/api/patient-history', query);
        return res.data;
    },

    getById: async (id: string): Promise<HistoryDetailResponse> => {
        const res = await apiClient.get<HistoryDetailResponse>(`/api/patient-history/${id}`);
        return res.data;
    },

    listForPatient: async (patientId: string): Promise<{ records: PatientHistoryRecord[] }> => {
        const res = await apiClient.get<{ records: PatientHistoryRecord[] }>(
            `/api/patient-history/patient/${patientId}`,
        );
        return res.data;
    },

    downloadCertificate: async (id: string): Promise<Blob> => {
        return apiClient.getBlob(`/api/patient-history/${id}/certificate/download`);
    },

    scheduleFollowUp: async (id: string, appointmentId?: string): Promise<{ record: PatientHistoryRecord }> => {
        const res = await apiClient.post<{ record: PatientHistoryRecord }>(
            `/api/patient-history/${id}/schedule-followup`,
            appointmentId ? { appointmentId } : {},
        );
        return res.data;
    },

    /**
     * Admin-initiated certificate generation for records that don't yet have
     * a PDF. Returns the updated record (with certificatePdfPath populated).
     * `sendWhatsApp` defaults to false on the backend — pass `true` to force
     * the WhatsApp delivery for an explicit retroactive send.
     */
    generateCertificate: async (
        id: string,
        opts: { sendWhatsApp?: boolean } = {},
    ): Promise<{ record: PatientHistoryRecord }> => {
        const res = await apiClient.post<{ record: PatientHistoryRecord }>(
            `/api/patient-history/${id}/generate-certificate`,
            { sendWhatsApp: opts.sendWhatsApp === true },
        );
        return res.data;
    },
};
