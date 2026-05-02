/**
 * Follow-Up Task API service (Feature 5).
 *
 * Wraps `/api/follow-up-tasks/*` through the shared apiClient so token
 * refresh + error shape handling stays consistent with the rest of the app.
 */

import apiClient from "@/lib/api-client";

// ── Types ───────────────────────────────────────────────────────────────────

export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";
export type FollowUpTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED";
export type TriggerType =
    | "TRIAGE_SWELLING"
    | "TRIAGE_HIGH_PAIN"
    | "CONSULTATION_HIGH_PAIN"
    | "DIET_ADHERENCE_LOW"
    | "PHASE_STARTED"
    | "MANUAL";

export interface FollowUpTaskItem {
    id: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    status: FollowUpTaskStatus;
    dueDate: string;
    triggerType: TriggerType | string;
    triggerRef: string | null;
    completedAt: string | null;
    completionNote: string | null;
    xpAwarded: boolean;
    createdAt: string;
    patientId: string;
    patientName: string;
    patientAvatar: string | null;
}

export interface FollowUpTaskSummary {
    pending: number;
    overdue: number;
    highPriority: number;
}

export interface FollowUpTaskCompleteResponse {
    success: boolean;
    task: FollowUpTaskItem;
    xpAmount: number;
    xpAwarded: boolean;
}

export interface FollowUpTaskCreateResponse {
    success: boolean;
    alreadyExisted: boolean;
    task: FollowUpTaskItem;
}

// ── API surface ─────────────────────────────────────────────────────────────

export const followUpTaskService = {
    async getTasks(params?: { status?: string; priority?: string; date?: string }): Promise<FollowUpTaskItem[]> {
        const { data } = await apiClient.get<FollowUpTaskItem[]>(
            "/api/follow-up-tasks",
            params as Record<string, string> | undefined,
        );
        return data;
    },

    async getSummary(): Promise<FollowUpTaskSummary> {
        const { data } = await apiClient.get<FollowUpTaskSummary>("/api/follow-up-tasks/summary");
        return data;
    },

    async complete(taskId: string, completionNote?: string): Promise<FollowUpTaskCompleteResponse> {
        const { data } = await apiClient.patch<FollowUpTaskCompleteResponse>(
            `/api/follow-up-tasks/${taskId}/complete`,
            { completionNote: completionNote ?? null },
        );
        return data;
    },

    async updateStatus(taskId: string, status: Exclude<FollowUpTaskStatus, "COMPLETED">): Promise<FollowUpTaskItem> {
        const { data } = await apiClient.patch<FollowUpTaskItem>(
            `/api/follow-up-tasks/${taskId}/status`,
            { status },
        );
        return data;
    },

    async create(payload: {
        patientId: string;
        title: string;
        description?: string;
        priority: TaskPriority;
        dueDays: number;
    }): Promise<FollowUpTaskCreateResponse> {
        const { data } = await apiClient.post<FollowUpTaskCreateResponse>(
            "/api/follow-up-tasks",
            payload,
        );
        return data;
    },
};

export default followUpTaskService;
