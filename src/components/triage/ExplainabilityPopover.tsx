/**
 * ExplainabilityPopover — F08 "Why?" surface for a triage session.
 *
 * Renders an inline trigger (default: "Why?" with a HelpCircle icon) that
 * opens a compact popover explaining how a triage session arrived at its
 * urgency level. Three sections:
 *
 *   1. Score header     — compositeScore + urgencyLevel + confidenceScore
 *                         + suggestedSpecialty
 *   2. Red flags        — redFlagsMatched bullet list + a "Urgency upgraded
 *                         by red flag" banner when redFlagForced=true
 *   3. Routing quality  — inputCompleteness, routingMatchStrength,
 *                         alternativeSpecialties chips, and the triageNotes
 *                         narrative as a quoted footer
 *
 * Section 3 was originally spec'd as a "cohort insight" reading from
 * `reasoning.cohort.*`, but the live schema has no `reasoning` JSON column
 * (verified via DB probe). Routing-quality is the explainability surface
 * that actually exists on TriageSession — and is arguably more clinically
 * useful since it tells the doctor *why* the score is what it is.
 *
 * Data is lazy-fetched on first open (not on mount) so this component is
 * cheap to drop into a long list. React Query caches by session id, so
 * subsequent opens of the same row are instant.
 *
 * Feature gating is the caller's responsibility — render this only when
 * useFeatureFlag('EXPLAINABLE_AI') returns true.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle, AlertTriangle, ShieldAlert, Quote } from "lucide-react";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getTriageSession, type TriageSessionDetail } from "@/services/triage.service";

interface ExplainabilityPopoverProps {
    triageSessionId: string;
    /** Optional custom trigger label — defaults to "Why?". */
    triggerLabel?: string;
    /** Override the trigger className (e.g. to colour-match a parent badge). */
    triggerClassName?: string;
}

function urgencyTone(urgency: string | null): string {
    switch (urgency) {
        case "CRITICAL": return "text-rose-700";
        case "URGENT":   return "text-amber-700";
        case "MODERATE": return "text-sky-700";
        case "LOW":      return "text-emerald-700";
        default:         return "text-foreground";
    }
}

function percent(n: number | null): string {
    if (n == null || Number.isNaN(n)) return "—";
    return `${Math.round(n * 100)}%`;
}

function qualityWord(n: number | null): string {
    if (n == null) return "—";
    if (n >= 0.75) return "strong";
    if (n >= 0.4)  return "moderate";
    if (n > 0)     return "weak";
    return "none";
}

// Filter out the boilerplate red-flag string from triageNotes so the
// narrative footer doesn't duplicate Section 2. See Phase A bug B note in
// the plan file — the writer pollutes triageNotes when redFlagForced=true.
function cleanNotes(notes: string | null): string | null {
    if (!notes) return null;
    const trimmed = notes.trim();
    if (!trimmed) return null;
    if (/^RED FLAG:/i.test(trimmed)) return null;
    return trimmed;
}

export function ExplainabilityPopover({
    triageSessionId,
    triggerLabel = "Why?",
    triggerClassName,
}: ExplainabilityPopoverProps) {
    const [open, setOpen] = useState(false);
    const { data, isLoading, isError } = useQuery<TriageSessionDetail>({
        queryKey: ["triage-session", triageSessionId],
        queryFn: () => getTriageSession(triageSessionId),
        enabled: open,                       // lazy: only fetch on first open
        staleTime: 5 * 60 * 1000,            // cache for 5 min within session
    });

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onClick={(e) => e.stopPropagation()}   // don't trigger row navigation
                    className={
                        triggerClassName ??
                        "inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline align-middle"
                    }
                    aria-label="Why this urgency?"
                >
                    <HelpCircle className="w-3 h-3" />
                    {triggerLabel}
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="max-w-sm p-4 text-xs"
                align="start"
                side="bottom"
                onClick={(e) => e.stopPropagation()}
            >
                {isLoading && <LoadingSkeleton />}
                {isError && (
                    <div className="text-rose-700 text-xs">
                        Couldn't load the triage breakdown. Try again in a moment.
                    </div>
                )}
                {data && <ExplainabilityBody session={data} />}
            </PopoverContent>
        </Popover>
    );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-2.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
        </div>
    );
}

function ExplainabilityBody({ session: s }: { session: TriageSessionDetail }) {
    const notes = cleanNotes(s.triageNotes);
    const hasRedFlags = s.redFlagsMatched.length > 0;
    const hasAlternatives = s.alternativeSpecialties.length > 0;

    return (
        <div className="space-y-3">
            {/* ── Section 1: Score header ───────────────────────────────────── */}
            <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Score
                </div>
                <div className={`text-sm font-semibold ${urgencyTone(s.urgencyLevel)}`}>
                    {s.compositeScore != null ? s.compositeScore.toFixed(1) : "—"}
                    <span className="text-muted-foreground font-normal">/10</span>
                    <span className="mx-1.5 text-muted-foreground font-normal">·</span>
                    {s.urgencyLevel ?? "—"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                    {percent(s.confidenceScore)} confidence
                    {s.suggestedSpecialty && ` · ${s.suggestedSpecialty}`}
                </div>
            </div>

            {/* ── Section 2: Red flags ──────────────────────────────────────── */}
            {(hasRedFlags || s.redFlagForced) && (
                <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Red flags
                    </div>
                    {s.redFlagForced && (
                        <div className="flex items-start gap-1.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 px-2 py-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
                            <span className="leading-snug">
                                Urgency was upgraded automatically because a red flag matched.
                            </span>
                        </div>
                    )}
                    {hasRedFlags && (
                        <ul className="space-y-0.5">
                            {s.redFlagsMatched.map((flag) => (
                                <li key={flag} className="flex items-start gap-1.5">
                                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-rose-600" />
                                    <span className="leading-snug">{flag.replace(/_/g, " ")}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* ── Section 3: Routing & confidence quality ───────────────────── */}
            <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Routing & quality
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div>
                        <span className="text-muted-foreground">Input completeness:</span>{" "}
                        <span className="font-medium">{percent(s.inputCompleteness)}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Specialty match:</span>{" "}
                        <span className="font-medium">{qualityWord(s.routingMatchStrength)}</span>
                    </div>
                </div>
                {hasAlternatives && (
                    <div className="pt-0.5">
                        <span className="text-muted-foreground">Alternatives considered: </span>
                        <span className="inline-flex flex-wrap gap-1 align-middle">
                            {s.alternativeSpecialties.map((spec) => (
                                <Badge
                                    key={spec}
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 font-normal"
                                >
                                    {spec}
                                </Badge>
                            ))}
                        </span>
                    </div>
                )}
                {notes && (
                    <div className="flex items-start gap-1.5 pt-1 italic text-muted-foreground">
                        <Quote className="w-3 h-3 shrink-0 mt-0.5" />
                        <span className="leading-snug">{notes}</span>
                    </div>
                )}
            </div>

            {/* Override footer — only when a clinician has overridden ──────── */}
            {s.overrideReason && (
                <div className="pt-2 border-t text-[11px]">
                    <span className="text-muted-foreground">Reviewed:</span>{" "}
                    <span className="italic">{s.overrideReason}</span>
                </div>
            )}
        </div>
    );
}
