import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  todosApi,
  Todo,
  TodoListResponse,
  TodoPriority,
  TodoTab,
  AssignableStaff,
} from "@/services/todos.service";
import { Plus, AlertCircle, CheckCircle2, Clock, Sparkles, UserCheck, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodoPanelProps {
  canAssign?: boolean;
  className?: string;
  title?: string;
}

const PRIORITY_COLORS: Record<TodoPriority, string> = {
  URGENT: "border-l-red-500 bg-red-50",
  HIGH: "border-l-orange-500 bg-orange-50",
  MEDIUM: "border-l-yellow-400 bg-yellow-50",
  LOW: "border-l-slate-300 bg-slate-50",
};

const PRIORITY_BADGE: Record<TodoPriority, string> = {
  URGENT: "bg-red-500 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-500 text-white",
  LOW: "bg-slate-400 text-white",
};

const DEFAULT_XP: Record<TodoPriority, number> = {
  LOW: 10, MEDIUM: 25, HIGH: 50, URGENT: 100,
};

function formatRelative(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const hr = 60 * 60 * 1000;
  if (abs < hr) return diffMs >= 0 ? `in ${Math.round(abs / 60_000)}m` : `${Math.round(abs / 60_000)}m ago`;
  if (abs < 24 * hr) return diffMs >= 0 ? `in ${Math.round(abs / hr)}h` : `${Math.round(abs / hr)}h ago`;
  return d.toLocaleDateString();
}

export default function TodoPanel({ canAssign = false, className, title = "My Tasks" }: TodoPanelProps) {
  const { toast } = useToast();
  const [data, setData] = useState<TodoListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TodoTab>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  async function refresh(currentTab: TodoTab = tab) {
    setLoading(true);
    try {
      const res = await todosApi.list({ tab: currentTab === "all" ? undefined : currentTab });
      setData(res);
    } catch (err) {
      toast({
        title: "Couldn't load tasks",
        description: err instanceof Error ? err.message : "Network error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(tab);
  }, [tab]);

  async function handleComplete(todo: Todo) {
    try {
      await todosApi.setStatus(todo.id, "COMPLETED");
      toast({
        title: "Task completed",
        description: todo.isSelfCreated ? "Nicely done." : `+${todo.xpReward} XP earned`,
      });
      refresh(tab);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: "Couldn't complete task", description: msg, variant: "destructive" });
    }
  }

  async function handleProgress(todo: Todo) {
    try {
      await todosApi.setStatus(todo.id, "IN_PROGRESS");
      refresh(tab);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      toast({ title: "Couldn't update task", description: msg, variant: "destructive" });
    }
  }

  const footerText = useMemo(() => {
    if (!data) return "";
    const { pending, completedToday, xpToday, overdue } = data.summary;
    const parts = [`${pending} pending`];
    if (completedToday > 0) parts.push(`${completedToday} completed today`);
    if (xpToday > 0) parts.push(`+${xpToday} XP earned`);
    if (overdue > 0) parts.push(`${overdue} overdue`);
    return parts.join(" · ");
  }, [data]);

  return (
    <div className={cn("rounded-xl border bg-card shadow-card overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Task
          </Button>
          {canAssign && (
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <UserCheck className="w-4 h-4 mr-1" /> Assign
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-5 py-2 border-b bg-muted/30 overflow-x-auto">
        {([
          { k: "all", label: "All" },
          { k: "assigned", label: "Assigned to Me" },
          { k: "self", label: "Self-Created" },
          { k: "done", label: "Done" },
        ] as { k: TodoTab; label: string }[]).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap",
              tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="divide-y max-h-[500px] overflow-y-auto">
        {loading && <div className="p-6 text-center text-sm text-muted-foreground">Loading tasks…</div>}
        {!loading && data?.items.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-primary/40" />
            {tab === "done" ? "No completed tasks yet." : "No tasks here. Add one to get started."}
          </div>
        )}
        {data?.items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "px-5 py-3 border-l-4 flex flex-col gap-2",
              PRIORITY_COLORS[t.priority],
              t.status === "COMPLETED" && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={cn("text-[10px] h-5", PRIORITY_BADGE[t.priority])}>{t.priority}</Badge>
                  {!t.isSelfCreated && (
                    <Badge variant="outline" className="text-[10px] h-5 border-primary/40 text-primary">
                      Assigned
                    </Badge>
                  )}
                  {t.isOverdue && (
                    <Badge className="text-[10px] h-5 bg-red-600 text-white">OVERDUE</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {t.isSelfCreated ? "No XP" : `+${t.xpReward} XP`}
                  </span>
                </div>
                <div className="font-medium text-sm">{t.title}</div>
                {t.description && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
                )}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
                  {t.dueDate && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Due {formatRelative(t.dueDate)}
                    </span>
                  )}
                  {!t.isSelfCreated && t.createdBy && (
                    <span>Assigned by {t.createdBy.name}</span>
                  )}
                  {t.relatedPatient && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Patient: {t.relatedPatient.fullName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {t.status !== "COMPLETED" && t.status !== "DISMISSED" && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => handleComplete(t)}
                >
                  Mark Complete
                </Button>
                {t.status === "PENDING" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => handleProgress(t)}
                  >
                    In Progress
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {data && (
        <div className="px-5 py-3 border-t bg-muted/20 text-xs text-muted-foreground">{footerText}</div>
      )}

      <AddTaskDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => refresh(tab)} />
      {canAssign && (
        <AssignTaskDialog open={assignOpen} onOpenChange={setAssignOpen} onCreated={() => refresh(tab)} />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── *
 *  Add Task Dialog (self-assigned)
 * ──────────────────────────────────────────────────────────────────── */

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

function AddTaskDialog({ open, onOpenChange, onCreated }: TaskDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle(""); setDescription(""); setPriority("MEDIUM"); setDueDate("");
  }

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await todosApi.createSelf({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || null,
      });
      toast({ title: "Task created" });
      onCreated();
      onOpenChange(false);
      reset();
    } catch (err) {
      toast({
        title: "Couldn't create task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground -mt-2 mb-2 rounded bg-muted/40 px-3 py-2">
          Self-created tasks don't earn XP — only tasks assigned to you by an Admin or Admin Doctor reward XP on completion.
        </div>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up with patient" maxLength={120} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TodoPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────────── *
 *  Assign Task Dialog (ADMIN / ADMIN_DOCTOR)
 * ──────────────────────────────────────────────────────────────────── */

function AssignTaskDialog({ open, onOpenChange, onCreated }: TaskDialogProps) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<AssignableStaff[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [xpOverride, setXpOverride] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    todosApi.assignableStaff().then((r) => setStaff(r.staff)).catch(() => setStaff([]));
  }, [open]);

  function reset() {
    setTitle(""); setDescription(""); setPriority("MEDIUM"); setDueDate("");
    setAssigneeId(""); setXpOverride("");
  }

  async function save() {
    if (!title.trim() || !assigneeId) return;
    setSaving(true);
    try {
      await todosApi.assign({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || null,
        assignedToId: assigneeId,
        xpReward: xpOverride ? Number(xpOverride) : undefined,
      });
      toast({ title: "Task assigned" });
      onCreated();
      onOpenChange(false);
      reset();
    } catch (err) {
      toast({
        title: "Couldn't assign task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Assign To</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger><SelectValue placeholder="Select staff member…" /></SelectTrigger>
              <SelectContent>
                {staff.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} — {s.role}{s.branch ? ` (${s.branch})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TodoPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>XP Override (10–200; default {DEFAULT_XP[priority]})</Label>
            <Input
              type="number"
              min={10}
              max={200}
              value={xpOverride}
              onChange={(e) => setXpOverride(e.target.value)}
              placeholder={String(DEFAULT_XP[priority])}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title.trim() || !assigneeId}>
            {saving ? "Assigning…" : "Assign Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────────── *
 *  Tasks I've Assigned — management view for ADMIN / ADMIN_DOCTOR
 * ──────────────────────────────────────────────────────────────────── */

export function AssignedByMePanel({ className }: { className?: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<Awaited<ReturnType<typeof todosApi.listAssignedByMe>> | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await todosApi.listAssignedByMe();
      setData(res);
    } finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function handleRemind(id: string) {
    try {
      await todosApi.remind(id);
      toast({ title: "Reminder sent" });
    } catch {
      toast({ title: "Couldn't send reminder", variant: "destructive" });
    }
  }

  async function handleRevoke(id: string) {
    try {
      await todosApi.revoke(id);
      toast({ title: "Task revoked" });
      refresh();
    } catch (err) {
      toast({
        title: "Couldn't revoke task",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  return (
    <div className={cn("rounded-xl border bg-card shadow-card overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-base">Tasks I've Assigned</h3>
        </div>
        {data && (
          <div className="text-xs text-muted-foreground">
            {data.summary.total} total · {data.summary.completed} done · {data.summary.overdue} overdue
          </div>
        )}
      </div>
      <div className="divide-y max-h-[400px] overflow-y-auto">
        {loading && <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {!loading && data?.items.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No tasks assigned yet. Use the "Assign" button above.
          </div>
        )}
        {data?.items.map((t) => (
          <div key={t.id} className="px-5 py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge className={cn("text-[10px] h-5", PRIORITY_BADGE[t.priority])}>{t.priority}</Badge>
                <Badge variant="outline" className="text-[10px] h-5">{t.status}</Badge>
                {t.isOverdue && (
                  <Badge className="text-[10px] h-5 bg-red-600 text-white">OVERDUE</Badge>
                )}
              </div>
              <div className="font-medium text-sm">{t.title}</div>
              <div className="text-[11px] text-muted-foreground">
                {t.assignedTo?.name} · {t.dueDate ? `due ${formatRelative(t.dueDate)}` : "no due date"} · {t.xpReward} XP
              </div>
            </div>
            <div className="flex items-center gap-1">
              {t.status !== "COMPLETED" && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleRemind(t.id)}>
                  <Bell className="w-3 h-3 mr-1" /> Remind
                </Button>
              )}
              {t.status === "PENDING" && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => handleRevoke(t.id)}>
                  Revoke
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
