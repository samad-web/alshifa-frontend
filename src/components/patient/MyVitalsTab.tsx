/**
 * MyVitalsTab — patient-facing read-only view of their own vitals,
 * constitution (Prakriti), lifestyle observations, and pain map.
 *
 * Calls GET /api/patient/health-summary which returns the same shape the
 * consultation room's snapshot consumes — so doctor and patient always
 * see the same data without divergent code paths.
 *
 * Patient cannot edit clinical findings here (accuracy concern). To
 * self-report, they continue using DailyCheckIn / triage / self-exam.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Activity, AlertTriangle, Loader2, Sparkles, Salad,
    HeartPulse, Scale, Moon, Smile, Ruler, Plus, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { PainMapCard } from "@/components/patient/PainMapCard";
import { LogVitalsModal } from "@/components/patient/LogVitalsModal";
import { formatDate } from "@/lib/format-date";

// ── Types — same shape as the consultation room's snapshot consumes. ────
// Re-declared here (rather than imported from ConsultationRoom) so this
// component can be moved or reused without circular dependency risk.
interface VitalReading { value: number; unit: string; recordedAt: string; source: string }
interface HealthSummary {
    patientId: string;
    latestVitals: Record<string, VitalReading | undefined>;
    height: { cm: number; source: string } | null;
    weight: { kg: number; recordedAt: string } | null;
    bmi: { value: number; category: string } | null;
    idealWeight: { kg: number } | null;
    prakriti: {
        type: string;
        display: string;
        satvaRating: number | null;
        agniType: string | null;
        assessedAt: string;
        assessedBy: string | null;
    } | null;
    lifestyle: {
        sleepQuality: number | null;
        stressLevel: number | null;
        exerciseFrequency: string | null;
        dietType: string | null;
        recordedAt: string;
        source: string;
    } | null;
    painRegions: Array<{ region?: string; regionLabel?: string; intensity?: number }>;
}

function relTime(iso: string | null | undefined): string {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.round(ms / 60_000);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
    return formatDate(iso, "");
}

// ── Vital tile (single metric, last reading + when + source) ──────────
// When `onAdd` is supplied, the empty state becomes a tap target that
// opens the Log Vitals modal — makes self-entry discoverable from each
// "Not recorded" tile instead of relying on the header button alone.
function VitalTile({
    icon: Icon, label, value, unit, recordedAt, source, onAdd, derived,
}: {
    icon: typeof Activity; label: string; value: number | string | null;
    unit: string; recordedAt?: string | null; source?: string;
    onAdd?: () => void; derived?: boolean;
}) {
    const hasValue = value !== null && value !== undefined && value !== "";
    const sourceLabel =
        source === 'self-reported' ? { text: 'Self-reported', cls: 'bg-blue-100 text-blue-800' } :
        source === 'clinician'     ? { text: 'Clinician',     cls: 'bg-emerald-100 text-emerald-800' } :
        source                     ? { text: source,          cls: 'bg-muted text-muted-foreground' } :
        null;

    const isClickableEmpty = !hasValue && !!onAdd;

    return (
        <div
            className={`rounded-2xl border bg-card p-4 transition-colors ${
                isClickableEmpty ? "cursor-pointer hover:bg-secondary/40 hover:border-primary/40" : ""
            }`}
            onClick={isClickableEmpty ? onAdd : undefined}
            role={isClickableEmpty ? "button" : undefined}
            tabIndex={isClickableEmpty ? 0 : undefined}
            onKeyDown={isClickableEmpty ? (e) => { if (e.key === "Enter" || e.key === " ") onAdd?.(); } : undefined}
        >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                <Icon className="w-3.5 h-3.5 text-primary" />
                {label}
            </div>
            {hasValue ? (
                <>
                    <p className="text-2xl font-black text-foreground tabular-nums">
                        {value}<span className="text-sm font-medium text-muted-foreground ml-1">{unit}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {recordedAt && (
                            <span className="text-[11px] text-muted-foreground">{relTime(recordedAt)}</span>
                        )}
                        {sourceLabel && (
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${sourceLabel.cls}`}>
                                {sourceLabel.text}
                            </span>
                        )}
                    </div>
                </>
            ) : isClickableEmpty ? (
                <p className="text-sm text-primary font-medium flex items-center gap-1">
                    + Add {label.toLowerCase()}
                </p>
            ) : (
                <p className="text-sm text-muted-foreground italic">
                    {derived ? "Enter Height + Weight to see this" : "Not recorded"}
                </p>
            )}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────
export function MyVitalsTab() {
    const navigate = useNavigate();
    const [logOpen, setLogOpen] = useState(false);
    const { data, isLoading, isError, refetch } = useQuery<HealthSummary>({
        queryKey: ["my-health-summary"],
        queryFn: async () => {
            const { data } = await apiClient.get<HealthSummary>("/api/patient/health-summary");
            return data;
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading your health summary…</span>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm">
                <p className="font-semibold text-amber-900 mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Couldn't load your health summary
                </p>
                <p className="text-amber-800 mb-3">
                    Please try again, or contact your care team if this keeps happening.
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
        );
    }

    // Defensive accessors — match the safety used in the consultation room
    // snapshot. Any missing field renders as "Not recorded" without crashing.
    const latestVitals = (data.latestVitals ?? {}) as Record<string, VitalReading | undefined>;
    const painRegions  = Array.isArray(data.painRegions) ? data.painRegions : [];
    const weight = data.weight;
    const pain   = latestVitals.PAIN_SCORE;
    const sleep  = latestVitals.SLEEP_HOURS;
    const mood   = latestVitals.MOOD;

    return (
        <div className="space-y-6">
            {/* Top action — patient can self-log Height/Weight/Pain/Sleep/Mood
                from here. Saves directly into PatientVital with source
                "self-reported" and refreshes the tiles below. */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    Log your own measurements anytime — they'll appear here and your doctor will see them.
                </p>
                <Button size="sm" onClick={() => setLogOpen(true)} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Log vitals
                </Button>
            </div>

            <LogVitalsModal
                open={logOpen}
                onOpenChange={setLogOpen}
                currentHeightCm={data.height?.cm ?? null}
            />

            {/* ── Vital tiles ── */}
            <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> Recent Vitals
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <VitalTile icon={Scale}      label="Weight" value={weight?.kg ?? null}    unit="kg"  recordedAt={weight?.recordedAt} source={latestVitals.WEIGHT?.source} onAdd={() => setLogOpen(true)} />
                    <VitalTile icon={HeartPulse} label="Pain"   value={pain?.value ?? null}   unit="/10" recordedAt={pain?.recordedAt}   source={pain?.source}                onAdd={() => setLogOpen(true)} />
                    <VitalTile icon={Moon}       label="Sleep"  value={sleep?.value ?? null}  unit="hrs" recordedAt={sleep?.recordedAt}  source={sleep?.source}               onAdd={() => setLogOpen(true)} />
                    <VitalTile icon={Smile}      label="Mood"   value={mood?.value ?? null}   unit="/5"  recordedAt={mood?.recordedAt}   source={mood?.source}                onAdd={() => setLogOpen(true)} />
                </div>
            </section>

            {/* ── Body composition ── */}
            <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-primary" /> Body Composition
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <VitalTile icon={Ruler} label="Height"       value={data.height?.cm ?? null}      unit="cm" onAdd={() => setLogOpen(true)} />
                    <VitalTile icon={Scale} label="BMI"          value={data.bmi?.value ?? null}      unit={data.bmi ? `· ${data.bmi.category}` : ""} derived />
                    <VitalTile icon={Scale} label="Ideal weight" value={data.idealWeight?.kg ?? null} unit="kg" derived />
                </div>
            </section>

            {/* ── Prakriti ── */}
            <section className="rounded-2xl border bg-card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> My Constitution (Prakriti)
                </h3>
                {data.prakriti ? (
                    <div className="space-y-2">
                        <p className="text-2xl font-black text-foreground">{data.prakriti.display}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            {data.prakriti.satvaRating != null && (
                                <span><strong className="text-foreground">Satva:</strong> {data.prakriti.satvaRating}/10</span>
                            )}
                            {data.prakriti.agniType && (
                                <span><strong className="text-foreground">Agni:</strong> {data.prakriti.agniType}</span>
                            )}
                            {data.prakriti.assessedAt && (
                                <span>Assessed {relTime(data.prakriti.assessedAt)}</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground italic">
                            Not yet assessed — your doctor will complete this at your next visit, or you can take the self-quiz now.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate("/self-exam")}
                            className="gap-1.5"
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Take Prakriti self-quiz
                        </Button>
                    </div>
                )}
            </section>

            {/* ── Lifestyle ── */}
            <section className="rounded-2xl border bg-card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Salad className="w-4 h-4 text-primary" /> My Lifestyle
                </h3>
                {data.lifestyle ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <LifestyleField label="Sleep rating"
                                        value={data.lifestyle.sleepQuality != null ? `${data.lifestyle.sleepQuality}/5` : null} />
                        <LifestyleField label="Stress"
                                        value={data.lifestyle.stressLevel != null ? `${data.lifestyle.stressLevel}/10` : null} />
                        <LifestyleField label="Exercise"
                                        value={data.lifestyle.exerciseFrequency} />
                        <LifestyleField label="Diet"
                                        value={data.lifestyle.dietType} />
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground italic">
                        No lifestyle entries on file yet. Complete your daily check-in to log these.
                    </p>
                )}
            </section>

            {/* ── Pain map (reuse existing component, patient self-view) ── */}
            <section>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <HeartPulse className="w-4 h-4 text-primary" /> Pain Map
                </h3>
                {painRegions.length > 0 ? (
                    <PainMapCard />
                ) : (
                    <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground italic">
                        No pain regions logged.
                    </div>
                )}
            </section>

            {/* Footer note */}
            <p className="text-[11px] text-muted-foreground text-center pt-2">
                For older PDF reports, see the <strong>Health Reports</strong> tab above.
            </p>
        </div>
    );
}

function LifestyleField({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
            <p className={value ? "text-sm font-semibold text-foreground" : "text-sm text-muted-foreground italic"}>
                {value || "Not recorded"}
            </p>
        </div>
    );
}
