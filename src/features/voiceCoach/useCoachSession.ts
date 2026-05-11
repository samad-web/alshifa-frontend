/**
 * Text-mode + voice-mode coach-session hook.
 *
 * Lazily creates a VoiceConversation on the first send so opening the widget
 * without saying anything doesn't pollute the conversation list. State
 * machine: idle → thinking → idle, with `escalated` as a one-shot flag the
 * UI uses to render the safety banner.
 *
 * Voice path: sendAudioMessage uploads a Blob recorded by useAudioRecorder.
 * The backend transcribes (Whisper), runs the same orchestrator the text
 * path uses, then synthesizes the assistant reply (Google TTS) and returns
 * the audio inline as base64. We append the assistant bubble with the audio
 * URL attached so CoachConversation can render a play button — and we
 * autoplay once so the patient gets the voice reply hands-free.
 */

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { coachService } from "./coach.service";
import type { CoachLanguage, CoachMessage, SeverityFlag } from "./types";

type CoachStatus = "idle" | "thinking" | "error";

/** Assistant message variant carrying an optional audio URL for playback. */
export interface CoachMessageWithAudio extends CoachMessage {
    audioUrl?: string | null;
}

interface UseCoachSessionState {
    sessionId: string | null;
    messages: CoachMessageWithAudio[];
    status: CoachStatus;
    severity: SeverityFlag | null;
    escalated: boolean;
    sendMessage: (transcript: string) => Promise<void>;
    sendAudioMessage: (audioBlob: Blob) => Promise<void>;
    reset: () => void;
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export function useCoachSession(language: CoachLanguage = "ta"): UseCoachSessionState {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<CoachMessageWithAudio[]>([]);
    const [status, setStatus] = useState<CoachStatus>("idle");
    const [severity, setSeverity] = useState<SeverityFlag | null>(null);
    const [escalated, setEscalated] = useState(false);

    // Track Blob URLs we've created so we can revoke them on reset and
    // avoid leaking memory across long sessions.
    const blobUrlsRef = useRef<string[]>([]);

    const ensureSession = useCallback(async (): Promise<string> => {
        if (sessionId) return sessionId;
        const session = await coachService.startSession(language);
        setSessionId(session.id);
        return session.id;
    }, [language, sessionId]);

    const sendMessage = useCallback(
        async (transcript: string) => {
            const text = transcript.trim();
            if (!text || status === "thinking") return;

            const tempUser: CoachMessage = {
                id: `temp-${Date.now()}`,
                role: "USER",
                transcript: text,
                createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, tempUser]);
            setStatus("thinking");

            try {
                const activeId = await ensureSession();
                const result = await coachService.sendMessage(activeId, text);

                setMessages((prev) => [
                    ...prev.filter((m) => m.id !== tempUser.id),
                    result.userMessage,
                    result.assistantMessage,
                ]);
                setSeverity(result.severity);
                if (result.escalated) setEscalated(true);
                setStatus("idle");
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Coach is temporarily unavailable.";
                toast.error(message);
                setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
                setStatus("error");
            }
        },
        [ensureSession, status],
    );

    const sendAudioMessage = useCallback(
        async (audioBlob: Blob) => {
            if (status === "thinking") return;
            if (!audioBlob || audioBlob.size === 0) return;

            // Optimistic placeholder: a dimmed bubble showing "🎙 Transcribing…"
            // so the user sees something while Whisper runs.
            const tempUser: CoachMessageWithAudio = {
                id: `temp-${Date.now()}`,
                role: "USER",
                transcript: "🎙 Transcribing…",
                createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, tempUser]);
            setStatus("thinking");

            try {
                const activeId = await ensureSession();
                // No client-side language hint — Whisper auto-detects per turn
                // so the patient can speak Tamil or English freely without
                // toggling a language switch.
                const result = await coachService.sendAudioMessage(activeId, audioBlob);

                let assistantWithAudio: CoachMessageWithAudio = result.assistantMessage;
                if (result.audio?.base64) {
                    const url = base64ToBlobUrl(result.audio.base64, result.audio.mimeType);
                    blobUrlsRef.current.push(url);
                    assistantWithAudio = { ...result.assistantMessage, audioUrl: url };
                    // Autoplay the reply once. Some browsers (Safari) require
                    // a user gesture; the mic-press itself is a gesture so it
                    // is allowed within ~5s. If autoplay is blocked, the user
                    // can still tap the play button on the bubble.
                    void tryAutoplay(url);
                }

                setMessages((prev) => [
                    ...prev.filter((m) => m.id !== tempUser.id),
                    result.userMessage,
                    assistantWithAudio,
                ]);
                setSeverity(result.severity);
                if (result.escalated) setEscalated(true);
                setStatus("idle");
            } catch (err: unknown) {
                // The /audio-message endpoint is multipart audio in → JSON
                // (transcript + base64 mp3) out. Whisper runs server-side; the
                // 422 response (code: 'STT_EMPTY') means the upload succeeded
                // but the audio contained no intelligible speech (silent /
                // too quiet / picked up only background noise / matched a
                // known Whisper hallucination phrase). Surface that
                // explicitly so the patient knows to retry.
                const code = (err as { code?: string })?.code;
                const message = err instanceof Error ? err.message : "Voice coach error";
                if (code === "STT_EMPTY") {
                    toast.error("Couldn't make out what you said", {
                        description: "Try speaking a little louder, closer to the mic, and for at least a second.",
                        icon: "🎙",
                    });
                } else if (code === "STT_UPSTREAM_ERROR") {
                    toast.error("Voice coach is busy", {
                        description: "Speech recognition timed out. Please try again in a moment.",
                    });
                } else {
                    toast.error(message || "Coach couldn't hear you. Try again.");
                }
                setMessages((prev) => prev.filter((m) => m.id !== tempUser.id));
                setStatus("error");
            }
        },
        [ensureSession, language, status],
    );

    const reset = useCallback(() => {
        setSessionId(null);
        setMessages([]);
        setStatus("idle");
        setSeverity(null);
        setEscalated(false);
        // Free any audio Blob URLs we created.
        for (const u of blobUrlsRef.current) URL.revokeObjectURL(u);
        blobUrlsRef.current = [];
    }, []);

    return { sessionId, messages, status, severity, escalated, sendMessage, sendAudioMessage, reset };
}

async function tryAutoplay(url: string): Promise<void> {
    try {
        const audio = new Audio(url);
        audio.volume = 1;
        await audio.play();
    } catch {
        // Browser blocked autoplay. Silent fail — user taps the bubble's
        // play button to listen.
    }
}
