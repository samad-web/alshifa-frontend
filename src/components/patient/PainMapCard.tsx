import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PainRegion {
  region: string;
  intensity: number;
  character: string;
  duration: string;
  addedAt: string;
}

interface PainMapCardProps {
  /** Clinician view: pass the patient's id. Patient self view: omit. */
  patientId?: string;
  className?: string;
}

function severityClasses(n: number): { bar: string; label: string } {
  if (n > 6) return { bar: "bg-rose-500",   label: "text-rose-700" };
  if (n >= 4) return { bar: "bg-amber-500", label: "text-amber-700" };
  return { bar: "bg-emerald-500", label: "text-emerald-700" };
}

function formatRelativeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function PainMapCard({ patientId, className }: PainMapCardProps) {
  const [regions, setRegions] = useState<PainRegion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setForbidden(false);

    const path = patientId
      ? `/api/patients/${patientId}/pain-map`
      : `/api/patient/pain/my-map`;

    apiClient
      .get<{ regions: PainRegion[] }>(path)
      .then(({ data }) => {
        if (!cancelled) setRegions(data.regions);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 403) {
          setForbidden(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load pain map");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [patientId]);

  // 403 → render nothing. The card simply doesn't show for unauthorized callers.
  if (forbidden) return null;

  const lastUpdated = regions && regions.length > 0
    ? regions.reduce((latest, r) => (new Date(r.addedAt) > new Date(latest) ? r.addedAt : latest), regions[0].addedAt)
    : null;

  return (
    <div className={cn("rounded-2xl border bg-card shadow-card overflow-hidden", className)}>
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Pain Map
        </h3>
        {lastUpdated && (
          <span className="text-[11px] text-muted-foreground">
            Updated {formatRelativeShort(lastUpdated)}
          </span>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !regions || regions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No pain regions logged.</p>
        ) : (
          <ul className="space-y-2.5">
            {regions.map((r) => {
              const sev = severityClasses(r.intensity);
              const pct = Math.max(0, Math.min(100, (r.intensity / 10) * 100));
              return (
                <li key={r.region} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate pr-2">{r.region}</span>
                    <span className={cn("font-semibold tabular-nums", sev.label)}>
                      {r.intensity.toFixed(0)}/10
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full transition-all", sev.bar)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {(r.character || r.duration) && (
                    <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                      {r.character && <span>{r.character}</span>}
                      {r.duration && <span>· {r.duration}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
