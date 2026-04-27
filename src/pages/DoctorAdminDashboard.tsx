import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Activity, AlertTriangle, CheckCircle2, Users, UserPlus, Trophy, Clock,
  Stethoscope, Settings, BarChart3, BellRing, FileText, Share2, HeartPulse,
  TrendingUp,
} from "lucide-react";
import {
  dashboardSummaryApi,
  AdminDoctorDashboardSummary,
} from "@/services/dashboardSummary.service";
import { branchesApi } from "@/services/branches.service";
import TodoPanel, { AssignedByMePanel } from "@/components/todo/TodoPanel";
import { useBranchScope, ALL_BRANCHES } from "@/hooks/useBranchScope";
import { RecognitionPanel } from "@/components/journey-feedback/RecognitionPanel";

function greetingPrefix(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function workloadColor(apptsToday: number) {
  if (apptsToday >= 12) return "bg-red-100 text-red-700";
  if (apptsToday >= 8) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export default function DoctorAdminDashboard() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [summary, setSummary] = useState<AdminDoctorDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const { branchIdParam, setBranchScope } = useBranchScope();
  const branchId = branchIdParam ?? "";
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  async function loadBranches() {
    try {
      const res = await branchesApi.list();
      const items = Array.isArray(res) ? res : (res as { items?: { id: string; name: string }[] }).items || [];
      setBranches(items);
    } catch { /* ignore */ }
  }

  async function refresh() {
    setLoading(true);
    try {
      const data = await dashboardSummaryApi.adminDoctor(branchId || undefined);
      setSummary(data);
    } catch (err) {
      toast({
        title: "Failed to load dashboard",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally { setLoading(false); }
  }

  useEffect(() => { loadBranches(); }, []);
  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  if (loading || !summary) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <DashboardSkeleton />
        </div>
      </AppLayout>
    );
  }

  const name = summary.greeting.name || profile?.full_name || "Admin";

  return (
    <AppLayout>
      <PageTransition className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* SECTION A — Header + Branch Scope Switcher */}
        <header className="flex items-start justify-between flex-wrap gap-3">
          <PageHeader
            title={`${greetingPrefix()}, Dr. ${name}`}
            subtitle={new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          />
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border px-3 text-sm bg-card"
              value={branchId}
              onChange={(e) => setBranchScope(e.target.value || ALL_BRANCHES)}
              title="Admin Doctor can view any branch or all branches"
            >
              <option value="">All Branches (cross-branch)</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Link to="/staff-schedule?tab=attendance"><Button variant="outline" size="sm"><Clock className="w-4 h-4 mr-1" /> Check In/Out</Button></Link>
          </div>
        </header>

        {/* SECTION B — Clinical Operations KPIs. Each card links to the page
            that lets the admin-doctor act on the number. Open Care Gaps and
            Active Journeys link nowhere yet — no dedicated list page for them,
            so leaving them non-clickable is honest. */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard
            title="Appointments Today"
            value={summary.stats.totalAppointmentsToday}
            icon={Stethoscope}
            href="/appointments"
          />
          <StatCard
            title="Approval Backlog"
            value={summary.stats.approvalBacklog}
            icon={AlertTriangle}
            variant="attention"
            href="/appointments?status=PENDING"
          />
          <StatCard title="Open Care Gaps" value={summary.stats.openCareGaps} icon={Activity} variant="risk" />
          <StatCard
            title="Staff On Duty"
            value={summary.stats.staffOnDuty}
            icon={Users}
            href="/staff-activity"
          />
          <StatCard
            title="Unassigned Patients"
            value={summary.stats.unassignedPatients}
            icon={UserPlus}
            variant="attention"
            href="/assign-patient"
          />
          <StatCard title="Active Journeys" value={summary.stats.activeJourneys} icon={CheckCircle2} />
        </section>

        {/* SECTION B2 — Critical Journey CTA. Always rendered so the
            admin-doctor has a consistent place to open the detailed
            list of patients flagged for non-adherence. */}
        <section className={cn(
          "rounded-xl border bg-card shadow-card overflow-hidden",
          (summary.stats.criticalPatients ?? 0) > 0 ? "border-red-200" : "border-emerald-200",
        )}>
          <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0",
                (summary.stats.criticalPatients ?? 0) > 0 ? "bg-red-500" : "bg-emerald-500",
              )}>
                <HeartPulse className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold">Critical Journey</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Patients auto-flagged for missed medications, missed vital uploads, or missed follow-ups.
                </p>
                <p className="text-xs mt-2">
                  <span className={cn(
                    "font-bold text-lg",
                    (summary.stats.criticalPatients ?? 0) > 0 ? "text-red-700" : "text-emerald-700",
                  )}>
                    {summary.stats.criticalPatients ?? 0}
                  </span>{" "}
                  <span className="text-muted-foreground">active critical patient{(summary.stats.criticalPatients ?? 0) === 1 ? "" : "s"}</span>
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link to="/critical-journey">
                <HeartPulse className="w-4 h-4 mr-2" />
                View Critical Patients
              </Link>
            </Button>
          </div>
        </section>

        {/* SECTION C — Staff Overview & Workload.
            Full oversight view: clinical throughput (appts / completion /
            no-show) alongside gamification signals (XP / level) so the
            admin doctor can supervise both dimensions in one place. */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Staff Overview</h2>
            <span className="text-xs text-muted-foreground">{summary.staff.length} clinicians</span>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Role</th>
                  <th className="text-right px-3 py-2 font-medium">Appts Today</th>
                  <th className="text-right px-3 py-2 font-medium">Pending</th>
                  <th className="text-right px-3 py-2 font-medium">Active Patients</th>
                  <th className="text-right px-3 py-2 font-medium">Completed (Mo)</th>
                  <th className="text-right px-3 py-2 font-medium">Completion %</th>
                  <th className="text-right px-3 py-2 font-medium">No-Show %</th>
                  <th className="text-right px-3 py-2 font-medium">XP</th>
                  <th className="text-right px-5 py-2 font-medium">Level</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.staff.map(s => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-5 py-2">{s.name}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">{s.role}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn("inline-block px-2 py-0.5 rounded text-xs", workloadColor(s.appointmentsToday))}>
                        {s.appointmentsToday}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{s.pendingApprovals}</td>
                    <td className="px-3 py-2 text-right">{s.patientLoad}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.monthlyCompleted}
                      <span className="text-xs text-muted-foreground"> / {s.monthlyTotal}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.completionRate === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className={cn(
                          s.completionRate >= 80 ? "text-emerald-600"
                          : s.completionRate >= 60 ? "text-amber-600"
                          : "text-red-600",
                        )}>{s.completionRate}%</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {s.noShowRate === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <span className={cn(s.noShowRate >= 15 ? "text-red-600" : "text-muted-foreground")}>
                          {s.noShowRate}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(s.totalXP ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-2 text-right">
                      {s.title ? (
                        <Badge variant="outline" className="text-[10px]">
                          L{s.level ?? 0} · {s.title}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {summary.staff.length === 0 && (
                  <tr><td colSpan={10} className="px-5 py-8 text-center text-muted-foreground">No clinicians in this scope.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION D — Pending Clinical Decisions */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b">
            <h2 className="font-semibold flex items-center gap-2"><BellRing className="w-5 h-5 text-red-500" /> Pending Clinical Decisions</h2>
          </div>
          <div className="divide-y max-h-[350px] overflow-y-auto">
            {summary.escalations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No escalations awaiting your review.</div>
            ) : summary.escalations.map(e => (
              <div key={e.id} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-red-500 text-white text-[10px]">{e.urgency}</Badge>
                    <span className="text-sm font-medium">{e.patient?.fullName || "Unknown"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.type.replace(/_/g, " ")}{e.suggestedSpecialty ? ` · ${e.suggestedSpecialty}` : ""} · {new Date(e.createdAt).toLocaleString()}
                  </div>
                </div>
                <Link to={`/patients/${e.patient?.id}`}>
                  <Button size="sm" variant="outline" className="h-7 text-xs">Review</Button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION E — Todo Panel with Assignment Capability. Admin doctor
            sees the XP rewards on assigned tasks so they can calibrate
            awards for the clinicians they manage. */}
        <TodoPanel canAssign title="My Tasks" />
        <AssignedByMePanel />

        {/* Public thank-you cards from completed journeys. Self-hides when
            no PUBLIC letters exist in the lookback window. */}
        <RecognitionPanel />

        {/* SECTION F — Performance Analytics (replaces gamification oversight).
            Data-centric view of clinical throughput: top performers by
            completed consults, monthly workload distribution, and the
            operational KPI of delegated-task follow-through. */}
        <section className="rounded-xl border bg-card shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" /> Performance Analytics</h2>
            <Link to="/performance-scorecards" className="text-xs text-primary hover:underline">
              Full scorecards →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Monthly Consults Completed</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {summary.analytics.monthlyCompleted.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground">
                of {summary.analytics.monthlyTotal.toLocaleString()} scheduled
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Completion Rate (Mo)</div>
              <div className={cn(
                "text-2xl font-semibold tabular-nums mt-1",
                summary.analytics.monthlyCompletionRate === null ? ""
                : summary.analytics.monthlyCompletionRate >= 80 ? "text-emerald-600"
                : summary.analytics.monthlyCompletionRate >= 60 ? "text-amber-600"
                : "text-red-600",
              )}>
                {summary.analytics.monthlyCompletionRate === null
                  ? "—"
                  : `${summary.analytics.monthlyCompletionRate}%`}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Completed ÷ scheduled this month
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Task Follow-Through (7d)</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {summary.analytics.todoCompletionRate === null
                  ? "—"
                  : `${summary.analytics.todoCompletionRate}%`}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Delegated tasks completed this week
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Clinicians In Scope</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">
                {summary.staff.length}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Active DOCTOR + THERAPIST staff
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-2">Top Performers — Completed Consults (This Month)</div>
              <div className="space-y-2">
                {summary.analytics.topPerformers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No completed consultations yet this month.</div>
                ) : (
                  summary.analytics.topPerformers.map((e, i) => (
                    <div key={e.userId} className="flex items-center gap-2 text-sm">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{e.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {e.role}{e.completionRate !== null ? ` · ${e.completionRate}% completion` : ""}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {e.monthlyCompleted} consults
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Monthly Workload Distribution</div>
              <div className="space-y-1">
                {(() => {
                  const buckets = summary.analytics.workloadDistribution;
                  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1;
                  if (buckets.every(b => b.count === 0)) {
                    return <div className="text-xs text-muted-foreground">No completed consults to bucket yet.</div>;
                  }
                  return buckets.map(b => (
                    <div key={b.label} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-muted-foreground shrink-0">{b.label}</span>
                      <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/60 transition-all"
                          style={{ width: `${(b.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums">{b.count}</span>
                    </div>
                  ));
                })()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-2">
                Clinicians grouped by consults completed this month
              </div>
            </div>
          </div>
        </section>

        {/* SECTION F2 — Gamification Oversight. Admin doctor supervises the
            engagement program: leaderboard standings, level distribution
            across the org, and delegated-task follow-through. Read-only —
            admin doctor does not earn XP themselves. */}
        <section className="rounded-xl border bg-card shadow-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Trophy className="w-5 h-5 text-primary" /> Gamification Oversight</h2>
            <Link to="/gamification-analytics" className="text-xs text-primary hover:underline">
              View full analytics →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-2">Top 3 Leaderboard</div>
              <div className="space-y-2">
                {summary.gamification.topPodium.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No data yet.</div>
                ) : (
                  summary.gamification.topPodium.slice(0, 3).map((e, i) => (
                    <div key={e.userId} className="flex items-center gap-2 text-sm">
                      <Badge className={cn("h-6 w-6 justify-center p-0 text-white",
                        i === 0 ? "bg-yellow-500" : i === 1 ? "bg-slate-400" : "bg-amber-700")}>
                        {i + 1}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{e.fullName || "Unknown"}</div>
                        {e.title && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            L{e.level} · {e.title}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {(e.totalXP ?? 0).toLocaleString()} XP
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">XP Level Distribution</div>
              <div className="space-y-1">
                {(() => {
                  const sorted = [...summary.gamification.xpDistribution].sort((a, b) => a.level - b.level);
                  const maxCount = sorted.reduce((m, b) => Math.max(m, b.count), 0) || 1;
                  if (sorted.length === 0) {
                    return <div className="text-xs text-muted-foreground">No XP profiles yet.</div>;
                  }
                  return sorted.map(b => (
                    <div key={b.level} className="flex items-center gap-2 text-xs">
                      <span className="w-14 text-muted-foreground shrink-0">Level {b.level}</span>
                      <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/60 transition-all"
                          style={{ width: `${(b.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-right tabular-nums">{b.count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Todo Completion Rate (7d)</div>
              <div className="text-3xl font-semibold tabular-nums">
                {summary.gamification.todoCompletionRate === null
                  ? "—"
                  : `${summary.gamification.todoCompletionRate}%`}
              </div>
              <div className="text-xs text-muted-foreground">
                Across tasks assigned this week.
              </div>
            </div>
          </div>
        </section>

        {/* SECTION G — Reports & Quick Actions */}
        <section className="rounded-xl border bg-card shadow-card p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-primary" /> Quick Reports</h3>
            <div className="space-y-2 text-sm">
              <ReportLink to="/reports?tab=appointments" label="Appointment Summary Today" />
              <ReportLink to="/reports?tab=care-gaps" label="Care Gap Summary" />
              <ReportLink to="/reports?tab=adherence" label="Medication Adherence" />
              <ReportLink to="/reports?tab=revenue" label="Revenue Today" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-2 mb-3"><Settings className="w-4 h-4 text-primary" /> Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <QuickAction to="/assign-patient" icon={UserPlus} label="Assign Patient" />
              <QuickAction to="/create-user" icon={Users} label="Create Staff" />
              <QuickAction to="/skill-matrix" icon={FileText} label="Skill Matrix" />
              <QuickAction to="/performance-scorecards" icon={BarChart3} label="Scorecards" />
              <QuickAction to="/staff-schedule?tab=availability" icon={Clock} label="Availability" />
              <QuickAction to="/resource-sharing" icon={Share2} label="Resource Sharing" />
            </div>
          </div>
        </section>
      </PageTransition>
    </AppLayout>
  );
}

function ReportLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="block px-3 py-2 rounded-md border hover:bg-muted/40 text-sm flex items-center justify-between">
      {label}
      <span className="text-primary text-xs">View →</span>
    </Link>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted/40">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-sm">{label}</span>
    </Link>
  );
}
