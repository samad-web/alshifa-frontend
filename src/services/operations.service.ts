/**
 * Operations API service — resource sharing, centralized inventory,
 * staff activity, performance scorecards, attendance, skill matrix.
 */

import apiClient from '@/lib/api-client';
import type {
  ResourceSharingEntry, CentralizedInventoryItem, StockTransferEntry,
  StaffActivityEntry, PerformanceScorecard, StaffAttendanceEntry,
  AttendanceStats, StaffSkillEntry, SkillMatrixRow,
  ClinicianCalendar, BranchCalendar,
} from '@/types';

export const operationsApi = {
  // ── Resource Sharing (Feature 4) ──────────────────────────────────────────

  async createSharingRequest(data: {
    userId: string; fromBranchId: string; toBranchId: string;
    date: string; startTime: string; endTime: string; reason?: string;
  }): Promise<ResourceSharingEntry> {
    const { data: result } = await apiClient.post<ResourceSharingEntry>('/api/operations/resource-sharing', data);
    return result;
  },

  async getSharingRequests(params?: { branchId?: string; status?: string }): Promise<ResourceSharingEntry[]> {
    // Backend returns { data, total, page, limit, totalPages } — unwrap the list.
    const { data } = await apiClient.get<ResourceSharingEntry[] | { data: ResourceSharingEntry[] }>('/api/operations/resource-sharing', params);
    if (Array.isArray(data)) return data;
    return (data as { data?: ResourceSharingEntry[] })?.data ?? [];
  },

  async getSharedStaffToday(branchId: string): Promise<ResourceSharingEntry[]> {
    const { data } = await apiClient.get<ResourceSharingEntry[]>(`/api/operations/resource-sharing/today/${branchId}`);
    return data;
  },

  async approveSharingRequest(id: string): Promise<ResourceSharingEntry> {
    const { data } = await apiClient.patch<ResourceSharingEntry>(`/api/operations/resource-sharing/${id}/approve`, {});
    return data;
  },

  async rejectSharingRequest(id: string): Promise<ResourceSharingEntry> {
    const { data } = await apiClient.patch<ResourceSharingEntry>(`/api/operations/resource-sharing/${id}/reject`, {});
    return data;
  },

  // Pre-flight availability check — used by the create-sharing form so the
  // admin sees "on leave" / "blocked" warnings before submitting.
  async checkStaffAvailability(userId: string, params: { date: string; startTime: string; endTime: string }):
      Promise<{ available: boolean; reason?: string }> {
    const { data } = await apiClient.get<{ available: boolean; reason?: string }>(
      `/api/availability/user/${userId}/check`,
      params,
    );
    return data;
  },

  // ── Centralized Inventory (Feature 6) ─────────────────────────────────────

  async getCentralizedInventory(): Promise<CentralizedInventoryItem[]> {
    const { data } = await apiClient.get<CentralizedInventoryItem[]>('/api/operations/inventory/centralized');
    return data;
  },

  async createTransferRequest(data: {
    medicineId: string; fromBranchId: string; toBranchId: string;
    quantity: number; notes?: string;
  }): Promise<StockTransferEntry> {
    const { data: result } = await apiClient.post<StockTransferEntry>('/api/operations/inventory/transfer', data);
    return result;
  },

  async getTransfers(params?: { branchId?: string; status?: string }): Promise<StockTransferEntry[]> {
    const { data } = await apiClient.get<StockTransferEntry[] | { data: StockTransferEntry[] }>('/api/operations/inventory/transfers', params);
    return Array.isArray(data) ? data : data?.data ?? [];
  },

  async approveTransfer(id: string): Promise<StockTransferEntry> {
    const { data } = await apiClient.patch<StockTransferEntry>(`/api/operations/inventory/transfer/${id}/approve`, {});
    return data;
  },

  async receiveTransfer(id: string): Promise<StockTransferEntry> {
    const { data } = await apiClient.patch<StockTransferEntry>(`/api/operations/inventory/transfer/${id}/receive`, {});
    return data;
  },

  // ── Staff Activity Feed (Feature 7) ───────────────────────────────────────

  async recordActivity(data: { activityType: string; metadata?: Record<string, unknown> }): Promise<void> {
    await apiClient.post('/api/operations/staff-activity', data);
  },

  async getLiveStaffFeed(branchId?: string): Promise<StaffActivityEntry[]> {
    const path = branchId
      ? `/api/operations/staff-activity/live/${branchId}`
      : '/api/operations/staff-activity/live';
    const { data } = await apiClient.get<StaffActivityEntry[]>(path);
    return data;
  },

  async getAllBranchesStaffFeed(): Promise<StaffActivityEntry[]> {
    const { data } = await apiClient.get<StaffActivityEntry[]>('/api/operations/staff-activity/all-branches');
    return data;
  },

  // ── Performance Scorecards (Feature 8) ────────────────────────────────────

  async getMyScorecards(params?: { periodType?: string }): Promise<PerformanceScorecard[]> {
    const { data } = await apiClient.get<PerformanceScorecard[]>('/api/operations/scorecards/mine', params);
    return data;
  },

  async getBranchScorecards(branchId: string, params?: { period?: string }): Promise<PerformanceScorecard[]> {
    const { data } = await apiClient.get<PerformanceScorecard[]>(`/api/operations/scorecards/branch/${branchId}`, params);
    return data;
  },

  async generateScorecards(data: { period: string; periodType: string }): Promise<{ generated: number }> {
    const { data: result } = await apiClient.post<{ generated: number }>('/api/operations/scorecards/generate', data);
    return result;
  },

  // ── Attendance (Feature 9) ────────────────────────────────────────────────

  async clockIn(): Promise<StaffAttendanceEntry> {
    const { data } = await apiClient.post<StaffAttendanceEntry>('/api/operations/attendance/clock-in', {});
    return data;
  },

  async clockOut(): Promise<StaffAttendanceEntry> {
    const { data } = await apiClient.post<StaffAttendanceEntry>('/api/operations/attendance/clock-out', {});
    return data;
  },

  async getMyAttendance(params?: { startDate?: string; endDate?: string }): Promise<StaffAttendanceEntry[]> {
    const { data } = await apiClient.get<StaffAttendanceEntry[]>('/api/operations/attendance/mine', params);
    return data;
  },

  async getBranchAttendance(branchId: string, params?: { date?: string }): Promise<StaffAttendanceEntry[]> {
    const { data } = await apiClient.get<StaffAttendanceEntry[]>(`/api/operations/attendance/branch/${branchId}`, params);
    return data;
  },

  async getMyAttendanceStats(params?: { startDate?: string; endDate?: string }): Promise<AttendanceStats> {
    const { data } = await apiClient.get<AttendanceStats>('/api/operations/attendance/stats', params);
    return data;
  },

  async getPunctualityReport(branchId: string, params?: { startDate?: string; endDate?: string }): Promise<unknown> {
    const { data } = await apiClient.get(`/api/operations/attendance/report/${branchId}`, params);
    return data;
  },

  // Admin override — set/edit a staff member's clock-in/out for a given date.
  // Status is re-derived from the schedule unless `status` is passed explicitly.
  async setAttendance(userId: string, body: {
    date: string;          // YYYY-MM-DD
    clockIn?: string;      // HH:mm
    clockOut?: string;     // HH:mm
    status?: import('@/types').AttendanceStatus;
    notes?: string;
  }): Promise<StaffAttendanceEntry> {
    const { data } = await apiClient.put<StaffAttendanceEntry>(`/api/operations/attendance/user/${userId}`, body);
    return data;
  },

  async deleteAttendance(userId: string, date: string): Promise<{ deleted: boolean }> {
    const { data } = await apiClient.delete<{ deleted: boolean }>(
      `/api/operations/attendance/user/${encodeURIComponent(userId)}?date=${encodeURIComponent(date)}`
    );
    return data;
  },

  // Admin-initiated reconciliation — flip leave/WFH/absent for a given date.
  async reconcileAttendance(branchId: string, params?: { date?: string }): Promise<{
    date: string; absent: number; leave: number; wfh: number; autoClosed: number; skipped: number;
  }> {
    const qs = params?.date ? `?date=${encodeURIComponent(params.date)}` : '';
    const { data } = await apiClient.post<{
      date: string; absent: number; leave: number; wfh: number; autoClosed: number; skipped: number;
    }>(`/api/operations/attendance/reconcile/${branchId}${qs}`, {});
    return data;
  },

  // ── Unified Calendar ──────────────────────────────────────────────────────

  async getClinicianCalendar(params?: { userId?: string; year?: number; month?: number }): Promise<ClinicianCalendar> {
    const path = params?.userId
      ? `/api/operations/calendar/clinician/${params.userId}`
      : '/api/operations/calendar/clinician';
    const { data } = await apiClient.get<ClinicianCalendar>(path, {
      year: params?.year, month: params?.month,
    });
    return data;
  },

  async getBranchCalendar(branchId: string, params?: { year?: number; month?: number }): Promise<BranchCalendar> {
    const { data } = await apiClient.get<BranchCalendar>(`/api/operations/calendar/branch/${branchId}`, params);
    return data;
  },

  // ── Skill Matrix (Feature 13) ─────────────────────────────────────────────

  async addSkill(data: {
    skillType: string; skillName: string; proficiency?: string;
    certifiedAt?: string; expiresAt?: string;
  }): Promise<StaffSkillEntry> {
    const { data: result } = await apiClient.post<StaffSkillEntry>('/api/operations/skills', data);
    return result;
  },

  async removeSkill(skillType: string, skillName: string): Promise<void> {
    await apiClient.delete(`/api/operations/skills/${skillType}/${skillName}`);
  },

  async getMySkills(): Promise<StaffSkillEntry[]> {
    const { data } = await apiClient.get<StaffSkillEntry[]>('/api/operations/skills/mine');
    return data;
  },

  async getSkillMatrix(branchId: string): Promise<SkillMatrixRow[]> {
    const { data } = await apiClient.get<SkillMatrixRow[]>(`/api/operations/skills/matrix/${branchId}`);
    return data;
  },

  async searchBySkill(params: { skillName: string; branchId?: string }): Promise<SkillMatrixRow[]> {
    const { data } = await apiClient.get<SkillMatrixRow[]>('/api/operations/skills/search', params);
    return data;
  },

  async getExpiringCertifications(params?: { daysAhead?: number }): Promise<StaffSkillEntry[]> {
    const { data } = await apiClient.get<StaffSkillEntry[]>('/api/operations/skills/expiring', params);
    return data;
  },
};
