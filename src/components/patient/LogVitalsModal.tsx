/**
 * LogVitalsModal — patient-facing self-recording modal opened from the My
 * Vitals tab. Lets the patient log Height (one-time setting), Weight, Pain,
 * Sleep, and Mood directly without waiting for a clinician.
 *
 * POSTs to /api/patient/self-vitals which writes:
 *   • heightCm → Patient.onboardingData.heightCm (merge-preserving)
 *   • each reading → PatientVital with source='self-reported'
 *
 * After save, invalidates the My Vitals query cache so tiles refresh.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, HeartPulse, Scale, Moon, Smile, Ruler } from "lucide-react";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { apiClient } from "@/lib/api-client";

interface LogVitalsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Current height in cm, if already set. Hides the Height field when
     *  present so we don't ask patients to re-enter what they already gave us. */
    currentHeightCm?: number | null;
}

const toNum = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

export function LogVitalsModal({ open, onOpenChange, currentHeightCm }: LogVitalsModalProps) {
    const qc = useQueryClient();
    const [height, setHeight] = useState("");
    const [weight, setWeight] = useState("");
    const [pain,   setPain]   = useState<number[]>([0]);
    const [sleep,  setSleep]  = useState("");
    const [mood,   setMood]   = useState<number[]>([3]);
    const [includePain, setIncludePain] = useState(false);
    const [includeMood, setIncludeMood] = useState(false);
    const [submitting, setSubmitting]   = useState(false);

    // BMI preview — same calc as the snapshot so the patient gets immediate
    // feedback on whether their weight is in a healthy range.
    const heightNum = toNum(height) ?? currentHeightCm ?? null;
    const weightNum = toNum(weight);
    let bmiPreview: string | null = null;
    if (weightNum != null && heightNum != null && heightNum > 0) {
        const m = heightNum / 100;
        bmiPreview = (weightNum / (m * m)).toFixed(1);
    }

    async function submit() {
        const heightCm = toNum(height);
        const readings: { type: string; value: number; unit: string }[] = [];
        const w = toNum(weight); if (w != null) readings.push({ type: "WEIGHT",      value: w, unit: "kg" });
        const s = toNum(sleep);  if (s != null) readings.push({ type: "SLEEP_HOURS", value: s, unit: "hrs" });
        if (includePain)         readings.push({ type: "PAIN_SCORE",  value: pain[0], unit: "/10" });
        if (includeMood)         readings.push({ type: "MOOD",        value: mood[0], unit: "/5" });
        if (heightCm == null && readings.length === 0) {
            toast.error("Enter at least one value");
            return;
        }
        setSubmitting(true);
        try {
            await apiClient.post("/api/patient/self-vitals", { heightCm, readings });
            toast.success("Vitals saved");
            qc.invalidateQueries({ queryKey: ["my-health-summary"] });
            onOpenChange(false);
            // Reset form for next time
            setHeight(""); setWeight(""); setSleep("");
            setPain([0]); setMood([3]);
            setIncludePain(false); setIncludeMood(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to save vitals");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Log my vitals</DialogTitle>
                    <DialogDescription>
                        Enter the readings you'd like to record. Everything is optional —
                        leave anything blank if you don't have a current value. These
                        readings show up tagged "self-reported" in your records and in
                        your doctor's view.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    {/* Height — one-time entry; hidden once the patient has set it */}
                    {currentHeightCm == null && (
                        <div>
                            <Label htmlFor="vit-height" className="flex items-center gap-1.5">
                                <Ruler className="w-3.5 h-3.5 text-primary" /> Height (cm) <span className="text-[10px] text-muted-foreground">— set once</span>
                            </Label>
                            <Input id="vit-height" type="number" inputMode="decimal" placeholder="170"
                                   value={height} onChange={(e) => setHeight(e.target.value)} />
                        </div>
                    )}

                    <div>
                        <Label htmlFor="vit-weight" className="flex items-center gap-1.5">
                            <Scale className="w-3.5 h-3.5 text-primary" /> Weight (kg)
                        </Label>
                        <Input id="vit-weight" type="number" inputMode="decimal" placeholder="65"
                               value={weight} onChange={(e) => setWeight(e.target.value)} />
                    </div>

                    {bmiPreview && (
                        <div className="text-xs bg-muted/50 rounded-md p-2.5 text-muted-foreground">
                            <strong className="text-foreground">BMI preview:</strong> {bmiPreview}
                            {currentHeightCm != null && height === "" && (
                                <span className="ml-1">(using your saved height of {currentHeightCm} cm)</span>
                            )}
                        </div>
                    )}

                    <div>
                        <Label htmlFor="vit-sleep" className="flex items-center gap-1.5">
                            <Moon className="w-3.5 h-3.5 text-primary" /> Sleep last night (hrs)
                        </Label>
                        <Input id="vit-sleep" type="number" inputMode="decimal" step="0.5" placeholder="7"
                               value={sleep} onChange={(e) => setSleep(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-1.5">
                                <HeartPulse className="w-3.5 h-3.5 text-primary" /> Pain: <span className="font-semibold">{pain[0]}/10</span>
                            </Label>
                            <button type="button" onClick={() => setIncludePain((p) => !p)}
                                    className="text-[10px] text-primary hover:underline">
                                {includePain ? "✓ included" : "Tap to include"}
                            </button>
                        </div>
                        <Slider value={pain} onValueChange={setPain} min={0} max={10} step={1} disabled={!includePain} />
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-1.5">
                                <Smile className="w-3.5 h-3.5 text-primary" /> Mood: <span className="font-semibold">{mood[0]}/5</span>
                            </Label>
                            <button type="button" onClick={() => setIncludeMood((p) => !p)}
                                    className="text-[10px] text-primary hover:underline">
                                {includeMood ? "✓ included" : "Tap to include"}
                            </button>
                        </div>
                        <Slider value={mood} onValueChange={setMood} min={1} max={5} step={1} disabled={!includeMood} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={submit} disabled={submitting}>
                        {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                        Save vitals
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
