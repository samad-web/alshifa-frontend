import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { operationsApi } from "@/services/operations.service";
import { useBranchStaff, type BranchStaffRow } from "@/hooks/useBranchStaff";
import type { AttendanceStatus, StaffAttendanceEntry } from "@/types";
import {
  Users, Building2, ClipboardCheck, Trophy, CalendarDays, UserPlus,
  Stethoscope, Heart, LogIn, LogOut, Loader2, Mail, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// EmployeeRow extends BranchStaffRow with today's attendance attached.
type EmployeeRow = BranchStaffRow & {
  attendance: StaffAttendanceEntry | null;
};

const statusBadgeStyles: Record<AttendanceStatus, string> = {
  PRESENT:  "bg-green-100 text-green-800 border-green-300",
  LATE:     "bg-yellow-100 text-yellow-800 border-yellow-300",
  ABSENT:   "bg-red-100 text-red-800 border-red-300",
  HALF_DAY: "bg-blue-100 text-blue-800 border-blue-300",
  LEAVE:    "bg-purple-100 text-purple-800 border-purple-300",
  WFH:      "bg-sky-100 text-sky-800 border-sky-300",
};

function initials(name: string | null | undefined) {
  if (!name) return "??";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function formatTime(iso?: string | null) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Current system time as HH:mm — what the backend's setAttendance expects.
function nowHHmm() {
  return new Date().toTimeString().slice(0, 5);
}

// Convert a stored ISO clock-in back into HH:mm so we can pass it through
// when only the clock-out is being changed (the upsert overwrites both).
function isoToHHmm(iso?: string | null) {
  if (!iso) return undefined;
  return new Date(iso).toTimeString().slice(0, 5);
}

export default function BranchAdminDashboard() {
  const { profile } = useAuth();
  const branchId = profile?.branchId ?? null;
  const branchName = profile?.branch?.name || "your branch";

  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [attendance, setAttendance] = useState<StaffAttendanceEntry[]>([]);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Roster comes from the shared useBranchStaff hook so this page, the
  // staff directory, and the attendance tracker stay aligned on the row
  // shape.
  const { staff, loading: staffLoading, error: staffError, refresh: refreshStaff } = useBranchStaff(branchId);

  // Today's attendance for the branch — fetched separately and joined to
  // staff rows below. A failure here just leaves rows without attendance,
  // it does not blank out the employee list.
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    operationsApi.getBranchAttendance(branchId, { date: today })
      .then((rows) => { if (!cancelled) setAttendance(rows || []); })
      .catch(() => { if (!cancelled) setAttendance([]); });
    return () => { cancelled = true; };
  }, [branchId, today, attendanceRefreshKey]);

  useEffect(() => {
    if (staffError) toast.error('Failed to load employees');
  }, [staffError]);

  const employees: EmployeeRow[] = useMemo(() => {
    const attendanceByUser = new Map<string, StaffAttendanceEntry>();
    for (const a of attendance) if (a.userId) attendanceByUser.set(a.userId, a);
    return staff
      .filter((s) => !!s.userId)
      .map((s) => ({ ...s, attendance: attendanceByUser.get(s.userId!) ?? null }));
  }, [staff, attendance]);

  const loading = staffLoading;
  const refresh = () => {
    refreshStaff();
    setAttendanceRefreshKey((k) => k + 1);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e) =>
      (e.fullName ?? "").toLowerCase().includes(term)
      || (e.email ?? "").toLowerCase().includes(term)
      || (e.specialization ?? "").toLowerCase().includes(term),
    );
  }, [employees, search]);

  // Pagination — page resets to 1 whenever the search term or roster size
  // changes so the user never lands on a stale empty page.
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, employees.length]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedEmployees = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  // System time clock-in via the admin-override endpoint. Safer than the
  // self-service /clock-in route since the BRANCH_ADMIN isn't the staff
  // member — we're recording attendance on their behalf at "now".
  const handleMarkIn = async (row: EmployeeRow) => {
    if (!row.userId) return;
    setBusyUserId(row.userId);
    try {
      await operationsApi.setAttendance(row.userId, {
        date: today,
        clockIn: nowHHmm(),
      });
      toast.success(`Marked in: ${row.fullName ?? ''}`);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to mark in");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleMarkOut = async (row: EmployeeRow) => {
    if (!row.attendance?.clockIn || !row.userId) return;
    setBusyUserId(row.userId);
    try {
      // setAttendance treats missing clockIn as a clear, so we must echo the
      // existing clock-in HH:mm back when only stamping the clock-out.
      await operationsApi.setAttendance(row.userId, {
        date: today,
        clockIn: isoToHHmm(row.attendance.clockIn),
        clockOut: nowHHmm(),
      });
      toast.success(`Marked out: ${row.fullName ?? ''}`);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to mark out");
    } finally {
      setBusyUserId(null);
    }
  };

  const tiles: Array<{ to: string; label: string; description: string; icon: typeof Users }> = [
    { to: "/branch-admin/staff",       label: "Staff Directory",   description: "Doctors and therapists assigned to your branch", icon: Users },
    { to: "/assign-patient",           label: "Assign Patient",    description: "Pair patients with clinicians in your branch",   icon: UserPlus },
    { to: "/attendance",               label: "Attendance",        description: "Set and review staff attendance",                icon: ClipboardCheck },
    { to: "/branch-admin/scorecards",  label: "Performance",       description: "Branch-level scorecards (read-only)",            icon: Trophy },
    { to: "/staff-schedule",           label: "Schedule",          description: "Weekly availability across the branch",          icon: CalendarDays },
  ];

  // Headline counts for the employee section.
  const stats = useMemo(() => {
    let inToday = 0, outToday = 0, pending = 0;
    for (const e of employees) {
      if (e.attendance?.clockIn && e.attendance?.clockOut) outToday++;
      else if (e.attendance?.clockIn) inToday++;
      else pending++;
    }
    return { inToday, outToday, pending };
  }, [employees]);

  return (
    <AppLayout>
      <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Branch Admin"
          subtitle={`Manage clinicians, attendance, and patient assignments for ${branchName}.`}
        />

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-primary" />
              {branchName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your access is scoped to this branch. You can view and assign patients to doctors
              and therapists in this branch, set attendance, and review performance scorecards.
              You cannot create or deactivate staff accounts, edit clinician availability, or
              modify therapist skills.
            </p>
          </CardContent>
        </Card>

        {/* Inline employee list — shown directly on the dashboard so the branch
            admin can see who's in the branch and mark attendance with one
            click. Clock-in/out time is the current system time. */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-primary" />
                Employees in {branchName}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  In: {stats.inToday}
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                  Out: {stats.outToday}
                </Badge>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  Pending: {stats.pending}
                </Badge>
              </div>
            </div>
            <div className="pt-3">
              <Input
                placeholder="Search employee by name, email, or specialisation"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-sm text-center text-muted-foreground">
                {employees.length === 0 ? "No clinicians assigned to this branch yet." : "No employees match your search."}
              </p>
            ) : (
              <ul className="divide-y">
                {pagedEmployees.map((row) => {
                  const Icon = row.role === "DOCTOR" ? Stethoscope : Heart;
                  const att = row.attendance;
                  const isClockedIn = !!att?.clockIn && !att?.clockOut;
                  const isClockedOut = !!att?.clockIn && !!att?.clockOut;
                  const isBusy = !!row.userId && busyUserId === row.userId;
                  const displayName = row.fullName ?? row.email ?? "Unnamed";

                  return (
                    <li key={row.userId ?? row.profileId} className="py-3 flex flex-wrap items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        {row.profilePhoto && <AvatarImage src={row.profilePhoto} alt={displayName} />}
                        <AvatarFallback>{initials(displayName)}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{displayName}</span>
                          <Badge variant="outline" className="gap-1 text-[10px]">
                            <Icon className="w-3 h-3" />
                            {row.role === "DOCTOR" ? "Doctor" : "Therapist"}
                          </Badge>
                          {att?.status && (
                            <Badge variant="outline" className={statusBadgeStyles[att.status]}>
                              {att.status.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                          {row.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3" /> {row.email}
                            </span>
                          )}
                          {row.specialization && <span>· {row.specialization}</span>}
                          <span>
                            In {formatTime(att?.clockIn)} · Out {formatTime(att?.clockOut)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isClockedIn || isClockedOut ? "outline" : "default"}
                          disabled={isBusy || isClockedIn || isClockedOut}
                          onClick={() => handleMarkIn(row)}
                          className="gap-1"
                          title={
                            isClockedOut ? "Already clocked out today"
                            : isClockedIn ? "Already clocked in today"
                            : "Stamp clock-in at current system time"
                          }
                        >
                          {isBusy && !isClockedIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                          Mark In
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy || !isClockedIn}
                          onClick={() => handleMarkOut(row)}
                          className="gap-1"
                          title={!isClockedIn ? "Clock in first" : "Stamp clock-out at current system time"}
                        >
                          {isBusy && isClockedIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                          Mark Out
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {filtered.length > PAGE_SIZE && (
              <div className="pt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  Showing {rangeStart}–{rangeEnd} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-2 tabular-nums">Page {safePage} of {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="pt-4 flex justify-end">
              <Link to="/attendance">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <ClipboardCheck className="w-4 h-4" />
                  Open full attendance view
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <Card key={t.to} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="w-4 h-4 text-primary" />
                    {t.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                  <Link to={t.to}>
                    <Button variant="outline" size="sm" className="w-full">Open</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
