/**
 * 7-stage end-of-journey feedback flow.
 *
 * Mount <JourneyFeedbackPrompt /> once on the patient Today dashboard.
 * It checks `/api/feedback/journey/available` once on mount and, when a
 * pending feedback row is returned, opens a full-screen Dialog that
 * cannot be dismissed back to a banner — patient either submits or
 * postpones via the "Maybe later" CTA on Stage 1 (re-entry on next app
 * open within the 30-day window).
 *
 * XP grading is server-side only — this component just collects the 7
 * responses and submits at Stage 6/7.
 */

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Check, ChevronRight, Heart, Sprout, Trees,
  HeartHandshake, Sun, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import {
  journeyFeedbackApi,
  type AvailableJourneyFeedback,
  type GardenScore,
  type FaceScaleExperience,
  type JourneyFeedbackPhotos,
  type JourneyMcqOption,
} from "@/services/journeyFeedback.service";

// ─── Stage definitions ─────────────────────────────────────────────────────

type Stage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface Answers {
  mcq_appointments:           JourneyMcqOption | null;
  mcq_reminders:              JourneyMcqOption | null;
  mcq_medications:            JourneyMcqOption | null;
  mcq_family_recommendation:  JourneyMcqOption | null;
  garden_score:               GardenScore | null;
  face_scale_experience:      FaceScaleExperience | null;
  thank_you_card_text:        string | null;
  thank_you_card_public:      boolean;
  photos_viewed:              boolean;
}

const INITIAL_ANSWERS: Answers = {
  mcq_appointments:           null,
  mcq_reminders:              null,
  mcq_medications:            null,
  mcq_family_recommendation:  null,
  garden_score:               null,
  face_scale_experience:      null,
  thank_you_card_text:        null,
  thank_you_card_public:      false,
  photos_viewed:              false,
};

// MCQ option lists keep both label + i18n key. Each list is intentionally
// duplicated rather than templated — the spec wording is operational and
// shouldn't drift between questions.
const MCQ_APPOINTMENTS_OPTS: { value: JourneyMcqOption; label: string }[] = [
  { value: 'A', label: 'Yes, always easy to find a time that worked' },
  { value: 'B', label: 'Mostly, with some exceptions' },
  { value: 'C', label: 'It was often difficult' },
  { value: 'D', label: "I frequently couldn't get the time I needed" },
];

const MCQ_REMINDERS_OPTS: { value: JourneyMcqOption; label: string }[] = [
  { value: 'A', label: 'Yes, they made a real difference' },
  { value: 'B', label: 'Somewhat helpful' },
  { value: 'C', label: "I noticed them but they didn't change much" },
  { value: 'D', label: 'They were too many, or felt annoying' },
];

const MCQ_MEDICATIONS_OPTS: { value: JourneyMcqOption; label: string }[] = [
  { value: 'A', label: 'Easy — always available when I needed them' },
  { value: 'B', label: 'Mostly fine, with occasional delays' },
  { value: 'C', label: 'Often had to wait or make extra visits' },
  { value: 'D', label: "I sometimes couldn't get what was prescribed" },
];

const MCQ_FAMILY_OPTS: { value: JourneyMcqOption; label: string }[] = [
  { value: 'A', label: 'Yes, definitely' },
  { value: 'B', label: 'Probably yes' },
  { value: 'C', label: "I'm not sure" },
  { value: 'D', label: 'Probably not' },
];

// Garden ladder — 5 levels mapped to score 1/3/5/7/10 per spec. Icons are
// from lucide; sized up at the active level.
const GARDEN_LEVELS: {
  value: GardenScore;
  label: string;
  description: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { value: 1,  label: 'Seed',        description: 'About the same as when I started', icon: Sprout },
  { value: 3,  label: 'Sprout',      description: 'Slightly better',                  icon: Sprout },
  { value: 5,  label: 'Small plant', description: 'Noticeably better',                icon: Sprout },
  { value: 7,  label: 'Bush',        description: 'Much better',                      icon: Trees },
  { value: 10, label: 'Tree',        description: 'Completely transformed',           icon: Trees },
];

// Face row — 1 (lowest, neutral-to-sad per spec) to 5 (highest). Spec
// explicitly says lowest must be neutral-to-sad, NOT distressed — emoji
// choices here are deliberately mild on the negative side.
const FACE_SCALE: { value: FaceScaleExperience; emoji: string; label: string }[] = [
  { value: 1, emoji: '😐', label: "I didn't feel heard or supported" },
  { value: 2, emoji: '🙂', label: 'It was okay, nothing special' },
  { value: 3, emoji: '😊', label: 'I felt well cared for' },
  { value: 4, emoji: '🥰', label: 'I felt really looked after' },
  { value: 5, emoji: '💞', label: 'I felt genuinely cared about as a person' },
];

const TOTAL_STAGES = 7;

// ─── Root component ────────────────────────────────────────────────────────

export function JourneyFeedbackPrompt() {
  // Registry-backed flag — matches the requireFeature('JOURNEY_FEEDBACK')
  // middleware on the backend. Loaded once via useTenantFeatures (5min cache).
  const { has, isLoading: flagsLoading } = useTenantFeatures();
  const flagEnabled = has('JOURNEY_FEEDBACK');
  const [available, setAvailable] = useState<AvailableJourneyFeedback | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (flagsLoading || !flagEnabled) return;
    let cancelled = false;
    journeyFeedbackApi
      .getAvailable()
      .then((res) => {
        if (cancelled) return;
        if (res.available) {
          setAvailable(res);
          // Spec: full-screen takeover, NOT a dismissible banner — open
          // immediately when a pending feedback row is returned.
          setOpen(true);
        }
      })
      .catch(() => {
        /* dashboard should never break on a feedback fetch */
      });
    return () => { cancelled = true; };
  }, [flagsLoading, flagEnabled]);

  const handleSubmitted = useCallback(() => {
    setAvailable(null);
    setOpen(false);
  }, []);

  if (!flagEnabled || !available) return null;

  return (
    <JourneyFeedbackModal
      open={open}
      available={available}
      onPostpone={() => setOpen(false)}
      onSubmitted={handleSubmitted}
    />
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────

function JourneyFeedbackModal({
  open,
  available,
  onPostpone,
  onSubmitted,
}: {
  open:        boolean;
  available:   AvailableJourneyFeedback;
  onPostpone:  () => void;
  onSubmitted: () => void;
}) {
  const doctorName = available.lead_doctor.name;

  const [stage, setStage] = useState<Stage>(1);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<JourneyFeedbackPhotos | null>(null);
  const [photosLoaded, setPhotosLoaded] = useState(false);

  // Reset when reopened (postponed → next app-open). Each open is a clean
  // run — patient may have changed their mind on earlier answers.
  useEffect(() => {
    if (open) {
      setStage(1);
      setAnswers(INITIAL_ANSWERS);
      setSubmitting(false);
    }
  }, [open]);

  // Load before/after photos lazily — only when has_photos was true on the
  // availability check. Failure silently skips Stage 2.
  useEffect(() => {
    if (!open || !available.has_photos || photosLoaded) return;
    journeyFeedbackApi
      .getPhotos(available.journey_id)
      .then((res) => { setPhotos(res); setPhotosLoaded(true); })
      .catch(() => { setPhotos(null); setPhotosLoaded(true); });
  }, [open, available.has_photos, available.journey_id, photosLoaded]);

  // Decide if Stage 2 should actually render, or we should silently skip
  // straight from Stage 1 → Stage 3.
  const stage2Eligible = available.has_photos && photos !== null;

  const advanceFromStage = useCallback((current: Stage): Stage => {
    if (current === 1) return stage2Eligible ? 2 : 3;
    if ((current as number) >= TOTAL_STAGES) return TOTAL_STAGES as Stage;
    return ((current as number) + 1) as Stage;
  }, [stage2Eligible]);

  const go = useCallback((next: Stage) => setStage(next), []);

  const submit = useCallback(async (finalAnswers: Answers) => {
    setSubmitting(true);
    try {
      const result = await journeyFeedbackApi.submit({
        journey_id: available.journey_id,
        ...finalAnswers,
      });
      if (result.thank_you_card_delivered) {
        toast.success(`Thank you — your message has been delivered to Dr. ${doctorName}.`);
      } else if (result.xp_awarded > 0) {
        toast.success(`Thank you. Dr. ${doctorName} earned ${result.xp_awarded} XP from your reflection.`);
      } else {
        toast.success('Thank you for sharing.');
      }
      go(7);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback');
      setSubmitting(false);
    }
  }, [available.journey_id, doctorName, go]);

  return (
    <Dialog
      open={open}
      // Stages 1 and 7 are framing — the only "exit" from the flow before
      // submission is the explicit "Maybe later" CTA on Stage 1, and after
      // submission the closing card's Dismiss CTA. We deliberately swallow
      // backdrop / ESC dismissal so the spec ("full-screen takeover") holds.
      onOpenChange={(v) => {
        if (!v && stage === 7) onSubmitted();
      }}
    >
      <DialogContent
        className="max-w-xl p-0 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-white to-emerald-50 border-amber-200 [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col min-h-[480px]">
          <StageHeader stage={stage} totalStages={TOTAL_STAGES} />

          <div className="flex-1 px-6 pb-6 flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="flex-1 flex flex-col"
              >
                {stage === 1 && (
                  <StageOpening
                    onContinue={() => go(advanceFromStage(1))}
                    onLater={onPostpone}
                  />
                )}

                {stage === 2 && stage2Eligible && photos && (
                  <StagePhotos
                    photos={photos}
                    onNext={() => {
                      setAnswers((a) => ({ ...a, photos_viewed: true }));
                      go(3);
                    }}
                    onSkip={() => go(3)}
                  />
                )}

                {stage === 3 && (
                  <McqStage
                    questionNumber={1}
                    question="Were you able to book appointments when you needed them?"
                    options={MCQ_APPOINTMENTS_OPTS}
                    value={answers.mcq_appointments}
                    onChange={(v) => setAnswers((a) => ({ ...a, mcq_appointments: v }))}
                    onMcq2={(v) => setAnswers((a) => ({ ...a, mcq_reminders: v }))}
                    mcq2Question="Did the reminders and messages from IWIS help you stay on track with your treatment?"
                    mcq2Options={MCQ_REMINDERS_OPTS}
                    mcq2Value={answers.mcq_reminders}
                    onMcq3={(v) => setAnswers((a) => ({ ...a, mcq_medications: v }))}
                    mcq3Question="How was your experience getting your prescribed medications?"
                    mcq3Options={MCQ_MEDICATIONS_OPTS}
                    mcq3Value={answers.mcq_medications}
                    onMcq4={(v) => setAnswers((a) => ({ ...a, mcq_family_recommendation: v }))}
                    mcq4Question="If a family member had the same condition, would you bring them to IWIS for treatment?"
                    mcq4Options={MCQ_FAMILY_OPTS}
                    mcq4Value={answers.mcq_family_recommendation}
                    onNext={() => go(4)}
                    onSkipAll={() => {
                      setAnswers((a) => ({
                        ...a,
                        mcq_appointments: null,
                        mcq_reminders: null,
                        mcq_medications: null,
                        mcq_family_recommendation: null,
                      }));
                      go(4);
                    }}
                  />
                )}

                {stage === 4 && (
                  <StageGarden
                    value={answers.garden_score}
                    onChange={(v) => setAnswers((a) => ({ ...a, garden_score: v }))}
                    onNext={() => go(5)}
                    onSkip={() => {
                      setAnswers((a) => ({ ...a, garden_score: null }));
                      go(5);
                    }}
                  />
                )}

                {stage === 5 && (
                  <StageFaceScale
                    value={answers.face_scale_experience}
                    onChange={(v) => setAnswers((a) => ({ ...a, face_scale_experience: v }))}
                    onNext={() => go(6)}
                    onSkip={() => {
                      setAnswers((a) => ({ ...a, face_scale_experience: null }));
                      go(6);
                    }}
                  />
                )}

                {stage === 6 && (
                  <StageThankYouCard
                    doctorName={doctorName}
                    text={answers.thank_you_card_text || ''}
                    isPublic={answers.thank_you_card_public}
                    onChangeText={(t) => setAnswers((a) => ({ ...a, thank_you_card_text: t || null }))}
                    onChangePublic={(p) => setAnswers((a) => ({ ...a, thank_you_card_public: p }))}
                    submitting={submitting}
                    onSubmit={() => submit(answers)}
                    onSkip={() => submit({ ...answers, thank_you_card_text: null, thank_you_card_public: false })}
                  />
                )}

                {stage === 7 && <StageClosing onDismiss={onSubmitted} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Header (progress indicator) ───────────────────────────────────────────

function StageHeader({ stage, totalStages }: { stage: Stage; totalStages: number }) {
  return (
    <div className="px-6 pt-6 pb-3">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalStages }).map((_, i) => {
          const idx = i + 1;
          const isPast = idx < stage;
          const isCurrent = idx === stage;
          return (
            <div
              key={idx}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                isCurrent ? 'bg-amber-500' : isPast ? 'bg-emerald-500' : 'bg-amber-100',
              )}
            />
          );
        })}
      </div>
      <div className="mt-2 text-xs text-amber-900/70 text-right">
        Step {stage} of {totalStages}
      </div>
    </div>
  );
}

// ─── Stage 1 — Celebratory opening (NOT skippable) ────────────────────────

function StageOpening({
  onContinue,
  onLater,
}: {
  onContinue: () => void;
  onLater: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-amber-200 to-emerald-200 flex items-center justify-center shadow-md">
        <Sun className="w-12 h-12 text-amber-700" strokeWidth={1.5} />
      </div>
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold text-amber-950 leading-snug">
          Your treatment journey is complete.
        </h2>
        <p className="text-amber-900/80 max-w-md mx-auto">
          Thank you for trusting us with your care.
        </p>
      </div>
      <div className="flex flex-col items-center gap-2 pt-4 w-full max-w-xs">
        <Button
          size="lg"
          onClick={onContinue}
          className="w-full bg-amber-700 hover:bg-amber-800 text-white"
        >
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
        <button
          type="button"
          onClick={onLater}
          className="text-xs text-amber-800/60 hover:text-amber-900 underline-offset-2 hover:underline"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

// ─── Stage 2 — Before/after photos (conditional, skippable) ───────────────

function StagePhotos({
  photos,
  onNext,
  onSkip,
}: {
  photos: JourneyFeedbackPhotos;
  onNext: () => void;
  onSkip: () => void;
}) {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-lg font-semibold text-amber-950 text-center mb-4">
        Looking back
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <PhotoFrame src={photos.before.filePath} dateLabel={fmtDate(photos.before.takenAt)} />
        <PhotoFrame src={photos.late.filePath}   dateLabel={fmtDate(photos.late.takenAt)} />
      </div>
      <div className="flex-1" />
      <StageActions
        primaryLabel="Next"
        onPrimary={onNext}
        onSkip={onSkip}
      />
    </div>
  );
}

function PhotoFrame({ src, dateLabel }: { src: string; dateLabel: string }) {
  return (
    <div className="space-y-2">
      <div className="aspect-square rounded-xl overflow-hidden border border-amber-200 bg-white shadow-sm">
        <img src={src} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="text-xs text-amber-900/70 text-center">{dateLabel}</div>
    </div>
  );
}

// ─── Stage 3 — Four operational MCQs (each individually skippable) ────────
//
// Combined into one stage UI for screen efficiency — the spec calls them MCQ
// 1-4 but renders them sequentially within the same "operational MCQs" page.

function McqStage({
  questionNumber: _qn,
  question, options, value, onChange,
  mcq2Question, mcq2Options, mcq2Value, onMcq2,
  mcq3Question, mcq3Options, mcq3Value, onMcq3,
  mcq4Question, mcq4Options, mcq4Value, onMcq4,
  onNext, onSkipAll,
}: {
  questionNumber: number;
  question: string;
  options: { value: JourneyMcqOption; label: string }[];
  value: JourneyMcqOption | null;
  onChange: (v: JourneyMcqOption | null) => void;
  mcq2Question: string;
  mcq2Options: { value: JourneyMcqOption; label: string }[];
  mcq2Value: JourneyMcqOption | null;
  onMcq2: (v: JourneyMcqOption | null) => void;
  mcq3Question: string;
  mcq3Options: { value: JourneyMcqOption; label: string }[];
  mcq3Value: JourneyMcqOption | null;
  onMcq3: (v: JourneyMcqOption | null) => void;
  mcq4Question: string;
  mcq4Options: { value: JourneyMcqOption; label: string }[];
  mcq4Value: JourneyMcqOption | null;
  onMcq4: (v: JourneyMcqOption | null) => void;
  onNext: () => void;
  onSkipAll: () => void;
}) {
  const [subStep, setSubStep] = useState<1 | 2 | 3 | 4>(1);

  const goNext = () => {
    if (subStep < 4) setSubStep((subStep + 1) as 1 | 2 | 3 | 4);
    else onNext();
  };
  const skipOne = () => {
    if (subStep === 1) onChange(null);
    if (subStep === 2) onMcq2(null);
    if (subStep === 3) onMcq3(null);
    if (subStep === 4) onMcq4(null);
    if (subStep < 4) setSubStep((subStep + 1) as 1 | 2 | 3 | 4);
    else onNext();
  };

  const current = (() => {
    if (subStep === 1) return { q: question,      opts: options,      val: value,      onChange };
    if (subStep === 2) return { q: mcq2Question,  opts: mcq2Options,  val: mcq2Value,  onChange: onMcq2 };
    if (subStep === 3) return { q: mcq3Question,  opts: mcq3Options,  val: mcq3Value,  onChange: onMcq3 };
    return                 { q: mcq4Question,  opts: mcq4Options,  val: mcq4Value,  onChange: onMcq4 };
  })();

  return (
    <div className="flex-1 flex flex-col">
      <div className="text-xs uppercase tracking-wide text-amber-900/60 text-center mb-2">
        Question {subStep} of 4
      </div>
      <h3 className="text-lg font-semibold text-amber-950 text-center mb-5 leading-snug">
        {current.q}
      </h3>
      <div className="space-y-2 max-w-md w-full mx-auto">
        {current.opts.map((opt) => {
          const selected = current.val === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => current.onChange(opt.value)}
              className={cn(
                'w-full text-left px-4 py-3 rounded-xl border-2 transition-all',
                'flex items-start gap-3',
                selected
                  ? 'border-amber-500 bg-amber-100/60 shadow-sm'
                  : 'border-amber-200 bg-white hover:border-amber-300',
              )}
            >
              <div className={cn(
                'flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                selected ? 'border-amber-600 bg-amber-600' : 'border-amber-300',
              )}>
                {selected && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className="text-sm text-amber-950 flex-1">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      <StageActions
        primaryLabel={subStep < 4 ? 'Next' : 'Continue'}
        primaryDisabled={false}
        onPrimary={goNext}
        onSkip={skipOne}
        secondaryLabel={subStep === 1 ? 'Skip these questions' : undefined}
        onSecondary={subStep === 1 ? onSkipAll : undefined}
      />
    </div>
  );
}

// ─── Stage 4 — Garden / growth metaphor (skippable) ───────────────────────

function StageGarden({
  value, onChange, onNext, onSkip,
}: {
  value: GardenScore | null;
  onChange: (v: GardenScore) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-lg font-semibold text-amber-950 text-center mb-1">
        How much has your health grown?
      </h3>
      <p className="text-sm text-amber-900/70 text-center mb-5">
        Looking at where you are now compared to when you started.
      </p>
      <div className="grid grid-cols-5 gap-1.5 max-w-md w-full mx-auto">
        {GARDEN_LEVELS.map((level) => {
          const Icon = level.icon;
          const selected = value === level.value;
          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all',
                selected
                  ? 'border-emerald-600 bg-emerald-50 scale-105 shadow-md'
                  : 'border-amber-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30',
              )}
            >
              <Icon className={cn(
                'transition-all',
                selected ? 'w-9 h-9 text-emerald-700' : 'w-7 h-7 text-amber-700/70',
              )} />
              <div className={cn(
                'text-xs font-medium',
                selected ? 'text-emerald-900' : 'text-amber-900',
              )}>
                {level.label}
              </div>
            </button>
          );
        })}
      </div>
      {value !== null && (
        <p className="text-sm text-emerald-900/80 text-center mt-4 italic">
          {GARDEN_LEVELS.find((l) => l.value === value)?.description}
        </p>
      )}
      <div className="flex-1" />
      <StageActions
        primaryLabel="Next"
        primaryDisabled={value === null}
        onPrimary={onNext}
        onSkip={onSkip}
      />
    </div>
  );
}

// ─── Stage 5 — Face scale (skippable) ─────────────────────────────────────

function StageFaceScale({
  value, onChange, onNext, onSkip,
}: {
  value: FaceScaleExperience | null;
  onChange: (v: FaceScaleExperience) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-lg font-semibold text-amber-950 text-center mb-5 leading-snug">
        How did you feel about the care you received from your team?
      </h3>
      <div className="flex items-center justify-between max-w-md w-full mx-auto gap-2">
        {FACE_SCALE.map((face) => {
          const selected = value === face.value;
          return (
            <button
              key={face.value}
              type="button"
              onClick={() => onChange(face.value)}
              className={cn(
                'flex-1 aspect-square rounded-2xl border-2 transition-all',
                'flex items-center justify-center',
                selected
                  ? 'border-amber-600 bg-amber-100 scale-110 shadow-md'
                  : 'border-amber-200 bg-white hover:border-amber-400',
              )}
              aria-label={face.label}
            >
              <span className={cn(
                'transition-all',
                selected ? 'text-4xl' : 'text-3xl opacity-80',
              )}>
                {face.emoji}
              </span>
            </button>
          );
        })}
      </div>
      {value !== null && (
        <p className="text-sm text-amber-900/80 text-center mt-4">
          {FACE_SCALE.find((f) => f.value === value)?.label}
        </p>
      )}
      <div className="flex-1" />
      <StageActions
        primaryLabel="Next"
        primaryDisabled={value === null}
        onPrimary={onNext}
        onSkip={onSkip}
      />
    </div>
  );
}

// ─── Stage 6 — Thank-you card (optional, free-form) ───────────────────────

function StageThankYouCard({
  doctorName,
  text,
  isPublic,
  onChangeText,
  onChangePublic,
  submitting,
  onSubmit,
  onSkip,
}: {
  doctorName: string;
  text: string;
  isPublic: boolean;
  onChangeText:   (t: string) => void;
  onChangePublic: (p: boolean) => void;
  submitting: boolean;
  onSubmit: () => void;
  onSkip:   () => void;
}) {
  const charCount = text.length;
  const overLimit = charCount > 2000;
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-center gap-2 mb-2">
        <HeartHandshake className="w-5 h-5 text-rose-600" />
        <h3 className="text-lg font-semibold text-amber-950">A note for Dr. {doctorName}</h3>
      </div>
      <p className="text-sm text-amber-900/80 text-center mb-4 max-w-md mx-auto">
        Is there anything you'd like Dr. {doctorName} to know? A thank you, a
        reflection, something they might not have realised? We'll make sure
        they see it.
      </p>
      <Textarea
        value={text}
        onChange={(e) => onChangeText(e.target.value)}
        rows={6}
        maxLength={2100}
        placeholder="Write as much or as little as you'd like…"
        className="resize-none border-amber-200 focus-visible:ring-amber-400 bg-white"
      />
      <div className={cn(
        'text-xs mt-1 text-right',
        overLimit ? 'text-red-600' : 'text-amber-900/50',
      )}>
        {charCount} / 2000
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
        <div className="text-xs text-amber-900 max-w-[70%]">
          Show on the team recognition board
          <div className="text-[11px] text-amber-900/70">
            Off by default — only Dr. {doctorName} will see it.
          </div>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={onChangePublic}
          disabled={!text.trim()}
        />
      </div>
      <div className="flex-1" />
      <StageActions
        primaryLabel={submitting ? 'Sending…' : (text.trim() ? 'Send & finish' : 'Finish')}
        primaryDisabled={submitting || overLimit}
        onPrimary={onSubmit}
        onSkip={text.trim() ? undefined : onSkip}
        skipLabel="Skip"
      />
    </div>
  );
}

// ─── Stage 7 — Closing message (NOT skippable) ────────────────────────────

function StageClosing({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-200 to-amber-200 flex items-center justify-center shadow-md">
        <Heart className="w-10 h-10 text-emerald-700" strokeWidth={1.5} />
      </div>
      <div className="space-y-3 max-w-sm mx-auto">
        <h2 className="text-2xl font-semibold text-amber-950 leading-snug">
          Thank you for letting us be part of your journey.
        </h2>
        <p className="text-amber-900/80">
          Wishing you continued good health.
        </p>
      </div>
      <Button
        size="lg"
        onClick={onDismiss}
        className="bg-emerald-700 hover:bg-emerald-800 text-white px-10"
      >
        Done
        <Check className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

// ─── Shared action bar ────────────────────────────────────────────────────

function StageActions({
  primaryLabel,
  primaryDisabled = false,
  onPrimary,
  onSkip,
  skipLabel = 'Skip',
  secondaryLabel,
  onSecondary,
}: {
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="pt-5 border-t border-amber-100 mt-4 space-y-2">
      <Button
        size="lg"
        onClick={onPrimary}
        disabled={primaryDisabled}
        className="w-full bg-amber-700 hover:bg-amber-800 text-white"
      >
        {primaryLabel}
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
      <div className="flex items-center justify-center gap-4">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-amber-800/60 hover:text-amber-900 underline-offset-2 hover:underline"
          >
            {skipLabel}
          </button>
        )}
        {onSecondary && secondaryLabel && (
          <button
            type="button"
            onClick={onSecondary}
            className="text-xs text-amber-800/60 hover:text-amber-900 underline-offset-2 hover:underline"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
