import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/common/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Droplet, Activity, Moon, X, Loader2, Camera, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { wellnessService } from "@/services/wellness.service";
import { dailyTrackingService } from "@/services/dailyTracking.service";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";
import { apiClient } from "@/lib/api-client";

// F03 dosha colours — match F04's DoshaForecastPanel theme.
const DOSHA_THEME: Record<string, { bg: string; label: string }> = {
  VATA:     { bg: "bg-[#7c3aed] text-white", label: "VATA" },
  PITTA:    { bg: "bg-[#ea580c] text-white", label: "PITTA" },
  KAPHA:    { bg: "bg-[#0d9488] text-white", label: "KAPHA" },
  BALANCED: { bg: "bg-emerald-600 text-white", label: "BALANCED" },
  TRIDOSHA: { bg: "bg-slate-600 text-white", label: "TRIDOSHA" },
};

interface TongueAnalysisResponse {
  id: string;
  doshaIndication: string | null;
  confidence: number | null;
  analysisNotes: string | null;
  alertEmitted: boolean;
}

// Daily check-in popup for the patient dashboard. 4-step wizard collecting
// mood / sleep / water / activity, fanning out client-side to the existing
// per-domain endpoints (wellness/check-in + daily-tracking/water +
// daily-tracking/activity) so we add no new schema.
//
// The wellness submit fails if a check-in already exists today; the dashboard
// is meant to guard that case via getCheckInToday() before opening — but if
// the backend rejects we surface the message and let the patient close.

interface DailyCheckInPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MOODS = [
  { id: "TERRIBLE", emoji: "😣", label: "Terrible" },
  { id: "LOW", emoji: "😕", label: "Low" },
  { id: "OKAY", emoji: "😐", label: "Okay" },
  { id: "GOOD", emoji: "🙂", label: "Good" },
  { id: "GREAT", emoji: "😄", label: "Great" },
];

export function DailyCheckInPopup({ isOpen, onClose, onSuccess }: DailyCheckInPopupProps) {
  const { has } = useTenantFeatures();
  const tongueOn = has("MULTIMODAL_DIAGNOSTIC_AI");

  const [step, setStep] = useState(1);
  const [mood, setMood] = useState<string | null>(null);
  const [sleepHours, setSleepHours] = useState<number>(7);
  const [waterLitres, setWaterLitres] = useState<number>(1.5);
  const [activityDone, setActivityDone] = useState<boolean | null>(null);
  const [activityNotes, setActivityNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // F03 — Step 5 state. Filled only when the tongue feature is enabled and
  // the main check-in saved successfully.
  const [savedCheckInId, setSavedCheckInId] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<TongueAnalysisResponse | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const TOTAL_STEPS = tongueOn ? 5 : 4;

  const reset = () => {
    setStep(1);
    setMood(null);
    setSleepHours(7);
    setWaterLitres(1.5);
    setActivityDone(null);
    setActivityNotes("");
    setSubmitting(false);
    setSavedCheckInId(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setAnalysing(false);
    setAnalysisResult(null);
    setAnalysisFailed(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const canAdvance =
    (step === 1 && mood !== null) ||
    (step === 2 && sleepHours >= 0 && sleepHours <= 14) ||
    (step === 3 && waterLitres >= 0 && waterLitres <= 6) ||
    (step === 4 && activityDone !== null);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSubmit = async () => {
    if (!mood || activityDone === null) return;
    setSubmitting(true);

    // Mood/sleep is the primary log; if it fails (e.g. already submitted), bail.
    // F03 — capture the returned check-in id so step 5 can attach the tongue
    // photo to the right row.
    let newCheckInId: string | null = null;
    try {
      const resp = await wellnessService.submitCheckIn({
        painLevel: 0,
        sleepHours,
        mood,
        notes: undefined,
      });
      newCheckInId = resp.data?.data?.id ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Check-in failed. Try again.";
      toast.error(message);
      setSubmitting(false);
      return;
    }

    // Water + activity are best-effort — toast on failure but don't roll back.
    const waterMl = Math.round(waterLitres * 1000);
    if (waterMl > 0) {
      try {
        await dailyTrackingService.logWater(waterMl);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Water log failed.";
        toast.error(`Water: ${message}`);
      }
    }

    if (activityDone) {
      try {
        await dailyTrackingService.logActivity({
          activityType: "OTHER",
          durationMins: 30,
          notes: activityNotes.trim() || undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Activity log failed.";
        toast.error(`Activity: ${message}`);
      }
    }

    toast.success("✨ Daily check-in saved! +10 Zen Points");
    onSuccess?.();
    // F03 — when the tongue feature is on and we know the check-in id,
    // advance to the optional Step 5 (tongue photo) instead of closing.
    // Skipping step 5 has zero effect on the saved check-in.
    if (tongueOn && newCheckInId) {
      setSavedCheckInId(newCheckInId);
      setSubmitting(false);
      setStep(5);
      return;
    }
    reset();
    onClose();
  };

  // F03 — Step 5 handlers.
  function onPickPhoto(file: File | null) {
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
    setAnalysisResult(null);
    setAnalysisFailed(false);
  }

  async function handleAnalyse() {
    if (!photoFile || !savedCheckInId) return;
    setAnalysing(true);
    setAnalysisFailed(false);
    try {
      // Use the shared apiClient.upload for multipart — it injects the
      // correct Authorization header (the bare fetch() approach above used
      // localStorage.getItem("token") which is NOT the key this app stores
      // the JWT under, yielding 401 Unauthorized).
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("checkInId", savedCheckInId);
      const resp = await apiClient.upload<TongueAnalysisResponse>(
        "/api/wellness/check-in/tongue-photo",
        fd,
      );
      setAnalysisResult(resp.data);
    } catch (err) {
      // Never blocks the check-in flow — check-in is already saved.
      console.warn("[tongue] analyse failed:", err);
      setAnalysisFailed(true);
    } finally {
      setAnalysing(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Backdrop + escape are blocked below; only our own X button can
        // close, and it goes through handleClose() directly. If anything
        // else opens this transition we still want to honor close intent.
        if (!open && !submitting) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6 pb-2 flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-black tracking-tight" style={{ color: "#0D6E6E" }}>
              Daily check-in
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Step {step} of {TOTAL_STEPS} • Earn +10 Zen Points
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </DialogHeader>

        {/* Progress dots */}
        <div className="px-6 pb-3 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              className={cn("h-1.5 flex-1 rounded-full transition-colors")}
              style={{ background: n <= step ? "#0D6E6E" : "#E5E7EB" }}
            />
          ))}
        </div>

        <div className="px-6 pb-6 space-y-6">
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground">How are you feeling today?</p>
              <div className="grid grid-cols-5 gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMood(m.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all",
                      mood === m.id
                        ? "border-[#0D6E6E] bg-[#E1F5EE]"
                        : "border-transparent bg-gray-50 hover:border-gray-200",
                    )}
                  >
                    <span className="text-2xl leading-none">{m.emoji}</span>
                    <span className="text-[10px] font-medium uppercase tracking-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Moon className="w-4 h-4" style={{ color: "#0D6E6E" }} />
                How many hours did you sleep?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setSleepHours((h) => Math.max(0, +(h - 0.5).toFixed(1)))}
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  aria-label="Decrease sleep"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <Input
                  type="number"
                  min={0}
                  max={14}
                  step={0.5}
                  value={sleepHours}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) setSleepHours(Math.max(0, Math.min(14, v)));
                  }}
                  className="w-24 h-12 text-center text-xl font-black"
                  style={{ color: "#0D6E6E" }}
                />
                <button
                  type="button"
                  onClick={() => setSleepHours((h) => Math.min(14, +(h + 0.5).toFixed(1)))}
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  aria-label="Increase sleep"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-xs text-muted-foreground">hours</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Droplet className="w-4 h-4" style={{ color: "#0D6E6E" }} />
                How much water did you drink?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setWaterLitres((w) => Math.max(0, +(w - 0.25).toFixed(2)))}
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  aria-label="Decrease water"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <Input
                  type="number"
                  min={0}
                  max={6}
                  step={0.25}
                  value={waterLitres}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) setWaterLitres(Math.max(0, Math.min(6, v)));
                  }}
                  className="w-24 h-12 text-center text-xl font-black"
                  style={{ color: "#0D6E6E" }}
                />
                <button
                  type="button"
                  onClick={() => setWaterLitres((w) => Math.min(6, +(w + 0.25).toFixed(2)))}
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50"
                  aria-label="Increase water"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-xs text-muted-foreground">litres</p>
              <div className="flex justify-center gap-1 pt-1">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <Droplet
                    key={n}
                    className="w-4 h-4"
                    style={{
                      color: n <= Math.ceil(waterLitres) ? "#0D6E6E" : "#E5E7EB",
                      fill: n <= Math.floor(waterLitres) ? "#0D6E6E" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: "#0D6E6E" }} />
                Did you exercise or do any physical activity?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActivityDone(true)}
                  className={cn(
                    "py-3 rounded-xl border-2 font-bold text-sm transition-all",
                    activityDone === true
                      ? "border-[#0D6E6E] bg-[#E1F5EE] text-[#0D6E6E]"
                      : "border-gray-200 bg-white hover:border-gray-300",
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivityDone(false);
                    setActivityNotes("");
                  }}
                  className={cn(
                    "py-3 rounded-xl border-2 font-bold text-sm transition-all",
                    activityDone === false
                      ? "border-[#0D6E6E] bg-[#E1F5EE] text-[#0D6E6E]"
                      : "border-gray-200 bg-white hover:border-gray-300",
                  )}
                >
                  No
                </button>
              </div>
              {activityDone === true && (
                <Textarea
                  placeholder="What did you do? (optional)"
                  value={activityNotes}
                  onChange={(e) => setActivityNotes(e.target.value)}
                  className="text-sm"
                  rows={2}
                />
              )}
            </div>
          )}

          {/* F03 — Step 5: optional Jihva Pariksha tongue photo. Reached only
              when MULTIMODAL_DIAGNOSTIC_AI is enabled AND step 4's submit
              saved successfully. Skipping is a no-op for the check-in. */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: "#0D6E6E" }} />
                  Tongue Check <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  A quick photo helps your doctor track your Ayurvedic health trends.
                </p>
              </div>

              {!photoPreview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-40 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-2 hover:bg-gray-50 transition"
                >
                  <Camera className="w-8 h-8 text-gray-400" />
                  <span className="text-xs text-gray-500">Tap to take a tongue photo</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
              />

              {photoPreview && (
                <div className="space-y-2">
                  <img
                    src={photoPreview}
                    alt="Tongue preview"
                    className="w-full h-40 object-cover rounded-xl border border-gray-200"
                  />
                  {!analysisResult && !analysisFailed && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] text-[#0D6E6E] hover:underline"
                    >
                      Retake photo
                    </button>
                  )}
                </div>
              )}

              {analysing && (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
                  <p>Analysing tongue image…</p>
                </div>
              )}

              {analysisResult && (
                <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-2 text-xs">
                  {analysisResult.doshaIndication && (
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide",
                          DOSHA_THEME[analysisResult.doshaIndication]?.bg ?? "bg-gray-100 text-gray-800",
                        )}
                      >
                        {DOSHA_THEME[analysisResult.doshaIndication]?.label ?? analysisResult.doshaIndication}
                      </span>
                      {typeof analysisResult.confidence === "number" && (
                        <span className="text-muted-foreground">
                          {Math.round(analysisResult.confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                  )}
                  {analysisResult.analysisNotes && (
                    <p className="leading-snug">{analysisResult.analysisNotes}</p>
                  )}
                  <p className="text-[11px] text-emerald-700">✓ Shared with your doctor</p>
                </div>
              )}

              {analysisFailed && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Photo saved — analysis unavailable. Your doctor can still review the image.
                </div>
              )}
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex gap-2 pt-2">
            {/* Back is only meaningful on steps 2-4; step 5 doesn't go back
                because the check-in is already saved. */}
            {step > 1 && step < 5 && (
              <Button
                variant="outline"
                onClick={back}
                disabled={submitting}
                className="flex-1"
              >
                Back
              </Button>
            )}
            {step < 4 && (
              <Button
                onClick={next}
                disabled={!canAdvance}
                className="flex-1 text-white"
                style={{ background: canAdvance ? "#0D6E6E" : undefined }}
              >
                Next
              </Button>
            )}
            {step === 4 && (
              <Button
                onClick={handleSubmit}
                disabled={!canAdvance || submitting}
                className="flex-1 text-white"
                style={{ background: canAdvance && !submitting ? "#0D6E6E" : undefined }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            )}
            {/* F03 — Step 5 footer: Skip closes immediately; Analyse posts
                the photo (only when a photo is selected and not yet analysed). */}
            {step === 5 && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  {analysisResult || analysisFailed ? "Done" : "Skip"}
                </Button>
                {photoFile && !analysisResult && !analysisFailed && (
                  <Button
                    onClick={handleAnalyse}
                    disabled={analysing}
                    className="flex-1 text-white"
                    style={{ background: !analysing ? "#0D6E6E" : undefined }}
                  >
                    {analysing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Analysing…
                      </>
                    ) : (
                      "Analyse"
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DailyCheckInPopup;
