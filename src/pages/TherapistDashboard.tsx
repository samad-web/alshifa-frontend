import { useEffect, useState } from "react";
import {
  Dialog as PermissionDialog,
  DialogContent as PermissionDialogContent,
  DialogHeader as PermissionDialogHeader,
  DialogTitle as PermissionDialogTitle,
  DialogDescription as PermissionDialogDescription,
  DialogFooter as PermissionDialogFooter,
} from "@/components/ui/dialog";
import { MapPin } from "lucide-react";
import { useLocationBroadcast } from "@/hooks/useLocationBroadcast";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar, Users, Heart, Trophy, Play, Bell, AlertTriangle, Sparkles, Activity, Video,
  ChevronDown, ChevronRight, Clock, ArrowRight,
} from "lucide-react";
import {
  dashboardSummaryApi,
  TherapistDashboardSummary,
  DoctorAppointmentCard,
} from "@/services/dashboardSummary.service";
import { appointmentsApi } from "@/services/appointments.service";
import { therapySessionApi } from "@/services/therapySession.service";
import type { TherapySession } from "@/types";
import TodoPanel from "@/components/todo/TodoPanel";
import { useBranchScope } from "@/hooks/useBranchScope";
import { RecognitionPanel } from "@/components/journey-feedback/RecognitionPanel";
import { SelfExamBundlePanel, urgencyBadge } from "@/components/dashboard/SelfExamBundlePanel";
import HomeTherapyTodayPanel from "@/components/dashboard/HomeTherapyTodayPanel";
import { TherapistCompleteSessionModal } from "@/components/HomeTherapySessionFeedback";
import type { HomeTherapySession } from "@/services/homeTherapy.service";

function greetingPrefix(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function TherapistDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { branchIdParam } = useBranchScope();
  const [summary, setSummary] = useState<TherapistDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "today">("pending");
  const [availableToday, setAvailableToday] = useState(true);
  // Active in-progress therapy session (Phase A workspace). Resolves to null
  // when the therapist has no resumable session — surfaces a banner above the
  // session queue so they can jump back in with one click.
  const [activeSession, setActiveSession] = useState<TherapySession | null>(null);
  // Tracks which appointment is mid-START so we can disable the button
  // while the POST is in flight (and avoid double-creates if the user
  // clicks twice — though the backend's @unique on appointmentId is the
  // authoritative guard).
  const [startingAppointmentId, setStartingAppointmentId] = useState<string | null>(null);
  // Per-card expand state for triage details / pre-consultation kit on pending
  // session cards. Mirrors the doctor dashboard pattern so the therapist sees
  // the same depth of context before approving a session.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Active home-therapy session: GPS broadcast is bound to this. The
  // HomeTherapyTodayPanel reports the active sessionId via callback, and
  // the useLocationBroadcast hook watches the device GPS and POSTs each
  // fix to /api/home-therapy/sessions/:id/location-ping.
  const [activeHomeSessionId, setActiveHomeSessionId] = useState<string | null>(null);
  // Session targeted by the "Complete Session" modal. The therapist
  // confirms in step 1, the backend marks the session COMPLETED, then
  // step 2 collects feedback. Setting null closes the modal.
  const [completeTarget, setCompleteTarget] = useState<HomeTherapySession | null>(null);
  const [homeRefreshKey, setHomeRefreshKey] = useState(0);
  const { permissionState, requestPermission } = useLocationBroadcast({
    active: !!activeHomeSessionId,
    sessionId: activeHomeSessionId,
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  // Surface the modal automatically when the therapist marks a session
  // en-route but the browser has denied location access.
  useEffect(() => {
    if (activeHomeSessionId && (permissionState === "denied" || permissionState === "unsupported")) {
      setShowPermissionModal(true);
    } else {
      setShowPermissionModal(false);
    }
  }, [activeHomeSessionId, permissionState]);

  async function refresh() {
    setLoading(true);
    try {
      const data = await dashboardSummaryApi.therapist(branchIdParam);
      setSummary(data);
    } catch (err) {
      toast({
        title: "Failed to load dashboard",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [branchIdParam]);

  // Resume banner: poll once on mount for any IN_PROGRESS session owned by
  // the caller. Branch scope doesn't apply — a therapist only ever has one
  // session in flight, regardless of which branch the navbar is filtered to.
  useEffect(() => {
    let cancelled = false;
    therapySessionApi.getActive()
      .then((s) => { if (!cancelled) setActiveSession(s); })
      .catch(() => { /* silent — banner just won't render */ });
    return () => { cancelled = true; };
  }, []);

  async function startSession(appointmentId: string) {
    setStartingAppointmentId(appointmentId);
    try {
      const session = await therapySessionApi.start(appointmentId);
      navigate(`/therapist/sessions/${session.id}`);
    } catch (err) {
      toast({
        title: "Couldn't start session",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
      setStartingAppointmentId(null);
    }
  }

  async function approveAppointment(id: string, approve: boolean) {
    try {
      await appointmentsApi.approve(id, {
        status: approve ? "CONFIRMED" : "CANCELLED",
        notes: approve ? undefined : "Declined by therapist",
      });
      toast({ title: approve ? "Session approved" : "Session declined" });
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

  const therapistName = summary.greeting.name || profile?.full_name || "Therapist";

  return (
    <AppLayout>
      <PageTransition className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* SECTION A — Header */}
        <header className="flex items-start justify-between flex-wrap gap-3">
          <PageHeader
            title={`${greetingPrefix()}, ${therapistName}`}
            subtitle={`${new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}${summary.greeting.branch ? ` • ${summary.greeting.branch}` : ""}`}
          />
          <div className="flex items-center gap-2">
            {/* Attendance is owned by ADMIN / ADMIN_DOCTOR / BRANCH_ADMIN —
                clinicians no longer self-clock from their dashboard. */}
            <Button
              size="sm"
              variant={availableToday ? "default" : "outline"}
              onClick={() => setAvailableToday(v => !v)}
            >
              {availableToday ? "Available Today" : "Unavailable Today"}
            </Button>
          </div>
        </header>

        {/* Resume in-progress session banner — only renders if the therapist
            walked away from a workspace with status IN_PROGRESS. Clicking
            "Resume" re-opens the workspace; the session keeps ticking from
            its original startedAt regardless of where they were. */}
        {activeSession && activeSession.status === "IN_PROGRESS" && (
          <section
            className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-3 flex items-center justify-between gap-3"
            role="status"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  Session in progress
                  {activeSession.patient?.fullName && ` — ${activeSession.patient.fullName}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  Started {new Date(activeSession.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate(`/therapist/sessions/${activeSession.id}`)}
            >
              Resume <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </section>
        )}

        {/* SECTION B — Today at a Glance */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard title="Sessions Today" value={summary.stats.sessionsToday} icon={Calendar} />
          <StatCard title="Pending Approval" value={summary.stats.pendingApproval} icon={AlertTriangle} variant="attention" />
          <StatCard title="Active Patients" value={summary.stats.activePatients} icon={Users} />
          <StatCard title="Prescriptions for Review" value={summary.stats.prescriptionsDueReview} icon={Activity} variant="risk" />
          <StatCard title="Leaderboard" value={summary.stats.leaderboardRank ? `#${summary.stats.leaderboardRank}` : "—"} icon={Trophy} variant="wellness" />
        </section>

        {/* SECTION C — Session Queue */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <h2 className="font-semibold flex items-center gap-2"><Heart className="w-5 h-5 text-primary" /> Session Queue</h2>
            <div className="flex gap-1 bg-muted rounded-md p-0.5">
              <button
                onClick={() => setTab("pending")}
                className={cn("px-3 py-1 text-xs font-medium rounded", tab === "pending" ? "bg-card shadow" : "")}
              >
                Pending Approval ({summary.sessions.pending.length})
              </button>
              <button
                onClick={() => setTab("today")}
                className={cn("px-3 py-1 text-xs font-medium rounded", tab === "today" ? "bg-card shadow" : "")}
              >
                Today's Sessions ({summary.sessions.today.length})
              </button>
            </div>
          </div>
          <div className="divide-y max-h-[450px] overflow-y-auto">
            {tab === "pending" ? (
              summary.sessions.pending.length === 0 ? (
                <EmptyState text="No pending session requests." />
              ) : summary.sessions.pending.map(s => (
                <PendingSessionCard
                  key={s.id}
                  appt={s}
                  expanded={!!expanded[s.id]}
                  onToggle={() => setExpanded(e => ({ ...e, [s.id]: !e[s.id] }))}
                  onApprove={() => approveAppointment(s.id, true)}
                  onDecline={() => approveAppointment(s.id, false)}
                />
              ))
            ) : (
              summary.sessions.today.length === 0 ? (
                <EmptyState text="No sessions today." />
              ) : summary.sessions.today.map(s => (
                <TodaySessionCard
                  key={s.id}
                  appt={s}
                  starting={startingAppointmentId === s.id}
                  // Pass the active session id only when it points at this
                  // card's appointment, so the card can swap "Start" for
                  // "Resume" without each card needing its own fetch.
                  resumeSessionId={
                    activeSession?.appointmentId === s.id && activeSession.status === "IN_PROGRESS"
                      ? activeSession.id
                      : null
                  }
                  onStartSession={() => startSession(s.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* SECTION C2 — Today's Home Therapy.
            Listed sessions come from the home-therapy approval flow (admin
            schedules them after a doctor's referral). The panel handles
            the full Depart → Arrived → In Session → Completed lifecycle.
            On Complete, Task 8's feedback modal will be triggered via the
            `onCompleteSession` callback (TODO once Task 8 lands). */}
        <HomeTherapyTodayPanel
          key={homeRefreshKey}
          onActiveSessionChange={setActiveHomeSessionId}
          onCompleteSession={(s) => setCompleteTarget(s)}
        />

        {/* Therapist completion + feedback modal (Task 8). On submit we
            bump the panel's key to force a refresh — the next-session
            card in the modal already pre-fetched the next stop, but the
            schedule list also needs to reflect the COMPLETED status. */}
        <TherapistCompleteSessionModal
          session={completeTarget}
          onClose={() => setCompleteTarget(null)}
          onComplete={() => setHomeRefreshKey((k) => k + 1)}
        />

        {/* Permission modal — surfaces when GPS is needed but denied. */}
        <PermissionDialog open={showPermissionModal} onOpenChange={setShowPermissionModal}>
          <PermissionDialogContent>
            <PermissionDialogHeader>
              <PermissionDialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Enable Location Access
              </PermissionDialogTitle>
              <PermissionDialogDescription>
                Location access is required for home therapy sessions. Please enable location in your browser settings, then click "I've enabled it" to retry.
              </PermissionDialogDescription>
            </PermissionDialogHeader>
            <PermissionDialogFooter>
              <Button variant="outline" onClick={() => setShowPermissionModal(false)}>Dismiss</Button>
              <Button onClick={() => { requestPermission(); setShowPermissionModal(false); }}>
                I've enabled it
              </Button>
            </PermissionDialogFooter>
          </PermissionDialogContent>
        </PermissionDialog>

        {/* SECTION D — Exercise Prescription Tracker */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="font-semibold flex items-center gap-2"><Play className="w-5 h-5 text-primary" /> Exercise Prescriptions</h2>
          </div>
          <div className="divide-y max-h-[350px] overflow-y-auto">
            {summary.exercisePrescriptions.length === 0 ? (
              <EmptyState text="No active exercise prescriptions." />
            ) : summary.exercisePrescriptions.map(p => {
              // "Patient progress" = the patient's active-journey wellnessScore,
              // surfaced here so the therapist can spot patients drifting
              // before chasing each individual exercise log.
              const score = p.wellnessScore;
              const scoreColor =
                score === null ? "text-muted-foreground"
                  : score < 30 ? "text-red-600"
                    : score < 60 ? "text-amber-600"
                      : "text-emerald-600";
              return (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{p.patient?.fullName || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.title || "Exercise"} · prescribed {new Date(p.prescribedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <div className={cn("text-sm font-semibold leading-none", scoreColor)}>
                      {score === null ? "—" : `${score}%`}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
                      Wellness
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => toast({ title: "Reminder queued", description: `Sent to ${p.patient?.fullName}` })}>
                    <Bell className="w-3 h-3 mr-1" /> Remind
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION F — Todo Panel (Section E is rolled into rehab via exercise tracker + journey progress in roster above) */}
        <TodoPanel title="My Tasks" />

        {/* Public thank-you cards from completed journeys. Self-hides when
            no PUBLIC letters exist in the lookback window. */}
        <RecognitionPanel />

        {/* SECTION G — Performance Snapshot */}
        <section className="rounded-xl border bg-card shadow-card p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Sparkles className="w-5 h-5 text-primary" /> Performance Snapshot</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricTile label="Sessions this month" value={summary.performance.completedThisMonth} />
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

function PendingSessionCard({
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

function TodaySessionCard({
  appt,
  starting,
  resumeSessionId,
  onStartSession,
}: {
  appt: DoctorAppointmentCard;
  starting: boolean;
  /** When non-null, this card renders a "Resume" link to the workspace
   *  instead of "Start" / "Open" — i.e. an in-progress session is keyed
   *  to this appointment. */
  resumeSessionId: string | null;
  onStartSession: () => void;
}) {
  const t = new Date(appt.date);
  const diffMin = (t.getTime() - Date.now()) / 60_000;
  const canJoin = appt.consultationMode === "ONLINE" && diffMin >= -15 && diffMin <= 15;
  // CONFIRMED + SCHEDULED are the dashboard's "ready to start" states.
  // IN_PROGRESS gets the Resume link via `resumeSessionId`. Anything else
  // (COMPLETED, CANCELLED) falls through to a generic "Open" link.
  const canStartSession = appt.status === "CONFIRMED" || appt.status === "SCHEDULED";
  const tri = appt.triageSession;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="text-sm">{appt.patient?.fullName || "Unknown"}</span>
            {tri?.urgencyLevel && urgencyBadge(tri.urgencyLevel)}
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
          {resumeSessionId ? (
            <Link to={`/therapist/sessions/${resumeSessionId}`}>
              <Button size="sm" className="h-8 text-xs">Resume</Button>
            </Link>
          ) : canStartSession ? (
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={starting}
              onClick={onStartSession}
            >
              {starting ? "Starting…" : "Start Session"}
            </Button>
          ) : (
            <Link to={`/appointments/${appt.id}`}>
              <Button size="sm" variant="outline" className="h-8 text-xs">Open</Button>
            </Link>
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
