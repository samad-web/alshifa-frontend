import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  Calendar, Clock, AlertTriangle, Pill, Trophy, CheckCircle2, Users, Users2, Video,
  ChevronRight, ChevronDown, Stethoscope, Activity, Sparkles, MapPin, Loader2,
} from "lucide-react";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { PageTransition } from "@/components/ui/page-transition";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  dashboardSummaryApi,
  DoctorDashboardSummary,
  DoctorAppointmentCard,
  GroupSessionTask,
} from "@/services/dashboardSummary.service";
import { appointmentsApi } from "@/services/appointments.service";
import TodoPanel from "@/components/todo/TodoPanel";
import { selfExamService, type SelfExamBundle } from "@/services/selfExam.service";
import { BundleView } from "@/components/selfexam/BundleView";
import { ClipboardList } from "lucide-react";
import { useBranchScope } from "@/hooks/useBranchScope";
import { RecognitionPanel } from "@/components/journey-feedback/RecognitionPanel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";

function greetingPrefix(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function urgencyBadge(level?: string | null) {
  if (!level) return null;
  const map: Record<string, string> = {
    CRITICAL: "bg-red-600 text-white",
    URGENT: "bg-red-500 text-white",
    HIGH: "bg-orange-500 text-white",
    MODERATE: "bg-yellow-500 text-white",
    LOW: "bg-emerald-500 text-white",
  };
  return <Badge className={cn("text-[10px]", map[level] ?? "bg-slate-400 text-white")}>{level}</Badge>;
}

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { branchIdParam } = useBranchScope();
  const [summary, setSummary] = useState<DoctorDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingTab, setPendingTab] = useState<"pending" | "today">("pending");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [careGapsOpen, setCareGapsOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await dashboardSummaryApi.doctor(branchIdParam);
      setSummary(data);
      const hasHigh = (data.careGaps || []).some(g => g.severity === "URGENT" || g.severity === "CRITICAL" || g.severity === "HIGH");
      setCareGapsOpen(hasHigh);
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

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [branchIdParam]);

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
            <Link to="/staff-schedule?tab=availability"><Button variant="outline" size="sm">Availability</Button></Link>
          </div>
        </header>

        {/* SECTION B — Today at a Glance */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard title="Appointments Today" value={summary.stats.appointmentsToday} icon={Calendar} />
          <StatCard title="Pending Approval" value={summary.stats.pendingApproval} icon={AlertTriangle} variant="attention" />
          <StatCard title="Patients at Risk" value={summary.stats.patientsAtRisk} icon={Activity} variant="risk" />
          <StatCard title="Active Prescriptions" value={summary.stats.activePrescriptions} icon={Pill} />
          <StatCard title="Leaderboard" value={summary.stats.leaderboardRank ? `#${summary.stats.leaderboardRank}` : "—"} icon={Trophy} variant="wellness" />
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
              ) : summary.appointments.today.map(a => <TodayAppointmentCard key={a.id} appt={a} />)
            )}
          </div>
        </section>

        {/* SECTION D — Care Gap Alerts */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <button
            onClick={() => setCareGapsOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3 border-b hover:bg-muted/30"
          >
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" /> Care Gap Alerts
              <Badge variant="outline" className="ml-2">{summary.careGaps.length}</Badge>
            </h2>
            {careGapsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {careGapsOpen && (
            <div className="divide-y">
              {summary.careGaps.length === 0 ? (
                <EmptyState text="No active care gap alerts." />
              ) : summary.careGaps.map(gap => (
                <div key={gap.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {urgencyBadge(gap.severity)}
                      <span className="text-sm font-medium">{gap.patient?.fullName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {gap.type.replace(/_/g, " ")} · {gap.daysSince} days since trigger
                      {gap.suggestedSpecialty && ` · suggests ${gap.suggestedSpecialty}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link to={`/patients/${gap.patient?.id}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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

        {/* SECTION F — My Tasks (group sessions + todos)
            Group sessions surface as date-keyed task cards above the freeform
            todo list so the doctor sees their full upcoming load in one place. */}
        <GroupSessionsTaskSection sessions={summary.groupSessions || []} />
        <TodoPanel title="My Tasks" />

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

function TodayAppointmentCard({ appt }: { appt: DoctorAppointmentCard }) {
  const time = new Date(appt.date);
  const diffMin = (time.getTime() - Date.now()) / 60_000;
  const canJoin = appt.consultationMode === "ONLINE" && diffMin >= -15 && diffMin <= 15;
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="text-sm">{appt.patient?.fullName || "Unknown"}</span>
            <Badge variant="outline" className="text-[10px]">{appt.consultationMode}</Badge>
            <Badge className="text-[10px]">{appt.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canJoin && appt.meetingLink && (
            <a href={appt.meetingLink} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="h-8 text-xs"><Video className="w-3 h-3 mr-1" /> Join</Button>
            </a>
          )}
          <Link to={`/appointments/${appt.id}`}>
            <Button size="sm" variant="outline" className="h-8 text-xs">Start</Button>
          </Link>
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

// ── Self-Exam Bundle Panel ───────────────────────────────────────────
// Renders the patient's pre-consultation bundle inline on the expanded
// appointment card. Silently hides on 404 (no bundle for this appointment).
function SelfExamBundlePanel({ appointmentId }: { appointmentId: string }) {
  const [bundle, setBundle] = useState<SelfExamBundle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    selfExamService
      .getByAppointment(appointmentId)
      .then((b) => {
        if (cancelled) return;
        setBundle(b);
        setState("ready");
      })
      .catch((err: { status?: number }) => {
        if (cancelled) return;
        if (err?.status === 404) setState("none");
        else setState("error");
      });
    return () => { cancelled = true; };
  }, [appointmentId]);

  if (state === "loading") {
    return (
      <div className="rounded bg-muted/40 p-3 text-xs text-muted-foreground">
        Loading self-exam bundle…
      </div>
    );
  }
  if (state === "none" || state === "error" || !bundle) return null;

  const { submission, completion } = bundle;
  const pct = completion.totalCount === 0
    ? 0
    : Math.round((completion.completedCount / completion.totalCount) * 100);
  return (
    <div className="rounded border bg-background p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ClipboardList className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Self-Exam Bundle</span>
        <Badge variant={submission.status === "SUBMITTED" ? "default" : "secondary"}>
          {submission.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {completion.completedCount}/{completion.totalCount} ({pct}%)
        </span>
      </div>
      <BundleView bundle={bundle} />
    </div>
  );
}
