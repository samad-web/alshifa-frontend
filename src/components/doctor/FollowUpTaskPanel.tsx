import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    AlertCircle, ChevronRight, CheckCircle2, Clock,
    Loader2, Plus, Sparkles, X, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { apiClient } from "@/lib/api-client";
import {
    followUpTaskService,
    type FollowUpTaskItem,
    type TaskPriority,
} from "@/services/followUpTask.service";

// ── Lookup tables ───────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
    TRIAGE_SWELLING:        "Triage: Swelling",
    TRIAGE_HIGH_PAIN:       "Triage: High Pain",
    CONSULTATION_HIGH_PAIN: "Post-Consultation",
    DIET_ADHERENCE_LOW:     "Diet Adherence",
    PHASE_STARTED:          "Phase Started",
    MANUAL:                 "Manual",
};

const XP_BY_PRIORITY: Record<TaskPriority, number> = { HIGH: 15, MEDIUM: 10, LOW: 5 };

const PRIORITY_DOT: Record<TaskPriority, string> = {
    HIGH:   "🔴",
    MEDIUM: "🟡",
    LOW:    "🟢",
};

const PRIORITY_BORDER: Record<TaskPriority, string> = {
    HIGH:   "border-l-rose-500",
    MEDIUM: "border-l-amber-500",
    LOW:    "border-l-slate-300",
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
    HIGH:   "bg-rose-100 text-rose-700 border-rose-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW:    "bg-slate-100 text-slate-600 border-slate-200",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDueDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function isOverdue(task: FollowUpTaskItem): boolean {
    if (task.status === "COMPLETED" || task.status === "DISMISSED") return false;
    return new Date(task.dueDate).getTime() < Date.now();
}

function patientInitials(name: string | null | undefined): string {
    if (!name) return "?";
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase() || "?";
}

// ── Filter tab type ─────────────────────────────────────────────────────────

type FilterKey = "all" | "today" | "overdue" | "completed";

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

// `bare` strips the outer card chrome (border + radius + shadow) so this panel
// can sit inside another card (e.g. <TasksSection /> on the Admin Dashboard)
// without rendering a nested-card border. No business-logic change.
export function FollowUpTaskPanel({ bare = false }: { bare?: boolean } = {}) {
    const qc = useQueryClient();
    const { socket } = useWebSocket();
    const [filter, setFilter] = useState<FilterKey>("all");
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [completionNote, setCompletionNote] = useState("");
    const [actionTaskId, setActionTaskId] = useState<string | null>(null);
    const [newTaskOpen, setNewTaskOpen] = useState(false);

    // Map UI filter → backend query params.
    const queryParams = useMemo(() => {
        switch (filter) {
            case "today":     return { date: "today" };
            case "overdue":   return { date: "overdue" };
            case "completed": return { status: "COMPLETED" };
            case "all":
            default:          return { status: "PENDING" }; // morning panel = open work
        }
    }, [filter]);

    const { data: summary } = useQuery({
        queryKey: ["follow-up-summary"],
        queryFn:  () => followUpTaskService.getSummary(),
        refetchInterval: 60_000,
    });

    const { data: tasks, isLoading, isFetching } = useQuery({
        queryKey: ["follow-up-tasks", filter],
        queryFn:  () => followUpTaskService.getTasks(queryParams),
    });

    // Realtime — backend emits 'follow_up_task_created' on the doctor's user
    // room when any of the 4 auto-triggers fire (or a manual create).
    useEffect(() => {
        if (!socket) return;
        const onCreated = (payload: { title?: string; priority?: TaskPriority }) => {
            const title = payload?.title || "task";
            toast(`New follow-up task: ${title}`, {
                icon: payload?.priority === "HIGH" ? "🔴" : payload?.priority === "MEDIUM" ? "🟡" : "🟢",
            });
            qc.invalidateQueries({ queryKey: ["follow-up-tasks"] });
            qc.invalidateQueries({ queryKey: ["follow-up-summary"] });
        };
        socket.on("follow_up_task_created", onCreated);
        return () => { socket.off("follow_up_task_created", onCreated); };
    }, [socket, qc]);

    const completeMutation = useMutation({
        mutationFn: ({ taskId, note }: { taskId: string; note: string }) =>
            followUpTaskService.complete(taskId, note || undefined),
        onSuccess: (data) => {
            const xp = data.xpAmount;
            const pretty = data.xpAwarded ? `+${xp} XP earned!` : `Task completed (XP awarded shortly)`;
            toast.success(pretty, { icon: "✨" });
            setCompletingId(null);
            setCompletionNote("");
            qc.invalidateQueries({ queryKey: ["follow-up-tasks"] });
            qc.invalidateQueries({ queryKey: ["follow-up-summary"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to complete task");
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ taskId, status }: { taskId: string; status: "IN_PROGRESS" | "DISMISSED" }) =>
            followUpTaskService.updateStatus(taskId, status),
        onSuccess: (_data, vars) => {
            toast.success(vars.status === "DISMISSED" ? "Task dismissed" : "Marked in progress");
            setActionTaskId(null);
            qc.invalidateQueries({ queryKey: ["follow-up-tasks"] });
            qc.invalidateQueries({ queryKey: ["follow-up-summary"] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to update task");
        },
    });

    const list = tasks ?? [];

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <section
            className={
                bare
                    ? "overflow-hidden"
                    : "rounded-xl border bg-card shadow-card overflow-hidden"
            }
        >
            <header className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" /> Follow-Up Tasks
                    </h2>
                    {summary && (
                        <div className="flex items-center gap-1.5 text-[11px]">
                            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                                {summary.pending} Pending
                            </Badge>
                            {summary.overdue > 0 && (
                                <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300">
                                    {summary.overdue} Overdue
                                </Badge>
                            )}
                            {summary.highPriority > 0 && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                                    {summary.highPriority} High Priority
                                </Badge>
                            )}
                        </div>
                    )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> New Task
                </Button>
            </header>

            <div className="px-5 py-2 border-b flex items-center gap-1 overflow-x-auto">
                {(["all", "today", "overdue", "completed"] as FilterKey[]).map((k) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => setFilter(k)}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                            filter === k
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground hover:bg-muted",
                        )}
                    >
                        {k === "all" ? "Pending" : k}
                    </button>
                ))}
                {isFetching && !isLoading && (
                    <Loader2 className="ml-1 w-3 h-3 animate-spin text-muted-foreground" />
                )}
            </div>

            <div className="divide-y max-h-[420px] overflow-y-auto">
                {isLoading ? (
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-3 w-1/2" />
                                    <Skeleton className="h-2 w-3/4" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : list.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-foreground">All caught up</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {filter === "completed"
                                ? "No completed tasks in this view yet."
                                : "No follow-up tasks right now. New ones will appear automatically."}
                        </p>
                    </div>
                ) : (
                    list.map((task) => {
                        const overdue   = isOverdue(task);
                        const completed = task.status === "COMPLETED";
                        const dismissed = task.status === "DISMISSED";
                        const inProg    = task.status === "IN_PROGRESS";
                        const inlineOpen = completingId === task.id;
                        const triggerLabel = TRIGGER_LABELS[task.triggerType] ?? task.triggerType;
                        const xpForThis = XP_BY_PRIORITY[task.priority] ?? 5;

                        return (
                            <div
                                key={task.id}
                                className={cn(
                                    "px-4 py-3 border-l-4 flex items-start gap-3",
                                    PRIORITY_BORDER[task.priority],
                                    overdue && "bg-rose-50/40",
                                    completed && "opacity-60",
                                    dismissed && "opacity-50 line-through",
                                )}
                            >
                                <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                                    {patientInitials(task.patientName)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span aria-hidden>{PRIORITY_DOT[task.priority]}</span>
                                        <span className="text-sm font-medium text-foreground truncate">
                                            {task.patientName}
                                        </span>
                                        {inProg && (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                                In Progress
                                            </Badge>
                                        )}
                                        {overdue && !completed && !dismissed && (
                                            <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-300 text-[10px] gap-1">
                                                <AlertCircle className="w-3 h-3" /> Overdue
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm font-semibold text-foreground mt-0.5">{task.title}</p>
                                    {task.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                            {task.description}
                                        </p>
                                    )}
                                    <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Due {formatDueDate(task.dueDate)}
                                        </span>
                                        <Badge variant="outline" className="bg-muted/40 text-muted-foreground border-border text-[10px]">
                                            {triggerLabel}
                                        </Badge>
                                        <Badge variant="outline" className={cn("text-[10px]", PRIORITY_BADGE[task.priority])}>
                                            {task.priority}
                                        </Badge>
                                    </div>

                                    {!completed && !dismissed && !inlineOpen && (
                                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                            {!inProg && (
                                                <Button
                                                    size="sm" variant="outline"
                                                    className="h-7 text-xs"
                                                    disabled={statusMutation.isPending && actionTaskId === task.id}
                                                    onClick={() => {
                                                        setActionTaskId(task.id);
                                                        statusMutation.mutate({ taskId: task.id, status: "IN_PROGRESS" });
                                                    }}
                                                >
                                                    Mark In Progress
                                                </Button>
                                            )}
                                            <Button
                                                size="sm"
                                                className="h-7 text-xs bg-primary hover:bg-primary/90"
                                                onClick={() => {
                                                    setCompletingId(task.id);
                                                    setCompletionNote("");
                                                }}
                                            >
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                                            </Button>
                                            <Button
                                                size="sm" variant="ghost"
                                                className="h-7 text-xs text-muted-foreground"
                                                disabled={statusMutation.isPending && actionTaskId === task.id}
                                                onClick={() => {
                                                    setActionTaskId(task.id);
                                                    statusMutation.mutate({ taskId: task.id, status: "DISMISSED" });
                                                }}
                                            >
                                                <X className="w-3 h-3 mr-1" /> Dismiss
                                            </Button>
                                        </div>
                                    )}

                                    {inlineOpen && (
                                        <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                                            <Label htmlFor={`note-${task.id}`} className="text-[11px]">
                                                Completion note (optional)
                                            </Label>
                                            <Textarea
                                                id={`note-${task.id}`}
                                                rows={2}
                                                value={completionNote}
                                                onChange={(e) => setCompletionNote(e.target.value)}
                                                placeholder="What was done? Any patient response? (private to your audit log)"
                                                className="text-xs"
                                            />
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm" variant="outline"
                                                    className="h-7 text-xs"
                                                    disabled={completeMutation.isPending}
                                                    onClick={() => { setCompletingId(null); setCompletionNote(""); }}
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-xs bg-primary hover:bg-primary/90"
                                                    disabled={completeMutation.isPending}
                                                    onClick={() => completeMutation.mutate({ taskId: task.id, note: completionNote })}
                                                >
                                                    {completeMutation.isPending ? (
                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                    )}
                                                    Mark Complete → +{xpForThis} XP
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {completed && task.completedAt && (
                                        <p className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Completed {formatDueDate(task.completedAt)}
                                            {task.xpAwarded && (
                                                <span className="ml-1 text-amber-700">· +{xpForThis} XP</span>
                                            )}
                                        </p>
                                    )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground/40 mt-1" />
                            </div>
                        );
                    })
                )}
            </div>

            <NewTaskDialog
                open={newTaskOpen}
                onClose={() => setNewTaskOpen(false)}
                onCreated={() => {
                    setNewTaskOpen(false);
                    qc.invalidateQueries({ queryKey: ["follow-up-tasks"] });
                    qc.invalidateQueries({ queryKey: ["follow-up-summary"] });
                }}
            />
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Task dialog — patient search + form
// ─────────────────────────────────────────────────────────────────────────────

interface PatientSearchHit {
    id: string;
    fullName: string | null;
    phoneNumber: string | null;
    user?: { email?: string | null } | null;
}

function NewTaskDialog({
    open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [selected, setSelected] = useState<PatientSearchHit | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
    const [dueDays, setDueDays] = useState(3);

    // Reset every time the dialog opens.
    useEffect(() => {
        if (!open) return;
        setSearch(""); setDebounced(""); setSelected(null);
        setTitle(""); setDescription(""); setPriority("MEDIUM"); setDueDays(3);
    }, [open]);

    // Debounce the patient search input.
    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    const { data: hits, isFetching } = useQuery({
        queryKey: ["follow-up-task-patient-search", debounced],
        queryFn:  async () => {
            if (debounced.length < 2) return [] as PatientSearchHit[];
            const { data } = await apiClient.get<PatientSearchHit[]>(
                "/api/search/patients",
                { q: debounced, limit: 10 },
            );
            return data;
        },
        enabled: open && debounced.length >= 2 && !selected,
        staleTime: 10_000,
    });

    const createMutation = useMutation({
        mutationFn: () => {
            if (!selected?.id) throw new Error("Select a patient first");
            if (!title.trim()) throw new Error("Title is required");
            return followUpTaskService.create({
                patientId:   selected.id,
                title:       title.trim(),
                description: description.trim() || undefined,
                priority,
                dueDays,
            });
        },
        onSuccess: (data) => {
            toast.success(data.alreadyExisted ? "Task already exists for this trigger" : "Task created");
            onCreated();
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to create task");
        },
    });

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>New Follow-Up Task</DialogTitle>
                    <DialogDescription>
                        Manually create a task for any patient. It will appear in your follow-up list with the priority you choose.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div>
                        <Label className="text-xs">Patient</Label>
                        {selected ? (
                            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 mt-1">
                                <div className="text-sm">
                                    <div className="font-medium">{selected.fullName || selected.user?.email || "Patient"}</div>
                                    {selected.phoneNumber && (
                                        <div className="text-[11px] text-muted-foreground">{selected.phoneNumber}</div>
                                    )}
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => { setSelected(null); setSearch(""); }}>
                                    Change
                                </Button>
                            </div>
                        ) : (
                            <div className="relative mt-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name, phone, or patient ID (min 2 chars)…"
                                    className="pl-8 text-sm"
                                />
                                {debounced.length >= 2 && (
                                    <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-border/60 bg-popover shadow-sm">
                                        {isFetching ? (
                                            <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Searching…
                                            </div>
                                        ) : (hits || []).length === 0 ? (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">No patients matched.</div>
                                        ) : (
                                            (hits || []).map((p) => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => setSelected(p)}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                                >
                                                    <div className="font-medium">{p.fullName || p.user?.email || "Patient"}</div>
                                                    {p.phoneNumber && (
                                                        <div className="text-[11px] text-muted-foreground">{p.phoneNumber}</div>
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="task-title" className="text-xs">Title</Label>
                        <Input
                            id="task-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Call patient to check on swelling"
                            className="mt-1 text-sm"
                        />
                    </div>

                    <div>
                        <Label htmlFor="task-desc" className="text-xs">Description (optional)</Label>
                        <Textarea
                            id="task-desc"
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 text-sm"
                            placeholder="Any context the doctor should see when picking this up…"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-xs">Priority</Label>
                            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                                <SelectTrigger className="mt-1 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="HIGH"><span className="mr-2">🔴</span>High (15 XP)</SelectItem>
                                    <SelectItem value="MEDIUM"><span className="mr-2">🟡</span>Medium (10 XP)</SelectItem>
                                    <SelectItem value="LOW"><span className="mr-2">🟢</span>Low (5 XP)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="task-due" className="text-xs">Due in (days)</Label>
                            <Input
                                id="task-due"
                                type="number"
                                min={0}
                                max={365}
                                value={dueDays}
                                onChange={(e) => setDueDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
                                className="mt-1 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={createMutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => createMutation.mutate()}
                        disabled={createMutation.isPending || !selected || !title.trim()}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {createMutation.isPending ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                        ) : (
                            <><Plus className="w-4 h-4 mr-2" />Create Task</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default FollowUpTaskPanel;
