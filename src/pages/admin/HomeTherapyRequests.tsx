import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PageTransition } from "@/components/ui/page-transition";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { useToast } from "@/components/ui/use-toast";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  HeartHandshake,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Clock,
  Home,
  Hospital,
  AlertTriangle,
  Loader2,
  RefreshCw,
  User,
  Building2,
  Stethoscope,
  Pencil,
  Plus,
  Trash2,
  Lock,
} from "lucide-react";
import {
  homeTherapyService,
  type HomeTherapyRequest,
  type HomeTherapyStatus,
  type SessionMode,
  type ScheduledSession,
  type SessionMode,
  type HomeTherapySession,
  type EditScheduledSession,
} from "@/services/homeTherapy.service";

// One row in the Edit-Schedule modal. Carries the current DB status of the
// session (or undefined for newly added rows) so the modal can lock down
// non-SCHEDULED rows and label them clearly.
interface EditRow {
  sessionNumber: number;
  date: string;
  time: string;
  mode: SessionMode;
  /** undefined = freshly-added row (not yet persisted). */
  existingId?: string;
  existingStatus?: HomeTherapySession["status"];
}

interface BranchTherapistRow {
  id: string;
  fullName?: string | null;
  specialization?: string | null;
  branchId?: string | null;
  appointmentsToday?: number;
}

const STATUS_TABS: Array<{ value: HomeTherapyStatus; label: string }> = [
  { value: "PENDING_APPROVAL", label: "Pending" },
  { value: "APPROVED",         label: "Approved" },
  { value: "REJECTED",         label: "Rejected" },
  { value: "COMPLETED",        label: "Completed" },
];

const STATUS_BADGE_TONE: Record<HomeTherapyStatus, string> = {
  PENDING_APPROVAL: "bg-amber-500 text-white",
  APPROVED:         "bg-primary text-primary-foreground",
  REJECTED:         "bg-red-500 text-white",
  IN_PROGRESS:      "bg-blue-600 text-white",
  COMPLETED:        "bg-emerald-600 text-white",
  CANCELLED:        "bg-slate-500 text-white",
};

function modeBreakdown(modes: SessionMode[] = []) {
  let h = 0, hosp = 0;
  for (const m of modes) { if (m === "HOME") h++; else if (m === "HOSPITAL") hosp++; }
  return `${h} Home · ${hosp} Hospital`;
}

/**
 * Toggles the teal "New" pulse on a request card briefly after a Socket.IO
 * `home_therapy_request_created` event arrives — clears after 30s so the
 * pulse doesn't stick across tab switches.
 */
function useNewBadgeTimer() {
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());
  const flag = useCallback((id: string) => {
    setNewIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      setNewIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 30000);
  }, []);
  return { newIds, flag };
}

export default function HomeTherapyRequestsPage() {
  const { toast } = useToast();
  const { profile, role } = useAuth();
  const { branchIdParam } = useBranchScope();
  const { socket, isConnected } = useWebSocket();

  // BRANCH_ADMIN is pinned to their own branch; ADMIN and ADMIN_DOCTOR
  // both see the whole hospital and can narrow via the navbar branch
  // switcher. ADMIN_DOCTOR used to be locked to home branch here, which
  // surfaced as "always shows Chennai" regardless of the navbar choice.
  const homeBranchId = (profile as { branchId?: string | null } | null)?.branchId ?? null;
  const effectiveBranchId =
    role === "BRANCH_ADMIN"
      ? homeBranchId ?? undefined
      : branchIdParam;

  const [tab, setTab] = useState<HomeTherapyStatus>("PENDING_APPROVAL");
  const [requests, setRequests] = useState<HomeTherapyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { newIds, flag: flagNew } = useNewBadgeTimer();

  // Approve modal state
  const [approveTarget, setApproveTarget] = useState<HomeTherapyRequest | null>(null);
  const [therapists, setTherapists] = useState<BranchTherapistRow[]>([]);
  const [therapistsLoading, setTherapistsLoading] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>("");
  const [scheduled, setScheduled] = useState<ScheduledSession[]>([]);
  const [approving, setApproving] = useState(false);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<HomeTherapyRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Edit modal state — separate from approve so the two flows can't bleed.
  const [editTarget, setEditTarget] = useState<HomeTherapyRequest | null>(null);
  const [editTherapists, setEditTherapists] = useState<BranchTherapistRow[]>([]);
  const [editTherapistsLoading, setEditTherapistsLoading] = useState(false);
  const [editTherapistId, setEditTherapistId] = useState<string>("");
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [editing, setEditing] = useState(false);

  // ── Fetch requests for the current tab ──────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await homeTherapyService.listRequests({
        branchId: effectiveBranchId,
        status: tab,
      });
      // Server returns desc by createdAt — keep order.
      setRequests(rows ?? []);
    } catch (err) {
      toast({
        title: "Failed to load requests",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [effectiveBranchId, tab, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── Real-time: prepend a new request when the Socket.IO event fires ──
  useEffect(() => {
    if (!socket || !isConnected) return;
    const onCreated = (payload: { id: string; branchId?: string; status?: HomeTherapyStatus }) => {
      if (effectiveBranchId && payload.branchId && payload.branchId !== effectiveBranchId) return;
      // Re-fetch the freshly-created row so we have the full include shape
      // (patient name, doctor name, branch — the socket payload is lean).
      homeTherapyService.getRequest(payload.id)
        .then((row) => {
          if (!row) return;
          flagNew(row.id);
          if (row.status === tab) {
            setRequests((prev) => {
              if (prev.some((r) => r.id === row.id)) return prev;
              return [row, ...prev];
            });
          }
        })
        .catch(() => { /* no-op — refresh button still works */ });
    };
    const onApproved = () => { if (tab !== "PENDING_APPROVAL") refresh(); else refresh(); };
    const onRejected = () => { refresh(); };
    socket.on("home_therapy_request_created", onCreated);
    socket.on("home_therapy_approved", onApproved);
    socket.on("home_therapy_rejected", onRejected);
    return () => {
      socket.off("home_therapy_request_created", onCreated);
      socket.off("home_therapy_approved", onApproved);
      socket.off("home_therapy_rejected", onRejected);
    };
  }, [socket, isConnected, tab, effectiveBranchId, flagNew, refresh]);

  // ── Approve modal: load therapists when opened ──────────────────────
  useEffect(() => {
    if (!approveTarget) return;
    setTherapistsLoading(true);
    // apiClient.get<T> resolves to `{ data: T, status }` — unwrap `.data` so we
    // store the actual array. The Array.isArray fallback covers a malformed
    // response shape rather than (incorrectly) the envelope itself.
    apiClient.get<BranchTherapistRow[]>("/api/user/list-therapists", { branchId: approveTarget.branchId })
      .then(({ data }) => setTherapists(Array.isArray(data) ? data : []))
      .catch(() => setTherapists([]))
      .finally(() => setTherapistsLoading(false));
    // Seed empty schedule rows — first session lands two days out so the
    // patient + therapist have prep time, subsequent sessions step by
    // intervalDays. Same floor (today + 2) is enforced on the DatePicker.
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 2);
    const interval = approveTarget.intervalDays && approveTarget.intervalDays > 0 ? approveTarget.intervalDays : 1;
    const seed: ScheduledSession[] = Array.from({ length: approveTarget.totalSessions }, (_, i) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i * interval);
      return {
        sessionNumber: i + 1,
        date: toIsoDate(d),
        time: "10:00",
      };
    });
    setScheduled(seed);
    setSelectedTherapistId("");
  }, [approveTarget]);

  const closeApprove = () => {
    setApproveTarget(null);
    setSelectedTherapistId("");
    setScheduled([]);
  };

  const submitApprove = async () => {
    if (!approveTarget) return;
    if (!selectedTherapistId) {
      toast({ title: "Select a therapist before approving", variant: "destructive" });
      return;
    }
    // Validate every row has date + time, and the date is at least two days
    // out (lead time for the patient + therapist to prep). Same floor that
    // the calendar enforces, but enforced here too so manual edits / stale
    // state can't bypass it.
    const floor = new Date();
    floor.setHours(0, 0, 0, 0);
    floor.setDate(floor.getDate() + 2);
    for (const row of scheduled) {
      if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        toast({ title: `Set a date for Session ${row.sessionNumber}`, variant: "destructive" });
        return;
      }
      const [y, m, d] = row.date.split("-").map(Number);
      const rowDate = new Date(y, m - 1, d);
      if (rowDate < floor) {
        toast({
          title: `Session ${row.sessionNumber} too soon`,
          description: "Pick a date at least two days from today.",
          variant: "destructive",
        });
        return;
      }
      if (!row.time || !/^\d{2}:\d{2}$/.test(row.time)) {
        toast({ title: `Set a time for Session ${row.sessionNumber}`, variant: "destructive" });
        return;
      }
    }
    setApproving(true);
    try {
      await homeTherapyService.approve(approveTarget.id, {
        therapistId: selectedTherapistId,
        scheduledSessions: scheduled,
      });
      toast({
        title: "Request approved",
        description: `${approveTarget.totalSessions} session${approveTarget.totalSessions === 1 ? "" : "s"} scheduled.`,
      });
      closeApprove();
      refresh();
    } catch (err) {
      toast({
        title: "Approval failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const closeReject = () => {
    setRejectTarget(null);
    setRejectReason("");
  };

  // ── Edit modal: load therapist list + seed rows from existing sessions ─
  useEffect(() => {
    if (!editTarget) return;
    setEditTherapistsLoading(true);
    apiClient.get<BranchTherapistRow[]>("/api/user/list-therapists", { branchId: editTarget.branchId })
      .then(({ data }) => setEditTherapists(Array.isArray(data) ? data : []))
      .catch(() => setEditTherapists([]))
      .finally(() => setEditTherapistsLoading(false));

    // Existing therapist baseline = first session's therapistId. If somehow
    // the request has no sessions (shouldn't happen for APPROVED+), fall
    // back to empty so the user is forced to pick one before saving.
    setEditTherapistId(editTarget.sessions?.[0]?.therapistId ?? "");

    // Seed rows from current sessions in sessionNumber order. Lock fields
    // for any session that's no longer SCHEDULED.
    const sortedSessions = [...(editTarget.sessions ?? [])].sort(
      (a, b) => a.sessionNumber - b.sessionNumber,
    );
    const rows: EditRow[] = sortedSessions.map((s) => ({
      sessionNumber:  s.sessionNumber,
      date:           toIsoDate(new Date(s.scheduledDate)),
      time:           s.scheduledTime,
      mode:           s.mode,
      existingId:     s.id,
      existingStatus: s.status,
    }));
    setEditRows(rows);
  }, [editTarget]);

  const closeEdit = () => {
    setEditTarget(null);
    setEditTherapistId("");
    setEditRows([]);
  };

  const addEditRow = () => {
    setEditRows((prev) => {
      // New rows go at the end; default to the last row's date + intervalDays
      // (or +1 day) so the schedule stays plausible.
      const last = prev[prev.length - 1];
      const interval = editTarget?.intervalDays && editTarget.intervalDays > 0 ? editTarget.intervalDays : 1;
      const baseDate = last?.date ? new Date(`${last.date}T00:00:00Z`) : new Date();
      baseDate.setUTCDate(baseDate.getUTCDate() + interval);
      return [
        ...prev,
        {
          sessionNumber: prev.length + 1,
          date: toIsoDate(baseDate),
          time: last?.time ?? "10:00",
          mode: "HOME",
        },
      ];
    });
  };

  const removeEditRow = (sessionNumber: number) => {
    setEditRows((prev) => {
      const target = prev.find((r) => r.sessionNumber === sessionNumber);
      // Server-side guard refuses to drop non-SCHEDULED sessions; mirror that
      // here so the user gets immediate feedback.
      if (target?.existingStatus && target.existingStatus !== "SCHEDULED") {
        toast({
          title: `Cannot drop session ${sessionNumber}`,
          description: `Status is ${target.existingStatus}.`,
          variant: "destructive",
        });
        return prev;
      }
      // Renumber remaining rows so sessionNumbers stay contiguous 1..N — the
      // backend rejects gaps.
      return prev
        .filter((r) => r.sessionNumber !== sessionNumber)
        .map((r, idx) => ({ ...r, sessionNumber: idx + 1 }));
    });
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    if (!editTherapistId) {
      toast({ title: "Pick a therapist before saving", variant: "destructive" });
      return;
    }
    if (editRows.length === 0) {
      toast({ title: "At least one session is required", variant: "destructive" });
      return;
    }
    // Validate every row has a valid date + time, and the date is at least
    // two days out (matches the approve flow's lead-time rule).
    const floor = new Date();
    floor.setHours(0, 0, 0, 0);
    floor.setDate(floor.getDate() + 2);
    for (const row of editRows) {
      if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        toast({ title: `Set a date for Session ${row.sessionNumber}`, variant: "destructive" });
        return;
      }
      // Only enforce the floor on rows that are still editable (SCHEDULED or
      // brand-new). Locked rows keep their existing date as-is.
      const editable = !row.existingStatus || row.existingStatus === "SCHEDULED";
      if (editable) {
        const [y, m, d] = row.date.split("-").map(Number);
        const rowDate = new Date(y, m - 1, d);
        if (rowDate < floor) {
          toast({
            title: `Session ${row.sessionNumber} too soon`,
            description: "Pick a date at least two days from today.",
            variant: "destructive",
          });
          return;
        }
      }
      if (!row.time || !/^\d{2}:\d{2}$/.test(row.time)) {
        toast({ title: `Set a time for Session ${row.sessionNumber}`, variant: "destructive" });
        return;
      }
    }

    setEditing(true);
    try {
      const payload: EditScheduledSession[] = editRows.map((r) => ({
        sessionNumber: r.sessionNumber,
        date:          r.date,
        time:          r.time,
        mode:          r.mode,
      }));
      await homeTherapyService.edit(editTarget.id, {
        therapistId:        editTherapistId,
        scheduledSessions:  payload,
      });
      toast({
        title: "Schedule updated",
        description: `${payload.length} session${payload.length === 1 ? "" : "s"} on file.`,
      });
      closeEdit();
      refresh();
    } catch (err) {
      toast({
        title: "Edit failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setEditing(false);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length === 0) {
      toast({ title: "Provide a rejection reason", variant: "destructive" });
      return;
    }
    setRejecting(true);
    try {
      await homeTherapyService.reject(rejectTarget.id, rejectReason.trim());
      toast({ title: "Request rejected" });
      closeReject();
      refresh();
    } catch (err) {
      toast({
        title: "Rejection failed",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  const tabCounts = useMemo(() => {
    // Render the active tab's count in its label; other tabs show no count.
    const map: Partial<Record<HomeTherapyStatus, number>> = {};
    map[tab] = requests.length;
    return map;
  }, [tab, requests]);

  return (
    <AppLayout>
      <PageTransition>
        <div className="container max-w-6xl mx-auto px-4 py-8 md:py-10 space-y-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <PageHeader
              title="Home Therapy Requests"
              subtitle="Review doctor-authored therapy referrals, assign a therapist, and schedule each session."
            />
            <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as HomeTherapyStatus)}>
            <TabsList>
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  {tabCounts[t.value] !== undefined && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] px-1.5 rounded-full bg-secondary text-[10px] text-foreground/80">
                      {tabCounts[t.value]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {STATUS_TABS.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-6">
                {loading ? (
                  <DashboardSkeleton />
                ) : requests.length === 0 ? (
                  <EmptyState status={t.value} />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {requests.map((r) => (
                      <RequestCard
                        key={r.id}
                        request={r}
                        isNew={newIds.has(r.id)}
                        onApprove={() => setApproveTarget(r)}
                        onReject={() => setRejectTarget(r)}
                        onEdit={() => setEditTarget(r)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Approve modal */}
        <Dialog open={!!approveTarget} onOpenChange={(open) => !open && closeApprove()}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                Approve Home Therapy Request
              </DialogTitle>
              <DialogDescription>
                {approveTarget && (
                  <>
                    For <span className="font-semibold text-foreground">{approveTarget.patient?.fullName ?? "—"}</span>{" "}
                    · {approveTarget.totalSessions} session{approveTarget.totalSessions === 1 ? "" : "s"} ·{" "}
                    {modeBreakdown(approveTarget.sessionMode)}
                    {approveTarget.intervalDays ? ` · every ${approveTarget.intervalDays}d` : ""}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {approveTarget && (() => {
              // Earliest schedulable date: today + 2 days. Used both as the
              // calendar floor and as the seed default in the useEffect above.
              const minScheduleDate = (() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() + 2);
                return d;
              })();
              return (
              <div className="space-y-4">
                {/* Therapist picker */}
                <div className="space-y-1.5">
                  <Label>Assign a therapist</Label>
                  <SearchableSelect
                    value={selectedTherapistId}
                    onChange={setSelectedTherapistId}
                    placeholder={therapistsLoading ? "Loading…" : "Pick a therapist"}
                    items={therapists.map((t) => ({
                      value: t.id,
                      label: t.fullName ?? "Therapist",
                      sub: [t.specialization].filter(Boolean).join(" · ") || undefined,
                    }))}
                    emptyMessage="No therapists in this branch"
                    loading={therapistsLoading}
                  />
                  {!therapistsLoading && therapists.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      No therapists registered in this branch — register one before approving.
                    </p>
                  )}
                </div>

                {/* Session schedule table */}
                <div className="rounded-xl border border-border/50 bg-secondary/10 p-3">
                  <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-primary" />
                    Schedule each session (DD/MM/YYYY · HH:MM)
                  </div>
                  <div className="space-y-2 max-h-[320px] overflow-y-auto">
                    {scheduled.map((row, idx) => {
                      const mode = approveTarget.sessionMode?.[idx] ?? "HOME";
                      return (
                        <div key={row.sessionNumber} className="grid grid-cols-1 sm:grid-cols-[110px_1fr_140px_110px] gap-2 items-end p-2 rounded-lg bg-background border border-border/40">
                          <div className="text-sm font-medium">
                            Session {row.sessionNumber}
                            <span className={cn("ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full",
                              mode === "HOME" ? "bg-primary/10 text-primary" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                            )}>
                              {mode === "HOME" ? <Home className="w-3 h-3" /> : <Hospital className="w-3 h-3" />}
                              {mode === "HOME" ? "Home" : "Hospital"}
                            </span>
                          </div>
                          <DatePicker
                            value={row.date}
                            fromDate={minScheduleDate}
                            onChange={(isoDate) => {
                              const next = scheduled.slice();
                              next[idx] = { ...row, date: isoDate };
                              setScheduled(next);
                            }}
                          />
                          <Input
                            type="time"
                            value={row.time}
                            onChange={(e) => {
                              const next = scheduled.slice();
                              next[idx] = { ...row, time: e.target.value };
                              setScheduled(next);
                            }}
                            className="h-9"
                          />
                          <span className="text-[11px] text-muted-foreground">
                            {row.date ? formatDate(`${row.date}T00:00:00Z`) : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              );
            })()}

            <DialogFooter>
              <Button variant="outline" onClick={closeApprove} disabled={approving}>Cancel</Button>
              <Button
                onClick={submitApprove}
                disabled={approving || !selectedTherapistId}
                className="gap-2"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm & Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject modal */}
        <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && closeReject()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                Reject Home Therapy Request
              </DialogTitle>
              <DialogDescription>
                The requesting doctor will see this reason. Required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="rt-reason">Rejection reason</Label>
              <Textarea
                id="rt-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value.slice(0, 500))}
                maxLength={500}
                placeholder="e.g. No therapist with the required certification is available this month."
                className="min-h-[100px]"
              />
              <p className="text-[11px] text-muted-foreground text-right">{rejectReason.length}/500</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeReject} disabled={rejecting}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={submitReject}
                disabled={rejecting || rejectReason.trim().length === 0}
                className="gap-2"
              >
                {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit modal — change therapist and/or schedule of an APPROVED or
            IN_PROGRESS request. Locked rows for non-SCHEDULED sessions. */}
        <Dialog open={!!editTarget} onOpenChange={(open) => !open && closeEdit()}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-primary" />
                Edit Home Therapy Schedule
              </DialogTitle>
              <DialogDescription>
                {editTarget && (
                  <>
                    For <span className="font-semibold text-foreground">{editTarget.patient?.fullName ?? "—"}</span>{" "}
                    · {editRows.length} session{editRows.length === 1 ? "" : "s"} ·{" "}
                    {modeBreakdown(editRows.map((r) => r.mode))}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {editTarget && (() => {
              const minScheduleDate = (() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() + 2);
                return d;
              })();
              return (
              <div className="space-y-4">
                {/* Therapist picker — applies to all SCHEDULED sessions */}
                <div className="space-y-1.5">
                  <Label>Assigned therapist</Label>
                  <SearchableSelect
                    value={editTherapistId}
                    onChange={setEditTherapistId}
                    placeholder={editTherapistsLoading ? "Loading…" : "Pick a therapist"}
                    items={editTherapists.map((t) => ({
                      value: t.id,
                      label: t.fullName ?? "Therapist",
                      sub: [t.specialization].filter(Boolean).join(" · ") || undefined,
                    }))}
                    emptyMessage="No therapists in this branch"
                    loading={editTherapistsLoading}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Reassignment applies to every session that is still <span className="font-semibold">SCHEDULED</span>. Sessions that have started or completed retain their original therapist.
                  </p>
                </div>

                {/* Sessions table — locked rows for non-SCHEDULED */}
                <div className="rounded-xl border border-border/50 bg-secondary/10 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-primary" />
                      Sessions
                    </div>
                    <Button variant="outline" size="sm" onClick={addEditRow} className="gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      Add session
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[360px] overflow-y-auto">
                    {editRows.map((row, idx) => {
                      const locked = !!row.existingStatus && row.existingStatus !== "SCHEDULED";
                      return (
                        <div
                          key={`${row.sessionNumber}-${row.existingId ?? "new"}`}
                          className={cn(
                            "grid grid-cols-1 sm:grid-cols-[110px_1fr_140px_100px_36px] gap-2 items-end p-2 rounded-lg border",
                            locked ? "bg-muted/30 border-muted opacity-80" : "bg-background border-border/40",
                          )}
                        >
                          <div className="text-sm font-medium flex items-center gap-2">
                            Session {row.sessionNumber}
                            {locked && (
                              <span title={`Status: ${row.existingStatus}`} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                                <Lock className="w-3 h-3" />
                                {row.existingStatus}
                              </span>
                            )}
                            {!row.existingId && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                New
                              </span>
                            )}
                          </div>
                          <DatePicker
                            value={row.date}
                            fromDate={!locked ? minScheduleDate : undefined}
                            disabled={locked}
                            onChange={(isoDate) => {
                              setEditRows((prev) => prev.map((r, i) => i === idx ? { ...r, date: isoDate } : r));
                            }}
                          />
                          <Input
                            type="time"
                            value={row.time}
                            disabled={locked}
                            onChange={(e) => {
                              setEditRows((prev) => prev.map((r, i) => i === idx ? { ...r, time: e.target.value } : r));
                            }}
                            className="h-9"
                          />
                          <select
                            value={row.mode}
                            disabled={locked}
                            onChange={(e) => {
                              const value = e.target.value as SessionMode;
                              setEditRows((prev) => prev.map((r, i) => i === idx ? { ...r, mode: value } : r));
                            }}
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            <option value="HOME">Home</option>
                            <option value="HOSPITAL">Hospital</option>
                          </select>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={locked}
                            onClick={() => removeEditRow(row.sessionNumber)}
                            title={locked ? "Locked — session is in flight or done" : "Drop this session"}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                    {editRows.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No sessions — add one above.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}

            <DialogFooter>
              <Button variant="outline" onClick={closeEdit} disabled={editing}>Cancel</Button>
              <Button
                onClick={submitEdit}
                disabled={editing || !editTherapistId || editRows.length === 0}
                className="gap-2"
              >
                {editing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Save changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>
    </AppLayout>
  );
}

function EmptyState({ status }: { status: HomeTherapyStatus }) {
  const map: Record<HomeTherapyStatus, { title: string; copy: string }> = {
    PENDING_APPROVAL: { title: "No pending requests",
      copy: "When a doctor refers a patient for at-home therapy on the prescription form, the request will appear here for review." },
    APPROVED: { title: "No approved requests yet",
      copy: "Approved requests with their scheduled sessions show up here." },
    REJECTED: { title: "No rejected requests",
      copy: "Rejected requests are listed here for audit purposes." },
    COMPLETED: { title: "No completed requests yet",
      copy: "Once all sessions of a request finish, the request lands here." },
    IN_PROGRESS: { title: "Nothing in progress", copy: "" },
    CANCELLED:   { title: "Nothing cancelled",   copy: "" },
  };
  const m = map[status];
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/10 px-6 py-10 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-secondary/40 flex items-center justify-center mb-3">
        <HeartHandshake className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{m.title}</h3>
      {m.copy && <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">{m.copy}</p>}
    </div>
  );
}

interface RequestCardProps {
  request: HomeTherapyRequest;
  isNew: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
}

function RequestCard({ request, isNew, onApprove, onReject, onEdit }: RequestCardProps) {
  const breakdown = useMemo(() => modeBreakdown(request.sessionMode), [request.sessionMode]);
  const isPending = request.status === "PENDING_APPROVAL";
  // Edit is available once the request is approved and at least one session
  // is still SCHEDULED. Terminal statuses (COMPLETED / REJECTED / CANCELLED)
  // get no Edit affordance.
  const canEdit =
    (request.status === "APPROVED" || request.status === "IN_PROGRESS") &&
    Array.isArray(request.sessions) &&
    request.sessions.some((s) => s.status === "SCHEDULED");
  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-background p-4 space-y-3 transition-shadow",
        isNew ? "border-primary shadow-lg ring-2 ring-primary/30 animate-pulse" : "border-border/60 shadow-sm",
      )}
    >
      {isNew && (
        <span className="absolute -top-2 left-3 inline-flex items-center px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide">
          New
        </span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <User className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground truncate">{request.patient?.fullName ?? "Patient"}</span>
            {request.patient?.patientId && (
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded">
                {request.patient.patientId}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>{request.requestingDoctor?.fullName ?? "Doctor"}</span>
            {request.requestingDoctor?.specialization && (
              <span>· {request.requestingDoctor.specialization}</span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            <span>{request.branch?.name ?? "Branch"}</span>
          </div>
        </div>
        <Badge className={cn("shrink-0", STATUS_BADGE_TONE[request.status])}>
          {request.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="w-3.5 h-3.5" />
          <span>Requested {formatDate(request.createdAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-foreground font-medium">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span>{request.totalSessions} session{request.totalSessions === 1 ? "" : "s"}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Home className="w-3.5 h-3.5 text-primary" />
          <span>{breakdown}</span>
          {request.intervalDays ? <span className="text-muted-foreground">· every {request.intervalDays}d</span> : null}
        </div>
      </div>

      {request.notes && (
        <div className="rounded-lg bg-secondary/20 px-3 py-2 text-xs text-foreground">
          <span className="font-semibold mr-1">Doctor's note:</span>{request.notes}
        </div>
      )}

      {request.status === "REJECTED" && request.rejectedReason && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200/60 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <span className="font-semibold mr-1 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Rejected:
          </span>
          {request.rejectedReason}
        </div>
      )}

      {request.status === "APPROVED" && request.sessions && request.sessions.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Therapist:{" "}
          <span className="text-foreground font-medium">
            {request.sessions[0].therapist?.fullName ?? "—"}
          </span>
          {" · "}
          first session{" "}
          <span className="text-foreground font-medium">
            {formatDate(request.sessions[0].scheduledDate)} {request.sessions[0].scheduledTime}
          </span>
        </div>
      )}

      {isPending && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            Reject
          </Button>
          <Button size="sm" onClick={onApprove} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Approve
          </Button>
        </div>
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
            <Pencil className="w-4 h-4" />
            Edit schedule
          </Button>
        </div>
      )}
    </div>
  );
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
