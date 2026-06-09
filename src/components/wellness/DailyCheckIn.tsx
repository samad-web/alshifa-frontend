import { useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/common/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Smile,
    Meh,
    Frown,
    Moon,
    AlertCircle,
    Award,
    Camera,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useTenantFeatures } from "@/hooks/useTenantFeatures";

interface DailyCheckInProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (pointsAwarded: number) => void;
}

interface CheckInResponse {
    message: string;
    data: { id: string };
}

interface TongueAnalysisResponse {
    id: string;
    doshaIndication: string | null;
    confidence: number | null;
    analysisNotes: string | null;
    alertEmitted: boolean;
}

// F03 dosha colours — match F04's DoshaForecastPanel theme.
const DOSHA_THEME: Record<string, { bg: string; label: string }> = {
    VATA:     { bg: "bg-[#7c3aed] text-white", label: "VATA" },
    PITTA:    { bg: "bg-[#ea580c] text-white", label: "PITTA" },
    KAPHA:    { bg: "bg-[#0d9488] text-white", label: "KAPHA" },
    BALANCED: { bg: "bg-emerald-600 text-white", label: "BALANCED" },
    TRIDOSHA: { bg: "bg-slate-600 text-white", label: "TRIDOSHA" },
};

export function DailyCheckIn({ isOpen, onClose, onSuccess }: DailyCheckInProps) {
    const { has } = useTenantFeatures();
    const tongueOn = has("MULTIMODAL_DIAGNOSTIC_AI");

    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        painLevel: 0,
        sleepHours: 7,
        mood: "NEUTRAL",
        notes: "",
    });

    // F03 — Step 3 state. The check-in is saved BEFORE the wizard reaches
    // Step 3, so cancelling / skipping the photo has zero effect on the
    // submitted check-in.
    const [savedCheckInId, setSavedCheckInId] = useState<string | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [analysing, setAnalysing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<TongueAnalysisResponse | null>(null);
    const [analysisFailed, setAnalysisFailed] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const moods = [
        { id: "SAD", icon: Frown, label: "Sad", color: "text-destructive" },
        { id: "NEUTRAL", icon: Meh, label: "Neutral", color: "text-muted-foreground" },
        { id: "HAPPY", icon: Smile, label: "Happy", color: "text-wellness" },
    ];

    function resetAndClose() {
        // Always reset internal state before closing so the next open is
        // a clean wizard, not a stale one.
        setStep(1);
        setFormData({ painLevel: 0, sleepHours: 7, mood: "NEUTRAL", notes: "" });
        setSavedCheckInId(null);
        setPhotoFile(null);
        setPhotoPreview(null);
        setAnalysing(false);
        setAnalysisResult(null);
        setAnalysisFailed(false);
        onClose();
    }

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const resp = await apiClient.post<CheckInResponse>('/api/wellness/check-in', formData);
            toast.success("Daily check-in completed! +10 Zen Points");
            onSuccess(10);
            const newId = resp.data?.data?.id ?? null;
            // F03 — advance to Step 3 only when the tongue feature is on.
            // Otherwise close immediately so the existing UX is unchanged.
            if (tongueOn && newId) {
                setSavedCheckInId(newId);
                setStep(3);
            } else {
                resetAndClose();
            }
        } catch (error: any) {
            console.error("Submission error:", error);
            toast.error(error?.message || "Failed to submit check-in");
        } finally {
            setLoading(false);
        }
    };

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
            // Use apiClient.upload so the JWT auth header is injected
            // correctly (the bare-fetch with localStorage.getItem('token')
            // approach we used before is the wrong key — this app stores
            // the access token under a different key resolved via
            // getAccessToken in api-client.ts).
            const fd = new FormData();
            fd.append("photo", photoFile);
            fd.append("checkInId", savedCheckInId);
            const resp = await apiClient.upload<TongueAnalysisResponse>(
                "/api/wellness/check-in/tongue-photo",
                fd,
            );
            setAnalysisResult(resp.data);
        } catch (err) {
            // Per spec: never block the check-in flow. The check-in is
            // already saved; the photo step is purely additive.
            console.warn("[tongue] analyse failed:", err);
            setAnalysisFailed(true);
        } finally {
            setAnalysing(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={resetAndClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Daily Wellness Check-in</DialogTitle>
                    <DialogDescription>
                        Help us track your progress and earn Zen Points.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-8">
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label className="flex items-center gap-2">
                                        <Smile className="w-4 h-4" /> How's your mood?
                                    </Label>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    {moods.map((m) => {
                                        const Icon = m.icon;
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => setFormData({ ...formData, mood: m.id })}
                                                className={cn(
                                                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                                                    formData.mood === m.id
                                                        ? "bg-primary/5 border-primary"
                                                        : "bg-background border-transparent hover:border-muted"
                                                )}
                                            >
                                                <Icon className={cn("w-8 h-8", m.color)} />
                                                <span className="text-xs font-bold uppercase tracking-widest">{m.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label className="flex items-center gap-2">
                                        <Moon className="w-4 h-4" /> Sleep (hours)
                                    </Label>
                                    <span className="text-lg font-black text-primary">{formData.sleepHours}h</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={15}
                                    step={0.5}
                                    value={[formData.sleepHours]}
                                    onValueChange={(v) => setFormData({ ...formData, sleepHours: v[0] })}
                                />
                            </div>

                            <Button className="w-full h-12" onClick={() => setStep(2)}>
                                Next
                            </Button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Label className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> Pain Level (0-10)
                                    </Label>
                                    <span className="text-lg font-black text-destructive">{formData.painLevel}</span>
                                </div>
                                <Slider
                                    min={0}
                                    max={10}
                                    step={1}
                                    value={[formData.painLevel]}
                                    onValueChange={(v) => setFormData({ ...formData, painLevel: v[0] })}
                                />
                            </div>

                            <div className="space-y-4">
                                <Label>Any specific notes today?</Label>
                                <Textarea
                                    placeholder="Tell us about any new symptoms or improvements..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="min-h-[100px]"
                                />
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                                    Back
                                </Button>
                                <Button
                                    className="flex-[2] h-12 bg-wellness hover:bg-wellness/90"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? "Submitting..." : "Complete Check-in"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* F03 — Step 3: optional Tongue Check. Reached only when
                        MULTIMODAL_DIAGNOSTIC_AI is enabled AND step 2 saved
                        successfully. Skipping is a no-op for the check-in. */}
                    {step === 3 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-primary" />
                                    <h3 className="text-base font-semibold">Tongue Check (Optional)</h3>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    A quick photo helps your doctor track your Ayurvedic health trends.
                                </p>
                            </div>

                            {!photoPreview && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full h-40 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 hover:bg-muted/30 transition"
                                >
                                    <Camera className="w-8 h-8 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Tap to take a tongue photo</span>
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
                                        className="w-full h-40 object-cover rounded-xl border border-border"
                                    />
                                    {!analysisResult && !analysisFailed && (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-[11px] text-primary hover:underline"
                                        >
                                            Retake photo
                                        </button>
                                    )}
                                </div>
                            )}

                            {analysing && (
                                <div className="space-y-2 text-xs text-muted-foreground">
                                    <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                                    <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                                    <p>Analysing tongue image…</p>
                                </div>
                            )}

                            {analysisResult && (
                                <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-xs">
                                    {analysisResult.doshaIndication && (
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={cn(
                                                    "px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide",
                                                    DOSHA_THEME[analysisResult.doshaIndication]?.bg ?? "bg-muted text-foreground",
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

                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1" onClick={resetAndClose}>
                                    {analysisResult || analysisFailed ? "Done" : "Skip"}
                                </Button>
                                {photoFile && !analysisResult && !analysisFailed && (
                                    <Button
                                        className="flex-[2] h-12"
                                        onClick={handleAnalyse}
                                        disabled={analysing}
                                    >
                                        {analysing ? "Analysing…" : "Analyse"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-start">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                        <Award className="w-3 h-3 text-primary" />
                        Earn 10 Zen Points for every daily report.
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
