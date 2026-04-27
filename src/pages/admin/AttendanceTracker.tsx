import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { operationsApi } from "@/services/operations.service";
import { apiClient } from "@/lib/api-client";
import type {
  StaffAttendanceEntry, AttendanceStats, AttendanceStatus,
  ClinicianCalendar, CalendarDay, BranchCalendar,
} from "@/types";
import {
  Loader2, LogIn, LogOut, CalendarDays, Clock, AlertTriangle,
  CheckCircle, XCircle, Users, Home, PlaneTakeoff, RefreshCw, Pencil, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { useBranchScope } from "@/hooks/useBranchScope";

const statusColors: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-500",
  LATE: "bg-yellow-500",
  ABSENT: "bg-red-500",
  HALF_DAY: "bg-blue-500",
  LEAVE: "bg-purple-500",
  WFH: "bg-sky-500",
};

const statusBadgeStyles: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-800 border-green-300",
  LATE: "bg-yellow-100 text-yellow-800 border-yellow-300",
  ABSENT: "bg-red-100 text-red-800 border-red-300",
  HALF_DAY: "bg-blue-100 text-blue-800 border-blue-300",
  LEAVE: "bg-purple-100 text-purple-800 border-purple-300",
  WFH: "bg-sky-100 text-sky-800 border-sky-300",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatTime(dateStr?: string | null) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Heatmap tint for appointment counts — lightweight visual for workload. 0→none,
// 1-3→low, 4-7→medium, 8+→high. Kept terse on purpose; tune thresholds later.
function workloadTint(total: number) {
  if (total === 0) return "";
  if (total <= 3) return "bg-emerald-50 dark:bg-emerald-950/30";
  if (total <= 7) return "bg-amber-50 dark:bg-amber-950/30";
  return "bg-rose-50 dark:bg-rose-950/30";
}

export default function AttendanceTracker({ embedded = false }: { embedded?: boolean } = {}) {
  const { role, profile } = useAuth();
  const { branches } = useBranches();
  const { confirm, dialog: confirmDialog } = useConfirm();
  // Branch is read from the global navbar selector. We fall back to the
  // first branch in the user's list when the navbar is set to "All branches"
  // because the per-branch attendance views require a concrete branchId.
  const { branchIdParam } = useBranchScope();
  const isBranchAdmin = role === "BRANCH_ADMIN";
  // BRANCH_ADMIN shares the admin view (set attendance, view branch list, etc.)
  // — the difference is they have no personal clock-in/out card and they're
  // pinned to their JWT branchId rather than picking from the navbar.
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR" || isBranchAdmin;

  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [branchAttendance, setBranchAttendance] = useState<StaffAttendanceEntry[]>([]);
  const [punctuality, setPunctuality] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Unified per-clinician calendar (schedule + leave/WFH + attendance + workload).
  const [calendar, setCalendar] = useState<ClinicianCalendar | null>(null);
  // Branch-wide workload heatmap (admin only).
  const [branchCalendar, setBranchCalendar] = useState<BranchCalendar | null>(null);

  // Admin attendance edit dialog.
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    mode: 'edit' | 'create';
    userId: string;
    fullName: string;
    date: string;
    clockIn: string;
    clockOut: string;
    status: AttendanceStatus | '';
    notes: string;
  }>({ open: false, mode: 'edit', userId: '', fullName: '', date: selectedDate, clockIn: '', clockOut: '', status: '', notes: '' });
  const [editing, setEditing] = useState(false);
  // Roster of clinicians at the selected branch — used for the "Add" flow.
  const [roster, setRoster] = useState<Array<{ id: string; fullName: string; type: 'Doctor' | 'Therapist' }>>([]);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth()); // 0-indexed

  const fetchMyData = useCallback(async () => {
    // BRANCH_ADMIN has no Doctor/Therapist profile, so the personal stats
    // and calendar endpoints don't apply — skip them and let the branch
    // tab populate instead.
    if (isBranchAdmin) {
      setStats(null);
      setCalendar(null);
      setLoading(false);
      return;
    }
    try {
      const startDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
      const daysInMonth = getDaysInMonth(calYear, calMonth);
      const endDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${daysInMonth}`;
      const [attendanceStats, calendarResult] = await Promise.all([
        operationsApi.getMyAttendanceStats({ startDate, endDate }),
        operationsApi.getClinicianCalendar({ year: calYear, month: calMonth + 1 }),
      ]);
      setStats(attendanceStats);
      setCalendar(calendarResult);
    } catch {
      setError("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [calYear, calMonth, isBranchAdmin]);

  useEffect(() => {
    fetchMyData();
  }, [fetchMyData]);

  // Admin — fetch branch snapshot + monthly heatmap together.
  const refreshBranchData = useCallback(() => {
    if (!branchId) return;
    operationsApi.getBranchAttendance(branchId, { date: selectedDate })
      .then(setBranchAttendance)
      .catch(() => {});
    operationsApi.getPunctualityReport(branchId)
      .then((data: any) => setPunctuality(Array.isArray(data) ? data : []))
      .catch(() => {});
    operationsApi.getBranchCalendar(branchId, { year: calYear, month: calMonth + 1 })
      .then(setBranchCalendar)
      .catch(() => setBranchCalendar(null));
  }, [branchId, selectedDate, calYear, calMonth]);

  useEffect(() => {
    if (!isAdmin) return;
    refreshBranchData();
  }, [isAdmin, refreshBranchData]);

  // Roster — doctors + therapists for the active branch. Used by the
  // "Set Attendance" dialog when admin creates a record for someone who
  // hasn't clocked in yet. Pulls the branch-scoped list endpoints so the
  // dropdown can never be polluted with staff from a different branch.
  useEffect(() => {
    if (!isAdmin || !branchId) { setRoster([]); return; }
    Promise.all([
      apiClient.get<any[]>('/api/user/list-doctors', { branchId }),
      apiClient.get<any[]>('/api/user/list-therapists', { branchId }),
    ]).then(([{ data: docs }, { data: thers }]) => {
      const rows = [
        ...docs.map((d: any) => ({
          id: d.user?.id || d.userId,
          fullName: d.fullName || d.user?.email || 'Doctor',
          branchId: d.user?.branchId || d.branchId,
          type: 'Doctor' as const,
        })),
        ...thers.map((t: any) => ({
          id: t.user?.id || t.userId,
          fullName: t.fullName || t.user?.email || 'Therapist',
          branchId: t.user?.branchId || t.branchId,
          type: 'Therapist' as const,
        })),
      ]
        // Prefer rows that belong to the active branch, but keep rows whose
        // branchId is missing (some legacy records carry no branchId on the
        // profile row even when the user is assigned). Without this fallback
        // the dropdown silently went empty.
        .filter((r) => r.id && (!r.branchId || r.branchId === branchId));
      setRoster(rows);
    }).catch(() => setRoster([]));
  }, [isAdmin, branchId]);

  // Sync branch from the navbar scope. Falls back to first branch when
  // "All branches" is active so the per-branch views always have a target.
  // BRANCH_ADMIN is hard-pinned to their own JWT branchId — they have no
  // navbar switcher, and the backend would reject a different branch anyway.
  useEffect(() => {
    if (isBranchAdmin) {
      const ownBranch = profile?.branchId ?? null;
      if (ownBranch) setBranchId(ownBranch);
      return;
    }
    if (!isAdmin) return;
    if (branchIdParam) { setBranchId(branchIdParam); return; }
    if ((branches as any[]).length > 0 && !branchId) {
      setBranchId((branches as any[])[0].id);
    }
  }, [branches, isAdmin, isBranchAdmin, profile?.branchId, branchIdParam, branchId]);

  const handleClockIn = async () => {
    setClockingIn(true);
    try {
      await operationsApi.clockIn();
      toast.success("Clocked in");
      await fetchMyData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to clock in");
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    setClockingOut(true);
    try {
      await operationsApi.clockOut();
      toast.success("Clocked out");
      await fetchMyData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to clock out");
    } finally {
      setClockingOut(false);
    }
  };

  const handleReconcile = async () => {
    if (!branchId) return;
    setReconciling(true);
    try {
      const result = await operationsApi.reconcileAttendance(branchId);
      toast.success(`Reconciled ${result.date}: ${result.absent} absent, ${result.leave} leave, ${result.wfh} WFH`);
      refreshBranchData();
    } catch {
      toast.error("Failed to reconcile attendance");
    } finally {
      setReconciling(false);
    }
  };

  const toHHmm = (iso?: string | null) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '');

  const openEditDialog = (row: StaffAttendanceEntry) => {
    setEditDialog({
      open: true,
      mode: 'edit',
      userId: row.userId,
      fullName: row.fullName || row.userId.slice(0, 8),
      date: row.date.split('T')[0],
      clockIn: toHHmm(row.clockIn),
      clockOut: toHHmm(row.clockOut),
      status: row.status,
      notes: row.notes || '',
    });
  };

  const openAddDialog = () => {
    setEditDialog({
      open: true,
      mode: 'create',
      userId: '',
      fullName: '',
      date: selectedDate,
      clockIn: '',
      clockOut: '',
      status: '',
      notes: '',
    });
  };

  const closeEditDialog = () => setEditDialog((d) => ({ ...d, open: false }));

  const handleSaveAttendance = async () => {
    if (!editDialog.userId) {
      toast.error('Select a staff member');
      return;
    }
    if (!editDialog.date) {
      toast.error('Date is required');
      return;
    }
    if (editDialog.clockOut && !editDialog.clockIn) {
      toast.error('Clock-out requires clock-in');
      return;
    }
    if (editDialog.clockIn && editDialog.clockOut && editDialog.clockIn >= editDialog.clockOut) {
      toast.error('Clock-in must be before clock-out');
      return;
    }
    setEditing(true);
    try {
      await operationsApi.setAttendance(editDialog.userId, {
        date: editDialog.date,
        clockIn:  editDialog.clockIn  || undefined,
        clockOut: editDialog.clockOut || undefined,
        status:   editDialog.status   || undefined,
        notes:    editDialog.notes    || undefined,
      });
      toast.success(editDialog.mode === 'edit' ? 'Attendance updated' : 'Attendance recorded');
      closeEditDialog();
      refreshBranchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save attendance');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteAttendance = async (row: StaffAttendanceEntry) => {
    const ok = await confirm({
      title: "Delete attendance record?",
      description: `Removes the attendance entry for ${row.fullName || row.userId.slice(0, 8)} on ${row.date.split('T')[0]}. The status will revert to "no record" until reconciliation runs.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await operationsApi.deleteAttendance(row.userId, row.date.split('T')[0]);
      toast.success('Attendance deleted');
      refreshBranchData();
    } catch {
      toast.error('Failed to delete attendance');
    }
  };

  // Index calendar days by date-key for fast lookup in the month grid below.
  const calendarByDate = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    calendar?.days.forEach((d) => map.set(d.date, d));
    return map;
  }, [calendar]);

  // Monthly totals for the quick-stat strip at the top.
  const monthTotals = useMemo(() => {
    if (!calendar) return { appts: 0, leaveDays: 0, wfhDays: 0 };
    return calendar.days.reduce(
      (acc, d) => ({
        appts: acc.appts + d.appointments.total,
        leaveDays: acc.leaveDays + (d.leaveToday ? 1 : 0),
        wfhDays: acc.wfhDays + (d.wfhToday ? 1 : 0),
      }),
      { appts: 0, leaveDays: 0, wfhDays: 0 }
    );
  }, [calendar]);

  // Today's record — drives the prominent "Currently clocked in" indicator
  // and the disabled state of the Clock In / Clock Out buttons. Falls
  // through to the active month's calendar so we don't have to issue an
  // extra request for the same row we already loaded.
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRecord = calendar?.days.find((d) => d.date === todayKey)?.attendance ?? null;
  const isClockedIn = !!todayRecord?.clockIn && !todayRecord?.clockOut;
  const isClockedOut = !!todayRecord?.clockIn && !!todayRecord?.clockOut;
  const workedMinutes = useMemo(() => {
    if (!todayRecord?.clockIn) return 0;
    const end = todayRecord.clockOut ? new Date(todayRecord.clockOut).getTime() : Date.now();
    return Math.max(0, Math.round((end - new Date(todayRecord.clockIn).getTime()) / 60000));
  }, [todayRecord]);
  const workedLabel = (() => {
    const h = Math.floor(workedMinutes / 60);
    const m = workedMinutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDayOfWeek = new Date(calYear, calMonth, 1).getDay();

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  if (loading) {
    const spinner = (
      <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Attendance...</p>
        </div>
      </div>
    );
    return embedded ? spinner : <AppLayout>{spinner}</AppLayout>;
  }

  const body = (
    <>
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Clock In/Out — prominent state indicator + buttons that respect the
          backend rules (cannot clock in twice, cannot clock out without a
          prior clock-in). Worked-time recomputes locally each render so the
          counter ticks while the user is clocked in. Hidden for BRANCH_ADMIN —
          they have no clinician profile and shouldn't be clocking themselves in. */}
      {!isBranchAdmin && (
      <Card className="border-none shadow-sm">
        <CardContent className="py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border ${
                  isClockedIn
                    ? "bg-green-50 text-green-700 border-green-200"
                    : isClockedOut
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${
                  isClockedIn ? "bg-green-500 animate-pulse"
                    : isClockedOut ? "bg-blue-500"
                    : "bg-muted-foreground/50"
                }`} />
                {isClockedIn
                  ? `Clocked in at ${formatTime(todayRecord?.clockIn)} · ${workedLabel}`
                  : isClockedOut
                  ? `Clocked out · worked ${workedLabel}`
                  : "Not clocked in"}
              </span>
              {todayRecord && (
                <Badge variant="outline" className={statusBadgeStyles[todayRecord.status]}>
                  {todayRecord.status.replace("_", " ")}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleClockIn}
                disabled={clockingIn || isClockedIn || isClockedOut}
                className="gap-2"
                title={isClockedIn ? "Already clocked in today" : isClockedOut ? "Already clocked out for today" : undefined}
              >
                {clockingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Clock In
              </Button>
              <Button
                onClick={handleClockOut}
                disabled={clockingOut || !isClockedIn}
                variant="outline"
                className="gap-2"
                title={!isClockedIn ? "Clock in first" : undefined}
              >
                {clockingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Clock Out
              </Button>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Late</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Half Day</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Leave</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> WFH</span>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Present" value={stats.presentDays} icon={CheckCircle} variant="wellness" />
          <StatCard title="Late" value={stats.lateDays} icon={Clock} variant="attention" />
          <StatCard title="Absent" value={stats.absentDays} icon={XCircle} variant="risk" />
          <StatCard title="WFH" value={stats.wfhDays ?? 0} icon={Home} />
          <StatCard title="Leave" value={stats.leaveDays ?? 0} icon={PlaneTakeoff} />
          <StatCard title="Avg Late (min)" value={stats.avgLateMinutes} icon={AlertTriangle} />
        </div>
      )}

      {/* Unified calendar — schedule + leave/WFH + attendance + workload.
          BRANCH_ADMIN has no personal calendar to show. */}
      {!isBranchAdmin && (
      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              My Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth}>&larr;</Button>
              <span className="text-sm font-semibold w-32 text-center">
                {new Date(calYear, calMonth).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
              <Button variant="outline" size="sm" onClick={nextMonth}>&rarr;</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
            <span>{monthTotals.appts} appointments this month</span>
            <span>{monthTotals.leaveDays} leave day{monthTotals.leaveDays === 1 ? "" : "s"}</span>
            <span>{monthTotals.wfhDays} WFH day{monthTotals.wfhDays === 1 ? "" : "s"}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-[10px] font-bold text-muted-foreground py-1 uppercase">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const cell = calendarByDate.get(dateKey);
              const total = cell?.appointments.total ?? 0;
              const status = cell?.attendance?.status ?? null;
              const leave = cell?.leaveToday;
              const wfh = cell?.wfhToday;
              const hasSchedule = cell?.hasSchedule ?? false;

              return (
                <div
                  key={day}
                  title={
                    cell
                      ? [
                          cell.schedule ? `Scheduled ${cell.schedule.start}–${cell.schedule.end}` : 'Off day',
                          status ? `Status: ${status}` : null,
                          leave ? 'On leave' : null,
                          wfh ? 'Work from home' : null,
                          total > 0
                            ? `${total} appointments (${cell.appointments.morning}M / ${cell.appointments.afternoon}A / ${cell.appointments.evening}E)`
                            : null,
                        ].filter(Boolean).join(' • ')
                      : ''
                  }
                  className={`relative flex flex-col items-stretch p-2 rounded-lg border text-left min-h-[68px] transition-colors ${
                    workloadTint(total)
                  } ${
                    leave ? 'border-purple-300' : wfh ? 'border-sky-300' : 'border-transparent'
                  } ${hasSchedule ? '' : 'opacity-60'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{day}</span>
                    {status && (
                      <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-1 text-[10px] font-semibold">
                    {total > 0 ? (
                      <span className="text-foreground">{total}📅</span>
                    ) : <span />}
                    {leave && <span className="text-purple-600">Leave</span>}
                    {!leave && wfh && <span className="text-sky-600">WFH</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Admin: Branch Attendance */}
      {isAdmin && (
        <>
          <Card className="border-none shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Branch Attendance
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {(branches as any[]).find((b: any) => b.id === branchId)?.name || "—"}
                    {!isBranchAdmin && " · switch via navbar"}
                  </span>
                </CardTitle>
                <div className="flex items-center gap-3">
                  <DatePicker
                    value={selectedDate}
                    onChange={(iso) => setSelectedDate(iso)}
                    className="h-10 w-[170px]"
                  />
                  {!isBranchAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReconcile}
                      disabled={reconciling || !branchId}
                      className="gap-2"
                      title="Convert planned leave / WFH blocks and no-show shifts into attendance rows for yesterday."
                    >
                      {reconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      Reconcile
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {branchAttendance.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No attendance records for this date.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Late (min)</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branchAttendance.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.fullName || a.userId.slice(0, 8)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadgeStyles[a.status]}>
                              {a.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatTime(a.clockIn)}</TableCell>
                          <TableCell>{formatTime(a.clockOut)}</TableCell>
                          <TableCell>{a.scheduledStart ? `${a.scheduledStart}${a.scheduledEnd ? `–${a.scheduledEnd}` : ''}` : '--'}</TableCell>
                          <TableCell>
                            {a.lateMinutes > 0 ? (
                              <span className="text-yellow-600 font-semibold">{a.lateMinutes}</span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(a)}
                                title="Edit clock-in / clock-out"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteAttendance(a)}
                                title="Delete attendance record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Branch workload heatmap — rows = clinicians, cols = days */}
          {branchCalendar && branchCalendar.rows.length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Branch Workload Heatmap
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {new Date(calYear, calMonth).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-[2px]">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-semibold text-muted-foreground pr-3 sticky left-0 bg-background">Clinician</th>
                      {Array.from({ length: daysInMonth }).map((_, i) => (
                        <th key={i} className="text-[10px] font-semibold text-muted-foreground w-7 text-center">{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {branchCalendar.rows.map((row) => (
                      <tr key={row.userId}>
                        <td className="text-xs font-medium pr-3 whitespace-nowrap sticky left-0 bg-background">{row.fullName}</td>
                        {row.days.map((d) => {
                          const border = d.leaveToday ? 'ring-1 ring-purple-400'
                            : d.wfhToday ? 'ring-1 ring-sky-400'
                            : '';
                          const dot = d.attendanceStatus ? statusColors[d.attendanceStatus] : '';
                          return (
                            <td
                              key={d.date}
                              title={`${d.date} • ${d.appointments} appts${d.leaveToday ? ' • Leave' : d.wfhToday ? ' • WFH' : ''}${d.attendanceStatus ? ' • ' + d.attendanceStatus : ''}`}
                              className={`relative w-7 h-7 text-[10px] font-semibold text-center rounded ${workloadTint(d.appointments)} ${border}`}
                            >
                              {d.appointments > 0 ? d.appointments : ''}
                              {dot && (
                                <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${dot}`} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Number = appointments that day. Dot = attendance status. Purple ring = leave, sky ring = WFH.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Punctuality Report */}
          {punctuality.length > 0 && (
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Punctuality Report
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {punctuality.map((p: any, i: number) => {
                    const maxLate = Math.max(...punctuality.map((x: any) => x.totalLateMinutes || x.lateMinutes || 0), 1);
                    const val = p.totalLateMinutes || p.lateMinutes || 0;
                    const pct = (val / maxLate) * 100;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-40 text-sm font-medium truncate">{p.fullName || p.name || `Staff ${i + 1}`}</div>
                        <div className="flex-1 h-4 bg-secondary/20 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${val > 30 ? "bg-red-400" : val > 15 ? "bg-yellow-400" : "bg-green-400"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-24 text-right text-xs font-semibold text-muted-foreground">
                          {val} min · {typeof p.punctualityRate === 'number' ? `${p.punctualityRate}%` : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin override dialog — set / edit clock-in / clock-out for any clinician */}
          <Dialog open={editDialog.open} onOpenChange={(o) => !o && closeEditDialog()}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>
                  {editDialog.mode === 'edit' ? `Edit Attendance — ${editDialog.fullName}` : 'Set Attendance'}
                </DialogTitle>
                <DialogDescription>
                  Status is re-derived from the clinician's schedule and worked hours unless you force one below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                {editDialog.mode === 'create' && (
                  <div className="space-y-2">
                    <Label>Staff member</Label>
                    <SearchableSelect
                      value={editDialog.userId}
                      onChange={(v) => {
                        const r = roster.find((x) => x.id === v);
                        setEditDialog((d) => ({ ...d, userId: v, fullName: r?.fullName || '' }));
                      }}
                      placeholder={roster.length === 0 ? "No doctors / therapists in this branch" : "Select doctor or therapist"}
                      searchPlaceholder="Search staff…"
                      items={roster.map((r) => ({ value: r.id, label: `${r.fullName} (${r.type})` }))}
                    />
                    {roster.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Switch the branch in the navbar or assign clinicians to this branch in <span className="font-semibold">Manage Users</span>.
                      </p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <DatePicker
                      value={editDialog.date}
                      onChange={(iso) => setEditDialog((d) => ({ ...d, date: iso }))}
                      disabled={editDialog.mode === 'edit'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status override</Label>
                    <Select
                      value={editDialog.status || 'AUTO'}
                      onValueChange={(v) => setEditDialog((d) => ({ ...d, status: v === 'AUTO' ? '' : (v as AttendanceStatus) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO">Auto (derive from times)</SelectItem>
                        <SelectItem value="PRESENT">Present</SelectItem>
                        <SelectItem value="LATE">Late</SelectItem>
                        <SelectItem value="HALF_DAY">Half day</SelectItem>
                        <SelectItem value="ABSENT">Absent</SelectItem>
                        <SelectItem value="LEAVE">Leave</SelectItem>
                        <SelectItem value="WFH">WFH</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Clock in</Label>
                    <TimePicker
                      value={editDialog.clockIn}
                      onChange={(hhmm) => setEditDialog((d) => ({ ...d, clockIn: hhmm }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Clock out</Label>
                    <TimePicker
                      value={editDialog.clockOut}
                      onChange={(hhmm) => setEditDialog((d) => ({ ...d, clockOut: hhmm }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    placeholder="e.g. Off-site training, ran to emergency"
                    value={editDialog.notes}
                    onChange={(e) => setEditDialog((d) => ({ ...d, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeEditDialog} disabled={editing}>Cancel</Button>
                <Button onClick={handleSaveAttendance} disabled={editing} className="gap-2">
                  {editing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editDialog.mode === 'edit' ? 'Save Changes' : 'Record Attendance'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
      {confirmDialog}
    </>
  );

  if (embedded) return body;

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Attendance Tracker"
          subtitle="Clock in/out, monitor punctuality, and see workload alongside planned unavailability."
        >
          {/* Admins land on this screen specifically to set attendance for
              clinicians who forgot to clock in. The CTA used to live deep
              inside the Branch Attendance card; surfacing it in the header
              means it's the first thing the admin sees on a page open. */}
          {isAdmin && (
            <Button
              onClick={openAddDialog}
              disabled={!branchId}
              className="gap-2"
              title="Set clock-in / clock-out for a doctor or therapist."
            >
              <Plus className="w-4 h-4" />
              Set Attendance
            </Button>
          )}
        </PageHeader>
        {body}
      </div>
    </AppLayout>
  );
}
