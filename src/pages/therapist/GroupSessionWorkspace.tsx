// Group Session Workspace — clinician landing page for a single
// GroupSession. Shows the enrolled patient roster, lets the therapist
// hold local-only session notes during the sitting, and exposes the
// existing Complete action.
//
// Backend scope today (intentionally minimal — see batch notes):
//   GET  /api/group-sessions/:id/roster   → session + participants
//   POST /api/group-sessions/:id/complete → flip status to COMPLETED
//
// Notes + attendance live in component state only — persisting either
// would require new `notes` / `attendance` columns on GroupSession plus a
// PATCH endpoint, which is deferred to a follow-up batch (would need a
// schema migration + backend restart per the project's prisma policy).
// A banner under the notes field surfaces this so the clinician knows
// to capture durable notes in the patient timeline.
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
  // Local attendance — keyed on appointmentId since that's the unique
  // membership row. Defaults to "attended" (true) for every enrolled patient,
  // mirroring the typical group-session flow where everyone shows up.
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
        setData(resp as RosterResponse);
        // Seed attendance: assume present unless toggled off.
        const seed: Record<string, boolean> = {};
        for (const row of resp.appointments ?? []) seed[row.id] = true;
        setAttendance(seed);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load session");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sessionId]);

  const toggleAttendance = (appointmentId: string) => {
    setAttendance((prev) => ({ ...prev, [appointmentId]: !prev[appointmentId] }));
  };

  const attendedCount = useMemo(
    () => Object.values(attendance).filter(Boolean).length,
    [attendance],
  );

  const handleComplete = async () => {
    if (!sessionId) return;
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
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none shrink-0">
                          <input
                            type="checkbox"
                            checked={present}
                            onChange={() => toggleAttendance(row.id)}
                            disabled={isLocked}
                            className="accent-primary h-4 w-4"
                            aria-label={`Mark ${name} present`}
                          />
                          <span className={present ? "text-primary font-medium" : "text-muted-foreground"}>
                            Present
                          </span>
                        </label>
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
