/**
 * Push-to-talk audio capture hook.
 *
 * The patient holds the mic button → we open the user's microphone, start a
 * MediaRecorder, capture chunks. On release, we stop the recorder and the
 * `audioBlob` becomes available via the resolved promise. The caller then
 * uploads it to /api/voice-coach/sessions/:id/audio-message.
 *
 * Browser compatibility:
 *   - Chrome / Edge / Firefox: audio/webm;codecs=opus (preferred)
 *   - Safari (desktop + iOS): audio/mp4 (the only natively-supported recording format)
 * Both formats are accepted directly by Whisper, so no client-side conversion.
 *
 * Permission handling: getUserMedia() throws NotAllowedError if the user
 * denies the prompt. We surface that as a friendly toast and reset state so
 * the next press tries again.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface UseAudioRecorderState {
    isSupported: boolean;
    isRecording: boolean;
    error: string | null;
    /** Begin recording. Resolves once recording has actually started. */
    startRecording: () => Promise<boolean>;
    /** Stop recording. Resolves to the captured audio blob (or null if too short / cancelled). */
    stopRecording: () => Promise<Blob | null>;
    /** Cancel without producing a blob (e.g. on slide-to-cancel). */
    cancelRecording: () => void;
}

/** Pick the first supported recording mime, with Safari/Chrome fallback chain. */
function pickMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
    ];
    for (const m of candidates) {
        if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return undefined;
}

export function useAudioRecorder(): UseAudioRecorderState {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const cancelledRef = useRef(false);

    const isSupported =
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined";

    // Always release the mic when the component unmounts mid-recording.
    useEffect(() => {
        return () => {
            stopAndCleanupTracks(streamRef.current);
            streamRef.current = null;
        };
    }, []);

    const startRecording = useCallback(async (): Promise<boolean> => {
        if (!isSupported) {
            const msg = "Voice recording isn't supported on this browser.";
            setError(msg);
            toast.error(msg);
            return false;
        }
        if (recorderRef.current && recorderRef.current.state === "recording") return true;

        setError(null);
        cancelledRef.current = false;
        chunksRef.current = [];

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            streamRef.current = stream;

            const mimeType = pickMimeType();
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            recorder.addEventListener("dataavailable", (e) => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            });
            // No timeslice — we want a single, well-formed chunk on stop.
            // Timesliced recordings concatenate cleanly *most* of the time,
            // but Whisper's ffmpeg path occasionally rejects them or
            // produces token-repetition hallucinations ("h-h-h-h…") at
            // chunk boundaries. One stop = one clean WebM file.
            recorder.start();
            recorderRef.current = recorder;
            setIsRecording(true);
            return true;
        } catch (err: unknown) {
            const e = err as DOMException;
            let msg = "Couldn't access the microphone.";
            if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
                msg = "Microphone access was blocked. Allow it in your browser to use voice.";
            } else if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
                msg = "No microphone found on this device.";
            } else if (e?.name === "NotReadableError") {
                msg = "Your microphone is in use by another app.";
            }
            setError(msg);
            toast.error(msg);
            stopAndCleanupTracks(streamRef.current);
            streamRef.current = null;
            return false;
        }
    }, [isSupported]);

    const stopRecording = useCallback(async (): Promise<Blob | null> => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state !== "recording") return null;

        return new Promise<Blob | null>((resolve) => {
            recorder.addEventListener("stop", () => {
                stopAndCleanupTracks(streamRef.current);
                streamRef.current = null;
                recorderRef.current = null;
                setIsRecording(false);

                if (cancelledRef.current) {
                    chunksRef.current = [];
                    resolve(null);
                    return;
                }

                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });
                chunksRef.current = [];
                // Reject anything under ~3KB — that's roughly half a second of
                // opus, below which Whisper hallucinates more than it transcribes.
                // Misclicks resolve to null and the caller doesn't fire a request.
                resolve(blob.size > 3000 ? blob : null);
            }, { once: true });
            recorder.stop();
        });
    }, []);

    const cancelRecording = useCallback(() => {
        cancelledRef.current = true;
        const recorder = recorderRef.current;
        if (recorder && recorder.state === "recording") recorder.stop();
        else {
            stopAndCleanupTracks(streamRef.current);
            streamRef.current = null;
            recorderRef.current = null;
            setIsRecording(false);
        }
    }, []);

    return { isSupported, isRecording, error, startRecording, stopRecording, cancelRecording };
}

function stopAndCleanupTracks(stream: MediaStream | null) {
    if (!stream) return;
    stream.getTracks().forEach((t) => {
        try { t.stop(); } catch { /* ignore */ }
    });
}
