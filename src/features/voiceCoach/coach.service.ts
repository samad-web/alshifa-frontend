/**
 * Thin apiClient wrappers for /api/voice-coach. The shared apiClient already
 * handles auth-header injection, 401 → logout, and 429 retries, so this file
 * stays small.
 */

import apiClient from "@/lib/api-client";
import type {
    CoachLanguage,
    CoachMessage,
    CoachPreferences,
    CoachSession,
    CoachSessionListResponse,
    SendAudioMessageResponse,
    SendMessageResponse,
} from "./types";

export const coachService = {
    startSession(language?: CoachLanguage) {
        return apiClient
            .post<CoachSession>("/api/voice-coach/sessions", language ? { language } : {})
            .then((r) => r.data);
    },

    endSession(sessionId: string) {
        return apiClient
            .post<CoachSession>(`/api/voice-coach/sessions/${sessionId}/end`, {})
            .then((r) => r.data);
    },

    sendMessage(sessionId: string, transcript: string) {
        return apiClient
            .post<SendMessageResponse>(`/api/voice-coach/sessions/${sessionId}/messages`, {
                transcript,
            })
            .then((r) => r.data);
    },

    sendAudioMessage(sessionId: string, audioBlob: Blob) {
        const fd = new FormData();
        // Filename hint helps Whisper detect format. Browsers vary on the
        // mimeType MediaRecorder produces, so we follow the blob's actual type.
        const ext = audioBlob.type.includes("mp4") ? "m4a" : "webm";
        fd.append("audio", audioBlob, `utterance.${ext}`);
        // Deliberately no language hint — Whisper auto-detects per turn so
        // the patient can switch between Tamil and English freely.
        return apiClient
            .upload<SendAudioMessageResponse>(
                `/api/voice-coach/sessions/${sessionId}/audio-message`,
                fd,
            )
            .then((r) => r.data);
    },

    listSessions(take = 20, cursor?: string) {
        return apiClient
            .get<CoachSessionListResponse>("/api/voice-coach/sessions", { take, cursor })
            .then((r) => r.data);
    },

    getSession(sessionId: string) {
        return apiClient
            .get<CoachSession & { messages: CoachMessage[] }>(
                `/api/voice-coach/sessions/${sessionId}`,
            )
            .then((r) => r.data);
    },

    updatePreferences(prefs: Partial<CoachPreferences>) {
        return apiClient
            .patch<CoachPreferences>("/api/voice-coach/preferences", prefs)
            .then((r) => r.data);
    },
};

export default coachService;
