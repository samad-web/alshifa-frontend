import { apiClient } from '@/lib/api-client';

export interface VideoSessionBundle {
  url: string;
  roomName: string;
  expiresAt: string;
  meetingToken: string | null;
}

export const videoSessionService = {
  get: async (appointmentId: string): Promise<VideoSessionBundle> => {
    const res = await apiClient.get<VideoSessionBundle>(
      `/api/appointments/${appointmentId}/video-session`,
    );
    return res.data;
  },
};
