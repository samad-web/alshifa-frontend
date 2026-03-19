/**
 * useLeaderboard hook — gamification leaderboard data + personal stats.
 */

import { useState, useEffect, useCallback } from 'react';
import { leaderboardApi } from '@/services/leaderboard.service';
import type { LeaderboardEntry, LeaderboardConfig } from '@/types';

interface LeaderboardState {
  entries: LeaderboardEntry[];
  myStats: LeaderboardEntry | null;
  config: LeaderboardConfig | null;
  loading: boolean;
  error: string | null;
}

export function useLeaderboard({ autoFetch = true, includeMyStats = false }: { autoFetch?: boolean; includeMyStats?: boolean } = {}) {
  const [state, setState] = useState<LeaderboardState>({
    entries: [],
    myStats: null,
    config: null,
    loading: autoFetch,
    error: null,
  });

  const fetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [entries, myStats, config] = await Promise.all([
        leaderboardApi.getLeaderboard(),
        includeMyStats ? leaderboardApi.getMyStats() : Promise.resolve(null),
        leaderboardApi.getConfig(),
      ]);
      setState({ entries, myStats, config, loading: false, error: null });
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'Failed to load leaderboard data' }));
    }
  }, [includeMyStats]);

  useEffect(() => {
    if (autoFetch) fetch();
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    refetch: fetch,
  };
}
