// Group Session Workspace — clinician landing page for a single
// GroupSession. Shows the enrolled patient roster, lets the therapist
// mark attendance during the sitting, hold notes, and complete the
// session.
//
// Backend endpoints in use:
//   GET   /api/group-sessions/:id/roster      → session + participants + attendedParticipantIds
//   PATCH /api/group-sessions/:id/attendance  → toggle a participant present/absent
//   POST  /api/group-sessions/:id/complete    → present → COMPLETED, absent → NO_SHOW
//
// Attendance defaults to ABSENT for every enrolled patient. The therapist
// flips each participant present manually as they arrive. Only present
// patients count toward session completion — the backend's complete()
// transaction reads attendedParticipantIds and sets each appointment's
// status accordingly.
//
// Notes still live in component state only — persisting per-session
// notes would require an additional schema field. A banner under the
// textarea tells the clinician to capture durable notes in the patient
// timeline.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, ClipboardList, Clock, DoorOpen, Loader2, MapPin,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { iwisApi } from "@/services/iwis.service";

interface RosterParticipant {
  id: string;
  patient: {
    id: string;
    fullName: string | null;
    phoneNumber: string | null;
  } | null;
}

interface RosterResponse {
  id: string;
  title: string;
  sessionType: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  maxCapacity: number;
  appointments: RosterParticipant[];
  attendedParticipantIds?: string[];
  therapist?: { fullName: string | null } | null;
  room?: { name: string | null } | null;
}

function initials(name: string | null | undefined): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function GroupSessionWorkspace() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  // Attendance roll — keyed on appointmentId (the unique membership row).
  // Defaults to ABSENT for every enrolled patient; the therapist flips each
  // patient present as they arrive. Seeded from the session's
  // attendedParticipantIds so re-opening a session preserves the marks.
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    iwisApi
      .getGroupRoster(sessionId)
      .then((resp) => {
        if (cancelled) return;
        const roster = resp as RosterResponse;
        setData(roster);
        // Seed attendance: ABSENT by default, PRESENT only for participants
        // already in the server-side attendedParticipantIds array.
        const present = new Set(roster.attendedParticipantIds ?? []);
        const seed: Record<string, boolean> = {};
        for (const row of roster.appointments ?? []) seed[row.id] = present.has(row.id);
        setAttendance(seed);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load session");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  const toggleAttendance = async (appointmentId: string) => {
    if (!sessionId) return;
    const previous = attendance[appointmentId] ?? false;
    const next = !previous;
    // Optimistic update so the UI reflects the click instantly; rolled
    // back below if the PATCH fails.
    setAttendance((prev) => ({ ...prev, [appointmentId]: next }));
    try {
      await iwisApi.setGroupSessionAttendance(sessionId, {
        participantId: appointmentId,
        isPresent: next,
      });
    } catch (err: unknown) {
      setAttendance((prev) => ({ ...prev, [appointmentId]: previous }));
      toast({
        title: "Couldn't update attendance",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  };

  const attendedCount = useMemo(
    () => Object.values(attendance).filter(Boolean).length,
    [attendance],
  );

  const handleComplete = async () => {
    if (!sessionId || !data) return;
    const total = data.appointments.length;
    if (total > 0) {
      const confirmed = window.confirm(
        `${attendedCount} of ${total} patient${total === 1 ? "" : "s"} marked present. ` +
          `Completing locks the session: present patients' appointments become COMPLETED, ` +
          `absent become NO_SHOW. Continue?`,
      );
      if (!confirmed) return;
    }
    setCompleting(true);
    try {
      await iwisApi.completeGroupSession(sessionId);
      toast({ title: "Session completed" });
      navigate("/group-sessions");
    } catch (err: unknown) {
      toast({
        title: "Couldn't complete session",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-5xl mx-auto px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (loadError || !data) {
    return (
      <AppLayout>
        <div className="container max-w-5xl mx-auto px-4 py-8 space-y-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/group-sessions")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to group sessions
          </Button>
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {loadError || "Session not found."}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const isLocked = data.status === "COMPLETED" || data.status === "CANCELLED";

  return (
    <AppLayout>
      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/group-sessions")}
          className="-ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to group sessions
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
            <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
              <span>{data.sessionType}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(data.date).toLocaleDateString()} · {data.startTime}–{data.endTime}
              </span>
              {data.room?.name && (
                <span className="inline-flex items-center gap-1">
                  <DoorOpen className="w-3.5 h-3.5" />
                  {data.room.name}
                </span>
              )}
              {data.therapist?.fullName && (
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {data.therapist.fullName}
                </span>
              )}
            </p>
          </div>
          <Badge variant={isLocked ? "secondary" : "default"}>{data.status}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Participants column ---------------------------------------- */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Participants
              </CardTitle>
              <Badge variant="outline">
                {attendedCount} / {data.appointments.length} present
              </Badge>
            </CardHeader>
            <CardContent>
              {data.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic py-4 text-center">
                  No patients enrolled yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.appointments.map((row) => {
                    const present = attendance[row.id] ?? false;
                    const name = row.patient?.fullName || "Unnamed patient";
                    return (
                      <li
                        key={row.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border bg-card"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {initials(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{name}</p>
                          {row.patient?.phoneNumber && (
                            <p className="text-[11px] text-muted-foreground truncate">
                              {row.patient.phoneNumber}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleAttendance(row.id)}
                          disabled={isLocked}
                          aria-pressed={present}
                          aria-label={`Toggle attendance for ${name}`}
                          className={
                            "shrink-0 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors " +
                            "disabled:opacity-60 disabled:cursor-not-allowed " +
                            (present
                              ? "bg-green-100 text-green-700 border-green-300 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200")
                          }
                        >
                          {present ? "✓ Present" : "Absent"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Notes column ----------------------------------------------- */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" /> Session notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLocked}
                rows={10}
                placeholder={isLocked
                  ? "This session is locked."
                  : "Track today's flow — postures covered, group energy, individual moments worth recording…"}
                className="resize-y min-h-[220px]"
              />
              <div className="rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900 leading-relaxed flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  These notes are kept local to this screen. For durable
                  per-patient records, capture observations in each
                  participant&apos;s timeline after the session.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {!isLocked && (
          <div className="flex justify-end">
            <Button onClick={handleComplete} disabled={completing}>
              {completing
                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Completing…</>
                : <><CheckCircle2 className="w-4 h-4 mr-1" /> Complete session</>}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
