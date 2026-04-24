import { useEffect, useState } from "react";
import { superAdminApi, TriageOverview } from "@/services/superAdmin.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Activity,
  Clock,
  RefreshCw,
  Stethoscope,
  TrendingUp,
} from "lucide-react";

const WINDOW_OPTIONS = [7, 14, 30, 90];

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: any;
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-red-400 shadow-md" : ""}>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`rounded-md p-3 ${accent ? "bg-red-500 text-white" : "bg-slate-900 text-amber-400"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold leading-tight">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function UrgencyBar({ mix, total }: { mix: TriageOverview["totals"]["urgencyMix"]; total: number }) {
  if (total === 0) return <div className="text-xs text-muted-foreground">No sessions in window.</div>;
  const segs: Array<{ label: string; count: number; color: string }> = [
    { label: "ROUTINE",  count: mix.ROUTINE,  color: "bg-emerald-500" },
    { label: "MODERATE", count: mix.MODERATE, color: "bg-amber-400" },
    { label: "URGENT",   count: mix.URGENT,   color: "bg-orange-500" },
    { label: "CRITICAL", count: mix.CRITICAL, color: "bg-red-600" },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded bg-slate-100">
        {segs.map((s) => (
          <div
            key={s.label}
            className={s.color}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${s.color}`} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="ml-auto font-mono">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TriageOversight() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<TriageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = (w: number) => {
    setLoading(true);
    setError(null);
    superAdminApi
      .triageOverview(w)
      .then(setOverview)
      .catch((e) => setError(e?.message ?? "Failed to load triage overview"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(days); }, [days]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-60" />
      </div>
    );
  }
  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">{error}</div>;
  if (!overview) return null;

  const t = overview.totals;
  const redFlagRate = t.totalSessions === 0 ? 0 : Math.round((t.redFlagFired / t.totalSessions) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Triage oversight</h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide view of the Triage v2 funnel. Use this to tune weights, spot
            hospitals with high override rates, and audit red-flag firing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border bg-white overflow-hidden">
            {WINDOW_OPTIONS.map((w) => (
              <button
                key={w}
                onClick={() => setDays(w)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  days === w ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => reload(days)}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Activity}       label="Triage sessions"  value={t.totalSessions}           hint={`Window: last ${overview.windowDays} days`} />
        <Metric icon={AlertTriangle}  label="Red-flag forced"  value={t.redFlagFired}            hint={`${redFlagRate}% of sessions`} accent={redFlagRate >= 5} />
        <Metric icon={Clock}          label="Auto-held slots"  value={t.autoHeldSlots}           hint="Reserved on URGENT/CRITICAL" />
        <Metric icon={TrendingUp}     label="Override rate"    value={`${(t.disagreementRate * 100).toFixed(1)}%`} hint={`${t.overridesTotal} clinician overrides`} />
      </div>

      {/* Urgency mix + red-flag type breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Urgency mix (platform)</CardTitle></CardHeader>
          <CardContent>
            <UrgencyBar mix={t.urgencyMix} total={t.totalSessions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Red-flag types matched</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(t.redFlagsByType).length === 0 ? (
              <div className="text-sm text-muted-foreground">No red flags fired in this window.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {Object.entries(t.redFlagsByType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span className="font-mono text-xs">{k}</span>
                      <span className="text-muted-foreground">{v}</span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-hospital table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="h-4 w-4" /> Per-hospital breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overview.perHospital.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hospitals provisioned.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-4">Hospital</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4 text-right">Sessions</th>
                    <th className="py-2 pr-4 text-right">Red flags</th>
                    <th className="py-2 pr-4 text-right">Auto-held</th>
                    <th className="py-2 pr-4 text-right">Re-triaged</th>
                    <th className="py-2 pr-4 text-right">Overrides</th>
                    <th className="py-2 pr-4 text-right">Disagreement</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.perHospital
                    .sort((a, b) => b.totalSessions - a.totalSessions)
                    .map((h) => (
                      <tr key={h.hospital.id} className="border-t">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{h.hospital.name}</div>
                          <div className="text-[11px] text-muted-foreground">{h.hospital.slug}</div>
                        </td>
                        <td className="py-2 pr-4"><Badge variant="outline">{h.hospital.plan}</Badge></td>
                        <td className="py-2 pr-4 text-right font-mono">{h.totalSessions}</td>
                        <td className="py-2 pr-4 text-right font-mono">{h.redFlagFired}</td>
                        <td className="py-2 pr-4 text-right font-mono">{h.autoHeldSlots}</td>
                        <td className="py-2 pr-4 text-right font-mono">
                          {h.reTriaged}
                          {h.escalatedOnReTriage > 0 && (
                            <span className="ml-1 text-[10px] text-red-600">
                              ↑{h.escalatedOnReTriage}
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono">{h.overridesTotal}</td>
                        <td className="py-2 pr-4 text-right font-mono">
                          {(h.disagreementRate * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
