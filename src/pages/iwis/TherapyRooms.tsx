import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { DoorOpen, Plus, Loader2, Building2, Users, Edit2, Trash2, AlertCircle } from "lucide-react";
import { iwisApi, type TherapyRoom, type TherapyRoomType } from "@/services/iwis.service";
import { branchesApi } from "@/services/branches.service";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/components/common/ConfirmDialog";

const ROOM_TYPES: TherapyRoomType[] = ["SHIRODHARA", "ABHYANGA", "PANCHAKARMA_GENERAL", "STEAM", "CONSULTATION", "GROUP"];

const TYPE_LABEL: Record<TherapyRoomType, string> = {
    SHIRODHARA: "Shirodhara",
    ABHYANGA: "Abhyanga",
    PANCHAKARMA_GENERAL: "Panchakarma",
    STEAM: "Steam",
    CONSULTATION: "Consultation",
    GROUP: "Group",
};

export default function TherapyRoomsPage() {
    const { toast } = useToast();
    const { profile } = useAuth();
    const { confirm, dialog: confirmDialog } = useConfirm();
    // Branch is derived from the global navbar selector. ALL_BRANCHES (i.e.
    // `branchIdParam === undefined`) means the admin hasn't picked a branch
    // yet — therapy rooms belong to a single branch, so we fall back to the
    // current user's home branch in that case so the page never renders
    // empty for non-admin clinicians.
    const { branchIdParam } = useBranchScope();
    const homeBranchId = (profile as any)?.branchId
        ?? (profile as any)?.user?.branchId
        ?? null;
    const branchId = branchIdParam ?? homeBranchId ?? "";
    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
    const [rooms, setRooms] = useState<TherapyRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<TherapyRoom | null>(null);
    const [form, setForm] = useState<{ name: string; type: TherapyRoomType; capacity: string; notes: string }>({
        name: "", type: "SHIRODHARA", capacity: "1", notes: "",
    });

    useEffect(() => {
        // Used purely to render the active branch name in the header
        // breadcrumb — branch *selection* itself has been delegated to the
        // navbar's branch scope.
        branchesApi.list().then(setBranches).catch(() => setBranches([]));
    }, []);

    const reload = useCallback(async () => {
        if (!branchId) {
            setRooms([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            setRooms(await iwisApi.listRooms(branchId));
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { reload(); }, [reload]);

    const activeBranchName = branches.find((b) => b.id === branchId)?.name ?? null;

    const open = (room: TherapyRoom | null = null) => {
        if (room) {
            setEditing(room);
            setForm({ name: room.name, type: room.type, capacity: String(room.capacity), notes: room.notes || "" });
        } else {
            setEditing(null);
            setForm({ name: "", type: "SHIRODHARA", capacity: "1", notes: "" });
        }
        setDialogOpen(true);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchId) {
            toast({ title: "Pick a branch", description: "Use the navbar branch selector first.", variant: "destructive" });
            return;
        }
        try {
            const payload = { branchId, name: form.name, type: form.type, capacity: Number(form.capacity), notes: form.notes || undefined };
            if (editing) await iwisApi.updateRoom(editing.id, payload);
            else await iwisApi.createRoom(payload);
            toast({ title: editing ? "Room updated" : "Room registered" });
            setDialogOpen(false);
            reload();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Save failed";
            toast({ title: "Error", description: msg, variant: "destructive" });
        }
    };

    const deactivate = async (room: TherapyRoom) => {
        const ok = await confirm({
            title: `Deactivate "${room.name}"?`,
            description: "Existing bookings remain on the schedule, but no new bookings can target this room until it's reactivated.",
            confirmLabel: "Deactivate",
            tone: "danger",
        });
        if (!ok) return;
        await iwisApi.deactivateRoom(room.id);
        toast({ title: "Room deactivated" });
        reload();
    };

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
                <PageHeader title="Therapy Room Management" subtitle="Model therapy rooms as a bookable resource alongside therapists">
                    <Button onClick={() => open()} className="shadow-lg">
                        <Plus className="w-4 h-4 mr-2" /> Register Room
                    </Button>
                </PageHeader>

                {/* Branch indicator — read-only mirror of the navbar branch
                    scope. The page-level branch dropdown was removed so
                    every screen consumes the same global selector. */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    {activeBranchName ? (
                        <span>
                            Showing rooms for <span className="font-medium text-foreground">{activeBranchName}</span>
                            <span className="ml-1 text-xs">— change via the branch selector in the top navigation.</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-amber-600">
                            <AlertCircle className="w-4 h-4" /> No branch selected — pick one in the navbar to see rooms.
                        </span>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : rooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                        <DoorOpen className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <h3 className="text-xl font-bold mb-2">No therapy rooms registered</h3>
                        <p className="text-muted-foreground max-w-sm mb-6">Register every therapy room so scheduling can validate availability against real capacity.</p>
                        <Button onClick={() => open()}><Plus className="w-4 h-4 mr-2" /> Register First Room</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rooms.map((room) => (
                            <Panel key={room.id} title={room.name} className="group hover:shadow-elevated transition-all">
                                <div className="space-y-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary">{TYPE_LABEL[room.type]}</Badge>
                                        <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" /> capacity {room.capacity}</Badge>
                                        {!room.isActive && <Badge variant="destructive">Inactive</Badge>}
                                    </div>
                                    {room.notes && <p className="text-sm text-muted-foreground italic">{room.notes}</p>}
                                    <div className="text-xs text-muted-foreground">
                                        {room._count?.bookings ?? 0} bookings total
                                    </div>
                                    <div className="flex justify-end gap-2 pt-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                        <Button variant="secondary" size="sm" onClick={() => open(room)}><Edit2 className="w-3.5 h-3.5 mr-2" /> Edit</Button>
                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deactivate(room)}>
                                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Deactivate
                                        </Button>
                                    </div>
                                </div>
                            </Panel>
                        ))}
                    </div>
                )}

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{editing ? "Edit Therapy Room" : "Register Therapy Room"}</DialogTitle>
                            <DialogDescription>Rooms are booked atomically alongside therapist time slots.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} className="space-y-5 py-4">
                            <div className="space-y-2">
                                <Label>Room name</Label>
                                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Shirodhara Room 1" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as TherapyRoomType })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {ROOM_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Capacity</Label>
                                    <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit">{editing ? "Save Changes" : "Register Room"}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                {confirmDialog}
            </div>
        </AppLayout>
    );
}
