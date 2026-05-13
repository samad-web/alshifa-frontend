// Therapist-side Treatment Package delivery view.
//
// The spec describes a Start → Complete two-step flow with PENDING /
// IN_PROGRESS / COMPLETED states per session. The actual schema has no
// per-session row before delivery — PackageSessionLog is an event log
// created at completion time, and a therapist is only linked to a
// package via that log. So this page reframes the spec onto the
// existing data model:
//
//   • A "session" = one row in PackageSessionLog (post-completion).
//   • "Progress" = sessionsUsed / sessionsTotal on the enrolment.
//   • The Start button is omitted (no in-progress state to track).
//     Therapists click "Log Session" → dialog (type + notes + duration
//     in notes) → POST to the existing /log-session endpoint, which
//     atomically increments sessionsUsed and creates the log row.
//
// Filter tabs map onto the available signals:
//   All        — every enrolment surfaced by the backend.
//   Active     — enrolment.status === ACTIVE && sessionsRemaining > 0.
//   Completed  — enrolment.status === COMPLETED (all sessions logged).

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, CheckCircle2, ClipboardList, Loader2, Package as PackageIcon,
  Plus, RefreshCw, Stethoscope,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { iwisApi, type TherapistEnrolment } from "@/services/iwis.service";

type FilterKey = "ALL" | "ACTIVE" | "COMPLETED";

const STATUS_TONE: Record<string, string> = {
  ACTIVE:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
  PAUSED:    "bg-amber-100 text-amber-700 border-amber-200",
};

function initialsOf(name: string | null | undefined): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function TherapistPackageSessions() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const therapistId = profile?.therapist?.id ?? null;

  const [enrolments, setEnrolments] = useState<TherapistEnrolment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("ALL");

  // Log-Session dialog state — single source of truth lifted out of the
  // card so two dialogs can't be open at once.
  const [loggingFor, setLoggingFor] = useState<TherapistEnrolment | null>(null);
  const [sessionType, setSessionType] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await iwisApi.listTherapistPackageSessions();
      setEnrolments(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return enrolments;
    if (filter === "ACTIVE") {
      return enrolments.filter((e) => e.status === "ACTIVE" && e.sessionsRemaining > 0);
    }
    return enrolments.filter((e) => e.status === "COMPLETED");
  }, [enrolments, filter]);

  const totals = useMemo(() => ({
    all:       enrolments.length,
    active:    enrolments.filter((e) => e.status === "ACTIVE" && e.sessionsRemaining > 0).length,
    completed: enrolments.filter((e) => e.status === "COMPLETED").length,
  }), [enrolments]);

  const openLogDialog = (row: TherapistEnrolment) => {
    setLoggingFor(row);
    // Pre-seed the type from the package name as a sensible default.
    setSessionType(row.packageName || "");
    setDurationMinutes(45);
    setNotes("");
  };

  const submitLog = async () => {
    if (!loggingFor || !therapistId) return;
    if (!sessionType.trim()) {
      toast({
        title: "Session type required",
        description: "Enter what was delivered (e.g. Abhyanga, Shirodhara).",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      // Duration is folded into the notes since PackageSessionLog has no
      // duration column. Preserves the spec's intent without a schema
      // migration; the doctor's read-side view still sees the value
      // alongside the therapist's free-text observations.
      const composedNotes = notes.trim()
        ? `Duration: ${durationMinutes} min\n${notes.trim()}`
        : `Duration: ${durationMinutes} min`;
      await iwisApi.logPackageSession(loggingFor.enrolmentId, {
        sessionType: sessionType.trim(),
        conductedById: therapistId,
        notes: composedNotes,
      });
      toast({ title: "Session logged" });
      setLoggingFor(null);
      await load();
    } catch (err: unknown) {
      toast({
        title: "Couldn't log session",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <PageHeader
          title="My Package Sessions"
          subtitle="Treatment package work assigned to your branch and your own delivery history."
        >
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </PageHeader>

        {!therapistId && (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Your therapist profile isn&apos;t linked yet — ask the admin to set it
              up before logging sessions.
            </CardContent>
          </Card>
        )}

        {/* Filter tabs --------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
          {([
            { key: "ALL",       label: "All",       count: totals.all },
            { key: "ACTIVE",    label: "In flight", count: totals.active },
            { key: "COMPLETED", label: "Completed", count: totals.completed },
          ] as const).map((t) => (
            <Button
              key={t.key}
              variant={filter === t.key ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter(t.key)}
              className="gap-2"
            >
              {t.label}
              <Badge variant="outline" className="bg-background text-muted-foreground">
                {t.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* List ---------------------------------------------------------- */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-6 text-center space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <PackageIcon className="w-10 h-10 mx-auto opacity-40" />
              <p className="font-medium text-foreground">
                {filter === "ALL"
                  ? "No package sessions assigned to you yet."
                  : `No ${filter.toLowerCase()} enrolments to show.`}
              </p>
              <p className="text-xs">
                When a doctor enrols a patient in a treatment package, the
                enrolment shows up here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((row) => {
              const tone = STATUS_TONE[row.status] || "bg-muted text-muted-foreground border-border";
              const patientName = row.patient?.fullName || "Unnamed patient";
              const canLog = row.status === "ACTIVE" && row.sessionsRemaining > 0;
              return (
                <Card key={row.enrolmentId} className="rounded-2xl">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {initialsOf(patientName)}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">{patientName}</CardTitle>
                          <p className="text-xs text-muted-foreground truncate">
                            {row.packageName ?? "—"}
                            {row.patient?.patientId ? ` · ${row.patient.patientId}` : ""}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={tone}>{row.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress -------------------------------------- */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {row.sessionsUsed} of {row.sessionsTotal} sessions completed
                        </span>
                        <span className="font-mono">{row.progressPct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, row.progressPct)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Started {shortDate(row.startDate)} · ends {shortDate(row.endDate)}
                      </p>
                    </div>

                    {/* My sessions on this enrolment ----------------- */}
                    {row.mySessions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                          <ClipboardList className="w-3 h-3" />
                          Your delivered sessions ({row.mySessions.length})
                        </p>
                        <ul className="space-y-1">
                          {row.mySessions.slice(0, 5).map((s) => (
                            <li
                              key={s.id}
                              className="flex items-start gap-2 text-xs p-2 rounded-md bg-muted/40"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium truncate">{s.sessionType}</span>
                                  <span className="text-muted-foreground">
                                    · {shortDateTime(s.conductedAt)}
                                  </span>
                                </div>
                                {s.notes && (
                                  <p className="text-muted-foreground mt-0.5 line-clamp-2 whitespace-pre-wrap">
                                    {s.notes}
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                          {row.mySessions.length > 5 && (
                            <li className="text-[11px] text-muted-foreground italic px-1">
                              + {row.mySessions.length - 5} earlier sessions
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Actions -------------------------------------- */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      {row.patient?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/patients/${row.patient!.id}/timeline`)}
                          className="text-xs"
                        >
                          <Stethoscope className="w-3.5 h-3.5 mr-1" />
                          Open patient timeline
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                      {canLog && (
                        <Button
                          size="sm"
                          onClick={() => openLogDialog(row)}
                          disabled={!therapistId}
                          className="gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Log next session
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Log-session dialog ------------------------------------------- */}
      <Dialog
        open={!!loggingFor}
        onOpenChange={(o) => { if (!o && !submitting) setLoggingFor(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log session</DialogTitle>
            <DialogDescription>
              {loggingFor
                ? `${loggingFor.patient?.fullName ?? "Patient"} · ${loggingFor.packageName ?? "Package"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="log-session-type" className="text-xs">
                Session type <span className="text-destructive">*</span>
              </Label>
              <Input
                id="log-session-type"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                placeholder="e.g. Abhyanga, Shirodhara"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-duration" className="text-xs">
                Duration (minutes)
              </Label>
              <Input
                id="log-duration"
                type="number"
                min={1}
                max={240}
                value={durationMinutes}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setDurationMinutes(Number.isFinite(n) ? Math.max(1, Math.min(240, n)) : 45);
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Stored as a prefix in the notes — the schema has no duration column.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-notes" className="text-xs">
                Notes (optional)
              </Label>
              <Textarea
                id="log-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was delivered, patient response, anything the next session should know"
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setLoggingFor(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitLog()} disabled={submitting}>
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Logging…</>
                : <><CheckCircle2 className="w-4 h-4 mr-1" /> Mark complete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
