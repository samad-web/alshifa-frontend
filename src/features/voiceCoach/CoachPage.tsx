/**
 * Full-page coach experience at /patient/coach.
 *
 * Shows the active conversation in a tall pane plus a sidebar listing past
 * sessions (lazily loaded). Phase E will add a session-summary pane and
 * gamification rewards banner; for Phase D this is the chat surface only.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageSquareHeart, Loader2, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeatureGate } from "@/components/common/FeatureGate";
import { cn } from "@/lib/utils";
import { coachService } from "./coach.service";
import { useCoachSession } from "./useCoachSession";
import { CoachConversation } from "./CoachConversation";
import { CoachComposer } from "./CoachComposer";
import type { CoachLanguage, CoachMessage } from "./types";

const FEATURE_KEY = "AYURVEDIC_VOICE_COACH";

export default function CoachPage() {
    return (
        <FeatureGate feature={FEATURE_KEY} title="Voice Health Coach isn't enabled">
            <CoachPageInner />
        </FeatureGate>
    );
}

function CoachPageInner() {
    const [language, setLanguage] = useState<CoachLanguage>("ta");
    const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
    const coach = useCoachSession(language);

    // Past sessions list — refetched whenever we end the active session.
    const sessionsQuery = useQuery({
        queryKey: ["coach-sessions"],
        queryFn: () => coachService.listSessions(20),
    });

    // When the user clicks a past session in the sidebar, lazy-load its
    // transcript. The active conversation pane then shows the historical
    // bubbles read-only.
    const viewedSessionQuery = useQuery({
        queryKey: ["coach-session", viewingSessionId],
        queryFn: () => coachService.getSession(viewingSessionId!),
        enabled: !!viewingSessionId,
    });

    const viewingHistorical = !!viewingSessionId;
    const messagesToRender: CoachMessage[] = viewingHistorical
        ? viewedSessionQuery.data?.messages ?? []
        : coach.messages;

    useEffect(() => {
        // When the active conversation moves on, drop the historical viewer.
        if (coach.messages.length > 0 && viewingSessionId) {
            setViewingSessionId(null);
        }
    }, [coach.messages.length, viewingSessionId]);

    return (
        <AppLayout>
            <div className="container max-w-6xl mx-auto px-4 py-6">
                <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <Button asChild variant="ghost" size="sm">
                            <Link to="/patient">
                                <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to dashboard
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                                <MessageSquareHeart className="h-6 w-6 text-emerald-600" />
                                Health Coach
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Ask anything. The coach knows your prescriptions, journey, and recent
                                check-ins.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Reply in:</span>
                        <button
                            type="button"
                            onClick={() => setLanguage("ta")}
                            className={cn(
                                "px-3 py-1 rounded-full border transition-colors",
                                language === "ta"
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background hover:bg-muted",
                            )}
                        >
                            தமிழ் Tamil
                        </button>
                        <button
                            type="button"
                            onClick={() => setLanguage("en")}
                            className={cn(
                                "px-3 py-1 rounded-full border transition-colors",
                                language === "en"
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background hover:bg-muted",
                            )}
                        >
                            English
                        </button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_280px]">
                    {/* ── Active conversation pane ─────────────────────── */}
                    <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[420px] overflow-hidden">
                        {coach.escalated && !viewingHistorical && (
                            <div className="px-4 py-2 text-xs font-medium text-amber-900 bg-amber-100 border-b border-amber-200">
                                We've alerted your care team — they'll reach out shortly.
                            </div>
                        )}

                        {viewingHistorical && (
                            <div className="px-4 py-2 text-xs flex items-center justify-between border-b bg-muted/40">
                                <span>
                                    Viewing past session
                                    {viewedSessionQuery.data?.startedAt
                                        ? ` from ${new Date(viewedSessionQuery.data.startedAt).toLocaleString()}`
                                        : ""}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewingSessionId(null)}
                                >
                                    Back to active chat
                                </Button>
                            </div>
                        )}

                        <CoachConversation
                            messages={messagesToRender}
                            thinking={!viewingHistorical && coach.status === "thinking"}
                            emptyHint="What's on your mind tonight? Pain, sleep, your medicine schedule — anything ayurvedic, lifestyle, or about your treatment journey."
                            className="flex-1"
                        />

                        {!viewingHistorical && (
                            <CoachComposer
                                onSendText={coach.sendMessage}
                                onSendAudio={coach.sendAudioMessage}
                                sending={coach.status === "thinking"}
                                placeholder="Type or hold the mic to talk…"
                            />
                        )}
                    </Card>

                    {/* ── Past sessions sidebar ────────────────────────── */}
                    <aside className="space-y-3">
                        <Card className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="h-4 w-4 text-emerald-600" />
                                <h2 className="text-sm font-semibold">Past sessions</h2>
                            </div>
                            {sessionsQuery.isLoading ? (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                                </div>
                            ) : sessionsQuery.data && sessionsQuery.data.items.length > 0 ? (
                                <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {sessionsQuery.data.items.map((s) => (
                                        <li key={s.id}>
                                            <button
                                                type="button"
                                                onClick={() => setViewingSessionId(s.id)}
                                                className={cn(
                                                    "w-full text-left rounded-lg border p-2.5 hover:bg-muted/60 transition-colors",
                                                    viewingSessionId === s.id && "bg-muted/80 border-primary",
                                                )}
                                            >
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-medium">
                                                        {new Date(s.startedAt).toLocaleDateString(undefined, {
                                                            month: "short",
                                                            day: "numeric",
                                                        })}{" "}
                                                        ·{" "}
                                                        {new Date(s.startedAt).toLocaleTimeString(undefined, {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                    {s.escalated && (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-amber-300 text-amber-700 text-[9px] px-1.5"
                                                        >
                                                            Alert
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    {s.turnCount} {s.turnCount === 1 ? "turn" : "turns"} ·{" "}
                                                    {s.language === "ta" ? "Tamil" : "English"}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    No past conversations yet. Your sessions will appear here after you talk
                                    with the coach.
                                </p>
                            )}
                        </Card>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
}
