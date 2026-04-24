import { apiClient } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────

export type TodoPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TodoStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED";
export type TodoTab = "all" | "assigned" | "self" | "done";

export interface TodoUserRef {
  id: string;
  name: string;
  role: string;
}

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  dueDate: string | null;
  xpReward: number;
  completedAt: string | null;
  createdAt: string;
  createdBy: TodoUserRef | null;
  assignedTo: TodoUserRef | null;
  relatedPatient: { id: string; fullName: string; patientId: string | null } | null;
  relatedAppointment: { id: string; date: string } | null;
  isSelfCreated: boolean;
  isOverdue: boolean;
}

export interface TodoSummary {
  pending: number;
  completedToday: number;
  xpToday: number;
  overdue: number;
}

export interface TodoListResponse {
  items: Todo[];
  total: number;
  summary: TodoSummary;
}

export interface AssignedByMeResponse {
  items: Todo[];
  total: number;
  summary: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
  };
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: TodoPriority;
  dueDate?: string | null;
  relatedPatientId?: string | null;
  relatedAppointmentId?: string | null;
}

export interface AssignTodoInput extends CreateTodoInput {
  assignedToId: string;
  xpReward?: number;
}

export interface AssignableStaff {
  id: string;
  name: string;
  role: string;
  branch: string | null;
}

// ── API ───────────────────────────────────────────────────────────────────

export const todosApi = {
  list(params: { tab?: TodoTab; status?: TodoStatus; priority?: TodoPriority } = {}) {
    const qs = new URLSearchParams();
    if (params.tab) qs.set("tab", params.tab);
    if (params.status) qs.set("status", params.status);
    if (params.priority) qs.set("priority", params.priority);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get<TodoListResponse>(`/api/todos${suffix}`).then(r => r.data);
  },

  summary() {
    return apiClient.get<TodoSummary>("/api/todos/summary").then(r => r.data);
  },

  listAssignedByMe(params: { status?: TodoStatus } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get<AssignedByMeResponse>(`/api/todos/assigned-by-me${suffix}`).then(r => r.data);
  },

  createSelf(input: CreateTodoInput) {
    return apiClient.post<Todo>("/api/todos", input).then(r => r.data);
  },

  assign(input: AssignTodoInput) {
    return apiClient.post<Todo>("/api/todos/assign", input).then(r => r.data);
  },

  setStatus(id: string, status: TodoStatus) {
    return apiClient.patch<Todo>(`/api/todos/${id}/status`, { status }).then(r => r.data);
  },

  edit(id: string, patch: Partial<CreateTodoInput & { xpReward: number }>) {
    return apiClient.patch<Todo>(`/api/todos/${id}`, patch).then(r => r.data);
  },

  revoke(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/api/todos/${id}`).then(r => r.data);
  },

  remind(id: string) {
    return apiClient.post<{ ok: boolean }>(`/api/todos/${id}/remind`, {}).then(r => r.data);
  },

  assignableStaff() {
    return apiClient.get<{ staff: AssignableStaff[] }>("/api/dashboards/staff/assignable").then(r => r.data);
  },
};

export default todosApi;
