/**
 * F03 · TongueTrendChart — Jihva Pariksha timeline table for the
 * ConsultationRoom right column.
 *
 * Renders the last 14 observations newest-first as a compact table.
 * Each row that shows a different dominant dosha than its predecessor is
 * tinted so the clinician can spot trajectory shifts at a glance. Beneath
 * the table is a one-line trend summary built deterministically from the
 * last 3 entries — no LLM call at render time (per spec constraint).
 *
 * Rendering contract:
 *   - Renders NOTHING when the feature flag is off, patientId is missing,
 *     or the patient has zero observations.
 *   - Loading state mounts only briefly because React Query caches per
 *     patient for 5 min.
 */

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import {
    getPatientTongueObservations,
    type TongueObservation,
} from "@/services/tongueObservation.service";
import { cn } from "@/lib/utils";

interface TongueTrendChartProps {
    patientId: string | null | undefined;
}

// Match F04 dosha colour conventions exactly.
const DOSHA_THEME: Record<string, { bg: string; emoji: string }> = {
    VATA:     { bg: "bg-[#7c3aed] text-white", emoji: "🟣" },
    PITTA:    { bg: "bg-[#ea580c] text-white", emoji: "🔴" },
    KAPHA:    { bg: "bg-[#0d9488] text-white", emoji: "🟢" },
    BALANCED: { bg: "bg-emerald-600 text-white", emoji: "✅" },
    TRIDOSHA: { bg: "bg-slate-600 text-white", emoji: "⚪" },
};

function fmtDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function fmtCoating(o: TongueObservation): string {
    const colour = o.aiCoatingColour ?? "—";
    const thickness = o.aiCoatingThickness
        ? `/${o.aiCoatingThickness.slice(0, 3).toUpperCase()}`
        : "";
    return `${colour}${thickness}`;
}

/**
 * Build a one-line trend summary from the most recent 3 observations.
 * Deterministic — no LLM. Uses the dominant dosha + coating colour drift
 * to construct a clinician-friendly sentence. Returns null when there's
 * nothing meaningful to say (single observation, no dosha drift, etc.).
 */
function buildTrendSummary(obs: TongueObservation[]): string | null {
    if (!obs || obs.length < 2) return null;
    const recent = obs.slice(0, 3);
    const oldest = recent[recent.length - 1];
    const newest = recent[0];

    const oldColour = oldest.aiCoatingColour;
    const newColour = newest.aiCoatingColour;
    const oldDosha  = oldest.doshaIndication;
    const newDosha  = newest.doshaIndication;

    // Compute span in calendar weeks for the sentence.
    const diffDays = Math.max(
        1,
        Math.round((new Date(newest.observedAt).getTime() - new Date(oldest.observedAt).getTime()) / (24 * 60 * 60 * 1000)),
    );
    const spanLabel = diffDays >= 14
        ? `${Math.round(diffDays / 7)} weeks`
        : `${diffDays} days`;

    const interestingColour = oldColour && newColour && oldColour !== newColour;
    const interestingDosha  = oldDosha  && newDosha  && oldDosha  !== newDosha && newDosha !== 'BALANCED';

    if (interestingColour && interestingDosha) {
        return `Coating shifting ${oldColour} → ${newColour} over ${spanLabel} — ${newDosha} elevation pattern`;
    }
    if (interestingColour) {
        return `Coating shifting ${oldColour} → ${newColour} over ${spanLabel}`;
    }
    if (interestingDosha) {
        return `Dosha drift ${oldDosha} → ${newDosha} over ${spanLabel}`;
    }
    // Stable pattern is still worth surfacing when consistent.
    if (oldDosha && newDosha && oldDosha === newDosha && oldDosha !== 'BALANCED') {
        return `Consistent ${newDosha} pattern across last ${recent.length} observations`;
    }
    return null;
}

export function TongueTrendChart({ patientId }: TongueTrendChartProps) {
    const { has } = useTenantFeatures();
    const flagOn = has("MULTIMODAL_DIAGNOSTIC_AI");

    const { data, isLoading } = useQuery<TongueObservation[]>({
        queryKey: ["tongue-observations", patientId],
        queryFn: () => getPatientTongueObservations(patientId!),
        enabled: !!patientId && flagOn,
        staleTime: 5 * 60 * 1000,
    });

    if (!patientId || !flagOn) return null;

    if (isLoading) {
        return (
            <Card className="shrink-0">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-primary" /> Tongue Trend
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                </CardContent>
            </Card>
        );
    }

    if (!data || data.length === 0) return null;

    const rows = data.slice(0, 14);
    const summary = buildTrendSummary(data);

    return (
        <Card className="shrink-0">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> Tongue Trend
                    <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                        {data.length} total
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                        <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            <tr>
                                <th className="text-left py-1 pr-2 font-medium">Date</th>
                                <th className="text-left py-1 pr-2 font-medium">Coating</th>
                                <th className="text-left py-1 pr-2 font-medium">Moisture</th>
                                <th className="text-left py-1 pr-2 font-medium">Dosha</th>
                                <th className="text-right py-1 font-medium">Conf.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((o, idx) => {
                                // idx 0 is newest. Compare against the
                                // following (older) row — when they differ,
                                // this row marks a shift, so tint it.
                                const next = rows[idx + 1];
                                const shifted = next?.doshaIndication && next.doshaIndication !== o.doshaIndication;
                                const theme = o.doshaIndication ? DOSHA_THEME[o.doshaIndication] : undefined;
                                const confPct = o.confidence != null ? `${Math.round(o.confidence * 100)}%` : "—";
                                return (
                                    <tr
                                        key={o.id}
                                        className={cn(
                                            "border-t border-border/40",
                                            shifted ? "bg-amber-50" : "",
                                        )}
                                    >
                                        <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(o.observedAt)}</td>
                                        <td className="py-1.5 pr-2">{fmtCoating(o)}</td>
                                        <td className="py-1.5 pr-2">{o.aiMoisture ?? "—"}</td>
                                        <td className="py-1.5 pr-2">
                                            {o.doshaIndication ? (
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold",
                                                    theme?.bg ?? "bg-muted text-foreground",
                                                )}>
                                                    {theme?.emoji}
                                                    {o.doshaIndication}
                                                </span>
                                            ) : "—"}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums">{confPct}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {summary && (
                    <div className="text-[11px] italic text-muted-foreground border-t border-border/50 pt-2">
                        {summary}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
