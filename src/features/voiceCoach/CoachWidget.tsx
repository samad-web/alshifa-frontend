/**
 * Floating coach button on the patient dashboard. Tap → expands into a
 * compact chat dialog. Hidden when the AYURVEDIC_VOICE_COACH feature flag is
 * disabled for the tenant.
 *
 * Phase C will replace the chat icon with a mic-shaped pulsing button and
 * wire MediaRecorder. For now it's a text-mode chat surface — same UX
 * vocabulary, simpler transport.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareHeart, X, Maximize2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { cn } from "@/lib/utils";
import { useCoachSession } from "./useCoachSession";
import { CoachConversation } from "./CoachConversation";
import { CoachComposer } from "./CoachComposer";

const FEATURE_KEY = "AYURVEDIC_VOICE_COACH";

export function CoachWidget() {
    const { has, isLoading, isSuperAdmin } = useTenantFeatures();
    const [open, setOpen] = useState(false);
    const coach = useCoachSession("ta");

    // Match FeatureGate's optimistic behaviour — hide if known-disabled,
    // otherwise show. Super-admins always see the widget so they can verify
    // the feature on tenants where it's enabled.
    if (!isLoading && !isSuperAdmin && !has(FEATURE_KEY)) return null;

    return (
        <>
            {/* Trigger — only visible when the dialog is closed */}
            {!open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={cn(
                        "fixed bottom-6 right-6 z-40",
                        "h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700",
                        "text-white shadow-lg hover:shadow-xl",
                        "flex items-center justify-center",
                        "transition-all duration-200 hover:scale-105",
                        "ring-4 ring-emerald-600/20",
                    )}
                    aria-label="Open health coach"
                >
                    <MessageSquareHeart className="h-6 w-6" />
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-300 animate-ping" />
                </button>
            )}

            {/* Dialog card */}
            {open && (
                <div
                    className={cn(
                        "fixed bottom-6 right-6 z-40",
                        "w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-3rem))]",
                        "rounded-2xl border bg-background shadow-2xl",
                        "flex flex-col overflow-hidden",
                        "animate-in slide-in-from-bottom-4 fade-in duration-200",
                    )}
                >
                    <header className="flex items-center justify-between border-b bg-emerald-50/50 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center">
                                <Sparkles className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold leading-tight">Health Coach</div>
                                <div className="text-[10px] text-muted-foreground leading-tight">
                                    Replies in Tamil or English · 24/7
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Open full page"
                                title="Open full page"
                            >
                                <Link to="/patient/coach">
                                    <Maximize2 className="h-4 w-4" />
                                </Link>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setOpen(false)}
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </header>

                    {coach.escalated && (
                        <div className="px-4 py-2 text-xs font-medium text-amber-900 bg-amber-100 border-b border-amber-200">
                            We've alerted your care team — they'll reach out shortly.
                        </div>
                    )}

                    <CoachConversation
                        messages={coach.messages}
                        thinking={coach.status === "thinking"}
                        className="flex-1"
                    />

                    <CoachComposer
                        onSendText={coach.sendMessage}
                        onSendAudio={coach.sendAudioMessage}
                        sending={coach.status === "thinking"}
                        placeholder="Type or hold the mic — diet, herbs, today's pain…"
                    />
                </div>
            )}
        </>
    );
}

export default CoachWidget;
