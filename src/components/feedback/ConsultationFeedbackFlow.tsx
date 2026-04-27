/**
 * Post-consultation feedback flow.
 *
 * Entry point is <ConsultationFeedbackPrompt /> — mount it once on the
 * patient Today dashboard. It polls GET /api/feedback/consultation/pending
 * once on mount; when a pending prompt is returned, it shows a banner that
 * expands into a full-screen 6-stage modal on tap.
 *
 * Spec is enforced by the backend (48h window, XP per positive answer). The
 * client just collects the 4 responses and submits once at Stage 6.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import {
  consultationFeedbackApi,
  type PendingConsultationFeedback,
  type FeedbackMcqOption,
} from '@/services/consultationFeedback.service';

// ─── Stage definitions ─────────────────────────────────────────────────────
// Kept in sync with the backend schema — if you change the labels here,
// remember the XP rules are fixed server-side and won't move with the copy.

type Stage = 1 | 2 | 3 | 4 | 5 | 6;

const FACE_EMOJIS = ['😞', '😐', '🙂', '😊', '😍'];

const EMOTIONAL_LABELS: readonly string[] = [
  "I didn't feel heard or supported",
  'It was okay, nothing special',
  'I felt well cared for',
  'I felt really looked after',
  'I felt genuinely cared about as a person',
];

const CONFIDENCE_LABELS: readonly string[] = [
  "Confused — I'm not sure what to do",
  'A bit uncertain',
  'I know the basics',
  'I feel clear and prepared',
  'I feel completely confident about what to do',
];

const LISTENING_OPTIONS: { value: FeedbackMcqOption; label: string }[] = [
  { value: 'A', label: 'Yes, the doctor listened carefully to everything' },
  { value: 'B', label: 'Mostly listened, missed a few things' },
  { value: 'C', label: 'Listened to some things but seemed distracted' },
  { value: 'D', label: "I don't feel the doctor really heard me" },
];

const RETURN_OPTIONS: { value: FeedbackMcqOption; label: string }[] = [
  { value: 'A', label: 'Yes, I would specifically request this doctor' },
  { value: 'B', label: 'I would be happy to see them again' },
  { value: 'C', label: 'I would prefer a different doctor next time' },
  { value: 'D', label: 'I would rather not see this doctor again' },
];

interface Answers {
  face_scale_emotional:  number            | null;
  face_scale_confidence: number            | null;
  mcq_listening:         FeedbackMcqOption | null;
  mcq_return:            FeedbackMcqOption | null;
}

const INITIAL_ANSWERS: Answers = {
  face_scale_emotional:  null,
  face_scale_confidence: null,
  mcq_listening:         null,
  mcq_return:            null,
};

// ─── Root component ────────────────────────────────────────────────────────

export function ConsultationFeedbackPrompt() {
  const flagEnabled = useFeatureFlag('consultation_feedback_flow');
  const [pending, setPending] = useState<PendingConsultationFeedback | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!flagEnabled) return;
    let cancelled = false;
    consultationFeedbackApi
      .getPending()
      .then((p) => { if (!cancelled) setPending(p); })
      .catch(() => { /* dashboard should never break on a feedback fetch */ });
    return () => { cancelled = true; };
  }, [flagEnabled]);

  const handleSubmitted = useCallback(() => {
    // Fire-and-forget — once submitted, clear local state so the banner goes away.
    setPending(null);
    setModalOpen(false);
  }, []);

  if (!flagEnabled || !pending || dismissed) return null;

  return (
    <>
      <ConsultationFeedbackBanner
        doctorName={pending.doctor.name}
        onOpen={() => setModalOpen(true)}
        onDismiss={() => setDismissed(true)}
      />
      <ConsultationFeedbackModal
        open={modalOpen}
        pending={pending}
        onClose={() => setModalOpen(false)}
        onSubmitted={handleSubmitted}
      />
    </>
  );
}

// ─── Banner ────────────────────────────────────────────────────────────────

function ConsultationFeedbackBanner({
  doctorName,
  onOpen,
  onDismiss,
}: {
  doctorName: string;
  onOpen:     () => void;
  onDismiss:  () => void;
}) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 p-4 flex items-start gap-3"
    >
      <div className="mt-0.5">
        <Sparkles className="h-5 w-5 text-amber-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">{t('today.consultation_feedback.banner_title')}</p>
        <p className="text-sm text-amber-800/90 mt-0.5">
          {t('today.consultation_feedback.banner_body', { doctor: doctorName })}
        </p>
      </div>
      <Button
        size="sm"
        onClick={onOpen}
        className="flex-shrink-0 bg-amber-700 hover:bg-amber-800 text-white"
      >
        {t('today.consultation_feedback.cta_open')}
        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('today.consultation_feedback.cta_dismiss')}
        className="flex-shrink-0 text-amber-700 hover:text-amber-900 p-1 -m-1"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────

function ConsultationFeedbackModal({
  open,
  pending,
  onClose,
  onSubmitted,
}: {
  open:        boolean;
  pending:     PendingConsultationFeedback;
  onClose:     () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const doctorName = pending.doctor.name;

  const [stage, setStage]       = useState<Stage>(1);
  const [answers, setAnswers]   = useState<Answers>(INITIAL_ANSWERS);
  const [submitting, setSubmit] = useState(false);

  // Reset when reopened — the caller drives lifecycle, but a closed modal
  // that reopens later should start fresh.
  useEffect(() => {
    if (open) {
      setStage(1);
      setAnswers(INITIAL_ANSWERS);
      setSubmit(false);
    }
  }, [open]);

  const go = useCallback((next: Stage) => setStage(next), []);

  const submit = useCallback(async () => {
    setSubmit(true);
    try {
      const result = await consultationFeedbackApi.submit({
        appointment_id: pending.appointmentId,
        ...answers,
      });
      if (result.xp_awarded > 0) {
        toast.success(`Thanks — Dr. ${doctorName} earned ${result.xp_awarded} XP from your feedback`);
      } else {
        toast.success('Thanks for your feedback');
      }
      go(6);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit feedback');
      setSubmit(false);
    }
  }, [answers, doctorName, go, pending.appointmentId]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
        <div className="p-6 space-y-6 min-h-[420px] flex flex-col">
          <StageHeader stage={stage} />

          <div className="flex-1 flex flex-col">
            {stage === 1 && (
              <StageOpening
                doctorName={doctorName}
                onContinue={() => go(2)}
                onLater={onClose}
              />
            )}

            {stage === 2 && (
              <FaceScaleStage
                question={t('today.consultation_feedback.q_emotional', { doctor: doctorName })}
                labels={EMOTIONAL_LABELS}
                value={answers.face_scale_emotional}
                onChange={(v) => setAnswers((a) => ({ ...a, face_scale_emotional: v }))}
                onNext={() => go(3)}
                onSkip={() => {
                  setAnswers((a) => ({ ...a, face_scale_emotional: null }));
                  go(3);
                }}
              />
            )}

            {stage === 3 && (
              <FaceScaleStage
                question={t('today.consultation_feedback.q_confidence')}
                labels={CONFIDENCE_LABELS}
                value={answers.face_scale_confidence}
                onChange={(v) => setAnswers((a) => ({ ...a, face_scale_confidence: v }))}
                onNext={() => go(4)}
                onSkip={() => {
                  setAnswers((a) => ({ ...a, face_scale_confidence: null }));
                  go(4);
                }}
              />
            )}

            {stage === 4 && (
              <McqStage
                question={t('today.consultation_feedback.q_listening')}
                options={LISTENING_OPTIONS}
                value={answers.mcq_listening}
                onChange={(v) => setAnswers((a) => ({ ...a, mcq_listening: v }))}
                onNext={() => go(5)}
                onSkip={() => {
                  setAnswers((a) => ({ ...a, mcq_listening: null }));
                  go(5);
                }}
              />
            )}

            {stage === 5 && (
              <McqStage
                question={t('today.consultation_feedback.q_return', { doctor: doctorName })}
                options={RETURN_OPTIONS}
                value={answers.mcq_return}
                onChange={(v) => setAnswers((a) => ({ ...a, mcq_return: v }))}
                onNext={submit}
                onSkip={() => {
                  setAnswers((a) => ({ ...a, mcq_return: null }));
                  submit();
                }}
                nextLabel={submitting ? t('today.consultation_feedback.submitting') : t('today.consultation_feedback.submit')}
                nextDisabled={submitting}
              />
            )}

            {stage === 6 && <StageClosing onDismiss={onSubmitted} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stage header (progress dots) ──────────────────────────────────────────

function StageHeader({ stage }: { stage: Stage }) {
  const { t } = useTranslation();
  // 4 dots, one per question. The opener + closer don't need dots — but
  // we still want patients to see progress while answering.
  const questionIndex = stage >= 2 && stage <= 5 ? stage - 2 : null;
  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              questionIndex !== null && i <= questionIndex
                ? 'bg-amber-600'
                : 'bg-slate-200',
            )}
          />
        ))}
      </div>
      {stage >= 2 && stage <= 5 && (
        <span className="text-xs text-muted-foreground">
          {t('today.consultation_feedback.question_n_of_4', { n: stage - 1 })}
        </span>
      )}
    </div>
  );
}

// ─── Stage 1: Opening ──────────────────────────────────────────────────────

function StageOpening({
  doctorName,
  onContinue,
  onLater,
}: {
  doctorName: string;
  onContinue: () => void;
  onLater:    () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col justify-center text-center space-y-4">
      <div className="text-4xl">👋</div>
      <p className="text-lg font-semibold leading-snug">
        {t('today.consultation_feedback.opening_title')}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t('today.consultation_feedback.opening_body', { doctor: doctorName })}
      </p>
      <div className="flex flex-col gap-2 pt-4">
        <Button onClick={onContinue} className="w-full">
          {t('today.consultation_feedback.opening_continue')}
        </Button>
        <Button variant="ghost" onClick={onLater} className="w-full">
          {t('today.consultation_feedback.opening_later')}
        </Button>
      </div>
    </div>
  );
}

// ─── Stages 2 + 3: Face scale ──────────────────────────────────────────────

function FaceScaleStage({
  question,
  labels,
  value,
  onChange,
  onNext,
  onSkip,
}: {
  question: string;
  labels:   readonly string[];
  value:    number | null;
  onChange: (v: number) => void;
  onNext:   () => void;
  onSkip:   () => void;
}) {
  const { t } = useTranslation();
  const activeLabel = value !== null ? labels[value - 1] : null;

  return (
    <div className="flex-1 flex flex-col">
      <p className="text-base font-medium leading-snug">{question}</p>

      <div className="flex justify-between items-center mt-8">
        {FACE_EMOJIS.map((emoji, i) => {
          const score = i + 1;
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-label={labels[i]}
              className={cn(
                'text-3xl p-2 rounded-full transition-all',
                selected
                  ? 'bg-amber-100 scale-110 ring-2 ring-amber-400'
                  : 'opacity-60 hover:opacity-100',
              )}
            >
              {emoji}
            </button>
          );
        })}
      </div>

      <div className="h-10 mt-4 text-center">
        <AnimatePresence mode="wait">
          {activeLabel && (
            <motion.p
              key={value}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-slate-700"
            >
              {activeLabel}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1" />
      <div className="flex gap-2 pt-4">
        <Button variant="ghost" onClick={onSkip} className="flex-1">
          {t('today.consultation_feedback.skip')}
        </Button>
        <Button onClick={onNext} disabled={value === null} className="flex-1">
          {t('today.consultation_feedback.next')}
        </Button>
      </div>
    </div>
  );
}

// ─── Stages 4 + 5: MCQ ─────────────────────────────────────────────────────

function McqStage({
  question,
  options,
  value,
  onChange,
  onNext,
  onSkip,
  nextLabel,
  nextDisabled = false,
}: {
  question:      string;
  options:       { value: FeedbackMcqOption; label: string }[];
  value:         FeedbackMcqOption | null;
  onChange:      (v: FeedbackMcqOption) => void;
  onNext:        () => void;
  onSkip:        () => void;
  nextLabel?:    string;
  nextDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const resolvedNext = nextLabel ?? t('today.consultation_feedback.next');
  return (
    <div className="flex-1 flex flex-col">
      <p className="text-base font-medium leading-snug">{question}</p>

      <div className="mt-4 space-y-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                'w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm',
                selected
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-slate-200 hover:border-slate-300 bg-white',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />
      <div className="flex gap-2 pt-4">
        <Button variant="ghost" onClick={onSkip} className="flex-1" disabled={nextDisabled}>
          {t('today.consultation_feedback.skip')}
        </Button>
        <Button
          onClick={onNext}
          disabled={value === null || nextDisabled}
          className="flex-1"
        >
          {resolvedNext}
        </Button>
      </div>
    </div>
  );
}

// ─── Stage 6: Closing ──────────────────────────────────────────────────────

function StageClosing({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex flex-col justify-center text-center space-y-4">
      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="mx-auto h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center"
      >
        <Check className="h-7 w-7 text-emerald-700" />
      </motion.div>
      <p className="text-lg font-semibold leading-snug">
        {t('today.consultation_feedback.closing_title')}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {t('today.consultation_feedback.closing_body')}
      </p>
      <div className="pt-4">
        <Button onClick={onDismiss} className="w-full">
          {t('today.consultation_feedback.done')}
        </Button>
      </div>
    </div>
  );
}

