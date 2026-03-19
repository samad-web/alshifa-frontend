/**
 * useNotifications hook — notification list + real-time updates.
 *
 * Replaces inline fetch logic and manual unread-count management across
 * NotificationBell.tsx, NotificationContext.tsx, etc.
 */

import { useState, useEffect, useCallback } from 'react';
import { notificationsApi } from '@/services/notifications.service';
import type { AppNotification } from '@/types';

interface NotificationsState {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  loading: boolean;
  error: string | null;
}

export function useNotifications({ autoFetch = true }: { autoFetch?: boolean } = {}) {
  const [state, setState] = useState<NotificationsState>({
    notifications: [],
    unreadCount: 0,
    total: 0,
    loading: autoFetch,
    error: null,
  });

  const fetch = useCallback(async (unreadOnly = false) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await notificationsApi.list({ unreadOnly });
      setState({
        notifications: result.notifications,
        unreadCount: result.unreadCount,
        total: result.total,
        loading: false,
        error: null,
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false, error: 'Failed to load notifications' }));
    }
  }, []);

  useEffect(() => {
    if (autoFetch) fetch();
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n),
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));
    } catch {
      // Silently fail — not critical enough to show a toast
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail
    }
  }, []);

  return {
    ...state,
    refetch: fetch,
    markRead,
    markAllRead,
  };
}
