import { useEffect, useState } from "react";
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
import { Link } from "react-router-dom";
import {
  Calendar, Clock, Users, Heart, Trophy, Play, Bell, AlertTriangle, Sparkles, Activity, Video,
} from "lucide-react";
import {
  dashboardSummaryApi,
  TherapistDashboardSummary,
  DoctorAppointmentCard,
} from "@/services/dashboardSummary.service";
import { appointmentsApi } from "@/services/appointments.service";
import TodoPanel from "@/components/todo/TodoPanel";
import { useBranchScope } from "@/hooks/useBranchScope";

function greetingPrefix(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function TherapistDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { branchIdParam } = useBranchScope();
  const [summary, setSummary] = useState<TherapistDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "today">("pending");
  const [availableToday, setAvailableToday] = useState(true);

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
            <Link to="/staff-schedule?tab=attendance"><Button variant="outline" size="sm"><Clock className="w-4 h-4 mr-1" /> Check In / Out</Button></Link>
            <Button
              size="sm"
              variant={availableToday ? "default" : "outline"}
              onClick={() => setAvailableToday(v => !v)}
            >
              {availableToday ? "Available Today" : "Unavailable Today"}
            </Button>
          </div>
        </header>

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
                  onApprove={() => approveAppointment(s.id, true)}
                  onDecline={() => approveAppointment(s.id, false)}
                />
              ))
            ) : (
              summary.sessions.today.length === 0 ? (
                <EmptyState text="No sessions today." />
              ) : summary.sessions.today.map(s => <TodaySessionCard key={s.id} appt={s} />)
            )}
          </div>
        </section>

        {/* SECTION D — Exercise Prescription Tracker */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="font-semibold flex items-center gap-2"><Play className="w-5 h-5 text-primary" /> Exercise Prescriptions</h2>
          </div>
          <div className="divide-y max-h-[350px] overflow-y-auto">
            {summary.exercisePrescriptions.length === 0 ? (
              <EmptyState text="No active exercise prescriptions." />
            ) : summary.exercisePrescriptions.map(p => {
              const rate = p.completionRate;
              const rateColor =
                rate === null ? "text-muted-foreground"
                  : rate < 30 ? "text-red-600"
                    : rate < 60 ? "text-amber-600"
                      : "text-emerald-600";
              return (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{p.patient?.fullName || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.title || "Exercise"} · prescribed {new Date(p.prescribedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className={cn("text-sm font-semibold", rateColor)}>
                    {rate === null ? "—" : `${rate}%`}
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

function PendingSessionCard({ appt, onApprove, onDecline }: { appt: DoctorAppointmentCard; onApprove: () => void; onDecline: () => void }) {
  return (
    <div className="px-5 py-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{appt.patient?.fullName || "Unknown"}</span>
          <Badge variant="outline" className="text-[10px]">{appt.consultationMode}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          Requested for {new Date(appt.date).toLocaleString()}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={onApprove} className="h-8 text-xs">Approve</Button>
        <Button size="sm" variant="outline" onClick={onDecline} className="h-8 text-xs">Decline</Button>
      </div>
    </div>
  );
}

function TodaySessionCard({ appt }: { appt: DoctorAppointmentCard }) {
  const t = new Date(appt.date);
  const diffMin = (t.getTime() - Date.now()) / 60_000;
  const canJoin = appt.consultationMode === "ONLINE" && diffMin >= -15 && diffMin <= 15;
  return (
    <div className="px-5 py-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
  );
}
