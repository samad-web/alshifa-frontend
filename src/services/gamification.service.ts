/**
 * Gamification API service — badges, streaks, competitions,
 * zen points, challenges, analytics.
 */

import apiClient from '@/lib/api-client';
import type {
  Badge, ClinicianStreak, BranchLeaderboardEntry,
  BranchCompetition, ZenProfile, DailyChallenge,
  SocialProof, GamificationAnalytics
} from '@/types';

export const gamificationApi = {
  // ── Badges ──────────────────────────────────────────────────────────────

  async getAllBadges(): Promise<Badge[]> {
    const { data } = await apiClient.get<Badge[]>('/api/gamification/badges');
    return data;
  },

  async getMyBadges(): Promise<Badge[]> {
    const { data } = await apiClient.get<Badge[]>('/api/gamification/badges/mine');
    return data;
  },

  // ── Streaks ─────────────────────────────────────────────────────────────

  async getMyStreak(): Promise<ClinicianStreak> {
    const { data } = await apiClient.get<ClinicianStreak>('/api/gamification/streak');
    return data;
  },

  // ── Adaptive Targets ───────────────────────────────────────────────────

  async getMyTargets(): Promise<Record<string, number>> {
    const { data } = await apiClient.get<Record<string, number>>('/api/gamification/targets');
    return data;
  },

  // ── Branch Competitions ────────────────────────────────────────────────

  async getBranchLeaderboard(): Promise<BranchLeaderboardEntry[]> {
    const { data } = await apiClient.get<BranchLeaderboardEntry[]>('/api/gamification/branch-leaderboard');
    return data;
  },

  async getActiveCompetitions(): Promise<BranchCompetition[]> {
    const { data } = await apiClient.get<BranchCompetition[]>('/api/gamification/competitions');
    return data;
  },

  async createCompetition(payload: {
    title: string; description?: string; metric: string;
    startDate: string; endDate: string;
  }): Promise<BranchCompetition> {
    const { data } = await apiClient.post<BranchCompetition>('/api/gamification/competitions', payload);
    return data;
  },

  // ── Zen Points (Patient) ───────────────────────────────────────────────

  async getZenProfile(): Promise<ZenProfile> {
    const { data } = await apiClient.get<ZenProfile>('/api/gamification/zen-profile');
    return data;
  },

  async getDailyChallenges(): Promise<DailyChallenge[]> {
    const { data } = await apiClient.get<DailyChallenge[]>('/api/gamification/challenges');
    return data;
  },

  async completeChallenge(challengeId: string): Promise<{ completed: boolean; pointsEarned: number }> {
    const { data } = await apiClient.post<{ completed: boolean; pointsEarned: number }>(
      `/api/gamification/challenges/${challengeId}/complete`, {}
    );
    return data;
  },

  async getSocialProof(): Promise<SocialProof> {
    const { data } = await apiClient.get<SocialProof>('/api/gamification/social-proof');
    return data;
  },

  // ── Analytics (Admin) ──────────────────────────────────────────────────

  async getAnalytics(): Promise<GamificationAnalytics> {
    const { data } = await apiClient.get<GamificationAnalytics>('/api/gamification/analytics');
    return data;
  },

  async getOutcomeCorrelation(): Promise<unknown> {
    const { data } = await apiClient.get('/api/gamification/analytics/correlation');
    return data;
  },

  async getConfigImpact(): Promise<unknown> {
    const { data } = await apiClient.get('/api/gamification/analytics/config-impact');
    return data;
  },

  // ── Anti-gaming (Admin) ────────────────────────────────────────────────

  async getAnomalies(params?: { limit?: number; offset?: number }): Promise<{ anomalies: unknown[]; total: number }> {
    const { data } = await apiClient.get<{ anomalies: unknown[]; total: number }>(
      '/api/gamification/anomalies', params as Record<string, string | number>
    );
    return data;
  },

  async resolveAnomaly(id: string): Promise<unknown> {
    const { data } = await apiClient.patch(`/api/gamification/anomalies/${id}/resolve`, {});
    return data;
  },
};
