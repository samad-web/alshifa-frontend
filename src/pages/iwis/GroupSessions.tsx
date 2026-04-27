import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Users, Loader2, Calendar, Clock, DoorOpen, Building2, CheckCircle2, UserPlus } from "lucide-react";
import { iwisApi, type GroupSession, type TherapyRoom } from "@/services/iwis.service";
import { branchesApi } from "@/services/branches.service";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useConfirm } from "@/components/common/ConfirmDialog";

const STATUS_TONE: Record<string, string> = {
    OPEN: "bg-wellness/10 text-wellness border-wellness/30",
    FULL: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    COMPLETED: "bg-muted text-muted-foreground",
    CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function GroupSessionsPage() {
    const { toast } = useToast();
    const { role } = useAuth();
    const { branchIdParam } = useBranchScope();
    const { confirm, dialog: confirmDialog } = useConfirm();
    const isClinician = role === "ADMIN" || role === "ADMIN_DOCTOR" || role === "THERAPIST";

    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
    const [branchId, setBranchId] = useState("");
    const [sessions, setSessions] = useState<GroupSession[]>([]);
    const [rooms, setRooms] = useState<TherapyRoom[]>([]);
    const [therapists, setTherapists] = useState<Array<{ id: string; fullName: string | null }>>([]);
    const [loading, setLoading] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState({
        therapistId: "", roomId: "", title: "", sessionType: "YOGA",
        date: new Date().toISOString().slice(0, 10),
        startTime: "07:00", endTime: "08:00", maxCapacity: "10",
    });

    useEffect(() => {
        branchesApi.list().then(setBranches).catch(() => setBranches([]));
        apiClient.get<Array<{ id: string; fullName: string | null }>>("/api/user/list-therapists")
            .then(({ data }) => setTherapists(data)).catch(() => {});
    }, []);

    // Sync branch from the global navbar selector. Falls back to the first
    // branch in the user's list when "All branches" is active.
    useEffect(() => {
        if (branchIdParam) { setBranchId(branchIdParam); return; }
        if (branches[0] && !branchId) setBranchId(branches[0].id);
    }, [branchIdParam, branches, branchId]);

    useEffect(() => {
        if (!branchId) return;
        iwisApi.listRooms(branchId).then(setRooms).catch(() => {});
    }, [branchId]);

    const reload = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try { setSessions(await iwisApi.listGroupSessions({ branchId })); } finally { setLoading(false); }
    }, [branchId]);

    useEffect(() => { reload(); }, [reload]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await iwisApi.createGroupSession({
                branchId,
                therapistId: form.therapistId,
                roomId: form.roomId || undefined,
                title: form.title, sessionType: form.sessionType,
                date: form.date, startTime: form.startTime, endTime: form.endTime,
                maxCapacity: Number(form.maxCapacity),
            });
            toast({ title: "Group session scheduled" });
            setDialogOpen(false);
            reload();
        } catch (err: unknown) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
        }
    };

    const join = async (id: string) => {
        try {
            await iwisApi.joinGroupSession(id);
            toast({ title: "Joined session" });
            reload();
        } catch (err: unknown) {
            toast({ title: "Can't join", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
        }
    };

    const complete = async (id: string) => {
        const ok = await confirm({
            title: "Mark session completed?",
            description: "All linked appointments are locked. This action cannot be reversed from the UI.",
            confirmLabel: "Complete",
            tone: "default",
        });
        if (!ok) return;
        await iwisApi.completeGroupSession(id);
        toast({ title: "Session completed" });
        reload();
    };

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
                <PageHeader title="Group Therapy Sessions" subtitle="One therapist, one room, many patients — yoga, breathing, and preparation rituals">
                    {isClinician && <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> New Session</Button>}
                </PageHeader>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    Branch: <span className="font-semibold text-foreground">
                        {branches.find((b) => b.id === branchId)?.name || "—"}
                    </span>
                    <span className="text-xs">(switch via navbar)</span>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                        <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground mb-4">No group sessions scheduled for this branch.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sessions.map((s) => (
                            <Panel key={s.id} title={s.title} description={s.sessionType}>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Badge variant="outline" className={STATUS_TONE[s.status]}>{s.status}</Badge>
                                        <Badge variant="outline"><Users className="w-3 h-3 mr-1" /> {s._count?.appointments ?? 0} / {s.maxCapacity}</Badge>
                                        {s.room && <Badge variant="outline"><DoorOpen className="w-3 h-3 mr-1" /> {s.room.name}</Badge>}
                                    </div>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {new Date(s.date).toLocaleDateString()}</div>
                                        <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {s.startTime} – {s.endTime}</div>
                                        <div>Therapist: {s.therapist?.fullName || "—"}</div>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2">
                                        {s.status === "OPEN" && !isClinician && (
                                            <Button size="sm" onClick={() => join(s.id)}>
                                                <UserPlus className="w-3.5 h-3.5 mr-2" /> Join
                                            </Button>
                                        )}
                                        {isClinician && s.status !== "COMPLETED" && s.status !== "CANCELLED" && (
                                            <Button size="sm" variant="outline" onClick={() => complete(s.id)}>
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Complete
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Panel>
                        ))}
                    </div>
                )}

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-[550px]">
                        <DialogHeader>
                            <DialogTitle>Schedule Group Session</DialogTitle>
                            <DialogDescription>Create one session slot; patients enrol individually.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Morning Yoga — Group A" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Input value={form.sessionType} onChange={(e) => setForm({ ...form, sessionType: e.target.value })} placeholder="YOGA, BREATHING..." />
                                </div>
                                <div className="space-y-2">
                                    <Label>Max capacity</Label>
                                    <Input type="number" min={1} value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Start</Label>
                                    <Input type="time" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End</Label>
                                    <Input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Therapist</Label>
                                <Select value={form.therapistId} onValueChange={(v) => setForm({ ...form, therapistId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select therapist" /></SelectTrigger>
                                    <SelectContent>{therapists.map((t) => <SelectItem key={t.id} value={t.id}>{t.fullName || "Unnamed"}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Room (optional)</Label>
                                <Select
                                    value={form.roomId || "__none__"}
                                    onValueChange={(v) => setForm({ ...form, roomId: v === "__none__" ? "" : v })}
                                >
                                    <SelectTrigger><SelectValue placeholder="No room assigned" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No room</SelectItem>
                                        {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit">Create Session</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                {confirmDialog}
            </div>
        </AppLayout>
    );
}
