import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Zap, Plus, Trash2, Edit3, Eye, Loader2, AlertCircle,
    CheckCircle2, XCircle, Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    workflowRuleService,
    type WorkflowRule,
    type TriggerType,
    type ActionType,
    type RuleAction,
    type RuleLogPage,
    type RuleLogItem,
} from "@/services/workflowRule.service";

// ── Lookup tables ───────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
    NO_CHECKIN:               "No Check-In",
    PAIN_NOT_IMPROVING:       "Pain Not Improving",
    DIET_ADHERENCE_LOW:       "Low Diet Adherence",
    PHASE_OVERDUE:            "Phase Overdue",
    PRESCRIPTION_UNCOLLECTED: "Prescription Uncollected",
    PHASE_COMPLETED:          "Phase Completed",
};

const TRIGGER_ORDER: TriggerType[] = [
    "NO_CHECKIN", "PAIN_NOT_IMPROVING", "DIET_ADHERENCE_LOW",
    "PHASE_OVERDUE", "PRESCRIPTION_UNCOLLECTED", "PHASE_COMPLETED",
];

const ACTION_PILL: Record<ActionType, string> = {
    SEND_WHATSAPP:         "bg-emerald-100 text-emerald-700 border-emerald-200",
    SEND_IN_APP:           "bg-teal-100 text-teal-700 border-teal-200",
    CREATE_FOLLOW_UP_TASK: "bg-amber-100 text-amber-800 border-amber-200",
    FLAG_FOR_DOCTOR:       "bg-rose-100 text-rose-700 border-rose-200",
};

const ACTION_LABEL: Record<ActionType, string> = {
    SEND_WHATSAPP:         "Send WhatsApp",
    SEND_IN_APP:           "Send In-App",
    CREATE_FOLLOW_UP_TASK: "Follow-up Task",
    FLAG_FOR_DOCTOR:       "Flag for Doctor",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function describeCondition(rule: WorkflowRule | { triggerType: TriggerType; conditionValue: Record<string, unknown> }): string {
    const c = rule.conditionValue || {};
    switch (rule.triggerType) {
        case "NO_CHECKIN":               return `No check-in for ${c.days} days`;
        case "PAIN_NOT_IMPROVING":       return `Pain not declining over ${c.days} days`;
        case "DIET_ADHERENCE_LOW":       return `Diet adherence below ${c.thresholdPercent}% for ${c.days} days`;
        case "PHASE_OVERDUE":            return `Phase running > ${c.days} days with task completion below ${c.taskCompletionBelow}%`;
        case "PRESCRIPTION_UNCOLLECTED": return `Prescription uncollected after ${c.days} days`;
        case "PHASE_COMPLETED":          return "Fires when any treatment phase completes";
        default:                         return JSON.stringify(c);
    }
}

function describeAction(action: RuleAction): string {
    switch (action.type) {
        case "SEND_WHATSAPP":         return `Send WhatsApp: "${action.messageTemplate}"`;
        case "SEND_IN_APP":           return `Send in-app: "${action.messageTemplate}"`;
        case "CREATE_FOLLOW_UP_TASK": return `Create ${action.priority || "MEDIUM"} task "${action.taskTitle}" due in ${action.dueDays ?? 3} day(s)`;
        case "FLAG_FOR_DOCTOR":       return `Flag doctor: "${action.message}"`;
        default:                      return (action as { type: string }).type;
    }
}

function fmtDateTime(iso: string | null): string {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkflowAutomation() {
    const qc = useQueryClient();
    const [builderOpen, setBuilderOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
    const [logsRule, setLogsRule] = useState<WorkflowRule | null>(null);

    const { data: rules, isLoading } = useQuery({
        queryKey: ["workflow-rules"],
        queryFn:  () => workflowRuleService.getRules(),
    });

    const toggleMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            workflowRuleService.updateRule(id, { isActive }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["workflow-rules"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to update rule");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => workflowRuleService.deleteRule(id),
        onSuccess: () => {
            toast.success("Rule deleted");
            qc.invalidateQueries({ queryKey: ["workflow-rules"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to delete rule");
        },
    });

    const evaluateMutation = useMutation({
        mutationFn: () => workflowRuleService.evaluateNow(),
        onSuccess: () => {
            toast.success("Evaluation triggered — fired rules will appear in their logs shortly", { icon: "⚡" });
            // Refresh the list a beat later so totalFired updates show.
            setTimeout(() => qc.invalidateQueries({ queryKey: ["workflow-rules"] }), 3000);
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to trigger evaluation");
        },
    });

    return (
        <AppLayout>
            <div className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <PageHeader
                        title="Automation Rules"
                        subtitle="Configure automated patient follow-up workflows for your branch."
                    >
                        <Zap className="h-5 w-5 text-primary" />
                    </PageHeader>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => evaluateMutation.mutate()}
                            disabled={evaluateMutation.isPending}
                        >
                            {evaluateMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4 mr-2" />
                            )}
                            Evaluate Now
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => { setEditingRule(null); setBuilderOpen(true); }}
                            className="bg-primary hover:bg-primary/90"
                        >
                            <Plus className="w-4 h-4 mr-2" /> New Rule
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <Card key={i}><CardContent className="p-4 space-y-2">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-2/3" />
                                <Skeleton className="h-3 w-1/2" />
                            </CardContent></Card>
                        ))}
                    </div>
                ) : (rules || []).length === 0 ? (
                    <Card><CardContent className="py-16 text-center">
                        <Zap className="w-12 h-12 text-primary/40 mx-auto mb-3" />
                        <h3 className="text-base font-semibold">No rules yet</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Create your first automation rule — every active rule is evaluated hourly.
                        </p>
                        <Button
                            className="mt-4 bg-primary hover:bg-primary/90"
                            onClick={() => { setEditingRule(null); setBuilderOpen(true); }}
                        >
                            <Plus className="w-4 h-4 mr-2" /> Create First Rule
                        </Button>
                    </CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {(rules || []).map((r) => (
                            <Card key={r.id} className={cn(!r.isActive && "opacity-70")}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <Zap className="w-5 h-5 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-semibold truncate">{r.name}</h4>
                                                {r.description && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={cn("text-[11px] font-medium",
                                                r.isActive ? "text-emerald-700" : "text-muted-foreground")}>
                                                {r.isActive ? "Active" : "Inactive"}
                                            </span>
                                            <Switch
                                                checked={r.isActive}
                                                onCheckedChange={(v) => toggleMutation.mutate({ id: r.id, isActive: v })}
                                                disabled={toggleMutation.isPending}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                                        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                                            Trigger: {TRIGGER_LABELS[r.triggerType] || r.triggerType}
                                        </Badge>
                                        <span className="text-muted-foreground">·</span>
                                        <span className="text-muted-foreground">{describeCondition(r)}</span>
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        {(r.actions || []).map((a, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className={cn("text-[10px]", ACTION_PILL[a.type as ActionType] || "")}
                                            >
                                                {ACTION_LABEL[a.type as ActionType] || a.type}
                                            </Badge>
                                        ))}
                                    </div>

                                    <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                                        <span>Cooldown: {r.cooldownHours}h</span>
                                        <span>·</span>
                                        <span>Fired: {r.totalFired} times</span>
                                        <span>·</span>
                                        <span>Last evaluated: {fmtDateTime(r.lastEvaluatedAt)}</span>
                                    </div>

                                    <div className="mt-3 flex items-center gap-1.5">
                                        <Button size="sm" variant="outline" className="h-7 text-xs"
                                                onClick={() => setLogsRule(r)}>
                                            <Eye className="w-3 h-3 mr-1" /> View Logs
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs"
                                                onClick={() => { setEditingRule(r); setBuilderOpen(true); }}>
                                            <Edit3 className="w-3 h-3 mr-1" /> Edit
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-700 hover:text-rose-800 hover:bg-rose-50"
                                                disabled={deleteMutation.isPending}
                                                onClick={() => {
                                                    if (window.confirm(`Delete rule "${r.name}"? Logs and cooldowns will also be removed.`)) {
                                                        deleteMutation.mutate(r.id);
                                                    }
                                                }}>
                                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {builderOpen && (
                <RuleBuilderDialog
                    open={builderOpen}
                    onClose={() => { setBuilderOpen(false); setEditingRule(null); }}
                    rule={editingRule}
                    onSaved={() => {
                        setBuilderOpen(false);
                        setEditingRule(null);
                        qc.invalidateQueries({ queryKey: ["workflow-rules"] });
                    }}
                />
            )}

            {logsRule && (
                <RuleLogsSheet
                    rule={logsRule}
                    open={!!logsRule}
                    onClose={() => setLogsRule(null)}
                />
            )}
        </AppLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4-step Rule Builder Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface BuilderState {
    name: string;
    description: string;
    triggerType: TriggerType;
    // Condition fields (only the relevant subset is read per triggerType)
    days: number;
    thresholdPercent: number;
    taskCompletionBelow: number;
    // Action toggles + per-action fields
    enableWhatsApp: boolean;
    whatsappTemplate: string;
    enableInApp: boolean;
    inAppTemplate: string;
    enableTask: boolean;
    taskTitle: string;
    taskPriority: "HIGH" | "MEDIUM" | "LOW";
    taskDueDays: number;
    enableFlag: boolean;
    flagMessage: string;
    cooldownHours: number;
}

function defaultBuilder(): BuilderState {
    return {
        name: "", description: "",
        triggerType: "NO_CHECKIN",
        days: 3, thresholdPercent: 60, taskCompletionBelow: 30,
        enableWhatsApp: true,
        whatsappTemplate: "Hi {patientName}, {reason}. Please contact us.",
        enableInApp: false,
        inAppTemplate: "Care team alert: {reason}",
        enableTask: false,
        taskTitle: "Follow up: {reason}",
        taskPriority: "MEDIUM",
        taskDueDays: 2,
        enableFlag: false,
        flagMessage: "{patientName} needs attention: {reason}",
        cooldownHours: 48,
    };
}

function builderFromRule(rule: WorkflowRule): BuilderState {
    const c = rule.conditionValue || {};
    const findAction = <T extends ActionType>(t: T) =>
        (rule.actions || []).find((a) => a.type === t) as Extract<RuleAction, { type: T }> | undefined;

    const wa   = findAction("SEND_WHATSAPP");
    const ia   = findAction("SEND_IN_APP");
    const tk   = findAction("CREATE_FOLLOW_UP_TASK");
    const fl   = findAction("FLAG_FOR_DOCTOR");
    const base = defaultBuilder();

    return {
        ...base,
        name: rule.name,
        description: rule.description ?? "",
        triggerType: rule.triggerType,
        days: Number(c.days) || base.days,
        thresholdPercent: Number(c.thresholdPercent) || base.thresholdPercent,
        taskCompletionBelow: Number(c.taskCompletionBelow) || base.taskCompletionBelow,
        enableWhatsApp:   !!wa, whatsappTemplate: wa?.messageTemplate ?? base.whatsappTemplate,
        enableInApp:      !!ia, inAppTemplate:    ia?.messageTemplate ?? base.inAppTemplate,
        enableTask:       !!tk, taskTitle:        tk?.taskTitle       ?? base.taskTitle,
        taskPriority:     tk?.priority ?? base.taskPriority,
        taskDueDays:      tk?.dueDays  ?? base.taskDueDays,
        enableFlag:       !!fl, flagMessage:      fl?.message         ?? base.flagMessage,
        cooldownHours: rule.cooldownHours,
    };
}

function buildPayload(s: BuilderState) {
    const conditionValue: Record<string, unknown> =
        s.triggerType === "NO_CHECKIN"               ? { days: s.days } :
        s.triggerType === "PAIN_NOT_IMPROVING"       ? { days: s.days } :
        s.triggerType === "DIET_ADHERENCE_LOW"       ? { thresholdPercent: s.thresholdPercent, days: s.days } :
        s.triggerType === "PHASE_OVERDUE"            ? { days: s.days, taskCompletionBelow: s.taskCompletionBelow } :
        s.triggerType === "PRESCRIPTION_UNCOLLECTED" ? { days: s.days } :
        {};

    const actions: RuleAction[] = [];
    if (s.enableWhatsApp) actions.push({ type: "SEND_WHATSAPP", messageTemplate: s.whatsappTemplate });
    if (s.enableInApp)    actions.push({ type: "SEND_IN_APP",   messageTemplate: s.inAppTemplate });
    if (s.enableTask)     actions.push({ type: "CREATE_FOLLOW_UP_TASK", taskTitle: s.taskTitle, priority: s.taskPriority, dueDays: s.taskDueDays });
    if (s.enableFlag)     actions.push({ type: "FLAG_FOR_DOCTOR", message: s.flagMessage });

    return {
        name: s.name.trim(),
        description: s.description.trim() || null,
        triggerType: s.triggerType,
        conditionValue,
        actions,
        cooldownHours: s.cooldownHours,
    };
}

function RuleBuilderDialog({
    open, onClose, rule, onSaved,
}: {
    open: boolean;
    onClose: () => void;
    rule: WorkflowRule | null;
    onSaved: () => void;
}) {
    const [step, setStep] = useState(1);
    const [s, setS] = useState<BuilderState>(defaultBuilder());

    useEffect(() => {
        if (!open) return;
        setStep(1);
        setS(rule ? builderFromRule(rule) : defaultBuilder());
    }, [open, rule]);

    const isEdit = !!rule;
    const noActions = !s.enableWhatsApp && !s.enableInApp && !s.enableTask && !s.enableFlag;

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = buildPayload(s);
            if (isEdit && rule) {
                return workflowRuleService.updateRule(rule.id, {
                    name: payload.name,
                    description: payload.description ?? undefined,
                    conditionValue: payload.conditionValue,
                    actions: payload.actions,
                    cooldownHours: payload.cooldownHours,
                });
            }
            return workflowRuleService.createRule(payload);
        },
        onSuccess: () => {
            toast.success(isEdit ? "Rule updated" : "Rule created");
            onSaved();
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to save rule");
        },
    });

    function next() {
        if (step === 1 && !s.name.trim()) {
            toast.error("Rule name is required");
            return;
        }
        if (step === 3 && noActions) {
            toast.error("Select at least one action");
            return;
        }
        setStep((v) => Math.min(4, v + 1));
    }

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Rule" : "New Automation Rule"} — Step {step} of 4</DialogTitle>
                    <DialogDescription>
                        {step === 1 && "Name your rule and pick what should trigger it."}
                        {step === 2 && "Configure the condition that decides which patients match."}
                        {step === 3 && "Choose one or more actions to run for each matching patient."}
                        {step === 4 && "Set the cooldown and review the rule before saving."}
                    </DialogDescription>
                </DialogHeader>

                {/* ── Step 1: Trigger ──────────────────────────────────── */}
                {step === 1 && (
                    <div className="space-y-3 py-2">
                        <div>
                            <Label htmlFor="rule-name" className="text-xs">Rule Name</Label>
                            <Input id="rule-name" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })}
                                   placeholder="e.g. No check-in 3 days → WhatsApp" className="mt-1 text-sm" />
                        </div>
                        <div>
                            <Label htmlFor="rule-desc" className="text-xs">Description (optional)</Label>
                            <Textarea id="rule-desc" rows={2} value={s.description}
                                      onChange={(e) => setS({ ...s, description: e.target.value })}
                                      className="mt-1 text-sm" />
                        </div>
                        <div>
                            <Label className="text-xs">Trigger Type</Label>
                            <Select
                                value={s.triggerType}
                                onValueChange={(v) => setS({ ...s, triggerType: v as TriggerType })}
                                disabled={isEdit /* server keeps triggerType immutable on edit */}
                            >
                                <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TRIGGER_ORDER.map((t) => (
                                        <SelectItem key={t} value={t}>{TRIGGER_LABELS[t]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {isEdit && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Trigger type can't be changed after creation — delete & recreate to switch.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Step 2: Condition ────────────────────────────────── */}
                {step === 2 && (
                    <div className="space-y-3 py-2">
                        {(s.triggerType === "NO_CHECKIN" || s.triggerType === "PAIN_NOT_IMPROVING" || s.triggerType === "PRESCRIPTION_UNCOLLECTED") && (
                            <NumberRow label={
                                s.triggerType === "NO_CHECKIN"               ? "No check-in for (days)" :
                                s.triggerType === "PAIN_NOT_IMPROVING"       ? "Pain not declining over (days)" :
                                                                               "Prescription uncollected after (days)"
                            } value={s.days} onChange={(v) => setS({ ...s, days: v })} min={1} max={365} />
                        )}
                        {s.triggerType === "DIET_ADHERENCE_LOW" && (
                            <>
                                <NumberRow label="Diet adherence below (%)" value={s.thresholdPercent}
                                           onChange={(v) => setS({ ...s, thresholdPercent: v })} min={1} max={100} />
                                <NumberRow label="Over the last (days)" value={s.days}
                                           onChange={(v) => setS({ ...s, days: v })} min={1} max={365} />
                            </>
                        )}
                        {s.triggerType === "PHASE_OVERDUE" && (
                            <>
                                <NumberRow label="Phase running more than (days)" value={s.days}
                                           onChange={(v) => setS({ ...s, days: v })} min={1} max={365} />
                                <NumberRow label="With task completion below (%)" value={s.taskCompletionBelow}
                                           onChange={(v) => setS({ ...s, taskCompletionBelow: v })} min={0} max={100} />
                            </>
                        )}
                        {s.triggerType === "PHASE_COMPLETED" && (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                                <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                                No condition needed — this trigger fires on every phase completion for your branch.
                                The hourly cron skips it; the journey routes fire it directly.
                            </p>
                        )}
                    </div>
                )}

                {/* ── Step 3: Actions ──────────────────────────────────── */}
                {step === 3 && (
                    <div className="space-y-3 py-2">
                        <ActionToggleRow
                            checked={s.enableWhatsApp}
                            onChange={(v) => setS({ ...s, enableWhatsApp: v })}
                            label="Send WhatsApp message"
                        >
                            {s.enableWhatsApp && (
                                <Input
                                    value={s.whatsappTemplate}
                                    onChange={(e) => setS({ ...s, whatsappTemplate: e.target.value })}
                                    placeholder="Use {patientName}, {reason}, {branchName}, {doctorName}, {daysCount}"
                                    className="mt-2 text-sm"
                                />
                            )}
                        </ActionToggleRow>

                        <ActionToggleRow
                            checked={s.enableInApp}
                            onChange={(v) => setS({ ...s, enableInApp: v })}
                            label="Send in-app notification"
                        >
                            {s.enableInApp && (
                                <Input
                                    value={s.inAppTemplate}
                                    onChange={(e) => setS({ ...s, inAppTemplate: e.target.value })}
                                    placeholder="Use {patientName}, {reason}, {branchName}, {doctorName}"
                                    className="mt-2 text-sm"
                                />
                            )}
                        </ActionToggleRow>

                        <ActionToggleRow
                            checked={s.enableTask}
                            onChange={(v) => setS({ ...s, enableTask: v })}
                            label="Create follow-up task for the patient's doctor"
                        >
                            {s.enableTask && (
                                <div className="mt-2 space-y-2">
                                    <Input value={s.taskTitle}
                                           onChange={(e) => setS({ ...s, taskTitle: e.target.value })}
                                           placeholder="Task title — use {patientName}, {reason}"
                                           className="text-sm" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <Select value={s.taskPriority}
                                                onValueChange={(v) => setS({ ...s, taskPriority: v as BuilderState["taskPriority"] })}>
                                            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="HIGH">High Priority</SelectItem>
                                                <SelectItem value="MEDIUM">Medium Priority</SelectItem>
                                                <SelectItem value="LOW">Low Priority</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <NumberInline label="Due in (days)" value={s.taskDueDays}
                                                      onChange={(v) => setS({ ...s, taskDueDays: v })} min={0} max={365} />
                                    </div>
                                </div>
                            )}
                        </ActionToggleRow>

                        <ActionToggleRow
                            checked={s.enableFlag}
                            onChange={(v) => setS({ ...s, enableFlag: v })}
                            label="Flag patient for doctor review"
                        >
                            {s.enableFlag && (
                                <Input value={s.flagMessage}
                                       onChange={(e) => setS({ ...s, flagMessage: e.target.value })}
                                       placeholder="Doctor-facing flag message — use {patientName}, {reason}"
                                       className="mt-2 text-sm" />
                            )}
                        </ActionToggleRow>

                        {noActions && (
                            <p className="text-[11px] text-rose-700 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Select at least one action.
                            </p>
                        )}
                    </div>
                )}

                {/* ── Step 4: Review ───────────────────────────────────── */}
                {step === 4 && (
                    <div className="space-y-3 py-2">
                        <div>
                            <Label htmlFor="cool" className="text-xs">Cooldown (hours between firings for the same patient)</Label>
                            <Input id="cool" type="number" min={0} max={24 * 30}
                                   value={s.cooldownHours}
                                   onChange={(e) => setS({ ...s, cooldownHours: Math.max(0, Number(e.target.value) || 0) })}
                                   className="mt-1 text-sm w-32" />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Prevents the same patient from being messaged repeatedly.
                            </p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1 text-sm">
                            <p className="font-semibold">{s.name || "(unnamed rule)"}</p>
                            <p className="text-xs text-muted-foreground">
                                When {TRIGGER_LABELS[s.triggerType].toLowerCase()}: <span className="text-foreground">
                                    {describeCondition({ triggerType: s.triggerType, conditionValue: buildPayload(s).conditionValue })}
                                </span>
                            </p>
                            <ul className="text-xs list-disc pl-5 space-y-0.5">
                                {buildPayload(s).actions.map((a, i) => (
                                    <li key={i}>{describeAction(a)}</li>
                                ))}
                            </ul>
                            <p className="text-[11px] text-muted-foreground pt-1">
                                Won't fire again for the same patient for {s.cooldownHours} hours.
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 flex-row sm:justify-between">
                    <div>
                        {step > 1 && (
                            <Button variant="ghost" onClick={() => setStep((v) => v - 1)} disabled={saveMutation.isPending}>
                                Back
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
                        {step < 4 ? (
                            <Button onClick={next} className="bg-primary hover:bg-primary/90">Next</Button>
                        ) : (
                            <Button
                                onClick={() => saveMutation.mutate()}
                                disabled={saveMutation.isPending || noActions || !s.name.trim()}
                                className="bg-primary hover:bg-primary/90"
                            >
                                {saveMutation.isPending ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                                ) : isEdit ? "Update Rule" : "Create Rule"}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function NumberRow({ label, value, onChange, min, max }: {
    label: string; value: number; onChange: (n: number) => void; min: number; max: number;
}) {
    return (
        <div className="flex items-center gap-3">
            <Label className="text-sm flex-1">{label}</Label>
            <Input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
                className="text-sm w-28"
            />
        </div>
    );
}

function NumberInline({ label, value, onChange, min, max }: {
    label: string; value: number; onChange: (n: number) => void; min: number; max: number;
}) {
    return (
        <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">{label}</Label>
            <Input type="number" value={value} min={min} max={max}
                   onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
                   className="text-sm" />
        </div>
    );
}

function ActionToggleRow({ checked, onChange, label, children }: {
    checked: boolean; onChange: (v: boolean) => void; label: string; children?: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center gap-2">
                <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
                <span className="text-sm font-medium">{label}</span>
            </div>
            {children}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Logs side sheet
// ─────────────────────────────────────────────────────────────────────────────

function RuleLogsSheet({ rule, open, onClose }: { rule: WorkflowRule; open: boolean; onClose: () => void }) {
    const [pages, setPages] = useState<RuleLogItem[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);

    // Reset when sheet opens for a different rule.
    useEffect(() => {
        if (!open) return;
        setPages([]); setPage(1); setTotalPages(1);
    }, [open, rule.id]);

    const { data, isLoading } = useQuery<RuleLogPage>({
        queryKey: ["workflow-rule-logs", rule.id, page],
        queryFn:  () => workflowRuleService.getLogs(rule.id, page),
        enabled: open,
    });

    useEffect(() => {
        if (!data) return;
        setTotalPages(data.totalPages || 1);
        setPages((prev) => {
            // Page 1 = replace; later pages = append.
            if (page === 1) return data.logs;
            const ids = new Set(prev.map((l) => l.id));
            return [...prev, ...data.logs.filter((l) => !ids.has(l.id))];
        });
        setLoadingMore(false);
    }, [data, page]);

    const total = data?.total ?? rule.totalFired;
    const canLoadMore = page < totalPages;

    return (
        <Sheet open={open} onOpenChange={(o) => (o ? null : onClose())}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Rule Logs</SheetTitle>
                    <SheetDescription>
                        "{rule.name}" — fired {total} time{total === 1 ? "" : "s"}
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-4 space-y-3">
                    {isLoading && pages.length === 0 ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                        ))
                    ) : pages.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                            This rule hasn't fired for any patient yet.
                        </p>
                    ) : (
                        pages.map((log) => (
                            <div key={log.id} className="rounded-lg border border-border/60 bg-card p-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p className="text-sm font-medium">{log.patientName}</p>
                                    <span className="text-[11px] text-muted-foreground">
                                        {fmtDateTime(log.triggeredAt)}
                                    </span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    {(log.actionsTaken || []).map((a, i) => (
                                        <Badge key={i} variant="outline"
                                               className={cn("text-[10px] gap-1",
                                                   a.success
                                                       ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                       : "bg-rose-50 text-rose-700 border-rose-200")}>
                                            {a.success ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {ACTION_LABEL[a.type as ActionType] || a.type}
                                            {!a.success && a.error && (
                                                <span className="opacity-70 ml-1">({a.error})</span>
                                            )}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}

                    {canLoadMore && (
                        <Button
                            variant="outline" size="sm" className="w-full"
                            disabled={loadingMore || isLoading}
                            onClick={() => { setLoadingMore(true); setPage((p) => p + 1); }}
                        >
                            {loadingMore || isLoading ? (
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                            ) : null}
                            Load more
                        </Button>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
