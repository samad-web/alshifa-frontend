import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { PageTransition } from "@/components/ui/page-transition";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Activity, Users, Calendar, DollarSign, ShieldAlert, AlertTriangle, Gift,
  Building2, Clock, UserPlus, Flag, BarChart3, HeartPulse, Bell, RefreshCw, Loader2, Download,
  ChevronLeft, ChevronRight, Stethoscope, HeartHandshake, Pill, ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { StaffOverviewCard } from "@/components/admin/StaffOverviewCard";
import { WorkloadDistributionChart } from "@/components/admin/WorkloadDistributionChart";
import {
  dashboardSummaryApi,
  AdminDashboardSummary,
} from "@/services/dashboardSummary.service";
import TodoPanel, { AssignedByMePanel } from "@/components/todo/TodoPanel";
import TherapistLiveTrackingPanel from "@/components/dashboard/TherapistLiveTrackingPanel";
import { useBranchScope } from "@/hooks/useBranchScope";
import { apiClient } from "@/lib/api-client";
import { iwisApi } from "@/services/iwis.service";
import { describeActivity, formatRelative, type ActivityFeedItem } from "@/lib/auditActivity";
import { AlertsPopup, AlertRow } from "@/components/common/AlertsPopup";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { branchIdParam } = useBranchScope();
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Pagination state for the "Today's Attendance" staff section. Snaps back
  // to page 1 when the branch scope changes (the underlying summary reloads).
  const [attendancePage, setAttendancePage] = useState(1);
  useEffect(() => { setAttendancePage(1); }, [branchIdParam]);
  // Pending diet-package count — surfaced inline as an operational alert so
  // admins immediately see PENDING reviews on dashboard load. Best-effort:
  // silent when the diet-prescription feature flag is off for this hospital.
  const [pendingDietCount, setPendingDietCount] = useState(0);
  useEffect(() => {
    iwisApi.listDietPackages({ status: "PENDING" })
      .then((list) => setPendingDietCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setPendingDietCount(0));
  }, [branchIdParam]);

  // Per-role staff counts powering the "Staff Overview" cards. Fetched
  // alongside the main summary; failures fall back to zeros so a flaky
  // endpoint doesn't blank the whole dashboard.
  const [staffCounts, setStaffCounts] = useState<{
    DOCTOR: number; THERAPIST: number; PHARMACIST: number; ADMIN_DOCTOR: number;
  }>({ DOCTOR: 0, THERAPIST: 0, PHARMACIST: 0, ADMIN_DOCTOR: 0 });
  useEffect(() => {
    apiClient
      .get<{ counts: typeof staffCounts }>("/api/operations/staff-overview")
      .then(({ data }) => setStaffCounts(data.counts))
      .catch(() => { /* leave zeros on failure */ });
  }, [branchIdParam]);

  const handleExportUsers = async () => {
    setExporting(true);
    try {
      const params = branchIdParam ? { branchId: branchIdParam, format: 'csv' } : { format: 'csv' };
      const blob = await apiClient.getBlob('/api/user/export', params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', description: 'CSV download started.' });
    } catch (err) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Could not generate CSV',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  async function refresh() {
    setLoading(true);
    try {
      const data = await dashboardSummaryApi.admin(branchIdParam);
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

  if (loading || !summary) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <DashboardSkeleton />
        </div>
      </AppLayout>
    );
  }

  const greetingPrefix = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const healthStatus = summary.systemHealth.unresolvedAnomalies > 5
    ? "Degraded"
    : "All Systems Operational";
  const healthColor = summary.systemHealth.unresolvedAnomalies > 5
    ? "bg-amber-500"
    : "bg-emerald-500";

  // Client-side pagination for today's attendance roster.
  const ATTENDANCE_PAGE_SIZE = 10;
  const attendanceTotalPages = Math.max(1, Math.ceil(summary.attendance.length / ATTENDANCE_PAGE_SIZE));
  const attendanceSafePage = Math.min(attendancePage, attendanceTotalPages);
  const attendancePageRows = summary.attendance.slice(
    (attendanceSafePage - 1) * ATTENDANCE_PAGE_SIZE,
    attendanceSafePage * ATTENDANCE_PAGE_SIZE,
  );
  const attendanceRangeStart = summary.attendance.length === 0 ? 0 : (attendanceSafePage - 1) * ATTENDANCE_PAGE_SIZE + 1;
  const attendanceRangeEnd = Math.min(attendanceSafePage * ATTENDANCE_PAGE_SIZE, summary.attendance.length);

  return (
    <AppLayout>
      <PageTransition className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* SECTION A — Header + System Status */}
        <header className="flex items-start justify-between flex-wrap gap-3">
          <PageHeader
            title={`${greetingPrefix}, ${summary.greeting.name}`}
            subtitle={new Date().toLocaleString(undefined, { weekday: "long", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          />
          <div className="flex items-center gap-2">
            <AlertsPopup
              title="Operational Alerts"
              alertLabel="Operational Alerts"
              emptyLabel="Operational Alerts"
              count={
                (summary.systemHealth.pendingRewards > 0 ? 1 : 0) +
                (summary.systemHealth.unresolvedAnomalies > 0 ? 1 : 0) +
                (pendingDietCount > 0 ? 1 : 0)
              }
            >
              <AlertRow
                icon={<Gift className="w-4 h-4 text-amber-600" />}
                title="Reward Redemptions Pending"
                detail={`${summary.systemHealth.pendingRewards} waiting for approval`}
                action={<Link to="/reward-store" className="text-xs text-primary hover:underline">Review →</Link>}
                visible={summary.systemHealth.pendingRewards > 0}
              />
              <AlertRow
                icon={<Flag className="w-4 h-4 text-red-600" />}
                title="Gamification Anomalies"
                detail={`${summary.systemHealth.unresolvedAnomalies} flagged for review`}
                action={<Link to="/gamification-analytics" className="text-xs text-primary hover:underline">Investigate →</Link>}
                visible={summary.systemHealth.unresolvedAnomalies > 0}
              />
              <AlertRow
                icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                title="Diet Packages Awaiting Review"
                detail={`${pendingDietCount} diet package${pendingDietCount === 1 ? "" : "s"} pending approval`}
                action={<Link to="/diet-packages" className="text-xs text-primary hover:underline">Review →</Link>}
                visible={pendingDietCount > 0}
              />
            </AlertsPopup>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportUsers}
              disabled={exporting}
              className="gap-2"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export Users
            </Button>
            <Badge className={cn("text-white", healthColor)}>
              <ShieldAlert className="w-3 h-3 mr-1" /> {healthStatus}
            </Badge>
          </div>
        </header>

        {/* SECTION B — System-wide KPIs. Each card links to the full-detail
            page for its metric. Dashboard is for glancing; tap a number to dive. */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard
            title="Total Patients"
            value={summary.stats.totalPatients}
            icon={Users}
            description={summary.stats.newPatientsToday > 0 ? `+${summary.stats.newPatientsToday} today` : undefined}
            href="/manage-users?role=PATIENT"
          />
          <StatCard
            title="Appointments Today"
            value={summary.stats.appointmentsToday}
            icon={Calendar}
            href="/appointments"
          />
          <StatCard
            title="Revenue This Month"
            value={`₹${(summary.stats.revenueThisMonth || 0).toLocaleString()}`}
            icon={DollarSign}
            variant="wellness"
            href="/reports"
          />
          <StatCard
            title="Active Staff"
            value={summary.stats.activeStaff}
            icon={UserPlus}
            href="/staff-activity"
          />
          <StatCard
            title="Outstanding Invoices"
            value={summary.stats.outstandingInvoicesCount}
            icon={AlertTriangle}
            variant="attention"
            description={`₹${(summary.stats.outstandingInvoicesTotal || 0).toLocaleString()}`}
            href="/reports"
          />
          <StatCard
            title="Gamification Anomalies"
            value={summary.systemHealth.unresolvedAnomalies}
            icon={Flag}
            variant="risk"
            href="/gamification-analytics"
          />
        </section>

        {/* SECTION B2 — Staff Overview. Click a card to drill into the role. */}
        <section className="space-y-2">
          <h2 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wide">
            <UserPlus className="w-4 h-4" /> Staff Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StaffOverviewCard role="DOCTOR"        label="Doctors"       count={staffCounts.DOCTOR}       icon={Stethoscope} />
            <StaffOverviewCard role="THERAPIST"     label="Therapists"    count={staffCounts.THERAPIST}    icon={HeartHandshake} />
            <StaffOverviewCard role="PHARMACIST"    label="Pharmacists"   count={staffCounts.PHARMACIST}   icon={Pill} />
            <StaffOverviewCard role="ADMIN_DOCTOR"  label="Admin Doctors" count={staffCounts.ADMIN_DOCTOR} icon={ShieldCheck} />
          </div>
        </section>

        {/* SECTION C — Critical Journey (patients flagged for non-adherence) */}
        <CriticalJourneySection
          total={summary.systemHealth.criticalPatients ?? 0}
          high={summary.systemHealth.criticalPatientsHigh ?? 0}
          medium={summary.systemHealth.criticalPatientsMedium ?? 0}
          low={summary.systemHealth.criticalPatientsLow ?? 0}
        />

        {/* SECTION C1 — Therapist Live Tracking (active home-therapy sessions) */}
        <TherapistLiveTrackingPanel branchId={branchIdParam} />

        {/* SECTION C2 — Operational Alerts moved to popup in header. */}

        {/* SECTION C3 — Recent Activity Feed (system-wide audit-log surface) */}
        <ActivityFeedSection />

        {/* SECTION D — Branch Health */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Building2 className="w-5 h-5 text-primary" /> Branch Health</h2>
            <span className="text-xs text-muted-foreground">{summary.branches.length} branches</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">Branch</th>
                  <th className="text-right px-3 py-2 font-medium">Active Patients</th>
                  <th className="text-right px-3 py-2 font-medium">Staff On Duty</th>
                  <th className="text-right px-3 py-2 font-medium">Appts Today</th>
                  <th className="text-right px-5 py-2 font-medium">Beds</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.branches.map(b => (
                  <tr key={b.id} className="hover:bg-muted/20">
                    <td className="px-5 py-2 font-medium">
                      {b.name}
                      {!b.isActive && <Badge variant="outline" className="ml-2 text-[10px]">Inactive</Badge>}
                    </td>
                    <td className="px-3 py-2 text-right">{b.activePatients}</td>
                    <td className="px-3 py-2 text-right">{b.staffOnDuty}</td>
                    <td className="px-3 py-2 text-right">{b.appointmentsToday}</td>
                    <td className="px-5 py-2 text-right text-xs">
                      {b.bedsAvailable === null ? "—" : `${b.bedsAvailable}/${b.bedsTotal}`}
                    </td>
                  </tr>
                ))}
                {summary.branches.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No branches configured.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION D2 — Monthly Workload Distribution (performance analytics) */}
        <WorkloadDistributionChart />

        {/* SECTION E — Todo Panel with assignment */}
        <TodoPanel canAssign title="My Tasks" />
        <AssignedByMePanel />

        {/* SECTION G — Staff & Attendance Summary */}
        <section className="rounded-xl border bg-card shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Today's Attendance</h2>
            <Link to="/staff-schedule?tab=attendance" className="text-xs text-primary hover:underline">View Full →</Link>
          </div>
          <div className="overflow-x-auto max-h-[350px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Role</th>
                  <th className="text-left px-3 py-2 font-medium">Branch</th>
                  <th className="text-left px-3 py-2 font-medium">In</th>
                  <th className="text-left px-3 py-2 font-medium">Out</th>
                  <th className="text-left px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {attendancePageRows.map(a => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-5 py-2">{a.name}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{a.role}</Badge></td>
                    <td className="px-3 py-2">{a.branch || "—"}</td>
                    <td className="px-3 py-2">{a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString() : "—"}</td>
                    <td className="px-3 py-2">{a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString() : "—"}</td>
                    <td className="px-5 py-2">
                      <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                    </td>
                  </tr>
                ))}
                {summary.attendance.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No attendance records today.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {summary.attendance.length > ATTENDANCE_PAGE_SIZE && (
            <div className="px-5 py-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Showing {attendanceRangeStart}–{attendanceRangeEnd} of {summary.attendance.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
                  disabled={attendanceSafePage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-2 tabular-nums">Page {attendanceSafePage} of {attendanceTotalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setAttendancePage((p) => Math.min(attendanceTotalPages, p + 1))}
                  disabled={attendanceSafePage >= attendanceTotalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      </PageTransition>
    </AppLayout>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

/**
 * Critical Journey section — called out as its own dashboard card so
 * admins can see the count + severity split at a glance and drill into
 * the detailed list page via the CTA. Always visible (even when 0) so
 * admins have a consistent surface to check adherence.
 */
function CriticalJourneySection({ total, high, medium, low }: {
  total: number; high: number; medium: number; low: number;
}) {
  const tone = total === 0 ? "emerald" : high > 0 ? "red" : medium > 0 ? "amber" : "slate";
  const toneClasses = {
    emerald: { ring: "border-emerald-200", pill: "bg-emerald-500", text: "text-emerald-700" },
    red:     { ring: "border-red-200",     pill: "bg-red-500",     text: "text-red-700" },
    amber:   { ring: "border-amber-200",   pill: "bg-amber-500",   text: "text-amber-700" },
    slate:   { ring: "border-slate-200",   pill: "bg-slate-500",   text: "text-slate-700" },
  }[tone];
  return (
    <section className={cn("rounded-xl border bg-card shadow-card overflow-hidden", toneClasses.ring)}>
      <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0", toneClasses.pill)}>
            <HeartPulse className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">Critical Journey</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Patients auto-flagged for missed medications, missed vital uploads, or missed follow-ups.
            </p>
            {total > 0 && (
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className={cn("font-bold text-lg", toneClasses.text)}>{total}</span>
                <span className="text-muted-foreground">active</span>
                <div className="flex items-center gap-2 text-[11px]">
                  {high   > 0 && <Badge className="bg-red-500 text-white">{high} high</Badge>}
                  {medium > 0 && <Badge className="bg-amber-500 text-white">{medium} medium</Badge>}
                  {low    > 0 && <Badge className="bg-slate-500 text-white">{low} low</Badge>}
                </div>
              </div>
            )}
            {total === 0 && (
              <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> No critical patients right now.
              </p>
            )}
          </div>
        </div>
        <Button asChild size="sm" className={total === 0 ? "" : toneClasses.pill.replace("bg-", "hover:bg-")}>
          <Link to="/critical-journey">
            <HeartPulse className="w-4 h-4 mr-2" />
            View Critical Patients
          </Link>
        </Button>
      </div>
    </section>
  );
}

/**
 * Recent Updates / Activity Feed widget.
 *
 * Pulls from /api/audit-logs/recent which surfaces the latest hospital-scoped
 * AuditLog rows. Refreshes on mount and via a 60s polling interval — the
 * polling cadence is conservative so a busy clinic doesn't pay a query cost
 * each second; admins can always hit Refresh manually.
 */
function ActivityFeedSection() {
  const [items, setItems] = useState<ActivityFeedItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<ActivityFeedItem[]>("/api/audit-logs/recent", { limit: 20 });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <section className="rounded-xl border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Recent Updates
        </h2>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="h-7 px-2 text-xs">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span className="ml-1.5">Refresh</span>
        </Button>
      </div>
      <div className="divide-y max-h-[360px] overflow-y-auto">
        {loading && !items ? (
          <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading activity…
          </div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-destructive">{error}</div>
        ) : !items || items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
            No activity recorded yet.
          </div>
        ) : (
          items.map((it) => {
            const { verb, subject } = describeActivity(it);
            return (
              <div key={it.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-muted/20">
                <div className="min-w-0">
                  <div className="text-sm">
                    <span className="font-semibold">{it.actor.name || "System"}</span>
                    <span className="text-muted-foreground"> {verb}</span>
                    {subject && (
                      <span className="text-muted-foreground"> — {subject}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">{it.actor.role}</Badge>
                    <span>· {formatRelative(it.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
