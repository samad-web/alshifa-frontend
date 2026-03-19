/**
 * Gamification / Leaderboard API service
 */

import apiClient from '@/lib/api-client';
import type { LeaderboardEntry, LeaderboardConfig } from '@/types';

export const leaderboardApi = {
  async getLeaderboard(params?: { role?: string; limit?: number }): Promise<LeaderboardEntry[]> {
    const { data } = await apiClient.get<LeaderboardEntry[]>('/api/leaderboard', params as Record<string, string | number>);
    return data;
  },

  async getMyStats(): Promise<LeaderboardEntry | null> {
    const { data } = await apiClient.get<LeaderboardEntry>('/api/leaderboard/me');
    return data;
  },

  async getConfig(): Promise<LeaderboardConfig> {
    const { data } = await apiClient.get<LeaderboardConfig>('/api/leaderboard/config');
    return data;
  },

  async updateConfig(payload: Partial<LeaderboardConfig>): Promise<LeaderboardConfig> {
    const { data } = await apiClient.put<LeaderboardConfig>('/api/leaderboard/config', payload);
    return data;
  },
};
