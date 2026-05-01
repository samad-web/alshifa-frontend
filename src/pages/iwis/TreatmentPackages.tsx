import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Package, Loader2, Building2, Users, Calendar, IndianRupee, Edit2, Trash2, ClipboardList } from "lucide-react";
import { iwisApi, type TreatmentPackage, type PackageEnrolment } from "@/services/iwis.service";
import { branchesApi } from "@/services/branches.service";
import { apiClient } from "@/lib/api-client";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";

type ComponentRow = { type: string; description: string; quantity: number };

// GST slabs the form exposes — matches the standard Indian GST rates so admins
// don't fat-finger an arbitrary number into a tax field.
const GST_SLABS = [0, 5, 12, 18, 28] as const;

export default function TreatmentPackagesPage() {
    const { toast } = useToast();
    const { confirm, dialog: confirmDialog } = useConfirm();
    const { role } = useAuth();
    // Package authoring is admin-only. DOCTOR can view + enrol patients but
    // not create / edit / deactivate templates. Backend enforces the same;
    // hiding the UI prevents the visible-but-403 footgun.
    const canManagePackages = role === "ADMIN" || role === "ADMIN_DOCTOR";
    // Admins (ADMIN, ADMIN_DOCTOR) drive scope from the navbar selector —
    // when "All Branches" is picked we fan out across the hospital and show
    // a branch label on every package card. DOCTOR / THERAPIST don't see
    // the navbar switcher so they fall back to the first branch.
    const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
    const { branchIdParam } = useBranchScope();
    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
    // Concrete branch the page is currently displaying. Stays "" in the
    // admin "All Branches" view; non-admins fall back to the first branch.
    const [branchId, setBranchId] = useState("");
    const isCrossBranch = isAdmin && !branchIdParam;
    const [packages, setPackages] = useState<TreatmentPackage[]>([]);
    const [loading, setLoading] = useState(false);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [enrolOpen, setEnrolOpen] = useState<string | null>(null);
    const [editing, setEditing] = useState<TreatmentPackage | null>(null);
    const [form, setForm] = useState({
        branchId: "", name: "", description: "", durationDays: "21", price: "0", taxPercent: "0",
    });
    const [components, setComponents] = useState<ComponentRow[]>([
        { type: "APPOINTMENT", description: "Daily Abhyanga", quantity: 21 },
    ]);

    const [patients, setPatients] = useState<Array<{ id: string; fullName: string | null }>>([]);
    const [enrol, setEnrol] = useState({ patientId: "", sessionsTotal: "21", startDate: new Date().toISOString().slice(0, 10), notes: "" });

    useEffect(() => {
        branchesApi.list().then(setBranches).catch(() => setBranches([]));
    }, []);

    // React to the global branch selector. Admins respect "All Branches"
    // (branchId stays "" and the list endpoint returns the cross-branch
    // view scoped server-side to the user's hospital). Non-admins are
    // pinned to the first branch in their list because they don't see the
    // navbar switcher.
    useEffect(() => {
        if (branchIdParam) { setBranchId(branchIdParam); return; }
        if (isAdmin) { setBranchId(""); return; }
        if (branches[0] && !branchId) setBranchId(branches[0].id);
    }, [branchIdParam, branches, branchId, isAdmin]);

    // Patient list is scoped to the active branch so the enrol dropdown only
    // shows patients that belong to the package's branch.
    useEffect(() => {
        const params = branchId ? { branchId } : undefined;
        apiClient.get<Array<{ id: string; fullName: string | null }>>("/api/user/list-patients", params)
            .then(({ data }) => setPatients(data)).catch(() => setPatients([]));
    }, [branchId]);

    const reload = useCallback(async () => {
        // Admin cross-branch mode: branchId is "" — backend returns every
        // branch in the hospital. Non-admin: wait for first branch.
        if (!branchId && !isAdmin) return;
        setLoading(true);
        try { setPackages(await iwisApi.listPackages(branchId || undefined)); } finally { setLoading(false); }
    }, [branchId, isAdmin]);

    useEffect(() => { reload(); }, [reload]);

    const open = (pkg: TreatmentPackage | null = null) => {
        if (pkg) {
            setEditing(pkg);
            setForm({
                branchId: pkg.branchId,
                name: pkg.name, description: pkg.description || "",
                durationDays: String(pkg.durationDays),
                price: String(pkg.price), taxPercent: String(pkg.taxPercent || 0),
            });
            setComponents(pkg.components || []);
        } else {
            setEditing(null);
            // Default the form's branchId to the active page scope. In the
            // admin cross-branch view this stays "" so the dialog forces
            // the admin to commit to a target branch before saving.
            setForm({ branchId: branchId || "", name: "", description: "", durationDays: "21", price: "0", taxPercent: "0" });
            setComponents([{ type: "APPOINTMENT", description: "", quantity: 1 }]);
        }
        setDialogOpen(true);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetBranchId = form.branchId || branchId;
        if (!targetBranchId) {
            toast({ title: "Pick a branch", description: "Choose a branch for this package.", variant: "destructive" });
            return;
        }
        try {
            const payload = {
                branchId: targetBranchId,
                name: form.name, description: form.description || undefined,
                durationDays: Number(form.durationDays),
                price: Number(form.price), taxPercent: Number(form.taxPercent),
                components,
            };
            if (editing) await iwisApi.updatePackage(editing.id, payload);
            else await iwisApi.createPackage(payload);
            toast({ title: editing ? "Package updated" : "Package created" });
            setDialogOpen(false); reload();
        } catch (err: unknown) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
        }
    };

    const submitEnrol = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!enrolOpen || !enrol.patientId) return;
        try {
            await iwisApi.enrolInPackage(enrolOpen, {
                patientId: enrol.patientId,
                sessionsTotal: Number(enrol.sessionsTotal),
                startDate: enrol.startDate,
                notes: enrol.notes || undefined,
            });
            toast({ title: "Patient enrolled — invoice auto-generated" });
            setEnrolOpen(null);
            setEnrol({ patientId: "", sessionsTotal: "21", startDate: new Date().toISOString().slice(0, 10), notes: "" });
        } catch (err: unknown) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "Enrolment failed", variant: "destructive" });
        }
    };

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
                <PageHeader title="Treatment Packages" subtitle="Bundle appointments, medicines, meals and rooms into fixed-price programmes">
                    {canManagePackages && (
                        <Button onClick={() => open()}><Plus className="w-4 h-4 mr-2" /> Create Package</Button>
                    )}
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
                    <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                ) : packages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                        <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground mb-4">No treatment packages defined yet.</p>
                        {canManagePackages && (
                            <Button onClick={() => open()}><Plus className="w-4 h-4 mr-2" /> Create first package</Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {packages.map((pkg) => (
                            <Panel key={pkg.id} title={pkg.name} className="group hover:shadow-elevated transition-all">
                                <div className="space-y-4">
                                    {/* Branch label only matters in cross-branch mode — when
                                        a single branch is scoped, every card belongs to it. */}
                                    {isCrossBranch && pkg.branch?.name && (
                                        <Badge variant="outline" className="gap-1 text-[11px]">
                                            <Building2 className="w-3 h-3" /> {pkg.branch.name}
                                        </Badge>
                                    )}
                                    {pkg.description && <p className="text-sm text-muted-foreground">{pkg.description}</p>}
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-primary/70" /> {pkg.durationDays} days</div>
                                        <div className="flex items-center gap-2"><IndianRupee className="w-4 h-4 text-primary/70" /> ₹{pkg.price.toLocaleString()}</div>
                                        <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary/70" /> {pkg._count?.enrolments ?? 0} enrolled</div>
                                    </div>
                                    {pkg.components && pkg.components.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Includes</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {pkg.components.map((c, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[11px]">{c.quantity}× {c.description || c.type}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex justify-end gap-2 pt-2">
                                        <Button variant="outline" size="sm" onClick={() => setEnrolOpen(pkg.id)}><ClipboardList className="w-3.5 h-3.5 mr-2" /> Enrol</Button>
                                        {canManagePackages && (
                                            <>
                                                <Button variant="secondary" size="sm" onClick={() => open(pkg)}><Edit2 className="w-3.5 h-3.5 mr-2" /> Edit</Button>
                                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={async () => {
                                                            const ok = await confirm({
                                                                title: "Deactivate package?",
                                                                description: `"${pkg.name}" will no longer be available for new enrolments. Existing enrolments are unaffected.`,
                                                                confirmLabel: "Deactivate",
                                                                tone: "danger",
                                                            });
                                                            if (!ok) return;
                                                            await iwisApi.deactivatePackage(pkg.id);
                                                            reload();
                                                        }}>
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Panel>
                        ))}
                    </div>
                )}

                {/* Create / Edit dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editing ? "Edit Package" : "Create Treatment Package"}</DialogTitle>
                            <DialogDescription>Define a bundled programme with a fixed price and per-session tracking.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} className="space-y-4 py-4">
                            {/* Branch picker shown only in admin "All Branches" mode —
                                when a branch is already pinned via the navbar, the
                                page-level scope is committed and the field would just
                                duplicate it. */}
                            {!branchId && (
                                <div className="space-y-2">
                                    <Label>Branch</Label>
                                    <Select
                                        value={form.branchId}
                                        onValueChange={(v) => setForm({ ...form, branchId: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a branch" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {branches.map((b) => (
                                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="21-Day Panchakarma Rejuvenation" />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Duration (days)</Label>
                                    <Input type="number" min={1} value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Price (₹)</Label>
                                    <Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>GST slab</Label>
                                <RadioGroup
                                    value={form.taxPercent}
                                    onValueChange={(v) => setForm({ ...form, taxPercent: v })}
                                    className="flex flex-wrap gap-2"
                                >
                                    {GST_SLABS.map((slab) => {
                                        const v = String(slab);
                                        const checked = form.taxPercent === v;
                                        return (
                                            <Label
                                                key={slab}
                                                htmlFor={`gst-${slab}`}
                                                className={`flex items-center gap-2 cursor-pointer rounded-full border px-4 py-2 text-sm transition-all ${
                                                    checked
                                                        ? "border-primary bg-primary/10 text-primary font-semibold"
                                                        : "border-border/60 hover:border-border bg-background"
                                                }`}
                                            >
                                                <RadioGroupItem value={v} id={`gst-${slab}`} className="sr-only" />
                                                {slab}% GST
                                            </Label>
                                        );
                                    })}
                                </RadioGroup>
                            </div>

                            <div className="space-y-3 pt-2 border-t border-border/40">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Components</Label>
                                    <Button type="button" size="sm" variant="ghost"
                                            onClick={() => setComponents([...components, { type: "APPOINTMENT", description: "", quantity: 1 }])}>
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                                    </Button>
                                </div>
                                {components.map((c, i) => (
                                    <div key={i} className="grid grid-cols-[140px_1fr_100px_auto] gap-2">
                                        <Select value={c.type} onValueChange={(v) => { const nc = [...components]; nc[i].type = v; setComponents(nc); }}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="APPOINTMENT">Appointment</SelectItem>
                                                <SelectItem value="THERAPY">Therapy</SelectItem>
                                                <SelectItem value="MEDICINE">Medicine</SelectItem>
                                                <SelectItem value="MEAL">Meal</SelectItem>
                                                <SelectItem value="ROOM">Room</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Input placeholder="Description" value={c.description}
                                               onChange={(e) => { const nc = [...components]; nc[i].description = e.target.value; setComponents(nc); }} />
                                        <Input type="number" min={1} value={c.quantity}
                                               onChange={(e) => { const nc = [...components]; nc[i].quantity = Number(e.target.value); setComponents(nc); }} />
                                        <Button type="button" variant="ghost" size="sm"
                                                onClick={() => setComponents(components.filter((_, idx) => idx !== i))}>×</Button>
                                    </div>
                                ))}
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit">{editing ? "Save Changes" : "Create Package"}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Enrol dialog */}
                <Dialog open={!!enrolOpen} onOpenChange={(o) => !o && setEnrolOpen(null)}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Enrol Patient</DialogTitle>
                            <DialogDescription>An invoice is auto-generated at the package price. Session usage is tracked separately.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitEnrol} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Patient</Label>
                                <Select value={enrol.patientId} onValueChange={(v) => setEnrol({ ...enrol, patientId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                                    <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName || "Unnamed"}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start date</Label>
                                    <DatePicker value={enrol.startDate} onChange={(iso) => setEnrol({ ...enrol, startDate: iso })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Total sessions</Label>
                                    <Input type="number" min={0} value={enrol.sessionsTotal} onChange={(e) => setEnrol({ ...enrol, sessionsTotal: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea rows={2} value={enrol.notes} onChange={(e) => setEnrol({ ...enrol, notes: e.target.value })} />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setEnrolOpen(null)}>Cancel</Button>
                                <Button type="submit">Enrol & Invoice</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {confirmDialog}
            </div>
        </AppLayout>
    );
}

// Patient-facing enrolment card (used on PatientPortal)
export function PackageEnrolmentCard({ enrolment }: { enrolment: PackageEnrolment }) {
    const total = enrolment.sessionsTotal || 1;
    const used = enrolment.sessionsUsed;
    const pct = Math.round((used / total) * 100);
    const daysLeft = Math.max(0, Math.ceil((+new Date(enrolment.endDate) - Date.now()) / (1000 * 60 * 60 * 24)));
    return (
        <Panel title={enrolment.package?.name || "Package"}>
            <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span>Sessions used</span>
                    <span className="font-bold">{used} / {total}</span>
                </div>
                <Progress value={pct} />
                <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{daysLeft} days remaining</span>
                    <Badge variant={enrolment.status === 'ACTIVE' ? 'default' : 'secondary'}>{enrolment.status}</Badge>
                </div>
            </div>
        </Panel>
    );
}
