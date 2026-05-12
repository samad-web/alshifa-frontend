/**
 * Therapist Session Workspace API client (Phase A — minimal).
 *
 * Mirrors the 5 endpoints under `/api/therapy-sessions/*` defined in
 * routes/therapySessions.js. Used by:
 *   - Therapist dashboard (Start Session button + Resume banner)
 *   - SessionWorkspace page (load session, autosave notes, complete)
 *
 * GET /active returns 404 with `{ active: false }` when the caller has no
 * in-progress session — `getActive()` translates that into a `null` return
 * so callers can branch on truthiness instead of try/catching.
 */

import { apiClient, ApiClientError } from '@/lib/api-client';
import type {
  SessionNote,
  SessionOverallOutcome,
  SessionPainReading,
  SessionRegionNote,
  SessionTolerance,
  TherapySession,
} from '@/types';

/** Body shape for the structured outcome captured on POST /complete. */
export interface CompleteSessionOutcome {
  overallOutcome: SessionOverallOutcome;
  patientTolerance: SessionTolerance;
  nextSessionFocus?: string;
  homeCareInstructions?: string;
}

export const therapySessionApi = {
  start: async (appointmentId: string): Promise<TherapySession> =>
    (await apiClient.post<TherapySession>('/api/therapy-sessions/start', { appointmentId })).data,

  /** Resolves to `null` when the caller has no IN_PROGRESS session. */
  getActive: async (): Promise<TherapySession | null> => {
    try {
      const res = await apiClient.get<TherapySession>('/api/therapy-sessions/active');
      return res.data;
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) return null;
      throw err;
    }
  },

  getById: async (id: string): Promise<TherapySession> =>
    (await apiClient.get<TherapySession>(`/api/therapy-sessions/${id}`)).data,

  saveNotes: async (id: string, body: string): Promise<SessionNote> =>
    (await apiClient.patch<SessionNote>(`/api/therapy-sessions/${id}/notes`, { body })).data,

  /**
   * Phase A signature kept callable: `complete(id)` with no second arg
   * sends an empty body, matching the original Phase A behaviour exactly.
   * Phase B1 callers pass an outcome to additionally create the
   * SessionOutcome row inside the same transaction.
   */
  complete: async (id: string, outcome?: CompleteSessionOutcome): Promise<TherapySession> =>
    (await apiClient.post<TherapySession>(
      `/api/therapy-sessions/${id}/complete`,
      outcome ? { outcome } : {},
    )).data,

  // ── Phase B1 ──────────────────────────────────────────────────────────────

  addPainReading: async (
    id: string,
    payload: { scale: number; bodyRegion?: string },
  ): Promise<SessionPainReading> =>
    (await apiClient.post<SessionPainReading>(
      `/api/therapy-sessions/${id}/pain-readings`,
      payload,
    )).data,

  addRegionNote: async (
    id: string,
    payload: { bodyRegion: string; body: string },
  ): Promise<SessionRegionNote> =>
    (await apiClient.post<SessionRegionNote>(
      `/api/therapy-sessions/${id}/region-notes`,
      payload,
    )).data,

  updateRegionNote: async (
    id: string,
    noteId: string,
    payload: { bodyRegion: string; body: string },
  ): Promise<SessionRegionNote> =>
    (await apiClient.patch<SessionRegionNote>(
      `/api/therapy-sessions/${id}/region-notes/${noteId}`,
      payload,
    )).data,
};
