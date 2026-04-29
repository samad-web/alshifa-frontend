/**
 * Shared TypeScript types for the Voice Health Coach feature.
 * Mirrors the shapes returned by /api/voice-coach/* on the backend.
 */

export type CoachLanguage = "ta" | "en";

export type VoiceRole = "USER" | "ASSISTANT" | "SYSTEM";

export type SeverityFlag = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "NONE";

export type DetectedIntent =
    | "MEDICATION_QUERY"
    | "SYMPTOM_REPORT"
    | "MEDICATION_ABANDONED"
    | "EMERGENCY"
    | "BOOKING_REQUEST"
    | "GENERAL"
    | "DOCTOR_NOTE";

export interface CoachSession {
    id: string;
    patientId: string;
    language: CoachLanguage;
    startedAt: string;
    endedAt: string | null;
    turnCount: number;
    escalated?: boolean;
    sessionSummary?: string | null;
}

export interface CoachMessage {
    id: string;
    role: VoiceRole;
    transcript: string;
    detectedIntent?: DetectedIntent | null;
    severityFlag?: SeverityFlag | null;
    createdAt: string;
}

export interface SendMessageResponse {
    userMessage: CoachMessage;
    assistantMessage: CoachMessage & {
        source?: "llm" | "safety_template" | "llm_fallback";
        model?: string;
        usage?: {
            inputTokens: number;
            outputTokens: number;
            cachedInputTokens?: number;
            latencyMs: number;
        };
    };
    escalated: boolean;
    severity: SeverityFlag;
    intent: DetectedIntent;
}

export interface SendAudioMessageResponse extends SendMessageResponse {
    stt?: { language: string; durationMs: number };
    audio?: {
        base64: string;
        mimeType: string; // 'audio/mpeg'
        voice: string;
        durationMs: number;
    } | null;
}

export interface CoachPreferences {
    voiceCoachEnabled: boolean;
    preferredCoachLang: CoachLanguage;
}

export interface CoachSessionListResponse {
    items: CoachSession[];
    nextCursor: string | null;
}
