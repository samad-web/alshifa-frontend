/**
 * Composer with text input + push-to-talk mic button.
 *
 * Three input modes coexist:
 *   1. Type + Enter (or click send) → sendText
 *   2. Press-and-hold the mic button → recording starts; release → recording
 *      stops, the blob is uploaded via sendAudio. Slide off the button before
 *      release → cancel.
 *   3. Click the mic once (toggle mode, useful on touch devices where
 *      press-and-hold is fiddly) → starts recording; click again → stops.
 *
 * The pointer-event handlers cover both mouse and touch in one place.
 */

import { useState, FormEvent, KeyboardEvent, useRef, PointerEvent } from "react";
import { Send, Loader2, Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAudioRecorder } from "./useAudioRecorder";

interface CoachComposerProps {
    onSendText: (text: string) => void | Promise<void>;
    onSendAudio?: (blob: Blob) => void | Promise<void>;
    disabled?: boolean;
    sending?: boolean;
    placeholder?: string;
    className?: string;
}

export function CoachComposer({
    onSendText,
    onSendAudio,
    disabled,
    sending,
    placeholder = "Ask the coach — type or hold the mic…",
    className,
}: CoachComposerProps) {
    const [value, setValue] = useState("");
    const recorder = useAudioRecorder();
    const pressStartedRef = useRef(false);
    const cancelledByDragOff = useRef(false);

    const voiceEnabled = !!onSendAudio && recorder.isSupported;

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!value.trim() || disabled || sending) return;
        const text = value.trim();
        setValue("");
        await onSendText(text);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSubmit(e as unknown as FormEvent);
        }
    }

    // ── Mic — push-to-talk ──────────────────────────────────────────────────
    async function handleMicPointerDown(e: PointerEvent<HTMLButtonElement>) {
        if (!voiceEnabled || disabled || sending) return;
        e.preventDefault();
        pressStartedRef.current = true;
        cancelledByDragOff.current = false;
        // Capture pointer on the BUTTON (currentTarget), not on e.target.
        // e.target lands on the inner Lucide <Mic /> SVG, and that SVG is
        // unmounted the moment recording starts (icon flips to <Square />).
        // When the captured element disappears the browser auto-releases
        // capture, then the very next sub-pixel motion fires a stray
        // pointerleave that flips cancelledByDragOff and causes the
        // recording to be silently discarded. currentTarget is stable.
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
        await recorder.startRecording();
    }

    async function handleMicPointerUp() {
        if (!pressStartedRef.current) return;
        pressStartedRef.current = false;
        if (cancelledByDragOff.current) {
            // Slide-to-cancel was triggered. Make it visible — silent cancels
            // were the original symptom (recording captured, then dropped
            // with no UI feedback at all).
            recorder.cancelRecording();
            toast("Recording cancelled", {
                description: "Drag back onto the mic before releasing to send.",
                icon: "🎙",
            });
            return;
        }
        const blob = await recorder.stopRecording();
        if (!blob) {
            // useAudioRecorder rejects recordings under ~3KB (~half a
            // second) because Whisper hallucinates more than it transcribes
            // on those. Without this toast the press silently produces no
            // request, no audio, no error — the patient has no idea why.
            toast.error("Hold the mic a little longer", {
                description: "Press and hold for at least one full second, then release.",
                icon: "🎙",
            });
            return;
        }
        if (onSendAudio) await onSendAudio(blob);
    }

    function handleMicPointerLeave() {
        // If the user drags off the button before releasing, cancel.
        // With pointer capture on the BUTTON (set above) this only fires
        // for genuine drag-off gestures, not for the icon-swap flicker.
        if (recorder.isRecording) cancelledByDragOff.current = true;
    }

    function handleMicClick() {
        // Click-to-toggle fallback for touch devices where holding is awkward.
        // Only triggers when we did NOT just complete a press-hold gesture.
        if (pressStartedRef.current) return;
        if (recorder.isRecording) {
            void (async () => {
                const blob = await recorder.stopRecording();
                if (!blob) {
                    toast.error("Recording too short", {
                        description: "Tap once to start, then keep talking for at least a second before tapping again to send.",
                        icon: "🎙",
                    });
                    return;
                }
                if (onSendAudio) await onSendAudio(blob);
            })();
        } else {
            void recorder.startRecording();
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className={cn("flex items-end gap-2 border-t bg-background p-3", className)}
        >
            <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={recorder.isRecording ? "Recording… release to send" : placeholder}
                disabled={disabled || sending || recorder.isRecording}
                rows={1}
                className="min-h-[40px] max-h-32 resize-none flex-1"
            />

            {voiceEnabled && (
                <Button
                    type="button"
                    size="icon"
                    variant={recorder.isRecording ? "destructive" : "outline"}
                    onPointerDown={handleMicPointerDown}
                    onPointerUp={handleMicPointerUp}
                    onPointerLeave={handleMicPointerLeave}
                    onPointerCancel={handleMicPointerLeave}
                    onClick={handleMicClick}
                    disabled={disabled || sending}
                    aria-label={recorder.isRecording ? "Stop recording" : "Hold to talk"}
                    title={recorder.isRecording ? "Release to send · drag off to cancel" : "Hold to talk"}
                    className={cn(recorder.isRecording && "animate-pulse")}
                >
                    {recorder.isRecording ? <Square className="h-4 w-4 fill-current" />
                        : !recorder.isSupported ? <MicOff className="h-4 w-4" />
                            : <Mic className="h-4 w-4" />}
                </Button>
            )}

            <Button
                type="submit"
                size="icon"
                disabled={!value.trim() || disabled || sending || recorder.isRecording}
                aria-label="Send"
            >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
        </form>
    );
}
