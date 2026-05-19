import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar, Clock, AlertTriangle, Pill, Trophy, CheckCircle2, Users, Users2, Video,
  ChevronRight, ChevronDown, Stethoscope, Activity, Sparkles, MapPin, Loader2,
  UserCheck, PlayCircle, UserX, ListOrdered,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { PageTransition } from "@/components/ui/page-transition";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  dashboardSummaryApi,
  DoctorDashboardSummary,
  DoctorAppointmentCard,
  GroupSessionTask,
} from "@/services/dashboardSummary.service";
import { appointmentsApi } from "@/services/appointments.service";
import { queueApi, type QueueEntry, type ArrivalStatus } from "@/services/queue.service";
import { useQueueSocket } from "@/hooks/useQueueSocket";
import TodoPanel from "@/components/todo/TodoPanel";
import { FollowUpTaskPanel } from "@/components/doctor/FollowUpTaskPanel";
import { SelfExamBundlePanel, urgencyBadge } from "@/components/dashboard/SelfExamBundlePanel";
import { useBranchScope } from "@/hooks/useBranchScope";
import { RecognitionPanel } from "@/components/journey-feedback/RecognitionPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { AlertsPopup } from "@/components/common/AlertsPopup";
import { XPAwardToast } from "@/components/XPAwardToast";

// ── Queue helpers ────────────────────────────────────────────────────────

const ARRIVAL_BADGE_STYLES: Record<ArrivalStatus, string> = {
  NOT_ARRIVED: "bg-slate-100 text-slate-600 border-slate-200",
  ARRIVED: "bg-amber-100 text-amber-800 border-amber-300",
  IN_CONSULTATION: "bg-teal-100 text-teal-800 border-teal-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  ABSENT: "bg-red-100 text-red-700 border-red-300",
  CONTACTED: "bg-blue-100 text-blue-700 border-blue-300",
};

const ARRIVAL_LABELS: Record<ArrivalStatus, string> = {
  NOT_ARRIVED: "Waiting",
  ARRIVED: "Arrived",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
  ABSENT: "Absent",
  CONTACTED: "Contacted",
};

function ArrivalBadge({ status }: { status: ArrivalStatus }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", ARRIVAL_BADGE_STYLES[status])}>
      {ARRIVAL_LABELS[status]}
    </Badge>
  );
}

/** Live ticking elapsed-time string. minute-resolution string update; the
 *  hook re-renders every 30s so "5m" → "6m" without busy work. */
function useTickingMinutes(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  return tick;
}
function formatElapsed(fromIso: string | null): string {
  if (!fromIso) return "—";
  const ms = Date.now() - new Date(fromIso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function greetingPrefix(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { branchIdParam } = useBranchScope();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<DoctorDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTab, setPendingTab] = useState<"pending" | "today">("pending");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Live queue state — entries indexed by appointmentId so the appointment
  // card can render arrival buttons synchronously, and a flat array for
  // the Today's Queue panel listing.
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const data = await dashboardSummaryApi.doctor(branchIdParam);
      setSummary(data);
    } catch (err) {
      toast({
        title: "Failed to load dashboard",
        description: err instanceof Error ? err.message : "Network error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const refreshQueue = useCallback(async () => {
    try {
      const res = await queueApi.getToday(branchIdParam ? { branchId: branchIdParam } : {});
      setQueueEntries(res.data || []);
    } catch {
      // Silent — the queue panel just renders an empty/error state.
    }
  }, [branchIdParam]);

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [branchIdParam]);
  useEffect(() => { refreshQueue(); }, [refreshQueue]);

  // The doctor's queue room id = the doctorId carried on any of today's
  // queue entries. Pulled off the first entry once it's loaded.
  const myDoctorId = queueEntries[0]?.doctorId ?? null;
  const handleQueueEvent = useCallback(() => { refreshQueue(); refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshQueue]);
  useQueueSocket({ doctorId: myDoctorId, onEvent: handleQueueEvent });

  const queueByApptId = useMemo(() => {
    const map: Record<string, QueueEntry> = {};
    for (const e of queueEntries) map[e.appointmentId] = e;
    return map;
  }, [queueEntries]);

  const onMarkArrived = useCallback(async (appointmentId: string) => {
    try {
      await queueApi.markArrived(appointmentId);
      toast({ title: "Patient marked as arrived" });
      await refreshQueue();
    } catch (err) {
      toast({
        title: "Failed to mark arrived",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }, [refreshQueue, toast]);

  const onStartConsultation = useCallback(async (appointmentId: string) => {
    try {
      await queueApi.startConsultation(appointmentId);
      navigate(`/consultation/${appointmentId}`);
    } catch (err) {
      toast({
        title: "Failed to start consultation",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }, [navigate, toast]);

  const onMarkAbsent = useCallback(async (appointmentId: string) => {
    try {
      await queueApi.markAbsent(appointmentId);
      toast({ title: "Patient marked as absent" });
      await refreshQueue();
    } catch (err) {
      toast({
        title: "Failed to mark absent",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }, [refreshQueue, toast]);

  async function approveAppointment(id: string, approve: boolean) {
    try {
      await appointmentsApi.approve(id, {
        status: approve ? "CONFIRMED" : "CANCELLED",
        notes: approve ? undefined : "Declined by doctor",
      });
      toast({ title: approve ? "Appointment approved" : "Appointment declined" });
      refresh();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  if (loading || !summary) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <DashboardSkeleton />
        </div>
      </AppLayout>
    );
  }

  const doctorName = summary.greeting.name || profile?.full_name || "Doctor";

  return (
    <AppLayout>
      {/* Centered XP popup — fires when patient feedback awards XP. */}
      <XPAwardToast />
      <PageTransition className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* SECTION A — Header / Greeting */}
        <header className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <PageHeader
              title={`${greetingPrefix()}, Dr. ${doctorName}`}
              subtitle={`${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}${summary.greeting.branch ? ` • ${summary.greeting.branch}` : ""}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <AlertsPopup
              title="Care Gap Alerts"
              alertLabel="Care Gap Alerts"
              emptyLabel="Care Gap Alerts"
              count={summary.careGaps.length}
              emptyState={
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No active care gap alerts.
                </div>
              }
            >
              {summary.careGaps.map((gap) => (
                <div key={gap.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {urgencyBadge(gap.severity)}
                      <span className="text-sm font-medium truncate">{gap.patient?.fullName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {gap.type.replace(/_/g, " ")} · {gap.daysSince} days since trigger
                      {gap.suggestedSpecialty && ` · suggests ${gap.suggestedSpecialty}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link to={`/patients/${gap.patient?.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </AlertsPopup>
            <Link to="/staff-schedule?tab=availability"><Button variant="outline" size="sm">Availability</Button></Link>
          </div>
        </header>

        {/* SECTION B — Today at a Glance
            Each tile drills into the page that backs the metric. Pending
            Approval pre-selects the PENDING tab on /appointments via the
            ?tab= param; Patients at Risk and Leaderboard route to their
            own pages. Active Prescriptions stays static (no detail view
            distinct from the prescriptions module). */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard title="Appointments Today" value={summary.stats.appointmentsToday} icon={Calendar} href="/appointments" />
          <StatCard title="Pending Approval" value={summary.stats.pendingApproval} icon={AlertTriangle} variant="attention" href="/appointments?tab=pending" />
          <StatCard title="Patients at Risk" value={summary.stats.patientsAtRisk} icon={Activity} variant="risk" href="/patients" />
          <StatCard title="Active Prescriptions" value={summary.stats.activePrescriptions} icon={Pill} href="/prescriptions" />
          <StatCard title="Leaderboard" value={summary.stats.leaderboardRank ? `#${summary.stats.leaderboardRank}` : "—"} icon={Trophy} variant="wellness" href="/doctor-gamification" />
        </section>

        {/* SECTION C — Appointments Queue */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h2 className="font-semibold flex items-center gap-2"><Stethoscope className="w-5 h-5 text-primary" /> Appointments Queue</h2>
            <div className="flex gap-1 bg-muted rounded-md p-0.5">
              <button
                onClick={() => setPendingTab("pending")}
                className={cn("px-3 py-1 text-xs font-medium rounded", pendingTab === "pending" ? "bg-card shadow" : "")}
              >
                Pending Approval ({summary.appointments.pending.length})
              </button>
              <button
                onClick={() => setPendingTab("today")}
                className={cn("px-3 py-1 text-xs font-medium rounded", pendingTab === "today" ? "bg-card shadow" : "")}
              >
                Today's Schedule ({summary.appointments.today.length})
              </button>
            </div>
          </div>
          <div className="divide-y max-h-[450px] overflow-y-auto">
            {pendingTab === "pending" ? (
              summary.appointments.pending.length === 0 ? (
                <EmptyState text="No pending approvals. Your schedule is clear." />
              ) : summary.appointments.pending.map(a => (
                <PendingApprovalCard
                  key={a.id}
                  appt={a}
                  expanded={!!expanded[a.id]}
                  onToggle={() => setExpanded(e => ({ ...e, [a.id]: !e[a.id] }))}
                  onApprove={() => approveAppointment(a.id, true)}
                  onDecline={() => approveAppointment(a.id, false)}
                />
              ))
            ) : (
              summary.appointments.today.length === 0 ? (
                <EmptyState text="No appointments today." />
              ) : summary.appointments.today.map(a => (
                <TodayAppointmentCard
                  key={a.id}
                  appt={a}
                  queueEntry={queueByApptId[a.id] ?? null}
                  onMarkArrived={() => onMarkArrived(a.id)}
                  onStartConsultation={() => onStartConsultation(a.id)}
                  onMarkAbsent={() => onMarkAbsent(a.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* SECTION C2 — Today's Queue (live) ─────────────────────────────
            Compact ordered list mirroring what's in the QueueEntry table
            for this doctor today. Updates in real time via Socket.IO
            (useQueueSocket above re-fetches on every transition event). */}
        <TodayQueuePanel
          entries={queueEntries}
          onMarkArrived={onMarkArrived}
          onStartConsultation={onStartConsultation}
          onMarkAbsent={onMarkAbsent}
        />

        {/* SECTION D — Care Gap Alerts moved to popup in header. */}
        {/* SECTION D2 — Follow-Up Tasks moved into the two-column row below
            (My Tasks ‖ Follow-Up Tasks) to match the Admin Doctor dashboard's
            layout — both task surfaces share the same horizontal band so the
            doctor's morning panel is one glance, not two stacked sections. */}

        {/* SECTION E — Patient Roster */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Patient Roster</h2>
            <Link to="/patients" className="text-xs text-primary hover:underline">View All</Link>
          </div>
          <div className="divide-y max-h-[350px] overflow-y-auto">
            {summary.roster.length === 0 ? (
              <EmptyState text="No active treatment journeys assigned." />
            ) : summary.roster.map(r => (
              <div key={r.journeyId} className="px-5 py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {(r.patient?.fullName || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{r.patient?.fullName || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.condition} · Phase: {r.currentPhase || "—"} · Wellness {Math.round(r.wellnessScore)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link to={`/patients/${r.patient?.id}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">Profile</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION F — My Tasks + Follow-Up Tasks
            Group sessions surface as date-keyed task cards above the freeform
            todo row so the doctor sees their full upcoming load in one place.
            The two-column grid pairs the doctor's freeform My Tasks with the
            auto-generated Follow-Up Tasks (triage swelling/high-pain, post-
            consultation high-pain, low diet adherence, journey activation).
            Mirrors the Admin Doctor dashboard's pairing — stacks on smaller
            screens, side-by-side on lg+. */}
        <GroupSessionsTaskSection sessions={summary.groupSessions || []} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TodoPanel title="My Tasks" />
          <FollowUpTaskPanel />
        </div>

        {/* SECTION F2 — Public thank-you cards from completed journeys.
            Self-hides when no PUBLIC letters exist in the lookback window. */}
        <RecognitionPanel />

        {/* SECTION G — Performance Snapshot */}
        <section className="rounded-xl border bg-card shadow-card p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-primary" /> Performance Snapshot
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricTile label="Appointments this month" value={summary.performance.monthlyCompleted} />
            <MetricTile label="XP earned" value={summary.performance.xp?.totalXP ?? 0} unit="XP" />
            <MetricTile label="Level" value={summary.performance.xp?.title ?? "Intern"} />
            <MetricTile label="Leaderboard" value={summary.stats.leaderboardRank ? `#${summary.stats.leaderboardRank}` : "—"} />
          </div>
          <Link to="/doctor-gamification" className="inline-block mt-4 text-xs text-primary hover:underline">
            View Full Gamification →
          </Link>
        </section>
      </PageTransition>
    </AppLayout>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function MetricTile({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">
        {value}{unit ? <span className="text-xs text-muted-foreground ml-1">{unit}</span> : null}
      </div>
    </div>
  );
}

function PendingApprovalCard({
  appt, expanded, onToggle, onApprove, onDecline,
}: {
  appt: DoctorAppointmentCard;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const tri = appt.triageSession;
  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{appt.patient?.fullName || "Unknown"}</span>
            {tri?.urgencyLevel && urgencyBadge(tri.urgencyLevel)}
            <Badge variant="outline" className="text-[10px]">{appt.consultationMode}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Requested for {new Date(appt.date).toLocaleString()}
            {tri?.suggestedSpecialty && ` · suggests ${tri.suggestedSpecialty}`}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={onApprove} className="h-8 text-xs">Approve</Button>
          <Button size="sm" variant="outline" onClick={onDecline} className="h-8 text-xs">Decline</Button>
        </div>
      </div>
      {tri && (
        <button className="text-xs text-primary hover:underline flex items-center gap-1" onClick={onToggle}>
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Triage details
        </button>
      )}
      {expanded && tri && (
        <div className="rounded bg-muted/40 p-3 text-xs space-y-1">
          <div>Urgency: <span className="font-medium">{tri.urgencyLevel || "—"}</span></div>
          <div>Composite score: {tri.compositeScore?.toFixed(2) || "—"}</div>
          {!!tri.redFlagsMatched?.length && (
            <div className="text-red-600 font-medium">
              Red flags: {tri.redFlagsMatched.join(", ")}
            </div>
          )}
        </div>
      )}
      {expanded && <SelfExamBundlePanel appointmentId={appt.id} />}
    </div>
  );
}

interface TodayAppointmentCardProps {
  appt: DoctorAppointmentCard;
  queueEntry: QueueEntry | null;
  onMarkArrived: () => void;
  onStartConsultation: () => void;
  onMarkAbsent: () => void;
}

function TodayAppointmentCard({
  appt, queueEntry, onMarkArrived, onStartConsultation, onMarkAbsent,
}: TodayAppointmentCardProps) {
  const time = new Date(appt.date);
  const diffMin = (time.getTime() - Date.now()) / 60_000;
  const canJoin = appt.consultationMode === "ONLINE" && diffMin >= -15 && diffMin <= 15;
  const [expanded, setExpanded] = useState(false);

  // Live wait-time tick for ARRIVED patients.
  useTickingMinutes();

  // Queue-driven button matrix: NOT_ARRIVED → Mark Arrived; ARRIVED →
  // Start Consultation (+ allow re-marking absent if patient gave up);
  // IN_CONSULTATION → "Open consultation" deep-link; COMPLETED / ABSENT
  // / CONTACTED → no action, just status badge.
  const arrivalStatus: ArrivalStatus = queueEntry?.arrivalStatus ?? "NOT_ARRIVED";
  const isPast = diffMin < -10; // appointment time has slipped 10+ minutes

  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="text-sm">{appt.patient?.fullName || "Unknown"}</span>
            <Badge variant="outline" className="text-[10px]">{appt.consultationMode}</Badge>
            <ArrivalBadge status={arrivalStatus} />
            {arrivalStatus === "ARRIVED" && queueEntry?.arrivedAt && (
              <span className="text-[10px] text-muted-foreground">
                <Clock className="inline w-3 h-3 mr-0.5" />
                Waiting {formatElapsed(queueEntry.arrivedAt)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {canJoin && appt.meetingLink && (
            <a href={appt.meetingLink} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="h-8 text-xs"><Video className="w-3 h-3 mr-1" /> Join</Button>
            </a>
          )}

          {arrivalStatus === "NOT_ARRIVED" && (
            <>
              <Button size="sm" className="h-8 text-xs" onClick={onMarkArrived}>
                <UserCheck className="w-3 h-3 mr-1" /> Mark Arrived
              </Button>
              {isPast && (
                <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={onMarkAbsent}>
                  <UserX className="w-3 h-3 mr-1" /> Absent
                </Button>
              )}
            </>
          )}

          {arrivalStatus === "ARRIVED" && (
            <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700" onClick={onStartConsultation}>
              <PlayCircle className="w-3 h-3 mr-1" /> Start Consultation
            </Button>
          )}

          {arrivalStatus === "IN_CONSULTATION" && (
            <Link to={`/consultation/${appt.id}`}>
              <Button size="sm" className="h-8 text-xs bg-teal-600 hover:bg-teal-700">
                <Stethoscope className="w-3 h-3 mr-1" /> Open consultation
              </Button>
            </Link>
          )}

          {arrivalStatus === "CONTACTED" && (
            <Button size="sm" className="h-8 text-xs" onClick={onMarkArrived}>
              <UserCheck className="w-3 h-3 mr-1" /> They've Arrived
            </Button>
          )}
        </div>
      </div>
      <button
        className="text-xs text-primary hover:underline flex items-center gap-1"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Pre-consultation kit
      </button>
      {expanded && <SelfExamBundlePanel appointmentId={appt.id} />}
    </div>
  );
}

// ── Today's Queue Panel ──────────────────────────────────────────────────
// Compact ordered list of the doctor's queue for the day. Mirrors the
// data the admin Live Queue Board sees, but scoped to this doctor only.
function TodayQueuePanel({
  entries,
  onMarkArrived,
  onStartConsultation,
  onMarkAbsent,
}: {
  entries: QueueEntry[];
  onMarkArrived: (id: string) => void;
  onStartConsultation: (id: string) => void;
  onMarkAbsent: (id: string) => void;
}) {
  useTickingMinutes(); // re-render every 30s for live elapsed text

  return (
    <section className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <h2 className="font-semibold flex items-center gap-2">
          <ListOrdered className="w-5 h-5 text-primary" /> Today's Queue
        </h2>
        <Badge variant="outline" className="text-[10px]">{entries.length} total</Badge>
      </div>
      {entries.length === 0 ? (
        <EmptyState text="No queue entries yet today." />
      ) : (
        <div className="divide-y max-h-[360px] overflow-y-auto">
          {entries.map((e) => {
            const time = new Date(e.appointment.date);
            const elapsedFrom = e.arrivalStatus === "ARRIVED" ? e.arrivedAt
              : e.arrivalStatus === "IN_CONSULTATION" ? e.consultationStartedAt
                : null;
            return (
              <div key={e.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {e.queuePosition}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{e.appointment.patient?.fullName || "Unknown"}</span>
                      <ArrivalBadge status={e.arrivalStatus} />
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {elapsedFrom && (
                        <>
                          <span>·</span>
                          <span>
                            {e.arrivalStatus === "IN_CONSULTATION" ? "In session" : "Waiting"} {formatElapsed(elapsedFrom)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {e.arrivalStatus === "NOT_ARRIVED" && (
                    <>
                      <Button size="sm" className="h-7 text-[11px]" onClick={() => onMarkArrived(e.appointmentId)}>
                        <UserCheck className="w-3 h-3 mr-1" /> Arrived
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onMarkAbsent(e.appointmentId)}>
                        <UserX className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                  {e.arrivalStatus === "ARRIVED" && (
                    <Button size="sm" className="h-7 text-[11px] bg-teal-600 hover:bg-teal-700" onClick={() => onStartConsultation(e.appointmentId)}>
                      <PlayCircle className="w-3 h-3 mr-1" /> Start
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Group Sessions Task Section ─────────────────────────────────────
// Renders upcoming group therapy sessions as task cards within the
// doctor's "My Tasks" surface. Visually distinguished from individual
// appointment cards via a teal-bordered card style + people icon, and
// sorted chronologically by date+time.

const SESSION_STATUS_BADGE: Record<GroupSessionTask["status"], string> = {
  OPEN:      "bg-teal-100 text-teal-800 border-teal-300",
  FULL:      "bg-amber-100 text-amber-800 border-amber-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  CANCELLED: "bg-red-100 text-red-800 border-red-300",
};

function formatDateDDMMYYYY(iso: string, time?: string): string {
  // Expected output: DD/MM/YYYY HH:MM. The session's `date` is a full ISO
  // datestamp and `startTime` is HH:MM so we combine them rather than rely
  // on the time embedded in `date` (which is set by the server at midnight).
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const t = time && /^\d{2}:\d{2}$/.test(time)
    ? time
    : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${dd}/${mm}/${yyyy} ${t}`;
}

function GroupSessionsTaskSection({ sessions }: { sessions: GroupSessionTask[] }) {
  const [rosterId, setRosterId] = useState<string | null>(null);
  // Defensive sort — backend already returns chronologically but a re-sort
  // here lets the section co-exist with future task types without depending
  // on backend ordering guarantees.
  const sorted = [...sessions].sort((a, b) => {
    const ta = new Date(a.date).getTime() + minutesFromTime(a.startTime);
    const tb = new Date(b.date).getTime() + minutesFromTime(b.startTime);
    return ta - tb;
  });

  if (sorted.length === 0) {
    // Render nothing when there's no data — the existing TodoPanel below
    // already supplies a "My Tasks" surface, so an empty group-session card
    // would be visual noise.
    return null;
  }

  return (
    <section className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Users2 className="w-5 h-5 text-teal-600" /> Scheduled Group Sessions
          <Badge variant="outline" className="ml-2">{sorted.length}</Badge>
        </h2>
        <Link to="/group-sessions" className="text-xs text-primary hover:underline">View all</Link>
      </div>
      <div className="divide-y">
        {sorted.map((s) => (
          <div
            key={s.id}
            className="px-5 py-3 border-l-4 border-l-teal-500 bg-teal-50/40 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Users2 className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="font-medium text-sm truncate">{s.title}</span>
                  <Badge variant="outline" className="text-[10px] border-teal-300 text-teal-700 bg-white">
                    {s.sessionType}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[10px]", SESSION_STATUS_BADGE[s.status])}>
                    {s.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDateDDMMYYYY(s.date, s.startTime)}
                    {s.endTime ? <span className="opacity-60"> – {s.endTime}</span> : null}
                  </span>
                  {s.room?.name && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {s.room.name}
                    </span>
                  )}
                  {s.therapist?.fullName && (
                    <span className="inline-flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" /> {s.therapist.fullName}
                    </span>
                  )}
                </div>
                <CapacityBar enrolled={s.enrolledCount} max={s.maxCapacity} />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-teal-300 text-teal-700 hover:bg-teal-100"
                onClick={() => setRosterId(s.id)}
              >
                <Users className="w-3 h-3 mr-1" /> View Roster
              </Button>
            </div>
          </div>
        ))}
      </div>

      <GroupSessionRosterDialog
        sessionId={rosterId}
        onClose={() => setRosterId(null)}
      />
    </section>
  );
}

function minutesFromTime(t?: string): number {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return 0;
  const [h, m] = t.split(":").map(Number);
  return ((h || 0) * 60 + (m || 0)) * 60_000;
}

function CapacityBar({ enrolled, max }: { enrolled: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((enrolled / max) * 100)) : 0;
  const tone = pct >= 100 ? "bg-amber-500" : pct >= 80 ? "bg-orange-500" : "bg-teal-500";
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-0.5">
        <span>{enrolled} / {max} enrolled</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Roster modal — fetched lazily when a session is selected. The roster
// endpoint returns the full GroupSession + appointments + nested patient,
// so we destructure the appointments list for the table view.
interface RosterAppointmentRow {
  id: string;
  status: string;
  patient: {
    id: string;
    fullName: string | null;
    // Human-readable identifier — distinct from `id` (UUID).
    patientId: string | null;
    phoneNumber: string | null;
  } | null;
}

interface RosterResponse {
  id: string;
  title: string;
  sessionType: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  maxCapacity: number;
  appointments: RosterAppointmentRow[];
  therapist?: { fullName: string | null } | null;
  room?: { name: string | null } | null;
}

function GroupSessionRosterDialog({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<RosterResponse>(`/api/group-sessions/${sessionId}/roster`)
      .then(({ data }) => {
        if (cancelled) return;
        setData(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load roster");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <Dialog open={!!sessionId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="w-4 h-4 text-teal-600" />
            {data?.title || "Group Session Roster"}
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${formatDateDDMMYYYY(data.date, data.startTime)} · ${data.appointments.length} / ${data.maxCapacity} enrolled${data.room?.name ? ` · ${data.room.name}` : ""}`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading roster…
          </div>
        )}
        {error && !loading && (
          <div className="rounded-md bg-destructive/5 border border-destructive/30 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && data && (
          data.appointments.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No patients enrolled yet.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Patient</th>
                    <th className="text-left px-3 py-2 font-medium">Patient ID</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.appointments.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2">{row.patient?.fullName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground font-mono text-xs">
                        {row.patient?.patientId || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

// SelfExamBundlePanel + urgencyBadge are now shared from
// @/components/dashboard/SelfExamBundlePanel so DoctorDashboard and
// TherapistDashboard render identical pre-consultation kits.
