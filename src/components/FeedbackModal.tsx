// FeedbackModal — patient-facing rating prompt fired by the
// `feedback_request` and `journey_feedback_request` socket events. Lives
// alongside the legacy ConsultationFeedbackPrompt MCQ flow; both can be
// active simultaneously since they write to the same row (UNIQUE on
// appointmentId / journeyId enforces "at most one wins").
import { useEffect, useMemo, useState } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export type FeedbackModalType = "consultation" | "journey";

export interface ConsultationFeedbackPayload {
    appointmentId: string;
    clinicianId?: string;
    clinicianName?: string;
    clinicianRole?: string;
}
export interface JourneyFeedbackPayload {
    journeyId: string;
    feedbackId?: string;
    journeyTitle?: string;
    clinicianName?: string;
    expiresAt?: string;
}

interface FeedbackModalProps {
    open: boolean;
    type: FeedbackModalType;
    payload: ConsultationFeedbackPayload | JourneyFeedbackPayload;
    onSubmit?: () => void;
    onSkip?: () => void;
    onClose?: () => void;
}

const CONSULTATION_CATEGORIES = [
    "CLEAR_EXPLANATION",
    "LISTENED_WELL",
    "PROFESSIONAL",
    "PUNCTUAL",
    "FRIENDLY",
    "PRESCRIPTION_HELPFUL",
    "WOULD_RECOMMEND",
];

const JOURNEY_HIGHLIGHTS = [
    "PAIN_REDUCED",
    "BETTER_MOBILITY",
    "IMPROVED_SLEEP",
    "MORE_ENERGY",
    "MEDICATION_HELPED",
    "EXERCISES_HELPFUL",
    "DIET_PLAN_EFFECTIVE",
];

const PRIMARY_TEAL = "#0D6E6E";

function StarRow({ value, onChange, label }: { value: number; onChange: (v: number) => void; label?: string }) {
    return (
        <div className="space-y-1">
            {label && <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">{label}</p>}
            <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        aria-label={`${n} star${n === 1 ? "" : "s"}`}
                        className="transition-transform hover:scale-110"
                    >
                        <Star
                            className="w-8 h-8"
                            color={n <= value ? PRIMARY_TEAL : "#94a3b8"}
                            fill={n <= value ? PRIMARY_TEAL : "none"}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
}

function ChipGrid({ options, selected, onToggle }: {
    options: string[];
    selected: string[];
    onToggle: (v: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
                const on = selected.includes(opt);
                return (
                    <button
                        type="button"
                        key={opt}
                        onClick={() => onToggle(opt)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-tight border transition-colors",
                            on
                                ? "border-transparent text-white"
                                : "border-border text-foreground bg-background hover:bg-secondary/40",
                        )}
                        style={on ? { backgroundColor: PRIMARY_TEAL } : undefined}
                    >
                        {opt.replaceAll("_", " ")}
                    </button>
                );
            })}
        </div>
    );
}

export function FeedbackModal({ open, type, payload, onSubmit, onSkip, onClose }: FeedbackModalProps) {
    // Consultation single-step state
    const [rating, setRating] = useState(0);
    const [categories, setCategories] = useState<string[]>([]);
    const [feedbackText, setFeedbackText] = useState("");

    // Journey wizard state
    const [journeyStep, setJourneyStep] = useState(1);
    const [overallRating,   setOverallRating]   = useState(0);
    const [outcomeRating,   setOutcomeRating]   = useState(0);
    const [adherenceRating, setAdherenceRating] = useState(0);
    const [highlights,      setHighlights]      = useState<string[]>([]);
    const [wouldRecommend,  setWouldRecommend]  = useState<boolean | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Reset all state when payload changes (a new event arrived).
    useEffect(() => {
        if (!open) return;
        setRating(0); setCategories([]); setFeedbackText("");
        setJourneyStep(1);
        setOverallRating(0); setOutcomeRating(0); setAdherenceRating(0);
        setHighlights([]); setWouldRecommend(null);
        setSubmitting(false); setShowSuccess(false);
    }, [open, payload]);

    const toggleCategory  = (v: string) => setCategories((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);
    const toggleHighlight = (v: string) => setHighlights((p) => p.includes(v) ? p.filter((x) => x !== v) : [...p, v]);

    const charCount = feedbackText.length;
    const canSubmitConsultation = rating > 0 && !submitting;
    const canAdvanceJourneyStep =
        (journeyStep === 1 && overallRating > 0 && outcomeRating > 0) ||
        (journeyStep === 2 && adherenceRating > 0) ||
        (journeyStep === 3);
    const canSubmitJourney =
        overallRating > 0 && outcomeRating > 0 && adherenceRating > 0 && !submitting;

    async function submit() {
        try {
            setSubmitting(true);
            if (type === "consultation") {
                const p = payload as ConsultationFeedbackPayload;
                await apiClient.post("/api/feedback/consultation/rating", {
                    appointmentId: p.appointmentId,
                    rating,
                    categories,
                    feedbackText: feedbackText.trim() || null,
                });
            } else {
                const p = payload as JourneyFeedbackPayload;
                await apiClient.post("/api/feedback/journey/rating", {
                    journeyId: p.journeyId,
                    overallRating,
                    outcomeRating,
                    adherenceRating,
                    highlights,
                    feedbackText: feedbackText.trim() || null,
                    wouldRecommend,
                });
            }
            setShowSuccess(true);
            // Small delay so the user sees the thank-you before the modal closes.
            setTimeout(() => {
                onSubmit?.();
                onClose?.();
            }, 1500);
        } catch (err: any) {
            toast.error(err?.message || "Failed to submit feedback");
            setSubmitting(false);
        }
    }

    const renderConsultation = () => (
        <div className="space-y-5">
            <StarRow value={rating} onChange={setRating} label="Your rating" />
            <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">What stood out?</p>
                <ChipGrid options={CONSULTATION_CATEGORIES} selected={categories} onToggle={toggleCategory} />
            </div>
            <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Tell us more (optional)</p>
                <Textarea
                    rows={3}
                    maxLength={300}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Anything else you'd like to share?"
                />
                <p className="text-[10px] text-muted-foreground text-right">{charCount}/300</p>
            </div>
        </div>
    );

    const renderJourneyStep = () => {
        if (journeyStep === 1) {
            return (
                <div className="space-y-5">
                    <StarRow value={overallRating} onChange={setOverallRating} label="Overall experience" />
                    <StarRow value={outcomeRating} onChange={setOutcomeRating} label="Outcome of treatment" />
                </div>
            );
        }
        if (journeyStep === 2) {
            return (
                <div className="space-y-5">
                    <StarRow value={adherenceRating} onChange={setAdherenceRating} label="How well did you stick to the plan?" />
                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Wins from this journey</p>
                        <ChipGrid options={JOURNEY_HIGHLIGHTS} selected={highlights} onToggle={toggleHighlight} />
                    </div>
                </div>
            );
        }
        // step 3
        return (
            <div className="space-y-5">
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">A note for the team (optional)</p>
                    <Textarea
                        rows={4}
                        maxLength={500}
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Anything you'd like the team to know?"
                    />
                </div>
                <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Would you recommend us?</p>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={wouldRecommend === true ? "default" : "outline"}
                            onClick={() => setWouldRecommend(true)}
                        >Yes</Button>
                        <Button
                            type="button"
                            variant={wouldRecommend === false ? "default" : "outline"}
                            onClick={() => setWouldRecommend(false)}
                        >No</Button>
                    </div>
                </div>
            </div>
        );
    };

    const titleText = useMemo(() => {
        if (type === "consultation") return "How was your visit?";
        return "Reflect on your journey";
    }, [type]);

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black">{titleText}</DialogTitle>
                </DialogHeader>

                {showSuccess ? (
                    <div className="py-8 text-center space-y-2">
                        <div className="text-4xl">🙏</div>
                        <p className="text-lg font-bold">Thank you for your feedback!</p>
                    </div>
                ) : (
                    <>
                        {type === "consultation" ? renderConsultation() : renderJourneyStep()}

                        <div className="flex items-center justify-between gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={onSkip} disabled={submitting}>
                                Skip for Now
                            </Button>
                            <div className="flex items-center gap-2">
                                {type === "journey" && journeyStep > 1 && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setJourneyStep((s) => Math.max(1, s - 1))}
                                        disabled={submitting}
                                    >Back</Button>
                                )}
                                {type === "journey" && journeyStep < 3 ? (
                                    <Button
                                        type="button"
                                        onClick={() => setJourneyStep((s) => Math.min(3, s + 1))}
                                        disabled={!canAdvanceJourneyStep}
                                        style={{ backgroundColor: PRIMARY_TEAL }}
                                    >Next</Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={submit}
                                        disabled={type === "consultation" ? !canSubmitConsultation : !canSubmitJourney}
                                        style={{ backgroundColor: PRIMARY_TEAL }}
                                    >Submit Feedback</Button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Hook: socket-driven mounting ─────────────────────────────────────────────
// Encapsulates the queue-and-skip-counter state machine the spec calls for.
// Pages just call <FeedbackPromptListener /> once near the top.
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useRef } from "react";

interface QueuedPrompt {
    type: FeedbackModalType;
    payload: ConsultationFeedbackPayload | JourneyFeedbackPayload;
    /** Stable identity for skip-counter — appointmentId or journeyId. */
    key: string;
}
const MAX_SKIPS = 3;

export function FeedbackPromptListener() {
    const { socket } = useWebSocket();
    const [queue, setQueue] = useState<QueuedPrompt[]>([]);
    const [active, setActive] = useState<QueuedPrompt | null>(null);
    const skipCounts = useRef<Map<string, number>>(new Map());
    const dismissed  = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!socket) return;

        const onConsultation = (payload: ConsultationFeedbackPayload) => {
            if (!payload?.appointmentId) return;
            if (dismissed.current.has(payload.appointmentId)) return;
            setQueue((q) => [...q, { type: "consultation", payload, key: payload.appointmentId }]);
        };
        const onJourney = (payload: JourneyFeedbackPayload) => {
            if (!payload?.journeyId) return;
            if (dismissed.current.has(payload.journeyId)) return;
            setQueue((q) => [...q, { type: "journey", payload, key: payload.journeyId }]);
        };

        socket.on("feedback_request", onConsultation);
        socket.on("journey_feedback_request", onJourney);
        return () => {
            socket.off("feedback_request", onConsultation);
            socket.off("journey_feedback_request", onJourney);
        };
    }, [socket]);

    // Promote next queued prompt when there's no active one.
    useEffect(() => {
        if (active || queue.length === 0) return;
        const [next, ...rest] = queue;
        setActive(next);
        setQueue(rest);
    }, [active, queue]);

    const closeActive = () => setActive(null);

    const handleSkip = () => {
        if (!active) return;
        const n = (skipCounts.current.get(active.key) ?? 0) + 1;
        skipCounts.current.set(active.key, n);
        if (n >= MAX_SKIPS) {
            // After 3 skips, permanently dismiss for this session — no API call.
            dismissed.current.add(active.key);
        }
        closeActive();
    };

    if (!active) return null;
    return (
        <FeedbackModal
            open
            type={active.type}
            payload={active.payload}
            onSubmit={() => {
                dismissed.current.add(active.key); // never re-show after submit
            }}
            onSkip={handleSkip}
            onClose={closeActive}
        />
    );
}
