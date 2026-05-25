/**
 * RecordIntakeModal — tabbed clinician entry surface for the consultation
 * room. Opened from the "+ Record" button in the inline Patient Snapshot
 * card defined in ConsultationRoom.tsx.
 *
 * Tabs:
 *   • Vitals     — Height (cm), Weight (kg), Pain (0-10), Sleep (hrs), Mood (1-5).
 *                  BMI + Ideal Body Weight render as live read-only previews.
 *   • Prakriti   — Dosha, satva, agni.
 *   • Lifestyle  — Sleep rating (1-5), stress (1-10), exercise, diet.
 *
 * On submit the relevant tab POSTs (or PATCHes) to its endpoint, then
 * invalidates the snapshot's react-query cache so the snapshot live-updates.
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Activity, Sparkles, Salad } from "lucide-react";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";

interface RecordIntakeModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patientId: string;
    patientGender?: string | null;
}

const PRAKRITI_OPTIONS = [
    { value: "VATA",        label: "Vata" },
    { value: "PITTA",       label: "Pitta" },
    { value: "KAPHA",       label: "Kapha" },
    { value: "VATA_PITTA",  label: "Vata-Pitta" },
    { value: "PITTA_KAPHA", label: "Pitta-Kapha" },
    { value: "VATA_KAPHA",  label: "Vata-Kapha" },
    { value: "TRIDOSHA",    label: "Tridosha" },
];

const AGNI_OPTIONS = [
    { value: "MANDAGNI", label: "Mandagni (low)" },
    { value: "TIKSHNA",  label: "Tikshna (sharp)" },
    { value: "VISHAMA",  label: "Vishama (variable)" },
    { value: "SAMA",     label: "Sama (balanced)" },
];

const EXERCISE_OPTIONS = [
    "Sedentary", "Light", "Moderate", "Active", "Very active",
];

const DIET_OPTIONS = [
    "Vegetarian", "Vegan", "Non-vegetarian", "Eggetarian", "Jain", "Pescatarian",
];

// Empty-string keepers — Input components want strings; we convert to
// numbers at submit time and treat "" as "skip this field".
const toNum = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

export function RecordIntakeModal({
    open, onOpenChange, patientId, patientGender,
}: RecordIntakeModalProps) {
    const qc = useQueryClient();
    const [tab, setTab] = useState<"vitals" | "prakriti" | "lifestyle">("vitals");
    const [submitting, setSubmitting] = useState(false);

    // Vitals state (strings so empty fields stay empty)
    const [height, setHeight]  = useState("");
    const [weight, setWeight]  = useState("");
    const [pain,   setPain]    = useState<number[]>([0]);
    const [sleep,  setSleep]   = useState("");
    const [mood,   setMood]    = useState<number[]>([3]);
    const [includePain, setIncludePain] = useState(false);
    const [includeMood, setIncludeMood] = useState(false);

    // Prakriti state
    const [prakriti,    setPrakriti]    = useState<string>("");
    const [satva,       setSatva]       = useState<number[]>([5]);
    const [agni,        setAgni]        = useState<string>("");

    // Lifestyle state
    const [sleepQ,    setSleepQ]    = useState<number[]>([3]);
    const [stress,    setStress]    = useState<number[]>([5]);
    const [exercise,  setExercise]  = useState<string>("");
    const [dietType,  setDietType]  = useState<string>("");
    const [includeSleepQ, setIncludeSleepQ] = useState(false);
    const [includeStress, setIncludeStress] = useState(false);

    // Live BMI / IBW preview on Vitals tab.
    const heightNum = toNum(height);
    const weightNum = toNum(weight);
    let bmiPreview: string | null = null;
    if (weightNum != null && heightNum != null && heightNum > 0) {
        const m = heightNum / 100;
        bmiPreview = (weightNum / (m * m)).toFixed(1);
    }
    let ibwPreview: string | null = null;
    if (heightNum != null) {
        const factor = String(patientGender || "").toUpperCase() === "MALE" ? 0.9 : 0.85;
        ibwPreview = ((heightNum - 100) * factor).toFixed(1);
    }

    function invalidateSnapshot() {
        qc.invalidateQueries({ queryKey: ["health-summary", patientId] });
    }

    async function submitVitals() {
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
            await apiClient.post(`/api/patients/${patientId}/vitals`, { heightCm, readings });
            toast.success("Vitals recorded");
            invalidateSnapshot();
            onOpenChange(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to record vitals");
        } finally {
            setSubmitting(false);
        }
    }

    async function submitPrakriti() {
        if (!prakriti && !agni) {
            toast.error("Pick at least a dosha or agni type");
            return;
        }
        setSubmitting(true);
        try {
            await apiClient.post(`/api/patients/${patientId}/constitution`, {
                ...(prakriti && { prakriti }),
                ...(agni && { agniType: agni }),
                satvaRating: satva[0],
            });
            toast.success("Constitution profile updated");
            invalidateSnapshot();
            onOpenChange(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update constitution");
        } finally {
            setSubmitting(false);
        }
    }

    async function submitLifestyle() {
        const body: Record<string, unknown> = {};
        if (includeSleepQ) body.sleepQuality = sleepQ[0];
        if (includeStress) body.stressLevel  = stress[0];
        if (exercise)      body.exerciseFrequency = exercise;
        if (dietType)      body.dietType    = dietType;
        if (Object.keys(body).length === 0) {
            toast.error("Enter at least one lifestyle value");
            return;
        }
        setSubmitting(true);
        try {
            await apiClient.patch(`/api/patients/${patientId}/lifestyle-snapshot`, body);
            toast.success("Lifestyle updated");
            invalidateSnapshot();
            onOpenChange(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to update lifestyle");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Record patient intake</DialogTitle>
                    <DialogDescription>
                        Enter vitals, Prakriti assessment, or lifestyle observations. These
                        flow into the Patient Snapshot, the Health Report PDF, and the
                        patient's own records view.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                    <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="vitals" className="gap-1.5"><Activity className="w-3.5 h-3.5" />Vitals</TabsTrigger>
                        <TabsTrigger value="prakriti" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" />Prakriti</TabsTrigger>
                        <TabsTrigger value="lifestyle" className="gap-1.5"><Salad className="w-3.5 h-3.5" />Lifestyle</TabsTrigger>
                    </TabsList>

                    {/* ── Vitals ── */}
                    <TabsContent value="vitals" className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="height">Height (cm)</Label>
                                <Input id="height" type="number" inputMode="decimal" placeholder="170"
                                       value={height} onChange={(e) => setHeight(e.target.value)} />
                            </div>
                            <div>
                                <Label htmlFor="weight">Weight (kg)</Label>
                                <Input id="weight" type="number" inputMode="decimal" placeholder="65"
                                       value={weight} onChange={(e) => setWeight(e.target.value)} />
                            </div>
                        </div>
                        {(bmiPreview || ibwPreview) && (
                            <div className="flex gap-4 text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
                                {bmiPreview && <span><b>BMI:</b> {bmiPreview}</span>}
                                {ibwPreview && <span><b>Ideal weight:</b> {ibwPreview} kg</span>}
                            </div>
                        )}

                        <div>
                            <Label htmlFor="sleep">Sleep last night (hrs)</Label>
                            <Input id="sleep" type="number" inputMode="decimal" step="0.5" placeholder="7"
                                   value={sleep} onChange={(e) => setSleep(e.target.value)} />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Pain score: <span className="font-semibold">{pain[0]}/10</span></Label>
                                <button type="button" onClick={() => setIncludePain((p) => !p)}
                                        className="text-[10px] text-primary hover:underline">
                                    {includePain ? "✓ included" : "Click to include"}
                                </button>
                            </div>
                            <Slider value={pain} onValueChange={setPain} min={0} max={10} step={1} disabled={!includePain} />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Mood: <span className="font-semibold">{mood[0]}/5</span></Label>
                                <button type="button" onClick={() => setIncludeMood((p) => !p)}
                                        className="text-[10px] text-primary hover:underline">
                                    {includeMood ? "✓ included" : "Click to include"}
                                </button>
                            </div>
                            <Slider value={mood} onValueChange={setMood} min={1} max={5} step={1} disabled={!includeMood} />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={submitVitals} disabled={submitting}>
                                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                                Save vitals
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ── Prakriti ── */}
                    <TabsContent value="prakriti" className="space-y-4 pt-4">
                        <div>
                            <Label>Dosha (Prakriti)</Label>
                            <Select value={prakriti} onValueChange={setPrakriti}>
                                <SelectTrigger><SelectValue placeholder="Select dosha…" /></SelectTrigger>
                                <SelectContent>
                                    {PRAKRITI_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Satva rating: <span className="font-semibold">{satva[0]}/10</span></Label>
                            <Slider value={satva} onValueChange={setSatva} min={1} max={10} step={1} />
                        </div>

                        <div>
                            <Label>Agni type</Label>
                            <Select value={agni} onValueChange={setAgni}>
                                <SelectTrigger><SelectValue placeholder="Select agni…" /></SelectTrigger>
                                <SelectContent>
                                    {AGNI_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={submitPrakriti} disabled={submitting}>
                                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                                Save constitution
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ── Lifestyle ── */}
                    <TabsContent value="lifestyle" className="space-y-4 pt-4">
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Sleep quality rating: <span className="font-semibold">{sleepQ[0]}/5</span></Label>
                                <button type="button" onClick={() => setIncludeSleepQ((p) => !p)}
                                        className="text-[10px] text-primary hover:underline">
                                    {includeSleepQ ? "✓ included" : "Click to include"}
                                </button>
                            </div>
                            <Slider value={sleepQ} onValueChange={setSleepQ} min={1} max={5} step={1} disabled={!includeSleepQ} />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label>Stress level: <span className="font-semibold">{stress[0]}/10</span></Label>
                                <button type="button" onClick={() => setIncludeStress((p) => !p)}
                                        className="text-[10px] text-primary hover:underline">
                                    {includeStress ? "✓ included" : "Click to include"}
                                </button>
                            </div>
                            <Slider value={stress} onValueChange={setStress} min={1} max={10} step={1} disabled={!includeStress} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Exercise frequency</Label>
                                <Select value={exercise} onValueChange={setExercise}>
                                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                    <SelectContent>
                                        {EXERCISE_OPTIONS.map((o) => (
                                            <SelectItem key={o} value={o}>{o}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Diet type</Label>
                                <Select value={dietType} onValueChange={setDietType}>
                                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                                    <SelectContent>
                                        {DIET_OPTIONS.map((o) => (
                                            <SelectItem key={o} value={o}>{o}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={submitLifestyle} disabled={submitting}>
                                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                                Save lifestyle
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
