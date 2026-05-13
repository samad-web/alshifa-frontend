// Therapist Session Notes — SOAP-format documentation surface.
//
// Two-panel layout:
//   – Left  (1/3): list of the therapist's own notes, searchable.
//   – Right (2/3): SOAP form for the selected note OR a new draft.
//
// Backend contract: /api/therapist-notes — see services/therapistNotes.service.ts.
// New notes default visibility ON (doctor can see in patient timeline).
// Notes can be edited inline; saving an existing note routes to PATCH,
// a fresh draft routes to POST.
//
// Deep-link from appointment cards:
//   ?appointmentId=:id&patientId=:patientId pre-selects the patient,
//   pre-fills appointmentId, and focuses the Subjective field on mount.

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft, FileText, Loader2, Plus, RefreshCw, Save, Search,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  therapistNotesApi,
  type CreateNotePayload,
  type SessionType,
  type TherapistSessionNote,
} from "@/services/therapistNotes.service";

interface AssignedPatient {
  id: string;
  fullName: string | null;
  patientId?: string | null;
  email?: string | null;
}

const SESSION_TYPE_OPTIONS: Array<{ value: SessionType; label: string }> = [
  { value: "INDIVIDUAL",   label: "Individual session" },
  { value: "GROUP",        label: "Group session" },
  { value: "HOME_THERAPY", label: "Home therapy visit" },
];

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function patientNameOf(p?: TherapistSessionNote["patient"], all?: AssignedPatient[], fallbackId?: string | null): string {
  if (p?.fullName) return p.fullName;
  if (fallbackId && all) {
    const hit = all.find((x) => x.id === fallbackId);
    if (hit?.fullName) return hit.fullName;
  }
  return "Unnamed patient";
}

interface DraftForm {
  patientId: string;
  appointmentId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  sessionType: SessionType | "";
  duration: number;
  nextSessionPlan: string;
  isVisibleToDoctor: boolean;
}

const EMPTY_DRAFT: DraftForm = {
  patientId: "",
  appointmentId: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  sessionType: "",
  duration: 45,
  nextSessionPlan: "",
  isVisibleToDoctor: true,
};

export default function TherapistSessionNotes() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const subjectiveRef = useRef<HTMLTextAreaElement | null>(null);

  const [notes, setNotes] = useState<TherapistSessionNote[]>([]);
  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // selectedId === null means the right panel is a brand-new draft.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [noteRows, { data: patientRows }] = await Promise.all([
        therapistNotesApi.list(),
        apiClient.get<AssignedPatient[]>("/api/user/assigned-patients"),
      ]);
      setNotes(noteRows);
      setPatients(Array.isArray(patientRows) ? patientRows : []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  // Deep-link handling — fires once after the initial load when
  // ?patientId / ?appointmentId arrive from an appointment card.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current || loading) return;
    const patientId = searchParams.get("patientId");
    const appointmentId = searchParams.get("appointmentId");
    if (!patientId && !appointmentId) return;
    deepLinked.current = true;
    setSelectedId(null);
    setDraft({
      ...EMPTY_DRAFT,
      patientId: patientId ?? "",
      appointmentId: appointmentId ?? "",
    });
    // Focus the Subjective textarea once the form renders.
    queueMicrotask(() => subjectiveRef.current?.focus());
  }, [loading, searchParams]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const name = patientNameOf(n.patient, patients, n.patientId).toLowerCase();
      const haystack = [name, n.subjective, n.objective, n.assessment, n.plan]
        .filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [notes, patients, search]);

  const selectNote = (note: TherapistSessionNote) => {
    setSelectedId(note.id);
    setDraft({
      patientId: note.patientId,
      appointmentId: note.appointmentId ?? "",
      subjective: note.subjective ?? "",
      objective: note.objective ?? "",
      assessment: note.assessment ?? "",
      plan: note.plan ?? "",
      sessionType: (note.sessionType ?? "") as SessionType | "",
      duration: note.duration ?? 45,
      nextSessionPlan: note.nextSessionPlan ?? "",
      isVisibleToDoctor: note.isVisibleToDoctor,
    });
  };

  const startNewDraft = () => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    queueMicrotask(() => subjectiveRef.current?.focus());
  };

  const canSave = draft.patientId.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) {
      toast({
        title: "Patient required",
        description: "Pick the patient this note belongs to before saving.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      // Trimmed + falsy-stripped payload so empty fields don't waste
      // bytes and update calls don't accidentally null-out fields the
      // user intended to leave alone (PATCH replaces undefined → noop).
      const trimmed = {
        subjective:      draft.subjective.trim() || undefined,
        objective:       draft.objective.trim() || undefined,
        assessment:      draft.assessment.trim() || undefined,
        plan:            draft.plan.trim() || undefined,
        sessionType:     draft.sessionType || undefined,
        duration:        Number.isFinite(draft.duration) ? draft.duration : undefined,
        nextSessionPlan: draft.nextSessionPlan.trim() || undefined,
        isVisibleToDoctor: draft.isVisibleToDoctor,
      } satisfies Omit<CreateNotePayload, "patientId" | "appointmentId">;

      if (selectedId) {
        const updated = await therapistNotesApi.update(selectedId, trimmed);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        toast({ title: "Note updated" });
      } else {
        const created = await therapistNotesApi.create({
          patientId: draft.patientId,
          appointmentId: draft.appointmentId || undefined,
          ...trimmed,
        });
        setNotes((prev) => [created, ...prev]);
        setSelectedId(created.id);
        toast({ title: "Session note saved!" });
      }
    } catch (err) {
      toast({
        title: "Couldn't save note",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-4">
        <PageHeader
          title="Session Notes"
          subtitle="SOAP-format documentation of your therapy sessions."
        >
          <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </PageHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: notes list ----------------------------------------- */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3 space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Notes
                  {notes.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{notes.length}</Badge>
                  )}
                </CardTitle>
                <Button size="sm" onClick={startNewDraft} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> New
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient or text…"
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {loading ? (
                <div className="space-y-2 px-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : loadError ? (
                <div className="p-3 text-sm text-destructive">
                  {loadError}
                </div>
              ) : filteredNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground italic px-2 py-6 text-center">
                  {search ? "No notes match your search." : "No notes yet."}
                </p>
              ) : (
                <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
                  {filteredNotes.map((n) => {
                    const isActive = n.id === selectedId;
                    const previewSource =
                      n.subjective || n.assessment || n.plan || n.objective || "";
                    const preview = previewSource.length > 90
                      ? previewSource.slice(0, 90) + "…"
                      : previewSource;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => selectNote(n)}
                          className={
                            "w-full text-left px-3 py-2.5 rounded-lg transition-colors " +
                            (isActive
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-muted/60 border border-transparent")
                          }
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-sm font-medium truncate">
                              {patientNameOf(n.patient, patients, n.patientId)}
                            </span>
                            {!n.isVisibleToDoctor && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">
                                Private
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mb-1">
                            <span>{n.sessionType ? n.sessionType.replace("_", " ").toLowerCase() : "session"}</span>
                            {n.duration ? <span>· {n.duration} min</span> : null}
                            <span>· {shortDate(n.createdAt)}</span>
                          </div>
                          {preview && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                              “{preview}”
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Right: editor -------------------------------------------- */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3 space-y-1">
              <CardTitle className="text-base">
                {selectedId ? "Edit session note" : "New session note"}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {selectedId
                  ? "Edit any field, then Save to persist the changes."
                  : "Pick a patient, fill the SOAP fields, then Save."}
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Patient */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">
                    Patient <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={draft.patientId}
                    onValueChange={(v) => setDraft((d) => ({ ...d, patientId: v }))}
                    disabled={!!selectedId}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select patient…" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.length === 0 ? (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                          No assigned patients found.
                        </div>
                      ) : (
                        patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.fullName || p.email || "Unnamed"}
                            {p.patientId ? ` · ${p.patientId}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedId && (
                    <p className="text-[10px] text-muted-foreground">
                      Patient can&apos;t be reassigned on an existing note.
                    </p>
                  )}
                </div>

                {/* Session type */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Session type</Label>
                  <Select
                    value={draft.sessionType || ""}
                    onValueChange={(v) => setDraft((d) => ({ ...d, sessionType: (v || "") as SessionType | "" }))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Duration */}
                <div className="space-y-1.5">
                  <Label className="text-xs" htmlFor="duration">Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={0}
                    max={480}
                    value={draft.duration}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setDraft((d) => ({
                        ...d,
                        duration: Number.isFinite(n) ? Math.max(0, Math.min(480, n)) : 0,
                      }));
                    }}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2 flex sm:items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={draft.isVisibleToDoctor}
                      onChange={(e) => setDraft((d) => ({ ...d, isVisibleToDoctor: e.target.checked }))}
                      className="accent-primary h-4 w-4"
                    />
                    <span className="font-medium">Visible to doctor</span>
                    <span className="text-xs text-muted-foreground">
                      {draft.isVisibleToDoctor
                        ? "(appears on the patient timeline)"
                        : "(private to you)"}
                    </span>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  SOAP notes
                </p>

                <SoapField
                  letter="S"
                  label="Subjective"
                  hint="What the patient reported — pain levels, sleep, mood."
                  value={draft.subjective}
                  onChange={(v) => setDraft((d) => ({ ...d, subjective: v }))}
                  textareaRef={subjectiveRef}
                />
                <SoapField
                  letter="O"
                  label="Objective"
                  hint="Your clinical observations — ROM, swelling, response to treatment."
                  value={draft.objective}
                  onChange={(v) => setDraft((d) => ({ ...d, objective: v }))}
                />
                <SoapField
                  letter="A"
                  label="Assessment"
                  hint="Clinical judgement — progress, concerns."
                  value={draft.assessment}
                  onChange={(v) => setDraft((d) => ({ ...d, assessment: v }))}
                />
                <SoapField
                  letter="P"
                  label="Plan"
                  hint="Treatment plan for this and the next session."
                  value={draft.plan}
                  onChange={(v) => setDraft((d) => ({ ...d, plan: v }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="next-plan">Next session plan (optional)</Label>
                <Textarea
                  id="next-plan"
                  rows={2}
                  value={draft.nextSessionPlan}
                  onChange={(e) => setDraft((d) => ({ ...d, nextSessionPlan: e.target.value }))}
                  maxLength={5000}
                  placeholder="What should the next session focus on?"
                  className="text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                {selectedId && (
                  <Button variant="ghost" onClick={startNewDraft} disabled={saving}>
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Start new
                  </Button>
                )}
                <Button onClick={() => void handleSave()} disabled={!canSave || saving}>
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4 mr-1" /> {selectedId ? "Save changes" : "Save note"}</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

/** One SOAP field — label, hint, resizable textarea. Extracted so all
 *  four reads identically and the form file stays scannable. */
function SoapField({
  letter, label, hint, value, onChange, textareaRef,
}: {
  letter: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary text-[11px] font-bold">
          {letter}
        </span>
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground font-normal">— {hint}</span>
      </Label>
      <Textarea
        ref={textareaRef}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={5000}
        className="resize-y text-sm"
      />
    </div>
  );
}
