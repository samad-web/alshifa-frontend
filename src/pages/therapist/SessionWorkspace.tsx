/**
 * Therapist Session Workspace.
 *
 * Phase A (preserved exactly — do not refactor):
 *   1. Running timer driven by `startedAt`.
 *   2. Free-form notes textarea with 5-second debounced autosave
 *      (PATCH /api/therapy-sessions/:id/notes — backend collapses bursts
 *      into a single row via the 60-second upsert window).
 *   3. Complete button → POST /api/therapy-sessions/:id/complete, then
 *      navigate back to /therapist.
 *
 * Phase B1 (additive, new sections below the notes textarea):
 *   4. Pain readings panel (0–10 slider, optional body region).
 *   5. Region-tagged notes panel (region + free text observation).
 *   6. Session photos panel (reuses JourneyPhotoUpload with
 *      therapySessionId tagged).
 *   7. Complete now opens a structured outcome Dialog; on submit, the
 *      outcome is sent in the same /complete call (backend creates a
 *      SessionOutcome row inside the existing transaction).
 *
 * Phase B2 (NOT here): consumables, therapy checklist, patient history
 * sidebar, doctor escalation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity, ArrowLeft, Camera, CheckCircle2, Loader2, MapPin,
  Pencil, Plus, Save, X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { therapySessionApi, type CompleteSessionOutcome } from "@/services/therapySession.service";
import { JourneyPhotoUpload } from "@/components/patient/JourneyPhotoUpload";
import type {
  SessionOverallOutcome, SessionTolerance, TherapySession,
} from "@/types";

const AUTOSAVE_DELAY_MS = 5_000;

function formatElapsed(startIso: string, now: number): string {
  const start = new Date(startIso).getTime();
  const totalSec = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function SessionWorkspace() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [session, setSession] = useState<TherapySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [completing, setCompleting] = useState(false);
  const [now, setNow] = useState(Date.now());

  // ── Phase B1 panel state ────────────────────────────────────────────────
  const [painFormOpen, setPainFormOpen] = useState(false);
  const [painScale, setPainScale] = useState(5);
  const [painRegion, setPainRegion] = useState("");
  const [savingPain, setSavingPain] = useState(false);

  /** Region notes inline form: null = closed; "new" = adding; <id> = editing. */
  const [regionFormFor, setRegionFormFor] = useState<string | null>(null);
  const [regionFormRegion, setRegionFormRegion] = useState("");
  const [regionFormBody, setRegionFormBody] = useState("");
  const [savingRegion, setSavingRegion] = useState(false);

  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  // ── Phase B1 outcome dialog state ───────────────────────────────────────
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [overallOutcome, setOverallOutcome] = useState<SessionOverallOutcome | "">("");
  const [patientTolerance, setPatientTolerance] = useState<SessionTolerance | "">("");
  const [nextSessionFocus, setNextSessionFocus] = useState("");
  const [homeCareInstructions, setHomeCareInstructions] = useState("");

  // Persist a stable ref to the saved-notes baseline so the autosave effect
  // can skip writes when the user hasn't actually changed anything (e.g. typed
  // a character then deleted it).
  const savedNotesRef = useRef("");
  savedNotesRef.current = savedNotes;

  // Track unmount so in-flight `saveNotes` / `complete` POSTs that resolve
  // after the user has navigated away don't trigger setState on a dead tree.
  // (We can't cancel the fetch itself — apiClient doesn't accept AbortSignal —
  // but we can swallow the result.)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load session ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await therapySessionApi.getById(sessionId);
        if (cancelled) return;
        setSession(data);
        const initial = data.notes && data.notes.length > 0
          ? data.notes[data.notes.length - 1].body
          : "";
        setNotes(initial);
        setSavedNotes(initial);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // ── Tick timer once a second ─────────────────────────────────────────────
  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [session]);

  // ── Debounced autosave ───────────────────────────────────────────────────
  const saveNow = useCallback(async (body: string) => {
    if (!sessionId) return;
    setSavingState("saving");
    try {
      await therapySessionApi.saveNotes(sessionId, body);
      if (!mountedRef.current) return;
      setSavedNotes(body);
      setSavingState("saved");
      setLastSavedAt(Date.now());
    } catch (err) {
      if (!mountedRef.current) return;
      setSavingState("error");
      toast({
        title: "Couldn't save notes",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }, [sessionId, toast]);

  useEffect(() => {
    if (!session || session.status !== "IN_PROGRESS") return;
    if (notes === savedNotesRef.current) return;
    const timer = setTimeout(() => { void saveNow(notes); }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [notes, session, saveNow]);

  // ── Complete ─────────────────────────────────────────────────────────────
  // Phase B1 additive change: accepts an optional structured outcome which
  // is forwarded to the API call. When called with no argument (Phase A's
  // original signature), behaviour is exactly Phase A.
  async function handleComplete(outcome?: CompleteSessionOutcome) {
    if (!sessionId || !session) return;
    setCompleting(true);
    try {
      // Flush any pending autosave before locking the session — the backend
      // returns 409 SESSION_LOCKED on PATCH /notes once status flips to
      // COMPLETED, so we must save *first*, then complete.
      if (notes !== savedNotesRef.current) {
        await therapySessionApi.saveNotes(sessionId, notes);
      }
      await therapySessionApi.complete(sessionId, outcome);
      toast({ title: "Session completed" });
      navigate("/therapist");
    } catch (err) {
      if (!mountedRef.current) return;
      toast({
        title: "Couldn't complete session",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
      setCompleting(false);
    }
  }

  // ── Phase B1 helpers ─────────────────────────────────────────────────────

  /** Re-fetch the session to refresh painReadings/regionNotes/photos lists
   *  after a B1 mutation. We don't optimistically merge because the backend
   *  is the source of truth for ids and timestamps. */
  const refetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const fresh = await therapySessionApi.getById(sessionId);
      if (!mountedRef.current) return;
      setSession(fresh);
    } catch {
      // Silent — the panels will simply not refresh; user can retry the action.
    }
  }, [sessionId]);

  async function handleAddPain() {
    if (!sessionId) return;
    setSavingPain(true);
    try {
      await therapySessionApi.addPainReading(sessionId, {
        scale: painScale,
        bodyRegion: painRegion.trim() || undefined,
      });
      await refetchSession();
      if (!mountedRef.current) return;
      setPainFormOpen(false);
      setPainScale(5);
      setPainRegion("");
    } catch (err) {
      if (!mountedRef.current) return;
      toast({
        title: "Couldn't save pain reading",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      if (mountedRef.current) setSavingPain(false);
    }
  }

  function openRegionFormForNew() {
    setRegionFormFor("new");
    setRegionFormRegion("");
    setRegionFormBody("");
  }

  function openRegionFormForEdit(noteId: string, bodyRegion: string, body: string) {
    setRegionFormFor(noteId);
    setRegionFormRegion(bodyRegion);
    setRegionFormBody(body);
  }

  function closeRegionForm() {
    setRegionFormFor(null);
    setRegionFormRegion("");
    setRegionFormBody("");
  }

  async function handleSaveRegion() {
    if (!sessionId) return;
    const region = regionFormRegion.trim();
    const body = regionFormBody.trim();
    if (!region || !body) return;
    setSavingRegion(true);
    try {
      if (regionFormFor === "new") {
        await therapySessionApi.addRegionNote(sessionId, { bodyRegion: region, body });
      } else if (regionFormFor) {
        await therapySessionApi.updateRegionNote(sessionId, regionFormFor, { bodyRegion: region, body });
      }
      await refetchSession();
      if (!mountedRef.current) return;
      closeRegionForm();
    } catch (err) {
      if (!mountedRef.current) return;
      toast({
        title: "Couldn't save region note",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      if (mountedRef.current) setSavingRegion(false);
    }
  }

  function openOutcomeDialog() {
    // Pre-fill from existing outcome if the user re-opens the dialog
    // (defensive — the dialog is gated on !isReadOnly so an existing
    // outcome shouldn't be reachable here, but keeps the form sane).
    setOverallOutcome(session?.outcome?.overallOutcome ?? "");
    setPatientTolerance(session?.outcome?.patientTolerance ?? "");
    setNextSessionFocus(session?.outcome?.nextSessionFocus ?? "");
    setHomeCareInstructions(session?.outcome?.homeCareInstructions ?? "");
    setOutcomeOpen(true);
  }

  async function submitOutcomeAndComplete() {
    if (!overallOutcome || !patientTolerance) return;
    const outcome: CompleteSessionOutcome = {
      overallOutcome,
      patientTolerance,
      nextSessionFocus: nextSessionFocus.trim() || undefined,
      homeCareInstructions: homeCareInstructions.trim() || undefined,
    };
    // Close the dialog before the network call so the user sees the
    // workspace's "Completing…" state immediately.
    setOutcomeOpen(false);
    await handleComplete(outcome);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-5xl mx-auto px-4 py-8 flex items-center justify-center min-h-[40vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (loadError || !session) {
    return (
      <AppLayout>
        <div className="container max-w-5xl mx-auto px-4 py-8 space-y-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/therapist")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
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

  const isReadOnly = session.status !== "IN_PROGRESS";
  const isDirty = notes !== savedNotes;

  return (
    <AppLayout>
      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/therapist")}
          className="-ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to dashboard
        </Button>

        <PageHeader
          title={session.patient?.fullName || "Session in progress"}
          subtitle={[
            session.patient?.patientId ? `ID ${session.patient.patientId}` : null,
            session.patient?.phoneNumber || null,
          ].filter(Boolean).join(" · ") || undefined}
        >
          <Badge variant={isReadOnly ? "secondary" : "default"}>
            {session.status.replace("_", " ")}
          </Badge>
        </PageHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Elapsed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-semibold tabular-nums">
                {formatElapsed(session.startedAt, now)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Started {new Date(session.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Appointment
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {session.appointment ? (
                <>
                  <div>
                    {new Date(session.appointment.date).toLocaleString([], {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </div>
                  <div className="text-muted-foreground">
                    {session.appointment.consultationType} · {session.appointment.consultationMode}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">—</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Session notes</CardTitle>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {savingState === "saving" && (
                <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
              )}
              {savingState === "saved" && !isDirty && lastSavedAt && (
                <><Save className="w-3 h-3" /> Saved {new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
              )}
              {savingState === "error" && (
                <span className="text-destructive">Save failed — keep typing to retry</span>
              )}
              {savingState === "idle" && isDirty && (
                <span>Unsaved changes</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (savingState === "saved") setSavingState("idle");
              }}
              disabled={isReadOnly}
              maxLength={10_000}
              rows={14}
              placeholder={isReadOnly
                ? "This session is read-only."
                : "Type observations, treatments performed, patient response… autosaves every 5 seconds."}
              className="resize-y min-h-[280px]"
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {notes.length} / 10,000
            </div>
          </CardContent>
        </Card>

        {/* ── Phase B1: Pain readings panel ─────────────────────────────── */}
        <Card className="rounded-2xl">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Pain readings
            </CardTitle>
            {!isReadOnly && !painFormOpen && (
              <Button size="sm" variant="secondary" onClick={() => setPainFormOpen(true)}>
                <Plus className="w-3 h-3 mr-1" /> Add reading
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {(session.painReadings ?? []).length === 0 && !painFormOpen && (
              <div className="text-sm text-muted-foreground">No pain readings recorded.</div>
            )}
            {(session.painReadings ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center min-w-[2.25rem] h-7 px-2 rounded-md bg-primary/10 text-primary font-medium tabular-nums">
                    {p.scale}/10
                  </span>
                  <span>{p.bodyRegion || "general"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(p.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            {painFormOpen && (
              <div className="bg-muted/40 rounded-md p-3 space-y-3">
                <div>
                  <Label className="text-xs">Pain scale</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={painScale}
                      onChange={(e) => setPainScale(Number(e.target.value))}
                      className="flex-1 accent-primary"
                      aria-label="Pain scale"
                    />
                    <span className="text-2xl font-medium tabular-nums w-10 text-right">{painScale}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs" htmlFor="pain-region">Body region (optional)</Label>
                  <Input
                    id="pain-region"
                    value={painRegion}
                    onChange={(e) => setPainRegion(e.target.value)}
                    placeholder="e.g. lower back"
                    maxLength={100}
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setPainFormOpen(false); setPainScale(5); setPainRegion(""); }}
                    disabled={savingPain}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleAddPain} disabled={savingPain}>
                    {savingPain ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Phase B1: Region-specific notes panel ─────────────────────── */}
        <Card className="rounded-2xl">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" /> Region-specific notes
            </CardTitle>
            {!isReadOnly && regionFormFor !== "new" && (
              <Button size="sm" variant="secondary" onClick={openRegionFormForNew}>
                <Plus className="w-3 h-3 mr-1" /> Add region note
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {(session.regionNotes ?? []).length === 0 && regionFormFor !== "new" && (
              <div className="text-sm text-muted-foreground">No region-tagged notes recorded.</div>
            )}
            {(session.regionNotes ?? []).map((n) => (
              <div key={n.id}>
                {regionFormFor === n.id ? (
                  <RegionEditForm
                    region={regionFormRegion}
                    body={regionFormBody}
                    saving={savingRegion}
                    onRegion={setRegionFormRegion}
                    onBody={setRegionFormBody}
                    onCancel={closeRegionForm}
                    onSave={handleSaveRegion}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{n.bodyRegion}</div>
                      <div className="text-muted-foreground whitespace-pre-wrap break-words">{n.body}</div>
                    </div>
                    {!isReadOnly && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => openRegionFormForEdit(n.id, n.bodyRegion, n.body)}
                        aria-label="Edit region note"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {regionFormFor === "new" && (
              <RegionEditForm
                region={regionFormRegion}
                body={regionFormBody}
                saving={savingRegion}
                onRegion={setRegionFormRegion}
                onBody={setRegionFormBody}
                onCancel={closeRegionForm}
                onSave={handleSaveRegion}
              />
            )}
          </CardContent>
        </Card>

        {/* ── Phase B1: Session photos panel ────────────────────────────── */}
        <Card className="rounded-2xl">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Camera className="w-4 h-4 text-primary" /> Session photos
            </CardTitle>
            {!isReadOnly && (
              <Button size="sm" variant="secondary" onClick={() => setPhotoModalOpen(true)}>
                <Plus className="w-3 h-3 mr-1" /> Capture photo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {(session.photos ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No photos captured.</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {(session.photos ?? []).map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.filePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-md overflow-hidden bg-muted/40 border"
                  >
                    <img
                      src={photo.filePath}
                      alt={photo.notes || photo.bodyRegion || "Session photo"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Phase B1: Outcome (read-only display when set) ─────────────── */}
        {session.outcome && (
          <Card className="rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Session outcome
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Outcome: {session.outcome.overallOutcome}</Badge>
                <Badge variant="secondary">Tolerance: {session.outcome.patientTolerance}</Badge>
              </div>
              {session.outcome.nextSessionFocus && (
                <div>
                  <div className="text-xs text-muted-foreground mt-1">Next session focus</div>
                  <div className="whitespace-pre-wrap">{session.outcome.nextSessionFocus}</div>
                </div>
              )}
              {session.outcome.homeCareInstructions && (
                <div>
                  <div className="text-xs text-muted-foreground mt-1">Home-care instructions</div>
                  <div className="whitespace-pre-wrap">{session.outcome.homeCareInstructions}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-end gap-2">
          {!isReadOnly && (
            <>
              <Button
                variant="outline"
                onClick={() => void saveNow(notes)}
                disabled={!isDirty || savingState === "saving"}
              >
                <Save className="w-4 h-4 mr-1" /> Save now
              </Button>
              <Button
                onClick={openOutcomeDialog}
                disabled={completing}
              >
                {completing
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Completing…</>
                  : <><CheckCircle2 className="w-4 h-4 mr-1" /> Complete session</>}
              </Button>
            </>
          )}
        </div>

        {/* ── Phase B1: Photo capture modal ─────────────────────────────── */}
        {session.patient?.id && (
          <JourneyPhotoUpload
            open={photoModalOpen}
            onClose={() => setPhotoModalOpen(false)}
            patientId={session.patient.id}
            therapySessionId={session.id}
            titleOverride="Capture session photo"
            descriptionOverride="Tagged to this in-progress therapy session for clinical reference."
            onUploaded={() => { void refetchSession(); }}
          />
        )}

        {/* ── Phase B1: Outcome dialog (intercepts Complete) ────────────── */}
        <Dialog
          open={outcomeOpen}
          onOpenChange={(o) => { if (!completing) setOutcomeOpen(o); }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Complete session</DialogTitle>
              <DialogDescription>
                Capture the outcome and any guidance for the patient before locking the session.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm">Overall outcome <span className="text-destructive">*</span></Label>
                <RadioGroup
                  value={overallOutcome}
                  onValueChange={(v) => setOverallOutcome(v as SessionOverallOutcome)}
                  className="grid grid-cols-3 gap-2"
                >
                  {(["IMPROVED", "UNCHANGED", "REGRESSED"] as const).map((v) => (
                    <Label
                      key={v}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={v} />
                      <span className="text-sm">{v.charAt(0) + v.slice(1).toLowerCase()}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Patient tolerance <span className="text-destructive">*</span></Label>
                <RadioGroup
                  value={patientTolerance}
                  onValueChange={(v) => setPatientTolerance(v as SessionTolerance)}
                  className="grid grid-cols-3 gap-2"
                >
                  {(["GOOD", "MODERATE", "POOR"] as const).map((v) => (
                    <Label
                      key={v}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                    >
                      <RadioGroupItem value={v} />
                      <span className="text-sm">{v.charAt(0) + v.slice(1).toLowerCase()}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-sm" htmlFor="next-focus">Next session focus (optional)</Label>
                <Textarea
                  id="next-focus"
                  rows={3}
                  maxLength={1000}
                  value={nextSessionFocus}
                  onChange={(e) => setNextSessionFocus(e.target.value)}
                  placeholder="e.g. continue Vata-pacifying abhyanga; focus on lower back tension"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm" htmlFor="home-care">Home-care instructions (optional)</Label>
                <Textarea
                  id="home-care"
                  rows={3}
                  maxLength={2000}
                  value={homeCareInstructions}
                  onChange={(e) => setHomeCareInstructions(e.target.value)}
                  placeholder="e.g. apply warm sesame oil to lower back twice daily; gentle stretching"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOutcomeOpen(false)} disabled={completing}>
                Cancel
              </Button>
              <Button
                onClick={() => void submitOutcomeAndComplete()}
                disabled={!overallOutcome || !patientTolerance || completing}
              >
                {completing
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Completing…</>
                  : <><CheckCircle2 className="w-4 h-4 mr-1" /> Complete session</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

/** Inline form shared by "Add region note" and "Edit region note" — keeps
 *  the panel JSX flat. Validation is required-region + required-body; the
 *  Save button stays disabled until both are non-empty after trim. */
function RegionEditForm({
  region, body, saving, onRegion, onBody, onCancel, onSave,
}: {
  region: string;
  body: string;
  saving: boolean;
  onRegion: (v: string) => void;
  onBody: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const canSave = region.trim().length > 0 && body.trim().length > 0;
  return (
    <div className="bg-muted/40 rounded-md p-3 space-y-3">
      <div>
        <Label className="text-xs">Body region <span className="text-destructive">*</span></Label>
        <Input
          value={region}
          onChange={(e) => onRegion(e.target.value)}
          placeholder="e.g. left shoulder"
          maxLength={100}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Observation <span className="text-destructive">*</span></Label>
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => onBody(e.target.value)}
          placeholder="What did you observe in this region?"
          maxLength={2000}
          className="mt-1"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          <X className="w-3 h-3 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={onSave} disabled={!canSave || saving}>
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
