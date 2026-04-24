import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  ClipboardList, Loader2, RotateCcw, Save, Settings,
} from "lucide-react";
import {
  selfExamService,
  type PainZone,
  type PhysicalObservationType,
  type RoMDirection,
  type RoMJoint,
  type ProtocolOverviewRow,
  type ZoneProtocolConfig,
} from "@/services/selfExam.service";

// ─── Display labels ────────────────────────────────────────────────────

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

const JOINT_OPTIONS: Array<{ value: RoMJoint; label: string }> = [
  { value: "NECK",            label: "Neck" },
  { value: "SHOULDER_LEFT",   label: "Left shoulder" },
  { value: "SHOULDER_RIGHT",  label: "Right shoulder" },
  { value: "KNEE_LEFT",       label: "Left knee" },
  { value: "KNEE_RIGHT",      label: "Right knee" },
];

const DIRECTION_OPTIONS: Array<{ value: RoMDirection; label: string; family: "NECK" | "SHOULDER" | "KNEE" }> = [
  { value: "NECK_ROTATE_LEFT",      label: "Neck · rotate left",            family: "NECK" },
  { value: "NECK_ROTATE_RIGHT",     label: "Neck · rotate right",           family: "NECK" },
  { value: "NECK_FLEX",             label: "Neck · flex",                   family: "NECK" },
  { value: "NECK_EXTEND",           label: "Neck · extend",                 family: "NECK" },
  { value: "NECK_LATERAL_LEFT",     label: "Neck · tilt left",              family: "NECK" },
  { value: "NECK_LATERAL_RIGHT",    label: "Neck · tilt right",             family: "NECK" },
  { value: "SHOULDER_FLEX_OVERHEAD",label: "Shoulder · raise overhead",     family: "SHOULDER" },
  { value: "SHOULDER_ABDUCT",       label: "Shoulder · raise sideways",     family: "SHOULDER" },
  { value: "SHOULDER_CROSS_BODY",   label: "Shoulder · across chest",       family: "SHOULDER" },
  { value: "SHOULDER_BEHIND_BACK",  label: "Shoulder · behind back",        family: "SHOULDER" },
  { value: "SHOULDER_EXTERNAL_ROT", label: "Shoulder · external rotation",  family: "SHOULDER" },
  { value: "SHOULDER_INTERNAL_ROT", label: "Shoulder · internal rotation",  family: "SHOULDER" },
  { value: "KNEE_FLEX",             label: "Knee · bend",                   family: "KNEE" },
  { value: "KNEE_EXTEND",           label: "Knee · straighten",             family: "KNEE" },
];

const PHYSICAL_OPTIONS: Array<{ value: PhysicalObservationType; label: string }> = [
  { value: "POSTURE_FULL_BODY",  label: "Posture (full body)" },
  { value: "FACE_EYE",           label: "Face + eye" },
  { value: "HAND_FLAT",          label: "Both hands flat" },
  { value: "KNEE_COMPARE",       label: "Both knees side-by-side" },
  { value: "SHOULDER_SYMMETRY",  label: "Shoulder symmetry" },
  { value: "GENERAL_APPEARANCE", label: "General appearance" },
];

// ─── Page ──────────────────────────────────────────────────────────────

export default function SelfExamProtocols() {
  const [rows, setRows] = useState<ProtocolOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  // In-memory edits: zone → draft config. Only persisted on Save.
  const [drafts, setDrafts] = useState<Record<string, ZoneProtocolConfig>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await selfExamService.listProtocols();
      setRows(list);
      setDrafts({});
    } catch (err) {
      toast.error(`Couldn't load protocols: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getDraft = useCallback((zone: PainZone): ZoneProtocolConfig => {
    if (drafts[zone]) return drafts[zone];
    const row = rows.find((r) => r.zone === zone);
    return row?.effective ?? {};
  }, [drafts, rows]);

  const patchDraft = (zone: PainZone, patch: Partial<ZoneProtocolConfig>) => {
    setDrafts((prev) => ({
      ...prev,
      [zone]: { ...(prev[zone] ?? getDraft(zone)), ...patch },
    }));
  };

  const save = async (zone: PainZone) => {
    const draft = drafts[zone];
    if (!draft) return;
    setSaving((s) => ({ ...s, [zone]: true }));
    try {
      await selfExamService.upsertProtocol(zone, draft);
      toast.success(`${ZONE_LABELS[zone]} protocol saved`);
      await load();
    } catch (err) {
      toast.error(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving((s) => ({ ...s, [zone]: false }));
    }
  };

  const reset = async (zone: PainZone) => {
    if (!confirm(`Reset ${ZONE_LABELS[zone]} to platform defaults?`)) return;
    setSaving((s) => ({ ...s, [zone]: true }));
    try {
      await selfExamService.resetProtocol(zone);
      toast.success(`${ZONE_LABELS[zone]} reverted to default`);
      await load();
    } catch (err) {
      toast.error(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving((s) => ({ ...s, [zone]: false }));
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-start gap-3">
          <Settings className="h-6 w-6 text-primary mt-0.5" />
          <div>
            <h1 className="text-2xl font-semibold">Self-Exam Protocol</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Adjust which pre-consultation tests each pain zone triggers. Changes
              apply only to your hospital — the platform default stays untouched
              and is shown alongside each override.
            </p>
          </div>
        </div>

        <Accordion type="multiple" className="space-y-2">
          {rows.map((row) => (
            <ZoneEditor
              key={row.zone}
              row={row}
              draft={drafts[row.zone]}
              onPatch={(patch) => patchDraft(row.zone, patch)}
              onSave={() => save(row.zone)}
              onReset={() => reset(row.zone)}
              saving={!!saving[row.zone]}
            />
          ))}
        </Accordion>
      </div>
    </AppLayout>
  );
}

// ─── Per-zone editor ───────────────────────────────────────────────────

function ZoneEditor({
  row, draft, onPatch, onSave, onReset, saving,
}: {
  row: ProtocolOverviewRow;
  draft: ZoneProtocolConfig | undefined;
  onPatch: (patch: Partial<ZoneProtocolConfig>) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const cfg = draft ?? row.effective;
  const isOverridden = !!row.override;
  const isDirty = !!draft;

  // Derived toggles — the config uses presence-based semantics (e.g. the
  // tongue key exists if tongue tests are enabled) so we derive booleans
  // for the UI and re-serialise on change.
  const symptomEnabled  = !!cfg.symptomHistory;
  const symptomCritical = typeof cfg.symptomHistory === "object" ? !!cfg.symptomHistory.critical : false;
  const urgentWarning   = typeof cfg.symptomHistory === "object" ? !!cfg.symptomHistory.urgentCareWarning : false;

  const tongueDays = cfg.tongue?.days ?? 0;
  const stoolDays  = cfg.stool?.days  ?? 0;
  const urineDays  = cfg.urine?.days  ?? 0;
  const voiceDays  = cfg.voice?.days  ?? 0;

  const physicalSet = useMemo(() => new Set(cfg.physicalObservations ?? []), [cfg.physicalObservations]);
  const jointSet    = useMemo(() => new Set(cfg.rom?.joints     ?? []), [cfg.rom]);
  const dirSet      = useMemo(() => new Set(cfg.rom?.directions ?? []), [cfg.rom]);

  return (
    <AccordionItem
      value={row.zone}
      className="border rounded-lg px-4 bg-card"
    >
      <AccordionTrigger>
        <div className="flex items-center gap-3 flex-1 pr-4">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{ZONE_LABELS[row.zone]}</span>
          <div className="ml-auto flex items-center gap-2">
            {isOverridden && <Badge variant="secondary">Customised</Badge>}
            {isDirty && <Badge className="bg-amber-500">Unsaved</Badge>}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-5 py-3">
          {/* Symptom history */}
          <Section title="Symptom History">
            <CheckField
              label="Require symptom history"
              checked={symptomEnabled}
              onChange={(v) => onPatch({
                symptomHistory: v ? { critical: symptomCritical, urgentCareWarning: urgentWarning } : undefined,
              })}
            />
            {symptomEnabled && (
              <div className="pl-6 space-y-1">
                <CheckField
                  label="Mark as the most-critical test for this zone"
                  checked={symptomCritical}
                  onChange={(v) => onPatch({
                    symptomHistory: { critical: v, urgentCareWarning: urgentWarning },
                  })}
                />
                <CheckField
                  label='Show "seek emergency care" warning banner'
                  checked={urgentWarning}
                  onChange={(v) => onPatch({
                    symptomHistory: { critical: symptomCritical, urgentCareWarning: v },
                  })}
                />
              </div>
            )}
          </Section>

          {/* Multi-day logs */}
          <Section title="Multi-day logs">
            <DayCountRow
              label="Tongue (Jihva)"
              days={tongueDays}
              onChange={(days) => onPatch({ tongue: days > 0 ? { days } : undefined })}
            />
            <DayCountRow
              label="Stool (Mala) — structured, no photos"
              days={stoolDays}
              onChange={(days) => onPatch({ stool: days > 0 ? { days } : undefined })}
            />
            <DayCountRow
              label="Urine (Mutra)"
              days={urineDays}
              onChange={(days) => onPatch({ urine: days > 0 ? { days } : undefined })}
            />
            <DayCountRow
              label="Voice (Sabda)"
              days={voiceDays}
              onChange={(days) => onPatch({ voice: days > 0 ? { days } : undefined })}
            />
          </Section>

          {/* Range of motion */}
          <Section title="Range of motion">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Joints</Label>
            <div className="grid grid-cols-2 gap-1">
              {JOINT_OPTIONS.map((j) => (
                <CheckField
                  key={j.value}
                  label={j.label}
                  checked={jointSet.has(j.value)}
                  onChange={(v) => {
                    const next = new Set(jointSet);
                    if (v) next.add(j.value); else next.delete(j.value);
                    onPatch({
                      rom: next.size === 0
                        ? undefined
                        : { joints: Array.from(next), directions: cfg.rom?.directions ?? [] },
                    });
                  }}
                />
              ))}
            </div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground pt-2 block">Directions</Label>
            <div className="grid grid-cols-2 gap-1">
              {DIRECTION_OPTIONS.map((d) => (
                <CheckField
                  key={d.value}
                  label={d.label}
                  checked={dirSet.has(d.value)}
                  onChange={(v) => {
                    const next = new Set(dirSet);
                    if (v) next.add(d.value); else next.delete(d.value);
                    onPatch({
                      rom: {
                        joints: cfg.rom?.joints ?? [],
                        directions: Array.from(next),
                      },
                    });
                  }}
                />
              ))}
            </div>
          </Section>

          {/* Physical observations */}
          <Section title="Physical observations (photos)">
            <div className="grid grid-cols-2 gap-1">
              {PHYSICAL_OPTIONS.map((p) => (
                <CheckField
                  key={p.value}
                  label={p.label}
                  checked={physicalSet.has(p.value)}
                  onChange={(v) => {
                    const next = new Set(physicalSet);
                    if (v) next.add(p.value); else next.delete(p.value);
                    onPatch({
                      physicalObservations: next.size === 0 ? undefined : Array.from(next),
                    });
                  }}
                />
              ))}
            </div>
          </Section>

          {/* Simple toggles */}
          <Section title="Questionnaires">
            <CheckField
              label="Digestive profile (Ahara Shakti)"
              checked={!!cfg.digestive}
              onChange={(v) => onPatch({ digestive: v || undefined })}
            />
            <CheckField
              label="Lifestyle context (Satmya)"
              checked={!!cfg.lifestyle}
              onChange={(v) => onPatch({ lifestyle: v || undefined })}
            />
            <CheckField
              label="Constitution quiz (Prakriti / Satva / Agni)"
              checked={!!cfg.constitutionQuiz}
              onChange={(v) => onPatch({ constitutionQuiz: v || undefined })}
            />
          </Section>

          <div className="flex justify-between pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              disabled={!isOverridden || saving}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-2" />
              Reset to platform default
            </Button>
            <Button size="sm" onClick={onSave} disabled={!isDirty || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save changes
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── Primitives ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function DayCountRow({
  label, days, onChange,
}: {
  label: string;
  days: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm">{label}</span>
      <Input
        type="number"
        min={0}
        max={7}
        value={days}
        onChange={(e) => onChange(Math.max(0, Math.min(7, Number(e.target.value) || 0)))}
        className="w-20 text-right"
      />
    </div>
  );
}

function CheckField({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span className="select-none">{label}</span>
    </label>
  );
}
