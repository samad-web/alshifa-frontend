/**
 * Clinician Gamification API service — XP, seasonal challenges,
 * team quests, reward store, mentor sessions, achievement showcase.
 */

import apiClient from '@/lib/api-client';
import type {
  ClinicianXPProfile, XPTransaction, XPLeaderboardEntry,
  SeasonalChallengeEntry, TeamQuestEntry, AchievementShowcase,
  RewardItem, RewardRedemption, MentorSessionEntry, MentorStats
} from '@/types';

export const clinicianGamificationApi = {
  // ── XP & Level (Feature 14) ───────────────────────────────────────────────

  async getXPProfile(): Promise<ClinicianXPProfile> {
    const { data } = await apiClient.get<ClinicianXPProfile>('/api/clinician-gamification/xp/profile');
    return data;
  },

  async getXPHistory(params?: { page?: number; limit?: number }): Promise<{ transactions: XPTransaction[]; total: number }> {
    const { data } = await apiClient.get<{ transactions: XPTransaction[]; total: number }>('/api/clinician-gamification/xp/history', params);
    return data;
  },

  async getXPLeaderboard(params?: { branchId?: string; limit?: number }): Promise<XPLeaderboardEntry[]> {
    const { data } = await apiClient.get<XPLeaderboardEntry[]>('/api/clinician-gamification/xp/leaderboard', params);
    return data;
  },

  // ── Seasonal Challenges (Feature 15) ──────────────────────────────────────

  async createSeasonalChallenge(payload: {
    title: string; description: string; icon?: string; metric: string;
    target: number; startDate: string; endDate: string;
    scope?: string; targetRoles?: string[]; rewardXP?: number; rewardPoints?: number;
  }): Promise<SeasonalChallengeEntry> {
    const { data } = await apiClient.post<SeasonalChallengeEntry>('/api/clinician-gamification/seasonal-challenges', payload);
    return data;
  },

  async getActiveSeasonalChallenges(): Promise<SeasonalChallengeEntry[]> {
    const { data } = await apiClient.get<SeasonalChallengeEntry[]>('/api/clinician-gamification/seasonal-challenges');
    return data;
  },

  async getSeasonalChallengeHistory(params?: { page?: number; limit?: number }): Promise<SeasonalChallengeEntry[]> {
    const { data } = await apiClient.get<SeasonalChallengeEntry[]>('/api/clinician-gamification/seasonal-challenges/history', params);
    return data;
  },

  // ── Team Quests (Feature 16) ──────────────────────────────────────────────

  async createTeamQuest(payload: {
    branchId: string; title: string; description: string; icon?: string;
    metric: string; target: number; startDate: string; endDate: string; rewardXP?: number;
  }): Promise<TeamQuestEntry> {
    const { data } = await apiClient.post<TeamQuestEntry>('/api/clinician-gamification/team-quests', payload);
    return data;
  },

  async getActiveTeamQuests(): Promise<TeamQuestEntry[]> {
    const { data } = await apiClient.get<TeamQuestEntry[]>('/api/clinician-gamification/team-quests');
    return data;
  },

  async getTeamQuestHistory(params?: { page?: number; limit?: number }): Promise<TeamQuestEntry[]> {
    const { data } = await apiClient.get<TeamQuestEntry[]>('/api/clinician-gamification/team-quests/history', params);
    return data;
  },

  // ── Achievement Showcase (Feature 17) ─────────────────────────────────────

  async getShowcase(userId: string): Promise<AchievementShowcase> {
    const { data } = await apiClient.get<AchievementShowcase>(`/api/clinician-gamification/showcase/${userId}`);
    return data;
  },

  // ── Reward Store (Feature 18) ─────────────────────────────────────────────

  async getAvailableRewards(): Promise<RewardItem[]> {
    const { data } = await apiClient.get<RewardItem[]>('/api/clinician-gamification/rewards');
    return data;
  },

  async redeemReward(rewardId: string): Promise<RewardRedemption> {
    const { data } = await apiClient.post<RewardRedemption>(`/api/clinician-gamification/rewards/redeem/${rewardId}`, {});
    return data;
  },

  async getMyRedemptions(params?: { page?: number; limit?: number }): Promise<{ redemptions: RewardRedemption[]; total: number }> {
    const { data } = await apiClient.get<{ redemptions: RewardRedemption[]; total: number }>('/api/clinician-gamification/rewards/mine', params);
    return data;
  },

  async createReward(payload: {
    name: string; description: string; icon?: string;
    category: string; pointsCost: number; stock?: number;
  }): Promise<RewardItem> {
    const { data } = await apiClient.post<RewardItem>('/api/clinician-gamification/rewards', payload);
    return data;
  },

  async processRedemption(redemptionId: string, status: string): Promise<RewardRedemption> {
    const { data } = await apiClient.patch<RewardRedemption>(`/api/clinician-gamification/rewards/redemptions/${redemptionId}`, { status });
    return data;
  },

  // ── Mentor Sessions (Feature 19) ──────────────────────────────────────────

  async createMentorSession(payload: {
    menteeId: string; topic: string; date: string; durationMins?: number;
  }): Promise<MentorSessionEntry> {
    const { data } = await apiClient.post<MentorSessionEntry>('/api/clinician-gamification/mentor-sessions', payload);
    return data;
  },

  async getMySessions(): Promise<MentorSessionEntry[]> {
    const { data } = await apiClient.get<MentorSessionEntry[]>('/api/clinician-gamification/mentor-sessions');
    return data;
  },

  async completeSession(sessionId: string): Promise<MentorSessionEntry> {
    const { data } = await apiClient.patch<MentorSessionEntry>(`/api/clinician-gamification/mentor-sessions/${sessionId}/complete`, {});
    return data;
  },

  async cancelSession(sessionId: string): Promise<MentorSessionEntry> {
    const { data } = await apiClient.patch<MentorSessionEntry>(`/api/clinician-gamification/mentor-sessions/${sessionId}/cancel`, {});
    return data;
  },

  async getMentorStats(): Promise<MentorStats> {
    const { data } = await apiClient.get<MentorStats>('/api/clinician-gamification/mentor-sessions/stats');
    return data;
  },
};
