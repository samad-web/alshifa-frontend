/**
 * F04 · DoshaForecastPanel — predictive Dosha imbalance card for the
 * ConsultationRoom right column.
 *
 * Rendering contract (locked by spec):
 *   - Renders NOTHING when:
 *       • feature flag PREDICTIVE_DOSHA_ENGINE is off, OR
 *       • patientId is missing, OR
 *       • the patient has no forecast history at all
 *   - When the most recent forecast is resolved, shows a muted "Resolved" state.
 *   - Otherwise shows the most recent non-resolved forecast with dosha-coloured
 *     header, days/confidence, and the trigger-factor list.
 *
 * Caller is expected to gate the mount point as well — this card no-ops
 * cleanly either way, so an over-eager mount is harmless.
 */

import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import {
    getPatientDoshaForecasts,
    type DoshaForecast,
} from "@/services/doshaForecast.service";

interface DoshaForecastPanelProps {
    patientId: string | null | undefined;
}

const DOSHA_THEME: Record<DoshaForecast["dominantDosha"], { bg: string; label: string }> = {
    VATA:  { bg: "bg-[#7c3aed] text-white", label: "VATA AGGRAVATION" },
    PITTA: { bg: "bg-[#ea580c] text-white", label: "PITTA AGGRAVATION" },
    KAPHA: { bg: "bg-[#0d9488] text-white", label: "KAPHA AGGRAVATION" },
};

export function DoshaForecastPanel({ patientId }: DoshaForecastPanelProps) {
    const { has } = useTenantFeatures();
    const flagOn = has("PREDICTIVE_DOSHA_ENGINE");

    const { data, isLoading } = useQuery<DoshaForecast[]>({
        queryKey: ["dosha-forecast", patientId],
        queryFn: () => getPatientDoshaForecasts(patientId!),
        enabled: !!patientId && flagOn,
        staleTime: 5 * 60 * 1000,
    });

    if (!patientId || !flagOn) return null;

    // Loading shell mounts only when we *expect* a forecast. To honour the
    // "no empty state card" constraint we render nothing once the load
    // settles and the array is empty.
    if (isLoading) {
        return (
            <Card className="shrink-0">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-primary" /> Dosha Forecast
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!data || data.length === 0) return null;

    // Most recent non-resolved forecast wins. If everything is resolved we
    // show the most recent resolved one in a muted state — but only if the
    // user has had at least one forecast ever (above check guards that).
    const active = data.find((f) => !f.resolved) ?? null;
    const latestResolved = !active ? data[0] : null;

    return (
        <Card className="shrink-0">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" /> Dosha Forecast
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-1">
                {active && <ActiveForecast forecast={active} />}
                {latestResolved && <ResolvedForecast forecast={latestResolved} />}
            </CardContent>
        </Card>
    );
}

function ActiveForecast({ forecast }: { forecast: DoshaForecast }) {
    const theme = DOSHA_THEME[forecast.dominantDosha] ?? DOSHA_THEME.VATA;
    const confidencePct = Math.round(forecast.confidence * 100);
    const triggers = (forecast.triggerFactors ?? []).slice(0, 5);

    return (
        <>
            <div className={`-mx-4 -mt-1 px-4 py-2 ${theme.bg} text-xs font-semibold tracking-wide`}>
                {theme.label}
            </div>

            <div className="text-xs text-foreground">
                Forecast within{" "}
                <span className="font-semibold">{forecast.daysUntilSymp} days</span>
                <span className="text-muted-foreground mx-1">·</span>
                <span className="font-semibold">{confidencePct}%</span>{" "}
                <span className="text-muted-foreground">confidence</span>
            </div>

            {triggers.length > 0 && (
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Trigger factors
                    </div>
                    <ul className="space-y-0.5">
                        {triggers.map((t, i) => (
                            <li key={i} className="text-xs leading-snug flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {forecast.alertEmitted && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                    ⚠ Alert sent to care queue
                </div>
            )}
        </>
    );
}

function ResolvedForecast({ forecast }: { forecast: DoshaForecast }) {
    return (
        <div className="text-xs text-muted-foreground space-y-1">
            <div>
                Last forecast ({forecast.dominantDosha} aggravation) marked resolved
                {forecast.resolvedAt
                    ? ` ${formatRelative(forecast.resolvedAt)}`
                    : ""}.
            </div>
            <div className="text-[11px]">No active drift signal at the moment.</div>
        </div>
    );
}

function formatRelative(iso: string): string {
    try {
        const t = new Date(iso).getTime();
        const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
        if (days === 0) return "today";
        if (days === 1) return "yesterday";
        if (days < 7)   return `${days}d ago`;
        return new Date(iso).toLocaleDateString();
    } catch {
        return "";
    }
}
