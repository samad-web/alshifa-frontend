/**
 * Workflow Automation Rules API service (Feature 3).
 *
 * Wraps `/api/workflow-rules/*` through the shared apiClient so token
 * refresh + error shape stays consistent with the rest of the app.
 */

import apiClient from "@/lib/api-client";

// ── Types ───────────────────────────────────────────────────────────────────

export type TriggerType =
    | "NO_CHECKIN"
    | "PAIN_NOT_IMPROVING"
    | "DIET_ADHERENCE_LOW"
    | "PHASE_OVERDUE"
    | "PRESCRIPTION_UNCOLLECTED"
    | "PHASE_COMPLETED";

export type ActionType =
    | "SEND_WHATSAPP"
    | "SEND_IN_APP"
    | "CREATE_FOLLOW_UP_TASK"
    | "FLAG_FOR_DOCTOR";

export type RuleAction =
    | { type: "SEND_WHATSAPP";  messageTemplate: string }
    | { type: "SEND_IN_APP";    messageTemplate: string }
    | { type: "CREATE_FOLLOW_UP_TASK"; taskTitle: string; priority?: "HIGH" | "MEDIUM" | "LOW"; dueDays?: number }
    | { type: "FLAG_FOR_DOCTOR"; message: string };

export interface WorkflowRule {
    id: string;
    branchId: string;
    name: string;
    description: string | null;
    isActive: boolean;
    triggerType: TriggerType;
    conditionValue: Record<string, unknown>;
    actions: RuleAction[];
    cooldownHours: number;
    totalFired: number;
    lastEvaluatedAt: string | null;
    createdAt: string;
    updatedAt: string;
    _count?: { logs: number; cooldowns: number };
}

export interface RuleLogActionResult {
    type: ActionType | string;
    success: boolean;
    error?: string;
    taskId?: string;
    alreadyExisted?: boolean;
}

export interface RuleLogItem {
    id: string;
    triggeredAt: string;
    patientId: string;
    patientName: string;
    actionsTaken: RuleLogActionResult[];
}

export interface RuleLogPage {
    logs: RuleLogItem[];
    total: number;
    page: number;
    totalPages: number;
}

// ── API surface ─────────────────────────────────────────────────────────────

export const workflowRuleService = {
    async getRules(): Promise<WorkflowRule[]> {
        const { data } = await apiClient.get<WorkflowRule[]>("/api/workflow-rules");
        return data;
    },

    async createRule(payload: {
        name: string;
        description?: string | null;
        triggerType: TriggerType;
        conditionValue: Record<string, unknown>;
        actions: RuleAction[];
        cooldownHours: number;
    }): Promise<WorkflowRule> {
        const { data } = await apiClient.post<WorkflowRule>("/api/workflow-rules", payload);
        return data;
    },

    async updateRule(id: string, patch: Partial<{
        name: string;
        description: string | null;
        conditionValue: Record<string, unknown>;
        actions: RuleAction[];
        cooldownHours: number;
        isActive: boolean;
    }>): Promise<WorkflowRule> {
        const { data } = await apiClient.patch<WorkflowRule>(`/api/workflow-rules/${id}`, patch);
        return data;
    },

    async deleteRule(id: string): Promise<{ success: boolean }> {
        const { data } = await apiClient.delete<{ success: boolean }>(`/api/workflow-rules/${id}`);
        return data;
    },

    async getLogs(ruleId: string, page = 1, limit = 20): Promise<RuleLogPage> {
        const { data } = await apiClient.get<RuleLogPage>(
            `/api/workflow-rules/${ruleId}/logs`,
            { page, limit },
        );
        return data;
    },

    async evaluateNow(): Promise<{ success: boolean; message: string }> {
        const { data } = await apiClient.post<{ success: boolean; message: string }>(
            "/api/workflow-rules/evaluate-now",
            {},
        );
        return data;
    },
};

export default workflowRuleService;
