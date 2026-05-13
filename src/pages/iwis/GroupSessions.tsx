import { useEffect, useMemo, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Users, Loader2, Calendar, Clock, DoorOpen, Building2, CheckCircle2, UserPlus, Check, ChevronsUpDown, X, Play } from "lucide-react";
import { iwisApi, type GroupSession, type TherapyRoom } from "@/services/iwis.service";
import { branchesApi } from "@/services/branches.service";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface PatientLite { id: string; fullName: string | null; phoneNumber?: string | null }

const STATUS_TONE: Record<string, string> = {
    OPEN: "bg-wellness/10 text-wellness border-wellness/30",
    FULL: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    COMPLETED: "bg-muted text-muted-foreground",
    CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function GroupSessionsPage() {
    const { toast } = useToast();
    const { role } = useAuth();
    const navigate = useNavigate();
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
    // Multi-patient picker state for the New Session form. Patients are
    // bulk-enrolled at create time so the clinician doesn't have to chase
    // them down to "Join" individually afterwards.
    const [allPatients, setAllPatients] = useState<PatientLite[]>([]);
    const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        branchesApi.list().then(setBranches).catch(() => setBranches([]));
        apiClient.get<Array<{ id: string; fullName: string | null }>>("/api/user/list-therapists")
            .then(({ data }) => setTherapists(data)).catch(() => {});
    }, []);

    // Load patient roster scoped to the active branch — keeps the picker tight
    // for branch admins / therapists working on a single clinic.
    useEffect(() => {
        const params = branchId ? { branchId } : undefined;
        apiClient.get<PatientLite[]>("/api/user/list-patients", params)
            .then(({ data }) => setAllPatients(Array.isArray(data) ? data : []))
            .catch(() => setAllPatients([]));
    }, [branchId]);

    const selectedPatients = useMemo(
        () => selectedPatientIds.map((id) => allPatients.find((p) => p.id === id)).filter((p): p is PatientLite => !!p),
        [selectedPatientIds, allPatients],
    );
    const togglePatient = (id: string) => {
        setSelectedPatientIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    };

    // Admins (ADMIN, ADMIN_DOCTOR) drive scope from the navbar selector —
    // when "All Branches" is picked we fan out across the hospital. DOCTOR
    // / THERAPIST don't see the navbar switcher so they fall back to the
    // first branch in their list.
    const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
    const isCrossBranch = isAdmin && !branchIdParam;
    useEffect(() => {
        if (branchIdParam) { setBranchId(branchIdParam); return; }
        if (isAdmin) { setBranchId(""); return; }
        if (branches[0] && !branchId) setBranchId(branches[0].id);
    }, [branchIdParam, branches, branchId, isAdmin]);

    // Track room loading so the New Session dialog can render a skeleton
    // hint instead of a confusing empty dropdown.
    const [roomsLoading, setRoomsLoading] = useState(false);
    useEffect(() => {
        // For branch-pinned roles we wait for branchId to resolve. ADMIN /
        // ADMIN_DOCTOR cross-branch view passes branchId=undefined and the
        // backend falls back to hospital scope — without this fanout admin
        // doctors saw an empty rooms dropdown even when rooms existed.
        if (!isAdmin && !branchId) { setRooms([]); return; }
        setRoomsLoading(true);
        iwisApi.listRooms(branchId || undefined)
            .then((list) => setRooms(Array.isArray(list) ? list : []))
            .catch(() => setRooms([]))
            .finally(() => setRoomsLoading(false));
    }, [branchId, isAdmin]);

    const reload = useCallback(async () => {
        if (!branchId && !isAdmin) return;
        setLoading(true);
        try { setSessions(await iwisApi.listGroupSessions({ branchId: branchId || undefined })); } finally { setLoading(false); }
    }, [branchId, isAdmin]);

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
                patientIds: selectedPatientIds.length > 0 ? selectedPatientIds : undefined,
            });
            toast({
                title: selectedPatientIds.length > 0
                    ? `Group session scheduled with ${selectedPatientIds.length} patient${selectedPatientIds.length === 1 ? "" : "s"} pre-enrolled`
                    : "Group session scheduled",
            });
            setDialogOpen(false);
            setSelectedPatientIds([]);
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
                    {isCrossBranch ? (
                        <>
                            Branch: <span className="font-semibold text-foreground">All branches</span>
                            <span className="text-xs">(narrow via navbar)</span>
                        </>
                    ) : (
                        <>
                            Branch: <span className="font-semibold text-foreground">
                                {branches.find((b) => b.id === branchId)?.name || "—"}
                            </span>
                            <span className="text-xs">(switch via navbar)</span>
                        </>
                    )}
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
                                        {/* Clinician shortcut into the session workspace — opens the
                                            roster + complete view. Hidden once the session is locked. */}
                                        {isClinician && s.status !== "COMPLETED" && s.status !== "CANCELLED" && (
                                            <Button
                                                size="sm"
                                                onClick={() => navigate(`/group-sessions/${s.id}/workspace`)}
                                                className="bg-primary hover:bg-primary/90"
                                            >
                                                <Play className="w-3.5 h-3.5 mr-2" /> Join Session
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
                                    <DatePicker value={form.date} onChange={(iso) => setForm({ ...form, date: iso })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Start</Label>
                                    <TimePicker value={form.startTime} onChange={(hhmm) => setForm({ ...form, startTime: hhmm })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End</Label>
                                    <TimePicker value={form.endTime} onChange={(hhmm) => setForm({ ...form, endTime: hhmm })} />
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
                                    <SelectTrigger>
                                        <SelectValue placeholder={roomsLoading ? "Loading rooms…" : "No room assigned"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">No room</SelectItem>
                                        {roomsLoading && (
                                            <div className="px-2 py-1.5 text-xs text-muted-foreground italic">Loading rooms…</div>
                                        )}
                                        {!roomsLoading && rooms.length === 0 && (
                                            <div className="px-2 py-1.5 text-xs text-muted-foreground italic">
                                                No therapy rooms found. Create rooms in Therapy Rooms.
                                            </div>
                                        )}
                                        {rooms.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.name} <span className="text-muted-foreground">— {r.type} (Cap: {r.capacity})</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Multi-patient picker — combobox with chips below.
                                Selected items toggle on click without closing the
                                dropdown so adding several in a row stays fast. */}
                            <div className="space-y-2">
                                <Label>Pre-enrol patients (optional)</Label>
                                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={pickerOpen}
                                            className="w-full justify-between font-normal"
                                        >
                                            <span className="flex items-center gap-2 truncate">
                                                <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                                <span className="truncate">
                                                    {selectedPatientIds.length === 0
                                                        ? "Search patients to add…"
                                                        : `${selectedPatientIds.length} selected — click to add more`}
                                                </span>
                                            </span>
                                            <ChevronsUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                        <Command
                                            filter={(itemValue, search) =>
                                                itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                                            }
                                        >
                                            <CommandInput placeholder="Search by name or phone…" />
                                            <CommandList>
                                                <CommandEmpty>No patients match.</CommandEmpty>
                                                <CommandGroup>
                                                    {allPatients.map((p) => {
                                                        const haystack = [p.fullName ?? "", p.phoneNumber ?? "", p.id].join(" ");
                                                        const checked = selectedPatientIds.includes(p.id);
                                                        return (
                                                            <CommandItem
                                                                key={p.id}
                                                                value={haystack}
                                                                onSelect={() => togglePatient(p.id)}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm">{p.fullName || "Unnamed"}</span>
                                                                    {p.phoneNumber && (
                                                                        <span className="text-xs text-muted-foreground">{p.phoneNumber}</span>
                                                                    )}
                                                                </div>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>

                                {selectedPatients.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {selectedPatients.map((p) => (
                                            <Badge key={p.id} variant="secondary" className="gap-1.5 pl-2 pr-1 py-1">
                                                <span>{p.fullName || "Unnamed"}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => togglePatient(p.id)}
                                                    aria-label={`Remove ${p.fullName || "patient"}`}
                                                    className="rounded-sm hover:bg-muted-foreground/20 p-0.5"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {selectedPatientIds.length > Number(form.maxCapacity || 0) && (
                                    <p className="text-[11px] text-amber-700">
                                        {selectedPatientIds.length} selected exceeds capacity ({form.maxCapacity}). Only the first {form.maxCapacity} will be enrolled.
                                    </p>
                                )}
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
