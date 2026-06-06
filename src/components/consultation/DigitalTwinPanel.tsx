/**
 * F01 · DigitalTwinPanel — consolidated patient model for the
 * ConsultationRoom right column. Sits at the top, above the existing
 * Patient Snapshot card.
 *
 * Constraints honoured (per spec):
 *   - Renders NOTHING when the feature flag is off or the fetch fails.
 *   - Inline SVG sparklines only — no charting library, no new deps.
 *   - Privacy floor: cohort count < 5 ⇒ "Limited data" instead of N.
 *   - F04 dosha colours (#7c3aed / #ea580c / #0d9488) used verbatim.
 *   - shadcn Card + Skeleton + Badge are the only UI primitives.
 */

import { useQuery } from "@tanstack/react-query";
import { Sparkles, Pill, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { getDigitalTwin, type DigitalTwin } from "@/services/digitalTwin.service";
import { cn } from "@/lib/utils";

interface DigitalTwinPanelProps {
    patientId: string | null | undefined;
}

const DOSHA_COLOUR: Record<"VATA" | "PITTA" | "KAPHA", string> = {
    VATA:  "#7c3aed",
    PITTA: "#ea580c",
    KAPHA: "#0d9488",
};

export function DigitalTwinPanel({ patientId }: DigitalTwinPanelProps) {
    const { has } = useTenantFeatures();
    const flagOn = has("PATIENT_DIGITAL_TWIN");

    const { data, isLoading, isError } = useQuery<DigitalTwin>({
        queryKey: ["digital-twin", patientId],
        queryFn: () => getDigitalTwin(patientId!),
        enabled: !!patientId && flagOn,
        staleTime: 5 * 60 * 1000,
    });

    if (!patientId || !flagOn) return null;

    if (isLoading) return <LoadingShell />;
    // Error or empty payload — keep the "no empty state card" contract.
    if (isError || !data) return null;

    return (
        <Card className="shrink-0">
            <Section1Header data={data} />
            <CardContent className="space-y-4 pt-1">
                <Section2DoshaBars data={data} />
                <Section3Sparklines data={data} />
                <Section4Context data={data} />
            </CardContent>
        </Card>
    );
}

// ── Section 1 — Header ─────────────────────────────────────────────────────
function Section1Header({ data }: { data: DigitalTwin }) {
    const subtitle = [data.prakriti, data.agniType].filter(Boolean).join(" · ") || "Profile pending";
    const score = data.wellnessScore;
    const scoreTone =
        score == null ? "" :
        score >= 70   ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
        score >= 40   ? "bg-amber-100  text-amber-800  border-amber-200" :
                        "bg-rose-100   text-rose-800   border-rose-200";
    return (
        <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-primary" /> Digital Twin
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
                </div>
                {score != null && (
                    <Badge variant="outline" className={cn("text-[11px] tabular-nums", scoreTone)}>
                        Wellness {Math.round(score)}
                    </Badge>
                )}
            </div>
        </CardHeader>
    );
}

// ── Section 2 — Dosha balance bars + forecast tag ──────────────────────────
function Section2DoshaBars({ data }: { data: DigitalTwin }) {
    const { vata, pitta, kapha } = data.doshaBalance;
    const rows: Array<{ key: "VATA" | "PITTA" | "KAPHA"; value: number }> = [
        { key: "VATA",  value: vata },
        { key: "PITTA", value: pitta },
        { key: "KAPHA", value: kapha },
    ];
    return (
        <div className="space-y-1.5">
            {rows.map((r) => (
                <div key={r.key} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium">{r.key}</span>
                        <span className="text-muted-foreground tabular-nums">{r.value}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${r.value}%`, backgroundColor: DOSHA_COLOUR[r.key] }}
                        />
                    </div>
                </div>
            ))}
            {data.forecast && (
                <div
                    className="mt-1.5 text-[11px] leading-snug border-l-2 pl-2 py-0.5"
                    style={{ borderColor: DOSHA_COLOUR[data.forecast.dominantDosha] }}
                >
                    <span style={{ color: DOSHA_COLOUR[data.forecast.dominantDosha] }}>
                        ⚠ {data.forecast.dominantDosha} aggravation forecast in {data.forecast.daysUntilSymp} days
                        ({Math.round(data.forecast.confidence * 100)}% confidence)
                    </span>
                </div>
            )}
        </div>
    );
}

// ── Section 3 — 30-day sparklines (Pain · Sleep · Mood · Mobility) ─────────
type Metric = "PAIN" | "SLEEP" | "MOOD" | "MOBILITY";

function Section3Sparklines({ data }: { data: DigitalTwin }) {
    const metrics: Array<{ key: Metric; label: string; trend: { value: number; date: string }[]; lowerIsBetter: boolean; color: string }> = [
        { key: "PAIN",     label: "Pain",     trend: data.painTrend,     lowerIsBetter: true,  color: "#dc2626" },
        { key: "SLEEP",    label: "Sleep",    trend: data.sleepTrend,    lowerIsBetter: false, color: "#0ea5e9" },
        { key: "MOOD",     label: "Mood",     trend: data.moodTrend,     lowerIsBetter: false, color: "#f59e0b" },
        { key: "MOBILITY", label: "Mobility", trend: data.mobilityTrend, lowerIsBetter: true,  color: "#16a34a" },
    ];

    return (
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-border/50">
            {metrics.map((m) => {
                const points = m.trend.map((t) => t.value);
                const current = points[points.length - 1] ?? null;
                const delta7 = compute7DayDelta(points);
                const trendArrow = arrowFor(delta7, m.lowerIsBetter);
                return (
                    <div key={m.key} className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                            {m.label}
                        </div>
                        <SparkLine data={points} width={60} height={20} color={m.color} />
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-xs font-semibold tabular-nums">
                                {current != null ? formatCurrent(m.key, current) : "—"}
                            </span>
                            {trendArrow}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function formatCurrent(metric: Metric, value: number): string {
    if (metric === "PAIN" || metric === "MOOD" || metric === "MOBILITY") {
        return value.toFixed(1).replace(/\.0$/, "");
    }
    // Sleep: hours with one decimal.
    return `${value.toFixed(1)}h`;
}

function compute7DayDelta(points: number[]): number | null {
    if (points.length < 4) return null;
    const last7  = points.slice(-7);
    const prior7 = points.slice(-14, -7);
    if (prior7.length === 0) return null;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return mean(last7) - mean(prior7);
}

function arrowFor(delta: number | null, lowerIsBetter: boolean) {
    if (delta == null || Math.abs(delta) < 0.2) {
        return <Minus className="w-3 h-3 text-muted-foreground" />;
    }
    // For metrics where lower is better, a negative delta (going down) is
    // improvement. For others (sleep / mood), positive delta is improvement.
    const improving = lowerIsBetter ? delta < 0 : delta > 0;
    if (improving) return <ArrowUp className="w-3 h-3 text-emerald-600" />;
    return <ArrowDown className="w-3 h-3 text-rose-600" />;
}

// ── Inline SVG sparkline — no external library ─────────────────────────────
interface SparkLineProps {
    data: number[];
    width: number;
    height: number;
    color: string;
}

function SparkLine({ data, width, height, color }: SparkLineProps) {
    if (!data || data.length < 2) {
        // Single point or empty — show a baseline so the layout doesn't jump.
        return (
            <svg width={width} height={height} className="block">
                <line x1={0} y1={height / 2} x2={width} y2={height / 2}
                      stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />
            </svg>
        );
    }
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const stepX = data.length === 1 ? 0 : width / (data.length - 1);
    const pad = 1;
    const usable = height - pad * 2;

    const points = data
        .map((v, i) => {
            const x = i * stepX;
            // Y inverted because SVG origin is top-left.
            const y = pad + (1 - (v - min) / range) * usable;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");

    return (
        <svg width={width} height={height} className="block">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// ── Section 4 — Supporting context (2-col grid) ────────────────────────────
function Section4Context({ data }: { data: DigitalTwin }) {
    const moreCount = Math.max(0, data.activeMedCount - data.activeMeds.length);
    const tongue = data.tongueSummary;
    const trendTone =
        tongue?.trend === "IMPROVING" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
        tongue?.trend === "WORSENING" ? "bg-rose-100    text-rose-800    border-rose-200"    :
                                        "bg-slate-100   text-slate-700   border-slate-200";

    const cohortBelowFloor = data.similarPatientsCount < data.privacyFloor;
    const cohortText = cohortBelowFloor
        ? "Limited data"
        : `${data.similarPatientsCount} patients with your Prakriti and condition`;

    return (
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50 text-[11px]">
            {/* Left column — medications + tongue signal */}
            <div className="space-y-2 min-w-0">
                <div>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <Pill className="w-3 h-3" /> Active Medications
                    </div>
                    <div className="font-semibold">{data.activeMedCount} active</div>
                    <ul className="mt-1 space-y-0.5">
                        {data.activeMeds.map((m, i) => (
                            <li key={i} className="truncate" title={`${m.name} — ${m.dosage} / ${m.frequency}`}>
                                • {m.name}
                            </li>
                        ))}
                        {moreCount > 0 && (
                            <li className="text-muted-foreground italic">+ {moreCount} more</li>
                        )}
                    </ul>
                </div>

                {tongue && (tongue.latestDosha || tongue.latestColour) && (
                    <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Tongue Signal
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {tongue.latestDosha && (
                                <Badge variant="outline" className="text-[10px]">
                                    {tongue.latestDosha}
                                </Badge>
                            )}
                            {tongue.latestColour && (
                                <span className="text-muted-foreground">{tongue.latestColour}</span>
                            )}
                            <Badge variant="outline" className={cn("text-[10px]", trendTone)}>
                                {tongue.trend}
                            </Badge>
                        </div>
                    </div>
                )}
            </div>

            {/* Right column — journey + cohort */}
            <div className="space-y-2 min-w-0">
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Journey
                    </div>
                    {data.journeyCondition ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold truncate">{data.journeyCondition}</span>
                            {data.journeyStatus && (
                                <Badge variant="outline" className="text-[10px]">
                                    {data.journeyStatus}
                                </Badge>
                            )}
                        </div>
                    ) : <div className="text-muted-foreground italic">No active journey</div>}
                </div>

                <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Similar Patients
                    </div>
                    <div className={cn(
                        "leading-snug",
                        cohortBelowFloor ? "text-muted-foreground italic" : "",
                    )}>
                        {cohortText}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Loading shell ──────────────────────────────────────────────────────────
function LoadingShell() {
    return (
        <Card className="shrink-0">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> Digital Twin
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-1.5 w-4/5" />
                <Skeleton className="h-1.5 w-3/5" />
                <Skeleton className="h-12 w-full" />
            </CardContent>
        </Card>
    );
}
