import { Badge } from "@/components/ui/badge";
import type {
  SelfExamBundle,
  PainZone,
} from "@/services/selfExam.service";

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

/**
 * Read-only rendering of a self-exam submission + its sidecar constitution
 * profile. Used by:
 *   - `pages/doctor/SelfExamReview.tsx` (review queue dialog)
 *   - `pages/DoctorDashboard.tsx` (inline on the expanded appointment row)
 * Extracted so both screens render the same sections in the same order.
 */
export function BundleView({ bundle }: { bundle: SelfExamBundle }) {
  const { submission, constitution, completion } = bundle;
  const pct = completion.totalCount === 0
    ? 0
    : Math.round((completion.completedCount / completion.totalCount) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <span>Status: <Badge>{submission.status}</Badge></span>
        <span>·</span>
        <span>{completion.completedCount}/{completion.totalCount} exams ({pct}%)</span>
        <span>·</span>
        <span>Pain zones: {submission.painZones.map((z) => ZONE_LABELS[z]).join(", ") || "—"}</span>
      </div>

      {/* Symptom history by zone */}
      {submission.symptomHistory.length > 0 && (
        <Section title="Symptom History">
          {submission.symptomHistory.map((s) => (
            <div key={s.id} className="border rounded-md p-3 space-y-1 text-sm">
              <div className="font-medium">{ZONE_LABELS[s.painZone]}</div>
              <Kv k="Location" v={s.subLocation} />
              <Kv k="Character" v={s.characters.join(", ").toLowerCase()} />
              <Kv k="Severity" v={String(s.severity) + "/10"} />
              <Kv k="Triggers" v={s.triggers.join(", ")} />
              <Kv k="Relieved by" v={s.relievingFactors.join(", ")} />
              <Kv k="Timing" v={s.timing.join(", ")} />
              <Kv k="Radiates to" v={s.radiatesTo} />
              <Kv k="Associated" v={s.associatedSymptoms.join(", ")} />
              <Kv k="Warning signs" v={s.warningSignsBeforeEpisode.join(", ")} />
              <Kv k="Injury history" v={s.injuryHistory} />
              <Kv k="Occupation" v={s.occupationContext} />
              {s.freeText && <div className="text-muted-foreground">{s.freeText}</div>}
            </div>
          ))}
        </Section>
      )}

      {/* Tongue */}
      {submission.tongueObservations.length > 0 && (
        <Section title="Tongue (Jihva) — 3-day log">
          <div className="grid gap-3 md:grid-cols-3">
            {submission.tongueObservations.map((t) => (
              <div key={t.id} className="border rounded-md p-3 text-sm space-y-1">
                <div className="font-medium">Day {t.dayIndex}</div>
                <Kv k="Coating" v={`${t.coatingColor} · ${t.coatingThickness}`} />
                {t.correlatedPainLevel != null && <Kv k="Pain that day" v={`${t.correlatedPainLevel}/10`} />}
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {t.dryness && <span>Dry</span>}
                  {t.cracks && <span>Cracks</span>}
                  {t.tremor && <span>Tremor</span>}
                </div>
                {t.photoUrl && (
                  <a href={t.photoUrl} target="_blank" rel="noreferrer" className="text-primary text-xs underline block">
                    view photo
                  </a>
                )}
                {t.notes && <div className="text-muted-foreground text-xs">{t.notes}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Stool — structured, no photos */}
      {submission.stoolLogs.length > 0 && (
        <Section title="Stool (Mala) — structured texture log">
          <div className="grid gap-3 md:grid-cols-3">
            {submission.stoolLogs.map((s) => (
              <div key={s.id} className="border rounded-md p-3 text-sm space-y-1">
                <div className="font-medium">Day {s.dayIndex}</div>
                <Kv k="Texture" v={s.consistency} />
                <Kv k="Colour" v={s.colour} />
                <Kv k="Frequency" v={`${s.frequencyPerDay}/day`} />
                <Kv k="Straining" v={`${s.strainingEffort}/5`} />
                <Kv k="Meal relation" v={s.relationshipToMeal} />
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {s.incompleteEvacuation && <span>Incomplete</span>}
                  {s.bloatingGas && <span>Bloating</span>}
                  {s.bloodPresent && <span className="text-red-600">Blood</span>}
                  {s.mucusPresent && <span>Mucus</span>}
                  {s.undigestedFood && <span>Undigested</span>}
                </div>
                {s.notes && <div className="text-muted-foreground text-xs">{s.notes}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Urine */}
      {submission.urineLogs.length > 0 && (
        <Section title="Urine (Mutra) — 3-day log">
          <div className="grid gap-3 md:grid-cols-3">
            {submission.urineLogs.map((u) => (
              <div key={u.id} className="border rounded-md p-3 text-sm space-y-1">
                <div className="font-medium">Day {u.dayIndex}</div>
                <Kv k="Colour" v={u.colour} />
                <Kv k="Frequency" v={`${u.frequencyPerDay}/day`} />
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {u.burning && <span className="text-amber-700">Burning</span>}
                  {u.urgency && <span>Urgency</span>}
                  {u.painCorrelation && <span className="text-amber-700">Pain correlation</span>}
                </div>
                {u.notes && <div className="text-muted-foreground text-xs">{u.notes}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Range of motion */}
      {submission.romMeasurements.length > 0 && (
        <Section title="Range of Motion">
          <div className="grid gap-2 md:grid-cols-2">
            {submission.romMeasurements.map((r) => (
              <div key={r.id} className="border rounded-md p-2 text-xs">
                <div className="font-medium">{r.joint} · {r.direction}</div>
                <div>Pain: {r.painScore}/10 {r.angleDegrees != null && `· ${r.angleDegrees}°`}</div>
                {r.restriction && <div className="text-muted-foreground">{r.restriction}</div>}
                {(r.crepitus || r.catchOrSharp) && (
                  <div className="text-amber-700">
                    {r.crepitus && "Crepitus "} {r.catchOrSharp && "Catch/sharp"}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Physical */}
      {submission.physicalObservations.length > 0 && (
        <Section title="Physical Observations">
          <div className="grid gap-3 md:grid-cols-2">
            {submission.physicalObservations.map((p) => (
              <div key={p.id} className="border rounded-md p-3 text-sm space-y-1">
                <div className="font-medium">{p.observationType}</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {p.photoFrontUrl && <PhotoLink label="Front" url={p.photoFrontUrl} />}
                  {p.photoSideUrl && <PhotoLink label="Side" url={p.photoSideUrl} />}
                  {p.photoBackUrl && <PhotoLink label="Back" url={p.photoBackUrl} />}
                  {p.photoExtraUrl && <PhotoLink label="Extra" url={p.photoExtraUrl} />}
                </div>
                {p.notes && <div className="text-muted-foreground text-xs">{p.notes}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Digestive */}
      {submission.digestiveProfile && (
        <Section title="Digestive Profile (Ahara Shakti)">
          <div className="border rounded-md p-3 text-sm space-y-1">
            <Kv k="Agni type" v={submission.digestiveProfile.agniType} />
            <Kv k="Appetite" v={submission.digestiveProfile.appetiteLevel} />
            <Kv k="Bloating after meals" v={submission.digestiveProfile.bloatingAfterMeals ? `yes (${submission.digestiveProfile.bloatingDurationMins ?? "?"} min)` : "no"} />
            <Kv k="Heartburn / week" v={submission.digestiveProfile.heartburnPerWeek?.toString()} />
            <Kv k="Water (glasses/day)" v={submission.digestiveProfile.waterIntakeGlasses?.toString()} />
            <Kv k="Cold food aggravates" v={submission.digestiveProfile.coldFoodAggravates ? "yes" : "no"} />
            <Kv k="Food triggers" v={submission.digestiveProfile.foodTriggers.join(", ")} />
            <Kv k="Incompatible combinations" v={submission.digestiveProfile.incompatibleCombinations.join(", ")} />
          </div>
        </Section>
      )}

      {/* Lifestyle */}
      {submission.lifestyleContext && (
        <Section title="Lifestyle Context (Satmya)">
          <div className="border rounded-md p-3 text-sm space-y-1">
            <Kv k="Pillow" v={[submission.lifestyleContext.pillowType, submission.lifestyleContext.pillowFirmness].filter(Boolean).join(" · ")} />
            <Kv k="Sleep position" v={submission.lifestyleContext.sleepPosition} />
            <Kv k="Sleep hours" v={submission.lifestyleContext.sleepHours?.toString()} />
            <Kv k="Screen hours/day" v={submission.lifestyleContext.screenHoursPerDay?.toString()} />
            <Kv k="Occupation" v={submission.lifestyleContext.occupation} />
            <Kv k="Past injuries" v={submission.lifestyleContext.pastInjuries} />
            <Kv k="Exercise" v={submission.lifestyleContext.regularExercise} />
            <Kv k="Stress events (6mo)" v={submission.lifestyleContext.stressEventsPast6mo} />
          </div>
        </Section>
      )}

      {/* Constitution */}
      {constitution && (
        <Section title="Constitution (Prakriti · Satva · Agni)">
          <div className="border rounded-md p-3 text-sm space-y-1">
            <Kv k="Prakriti" v={constitution.prakriti} />
            <Kv k="Satva" v={constitution.satvaRating != null ? `${constitution.satvaRating}/10` : null} />
            <Kv k="Agni" v={constitution.agniType} />
            {constitution.completedAt && (
              <div className="text-xs text-muted-foreground">
                Updated {new Date(constitution.completedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </Section>
      )}

      {submission.reviewNotes && (
        <Section title="Previous review notes">
          <div className="text-sm border rounded-md p-3 bg-muted whitespace-pre-wrap">
            {submission.reviewNotes}
          </div>
        </Section>
      )}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

export function Kv({ k, v }: { k: string; v?: string | null }) {
  if (!v) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground w-32 shrink-0">{k}</span>
      <span className="flex-1">{v}</span>
    </div>
  );
}

export function PhotoLink({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
      {label}
    </a>
  );
}
