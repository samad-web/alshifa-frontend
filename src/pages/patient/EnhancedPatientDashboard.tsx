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
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Pill, Activity, AlertCircle, CheckCircle2, Clock, Sparkles,
  Trophy, Flame, Calendar, ArrowRight, Plus, MessageSquare, MapPin,
  Smartphone, MessageCircle, AtSign, Mail, Send, Smile, Frown, Meh,
  Heart, ChevronRight, Loader2, X, Target, Award, Wind, TrendingUp,
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
} from "@/services/enhancedDashboard.service";
import { selfExamService, type SelfExamSubmission } from "@/services/selfExam.service";
import { cn } from "@/lib/utils";
import { BreathingExercise } from "@/components/wellness/BreathingExercise";
import { VitalChart } from "@/components/vitals/VitalChart";

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

function SelfExamBanner({
  submission,
  onOpen,
}: {
  submission: SelfExamSubmission;
  onOpen: () => void;
}) {
  // Local completion count from whatever child rows were loaded by the
  // `/mine` endpoint — we don't pull the full checklist here to keep the
  // dashboard fast. This is a rough indicator; the full kit page recomputes.
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
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border-2 border-teal-300 bg-teal-50 text-teal-900 p-4 flex items-start gap-3"
    >
      <div className="mt-0.5">
        <Sparkles className="h-5 w-5 text-teal-700" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-tight">
          Complete your Self-Exam Kit
        </p>
        <p className="text-sm text-teal-800/90 mt-0.5">
          Pre-consultation observations for {zonesText}
          {count > 0 ? ` — ${count} captured so far` : " — nothing captured yet"}.
          Your Vaidya will review before the appointment.
        </p>
      </div>
      <Button size="sm" onClick={onOpen} className="flex-shrink-0 bg-teal-700 hover:bg-teal-800 text-white">
        Open kit
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
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: {
    mood: "TERRIBLE" | "LOW" | "OKAY" | "GOOD" | "GREAT";
    painLevel: number;
    sleepQuality: "POOR" | "FAIR" | "GOOD" | "GREAT";
  }) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [mood, setMood] = useState<string | null>(null);
  const [pain, setPain] = useState(3);
  const [sleep, setSleep] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const moods = [
    { key: "TERRIBLE", label: "Terrible", icon: <Frown className="h-7 w-7" />, color: "text-rose-500" },
    { key: "LOW", label: "Low", icon: <Frown className="h-7 w-7" />, color: "text-orange-400" },
    { key: "OKAY", label: "Okay", icon: <Meh className="h-7 w-7" />, color: "text-amber-400" },
    { key: "GOOD", label: "Good", icon: <Smile className="h-7 w-7" />, color: "text-lime-500" },
    { key: "GREAT", label: "Great", icon: <Smile className="h-7 w-7" />, color: "text-emerald-500" },
  ];
  const sleepOpts = ["POOR", "FAIR", "GOOD", "GREAT"];

  const reset = () => { setStep(1); setMood(null); setPain(3); setSleep(null); };

  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!mood || !sleep) return;
    setSubmitting(true);
    try {
      await onSubmit({ mood, painLevel: pain, sleepQuality: sleep });
      toast.success("+20 Zen Points · Check-in saved");
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Insight inline (optional contextual hint)
  const painInsight = pain >= 7
    ? "High pain reported — your doctor will see this immediately."
    : pain >= 4
      ? "Tip: regular breathing exercises reduce mid-range pain over time."
      : "Looking good. Keep moving.";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-md">
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
              <p className="text-sm font-medium mb-1">Pain level (0–10)</p>
              <p className="text-xs text-muted-foreground mb-4">0 = none, 10 = worst imaginable</p>
              <div className="flex items-center gap-4 mb-3">
                <Slider value={[pain]} onValueChange={(v) => setPain(v[0])} min={0} max={10} step={1} className="flex-1" />
                <div className="w-12 text-center">
                  <span className="text-2xl font-bold tabular-nums">{pain}</span>
                </div>
              </div>
              <div className="rounded-lg bg-muted/40 p-3 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">{painInsight}</p>
              </div>
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
          <Button variant="ghost" size="sm" onClick={() => (step > 1 ? setStep(step - 1) : close())}>
            {step > 1 ? "Back" : "Cancel"}
          </Button>
          {step < 3 ? (
            <Button
              size="sm"
              onClick={() => setStep(step + 1)}
              disabled={(step === 1 && !mood) || step === 2 ? false : false}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={submit} disabled={!sleep || submitting}>
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
          {channels.smsEnabled && <AtSign className="h-3.5 w-3.5 text-muted-foreground" />}
          {channels.emailEnabled && <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
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
          variant="ghost" size="sm"
          onClick={onOpenBreathing}
          className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
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
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          {journey.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
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
        <div className="flex gap-1.5">
          {journey.phases.map((p) => (
            <div key={p.id} className="flex-1" title={`${p.name} · ${p.status}`}>
              <div className={cn("h-2 rounded-full", PHASE_COLORS[p.status])} />
              <p className="text-[10px] text-muted-foreground mt-1 truncate">{p.name}</p>
            </div>
          ))}
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

function PainMapCard({
  painMap,
  onAdd,
}: {
  painMap: DashboardSummary["painMap"];
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-4 w-4 text-rose-500" />
          Pain map
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onAdd} className="h-7 px-2 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {painMap.regions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">No active pain points logged.</p>
        ) : (
          <div className="space-y-2">
            {painMap.regions.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm w-24 truncate">{r.region}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      r.severity > 6 ? "bg-rose-500" : r.severity > 3 ? "bg-amber-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${(r.severity / 10) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-6 text-right">{r.severity}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Pain log dialog ───────────────────────────────────────────────────────

function PainLogDialog({
  open, onClose, onSubmit,
}: {
  open: boolean; onClose: () => void;
  onSubmit: (body: { region: string; severity: number }) => Promise<void>;
}) {
  const [region, setRegion] = useState("");
  const [severity, setSeverity] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (open) { setRegion(""); setSeverity(5); } }, [open]);

  const submit = async () => {
    if (!region.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ region: region.trim(), severity });
      toast.success("Pain point recorded · doctor notified");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log pain");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log pain region</DialogTitle>
          <DialogDescription>Updates your pain map and notifies your care team.</DialogDescription>
        </DialogHeader>
        <Input
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="e.g. Lower back, Right knee"
          autoFocus
        />
        <div>
          <p className="text-xs font-medium mb-2">Severity: <span className="font-bold">{severity}/10</span></p>
          <Slider value={[severity]} onValueChange={(v) => setSeverity(v[0])} min={0} max={10} step={1} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={submitting || !region.trim()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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

// ── Main Page ─────────────────────────────────────────────────────────────

export default function EnhancedPatientDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showVitalLog, setShowVitalLog] = useState<string | null>(null);
  const [showPainLog, setShowPainLog] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [selfExamDraft, setSelfExamDraft] = useState<SelfExamSubmission | null>(null);
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

  // Load the most recent self-exam submission (if any) to decide whether to
  // surface a banner. Best-effort — any failure is silent so the rest of the
  // dashboard keeps rendering.
  useEffect(() => {
    let cancelled = false;
    selfExamService
      .mine()
      .then((list) => {
        if (cancelled) return;
        const draft =
          list.find((s) => s.status === "DRAFT") ??
          list.find((s) => s.status === "SUBMITTED") ??
          null;
        setSelfExamDraft(draft);
      })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
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
      <div className="container mx-auto px-4 py-5 max-w-6xl space-y-4">
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

        {/* ── Self-Exam Kit banner (only while a DRAFT exists) ──────── */}
        {selfExamDraft && selfExamDraft.status === "DRAFT" && (
          <SelfExamBanner
            submission={selfExamDraft}
            onOpen={() => navigate("/self-exam")}
          />
        )}

        {/* ── Two-column grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column — primary actions */}
          <div className="lg:col-span-2 space-y-4">
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

            <div ref={vitalsRef}>
              <VitalsTiles
                vitals={data.vitals.items}
                journeyId={data.journey?.id ?? null}
                onLog={(t) => setShowVitalLog(t)}
                onOpenBreathing={() => setShowBreathing(true)}
              />
            </div>

            <PainMapCard painMap={data.painMap} onAdd={() => setShowPainLog(true)} />
          </div>

          {/* Right column — context + rewards */}
          <div className="space-y-4">
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
        onClose={() => setShowCheckIn(false)}
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

      <PainLogDialog
        open={showPainLog}
        onClose={() => setShowPainLog(false)}
        onSubmit={async (body) => {
          await enhancedDashboardApi.logPainPoint(body);
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
    </AppLayout>
  );
}
