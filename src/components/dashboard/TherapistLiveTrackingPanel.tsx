import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  homeTherapyService,
  type HomeTherapySession,
  type HomeTherapySessionStatus,
} from "@/services/homeTherapy.service";
import {
  MapPin,
  RefreshCw,
  Loader2,
  ArrowRight,
  Activity,
} from "lucide-react";

const ACTIVE_STATUSES: HomeTherapySessionStatus[] = [
  "SCHEDULED",
  "THERAPIST_EN_ROUTE",
  "THERAPIST_ARRIVED",
  "IN_SESSION",
];

const STATUS_TONE: Record<HomeTherapySessionStatus, string> = {
  SCHEDULED:          "bg-slate-500 text-white",
  THERAPIST_EN_ROUTE: "bg-amber-500 text-white",
  THERAPIST_ARRIVED:  "bg-blue-600 text-white",
  IN_SESSION:         "bg-emerald-600 text-white",
  COMPLETED:          "bg-emerald-700 text-white",
  CANCELLED:          "bg-slate-400 text-white",
  NO_SHOW:            "bg-red-500 text-white",
};

const STATUS_LABEL: Record<HomeTherapySessionStatus, string> = {
  SCHEDULED:          "Scheduled",
  THERAPIST_EN_ROUTE: "En Route",
  THERAPIST_ARRIVED:  "Arrived",
  IN_SESSION:         "In Session",
  COMPLETED:          "Completed",
  CANCELLED:          "Cancelled",
  NO_SHOW:            "No-Show",
};

const VISIBLE_LIMIT = 5;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface TherapistLiveTrackingPanelProps {
  /** Branch scope from the page-level useBranchScope() hook, or undefined for all branches. */
  branchId?: string;
}

// Dashboard summary card for in-progress home-therapy sessions. Mounts on
// the Admin and Admin-Doctor dashboards as a peer of CriticalJourneySection.
// The full live map lives at /admin/home-therapy/live-map — this panel is a
// glanceable stat + drill-in, not a second map instance.
export default function TherapistLiveTrackingPanel({ branchId }: TherapistLiveTrackingPanelProps) {
  const [sessions, setSessions] = useState<HomeTherapySession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await homeTherapyService.listSessions({
        date: todayKey(),
        branchId,
      });
      const filtered = (rows ?? []).filter(
        (s) => s.mode === "HOME" && ACTIVE_STATUSES.includes(s.status),
      );
      setSessions(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live tracking");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  const total = sessions?.length ?? 0;
  const breakdown = sessions
    ? ACTIVE_STATUSES.map((s) => ({
        status: s,
        count: sessions.filter((row) => row.status === s).length,
      })).filter((b) => b.count > 0)
    : [];

  return (
    <section className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Therapist Live Tracking
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="h-7 px-2 text-xs">
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span className="ml-1.5">Refresh</span>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
            <Link to="/admin/home-therapy/live-map">
              <MapPin className="w-3.5 h-3.5 mr-1" />
              View Live Map
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-2xl font-bold tabular-nums">{total}</span>
          <span className="text-xs text-muted-foreground">
            therapist{total === 1 ? "" : "s"} active right now
          </span>
          {breakdown.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {breakdown.map((b) => (
                <Badge key={b.status} className={cn("text-[10px]", STATUS_TONE[b.status])}>
                  {b.count} {STATUS_LABEL[b.status].toLowerCase()}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : loading && !sessions ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading active sessions…
          </div>
        ) : total === 0 ? (
          <div className="text-sm text-muted-foreground">
            No active home therapy sessions right now.
          </div>
        ) : (
          <ul className="divide-y divide-border/40 -mx-5">
            {sessions!.slice(0, VISIBLE_LIMIT).map((s) => (
              <li
                key={s.id}
                className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/20"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.therapist?.fullName ?? "Therapist"}
                  </div>
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" />
                    {s.patient?.fullName ?? "Patient"}
                  </div>
                </div>
                <Badge className={cn("text-[10px] shrink-0", STATUS_TONE[s.status])}>
                  {STATUS_LABEL[s.status]}
                </Badge>
              </li>
            ))}
            {total > VISIBLE_LIMIT && (
              <li className="px-5 py-2 text-center text-xs text-muted-foreground">
                + {total - VISIBLE_LIMIT} more — open the live map for the full list.
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
