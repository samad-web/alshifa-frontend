/**
 * Reusable chat-bubble UI for the voice coach. Used by both the floating
 * widget (compact, dialog-mounted) and the full /patient/coach page (tall).
 *
 * Renders three bubble styles:
 *   - USER       : right-aligned, primary color
 *   - ASSISTANT  : left-aligned, muted card with sparkle icon, severity-aware
 *                  border tint when the safety template was used. Renders an
 *                  inline play button when an audioUrl is attached.
 *   - SYSTEM     : centered pill ("Doctor's note relayed"), italic, muted
 *
 * Auto-scrolls to the newest bubble when messages arrive.
 */

import { useEffect, useRef, useState } from "react";
import { Sparkles, AlertCircle, ShieldCheck, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachMessage } from "./types";

interface CoachMessageMaybeWithAudio extends CoachMessage {
    audioUrl?: string | null;
}

interface CoachConversationProps {
    messages: CoachMessageMaybeWithAudio[];
    thinking?: boolean;
    emptyHint?: string;
    className?: string;
}

export function CoachConversation({
    messages,
    thinking = false,
    emptyHint,
    className,
}: CoachConversationProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages.length, thinking]);

    if (messages.length === 0 && !thinking) {
        return (
            <div className={cn("flex h-full items-center justify-center px-6 text-center", className)}>
                <div className="space-y-2">
                    <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-emerald-600" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                        {emptyHint ??
                            "Ask anything about your treatment, medications, or how you're feeling today. I'll answer in Tamil or English — your choice."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={scrollRef} className={cn("space-y-3 overflow-y-auto px-4 py-3", className)}>
            {messages.map((m) => (
                <Bubble key={m.id} message={m} />
            ))}
            {thinking && <ThinkingBubble />}
        </div>
    );
}

function Bubble({ message }: { message: CoachMessageMaybeWithAudio }) {
    if (message.role === "SYSTEM") {
        return (
            <div className="flex justify-center">
                <div className="text-xs text-muted-foreground italic max-w-[85%] text-center bg-muted/50 px-3 py-1.5 rounded-full">
                    <ShieldCheck className="inline h-3 w-3 mr-1 -mt-0.5 text-emerald-600" />
                    {message.transcript}
                </div>
            </div>
        );
    }

    if (message.role === "USER") {
        return (
            <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground whitespace-pre-wrap break-words">
                    {message.transcript}
                </div>
            </div>
        );
    }

    // ASSISTANT
    const isHighSeverity =
        message.severityFlag === "HIGH" || message.severityFlag === "CRITICAL";
    return (
        <div className="flex justify-start">
            <div
                className={cn(
                    "max-w-[85%] rounded-2xl rounded-bl-sm border bg-card px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm",
                    isHighSeverity && "border-amber-300 bg-amber-50",
                )}
            >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {isHighSeverity ? (
                        <>
                            <AlertCircle className="h-3 w-3 text-amber-600" />
                            Care team alerted
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-3 w-3 text-emerald-600" />
                            Coach
                        </>
                    )}
                </div>
                <div className="text-foreground leading-relaxed">{message.transcript}</div>
                {message.audioUrl && <AudioPlayer src={message.audioUrl} />}
            </div>
        </div>
    );
}

function AudioPlayer({ src }: { src: string }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);

    function toggle() {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) {
            void a.play();
        } else {
            a.pause();
        }
    }

    return (
        <div className="mt-2 flex items-center gap-2">
            <button
                type="button"
                onClick={toggle}
                className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted transition-colors"
                aria-label={playing ? "Pause voice reply" : "Play voice reply"}
            >
                {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                {playing ? "Pause" : "Play voice"}
            </button>
            <audio
                ref={audioRef}
                src={src}
                onEnded={() => setPlaying(false)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                className="hidden"
            />
        </div>
    );
}

function ThinkingBubble() {
    return (
        <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border bg-card px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
                </div>
            </div>
        </div>
    );
}
