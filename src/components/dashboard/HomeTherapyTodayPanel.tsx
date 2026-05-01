/**
 * Therapist Dashboard — "Today's Home Therapy" panel.
 *
 * Fetches `GET /api/home-therapy/sessions?date=<today>` (the backend forces
 * therapistId = caller for THERAPIST role). Renders each session as an
 * ordered route card sorted by scheduledTime with a 4-step stepper:
 *
 *   Depart → Arrived → In Session → Completed
 *
 * The action button changes based on the current status. On Complete, the
 * parent's `onCompleteSession(session)` callback fires so Task 8's feedback
 * modal can take over.
 *
 * Refreshes itself when the WebSocketContext receives `home_therapy_approved`
 * (admin scheduled a new batch) or `session_status_changed` (defensive — the
 * therapist's own click already updates state, but two devices for the same
 * therapist account stay in sync).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { cn } from "@/lib/utils";
import {
  Home,
  Hospital,
  MapPin,
  Phone,
  CheckCircle2,
  Truck,
  DoorOpen,
  Play,
  Loader2,
  CalendarClock,
  ExternalLink,
  Navigation,
  Route,
} from "lucide-react";
import { getDistance } from "geolib";
import {
  homeTherapyService,
  type HomeTherapySession,
  type HomeTherapySessionStatus,
} from "@/services/homeTherapy.service";

interface HomeTherapyTodayPanelProps {
  /** Called when the therapist taps "Complete" — parent shows the feedback modal. */
  onCompleteSession?: (session: HomeTherapySession) => void;
  /** Called when the active session changes — parent activates the GPS broadcast hook (Task 7). */
  onActiveSessionChange?: (sessionId: string | null) => void;
}

function isoDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return isoDateKey(new Date());
}

function offsetDateKey(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return isoDateKey(d);
}

/** Friendly group header — "Today", "Tomorrow", or "Mon, Apr 30". */
function dateGroupLabel(iso: string): string {
  const tk = todayKey();
  if (iso === tk) return "Today";
  if (iso === offsetDateKey(1)) return "Tomorrow";
  // Parse YYYY-MM-DD as local-noon to dodge timezone drift on the label.
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1, 12);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const SCHEDULE_LOOKAHEAD_DAYS = 7;

function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function composeAddress(p: HomeTherapySession["patient"]) {
  if (!p) return "";
  return [p.addressLine1, p.addressLine2, p.city]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

const STEPS: Array<{ key: string; label: string; icon: typeof Home }> = [
  { key: "depart",   label: "Depart",     icon: Truck },
  { key: "arrive",   label: "Arrived",    icon: DoorOpen },
  { key: "start",    label: "In Session", icon: Play },
  { key: "complete", label: "Completed",  icon: CheckCircle2 },
];

const STEP_INDEX_BY_STATUS: Record<HomeTherapySessionStatus, number> = {
  SCHEDULED: 0,
  THERAPIST_EN_ROUTE: 1,
  THERAPIST_ARRIVED: 2,
  IN_SESSION: 3,
  COMPLETED: 4,
  CANCELLED: 4,
  NO_SHOW: 4,
};

const NEXT_ACTION_BY_STATUS: Record<HomeTherapySessionStatus, "depart" | "arrive" | "start" | "complete" | null> = {
  SCHEDULED:          "depart",
  THERAPIST_EN_ROUTE: "arrive",
  THERAPIST_ARRIVED:  "start",
  IN_SESSION:         "complete",
  COMPLETED:          null,
  CANCELLED:          null,
  NO_SHOW:            null,
};

export default function HomeTherapyTodayPanel({
  onCompleteSession,
  onActiveSessionChange,
}: HomeTherapyTodayPanelProps) {
  const { toast } = useToast();
  const { socket, isConnected } = useWebSocket();
  const [sessions, setSessions] = useState<HomeTherapySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch today + the next week so newly-approved sessions (which now
      // default to today + 2 days) are visible the moment they're created,
      // not only on the day they're scheduled.
      const rows = await homeTherapyService.listSessions({
        from: todayKey(),
        to:   offsetDateKey(SCHEDULE_LOOKAHEAD_DAYS),
      });
      setSessions(Array.isArray(rows) ? rows : []);
    } catch (err) {
      toast({
        title: "Failed to load home therapy schedule",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // Real-time refresh on:
  //   - approval (new sessions land for the therapist),
  //   - admin edit (reassignment / reschedule / add / drop — the new therapist
  //     receives the event for fresh sessions, the old therapist receives it
  //     because the service emits to both userIds),
  //   - session-state changes (e.g. an admin marks a session COMPLETED on
  //     the therapist's behalf from another device).
  useEffect(() => {
    if (!socket || !isConnected) return;
    const onApproved = () => refresh();
    const onEdited = () => refresh();
    const onStatusChanged = () => refresh();
    socket.on("home_therapy_approved", onApproved);
    socket.on("home_therapy_edited",   onEdited);
    socket.on("session_status_changed", onStatusChanged);
    return () => {
      socket.off("home_therapy_approved", onApproved);
      socket.off("home_therapy_edited",   onEdited);
      socket.off("session_status_changed", onStatusChanged);
    };
  }, [socket, isConnected, refresh]);

  // Active session = first non-terminal session in time order. The parent
  // Task 7 hook uses this to start GPS broadcasting only while a session
  // is en-route or in progress.
  const ordered = useMemo(() => {
    return sessions
      .slice()
      .sort((a, b) => {
        // scheduledDate already encodes the day (YYYY-MM-DD UTC); fall back
        // to scheduledTime for tie-breaks.
        const da = new Date(a.scheduledDate).getTime();
        const db = new Date(b.scheduledDate).getTime();
        if (da !== db) return da - db;
        return a.scheduledTime.localeCompare(b.scheduledTime);
      });
  }, [sessions]);

  const activeSessionId = useMemo(() => {
    const active = ordered.find((s) =>
      s.status === "THERAPIST_EN_ROUTE" || s.status === "THERAPIST_ARRIVED" || s.status === "IN_SESSION",
    );
    return active?.id ?? null;
  }, [ordered]);

  useEffect(() => {
    onActiveSessionChange?.(activeSessionId);
  }, [activeSessionId, onActiveSessionChange]);

  // Pre-compute distances between consecutive HOME stops. Distance from the
  // branch is left blank for session 1 since branch coords aren't on the
  // session payload — the spec accepts "from previous session or from branch"
  // and falling back to "—" is honest.
  const distances = useMemo(() => {
    const out: Array<number | null> = [];
    for (let i = 0; i < ordered.length; i += 1) {
      const cur = ordered[i];
      if (cur.mode !== "HOME") { out.push(null); continue; }
      if (cur.patient?.latitude == null || cur.patient?.longitude == null) { out.push(null); continue; }
      // Use the previous HOME session's patient as the origin if available.
      let prev: HomeTherapySession | null = null;
      for (let j = i - 1; j >= 0; j -= 1) {
        if (ordered[j].mode === "HOME" && ordered[j].patient?.latitude != null && ordered[j].patient?.longitude != null) {
          prev = ordered[j];
          break;
        }
      }
      if (!prev) { out.push(null); continue; }
      const meters = getDistance(
        { latitude: prev.patient!.latitude!, longitude: prev.patient!.longitude! },
        { latitude: cur.patient!.latitude!,  longitude: cur.patient!.longitude!  },
      );
      out.push(meters);
    }
    return out;
  }, [ordered]);

  const onAction = useCallback(async (session: HomeTherapySession) => {
    const action = NEXT_ACTION_BY_STATUS[session.status];
    if (!action) return;
    if (action === "complete") {
      // Hand-off to Task 8 — parent owns the feedback modal flow.
      onCompleteSession?.(session);
      return;
    }
    setPending((p) => ({ ...p, [session.id]: true }));
    try {
      let updated: HomeTherapySession;
      if (action === "depart")  updated = await homeTherapyService.depart(session.id);
      else if (action === "arrive") updated = await homeTherapyService.arrive(session.id);
      else                      updated = await homeTherapyService.start(session.id);
      setSessions((prev) => prev.map((s) => (s.id === session.id ? { ...s, ...updated } : s)));
      const label = action === "depart" ? "Departed" : action === "arrive" ? "Arrived" : "Session started";
      toast({ title: label, description: session.patient?.fullName ?? undefined });
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setPending((p) => ({ ...p, [session.id]: false }));
    }
  }, [toast, onCompleteSession]);

  // Group sessions by their scheduled date (YYYY-MM-DD) — keeps "today",
  // "tomorrow", and the rest of the week visually separated even though the
  // backend returns one flat list. The `ordered` array is already sorted
  // ascending by scheduledDate so the resulting groups are also in order.
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, HomeTherapySession[]>();
    for (const s of ordered) {
      const key = isoDateKey(new Date(s.scheduledDate));
      const list = groups.get(key) ?? [];
      list.push(s);
      groups.set(key, list);
    }
    return [...groups.entries()].map(([dateKey, items]) => ({ dateKey, items }));
  }, [ordered]);

  const todaysCount = groupedByDate.find((g) => g.dateKey === todayKey())?.items.length ?? 0;

  const heading = (
    <div className="px-5 py-3 border-b flex items-center justify-between">
      <h2 className="font-semibold flex items-center gap-2">
        <Home className="w-5 h-5 text-primary" />
        Home Therapy schedule
      </h2>
      <span className="text-xs text-muted-foreground">
        {ordered.length} upcoming · {todaysCount} today
      </span>
    </div>
  );

  if (loading) {
    return (
      <section className="rounded-xl border bg-card shadow-card overflow-hidden">
        {heading}
        <div className="p-8 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      </section>
    );
  }

  if (ordered.length === 0) {
    return (
      <section className="rounded-xl border bg-card shadow-card overflow-hidden">
        {heading}
        <div className="p-8 text-center text-sm text-muted-foreground">
          No home therapy sessions scheduled this week.
        </div>
      </section>
    );
  }

  // Map back from the global `ordered` index (used for distance lookup) to
  // each session id. We need this because SessionCard takes `index` from the
  // flat-ordered array and we're now rendering groups.
  const indexById = new Map<string, number>();
  ordered.forEach((s, i) => indexById.set(s.id, i));

  return (
    <section className="rounded-xl border bg-card shadow-card overflow-hidden">
      {heading}
      <div className="max-h-[600px] overflow-y-auto">
        {groupedByDate.map((group) => (
          <div key={group.dateKey}>
            <div className="px-5 py-2 bg-muted/40 border-b border-t flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {dateGroupLabel(group.dateKey)}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {group.items.length} session{group.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="divide-y">
              {group.items.map((s) => {
                const idx = indexById.get(s.id) ?? 0;
                return (
                  <SessionCard
                    key={s.id}
                    index={idx}
                    session={s}
                    distanceMeters={distances[idx]}
                    isActive={s.id === activeSessionId}
                    isPending={!!pending[s.id]}
                    onAction={() => onAction(s)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

interface SessionCardProps {
  index: number;
  session: HomeTherapySession;
  distanceMeters: number | null;
  isActive: boolean;
  isPending: boolean;
  onAction: () => void;
}

function SessionCard({ index, session, distanceMeters, isActive, isPending, onAction }: SessionCardProps) {
  const stepIdx = STEP_INDEX_BY_STATUS[session.status];
  const action  = NEXT_ACTION_BY_STATUS[session.status];
  const isHome  = session.mode === "HOME";
  const address = composeAddress(session.patient);
  const phone   = session.patient?.primaryPhone || session.patient?.alternativePhone || null;
  const lat     = session.patient?.latitude ?? null;
  const lng     = session.patient?.longitude ?? null;
  const directionsHref = isHome && lat != null && lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null;

  const actionLabel = action === "depart"
    ? "Mark Departed"
    : action === "arrive"
      ? "Mark Arrived"
      : action === "start"
        ? "Start Session"
        : action === "complete"
          ? "Complete Session"
          : null;

  return (
    <div className={cn("px-5 py-4 space-y-3", isActive && "bg-primary/5")}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {index + 1}
            </span>
            <span className="font-semibold text-foreground truncate">{session.patient?.fullName ?? "Patient"}</span>
            <Badge
              className={cn(
                "shrink-0 text-[10px]",
                isHome ? "bg-primary text-primary-foreground" : "bg-blue-600 text-white",
              )}
            >
              {isHome ? <Home className="w-3 h-3 mr-1" /> : <Hospital className="w-3 h-3 mr-1" />}
              {isHome ? "HOME" : "HOSPITAL"}
            </Badge>
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <CalendarClock className="w-3.5 h-3.5" />
              {formatTime12h(session.scheduledTime)}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Session {session.sessionNumber}
              {session.request?.totalSessions ? ` of ${session.request.totalSessions}` : ""}
            </span>
          </div>

          {/* Address + phone (HOME only — hospital sessions are at the clinic). */}
          {isHome && (
            <div className="mt-1.5 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-1 text-xs">
              <div className="flex items-start gap-1.5 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-[1px] shrink-0" />
                <span className="break-words">{address || <em>address not set</em>}</span>
              </div>
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="text-primary hover:underline inline-flex items-center gap-1 justify-end"
                >
                  <Phone className="w-3.5 h-3.5" /> {phone}
                </a>
              )}
            </div>
          )}

          {/* Distance from previous home stop. Hospital sessions skip this. */}
          {isHome && distanceMeters !== null && (
            <div className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Route className="w-3 h-3" />
              {(distanceMeters / 1000).toFixed(1)} km from previous stop
            </div>
          )}

          {directionsHref && (
            <a
              href={directionsHref}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Navigation className="w-3.5 h-3.5" />
              Get Directions
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          {actionLabel ? (
            <Button
              size="sm"
              onClick={onAction}
              disabled={isPending}
              className={cn(
                "gap-2 min-w-[150px]",
                action === "depart" && "bg-amber-600 hover:bg-amber-700",
                action === "arrive" && "bg-blue-600 hover:bg-blue-700",
                action === "start"  && "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {actionLabel}
            </Button>
          ) : (
            <Badge variant="outline" className="text-[11px]">
              {session.status.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
      </div>

      {/* Status stepper */}
      <div className="flex items-center gap-1.5 text-[11px]">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const reached = i < stepIdx;
          const isCurrent = i === stepIdx;
          return (
            <div key={step.key} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                  reached
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                      ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                      : "bg-secondary text-muted-foreground",
                )}
                title={step.label}
              >
                <Icon className="w-3 h-3" />
              </div>
              <span className={cn(
                isCurrent ? "text-foreground font-medium" : "text-muted-foreground",
                "hidden sm:inline",
              )}>
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className={cn(
                  "w-4 h-px",
                  reached ? "bg-emerald-500" : "bg-border",
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
