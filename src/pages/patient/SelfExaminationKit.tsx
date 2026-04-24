import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2, AlertTriangle, CheckCircle2, Circle, Sparkles, Heart,
  UploadCloud, Camera, ClipboardList, Apple, ScrollText, Activity,
  Eye, HandMetal, Smile, Wind, BadgeCheck, User,
} from "lucide-react";
import {
  selfExamService,
  type SelfExamBundle,
  type SelfExamStatus,
  type ChecklistItem,
  type PainZone,
  type PainCharacter,
  type TongueCoatingColor,
  type TongueCoatingThickness,
  type StoolConsistency,
  type StoolColour,
  type StoolMealRelation,
  type UrineColour,
  type RoMJoint,
  type RoMDirection,
  type PhysicalObservationType,
  type PrakritiType,
  type AgniType,
  type AppetiteLevel,
  type SleepPosition,
} from "@/services/selfExam.service";
import { cn } from "@/lib/utils";

// ─── Labels & icon maps ────────────────────────────────────────────────

const ZONE_LABELS: Record<PainZone, string> = {
  HEAD_MIGRAINE: "Head / Migraine",
  NECK: "Neck",
  SHOULDER: "Shoulder",
  CHEST: "Chest",
  LOWER_BACK: "Lower Back",
  ABDOMEN: "Abdomen",
  KNEE: "Knee",
  WRIST_HAND: "Wrist & Hand",
  GENERALISED_MUSCLE: "Generalised Muscle",
};

const TYPE_ICONS: Record<ChecklistItem["type"], JSX.Element> = {
  SYMPTOM_HISTORY: <ClipboardList className="h-4 w-4" />,
  TONGUE: <Smile className="h-4 w-4" />,
  STOOL: <ScrollText className="h-4 w-4" />,
  URINE: <ScrollText className="h-4 w-4" />,
  ROM: <Activity className="h-4 w-4" />,
  PHYSICAL: <Camera className="h-4 w-4" />,
  VOICE: <Wind className="h-4 w-4" />,
  DIGESTIVE: <Apple className="h-4 w-4" />,
  LIFESTYLE: <Heart className="h-4 w-4" />,
  CONSTITUTION: <Sparkles className="h-4 w-4" />,
};

const TYPE_LABELS: Record<ChecklistItem["type"], string> = {
  SYMPTOM_HISTORY: "Symptom History",
  TONGUE: "Tongue Observation (Jihva)",
  STOOL: "Stool Log (Mala)",
  URINE: "Urine Log (Mutra)",
  ROM: "Range of Motion",
  PHYSICAL: "Physical Observation",
  VOICE: "Voice Recording (Sabda)",
  DIGESTIVE: "Digestive Profile (Ahara Shakti)",
  LIFESTYLE: "Lifestyle Context (Satmya)",
  CONSTITUTION: "Constitution Quiz (Prakriti / Satva / Agni)",
};

const PAIN_CHARACTERS: PainCharacter[] = [
  "THROBBING", "PRESSING", "STABBING", "DULL", "BURNING", "SHARP",
  "ACHING", "CRAMPING", "GRINDING", "HEAVY", "TIGHT", "COLICKY", "BLOATING",
];

const ROM_DIR_LABELS: Record<RoMDirection, string> = {
  NECK_ROTATE_LEFT: "Rotate left",
  NECK_ROTATE_RIGHT: "Rotate right",
  NECK_FLEX: "Flex (chin to chest)",
  NECK_EXTEND: "Extend (look up)",
  NECK_LATERAL_LEFT: "Tilt ear to left shoulder",
  NECK_LATERAL_RIGHT: "Tilt ear to right shoulder",
  SHOULDER_FLEX_OVERHEAD: "Raise overhead",
  SHOULDER_ABDUCT: "Raise sideways",
  SHOULDER_CROSS_BODY: "Reach across chest",
  SHOULDER_BEHIND_BACK: "Reach behind back",
  SHOULDER_EXTERNAL_ROT: "External rotation",
  SHOULDER_INTERNAL_ROT: "Internal rotation",
  KNEE_FLEX: "Bend",
  KNEE_EXTEND: "Straighten",
};

const JOINT_LABELS: Record<RoMJoint, string> = {
  NECK: "Neck",
  SHOULDER_LEFT: "Left shoulder",
  SHOULDER_RIGHT: "Right shoulder",
  KNEE_LEFT: "Left knee",
  KNEE_RIGHT: "Right knee",
};

const STATUS_LABELS: Record<SelfExamStatus, string> = {
  DRAFT: "In Progress",
  SUBMITTED: "Completed",
  REVIEWED: "Reviewed by Vaidya",
};

const STATUS_VARIANT: Record<SelfExamStatus, "secondary" | "default"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  REVIEWED: "default",
};

function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();
}

const PHYSICAL_LABELS: Record<PhysicalObservationType, string> = {
  POSTURE_FULL_BODY: "Full-body posture photo",
  FACE_EYE: "Face + eyes photo",
  HAND_FLAT: "Both hands flat on table",
  KNEE_COMPARE: "Both knees side-by-side",
  SHOULDER_SYMMETRY: "Shoulders — front & back",
  GENERAL_APPEARANCE: "General appearance photo",
};

// ─── Main page ─────────────────────────────────────────────────────────

export default function SelfExaminationKit() {
  const navigate = useNavigate();
  const [bundles, setBundles] = useState<
    Awaited<ReturnType<typeof selfExamService.mine>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeBundle, setActiveBundle] = useState<SelfExamBundle | null>(null);
  const [activeItem, setActiveItem] = useState<ChecklistItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await selfExamService.mine();
      setBundles(list);
      // If there's an active DRAFT with a triage link, open it by default.
      const draft = list.find((s) => s.status === "DRAFT") ?? list[0];
      if (draft) {
        const bundle = await selfExamService.get(draft.id);
        setActiveBundle(bundle);
      } else {
        setActiveBundle(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Couldn't load self-exam: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const reload = useCallback(async () => {
    if (!activeBundle) return;
    const fresh = await selfExamService.get(activeBundle.submission.id);
    setActiveBundle(fresh);
  }, [activeBundle]);

  const handleSubmit = async () => {
    if (!activeBundle) return;
    setSubmitting(true);
    try {
      await selfExamService.submit(activeBundle.submission.id);
      toast.success("Self-exam marked as completed. Your Vaidya will be notified.");
      await loadList();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Submit failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Group checklist by zone for rendering. Iterate `completion.items`
  // (not `checklist`) because only the former has the `complete` flag
  // attached per item — the raw checklist is just the protocol shape.
  const grouped = useMemo(() => {
    if (!activeBundle) return new Map<string, ChecklistItem[]>();
    const map = new Map<string, ChecklistItem[]>();
    for (const item of activeBundle.completion.items) {
      const key = item.zone ? ZONE_LABELS[item.zone] : "General";
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [activeBundle]);

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!activeBundle) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Self-Examination Kit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your self-exam kit becomes available after you complete a triage
                assessment. It guides you through tongue, stool, urine and other
                observations the Vaidya uses before your consultation.
              </p>
              <Button onClick={() => navigate("/patient")}>Go to dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const { submission, completion } = activeBundle;
  const progressPct = completion.totalCount === 0
    ? 0
    : Math.round((completion.completedCount / completion.totalCount) * 100);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Self-Examination Kit</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete before your Vaidya appointment. Photograph tongue in
              natural morning light. Log observations over 3 consecutive days
              where indicated.
            </p>
          </div>
          <Badge
            variant={STATUS_VARIANT[submission.status]}
            className="tracking-wide gap-1"
          >
            {submission.status !== "DRAFT" && <BadgeCheck className="h-3.5 w-3.5" />}
            {STATUS_LABELS[submission.status]}
          </Badge>
        </div>

        {submission.status !== "DRAFT" && (
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="font-semibold text-emerald-900">
                    Self-examination completed
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    <IdentificationRow
                      label="Patient"
                      value={submission.patient?.fullName ?? "—"}
                      icon={<User className="h-3 w-3" />}
                    />
                    <IdentificationRow
                      label="Patient ID"
                      value={shortId(submission.patient?.id)}
                    />
                    <IdentificationRow
                      label="Submission ref"
                      value={shortId(submission.id)}
                    />
                    <IdentificationRow
                      label="Submitted"
                      value={
                        submission.submittedAt
                          ? new Date(submission.submittedAt).toLocaleString()
                          : "—"
                      }
                    />
                    {submission.appointmentId && (
                      <IdentificationRow
                        label="Linked appointment"
                        value={shortId(submission.appointmentId)}
                      />
                    )}
                    {submission.status === "REVIEWED" && submission.reviewedAt && (
                      <IdentificationRow
                        label="Reviewed"
                        value={new Date(submission.reviewedAt).toLocaleString()}
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Progress: {completion.completedCount} / {completion.totalCount}
              </span>
              <span className="text-sm text-muted-foreground">{progressPct}%</span>
            </div>
            <Progress value={progressPct} />
            {bundles.length > 1 && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-muted-foreground">Other sessions:</span>
                {bundles
                  .filter((b) => b.id !== submission.id)
                  .slice(0, 3)
                  .map((b) => (
                    <Button
                      key={b.id}
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const fresh = await selfExamService.get(b.id);
                        setActiveBundle(fresh);
                      }}
                    >
                      {STATUS_LABELS[b.status]} · {new Date(b.createdAt).toLocaleDateString()}
                    </Button>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Accordion
          type="multiple"
          defaultValue={Array.from(grouped.keys())}
          className="space-y-2"
        >
          {Array.from(grouped.entries()).map(([zoneLabel, items]) => {
            const pending = items.filter((i) => !i.complete);
            const doneItems = items.filter((i) => i.complete);
            const zoneDone = pending.length === 0 && items.length > 0;
            const zoneCritical = pending.some((i) => i.critical);
            return (
              <AccordionItem
                key={zoneLabel}
                value={zoneLabel}
                className="border rounded-lg px-4 bg-card"
              >
                <AccordionTrigger>
                  <div className="flex items-center gap-3 flex-1 pr-4">
                    {zoneDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : zoneCritical ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="font-medium">{zoneLabel}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {doneItems.length}/{items.length}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {items.some((i) => i.urgentCareWarning) && (
                    <Alert className="mb-3 border-red-300 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-900">
                        If chest pain is severe, sudden, or accompanied by
                        breathlessness, seek emergency care immediately — do
                        not wait to complete this form.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* All done in this zone */}
                  {zoneDone && (
                    <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      All {items.length} tests complete for this zone.
                    </div>
                  )}

                  {/* Every item renders in its original order. Completed ones
                      stay in place with a strike-through + dimmed style so the
                      patient sees their progress at a glance, and can still tap
                      to review or edit a saved entry. */}
                  <div className="space-y-2">
                    {items.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setActiveItem(item)}
                        className={cn(
                          "w-full flex items-center gap-3 text-left px-3 py-2 rounded-md border transition",
                          item.complete
                            ? "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100"
                            : "bg-background hover:bg-muted",
                          item.critical && !item.complete
                            ? "ring-1 ring-amber-300"
                            : ""
                        )}
                      >
                        {item.complete ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span
                          className={cn(
                            "shrink-0",
                            item.complete ? "text-emerald-700/70" : "text-muted-foreground"
                          )}
                        >
                          {TYPE_ICONS[item.type]}
                        </span>
                        <span
                          className={cn(
                            "flex-1 text-sm",
                            item.complete && "line-through text-emerald-900/60"
                          )}
                        >
                          {TYPE_LABELS[item.type]}
                          {item.dayIndex ? ` · Day ${item.dayIndex}` : ""}
                          {item.joint
                            ? ` · ${JOINT_LABELS[item.joint]} · ${ROM_DIR_LABELS[item.direction!]}`
                            : ""}
                          {item.observationType
                            ? ` · ${PHYSICAL_LABELS[item.observationType]}`
                            : ""}
                        </span>
                        {item.complete && (
                          <Badge
                            variant="outline"
                            className="border-emerald-400 text-emerald-700 text-[10px]"
                          >
                            Done
                          </Badge>
                        )}
                        {item.critical && !item.complete && (
                          <Badge variant="outline" className="border-amber-400 text-amber-700">
                            Most important
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {submission.status === "DRAFT" && (
          <Card>
            <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Once you've captured enough, submit the bundle so your Vaidya
                can review it before the appointment.
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting || completion.completedCount === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting
                  </>
                ) : (
                  "Submit to Vaidya"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {activeItem && (
        <ItemDialog
          item={activeItem}
          submissionId={submission.id}
          bundle={activeBundle}
          onClose={() => setActiveItem(null)}
          onSaved={async () => {
            await reload();
            setActiveItem(null);
          }}
        />
      )}
    </AppLayout>
  );
}

// ─── Per-type dialog router ────────────────────────────────────────────

interface ItemDialogProps {
  item: ChecklistItem;
  submissionId: string;
  bundle: SelfExamBundle;
  onClose: () => void;
  onSaved: () => void;
}

function ItemDialog({ item, submissionId, bundle, onClose, onSaved }: ItemDialogProps) {
  const title = `${TYPE_LABELS[item.type]}${item.zone ? ` — ${ZONE_LABELS[item.zone]}` : ""}`;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {dialogDescription(item)}
          </DialogDescription>
        </DialogHeader>

        {item.type === "SYMPTOM_HISTORY" && item.zone && (
          <SymptomHistoryForm
            submissionId={submissionId}
            zone={item.zone}
            initial={bundle.submission.symptomHistory.find((s) => s.painZone === item.zone)}
            onSaved={onSaved}
          />
        )}
        {item.type === "TONGUE" && item.dayIndex && (
          <TongueForm
            submissionId={submissionId}
            dayIndex={item.dayIndex}
            initial={bundle.submission.tongueObservations.find((t) => t.dayIndex === item.dayIndex)}
            onSaved={onSaved}
          />
        )}
        {item.type === "STOOL" && item.dayIndex && (
          <StoolForm
            submissionId={submissionId}
            dayIndex={item.dayIndex}
            initial={bundle.submission.stoolLogs.find((s) => s.dayIndex === item.dayIndex)}
            onSaved={onSaved}
          />
        )}
        {item.type === "URINE" && item.dayIndex && (
          <UrineForm
            submissionId={submissionId}
            dayIndex={item.dayIndex}
            initial={bundle.submission.urineLogs.find((u) => u.dayIndex === item.dayIndex)}
            onSaved={onSaved}
          />
        )}
        {item.type === "ROM" && item.joint && item.direction && (
          <RoMForm
            submissionId={submissionId}
            joint={item.joint}
            direction={item.direction}
            initial={bundle.submission.romMeasurements.find(
              (r) => r.joint === item.joint && r.direction === item.direction
            )}
            onSaved={onSaved}
          />
        )}
        {item.type === "PHYSICAL" && item.observationType && (
          <PhysicalForm
            submissionId={submissionId}
            observationType={item.observationType}
            zone={item.zone ?? undefined}
            initial={bundle.submission.physicalObservations.find(
              (p) => p.observationType === item.observationType
            )}
            onSaved={onSaved}
          />
        )}
        {item.type === "VOICE" && item.dayIndex && (
          <VoiceForm
            submissionId={submissionId}
            dayIndex={item.dayIndex}
            initial={bundle.submission.voiceObservations.find((v) => v.dayIndex === item.dayIndex)}
            onSaved={onSaved}
          />
        )}
        {item.type === "DIGESTIVE" && (
          <DigestiveForm
            submissionId={submissionId}
            initial={bundle.submission.digestiveProfile ?? undefined}
            onSaved={onSaved}
          />
        )}
        {item.type === "LIFESTYLE" && (
          <LifestyleForm
            submissionId={submissionId}
            initial={bundle.submission.lifestyleContext ?? undefined}
            onSaved={onSaved}
          />
        )}
        {item.type === "CONSTITUTION" && (
          <ConstitutionForm
            initial={bundle.constitution ?? undefined}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function dialogDescription(item: ChecklistItem): string {
  switch (item.type) {
    case "SYMPTOM_HISTORY":
      return "Describe location, character, triggers, and warning signs. Your words help the Vaidya interpret other findings.";
    case "TONGUE":
      return "Best done before eating or drinking, in natural morning light.";
    case "STOOL":
      return "Record texture and habits — no photo needed.";
    case "URINE":
      return "Morning urine is the most informative.";
    case "ROM":
      return "Move slowly until you feel a stop or pain, then record.";
    case "PHYSICAL":
      return "Ask a family member to take these photos in natural light.";
    case "VOICE":
      return "Record a 30-second clip in the morning and again in the evening.";
    case "DIGESTIVE":
      return "Ahara Shakti — your digestive capacity over the last week.";
    case "LIFESTYLE":
      return "Satmya — sleep, posture and occupational context that shapes the problem.";
    case "CONSTITUTION":
      return "Prakriti (body type), Satva (mental strength), Agni (digestive fire). Updated once, reused across visits.";
  }
}

// ─── SmallForm helper primitives ───────────────────────────────────────

function FormActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <DialogFooter className="mt-4">
      <Button variant="outline" type="button" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Save
      </Button>
    </DialogFooter>
  );
}

function useAsyncSave<T>(fn: (body: T) => Promise<unknown>, onSaved: () => void) {
  const [saving, setSaving] = useState(false);
  const submit = async (body: T) => {
    setSaving(true);
    try {
      await fn(body);
      toast.success("Saved");
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };
  return { saving, submit };
}

// ─── SYMPTOM HISTORY ───────────────────────────────────────────────────

function SymptomHistoryForm({
  submissionId, zone, initial, onSaved,
}: {
  submissionId: string;
  zone: PainZone;
  initial?: SelfExamBundle["submission"]["symptomHistory"][number];
  onSaved: () => void;
}) {
  const [subLocation, setSubLocation] = useState(initial?.subLocation ?? "");
  const [characters, setCharacters] = useState<PainCharacter[]>(initial?.characters ?? []);
  const [triggers, setTriggers] = useState(initial?.triggers.join(", ") ?? "");
  const [relievingFactors, setRelievingFactors] = useState(initial?.relievingFactors.join(", ") ?? "");
  const [timing, setTiming] = useState(initial?.timing.join(", ") ?? "");
  const [severity, setSeverity] = useState(initial?.severity ?? 5);
  const [radiatesTo, setRadiatesTo] = useState(initial?.radiatesTo ?? "");
  const [associated, setAssociated] = useState(initial?.associatedSymptoms.join(", ") ?? "");
  const [warnings, setWarnings] = useState(initial?.warningSignsBeforeEpisode.join(", ") ?? "");
  const [injury, setInjury] = useState(initial?.injuryHistory ?? "");
  const [occupation, setOccupation] = useState(initial?.occupationContext ?? "");
  const [freeText, setFreeText] = useState(initial?.freeText ?? "");

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.symptomHistory>[1]) =>
      selfExamService.symptomHistory(submissionId, body),
    onSaved
  );

  const toggleCharacter = (c: PainCharacter) => {
    setCharacters((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          zone,
          subLocation: subLocation || undefined,
          characters,
          triggers: splitList(triggers),
          relievingFactors: splitList(relievingFactors),
          timing: splitList(timing),
          severity,
          radiatesTo: radiatesTo || undefined,
          associatedSymptoms: splitList(associated),
          warningSignsBeforeEpisode: splitList(warnings),
          injuryHistory: injury || undefined,
          occupationContext: occupation || undefined,
          freeText: freeText || undefined,
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label>Precise location (e.g. "forehead", "left temple")</Label>
        <Input value={subLocation} onChange={(e) => setSubLocation(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Pain character</Label>
        <div className="flex flex-wrap gap-2">
          {PAIN_CHARACTERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCharacter(c)}
              className={cn(
                "px-3 py-1 rounded-full text-xs border transition",
                characters.includes(c)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:bg-muted"
              )}
            >
              {c.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Severity (0 = none, 10 = worst)</Label>
        <div className="flex items-center gap-3">
          <Slider
            value={[severity]}
            onValueChange={([v]) => setSeverity(v)}
            min={0}
            max={10}
            step={1}
            className="flex-1"
          />
          <span className="w-8 text-center font-mono text-sm">{severity}</span>
        </div>
      </div>

      <TextListField label="Triggers (comma-separated, e.g. light, stress, skipped meals)" value={triggers} onChange={setTriggers} />
      <TextListField label="What relieves it" value={relievingFactors} onChange={setRelievingFactors} />
      <TextListField label="When worst (morning, after screen use, after meals...)" value={timing} onChange={setTiming} />
      <TextListField label="Warning signs before an episode" value={warnings} onChange={setWarnings} />
      <TextListField label="Other associated symptoms" value={associated} onChange={setAssociated} />

      <div className="space-y-2">
        <Label>Radiates to</Label>
        <Input value={radiatesTo} onChange={(e) => setRadiatesTo(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Past injury / trauma</Label>
        <Input value={injury} onChange={(e) => setInjury(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Occupation / posture context</Label>
        <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Anything else</Label>
        <Textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={3} />
      </div>

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

function TextListField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function splitList(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

// ─── TONGUE ────────────────────────────────────────────────────────────

function TongueForm({
  submissionId, dayIndex, initial, onSaved,
}: {
  submissionId: string;
  dayIndex: number;
  initial?: SelfExamBundle["submission"]["tongueObservations"][number];
  onSaved: () => void;
}) {
  const [coatingColor, setCoatingColor] = useState<TongueCoatingColor>(initial?.coatingColor ?? "NONE");
  const [coatingThickness, setCoatingThickness] = useState<TongueCoatingThickness>(initial?.coatingThickness ?? "NONE");
  const [dryness, setDryness] = useState(initial?.dryness ?? false);
  const [cracks, setCracks] = useState(initial?.cracks ?? false);
  const [tremor, setTremor] = useState(initial?.tremor ?? false);
  const [correlatedPainLevel, setCorrelatedPainLevel] = useState<number>(initial?.correlatedPainLevel ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.tongue>[1]) =>
      selfExamService.tongue(submissionId, body),
    onSaved
  );

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await selfExamService.uploadAsset(file);
      setPhotoUrl(url);
      toast.success("Photo uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          dayIndex,
          coatingColor,
          coatingThickness,
          dryness, cracks, tremor,
          correlatedPainLevel: correlatedPainLevel || undefined,
          notes: notes || undefined,
          photoUrl: photoUrl || undefined,
        });
      }}
      className="space-y-4"
    >
      <EnumSelect label="Coating colour" value={coatingColor} onChange={(v) => setCoatingColor(v as TongueCoatingColor)}
        options={[["NONE","None"],["WHITE","White (Ama / Kapha)"],["YELLOW","Yellow (Pitta)"],["RED","Red (high Pitta)"]]}
      />

      <EnumSelect label="Coating thickness" value={coatingThickness} onChange={(v) => setCoatingThickness(v as TongueCoatingThickness)}
        options={[["NONE","None"],["THIN","Thin film"],["THICK","Thick / heavy"]]}
      />

      <div className="grid grid-cols-3 gap-3">
        <CheckField label="Dry" checked={dryness} onChange={setDryness} />
        <CheckField label="Cracks" checked={cracks} onChange={setCracks} />
        <CheckField label="Tremor" checked={tremor} onChange={setTremor} />
      </div>

      <div className="space-y-2">
        <Label>Today's pain level (for correlation)</Label>
        <div className="flex items-center gap-3">
          <Slider value={[correlatedPainLevel]} onValueChange={([v]) => setCorrelatedPainLevel(v)} min={0} max={10} step={1} className="flex-1" />
          <span className="w-8 text-center font-mono text-sm">{correlatedPainLevel}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Tongue photo</Label>
        {photoUrl && (
          <div className="text-xs text-muted-foreground break-all">Saved: {photoUrl}</div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
          {photoUrl ? "Replace photo" : "Upload photo"}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

// ─── STOOL (no photo) ──────────────────────────────────────────────────

function StoolForm({
  submissionId, dayIndex, initial, onSaved,
}: {
  submissionId: string;
  dayIndex: number;
  initial?: SelfExamBundle["submission"]["stoolLogs"][number];
  onSaved: () => void;
}) {
  const [consistency, setConsistency] = useState<StoolConsistency>(initial?.consistency ?? "FORMED");
  const [colour, setColour] = useState<StoolColour>(initial?.colour ?? "BROWN");
  const [frequencyPerDay, setFrequencyPerDay] = useState(initial?.frequencyPerDay ?? 1);
  const [daysSinceLast, setDaysSinceLast] = useState(initial?.daysSinceLastMovement ?? 0);
  const [straining, setStraining] = useState(initial?.strainingEffort ?? 1);
  const [incomplete, setIncomplete] = useState(initial?.incompleteEvacuation ?? false);
  const [bloating, setBloating] = useState(initial?.bloatingGas ?? false);
  const [blood, setBlood] = useState(initial?.bloodPresent ?? false);
  const [mucus, setMucus] = useState(initial?.mucusPresent ?? false);
  const [undigested, setUndigested] = useState(initial?.undigestedFood ?? false);
  const [mealRel, setMealRel] = useState<StoolMealRelation>(initial?.relationshipToMeal ?? "NONE");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.stool>[1]) =>
      selfExamService.stool(submissionId, body),
    onSaved
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          dayIndex,
          consistency,
          colour,
          frequencyPerDay,
          daysSinceLastMovement: daysSinceLast || undefined,
          strainingEffort: straining,
          incompleteEvacuation: incomplete,
          bloatingGas: bloating,
          bloodPresent: blood,
          mucusPresent: mucus,
          undigestedFood: undigested,
          relationshipToMeal: mealRel,
          notes: notes || undefined,
        });
      }}
      className="space-y-4"
    >
      <Alert className="bg-muted">
        <AlertDescription className="text-sm">
          No photos — texture is captured as a structured field below. This is
          what your Vaidya reads.
        </AlertDescription>
      </Alert>

      <EnumSelect label="Texture" value={consistency} onChange={(v) => setConsistency(v as StoolConsistency)}
        options={[
          ["HARD_PELLETS","Hard pellets (Vata / constipation)"],
          ["FORMED","Formed"],
          ["SOFT","Soft"],
          ["LOOSE","Loose"],
          ["WATERY","Watery / diarrhoea"],
          ["MUCOUSY","Mucousy / heavy (Kapha)"],
        ]}
      />

      <EnumSelect label="Colour" value={colour} onChange={(v) => setColour(v as StoolColour)}
        options={[
          ["BROWN","Brown (normal)"],
          ["PALE","Pale (Kapha)"],
          ["YELLOW_GREEN","Yellow-green (Pitta)"],
          ["DARK","Dark (Vata)"],
        ]}
      />

      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Times per day" value={frequencyPerDay} onChange={setFrequencyPerDay} min={0} max={20} />
        <NumberField label="Days since last movement" value={daysSinceLast} onChange={setDaysSinceLast} min={0} max={14} />
      </div>

      <div className="space-y-2">
        <Label>Straining effort (1 = none, 5 = severe)</Label>
        <div className="flex items-center gap-3">
          <Slider value={[straining]} onValueChange={([v]) => setStraining(v)} min={1} max={5} step={1} className="flex-1" />
          <span className="w-8 text-center font-mono text-sm">{straining}</span>
        </div>
      </div>

      <EnumSelect label="Relationship to meals" value={mealRel} onChange={(v) => setMealRel(v as StoolMealRelation)}
        options={[
          ["NONE","No clear relationship"],
          ["BEFORE_MEALS","Before meals"],
          ["AFTER_MEALS","After meals"],
          ["BOTH","Both before and after meals"],
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <CheckField label="Incomplete evacuation" checked={incomplete} onChange={setIncomplete} />
        <CheckField label="Bloating / gas alongside" checked={bloating} onChange={setBloating} />
        <CheckField label="Blood visible" checked={blood} onChange={setBlood} />
        <CheckField label="Mucus visible" checked={mucus} onChange={setMucus} />
        <CheckField label="Undigested food" checked={undigested} onChange={setUndigested} />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

// ─── URINE ─────────────────────────────────────────────────────────────

function UrineForm({
  submissionId, dayIndex, initial, onSaved,
}: {
  submissionId: string;
  dayIndex: number;
  initial?: SelfExamBundle["submission"]["urineLogs"][number];
  onSaved: () => void;
}) {
  const [colour, setColour] = useState<UrineColour>(initial?.colour ?? "NORMAL_YELLOW");
  const [frequencyPerDay, setFrequencyPerDay] = useState(initial?.frequencyPerDay ?? 5);
  const [burning, setBurning] = useState(initial?.burning ?? false);
  const [urgency, setUrgency] = useState(initial?.urgency ?? false);
  const [painCorrelation, setPainCorrelation] = useState(initial?.painCorrelation ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.urine>[1]) =>
      selfExamService.urine(submissionId, body),
    onSaved
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          dayIndex, colour, frequencyPerDay, burning, urgency, painCorrelation,
          notes: notes || undefined,
        });
      }}
      className="space-y-4"
    >
      <EnumSelect label="Colour" value={colour} onChange={(v) => setColour(v as UrineColour)}
        options={[
          ["PALE","Pale"],
          ["NORMAL_YELLOW","Normal yellow"],
          ["DARK_YELLOW","Dark yellow"],
          ["BROWN","Brown"],
        ]}
      />

      <NumberField label="Times per day" value={frequencyPerDay} onChange={setFrequencyPerDay} min={0} max={30} />

      <div className="grid grid-cols-2 gap-3">
        <CheckField label="Burning sensation" checked={burning} onChange={setBurning} />
        <CheckField label="Urgency" checked={urgency} onChange={setUrgency} />
        <CheckField label="Pain intensifies before/after urinating" checked={painCorrelation} onChange={setPainCorrelation} />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

// ─── ROM ───────────────────────────────────────────────────────────────

function RoMForm({
  submissionId, joint, direction, initial, onSaved,
}: {
  submissionId: string;
  joint: RoMJoint;
  direction: RoMDirection;
  initial?: SelfExamBundle["submission"]["romMeasurements"][number];
  onSaved: () => void;
}) {
  const [painScore, setPainScore] = useState(initial?.painScore ?? 0);
  const [angleDegrees, setAngleDegrees] = useState<number | undefined>(initial?.angleDegrees ?? undefined);
  const [restriction, setRestriction] = useState(initial?.restriction ?? "");
  const [crepitus, setCrepitus] = useState(initial?.crepitus ?? false);
  const [catchOrSharp, setCatchOrSharp] = useState(initial?.catchOrSharp ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.rom>[1]) =>
      selfExamService.rom(submissionId, body),
    onSaved
  );

  const isKnee = joint.startsWith("KNEE");
  const isShoulder = joint.startsWith("SHOULDER");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          joint, direction, painScore,
          angleDegrees,
          restriction: restriction || undefined,
          crepitus, catchOrSharp,
          notes: notes || undefined,
        });
      }}
      className="space-y-4"
    >
      <div className="text-sm text-muted-foreground">
        {JOINT_LABELS[joint]} · {ROM_DIR_LABELS[direction]}
      </div>

      <div className="space-y-2">
        <Label>Pain during this movement (0–10)</Label>
        <div className="flex items-center gap-3">
          <Slider value={[painScore]} onValueChange={([v]) => setPainScore(v)} min={0} max={10} step={1} className="flex-1" />
          <span className="w-8 text-center font-mono text-sm">{painScore}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Approximate angle reached (optional)</Label>
        <Input
          type="number"
          min={0} max={360}
          value={angleDegrees ?? ""}
          onChange={(e) => setAngleDegrees(e.target.value ? Number(e.target.value) : undefined)}
        />
      </div>

      <div className="space-y-2">
        <Label>Restriction description (e.g. "stops halfway")</Label>
        <Input value={restriction} onChange={(e) => setRestriction(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {isKnee && <CheckField label="Grinding / crepitus" checked={crepitus} onChange={setCrepitus} />}
        {isShoulder && <CheckField label="Catching or sharp pain" checked={catchOrSharp} onChange={setCatchOrSharp} />}
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

// ─── PHYSICAL (photo-based) ────────────────────────────────────────────

function PhysicalForm({
  submissionId, observationType, zone, initial, onSaved,
}: {
  submissionId: string;
  observationType: PhysicalObservationType;
  zone?: PainZone;
  initial?: SelfExamBundle["submission"]["physicalObservations"][number];
  onSaved: () => void;
}) {
  const [photoFrontUrl, setPhotoFrontUrl] = useState(initial?.photoFrontUrl ?? "");
  const [photoSideUrl, setPhotoSideUrl] = useState(initial?.photoSideUrl ?? "");
  const [photoBackUrl, setPhotoBackUrl] = useState(initial?.photoBackUrl ?? "");
  const [photoExtraUrl, setPhotoExtraUrl] = useState(initial?.photoExtraUrl ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.physical>[1]) =>
      selfExamService.physical(submissionId, body),
    onSaved
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          observationType,
          painZone: zone,
          photoFrontUrl: photoFrontUrl || undefined,
          photoSideUrl: photoSideUrl || undefined,
          photoBackUrl: photoBackUrl || undefined,
          photoExtraUrl: photoExtraUrl || undefined,
          details: {},
          notes: notes || undefined,
        });
      }}
      className="space-y-4"
    >
      <div className="text-sm text-muted-foreground">
        {PHYSICAL_LABELS[observationType]}
      </div>

      <PhotoPickerRow label="Front" url={photoFrontUrl} onChange={setPhotoFrontUrl} />
      <PhotoPickerRow label="Side" url={photoSideUrl} onChange={setPhotoSideUrl} />
      <PhotoPickerRow label="Back" url={photoBackUrl} onChange={setPhotoBackUrl} />
      <PhotoPickerRow label="Extra (e.g. both knees / both hands)" url={photoExtraUrl} onChange={setPhotoExtraUrl} />

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

function PhotoPickerRow({ label, url, onChange }: { label: string; url: string; onChange: (u: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = async (f: File) => {
    setUploading(true);
    try {
      const u = await selfExamService.uploadAsset(f);
      onChange(u);
      toast.success(`${label} photo uploaded`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Label className="text-xs">{label}</Label>
        {url && <div className="text-xs text-muted-foreground truncate">{url}</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
      </Button>
    </div>
  );
}

// ─── VOICE ─────────────────────────────────────────────────────────────

function VoiceForm({
  submissionId, dayIndex, initial, onSaved,
}: {
  submissionId: string;
  dayIndex: number;
  initial?: SelfExamBundle["submission"]["voiceObservations"][number];
  onSaved: () => void;
}) {
  const [morningUrl, setMorningUrl] = useState(initial?.morningRecUrl ?? "");
  const [eveningUrl, setEveningUrl] = useState(initial?.eveningRecUrl ?? "");
  const [fatigueNotes, setFatigueNotes] = useState(initial?.fatigueNotes ?? "");

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.voice>[1]) =>
      selfExamService.voice(submissionId, body),
    onSaved
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          dayIndex,
          morningRecUrl: morningUrl || undefined,
          eveningRecUrl: eveningUrl || undefined,
          fatigueNotes: fatigueNotes || undefined,
        });
      }}
      className="space-y-4"
    >
      <PhotoPickerRow label="Morning recording" url={morningUrl} onChange={setMorningUrl} />
      <PhotoPickerRow label="Evening recording" url={eveningUrl} onChange={setEveningUrl} />
      <div className="space-y-2">
        <Label>Voice fatigue notes</Label>
        <Textarea value={fatigueNotes} onChange={(e) => setFatigueNotes(e.target.value)} rows={3} />
      </div>
      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

// ─── DIGESTIVE ─────────────────────────────────────────────────────────

function DigestiveForm({
  submissionId, initial, onSaved,
}: {
  submissionId: string;
  initial?: SelfExamBundle["submission"]["digestiveProfile"] extends infer T | null ? T : never;
  onSaved: () => void;
}) {
  const [agniType, setAgniType] = useState<AgniType | undefined>(initial?.agniType ?? undefined);
  const [appetiteLevel, setAppetiteLevel] = useState<AppetiteLevel | undefined>(initial?.appetiteLevel ?? undefined);
  const [bloating, setBloating] = useState(initial?.bloatingAfterMeals ?? false);
  const [bloatingMins, setBloatingMins] = useState(initial?.bloatingDurationMins ?? 0);
  const [heartburn, setHeartburn] = useState(initial?.heartburnPerWeek ?? 0);
  const [water, setWater] = useState(initial?.waterIntakeGlasses ?? 6);
  const [coldFood, setColdFood] = useState(initial?.coldFoodAggravates ?? false);
  const [triggers, setTriggers] = useState(initial?.foodTriggers.join(", ") ?? "");
  const [incompatible, setIncompatible] = useState(initial?.incompatibleCombinations.join(", ") ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.digestive>[1]) =>
      selfExamService.digestive(submissionId, body),
    onSaved
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          agniType, appetiteLevel,
          bloatingAfterMeals: bloating,
          bloatingDurationMins: bloatingMins || undefined,
          heartburnPerWeek: heartburn,
          waterIntakeGlasses: water,
          coldFoodAggravates: coldFood,
          foodTriggers: splitList(triggers),
          incompatibleCombinations: splitList(incompatible),
          notes: notes || undefined,
        });
      }}
      className="space-y-4"
    >
      <EnumSelect label="Appetite level" value={appetiteLevel ?? ""} onChange={(v) => setAppetiteLevel((v || undefined) as AppetiteLevel | undefined)}
        options={[
          ["","— not sure —"],
          ["STRONG","Always hungry"],
          ["MODERATE","Moderate"],
          ["WEAK","Weak"],
          ["IRREGULAR","Irregular"],
        ]}
      />

      <EnumSelect label="Agni (digestive fire) self-assessment" value={agniType ?? ""} onChange={(v) => setAgniType((v || undefined) as AgniType | undefined)}
        options={[
          ["","— not sure —"],
          ["MANDAGNI","Mandagni — slow (Kapha)"],
          ["TIKSHNA","Tikshna — sharp / always hungry (Pitta)"],
          ["VISHAMA","Vishama — irregular (Vata)"],
          ["SAMA","Sama — balanced"],
        ]}
      />

      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Heartburn episodes / week" value={heartburn} onChange={setHeartburn} min={0} max={50} />
        <NumberField label="Glasses of water / day" value={water} onChange={setWater} min={0} max={40} />
      </div>

      <CheckField label="Bloating after meals" checked={bloating} onChange={setBloating} />
      {bloating && (
        <NumberField label="How long does bloating last (minutes)" value={bloatingMins} onChange={setBloatingMins} min={0} max={1440} />
      )}
      <CheckField label="Cold food makes symptoms worse" checked={coldFood} onChange={setColdFood} />

      <TextListField label="Food triggers (comma-separated)" value={triggers} onChange={setTriggers} />
      <TextListField label="Incompatible combinations (e.g. curd at night, fish with milk)" value={incompatible} onChange={setIncompatible} />

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

// ─── LIFESTYLE ─────────────────────────────────────────────────────────

function LifestyleForm({
  submissionId, initial, onSaved,
}: {
  submissionId: string;
  initial?: SelfExamBundle["submission"]["lifestyleContext"] extends infer T | null ? T : never;
  onSaved: () => void;
}) {
  const [pillowType, setPillowType] = useState(initial?.pillowType ?? "");
  const [pillowFirmness, setPillowFirmness] = useState(initial?.pillowFirmness ?? "");
  const [sleepPosition, setSleepPosition] = useState<SleepPosition | undefined>(initial?.sleepPosition ?? undefined);
  const [sleepHours, setSleepHours] = useState(initial?.sleepHours ?? 7);
  const [screenHours, setScreenHours] = useState(initial?.screenHoursPerDay ?? 6);
  const [occupation, setOccupation] = useState(initial?.occupation ?? "");
  const [pastInjuries, setPastInjuries] = useState(initial?.pastInjuries ?? "");
  const [regularExercise, setRegularExercise] = useState(initial?.regularExercise ?? "");
  const [stressEvents, setStressEvents] = useState(initial?.stressEventsPast6mo ?? "");

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.lifestyle>[1]) =>
      selfExamService.lifestyle(submissionId, body),
    onSaved
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({
          pillowType: pillowType || undefined,
          pillowFirmness: pillowFirmness || undefined,
          sleepPosition,
          sleepHours,
          screenHoursPerDay: screenHours,
          occupation: occupation || undefined,
          pastInjuries: pastInjuries || undefined,
          regularExercise: regularExercise || undefined,
          stressEventsPast6mo: stressEvents || undefined,
        });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Pillow type</Label>
          <Input value={pillowType} onChange={(e) => setPillowType(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Pillow firmness</Label>
          <Input value={pillowFirmness} onChange={(e) => setPillowFirmness(e.target.value)} />
        </div>
      </div>

      <EnumSelect label="Sleep position" value={sleepPosition ?? ""} onChange={(v) => setSleepPosition((v || undefined) as SleepPosition | undefined)}
        options={[
          ["","— not sure —"],
          ["BACK","Back"],
          ["LEFT_SIDE","Left side"],
          ["RIGHT_SIDE","Right side"],
          ["STOMACH","Stomach"],
          ["MIXED","Mixed"],
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Sleep hours / night" value={sleepHours} onChange={setSleepHours} min={0} max={24} step={0.5} />
        <NumberField label="Screen hours / day" value={screenHours} onChange={setScreenHours} min={0} max={24} />
      </div>

      <div className="space-y-2">
        <Label>Occupation</Label>
        <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Past injuries / trauma</Label>
        <Textarea value={pastInjuries} onChange={(e) => setPastInjuries(e.target.value)} rows={2} />
      </div>

      <div className="space-y-2">
        <Label>Regular exercise / yoga / walks</Label>
        <Textarea value={regularExercise} onChange={(e) => setRegularExercise(e.target.value)} rows={2} />
      </div>

      <div className="space-y-2">
        <Label>Significant stress in past 6 months</Label>
        <Textarea value={stressEvents} onChange={(e) => setStressEvents(e.target.value)} rows={2} />
      </div>

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

// ─── CONSTITUTION (patient-level, one-off) ─────────────────────────────

function ConstitutionForm({
  initial, onSaved,
}: {
  initial?: SelfExamBundle["constitution"] extends infer T | null ? T : never;
  onSaved: () => void;
}) {
  const [prakriti, setPrakriti] = useState<PrakritiType | undefined>(initial?.prakriti ?? undefined);
  const [satvaRating, setSatvaRating] = useState(initial?.satvaRating ?? 5);
  const [agniType, setAgniType] = useState<AgniType | undefined>(initial?.agniType ?? undefined);

  const { saving, submit } = useAsyncSave(
    (body: Parameters<typeof selfExamService.upsertConstitution>[0]) =>
      selfExamService.upsertConstitution(body),
    onSaved
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit({ prakriti, satvaRating, agniType });
      }}
      className="space-y-4"
    >
      <EnumSelect label="Prakriti (body type)" value={prakriti ?? ""} onChange={(v) => setPrakriti((v || undefined) as PrakritiType | undefined)}
        options={[
          ["","— not sure —"],
          ["VATA","Vata (air / movement)"],
          ["PITTA","Pitta (fire / metabolism)"],
          ["KAPHA","Kapha (earth / structure)"],
          ["VATA_PITTA","Vata-Pitta"],
          ["PITTA_KAPHA","Pitta-Kapha"],
          ["VATA_KAPHA","Vata-Kapha"],
          ["TRIDOSHA","Tridosha (balanced)"],
        ]}
      />

      <div className="space-y-2">
        <Label>Satva (mental strength, 1–10)</Label>
        <div className="flex items-center gap-3">
          <Slider value={[satvaRating]} onValueChange={([v]) => setSatvaRating(v)} min={1} max={10} step={1} className="flex-1" />
          <span className="w-8 text-center font-mono text-sm">{satvaRating}</span>
        </div>
      </div>

      <EnumSelect label="Agni (digestive fire)" value={agniType ?? ""} onChange={(v) => setAgniType((v || undefined) as AgniType | undefined)}
        options={[
          ["","— not sure —"],
          ["MANDAGNI","Mandagni — slow"],
          ["TIKSHNA","Tikshna — sharp"],
          ["VISHAMA","Vishama — irregular"],
          ["SAMA","Sama — balanced"],
        ]}
      />

      <FormActions saving={saving} onCancel={onSaved} />
    </form>
  );
}

// ─── Primitive form widgets ────────────────────────────────────────────

const NONE_SENTINEL = "__none";

function EnumSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value === "" ? NONE_SENTINEL : value}
        onValueChange={(v) => onChange(v === NONE_SENTINEL ? "" : v)}
      >
        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v || NONE_SENTINEL} value={v || NONE_SENTINEL}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max, step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      {label}
    </label>
  );
}

function IdentificationRow({
  label, value, icon,
}: { label: string; value: string; icon?: JSX.Element }) {
  return (
    <div className="flex items-baseline gap-2">
      {icon && <span className="text-emerald-700">{icon}</span>}
      <span className="text-emerald-800/70">{label}:</span>
      <span className="font-mono font-medium text-emerald-950 truncate">{value}</span>
    </div>
  );
}

