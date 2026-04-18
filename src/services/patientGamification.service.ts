/**
 * Patient Gamification API service — health quests, avatar, family leaderboard,
 * referral gamification, enhanced social proof, health content.
 */

import apiClient from '@/lib/api-client';
import type {
  HealthQuest, HealthAvatarState, PatientFamilyEntry,
  ReferralStats, EnhancedSocialProof, StreakMilestone,
  HealthContentEntry
} from '@/types';

export const patientGamificationApi = {
  // ── Health Quests (Feature 21) ────────────────────────────────────────────

  async getAvailableQuests(): Promise<HealthQuest[]> {
    const { data } = await apiClient.get<HealthQuest[]>('/api/patient-gamification/quests');
    return data;
  },

  async startQuest(questId: string): Promise<{ started: boolean }> {
    const { data } = await apiClient.post<{ started: boolean }>(`/api/patient-gamification/quests/${questId}/start`, {});
    return data;
  },

  async recordTaskProgress(questId: string, taskIndex: number): Promise<{ completed: boolean; questCompleted: boolean; pointsEarned?: number }> {
    const { data } = await apiClient.post<{ completed: boolean; questCompleted: boolean; pointsEarned?: number }>(
      `/api/patient-gamification/quests/${questId}/tasks/${taskIndex}`, {}
    );
    return data;
  },

  async getMyQuests(params?: { status?: string }): Promise<HealthQuest[]> {
    const { data } = await apiClient.get<HealthQuest[]>('/api/patient-gamification/quests/mine', params);
    return data;
  },

  // ── Health Avatar (Feature 22) ────────────────────────────────────────────

  async getAvatar(): Promise<HealthAvatarState> {
    const { data } = await apiClient.get<HealthAvatarState>('/api/patient-gamification/avatar');
    return data;
  },

  async feedAvatar(activityType: string): Promise<HealthAvatarState> {
    const { data } = await apiClient.post<HealthAvatarState>('/api/patient-gamification/avatar/feed', { activityType });
    return data;
  },

  // ── Family Leaderboard (Feature 23) ───────────────────────────────────────

  async createFamily(name: string): Promise<PatientFamilyEntry> {
    const { data } = await apiClient.post<PatientFamilyEntry>('/api/patient-gamification/family', { name });
    return data;
  },

  async joinFamily(inviteCode: string): Promise<{ joined: boolean }> {
    const { data } = await apiClient.post<{ joined: boolean }>('/api/patient-gamification/family/join', { inviteCode });
    return data;
  },

  async getMyFamilies(): Promise<PatientFamilyEntry[]> {
    const { data } = await apiClient.get<PatientFamilyEntry[]>('/api/patient-gamification/family');
    return data;
  },

  async getFamilyLeaderboard(familyId: string): Promise<PatientFamilyEntry> {
    const { data } = await apiClient.get<PatientFamilyEntry>(`/api/patient-gamification/family/${familyId}/leaderboard`);
    return data;
  },

  async leaveFamily(familyId: string): Promise<void> {
    await apiClient.delete(`/api/patient-gamification/family/${familyId}/leave`);
  },

  async getGlobalFamilyRankings(params?: { page?: number; limit?: number }): Promise<PatientFamilyEntry[]> {
    type Shape = PatientFamilyEntry[] | { rankings: PatientFamilyEntry[] } | { data: PatientFamilyEntry[] };
    const { data } = await apiClient.get<Shape>('/api/patient-gamification/family/rankings', params);
    if (Array.isArray(data)) return data;
    if ('rankings' in data) return data.rankings ?? [];
    return data.data ?? [];
  },

  // ── Referral Gamification (Feature 24) ────────────────────────────────────

  async getReferralStats(): Promise<ReferralStats> {
    const { data } = await apiClient.get<ReferralStats>('/api/patient-gamification/referral-stats');
    return data;
  },

  // ── Enhanced Social Proof (Feature 25) ────────────────────────────────────

  async getEnhancedSocialProof(): Promise<EnhancedSocialProof> {
    const { data } = await apiClient.get<EnhancedSocialProof>('/api/patient-gamification/social-proof/enhanced');
    return data;
  },

  async getStreakMilestones(): Promise<StreakMilestone[]> {
    const { data } = await apiClient.get<StreakMilestone[]>('/api/patient-gamification/streaks/milestones');
    return data;
  },

  // ── Health Content (Feature 26) ───────────────────────────────────────────

  async getContentLibrary(): Promise<HealthContentEntry[]> {
    const { data } = await apiClient.get<HealthContentEntry[]>('/api/patient-gamification/content');
    return data;
  },

  async unlockContent(contentId: string): Promise<{ unlocked: boolean }> {
    const { data } = await apiClient.post<{ unlocked: boolean }>(`/api/patient-gamification/content/${contentId}/unlock`, {});
    return data;
  },

  async getUnlockedContent(): Promise<HealthContentEntry[]> {
    const { data } = await apiClient.get<HealthContentEntry[]>('/api/patient-gamification/content/unlocked');
    return data;
  },
};
