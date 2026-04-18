import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { operationsApi } from "@/services/operations.service";
import type { StaffAttendanceEntry, AttendanceStats, AttendanceStatus } from "@/types";
import {
  Loader2, LogIn, LogOut, CalendarDays, Clock, AlertTriangle,
  CheckCircle, XCircle, Users,
} from "lucide-react";

const statusColors: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-500",
  LATE: "bg-yellow-500",
  ABSENT: "bg-red-500",
  HALF_DAY: "bg-blue-500",
  LEAVE: "bg-purple-500",
};

const statusBadgeStyles: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-800 border-green-300",
  LATE: "bg-yellow-100 text-yellow-800 border-yellow-300",
  ABSENT: "bg-red-100 text-red-800 border-red-300",
  HALF_DAY: "bg-blue-100 text-blue-800 border-blue-300",
  LEAVE: "bg-purple-100 text-purple-800 border-purple-300",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatTime(dateStr?: string) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AttendanceTracker() {
  const { role } = useAuth();
  const { branches } = useBranches();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";

  const [myAttendance, setMyAttendance] = useState<StaffAttendanceEntry[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [branchAttendance, setBranchAttendance] = useState<StaffAttendanceEntry[]>([]);
  const [punctuality, setPunctuality] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const fetchMyData = useCallback(async () => {
    try {
      const startDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-01`;
      const daysInMonth = getDaysInMonth(calYear, calMonth);
      const endDate = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${daysInMonth}`;
      const [attendance, attendanceStats] = await Promise.all([
        operationsApi.getMyAttendance({ startDate, endDate }),
        operationsApi.getMyAttendanceStats({ startDate, endDate }),
      ]);
      setMyAttendance(attendance);
      setStats(attendanceStats);
    } catch {
      setError("Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }, [calYear, calMonth]);

  useEffect(() => {
    fetchMyData();
  }, [fetchMyData]);

  // Admin: fetch branch attendance
  useEffect(() => {
    if (!isAdmin || !branchId) return;
    operationsApi.getBranchAttendance(branchId, { date: selectedDate })
      .then(setBranchAttendance)
      .catch(() => {});
    operationsApi.getPunctualityReport(branchId)
      .then((data: any) => setPunctuality(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [branchId, selectedDate, isAdmin]);

  useEffect(() => {
    if (isAdmin && (branches as any[]).length > 0 && !branchId) {
      setBranchId((branches as any[])[0].id);
    }
  }, [branches, isAdmin, branchId]);

  const handleClockIn = async () => {
    setClockingIn(true);
    try {
      await operationsApi.clockIn();
      await fetchMyData();
    } catch {
      alert("Failed to clock in");
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    setClockingOut(true);
    try {
      await operationsApi.clockOut();
      await fetchMyData();
    } catch {
      alert("Failed to clock out");
    } finally {
      setClockingOut(false);
    }
  };

  // Build calendar map
  const attendanceMap = new Map<string, AttendanceStatus>();
  myAttendance.forEach(a => attendanceMap.set(a.date.split("T")[0], a.status));

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
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Attendance...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Attendance Tracker"
          subtitle="Track attendance, clock in/out, and view punctuality reports."
        />

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Clock In/Out */}
        <Card className="border-none shadow-sm">
          <CardContent className="py-5 flex flex-wrap items-center gap-4">
            <Button onClick={handleClockIn} disabled={clockingIn} className="gap-2">
              {clockingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Clock In
            </Button>
            <Button onClick={handleClockOut} disabled={clockingOut} variant="outline" className="gap-2">
              {clockingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              Clock Out
            </Button>
            <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Late</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Half Day</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Leave</span>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="Present Days" value={stats.presentDays} icon={CheckCircle} variant="wellness" />
            <StatCard title="Late Days" value={stats.lateDays} icon={Clock} variant="attention" />
            <StatCard title="Absent Days" value={stats.absentDays} icon={XCircle} variant="risk" />
            <StatCard title="Avg Late (min)" value={stats.avgLateMinutes} icon={AlertTriangle} />
          </div>
        )}

        {/* Calendar View */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Attendance Calendar
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={prevMonth}>&larr;</Button>
                <span className="text-sm font-semibold w-32 text-center">
                  {new Date(calYear, calMonth).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
                <Button variant="outline" size="sm" onClick={nextMonth}>&rarr;</Button>
              </div>
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
                const status = attendanceMap.get(dateKey);
                return (
                  <div
                    key={day}
                    className="relative flex flex-col items-center py-2 rounded-lg hover:bg-secondary/10 transition-colors"
                  >
                    <span className="text-xs font-medium">{day}</span>
                    {status && (
                      <span className={`mt-1 w-2 h-2 rounded-full ${statusColors[status]}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Admin: Branch Attendance */}
        {isAdmin && (
          <>
            <Card className="border-none shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Branch Attendance
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select Branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {(branches as any[]).map((b: any) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="h-10 px-3 border rounded-md text-sm bg-background"
                    />
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
                            <TableCell>{formatTime(a.scheduledStart)}</TableCell>
                            <TableCell>
                              {a.lateMinutes > 0 ? (
                                <span className="text-yellow-600 font-semibold">{a.lateMinutes}</span>
                              ) : (
                                <span className="text-green-600">0</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

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
                          <div className="w-32 text-sm font-medium truncate">{p.fullName || p.name || `Staff ${i + 1}`}</div>
                          <div className="flex-1 h-4 bg-secondary/20 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${val > 30 ? "bg-red-400" : val > 15 ? "bg-yellow-400" : "bg-green-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-16 text-right text-sm font-semibold text-muted-foreground">{val} min</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
