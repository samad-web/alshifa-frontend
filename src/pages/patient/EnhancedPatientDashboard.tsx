import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Pill, Activity, AlertCircle, CheckCircle2, Clock, Sparkles,
  Trophy, Flame, Calendar, ArrowRight, Plus, MessageSquare, MapPin,
  Smartphone, MessageCircle, Send, Smile, Frown, Meh,
  Heart, ChevronRight, Loader2, X, Target, Award, Wind, TrendingUp,
  Megaphone, Pin, Info, Stethoscope, UserPlus,
} from "lucide-react";
import {
  enhancedDashboardApi,
  type DashboardSummary,
  type DashboardTask,
  type DashboardMedication,
  type DashboardVital,
  type SmartMessage,
  type DashboardJourneyPhase,
  type MedicationForecast,
  type DashboardCareTeam,
  type CareTeamMember,
  type CheckInPainRegion,
  type SmartInsight,
} from "@/services/enhancedDashboard.service";
import { BodyMapPainSelector } from "@/components/shared/BodyMapPainSelector";
import { MotivationCard } from "@/components/patient/MotivationCard";
import { selfExamService, type SelfExamSubmission } from "@/services/selfExam.service";
import { communicationApi } from "@/services/communication.service";
import type { AnnouncementEntry } from "@/types";
import { FeedbackPromptListener } from "@/components/FeedbackModal";
import { HomeTherapyFeedbackListener } from "@/components/HomeTherapyFeedbackListener";
import { PatientLocationCard, type PatientLocationFields } from "@/components/PatientLocationCard";
import { formatDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { BreathingExercise } from "@/components/wellness/BreathingExercise";
import { VitalChart } from "@/components/vitals/VitalChart";
import { ConsultationFeedbackPrompt } from "@/components/feedback/ConsultationFeedbackFlow";
import { JourneyFeedbackPrompt } from "@/components/journey-feedback/JourneyFeedbackFlow";
import { CoachWidget } from "@/features/voiceCoach";
import { PhotoReminderBanner } from "@/components/patient/PhotoReminderBanner";
import { MealPhotoBanner } from "@/components/patient/MealPhotoBanner";
import { DailyCheckInPopup } from "@/components/patient/DailyCheckInPopup";
import { wellnessService } from "@/services/wellness.service";

// ── Helpers ───────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 border-red-300 text-red-900",
  HIGH: "bg-amber-50 border-amber-300 text-amber-900",
  MEDIUM: "bg-blue-50 border-blue-300 text-blue-900",
  INFO: "bg-slate-50 border-slate-300 text-slate-900",
  SUCCESS: "bg-emerald-50 border-emerald-300 text-emerald-900",
};

const SEVERITY_ICONS: Record<string, JSX.Element> = {
  CRITICAL: <AlertCircle className="h-5 w-5 text-red-600" />,
  HIGH: <AlertCircle className="h-5 w-5 text-amber-600" />,
  MEDIUM: <Bell className="h-5 w-5 text-blue-600" />,
  INFO: <Sparkles className="h-5 w-5 text-slate-600" />,
  SUCCESS: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
};

const VITAL_LABELS: Record<string, string> = {
  BP_SYSTOLIC: "Blood Pressure",
  BP_DIASTOLIC: "BP (Diastolic)",
  WEIGHT: "Weight",
  GLUCOSE: "Glucose",
  SLEEP_HOURS: "Sleep",
  PAIN_SCORE: "Pain",
  MOOD: "Mood",
};

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ── Smart Banner ──────────────────────────────────────────────────────────

function SmartBanner({
  banner,
  onAction,
}: {
  banner: DashboardSummary["banner"];
  onAction: (cta: NonNullable<DashboardSummary["banner"]["cta"]>) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("rounded-2xl border-2 p-4 flex items-start gap-3", SEVERITY_STYLES[banner.severity])}
    >
      <div className="mt-0.5">{SEVERITY_ICONS[banner.severity]}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">{banner.title}</p>
      </div>
      {banner.cta && (
        <Button
          size="sm"
          variant={banner.severity === "SUCCESS" ? "outline" : "default"}
          onClick={() => onAction(banner.cta!)}
          className="flex-shrink-0"
        >
          {banner.cta.label}
          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      )}
    </motion.div>
  );
}

// ── Self-Exam Kit banner ──────────────────────────────────────────────────

interface SelfExamBannerProps {
  /** null = patient has no submission yet — surface a "Start your kit" CTA. */
  submission: SelfExamSubmission | null;
  onOpen: () => void;
}

function SelfExamBanner({ submission, onOpen }: SelfExamBannerProps) {
  // Status-driven copy + colour scheme. The empty-state (no submission) used
  // to render nothing on the dashboard — patients had no entry point unless
  // a triage seeded a draft for them. Now the banner is always visible while
  // there's a relevant action to take.
  let title: string;
  let subtitle: string;
  let cta: string;
  let tone: "primary" | "info" | "success";

  if (!submission) {
    title = "Start your Self-Exam Kit";
    subtitle = "Capture pre-consultation observations (tongue, stool, voice, range of motion). Your Vaidya reviews these before your visit.";
    cta = "Begin kit";
    tone = "primary";
  } else if (submission.status === "DRAFT") {
    const count =
      submission.symptomHistory.length +
      submission.tongueObservations.length +
      submission.stoolLogs.length +
      submission.urineLogs.length +
      submission.romMeasurements.length +
      submission.physicalObservations.length +
      submission.voiceObservations.length +
      (submission.digestiveProfile ? 1 : 0) +
      (submission.lifestyleContext ? 1 : 0);
    const zonesText = submission.painZones.length
      ? submission.painZones.length === 1
        ? "1 pain zone"
        : `${submission.painZones.length} pain zones`
      : "your consultation";
    title = "Complete your Self-Exam Kit";
    subtitle = `Pre-consultation observations for ${zonesText}${
      count > 0 ? ` — ${count} captured so far` : " — nothing captured yet"
    }. Your Vaidya will review before the appointment.`;
    cta = "Open kit";
    tone = "primary";
  } else if (submission.status === "SUBMITTED") {
    title = "Self-Exam Kit submitted";
    subtitle = "Your Vaidya has been notified and will review your observations before the appointment.";
    cta = "View kit";
    tone = "info";
  } else {
    // REVIEWED
    title = "Vaidya reviewed your Self-Exam Kit";
    subtitle = submission.reviewNotes
      ? "Open the kit to see the Vaidya's notes."
      : "Your observations were reviewed before your consultation.";
    cta = "View notes";
    tone = "success";
  }

  const toneClass = tone === "primary"
    ? "border-teal-300 bg-teal-50 text-teal-900"
    : tone === "info"
      ? "border-sky-300 bg-sky-50 text-sky-900"
      : "border-emerald-300 bg-emerald-50 text-emerald-900";
  const iconToneClass = tone === "primary"
    ? "text-teal-700"
    : tone === "info"
      ? "text-sky-700"
      : "text-emerald-700";
  const buttonToneClass = tone === "primary"
    ? "bg-teal-700 hover:bg-teal-800 text-white"
    : tone === "info"
      ? "bg-sky-700 hover:bg-sky-800 text-white"
      : "bg-emerald-700 hover:bg-emerald-800 text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("rounded-2xl border-2 p-4 flex items-start gap-3", toneClass)}
    >
      <div className="mt-0.5">
        {tone === "success"
          ? <CheckCircle2 className={cn("h-5 w-5", iconToneClass)} />
          : <Sparkles className={cn("h-5 w-5", iconToneClass)} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">{title}</p>
        <p className="text-sm opacity-90 mt-0.5">{subtitle}</p>
      </div>
      <Button size="sm" onClick={onOpen} className={cn("flex-shrink-0", buttonToneClass)}>
        {cta}
        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
      </Button>
    </motion.div>
  );
}

// ── Daily Task Checklist ──────────────────────────────────────────────────

function DailyTaskChecklist({
  tasks,
  onActOnTask,
}: {
  tasks: DashboardTask[];
  onActOnTask: (task: DashboardTask) => void;
}) {
  const completed = tasks.filter((t) => t.status === "DONE").length;
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Today's tasks
        </CardTitle>
        <span className="text-xs font-medium text-muted-foreground">
          {completed}/{tasks.length} done
        </span>
      </CardHeader>
      <CardContent className="pt-0 space-y-1.5">
        {tasks.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No tasks for today.</p>
        )}
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onActOnTask(task)}
            disabled={task.status === "DONE"}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
              task.status === "DONE" && "bg-emerald-50 text-emerald-800 cursor-default",
              task.status === "ACTIVE" && "bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300 animate-pulse",
              task.status === "OVERDUE" && "bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-300",
              task.status === "PENDING" && "bg-muted/50 hover:bg-muted",
            )}
          >
            <div className="flex-shrink-0">
              {task.status === "DONE" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <div className={cn(
                  "h-4 w-4 rounded-full border-2",
                  task.status === "OVERDUE" ? "border-rose-500" :
                  task.status === "ACTIVE" ? "border-amber-500" : "border-muted-foreground/40",
                )} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{task.title}</p>
              {task.subtitle && (
                <p className="text-xs text-muted-foreground truncate">{task.subtitle}</p>
              )}
            </div>
            {task.status === "DONE" && task.completedAt && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(task.completedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            {task.status !== "DONE" && (
              <span className="text-[11px] font-semibold text-primary">+{task.points}</span>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Check-In Modal (3-step wizard) ────────────────────────────────────────

function CheckInModal({
  open,
  onClose,
  onSubmit,
  initialStep = 1,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: {
    mood: "TERRIBLE" | "LOW" | "OKAY" | "GOOD" | "GREAT";
    painRegions: CheckInPainRegion[];
    sleepQuality: "POOR" | "FAIR" | "GOOD" | "GREAT";
  }) => Promise<void>;
  /** When the modal is opened from the Pain Map "+ Add" button we land
   *  the patient straight on the body-map step rather than starting at
   *  mood selection. Mood / sleep still need to be filled to submit. */
  initialStep?: 1 | 2 | 3;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [mood, setMood] = useState<string | null>(null);
  const [painRegions, setPainRegions] = useState<CheckInPainRegion[]>([]);
  const [sleep, setSleep] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [insight, setInsight] = useState<SmartInsight | null>(null);
  const [prefillSource, setPrefillSource] = useState<"check_in" | "triage" | null>(null);

  const moods = [
    { key: "TERRIBLE", label: "Terrible", icon: <Frown className="h-7 w-7" />, color: "text-rose-500" },
    { key: "LOW", label: "Low", icon: <Frown className="h-7 w-7" />, color: "text-orange-400" },
    { key: "OKAY", label: "Okay", icon: <Meh className="h-7 w-7" />, color: "text-amber-400" },
    { key: "GOOD", label: "Good", icon: <Smile className="h-7 w-7" />, color: "text-lime-500" },
    { key: "GREAT", label: "Great", icon: <Smile className="h-7 w-7" />, color: "text-emerald-500" },
  ];
  const sleepOpts = ["POOR", "FAIR", "GOOD", "GREAT"];

  const reset = () => { setStep(initialStep); setMood(null); setPainRegions([]); setSleep(null); setInsight(null); setPrefillSource(null); };

  const close = () => { reset(); onClose(); };

  // Pre-populate the body map from the patient's most recent recorded
  // pain regions (latest check-in → triage fallback). Returning patients
  // see their previous selection so they only need to adjust rather than
  // re-enter from scratch. Insight is fetched in parallel and rendered
  // beneath the body map on Step 2.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [last, ins] = await Promise.all([
          enhancedDashboardApi.getLastPainRegions(),
          enhancedDashboardApi.getInsight().catch(() => null),
        ]);
        if (cancelled) return;
        setPainRegions(Array.isArray(last.painRegions) ? last.painRegions : []);
        setPrefillSource(last.source);
        setInsight(ins);
      } catch {
        // Pre-population is best-effort — modal still works without it.
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Reset internal step when the modal is reopened (so a freshly-mounted
  // CheckInModal that was triggered by "+ Add Pain Point" lands on the
  // body-map step, not whatever the previous open ended on).
  useEffect(() => {
    if (open) setStep(initialStep);
  }, [open, initialStep]);

  const submit = async () => {
    if (!sleep) return;
    // When opened from "+ Add Pain Point" (initialStep === 2) the patient
    // never saw the mood picker — default to OKAY so the backend (which
    // requires a mood) still accepts the check-in.
    const effectiveMood = mood ?? "OKAY";
    setSubmitting(true);
    try {
      await onSubmit({ mood: effectiveMood as never, painRegions, sleepQuality: sleep as never });
      toast.success("+20 Zen Points · Check-in saved");
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const insightToneClass = insight?.severity === "HIGH"
    ? "border-rose-300 bg-rose-50 text-rose-900"
    : insight?.severity === "MEDIUM"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-blue-300 bg-blue-50 text-blue-900";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily check-in · Step {step} of 3</DialogTitle>
          <DialogDescription>
            Takes about 60 seconds. Your care team uses this to track progress.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <p className="text-sm font-medium mb-3">How's your overall mood today?</p>
              <div className="grid grid-cols-5 gap-2">
                {moods.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMood(m.key)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all",
                      mood === m.key ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
                    )}
                  >
                    <span className={m.color}>{m.icon}</span>
                    <span className="text-[10px] font-medium">{m.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="s2" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <p className="text-base font-semibold mb-1">Where do you hurt today?</p>
              <p className="text-xs text-muted-foreground mb-3">
                Tap the areas where you feel pain and rate each one.
                {prefillSource === "check_in" && " We've pre-filled your last check-in — tap any region to adjust."}
                {prefillSource === "triage" && " We've pre-filled from your last triage session — adjust as needed."}
              </p>

              <BodyMapPainSelector
                initialPainRegions={painRegions}
                onChange={setPainRegions}
                showDuration={false}
              />

              {painRegions.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center mt-3">
                  No pain today? You can submit with no regions selected.
                </p>
              )}

              {/* Region-specific insight surfaced beneath the body map */}
              {insight && (
                <div className={cn(
                  "mt-3 rounded-lg border p-3 flex items-start gap-2",
                  insightToneClass,
                )}>
                  <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight">{insight.title}</p>
                    <p className="text-xs leading-snug mt-0.5">{insight.message}</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="s3" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
              <p className="text-sm font-medium mb-3">How was your sleep last night?</p>
              <div className="grid grid-cols-2 gap-2">
                {sleepOpts.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSleep(s)}
                    className={cn(
                      "py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all",
                      sleep === s ? "border-primary bg-primary/5" : "border-muted hover:bg-muted",
                    )}
                  >
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={() => (step > 1 ? setStep((step - 1) as 1 | 2 | 3) : close())}>
            {step > 1 ? "Back" : "Cancel"}
          </Button>
          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => setStep((step + 1) as 1 | 2 | 3)}
              disabled={(step === 1 && !mood) || (step === 2 && painRegions.length === 0)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            // Mood is only required when the patient walked through Step 1.
            // When the modal is opened directly from "+ Add Pain Point"
            // (initialStep === 2), they never saw the mood picker — keeping
            // mood in the disabled gate would leave Submit permanently
            // disabled even after pain regions + sleep were entered.
            <Button
              size="sm"
              onClick={submit}
              disabled={(initialStep === 1 && !mood) || !sleep || submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Submit
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Smart Messages Panel ──────────────────────────────────────────────────

const MSG_BORDERS: Record<string, string> = {
  CLINICAL: "border-l-teal-500",
  REMINDER: "border-l-amber-500",
  ALERT: "border-l-rose-500",
  REWARD: "border-l-violet-500",
  INSIGHT: "border-l-blue-500",
};

function SmartMessagesPanel({
  messages,
  channels,
}: {
  messages: SmartMessage[];
  channels: DashboardSummary["channels"];
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Smart messages
        </CardTitle>
        <div className="flex items-center gap-1.5">
          {channels.pushEnabled && <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />}
          {channels.whatsappEnabled && <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2 max-h-80 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No messages.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "border-l-4 pl-3 pr-2 py-2 rounded-r-lg bg-muted/30 hover:bg-muted/60 transition-colors",
              MSG_BORDERS[m.type],
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-0.5">
              <p className="text-xs font-semibold">{m.sender}</p>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                {formatRelative(m.timestamp)}
              </span>
            </div>
            <p className="text-sm font-medium leading-tight">{m.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.preview}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Medication Card ───────────────────────────────────────────────────────

function MedicationCard({
  meds,
  adherenceWeekPct,
  onMarkTaken,
}: {
  meds: DashboardMedication[];
  adherenceWeekPct: number | null;
  onMarkTaken: (med: DashboardMedication) => Promise<void>;
}) {
  const grouped: Record<string, DashboardMedication[]> = { morning: [], afternoon: [], evening: [] };
  for (const m of meds) grouped[m.slot].push(m);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary" />
          Today's medications
        </CardTitle>
        {adherenceWeekPct != null && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              adherenceWeekPct >= 80 ? "border-emerald-300 text-emerald-700"
                : adherenceWeekPct >= 60 ? "border-amber-300 text-amber-700"
                : "border-rose-300 text-rose-700",
            )}
          >
            {adherenceWeekPct}% this week
          </Badge>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {meds.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-3">No active prescriptions.</p>
        )}
        {(["morning", "afternoon", "evening"] as const).map((slot) =>
          grouped[slot].length > 0 ? (
            <div key={slot}>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5">
                {slot}
              </p>
              <div className="space-y-1.5">
                {grouped[slot].map((m, i) => (
                  <div
                    key={`${m.prescriptionId}-${slot}-${i}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.medicationName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.dosage}{m.instructions ? ` · ${m.instructions}` : ""}
                      </p>
                    </div>
                    <MedStatusButton med={m} onClick={() => onMarkTaken(m)} />
                  </div>
                ))}
              </div>
            </div>
          ) : null,
        )}
      </CardContent>
    </Card>
  );
}

function MedStatusButton({ med, onClick }: { med: DashboardMedication; onClick: () => void }) {
  if (med.status === "TAKEN") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px]">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Taken
      </Badge>
    );
  }
  if (med.status === "MISSED") {
    return (
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-rose-300 text-rose-700" onClick={onClick}>
        Missed · Log now
      </Button>
    );
  }
  if (med.status === "DUE") {
    return (
      <Button size="sm" className="h-7 px-2 text-xs bg-amber-500 hover:bg-amber-600" onClick={onClick}>
        Due · Mark taken
      </Button>
    );
  }
  return (
    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onClick}>
      Mark taken
    </Button>
  );
}

// ── Vitals Tiles ──────────────────────────────────────────────────────────

function VitalsTiles({
  vitals,
  journeyId,
  onLog,
  onOpenBreathing,
}: {
  vitals: DashboardVital[];
  journeyId: string | null;
  onLog: (type: string) => void;
  onOpenBreathing: () => void;
}) {
  // Expanded-trend state: which vital's chart is open (null = none).
  const [trendType, setTrendType] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Vitals
        </CardTitle>
        <Button
          variant="outline" size="sm"
          onClick={onOpenBreathing}
          className={cn(
            "h-7 px-2.5 text-xs gap-1 rounded-full",
            // Resting: outlined chip with primary text + soft tint, so the
            // affordance is readable on the card surface.
            "border-primary/30 bg-primary/5 text-primary",
            // Hover: fill with primary and switch text to primary-foreground
            // so the contrast is unambiguous (no clash with the ghost variant's
            // default hover:text-accent-foreground).
            "hover:bg-primary hover:text-primary-foreground hover:border-primary",
            "transition-colors",
          )}
          title="Take a guided breathing break"
        >
          <Wind className="h-3.5 w-3.5" /> Breathe
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {vitals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-5 text-center">
            <Activity className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm font-medium">No vitals to track yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your doctor hasn't prescribed any vitals to track. They'll appear here once added during your next consultation.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {vitals.map((v) => {
                const isOpen = trendType === v.type;
                return (
                  <div
                    key={v.type}
                    className={cn(
                      "rounded-lg border p-3",
                      v.status === "NOT_LOGGED" || v.status === "STALE" ? "border-amber-200 bg-amber-50/40" : "border-border bg-background",
                      isOpen && "ring-1 ring-primary/40",
                    )}
                    title={v.prescribedBy ? `Prescribed by ${v.prescribedBy}` : undefined}
                  >
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1">
                      {VITAL_LABELS[v.type] || v.type}
                    </p>
                    {v.value != null ? (
                      <>
                        <p className="text-lg font-bold leading-none">
                          {v.value}
                          <span className="text-xs font-normal text-muted-foreground ml-1">{v.unit}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {v.status === "STALE"
                            ? (v.frequency === "WEEKLY" ? "Not logged this week" : "Not logged today")
                            : formatRelative(v.lastLoggedAt)}
                        </p>
                      </>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-700 mt-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span className="text-xs">Not logged</span>
                      </div>
                    )}
                    {v.notes && (
                      <p className="text-[10px] text-muted-foreground italic mt-1 line-clamp-2">
                        {v.notes}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1.5">
                      <Button
                        variant="ghost" size="sm" onClick={() => onLog(v.type)}
                        className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Log
                      </Button>
                      {journeyId && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => setTrendType(isOpen ? null : v.type)}
                          className="h-6 px-1.5 text-[11px] text-muted-foreground hover:bg-muted"
                          title="Show trend"
                        >
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {isOpen ? "Hide" : "Trend"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {trendType && journeyId && (
              <div className="mt-3 p-3 rounded-lg border bg-muted/20">
                <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-2">
                  {VITAL_LABELS[trendType] || trendType} · trend
                </p>
                <VitalChart journeyId={journeyId} type={trendType} days={30} compact />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Vital quick-log dialog ────────────────────────────────────────────────

function VitalLogDialog({
  open, onClose, vitalType, onSubmit,
}: {
  open: boolean; onClose: () => void; vitalType: string | null;
  onSubmit: (body: { type: string; value: number; unit?: string }) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (open) setValue(""); }, [open]);

  const submit = async () => {
    if (!vitalType || !value) return;
    setSubmitting(true);
    try {
      await onSubmit({ type: vitalType, value: Number(value) });
      toast.success("Vital logged · +5 points");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log vital");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log {VITAL_LABELS[vitalType || ""] || vitalType}</DialogTitle>
          <DialogDescription>Quick entry · saved instantly to your record.</DialogDescription>
        </DialogHeader>
        <Input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter value"
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={submitting || !value}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Treatment Journey Card ────────────────────────────────────────────────

const PHASE_COLORS: Record<DashboardJourneyPhase["status"], string> = {
  COMPLETED: "bg-emerald-500",
  ACTIVE: "bg-primary",
  UPCOMING: "bg-muted",
  SKIPPED: "bg-muted",
};

function TreatmentJourneyCard({ journey }: { journey: DashboardSummary["journey"] }) {
  if (!journey) return null;
  // Sum all per-phase durationDays. The header header pull `phaseHeader`
  // gives us the active-phase day count; downstream phases are projected as
  // upcoming (0%) and upstream phases as complete (100%).
  const totalDays = journey.phases.reduce((s, p) => s + (p.durationDays || 0), 0);
  const activeIdx = journey.phases.findIndex((p) => p.status === "ACTIVE");
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          {journey.title}
        </CardTitle>
        <div className="flex items-center justify-between gap-2 flex-wrap mt-1">
          <p className="text-xs text-muted-foreground">
            Total Journey Duration: <span className="font-bold text-foreground">{totalDays} {totalDays === 1 ? "day" : "days"}</span>
          </p>
          {journey.targetDate && (
            <p className="text-xs text-muted-foreground">
              Target End Date: <span className="font-bold text-foreground">{formatDate(journey.targetDate)}</span>
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {journey.phaseHeader && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{journey.phaseHeader.name}</p>
              <p className="text-xs text-muted-foreground">
                Day {journey.phaseHeader.currentDay ?? "—"} of {journey.phaseHeader.durationDays}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold leading-none">{journey.overallPct}%</p>
              <p className="text-[10px] text-muted-foreground">overall</p>
            </div>
          </div>
        )}

        {/* Per-phase rows — name, duration label, day-of-X countdown, fill bar */}
        <div className="space-y-2">
          {journey.phases.map((p, idx) => {
            // Active phase uses live currentDay; previous phases render as 100%; later phases 0%.
            let day = 0, status: "active" | "done" | "upcoming" = "upcoming";
            if (p.status === "COMPLETED") {
              day = p.durationDays;
              status = "done";
            } else if (p.status === "ACTIVE") {
              day = Math.max(0, Math.min(p.durationDays, journey.phaseHeader?.currentDay ?? 0));
              status = "active";
            } else if (idx < activeIdx) {
              day = p.durationDays;
              status = "done";
            }
            const pct = p.durationDays > 0 ? Math.round((day / p.durationDays) * 100) : 0;
            return (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {p.durationDays} days
                    {status === "active" && ` · Day ${day} of ${p.durationDays}`}
                    {status === "done"   && " · Complete"}
                    {status === "upcoming" && idx === activeIdx + 1 && " · Up next"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      status === "done" ? "bg-emerald-500" : status === "active" ? "bg-primary" : "bg-muted")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {journey.milestones.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {journey.milestones.map((m) => (
              <Badge
                key={m.id}
                variant="outline"
                className={cn(
                  "flex-shrink-0 text-[10px]",
                  m.achieved ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-muted/40",
                )}
              >
                {m.achieved ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Target className="h-3 w-3 mr-1" />}
                {m.title}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Zen Card ──────────────────────────────────────────────────────────────

function ZenCard({
  zen,
  onActOnChallenge,
}: {
  zen: DashboardSummary["zen"];
  onActOnChallenge: (action: { kind: string; [k: string]: unknown }) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          Zen Points
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
            <Award className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold leading-tight">{zen.points.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{zen.level.name}</p>
            {zen.level.nextAt && (
              <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                <div
                  className="bg-gradient-to-r from-amber-400 to-orange-500 h-1.5 rounded-full"
                  style={{ width: `${Math.min(zen.level.progress, 100)}%` }}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col items-center bg-orange-50 rounded-lg p-2 min-w-14">
            <Flame className="h-4 w-4 text-orange-500" />
            <p className="text-sm font-bold leading-none mt-0.5">{zen.streak.current}</p>
            <p className="text-[9px] text-muted-foreground">day streak</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-muted-foreground mb-1.5">Today's challenges</p>
          <div className="space-y-1">
            {zen.challenges.map((c) => (
              <button
                key={c.id}
                disabled={c.completed}
                onClick={() => onActOnChallenge(c.action)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                  c.completed ? "bg-emerald-50" : "bg-muted/40 hover:bg-muted",
                )}
              >
                {c.completed ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/40" />
                )}
                <span className="text-xs flex-1 truncate">{c.title}</span>
                <span className={cn("text-xs font-semibold", c.completed ? "text-emerald-700" : "text-amber-600")}>
                  +{c.points}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pain Map Card ─────────────────────────────────────────────────────────

/** Format an ISO timestamp as DD/MM/YYYY HH:MM in the user's local time —
 *  matches the doctor-side "Last updated" formatting requirement. */
function formatLastUpdated(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function PainMapCard({
  painMap,
  onAdd,
}: {
  painMap: DashboardSummary["painMap"];
  /** Opens the unified Daily Check-In modal directly at the body-map
   *  step. Replaces the previous lightweight inline region selector so
   *  every pain update is saved as a full DailyCheckIn record. */
  onAdd: () => void;
}) {
  const lastUpdated = formatLastUpdated(painMap.lastUpdated);
  const hasData = (painMap.regionsRaw?.length ?? 0) > 0;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-rose-500" />
          Pain map
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onAdd} className="h-7 px-2 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add Pain Point
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {!hasData ? (
          <p className="text-sm text-muted-foreground text-center py-3">No active pain points logged.</p>
        ) : (
          <BodyMapPainSelector
            initialPainRegions={painMap.regionsRaw ?? []}
            readOnly
          />
        )}
        {lastUpdated && hasData && (
          <p className="text-[10px] text-muted-foreground text-right">
            Last updated {lastUpdated}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Notifications Slide-Out Panel ─────────────────────────────────────────

function NotificationsPanel({
  open, onClose, messages,
}: {
  open: boolean; onClose: () => void; messages: SmartMessage[];
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Notifications
          </SheetTitle>
          <SheetDescription>All your messages and alerts in one place.</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 mt-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No notifications yet.</p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "border-l-4 pl-3 pr-2 py-3 rounded-r-lg",
                MSG_BORDERS[m.type],
                m.unread ? "bg-teal-50/40" : "bg-muted/30",
              )}
            >
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold">{m.sender}</p>
                <span className="text-[10px] text-muted-foreground">{formatRelative(m.timestamp)}</span>
              </div>
              <p className="text-sm font-medium">{m.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.preview}</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Medication Supply Card ────────────────────────────────────────────────

function MedicationSupplyCard({
  forecasts,
  refillingId,
  onRequestRefill,
}: {
  forecasts: MedicationForecast[];
  refillingId: string | null;
  onRequestRefill: (prescriptionId: string) => void;
}) {
  if (!forecasts.length) return null;

  // Surface only prescriptions the patient needs to act on: NEARING_DEPLETION,
  // DEPLETED, or any active prescription with <= 7 days of supply. PRN and
  // NOT_STARTED are filtered out.
  const actionable = forecasts
    .filter((f) => {
      if (f.status === "PRN" || f.status === "NOT_STARTED" || f.status === "DISCONTINUED") return false;
      if (f.daysRemaining == null) return false;
      return f.daysRemaining <= 7;
    })
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  if (!actionable.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Pill className="h-4 w-4 text-primary" />
          Medication supply
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {actionable.map((f) => {
          const critical = f.status === "DEPLETED" || (f.daysRemaining ?? 0) <= 0;
          const warning = (f.daysRemaining ?? 0) <= 3 && !critical;
          const rowClass = critical
            ? "bg-red-50 border-red-200"
            : warning
              ? "bg-amber-50 border-amber-200"
              : "bg-muted/40 border-transparent";
          const daysLabel = critical
            ? "Runs out today"
            : f.daysRemaining === 1
              ? "1 day left"
              : `${f.daysRemaining} days left`;
          const adherencePct = f.adherenceRate != null ? Math.round(f.adherenceRate * 100) : null;
          return (
            <div
              key={f.prescriptionId}
              className={cn("flex items-center gap-3 p-3 rounded-lg border", rowClass)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.medicationName}</p>
                <p className="text-xs text-muted-foreground">
                  {f.remainingDoses} dose{f.remainingDoses === 1 ? "" : "s"} remaining
                  {adherencePct != null && ` · ${adherencePct}% adherence`}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    "text-xs font-semibold",
                    critical ? "text-red-700" : warning ? "text-amber-700" : "text-muted-foreground",
                  )}
                >
                  {daysLabel}
                </p>
                <Button
                  size="sm"
                  variant={critical || warning ? "default" : "outline"}
                  className="h-7 mt-1 text-xs"
                  disabled={refillingId === f.prescriptionId}
                  onClick={() => onRequestRefill(f.prescriptionId)}
                >
                  {refillingId === f.prescriptionId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Request refill"
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Announcements (mirrors /announcements but read-only & compact) ───────

const ANNOUNCEMENT_PRIORITY: Record<
  string,
  { label: string; tone: string; Icon: React.ElementType }
> = {
  URGENT: { label: "Urgent", tone: "bg-red-100 text-red-700 border-red-200", Icon: AlertCircle },
  HIGH:   { label: "High",   tone: "bg-orange-100 text-orange-700 border-orange-200", Icon: AlertCircle },
  NORMAL: { label: "Normal", tone: "bg-blue-100 text-blue-700 border-blue-200", Icon: Info },
  LOW:    { label: "Low",    tone: "bg-gray-100 text-gray-600 border-gray-200", Icon: Info },
};

function announcementTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Care Team card ────────────────────────────────────────────────────────
//
// Surfaces the patient's active care assignments. Always visible in the
// right rail so the patient can see at a glance who their primary doctor is
// and any consulting / temporary fall-backs. The empty state nudges them to
// flag the missing assignment with admin — surfacing this absence is more
// useful than hiding it.

function CareTeamMemberRow({
  member,
  emphasized,
}: {
  member: CareTeamMember;
  emphasized: boolean;
}) {
  const navigate = useNavigate();
  const initials = (member.doctor.fullName || "Dr")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "DR";
  const roleLabel =
    member.type === "PRIMARY" ? "Primary Vaidya"
      : member.type === "TEMPORARY" ? "Covering today"
      : "Consulting";
  const roleClass =
    member.type === "PRIMARY" ? "bg-primary/10 text-primary border-primary/30"
      : member.type === "TEMPORARY" ? "bg-amber-100 text-amber-800 border-amber-300"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border",
        emphasized ? "border-primary/40 bg-primary/5" : "border-border/60",
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden",
          emphasized ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {member.doctor.profilePhoto ? (
          <img src={member.doctor.profilePhoto} alt={member.doctor.fullName ?? ""} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">
            Dr. {member.doctor.fullName || "Unnamed"}
          </p>
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
              roleClass,
            )}
          >
            {roleLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {member.doctor.specialization || member.doctor.qualification || "Specialisation on file"}
        </p>
        {/* Chat shortcut — /chat (patient view) auto-resolves to the
            consultation doctor and opens the thread, so no partnerId
            is needed. */}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => navigate("/chat")}
            aria-label={`Chat with Dr. ${member.doctor.fullName ?? "doctor"}`}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/10 px-2 py-1 rounded-md transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}

function CareTeamCard({ careTeam }: { careTeam: DashboardCareTeam }) {
  const hasPrimary = !!careTeam.primary;
  const hasAdditional = careTeam.additional.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          Your care team
        </CardTitle>
        {careTeam.primary && (
          <span className="text-[11px] text-muted-foreground">
            Assigned {new Date(careTeam.primary.assignedAt).toLocaleDateString()}
          </span>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {hasPrimary ? (
          <CareTeamMemberRow member={careTeam.primary!} emphasized />
        ) : (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center space-y-2">
            <UserPlus className="h-5 w-5 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium">No primary doctor assigned yet</p>
            <p className="text-xs text-muted-foreground">
              Your clinic admin will assign a Vaidya before your next consultation.
            </p>
          </div>
        )}
        {hasAdditional && careTeam.additional.map((member) => (
          <CareTeamMemberRow key={member.assignmentId} member={member} emphasized={false} />
        ))}
      </CardContent>
    </Card>
  );
}

function AnnouncementsCard() {
  const [items, setItems] = useState<AnnouncementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AnnouncementEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    communicationApi
      .getAnnouncements({ limit: 10 })
      .then(({ announcements }) => {
        if (cancelled) return;
        const sorted = [...announcements].sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setItems(sorted.slice(0, 4));
      })
      .catch(() => { /* silent — empty state covers it */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const unreadCount = items.filter((a) => !a.isRead).length;

  // Open the popup AND mark as read optimistically. Failure to persist the
  // read state is silently swallowed — the user still sees the content.
  const openAnnouncement = (entry: AnnouncementEntry) => {
    setSelected(entry);
    if (!entry.isRead) {
      setItems((prev) =>
        prev.map((a) => (a.id === entry.id ? { ...a, isRead: true } : a)),
      );
      communicationApi.markAnnouncementRead(entry.id).catch(() => { /* silent */ });
    }
  };

  const selectedCfg = selected
    ? ANNOUNCEMENT_PRIORITY[selected.priority] || ANNOUNCEMENT_PRIORITY.NORMAL
    : null;
  const SelectedIcon = selectedCfg?.Icon;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-primary" />
            Announcements
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Megaphone className="h-8 w-8 mb-1 opacity-40" />
              <p className="text-xs">No announcements right now</p>
            </div>
          ) : (
            items.map((a) => {
              const cfg = ANNOUNCEMENT_PRIORITY[a.priority] || ANNOUNCEMENT_PRIORITY.NORMAL;
              const PIcon = cfg.Icon;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openAnnouncement(a)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-colors hover:bg-muted/50",
                    !a.isRead ? "border-l-4 border-l-blue-500 bg-blue-50/30" : "border-border",
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <Badge className={cn(cfg.tone, "border text-[10px] px-1.5 py-0 h-4")}>
                      <PIcon className="h-2.5 w-2.5 mr-1" />
                      {cfg.label}
                    </Badge>
                    {a.isPinned && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        <Pin className="h-2.5 w-2.5 mr-1" />
                        Pinned
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
                      <Clock className="h-2.5 w-2.5" />
                      {announcementTimeAgo(a.createdAt)}
                    </span>
                  </div>
                  <p className="font-medium text-sm leading-snug line-clamp-1">{a.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {a.message}
                  </p>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && selectedCfg && SelectedIcon && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <Badge className={cn(selectedCfg.tone, "border text-xs")}>
                    <SelectedIcon className="h-3 w-3 mr-1" />
                    {selectedCfg.label}
                  </Badge>
                  {selected.isPinned && (
                    <Badge variant="secondary" className="text-xs">
                      <Pin className="h-3 w-3 mr-1" />
                      Pinned
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-lg leading-snug">
                  {selected.title}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 text-xs flex-wrap pt-1">
                  <span>{selected.authorName || "Admin"}</span>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {announcementTimeAgo(selected.createdAt)}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2 text-sm whitespace-pre-wrap leading-relaxed">
                {selected.message}
              </div>
              {selected.branches && selected.branches.length > 0 && (
                <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="font-medium">Branches:</span>
                  {selected.branches.map((b) => (
                    <Badge key={b.id} variant="outline" className="text-[10px]">
                      {b.name}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function EnhancedPatientDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  // The body-map step of the check-in is also the entry point for ad-hoc
  // pain updates: clicking "+ Add Pain Point" on the Pain Map card opens
  // the same modal but lands directly on Step 2 instead of mood selection.
  const [checkInInitialStep, setCheckInInitialStep] = useState<1 | 2 | 3>(1);
  const [showVitalLog, setShowVitalLog] = useState<string | null>(null);
  const [showBreathing, setShowBreathing] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  // Daily mood/sleep/water/activity check-in popup — auto-opens once per day
  // when the patient lands on the dashboard and hasn't already submitted.
  // Distinct from `showCheckIn` above (which drives the existing CheckInModal
  // for pain-map adds + dashboard-driven flows).
  const [showDailyCheckIn, setShowDailyCheckIn] = useState(false);
  // Latest relevant self-exam submission (DRAFT > SUBMITTED > REVIEWED).
  // `null` means the patient has no submission at all — the banner then
  // surfaces a "Start your kit" CTA instead of staying hidden.
  const [selfExam, setSelfExam] = useState<SelfExamSubmission | null>(null);
  // Only flip to true once the /mine fetch resolves so we don't flash the
  // empty-state banner for a beat while the request is in flight.
  const [selfExamLoaded, setSelfExamLoaded] = useState(false);
  const [forecasts, setForecasts] = useState<MedicationForecast[]>([]);
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const medsRef = useRef<HTMLDivElement>(null);
  const vitalsRef = useRef<HTMLDivElement>(null);

  const patientName =
    (profile as { patient?: { fullName?: string } } | null)?.patient?.fullName ||
    profile?.email ||
    "Patient";

  const load = useCallback(async () => {
    try {
      setError(null);
      const summary = await enhancedDashboardApi.getSummary();
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadForecasts = useCallback(async () => {
    try {
      const res = await enhancedDashboardApi.getMedicationForecast();
      setForecasts(res.data || []);
    } catch {
      /* silent — card simply hides */
    }
  }, []);

  const handleRequestRefill = useCallback(async (prescriptionId: string) => {
    setRefillingId(prescriptionId);
    try {
      await enhancedDashboardApi.requestMedicationRefill(prescriptionId);
      toast.success("Refill request sent to your doctor");
      await loadForecasts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("already pending")) {
        toast.info("A refill request is already pending for this prescription");
      } else {
        toast.error(msg || "Failed to request refill");
      }
    } finally {
      setRefillingId(null);
    }
  }, [loadForecasts]);

  useEffect(() => { load(); loadForecasts(); }, [load, loadForecasts]);

  // Load the most relevant self-exam submission so we can surface the right
  // banner state. Priority: DRAFT (still working on it) > SUBMITTED (waiting
  // for review) > REVIEWED (Vaidya finished). When nothing exists the banner
  // renders a "Start your kit" CTA so the patient has an entry point.
  // Best-effort — any failure is silent and the dashboard keeps rendering.
  useEffect(() => {
    let cancelled = false;
    selfExamService
      .mine()
      .then((list) => {
        if (cancelled) return;
        const pick =
          list.find((s) => s.status === "DRAFT") ??
          list.find((s) => s.status === "SUBMITTED") ??
          list.find((s) => s.status === "REVIEWED") ??
          null;
        setSelfExam(pick);
        setSelfExamLoaded(true);
      })
      .catch(() => { setSelfExamLoaded(true); /* still render the empty CTA */ });
    return () => { cancelled = true; };
  }, []);

  // Auto-open the daily check-in popup once per day. We hit the lightweight
  // /api/wellness/check-in/today endpoint and only surface the popup if the
  // patient hasn't already submitted today. A small 1s delay lets the rest
  // of the dashboard paint first so the popup feels like an invitation
  // rather than a blocker.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    wellnessService.getCheckInToday()
      .then(({ data }) => {
        if (cancelled || data.hasSubmittedToday) return;
        timer = setTimeout(() => {
          if (!cancelled) setShowDailyCheckIn(true);
        }, 1000);
      })
      .catch(() => { /* silent — popup stays hidden if the probe fails */ });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ── Action dispatcher ──
  const dispatch = useCallback(
    (action: { kind: string; [k: string]: unknown }) => {
      switch (action.kind) {
        case "OPEN_CHECKIN_MODAL":
          setShowCheckIn(true);
          break;
        case "OPEN_VITAL_LOGGER":
          setShowVitalLog((action.vitalType as string) || "BP_SYSTOLIC");
          break;
        case "MARK_MED_TAKEN":
          if (typeof action.prescriptionId === "string") {
            enhancedDashboardApi
              .markMedicationTaken(action.prescriptionId, action.slot as "morning" | "afternoon" | "evening")
              .then(() => { toast.success("Medication logged"); load(); })
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Failed"));
          }
          break;
        case "COMPLETE_PHASE_TASK":
          if (typeof action.taskId === "string") {
            enhancedDashboardApi
              .completeTask(action.taskId)
              .then(() => { toast.success("Task completed"); load(); })
              .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Failed"));
          }
          break;
        case "JOIN_APPOINTMENT":
          navigate("/appointments");
          break;
        case "VIEW_APPOINTMENT":
          navigate("/appointments");
          break;
        case "SCROLL_TO_MEDS":
          medsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        case "SCROLL_TO_VITALS":
          vitalsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
      }
    },
    [load, navigate],
  );

  // ── Loading / error states ──
  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-6 max-w-6xl space-y-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">Couldn't load your dashboard</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={load}>Try again</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t("today.greeting_morning");
    if (h < 18) return t("today.greeting_afternoon");
    return t("today.greeting_evening");
  })();

  return (
    <AppLayout>
      {/* Socket-driven rating-flow modal — listens for feedback_request /
          journey_feedback_request and queues prompts so only one is shown
          at a time. Renders nothing until an event arrives. */}
      <FeedbackPromptListener />
      {/* Home-therapy session-complete feedback prompt — fires within ~2s of
          the therapist tapping Complete (Task 8). Idempotent server-side. */}
      <HomeTherapyFeedbackListener />
      <div className="container mx-auto px-4 py-5 max-w-6xl space-y-4">
        {/* Photo reminder — appears when the patient is in an active journey
            phase without a recent DURING photo. Self-contained: socket + REST
            + dismissal state, including the upload modal. */}
        <PhotoReminderBanner />
        {/* Time-aware meal-photo prompt — visible during breakfast / lunch /
            dinner windows when the patient hasn't yet logged a photo for the
            active meal. Self-hides outside the window or after upload. */}
        <MealPhotoBanner />
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight">
              {greeting}, {patientName.split(" ")[0]}
            </h1>
            <p className="text-sm text-muted-foreground">{t("today.subtitle")}</p>
          </div>
          <Button
            variant="ghost" size="icon" className="relative"
            onClick={() => setShowNotifPanel(true)}
          >
            <Bell className="h-5 w-5" />
            {data.unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" />
            )}
          </Button>
        </div>

        {/* ── Smart Banner ───────────────────────────────────────────── */}
        <SmartBanner banner={data.banner} onAction={dispatch} />

        {/* ── Home Address prompt — feature-gates Home Therapy referrals ──
            Shown when the patient has no Address Line 1 on file. CTA jumps
            straight to the Profile page where the PatientLocationCard
            handles the actual edit + geocode. Disappears the moment the
            address is saved. */}
        {(() => {
          const p = (profile as { patient?: PatientLocationFields } | null)?.patient;
          const needsAddress = !!p && !(p.addressLine1 ?? "").trim();
          if (!needsAddress) return null;
          return (
            <div
              role="alert"
              className="rounded-2xl border-2 border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/30 p-4 flex items-start gap-3"
            >
              <MapPin className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-tight text-amber-900 dark:text-amber-100">
                  Add your home address
                </p>
                <p className="text-sm text-amber-800/90 dark:text-amber-200/90 mt-0.5">
                  Required so your doctor can refer you for at-home therapy sessions.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => navigate("/profile")}
                className="shrink-0 gap-2"
              >
                Add address
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          );
        })()}

        {/* ── Post-consultation feedback prompt (4-question flow) ───── */}
        <ConsultationFeedbackPrompt />

        {/* ── End-of-journey feedback (full-screen takeover, 7 stages) ──
            Self-contained: checks /api/feedback/journey/available on mount
            and opens itself when a pending row exists. Renders nothing
            otherwise. */}
        <JourneyFeedbackPrompt />

        {/* ── Self-Exam Kit banner — always shown once the /mine fetch
            resolves. Empty state surfaces a "Start your kit" CTA, the
            other states reflect submission progress. ─────────────── */}
        {selfExamLoaded && (
          <SelfExamBanner
            submission={selfExam}
            onOpen={() => navigate("/self-exam")}
          />
        )}

        {/* ── Vitals — pinned to the top of the dashboard so today's
            log-status is the first thing the patient sees. Full-width
            above the two-column grid; the vitalsRef stays on the wrapper
            so the SCROLL_TO_VITALS dispatch still targets it. ──────── */}
        <div ref={vitalsRef}>
          <VitalsTiles
            vitals={data.vitals.items}
            journeyId={data.journey?.id ?? null}
            onLog={(t) => setShowVitalLog(t)}
            onOpenBreathing={() => setShowBreathing(true)}
          />
        </div>

        {/* ── Two-column grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column — primary actions */}
          <div className="lg:col-span-2 space-y-4">
            {/* Monday Motivation Card — personalised weekly tip (prakriti +
                Indian season). The component self-hides when the patient has
                already read this week's card and it's not Monday, so it won't
                permanently occupy the top of the dashboard. Save / share are
                inline; the "Got it" CTA awards +5 Zen Points the first time. */}
            <MotivationCard patientName={patientName} />

            <DailyTaskChecklist tasks={data.tasks} onActOnTask={(t) => dispatch(t.action)} />

            <div ref={medsRef}>
              <MedicationCard
                meds={data.medications.items}
                adherenceWeekPct={data.medications.adherenceWeekPct}
                onMarkTaken={async (m) => {
                  try {
                    await enhancedDashboardApi.markMedicationTaken(m.prescriptionId, m.slot);
                    toast.success("Marked as taken");
                    await Promise.all([load(), loadForecasts()]);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              />
            </div>

            <MedicationSupplyCard
              forecasts={forecasts}
              refillingId={refillingId}
              onRequestRefill={handleRequestRefill}
            />

            <PainMapCard
              painMap={data.painMap}
              onAdd={() => { setCheckInInitialStep(2); setShowCheckIn(true); }}
            />
          </div>

          {/* Right column — context + rewards */}
          <div className="space-y-4">
            <CareTeamCard careTeam={data.careTeam} />
            <AnnouncementsCard />
            <ZenCard zen={data.zen} onActOnChallenge={dispatch} />
            <SmartMessagesPanel messages={data.smartMessages} channels={data.channels} />
            <TreatmentJourneyCard journey={data.journey} />
          </div>
        </div>

        <p className="text-[10px] text-center text-muted-foreground">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
      </div>

      {/* ── Modals & overlays ───────────────────────────────────────── */}
      <CheckInModal
        open={showCheckIn}
        initialStep={checkInInitialStep}
        onClose={() => { setShowCheckIn(false); setCheckInInitialStep(1); }}
        onSubmit={async (body) => {
          await enhancedDashboardApi.submitCheckIn(body);
          await load();
        }}
      />

      <VitalLogDialog
        open={!!showVitalLog}
        onClose={() => setShowVitalLog(null)}
        vitalType={showVitalLog}
        onSubmit={async (body) => {
          await enhancedDashboardApi.quickLogVital(body);
          await load();
        }}
      />

      <NotificationsPanel
        open={showNotifPanel}
        onClose={() => setShowNotifPanel(false)}
        messages={data.smartMessages}
      />

      <BreathingExercise
        isOpen={showBreathing}
        onClose={() => setShowBreathing(false)}
        onComplete={(pattern) => toast.success(`Nice work — ${pattern} complete`)}
      />

      {/* Floating Voice Health Coach widget — gated by AYURVEDIC_VOICE_COACH */}
      <CoachWidget />

      {/* Daily mood/sleep/water/activity popup — auto-opens once per day if
          the patient hasn't submitted yet. On submit we fan out to the
          wellness check-in + water + activity endpoints so the dashboard
          adherence figures pick the new entries up on the next load. */}
      <DailyCheckInPopup
        isOpen={showDailyCheckIn}
        onClose={() => setShowDailyCheckIn(false)}
        onSuccess={() => { load(); }}
      />
    </AppLayout>
  );
}
