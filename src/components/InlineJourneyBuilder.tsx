// Inline Journey Builder — sits below the prescription composer and lets the
// clinician attach a treatment journey (existing template OR new) to the
// prescription in a single submit. Emits the JourneyDraft up via onChange so
// the parent form sends it as part of POST /api/prescriptions(/batch-add).
//
// MEDICATION tasks are blocked for THERAPIST callers — mirrors the backend
// guard in routes/journey.js (THERAPIST_MEDICATION_RESTRICTION).
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronUp, ChevronDown, Sparkles, X } from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useBranchScope } from "@/hooks/useBranchScope";
import { apiClient } from "@/lib/api-client";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type TaskType = "MEDICATION" | "EXERCISE" | "DIET" | "THERAPY" | "LIFESTYLE";

export interface JourneyTaskDraft {
    type: TaskType;
    title: string;
    description?: string;
    frequency: string;
    /** Set true for tasks auto-added from the prescription composer; drives
     *  the "suggested" banner above the row. */
    auto?: boolean;
}
export interface JourneyPhaseDraft {
    name: string;
    durationDays: number;
    tasks: JourneyTaskDraft[];
}
export interface JourneyDraft {
    /** When set, the parent should ignore the rest and assign-existing instead. */
    existingJourneyId?: string;
    title: string;
    condition: string;
    goal: string;
    /** ISO date string YYYY-MM-DD; the form uses a native date input. */
    targetEndDate: string;
    phases: JourneyPhaseDraft[];
}

interface InlineJourneyBuilderProps {
    patientId: string;
    diagnosisHint?: string;
    onChange: (journey: JourneyDraft | null) => void;
}

const FREQUENCY_OPTIONS = [
    { value: "Daily",        label: "Daily" },
    { value: "Twice Daily",  label: "Twice Daily" },
    { value: "Weekly",       label: "Weekly" },
    { value: "As Needed",    label: "As Needed" },
];

// Therapists may not author MEDICATION tasks. Mirrors the backend guard.
function allowedTaskTypes(role: AppRole | null): TaskType[] {
    if (role === "THERAPIST") return ["EXERCISE", "DIET", "THERAPY", "LIFESTYLE"];
    return ["MEDICATION", "EXERCISE", "DIET", "THERAPY", "LIFESTYLE"];
}

const emptyTask = (type: TaskType): JourneyTaskDraft => ({
    type,
    title: "",
    description: "",
    frequency: "Daily",
});
const emptyPhase = (): JourneyPhaseDraft => ({
    name: "",
    durationDays: 7,
    tasks: [],
});

interface TemplateSummary { id: string; title: string; condition?: string }

export function InlineJourneyBuilder({ patientId, diagnosisHint, onChange }: InlineJourneyBuilderProps) {
    const { role } = useAuth();
    const { branchIdParam } = useBranchScope();
    const allowedTypes = useMemo(() => allowedTaskTypes(role), [role]);

    const [enabled,  setEnabled]  = useState(false);
    const [mode,     setMode]     = useState<"existing" | "new">("new");

    // Existing-template picker state
    const [templates,    setTemplates]    = useState<TemplateSummary[]>([]);
    const [templateId,   setTemplateId]   = useState<string>("");
    const [templateLoading, setTemplateLoading] = useState(false);

    // New-journey draft state
    const [title,        setTitle]        = useState(diagnosisHint || "");
    const [condition,    setCondition]    = useState(diagnosisHint || "");
    const [goal,         setGoal]         = useState("");
    const [targetEndDate, setTargetEndDate] = useState<string>("");
    const [phases,       setPhases]       = useState<JourneyPhaseDraft[]>([emptyPhase()]);

    // Re-prefill the title when a fresh diagnosis comes in (only if the user
    // hasn't typed over it yet).
    useEffect(() => {
        if (diagnosisHint && !title) setTitle(diagnosisHint);
        if (diagnosisHint && !condition) setCondition(diagnosisHint);
    }, [diagnosisHint]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load existing TEMPLATE journeys for the active branch when the user
    // flips to "Assign Existing".
    useEffect(() => {
        if (mode !== "existing" || !enabled) return;
        setTemplateLoading(true);
        const params = new URLSearchParams({ status: "TEMPLATE" });
        if (branchIdParam) params.set("branchId", branchIdParam);
        apiClient
            .get<TemplateSummary[]>(`/api/journeys?${params.toString()}`)
            .then((res) => {
                // Server response shape varies; tolerate both array and { data: [] }.
                const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
                setTemplates(list);
            })
            .catch(() => setTemplates([]))
            .finally(() => setTemplateLoading(false));
    }, [mode, enabled, branchIdParam]);

    // Total journey duration — surfaced at the bottom of the builder.
    const totalDays = useMemo(
        () => phases.reduce((s, p) => s + (Number.isFinite(p.durationDays) ? p.durationDays : 0), 0),
        [phases],
    );

    // Push the current draft up to the parent. Runs on every state change.
    useEffect(() => {
        if (!enabled) {
            onChange(null);
            return;
        }
        if (mode === "existing") {
            if (!templateId) { onChange(null); return; }
            onChange({
                existingJourneyId: templateId,
                title:           "",
                condition:       "",
                goal:            "",
                targetEndDate:   "",
                phases:          [],
            });
            return;
        }
        // new
        onChange({
            title:         title.trim(),
            condition:     condition.trim(),
            goal:          goal.trim(),
            targetEndDate,
            phases:        phases.map((p) => ({
                name:         p.name.trim(),
                durationDays: p.durationDays,
                tasks:        p.tasks.map((t) => ({ ...t, title: t.title.trim() })),
            })),
        });
    }, [enabled, mode, templateId, title, condition, goal, targetEndDate, phases]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Imperative API for the parent: append a MEDICATION task to phase 0 ──
    // The parent can call window-level event to push a suggested task in.
    // We use a ref-less pattern: the caller dispatches `inline-journey:add-task`
    // on window; we listen for it. This avoids prop drilling a ref.
    useEffect(() => {
        const handler = (e: Event) => {
            if (!enabled) return;
            if (mode !== "new") return;
            const detail = (e as CustomEvent).detail as { task: JourneyTaskDraft } | undefined;
            if (!detail?.task) return;
            // THERAPIST's MEDICATION suggestions are silently dropped.
            if (!allowedTypes.includes(detail.task.type)) return;

            setPhases((prev) => {
                if (prev.length === 0) return prev;
                const next = [...prev];
                const phase0 = { ...next[0], tasks: [...next[0].tasks] };
                // Dedup by title — clinicians often add multiple medicines with
                // similar names; we don't want a runaway pile.
                if (!phase0.tasks.some((t) => t.title === detail.task.title && t.type === detail.task.type)) {
                    phase0.tasks.push({ ...detail.task, auto: true });
                }
                next[0] = phase0;
                return next;
            });
        };
        window.addEventListener("inline-journey:add-task", handler as EventListener);
        return () => window.removeEventListener("inline-journey:add-task", handler as EventListener);
    }, [enabled, mode, allowedTypes]);

    if (!patientId) return null;

    return (
        <div className="rounded-2xl border border-border/50 bg-secondary/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-bold">Treatment Journey</Label>
                    <Badge variant="outline" className="text-[10px]">Optional</Badge>
                </div>
                <Button
                    type="button"
                    variant={enabled ? "outline" : "default"}
                    size="sm"
                    onClick={() => setEnabled((v) => !v)}
                >
                    {enabled ? "Skip journey" : "Add a journey"}
                </Button>
            </div>

            {!enabled ? (
                <p className="text-xs text-muted-foreground">
                    Optionally attach an end-to-end treatment plan. Phases activate sequentially; the patient gets a per-task daily checklist.
                </p>
            ) : (
                <>
                    {/* Mode pills */}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={mode === "existing" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMode("existing")}
                        >
                            Assign Existing
                        </Button>
                        <Button
                            type="button"
                            variant={mode === "new" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setMode("new")}
                        >
                            Create New
                        </Button>
                    </div>

                    {mode === "existing" ? (
                        <div className="space-y-2">
                            <Label className="text-xs">Pick a template</Label>
                            <Select value={templateId} onValueChange={setTemplateId}>
                                <SelectTrigger>
                                    <SelectValue placeholder={
                                        templateLoading ? "Loading…" :
                                        templates.length === 0 ? "No templates available for this branch" : "Choose a template"
                                    } />
                                </SelectTrigger>
                                <SelectContent>
                                    {templates.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                            {t.title}{t.condition ? ` — ${t.condition}` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="ij-title" className="text-xs">Title</Label>
                                    <Input id="ij-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spondylitis Recovery" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="ij-condition" className="text-xs">Condition</Label>
                                    <Input id="ij-condition" value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="e.g. Cervical spondylitis" />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <Label htmlFor="ij-goal" className="text-xs">Goal</Label>
                                    <Input id="ij-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Pain-free range of motion in 8 weeks" />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="ij-target" className="text-xs">Target End Date</Label>
                                    {/* Native date input renders DD/MM/YYYY in en-GB locales. */}
                                    <Input id="ij-target" type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
                                </div>
                            </div>

                            {/* Phase Builder */}
                            <div className="space-y-3">
                                {phases.map((phase, pIdx) => (
                                    <PhaseEditor
                                        key={pIdx}
                                        phase={phase}
                                        index={pIdx}
                                        total={phases.length}
                                        allowedTypes={allowedTypes}
                                        onChange={(next) => setPhases((prev) => prev.map((p, i) => i === pIdx ? next : p))}
                                        onMoveUp={pIdx === 0 ? undefined : () => setPhases((prev) => {
                                            const arr = [...prev]; [arr[pIdx - 1], arr[pIdx]] = [arr[pIdx], arr[pIdx - 1]]; return arr;
                                        })}
                                        onMoveDown={pIdx === phases.length - 1 ? undefined : () => setPhases((prev) => {
                                            const arr = [...prev]; [arr[pIdx], arr[pIdx + 1]] = [arr[pIdx + 1], arr[pIdx]]; return arr;
                                        })}
                                        onRemove={phases.length === 1 ? undefined : () => setPhases((prev) => prev.filter((_, i) => i !== pIdx))}
                                    />
                                ))}

                                <div className="flex items-center justify-between">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPhases((prev) => [...prev, emptyPhase()])}
                                        className="gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Add Phase
                                    </Button>
                                    <span className="text-xs font-bold text-foreground">
                                        Total Journey Duration: {totalDays} {totalDays === 1 ? "day" : "days"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ── Phase row ────────────────────────────────────────────────────────────────
interface PhaseEditorProps {
    phase: JourneyPhaseDraft;
    index: number;
    total: number;
    allowedTypes: TaskType[];
    onChange: (next: JourneyPhaseDraft) => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onRemove?: () => void;
}
function PhaseEditor({
    phase, index, allowedTypes, onChange, onMoveUp, onMoveDown, onRemove,
}: PhaseEditorProps) {
    const updateTask = (idx: number, patch: Partial<JourneyTaskDraft>) => {
        onChange({
            ...phase,
            tasks: phase.tasks.map((t, i) => i === idx ? { ...t, ...patch, auto: false } : t),
        });
    };
    const removeTask = (idx: number) => {
        onChange({ ...phase, tasks: phase.tasks.filter((_, i) => i !== idx) });
    };
    const addTask = () => {
        onChange({ ...phase, tasks: [...phase.tasks, emptyTask(allowedTypes[0])] });
    };

    return (
        <div className="rounded-xl border border-border/50 bg-background p-3 space-y-3">
            <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">Phase {index + 1}</Badge>
                <Input
                    value={phase.name}
                    onChange={(e) => onChange({ ...phase, name: e.target.value })}
                    placeholder={`Phase ${index + 1} name`}
                    className="flex-1"
                />
                <Input
                    type="number"
                    min={1}
                    value={phase.durationDays}
                    onChange={(e) => onChange({ ...phase, durationDays: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-24"
                    aria-label="Duration in days"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">days</span>
                <Button type="button" variant="ghost" size="icon" disabled={!onMoveUp}   onClick={onMoveUp}><ChevronUp   className="w-4 h-4" /></Button>
                <Button type="button" variant="ghost" size="icon" disabled={!onMoveDown} onClick={onMoveDown}><ChevronDown className="w-4 h-4" /></Button>
                <Button type="button" variant="ghost" size="icon" disabled={!onRemove}  onClick={onRemove}><Trash2     className="w-4 h-4 text-destructive" /></Button>
            </div>

            <div className="space-y-2 pl-2">
                {phase.tasks.map((task, tIdx) => (
                    <div key={tIdx} className="space-y-1">
                        {task.auto && (
                            <div className="flex items-center justify-between gap-2 rounded-md bg-primary/10 text-primary px-2 py-1 text-[10px] font-bold uppercase tracking-tight">
                                <span>Suggested task added from prescription</span>
                                <button type="button" onClick={() => removeTask(tIdx)} aria-label="Dismiss suggestion">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                        <div className="grid grid-cols-12 gap-2 items-start">
                            <div className="col-span-3">
                                <Select
                                    value={task.type}
                                    onValueChange={(v) => updateTask(tIdx, { type: v as TaskType })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {allowedTypes.map((t) => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-4">
                                <Input value={task.title} onChange={(e) => updateTask(tIdx, { title: e.target.value })} placeholder="Task title" />
                            </div>
                            <div className="col-span-3">
                                <Select
                                    value={task.frequency}
                                    onValueChange={(v) => updateTask(tIdx, { frequency: v })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {FREQUENCY_OPTIONS.map((f) => (
                                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-2">
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeTask(tIdx)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                            <div className="col-span-12">
                                <Textarea
                                    value={task.description || ""}
                                    onChange={(e) => updateTask(tIdx, { description: e.target.value })}
                                    placeholder="Optional description"
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addTask} className="gap-2">
                    <Plus className="w-3 h-3" /> Add Task
                </Button>
            </div>
        </div>
    );
}
