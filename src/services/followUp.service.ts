import { apiClient } from "@/lib/api-client";

export type FollowUpInterval =
    | "SEVEN_DAYS"
    | "FOURTEEN_DAYS"
    | "THIRTY_DAYS"
    | "SIXTY_DAYS"
    | "NINETY_DAYS"
    | "CUSTOM"
    | "SINGLE_VISIT";

export type FollowUpStatus = "PENDING" | "COMPLETED" | "MISSED" | "CANCELLED";

export interface FollowUpPayload {
    interval: FollowUpInterval;
    daysOffset?: number | null;
    notes?: string | null;
}

export interface FollowUp {
    id: string;
    appointmentId: string;
    patientId: string;
    interval: FollowUpInterval;
    daysOffset: number | null;
    dueDate: string | null;
    isSingleVisit: boolean;
    status: FollowUpStatus;
    notes: string | null;
    createdById: string;
    completedByAppointmentId: string | null;
    createdAt: string;
    updatedAt: string;
}

export const FOLLOW_UP_OPTIONS: Array<{
    interval: FollowUpInterval;
    label: string;
    description: string;
}> = [
    { interval: "SEVEN_DAYS",     label: "7 days",   description: "Short-term recheck" },
    { interval: "FOURTEEN_DAYS",  label: "14 days",  description: "Two-week review" },
    { interval: "THIRTY_DAYS",    label: "30 days",  description: "Monthly review" },
    { interval: "SIXTY_DAYS",     label: "60 days",  description: "Bi-monthly review" },
    { interval: "NINETY_DAYS",    label: "90 days",  description: "Quarterly review" },
    { interval: "CUSTOM",         label: "Custom",   description: "Pick a specific number of days" },
    { interval: "SINGLE_VISIT",   label: "Single visit", description: "No further follow-up needed" },
];

export const followUpService = {
    getForAppointment(appointmentId: string) {
        return apiClient
            .get<{ data: FollowUp }>(`/api/appointments/${appointmentId}/follow-up`)
            .then((r) => r.data?.data ?? null)
            .catch((err) => {
                if (err?.status === 404) return null;
                throw err;
            });
    },
    attachToAppointment(appointmentId: string, followUp: FollowUpPayload) {
        return apiClient
            .put<{ data: FollowUp }>(`/api/appointments/${appointmentId}/follow-up`, { followUp })
            .then((r) => r.data?.data);
    },
};

export default followUpService;
