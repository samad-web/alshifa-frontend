/**
 * Typed client for /api/staff-chat — staff DMs and branch group chats.
 * Distinct from the patient/clinician chat client.
 */

import { apiClient } from "@/lib/api-client";

export type StaffThreadKind = "DIRECT" | "GROUP";
export type StaffThreadMemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type StaffMessageKind = "TEXT" | "SYSTEM";

export interface StaffThreadSummary {
  id: string;
  kind: StaffThreadKind;
  title: string;
  hospitalId: string;
  branch: { id: string; name: string } | null;
  createdById: string;
  myRole: StaffThreadMemberRole;
  myIsAutoIncluded: boolean;
  memberCount: number;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    sender: { id: string } | null;
  } | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  partner: { id: string; name: string; role: string } | null;
}

export interface StaffThreadMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  threadRole: StaffThreadMemberRole;
  isAutoIncluded: boolean;
  joinedAt: string;
  addedBy: { id: string; email: string } | null;
  isSelf: boolean;
  branch: { id: string; name: string } | null;
}

export interface StaffThreadDetail {
  id: string;
  kind: StaffThreadKind;
  title: string | null;
  branch: { id: string; name: string } | null;
  createdById: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  myRole: StaffThreadMemberRole | null;
  isSystemAdminView: boolean;
  canManage: boolean;
  members: StaffThreadMember[];
}

export interface StaffMessage {
  id: string;
  threadId: string;
  senderId: string | null;
  senderName: string | null;
  senderRole: string | null;
  kind: StaffMessageKind;
  content: string;
  deletedAt: string | null;
  editedAt: string | null;
  createdAt: string;
}

export interface AddressableUser {
  id: string;
  name: string;
  role: string;
  email: string;
  branch: { id: string; name: string } | null;
}

export const staffChatApi = {
  threads(): Promise<StaffThreadSummary[]> {
    return apiClient.get<{ threads: StaffThreadSummary[] }>("/api/staff-chat/threads")
      .then((r) => r.data.threads);
  },

  users(opts: { branchId?: string; search?: string } = {}): Promise<AddressableUser[]> {
    const qs = new URLSearchParams();
    if (opts.branchId) qs.set("branchId", opts.branchId);
    if (opts.search) qs.set("search", opts.search);
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get<{ users: AddressableUser[] }>(`/api/staff-chat/users${tail}`)
      .then((r) => r.data.users);
  },

  openDirect(partnerUserId: string): Promise<{ id: string }> {
    return apiClient.post<{ id: string }>("/api/staff-chat/threads/direct", { partnerUserId })
      .then((r) => r.data);
  },

  createGroup(input: {
    title: string;
    branchId?: string | null;
    memberUserIds: string[];
  }): Promise<{ id: string }> {
    return apiClient.post<{ id: string }>("/api/staff-chat/threads/group", input)
      .then((r) => r.data);
  },

  detail(threadId: string): Promise<StaffThreadDetail> {
    return apiClient.get<StaffThreadDetail>(`/api/staff-chat/threads/${threadId}`)
      .then((r) => r.data);
  },

  archive(threadId: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/api/staff-chat/threads/${threadId}`)
      .then((r) => r.data);
  },

  messages(
    threadId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ messages: StaffMessage[]; hasMore: boolean; nextCursor: string | null }> {
    const qs = new URLSearchParams();
    if (opts.cursor) qs.set("cursor", opts.cursor);
    if (opts.limit) qs.set("limit", String(opts.limit));
    const tail = qs.toString() ? `?${qs.toString()}` : "";
    return apiClient.get<{ messages: StaffMessage[]; hasMore: boolean; nextCursor: string | null }>(
      `/api/staff-chat/threads/${threadId}/messages${tail}`,
    ).then((r) => r.data);
  },

  send(threadId: string, content: string): Promise<StaffMessage> {
    return apiClient.post<StaffMessage>(`/api/staff-chat/threads/${threadId}/messages`, { content })
      .then((r) => r.data);
  },

  markRead(threadId: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>(`/api/staff-chat/threads/${threadId}/read`, {})
      .then((r) => r.data);
  },

  addMember(threadId: string, userId: string): Promise<{ id: string; userId: string; role: StaffThreadMemberRole }> {
    return apiClient.post<{ id: string; userId: string; role: StaffThreadMemberRole }>(
      `/api/staff-chat/threads/${threadId}/members`, { userId },
    ).then((r) => r.data);
  },

  removeMember(threadId: string, userId: string): Promise<{ ok: true }> {
    return apiClient.delete<{ ok: true }>(`/api/staff-chat/threads/${threadId}/members/${userId}`)
      .then((r) => r.data);
  },
};

export default staffChatApi;
