import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/ui/page-transition";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { operationsApi } from "@/services/operations.service";
import type {
  AttendanceStats, AttendanceStatus, StaffAttendanceEntry,
} from "@/types";
import {
  Loader2, LogIn, LogOut, Clock, CalendarDays, ChevronLeft, ChevronRight,
  CheckCircle, Hourglass,
} from "lucide-react";
import { toast } from "sonner";

const statusBadgeStyles: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-800 border-green-300",
  LATE:    "bg-yellow-100 text-yellow-800 border-yellow-300",
  ABSENT:  "bg-red-100 text-red-800 border-red-300",
  HALF_DAY:"bg-blue-100 text-blue-800 border-blue-300",
  LEAVE:   "bg-purple-100 text-purple-800 border-purple-300",
  WFH:     "bg-sky-100 text-sky-800 border-sky-300",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function fmtClock(iso?: string | null) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function minutesToHm(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function TherapistAttendance() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [history, setHistory] = useState<StaffAttendanceEntry[]>([]);
  const [stats, setStats]     = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn]   = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  // Live tick — drives the elapsed counter on the "currently clocked in"
  // card. We bump it every 30 s; the actual math reads Date.now() so the
  // tick value itself is just a re-render trigger.
  const [tick, setTick] = useState(0);

  const monthLabel = useMemo(
    () => new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [year, month],
  );

  const fetchData = useCallback(async () => {
    const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate   = `${year}-${String(month + 1).padStart(2, "0")}-${getDaysInMonth(year, month)}`;
    try {
      const [rows, s] = await Promise.all([
        operationsApi.getMyAttendance({ startDate, endDate }),
        operationsApi.getMyAttendanceStats({ startDate, endDate }),
      ]);
      setHistory(rows);
      setStats(s);
    } catch {
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRecord = history.find((r) => r.date.slice(0, 10) === todayKey) ?? null;
  const isClockedIn  = !!todayRecord?.clockIn && !todayRecord?.clockOut;
  const isClockedOut = !!todayRecord?.clockIn && !!todayRecord?.clockOut;

  // Elapsed time while clocked in — re-evaluated each render (the tick
  // interval keeps this fresh without us needing to bind to wall-clock
  // changes directly).
  const elapsedMinutes = useMemo(() => {
    if (!todayRecord?.clockIn) return 0;
    const end = todayRecord.clockOut ? new Date(todayRecord.clockOut).getTime() : Date.now();
    return Math.max(0, Math.round((end - new Date(todayRecord.clockIn).getTime()) / 60_000));
    // tick is intentionally in the dep list so the value refreshes on the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayRecord, tick]);

  const totalWorkedMinutes = useMemo(() => {
    return history.reduce((acc, r) => {
      if (!r.clockIn || !r.clockOut) return acc;
      const m = Math.round((new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 60_000);
      return acc + Math.max(0, m);
    }, 0);
  }, [history]);

  const presentDays = stats?.presentDays ?? 0;
  const avgPerDayMinutes = presentDays > 0 ? Math.round(totalWorkedMinutes / presentDays) : 0;

  const handleClockIn = async () => {
    setClockingIn(true);
    try {
      await operationsApi.clockIn();
      toast.success("Clocked in");
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to clock in";
      toast.error(msg);
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    setClockingOut(true);
    try {
      await operationsApi.clockOut();
      toast.success("Clocked out");
      await fetchData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to clock out";
      toast.error(msg);
    } finally {
      setClockingOut(false);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  // Sort newest-first for the timeline. The backend already orders by
  // date desc for `mine`, but we keep this defensive in case that
  // contract ever changes.
  const sorted = useMemo(
    () => [...history].sort((a, b) => b.date.localeCompare(a.date)),
    [history],
  );

  return (
    <AppLayout>
      <PageTransition className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <PageHeader
          title="My Attendance"
          subtitle="Daily check-in and monthly history"
        />

        {/* Today's status card */}
        <Card className="border-primary/30 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="w-4 h-4 text-primary" />
              Today — {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                {isClockedIn && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" aria-hidden />
                    <span className="text-sm font-medium">
                      Checked in at {fmtClock(todayRecord?.clockIn)}
                    </span>
                  </div>
                )}
                {isClockedOut && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Worked {fmtClock(todayRecord?.clockIn)} – {fmtClock(todayRecord?.clockOut)}
                    </span>
                  </div>
                )}
                {!isClockedIn && !isClockedOut && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Hourglass className="w-4 h-4" />
                    <span className="text-sm">Not checked in yet today</span>
                  </div>
                )}

                {isClockedIn && (
                  <div className="text-xs text-muted-foreground pl-4.5 ml-0.5">
                    Elapsed: <span className="font-semibold text-foreground">{minutesToHm(elapsedMinutes)}</span>
                  </div>
                )}
                {isClockedOut && (
                  <div className="text-xs text-muted-foreground">
                    Total: <span className="font-semibold text-foreground">{minutesToHm(elapsedMinutes)}</span>
                    {todayRecord?.status && (
                      <Badge variant="outline" className={`ml-2 text-[10px] ${statusBadgeStyles[todayRecord.status]}`}>
                        {todayRecord.status}
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="lg"
                  variant="default"
                  onClick={handleClockIn}
                  disabled={isClockedIn || isClockedOut || clockingIn}
                  className="gap-2"
                >
                  {clockingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Check In
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleClockOut}
                  disabled={!isClockedIn || clockingOut}
                  className="gap-2"
                >
                  {clockingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Check Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monthly summary */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard title="Present Days"  value={stats?.presentDays ?? 0} icon={CheckCircle} />
          <StatCard title="Late Days"     value={stats?.lateDays    ?? 0} icon={Clock}       variant="attention" />
          <StatCard title="Total Hours"   value={minutesToHm(totalWorkedMinutes)} icon={Hourglass} />
          <StatCard title="Avg / Day"     value={minutesToHm(avgPerDayMinutes)}   icon={CalendarDays} />
        </section>

        {/* History */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              History — {monthLabel}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={prevMonth} aria-label="Previous month">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={nextMonth} aria-label="Next month">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No attendance records this month yet.
              </div>
            ) : (
              <ul className="divide-y">
                {sorted.map((row) => {
                  const worked = row.clockIn && row.clockOut
                    ? Math.max(0, Math.round((new Date(row.clockOut).getTime() - new Date(row.clockIn).getTime()) / 60_000))
                    : 0;
                  return (
                    <li key={row.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{fmtDay(row.date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtClock(row.clockIn)} – {fmtClock(row.clockOut)}
                          {row.lateMinutes > 0 && (
                            <span className="ml-2 text-yellow-700">• {row.lateMinutes}m late</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {worked > 0 && (
                          <span className="text-xs font-semibold text-foreground tabular-nums">
                            {minutesToHm(worked)}
                          </span>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${statusBadgeStyles[row.status]}`}>
                          {row.status}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </PageTransition>
    </AppLayout>
  );
}
