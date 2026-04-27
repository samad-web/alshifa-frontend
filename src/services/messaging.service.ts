import { apiClient } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────

export type MessageTemplateCategory =
  | "DAILY_CHECKIN"
  | "APPOINTMENT_CONFIRMATION"
  | "APPOINTMENT_REMINDER"
  | "CUSTOM";

export type DeliveryChannel = "WHATSAPP" | "IN_APP";

export interface MessageTemplate {
  id: string;
  hospitalId: string;
  name: string;
  category: MessageTemplateCategory;
  body: string;
  subject: string | null;
  channels: DeliveryChannel[];
  placeholders: string[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; email: string } | null;
  updatedBy?: { id: string; email: string } | null;
}

export interface StandardPlaceholder {
  key: string;
  description: string;
  example?: string;
}

export interface TemplatePreview {
  subject: string | null;
  body: string;
  placeholders: string[];
  contextUsed: Record<string, string>;
}

export interface MessageTemplateUpsert {
  name: string;
  category: MessageTemplateCategory;
  body: string;
  subject?: string | null;
  channels?: DeliveryChannel[];
  isDefault?: boolean;
  isActive?: boolean;
}

// ── Client ────────────────────────────────────────────────────────────────

export const messageTemplateService = {
  list: (params?: { category?: MessageTemplateCategory; isActive?: boolean; search?: string }) =>
    apiClient.get<{ data: MessageTemplate[] }>("/api/message-templates", params)
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<{ data: MessageTemplate }>(`/api/message-templates/${id}`)
      .then((r) => r.data),

  create: (payload: MessageTemplateUpsert) =>
    apiClient.post<{ data: MessageTemplate }>("/api/message-templates", payload)
      .then((r) => r.data),

  update: (id: string, payload: Partial<MessageTemplateUpsert>) =>
    apiClient.put<{ data: MessageTemplate }>(`/api/message-templates/${id}`, payload)
      .then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete(`/api/message-templates/${id}`),

  preview: (payload: { body?: string; subject?: string; templateId?: string; appointmentId?: string; context?: Record<string, string> }) =>
    apiClient.post<{ data: TemplatePreview }>("/api/message-templates/preview", payload)
      .then((r) => r.data),

  listPlaceholders: () =>
    apiClient.get<{ data: StandardPlaceholder[] }>("/api/message-templates/placeholders")
      .then((r) => r.data),
};

// ── Reminder settings ─────────────────────────────────────────────────────

export interface ReminderSetting {
  id: string;
  hospitalId: string;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;           // HH:MM
  dailyReminderChannels: DeliveryChannel[];
  dailyReminderTemplateId: string | null;
  dailyReminderTemplate?: MessageTemplate | null;
  dailyReminderInlineBody: string | null;
  skipIfAlreadyCheckedIn: boolean;
  lastRunAt: string | null;
  lastRunTargetCount: number | null;
  lastRunSuccessCount: number | null;
}

export interface ReminderSettingUpdate {
  dailyReminderEnabled?: boolean;
  dailyReminderTime?: string;
  dailyReminderChannels?: DeliveryChannel[];
  dailyReminderTemplateId?: string | null;
  dailyReminderInlineBody?: string | null;
  skipIfAlreadyCheckedIn?: boolean;
}

export interface ReminderDeliveryLog {
  id: string;
  kind: "DAILY_CHECKIN" | "APPOINTMENT_CONFIRMATION" | "APPOINTMENT_REMINDER";
  channel: DeliveryChannel;
  status: "SENT" | "FAILED" | "SKIPPED" | "FALLBACK";
  target: string | null;
  externalId: string | null;
  errorMessage: string | null;
  createdAt: string;
  template?: { name: string } | null;
}

export const reminderSettingService = {
  get: () =>
    apiClient.get<{ data: ReminderSetting }>("/api/reminder-settings").then((r) => r.data),

  update: (payload: ReminderSettingUpdate) =>
    apiClient.put<{ data: ReminderSetting }>("/api/reminder-settings", payload).then((r) => r.data),

  triggerNow: () =>
    apiClient.post<{ data: { targetCount: number; successCount: number; manual: boolean } }>(
      "/api/reminder-settings/trigger-now", {}).then((r) => r.data),

  deliveries: (params?: { kind?: string; limit?: number; offset?: number }) =>
    apiClient.get<{ data: ReminderDeliveryLog[]; total: number }>(
      "/api/reminder-settings/deliveries", params),
};

// ── Appointment reminder override ─────────────────────────────────────────

export const appointmentReminderService = {
  update: (appointmentId: string, payload: { templateId?: string | null; body?: string | null; subject?: string | null; channels?: DeliveryChannel[] }) =>
    apiClient.patch(`/api/appointments/${appointmentId}/reminder-template`, payload),
};
