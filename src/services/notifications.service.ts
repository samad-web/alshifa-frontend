/**
 * Notifications API service
 */

import apiClient from '@/lib/api-client';
import type { AppNotification, NotificationListResponse } from '@/types';

export const notificationsApi = {
  async list(params?: { unreadOnly?: boolean; page?: number; limit?: number }): Promise<NotificationListResponse> {
    const { data } = await apiClient.get<NotificationListResponse>('/api/notifications', params as Record<string, string | number>);
    return data;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.put(`/api/notifications/${id}/read`, {});
  },

  async markAllRead(): Promise<void> {
    await apiClient.put('/api/notifications/read-all', {});
  },

  async getPreferences(): Promise<unknown> {
    const { data } = await apiClient.get('/api/notifications/preferences');
    return data;
  },

  async updatePreferences(payload: Record<string, unknown>): Promise<unknown> {
    const { data } = await apiClient.put('/api/notifications/preferences', payload);
    return data;
  },

  async subscribePush(subscription: Record<string, unknown>): Promise<void> {
    await apiClient.post('/api/notifications/subscribe', subscription);
  },
};
