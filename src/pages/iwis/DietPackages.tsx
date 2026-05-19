import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
    Plus, Salad, Loader2, CheckCircle2, Archive as ArchiveIcon,
    Send, UserPlus, Pencil, Utensils, AlertTriangle, Info, ChevronDown,
} from "lucide-react";
import {
    iwisApi,
    type DietPackage, type DoshaType, type DietCategory,
    type MealTime, type DietMealPlan, type DietAssignContext,
} from "@/services/iwis.service";
import { useAuth } from "@/hooks/useAuth";
import { GroupedByBranch } from "@/components/common/GroupedByBranch";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PatientPicker } from "@/components/clinical/PatientPicker";
import { DatePicker } from "@/components/ui/date-picker";
import { fmtDate, fmtShortDate } from "@/lib/format-date";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useConfirm } from "@/components/common/ConfirmDialog";

function patientBranchId(p: any): string | null {
    return p?.branchId ?? p?.user?.branchId ?? null;
}
function packageCreatorBranchId(p: any): string | null {
    return p?.branchId
        ?? p?.createdBy?.branchId
        ?? p?.createdBy?.doctor?.branchId
        ?? null;
}
function packageCreatorBranchName(p: any): string | null {
    return p?.branch?.name
        ?? p?.createdBy?.branch?.name
        ?? p?.createdBy?.doctor?.branch?.name
        ?? null;
}

const MEAL_TIMES: MealTime[] = ["MORNING_EMPTY", "BREAKFAST", "MID_MORNING", "LUNCH", "EVENING", "DINNER", "BEDTIME"];
const MEAL_LABEL: Record<MealTime, string> = {
    MORNING_EMPTY: "Morning (empty stomach)",
    BREAKFAST: "Breakfast",
    MID_MORNING: "Mid-morning",
    LUNCH: "Lunch",
    EVENING: "Evening",
    DINNER: "Dinner",
    BEDTIME: "Bedtime",
};
const DOSHAS: DoshaType[] = ["VATA", "PITTA", "KAPHA", "TRIDOSHA"];
const CATEGORIES: DietCategory[] = ["SATTVIC", "RAJASIC", "TAMASIC"];

type MealRow = { mealTime: MealTime; foods: string; avoidFoods: string; instructions: string };

const parseFoods = (s: string) =>
    s.split(/[,\n]/).map((f) => f.trim()).filter(Boolean).map((name) => ({ name }));

const foodsToText = (arr: DietMealPlan["foods"] | DietMealPlan["avoidFoods"] | undefined) =>
    (arr || []).map((f) => f.name).join(", ");

const blankMeal = (mealTime: MealTime = "BREAKFAST"): MealRow =>
    ({ mealTime, foods: "", avoidFoods: "", instructions: "" });

const initialForm = {
    title: "", description: "",
    doshaTarget: "VATA" as DoshaType, category: "SATTVIC" as DietCategory,
    // Sensible default: 7 days. The form should never submit with a null or
    // zero duration — the backend min is 1 but defaulting to 7 matches a
    // typical short-course Pathya plan.
    durationDays: 7, notes: "",
};

interface DietPackagesPageProps {
    /** Render without AppLayout + outer PageHeader chrome. Used when the
     *  packages list is embedded as a tab inside the combined Diet Plans &
     *  Packages page. Defaults to false → standalone render. */
    embedded?: boolean;
}

export default function DietPackagesPage({ embedded = false }: DietPackagesPageProps = {}) {
    const { toast } = useToast();
    const { user, role } = useAuth();
    // Role matrix (after retiring the approval workflow):
    //   ADMIN / ADMIN_DOCTOR / DOCTOR / THERAPIST → create + edit own packages.
    //     Backend marks every new package APPROVED immediately, so there is no
    //     longer a pending/rejected lifecycle to surface here.
    //   DOCTOR / ADMIN_DOCTOR → can assign packages to patients.
    //   ADMIN / ADMIN_DOCTOR  → can archive any package (still useful: hides
    //     stale templates from the assignment dropdown).
    const isCreator    = role === "DOCTOR" || role === "THERAPIST" || role === "ADMIN_DOCTOR" || role === "ADMIN";
    const canAssign    = role === "DOCTOR" || role === "ADMIN_DOCTOR";
    const canArchive   = role === "ADMIN"  || role === "ADMIN_DOCTOR";
    const isAdmin      = role === "ADMIN"  || role === "ADMIN_DOCTOR";
    const { isAll, branchIdParam } = useBranchScope();
    const { confirm, dialog: confirmDialog } = useConfirm();

    const [packages, setPackages] = useState<DietPackage[]>([]);
    const [loading, setLoading] = useState(true);

    // Create/edit dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(initialForm);
    const [meals, setMeals] = useState<MealRow[]>([blankMeal()]);

    // Assign dialog
    const [assignPkg, setAssignPkg] = useState<DietPackage | null>(null);
    const [patients, setPatients] = useState<Array<{ id: string; fullName: string | null }>>([]);
    const [assignForm, setAssignForm] = useState({
        patientId: "", startDate: new Date().toISOString().slice(0, 10),
        // Default to 7 days; once a package is selected, openAssign() syncs
        // this to the package's own durationDays so the form pre-fills with
        // the curated value rather than this fallback.
        durationDays: 7, notes: "",
    });
    const [assigning, setAssigning] = useState(false);
    const [assignContext, setAssignContext] = useState<DietAssignContext | null>(null);
    const [contextLoading, setContextLoading] = useState(false);
    const [mealsExpanded, setMealsExpanded] = useState(false);
    const [conflicts, setConflicts] = useState<Array<{ id: string; title: string; startDate: string; endDate: string | null }> | null>(null);

    const refresh = async () => {
        setLoading(true);
        try {
            // No status filter — approval was retired, so the list is just
            // every package the caller is allowed to see (backend handles
            // creator-scope vs admin-scope).
            const list = await iwisApi.listDietPackages();
            setPackages(list);
        } catch (err: unknown) {
            toast({ title: "Failed to load packages", description: err instanceof Error ? err.message : "", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

    useEffect(() => {
        apiClient.get<Array<{ id: string; fullName: string | null }>>("/api/user/list-patients")
            .then(({ data }) => setPatients(data))
            .catch(() => {});
    }, []);

    const openCreate = () => {
        setEditingId(null);
        setForm(initialForm);
        setMeals([blankMeal()]);
        setDialogOpen(true);
    };

    const openEdit = async (pkg: DietPackage) => {
        const full = pkg.meals ? pkg : await iwisApi.getDietPackage(pkg.id);
        setEditingId(pkg.id);
        setForm({
            title: full.title,
            description: full.description || "",
            doshaTarget: full.doshaTarget,
            category: full.category,
            durationDays: full.durationDays,
            notes: full.notes || "",
        });
        setMeals((full.meals || []).length
            ? (full.meals || []).map((m) => ({
                mealTime: m.mealTime,
                foods: foodsToText(m.foods),
                avoidFoods: foodsToText(m.avoidFoods),
                instructions: m.instructions || "",
            }))
            : [blankMeal()]);
        setDialogOpen(true);
    };

    const addMeal = () => setMeals([...meals, blankMeal("LUNCH")]);
    const removeMeal = (i: number) => setMeals(meals.filter((_, idx) => idx !== i));

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Client-side guards: surface specific reasons before hitting the
        // backend so the doctor doesn't see a generic "validation failed"
        // toast for a field they can immediately fix.
        if (!form.title.trim()) {
            toast({ title: "Title required", description: "Give the package a short title.", variant: "destructive" });
            return;
        }
        const dur = Number(form.durationDays);
        if (!Number.isFinite(dur) || dur < 1 || dur > 365) {
            toast({ title: "Default duration required", description: "Default duration must be between 1 and 365 days.", variant: "destructive" });
            return;
        }
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description || undefined,
                doshaTarget: form.doshaTarget,
                category: form.category,
                durationDays: dur,
                notes: form.notes || undefined,
                meals: meals.map((m): DietMealPlan => ({
                    mealTime: m.mealTime,
                    foods: parseFoods(m.foods),
                    avoidFoods: parseFoods(m.avoidFoods),
                    instructions: m.instructions || undefined,
                })),
            };
            if (editingId) {
                await iwisApi.updateDietPackage(editingId, payload);
                toast({
                    title: "Package updated",
                    description: "Changes are live immediately and can be assigned to patients.",
                });
            } else {
                await iwisApi.createDietPackage(payload);
                toast({
                    title: "Diet package created",
                    description: "Ready to assign to patients — no approval needed.",
                });
            }
            setDialogOpen(false);
            refresh();
        } catch (err: unknown) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
        }
    };

    const archive = async (id: string) => {
        const ok = await confirm({
            title: "Archive this package?",
            description: "It will be hidden from the list and can no longer be assigned to new patients. Existing assignments are unaffected.",
            confirmLabel: "Archive",
            tone: "danger",
        });
        if (!ok) return;
        try {
            await iwisApi.archiveDietPackage(id);
            toast({ title: "Package archived" });
            refresh();
        } catch (err: unknown) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" });
        }
    };

    const openAssign = (pkg: DietPackage) => {
        setAssignPkg(pkg);
        setAssignForm({
            patientId: "",
            startDate: new Date().toISOString().slice(0, 10),
            durationDays: pkg.durationDays,
            notes: "",
        });
        setAssignContext(null);
        setMealsExpanded(false);
        setConflicts(null);
    };

    // Fetch patient-specific context every time a patient is picked — gives us
    // dosha fit + existing active diets before the doctor commits.
    useEffect(() => {
        if (!assignPkg || !assignForm.patientId) { setAssignContext(null); return; }
        let cancelled = false;
        setContextLoading(true);
        iwisApi.getDietAssignContext(assignPkg.id, assignForm.patientId)
            .then((ctx) => { if (!cancelled) setAssignContext(ctx); })
            .catch(() => { if (!cancelled) setAssignContext(null); })
            .finally(() => { if (!cancelled) setContextLoading(false); });
        return () => { cancelled = true; };
    }, [assignPkg, assignForm.patientId]);

    // Live "ends on" — derived from startDate + durationDays.
    const computedEndDate = useMemo(() => {
        if (!assignForm.startDate || !assignForm.durationDays) return null;
        const d = new Date(assignForm.startDate);
        if (isNaN(d.getTime())) return null;
        d.setDate(d.getDate() + Number(assignForm.durationDays));
        return d;
    }, [assignForm.startDate, assignForm.durationDays]);

    const runAssign = async (deactivateExisting: boolean) => {
        if (!assignPkg || !assignForm.patientId) return;
        setAssigning(true);
        try {
            await iwisApi.assignDietPackage(assignPkg.id, {
                patientId: assignForm.patientId,
                startDate: assignForm.startDate,
                durationDays: Number(assignForm.durationDays),
                notes: assignForm.notes || undefined,
                deactivateExisting,
            });
            toast({
                title: "Assigned to patient",
                description: deactivateExisting
                    ? "Previous active diet was deactivated."
                    : "Patient has been notified.",
            });
            setAssignPkg(null);
            setConflicts(null);
            refresh();
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.code === 'ACTIVE_DIET_CONFLICT') {
                const payload = err.payload as { conflicts?: typeof conflicts } | undefined;
                setConflicts(payload?.conflicts ?? []);
            } else {
                toast({ title: "Error", description: err instanceof Error ? err.message : "Assign failed", variant: "destructive" });
            }
        } finally {
            setAssigning(false);
        }
    };

    const submitAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        await runAssign(false);
    };

    const bodyWrapperClass = embedded
        ? "space-y-8"
        : "container max-w-6xl mx-auto px-4 py-8 space-y-8";

    const inner = (
        <div className={bodyWrapperClass}>
                {!embedded && (
                <PageHeader
                    title="Diet Packages"
                    subtitle="Reusable Pathya-Apathya templates. Create and assign to patients directly — no approval needed."
                >
                    {isCreator && (
                        <Button onClick={openCreate}>
                            <Plus className="w-4 h-4 mr-2" /> New Package
                        </Button>
                    )}
                </PageHeader>
                )}
                {embedded && isCreator && (
                    <div className="flex justify-end">
                        <Button onClick={openCreate}>
                            <Plus className="w-4 h-4 mr-2" /> New Package
                        </Button>
                    </div>
                )}

                {(() => {
                    const scopedPackages = branchIdParam
                        ? packages.filter((p) => packageCreatorBranchId(p) === branchIdParam)
                        : packages;
                    if (loading) {
                        return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>;
                    }
                    if (scopedPackages.length === 0) {
                        return (
                            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                                <Salad className="w-12 h-12 text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground mb-4">No diet packages yet.</p>
                                {isCreator && (
                                    <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" /> Create your first package</Button>
                                )}
                            </div>
                        );
                    }
                    // Per-card render. The approval status badge / "What to
                    // fix" rejection block / approval-notes block were all
                    // removed when the admin-approval workflow was retired —
                    // every new package is live the moment it's created.
                    // Archived packages are still flagged so admins know
                    // why they no longer appear in the assignment dropdown.
                    const renderPackageCard = (p: DietPackage) => (
                            <Panel key={p.id} title={p.title}>
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary">Dosha: {p.doshaTarget}</Badge>
                                        <Badge variant="outline">{p.category}</Badge>
                                        <Badge variant="outline">{p.durationDays} days</Badge>
                                        {p.status === "ARCHIVED" && (
                                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                                                <ArchiveIcon className="w-3 h-3 mr-1" /> Archived
                                            </Badge>
                                        )}
                                    </div>

                                    {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}

                                    <div className="text-xs text-muted-foreground">
                                        By {p.createdBy?.doctor?.fullName || p.createdBy?.email || "—"}
                                        {p._count?.prescriptions ? ` · Assigned to ${p._count.prescriptions} patient(s)` : ""}
                                    </div>

                                    {/* Meal preview (first 3) */}
                                    {p.meals && p.meals.length > 0 && (
                                        <div className="text-xs text-muted-foreground pt-2 border-t border-border/40">
                                            {p.meals.slice(0, 3).map((m) => (
                                                <div key={m.mealTime}>
                                                    <span className="font-medium">{MEAL_LABEL[m.mealTime]}:</span>{" "}
                                                    {foodsToText(m.foods) || "—"}
                                                </div>
                                            ))}
                                            {p.meals.length > 3 && <div className="italic">+{p.meals.length - 3} more meals</div>}
                                        </div>
                                    )}

                                    {/* Action row */}
                                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
                                        {/* Clinician can assign a live package to a patient */}
                                        {canAssign && p.status !== "ARCHIVED" && p.isActive && (
                                            <Button size="sm" variant="default" onClick={() => openAssign(p)}>
                                                <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign
                                            </Button>
                                        )}

                                        {/* Author can edit their own package while it's not archived.
                                            Approval-state gating is gone — anything live is editable. */}
                                        {isCreator && p.createdById === user?.id && p.status !== "ARCHIVED" && (
                                            <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                                                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                                            </Button>
                                        )}

                                        {canArchive && p.status !== "ARCHIVED" && (
                                            <Button size="sm" variant="ghost" onClick={() => archive(p.id)}>
                                                <ArchiveIcon className="w-3.5 h-3.5 mr-1" /> Archive
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Panel>
                    );
                    if (isAdmin && isAll) {
                        return (
                            <GroupedByBranch
                                items={scopedPackages}
                                getBranchId={packageCreatorBranchId}
                                getBranchName={packageCreatorBranchName}
                                renderItem={renderPackageCard}
                            />
                        );
                    }
                    return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {scopedPackages.map(renderPackageCard)}
                        </div>
                    );
                })()}

                {/* Create / Edit dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Edit Diet Package" : "New Diet Package"}</DialogTitle>
                            <DialogDescription>
                                {editingId
                                    ? "Changes go live immediately for any future assignments. Existing patient prescriptions are unaffected."
                                    : "The package is published immediately and can be assigned to patients right away."}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} className="space-y-5 py-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VATA Pacification — 4 weeks" />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short summary shown on the card" />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Dosha target</Label>
                                    <Select value={form.doshaTarget} onValueChange={(v) => setForm({ ...form, doshaTarget: v as DoshaType })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{DOSHAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as DietCategory })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Default duration (days)</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={form.durationDays === 0 ? "" : form.durationDays}
                                        onChange={(e) => {
                                            const n = e.target.valueAsNumber;
                                            setForm({ ...form, durationDays: Number.isFinite(n) ? n : 0 });
                                        }}
                                        onBlur={() => {
                                            // On blur, clamp the value back into the valid range so the
                                            // submit-time guard never has to reject a legitimate edit.
                                            if (!form.durationDays || form.durationDays < 1) {
                                                setForm({ ...form, durationDays: 1 });
                                            } else if (form.durationDays > 365) {
                                                setForm({ ...form, durationDays: 365 });
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2 border-t border-border/40">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Meals</Label>
                                    <Button type="button" variant="ghost" size="sm" onClick={addMeal}><Plus className="w-3.5 h-3.5 mr-1" /> Add meal</Button>
                                </div>
                                {meals.map((m, i) => (
                                    <div key={i} className="p-4 rounded-lg border border-border/60 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Select value={m.mealTime} onValueChange={(v) => { const c = [...meals]; c[i].mealTime = v as MealTime; setMeals(c); }}>
                                                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                                                <SelectContent>{MEAL_TIMES.map((t) => <SelectItem key={t} value={t}>{MEAL_LABEL[t]}</SelectItem>)}</SelectContent>
                                            </Select>
                                            {meals.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeMeal(i)}>Remove</Button>}
                                        </div>
                                        <Input placeholder="Foods to eat (comma-separated)" value={m.foods} onChange={(e) => { const c = [...meals]; c[i].foods = e.target.value; setMeals(c); }} />
                                        <Input placeholder="Foods to avoid (comma-separated)" value={m.avoidFoods} onChange={(e) => { const c = [...meals]; c[i].avoidFoods = e.target.value; setMeals(c); }} />
                                        <Input placeholder="Instructions (optional)" value={m.instructions} onChange={(e) => { const c = [...meals]; c[i].instructions = e.target.value; setMeals(c); }} />
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                                <Button type="submit">
                                    <Send className="w-4 h-4 mr-2" />
                                    {editingId ? "Save Changes" : "Create Package"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Assign to patient dialog */}
                <Dialog open={!!assignPkg} onOpenChange={(o) => !o && setAssignPkg(null)}>
                    <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Assign "{assignPkg?.title}" to patient</DialogTitle>
                            <DialogDescription>
                                Creates a diet prescription for the patient from this package. You can tweak the duration.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitAssign} className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Patient</Label>
                                <PatientPicker
                                    value={assignForm.patientId}
                                    onChange={(id) => setAssignForm({ ...assignForm, patientId: id })}
                                    patients={branchIdParam
                                        ? patients.filter((p) => patientBranchId(p) === branchIdParam)
                                        : patients}
                                    placeholder="Search patients…"
                                />
                            </div>

                            {/* Context panel — loads once a patient is picked */}
                            {assignForm.patientId && (
                                <div className="space-y-2">
                                    {contextLoading && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking patient context…
                                        </div>
                                    )}

                                    {assignContext?.doshaMatch.known && !assignContext.doshaMatch.compatible && (
                                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                            <div className="text-xs">
                                                <div className="font-semibold text-amber-700">Dosha mismatch</div>
                                                <div className="text-muted-foreground">{assignContext.doshaMatch.reason}. You can still proceed if your clinical judgement overrides the heuristic.</div>
                                            </div>
                                        </div>
                                    )}

                                    {assignContext?.doshaMatch.known && assignContext.doshaMatch.compatible && (
                                        <div className="rounded-lg border border-wellness/30 bg-wellness/5 p-3 flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-wellness mt-0.5 flex-shrink-0" />
                                            <div className="text-xs">
                                                <span className="font-semibold text-wellness">Dosha compatible</span>
                                                <span className="text-muted-foreground"> — patient prakriti: {assignContext.doshaMatch.prakriti}</span>
                                            </div>
                                        </div>
                                    )}

                                    {assignContext && !assignContext.doshaMatch.known && (
                                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex items-start gap-2">
                                            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                            <div className="text-xs text-muted-foreground">
                                                No constitution profile on file — dosha fit cannot be verified.
                                            </div>
                                        </div>
                                    )}

                                    {assignContext?.hasConflict && assignContext.activePrescriptions.length > 0 && (
                                        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1.5">
                                            <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                                                <AlertTriangle className="w-3.5 h-3.5" /> Patient already has an active diet
                                            </div>
                                            {assignContext.activePrescriptions.map((rx) => (
                                                <div key={rx.id} className="text-xs text-foreground pl-5">
                                                    • {rx.title}
                                                    <span className="text-muted-foreground">
                                                        {" "}({fmtDate(rx.startDate)}
                                                        {rx.endDate ? ` → ${fmtDate(rx.endDate)}` : " → ongoing"})
                                                    </span>
                                                </div>
                                            ))}
                                            <div className="text-[11px] text-muted-foreground pl-5">
                                                You'll be prompted to replace it when you submit.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Start date</Label>
                                    <DatePicker
                                        value={assignForm.startDate}
                                        onChange={(iso) => setAssignForm({ ...assignForm, startDate: iso })}
                                        required
                                        fromDate={new Date()}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Duration (days)</Label>
                                    <Input type="number" min={1} max={365} required value={assignForm.durationDays}
                                        onChange={(e) => setAssignForm({ ...assignForm, durationDays: Number(e.target.value) || 1 })} />
                                </div>
                            </div>

                            {/* Live end-date + override hint */}
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                                {computedEndDate && (
                                    <span>
                                        <span className="font-semibold">Ends:</span>{" "}
                                        {fmtShortDate(computedEndDate)}
                                    </span>
                                )}
                                {assignPkg && assignForm.durationDays !== assignPkg.durationDays && (
                                    <span>· Package default {assignPkg.durationDays}d → overriding to {assignForm.durationDays}d</span>
                                )}
                            </div>

                            {/* Meal preview — collapsible */}
                            {assignPkg?.meals && assignPkg.meals.length > 0 && (
                                <div className="rounded-lg border border-border/60">
                                    <button
                                        type="button"
                                        onClick={() => setMealsExpanded((v) => !v)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/30 transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Utensils className="w-3.5 h-3.5" />
                                            Preview {assignPkg.meals.length} meal{assignPkg.meals.length === 1 ? "" : "s"}
                                        </span>
                                        <ChevronDown className={cn("w-4 h-4 transition-transform", mealsExpanded && "rotate-180")} />
                                    </button>
                                    {mealsExpanded && (
                                        <div className="border-t border-border/40 divide-y divide-border/30">
                                            {assignPkg.meals.map((m) => (
                                                <div key={m.mealTime} className="px-3 py-2 text-xs space-y-0.5">
                                                    <div className="font-semibold">{MEAL_LABEL[m.mealTime]}</div>
                                                    {m.foods.length > 0 && (
                                                        <div><span className="font-medium text-wellness">Eat:</span> {m.foods.map(f => f.name).join(", ")}</div>
                                                    )}
                                                    {m.avoidFoods.length > 0 && (
                                                        <div><span className="font-medium text-destructive">Avoid:</span> {m.avoidFoods.map(f => f.name).join(", ")}</div>
                                                    )}
                                                    {m.instructions && <div className="text-muted-foreground italic">{m.instructions}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Notes for this patient (optional)</Label>
                                <Textarea rows={2} value={assignForm.notes}
                                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })} />
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setAssignPkg(null)}>Cancel</Button>
                                <Button type="submit" disabled={assigning || !assignForm.patientId}>
                                    {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                                    Assign
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Conflict resolution prompt — only shown when the backend returned ACTIVE_DIET_CONFLICT */}
                <Dialog open={!!conflicts} onOpenChange={(o) => !o && setConflicts(null)}>
                    <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                            <DialogTitle>Replace existing diet plan?</DialogTitle>
                            <DialogDescription>
                                This patient already has {conflicts?.length === 1 ? "an active diet plan that overlaps" : `${conflicts?.length} active diet plans that overlap`} the new schedule.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2 space-y-1">
                            {conflicts?.map((c) => (
                                <div key={c.id} className="text-xs px-3 py-2 rounded bg-muted/40 border border-border/40">
                                    <div className="font-semibold">{c.title}</div>
                                    <div className="text-muted-foreground">
                                        {fmtDate(c.startDate)}
                                        {c.endDate ? ` → ${fmtDate(c.endDate)}` : " → ongoing"}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="ghost" onClick={() => setConflicts(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={() => { setConflicts(null); runAssign(true); }} disabled={assigning}>
                                {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                Deactivate old & assign new
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {confirmDialog}
        </div>
    );

    if (embedded) return inner;
    return <AppLayout>{inner}</AppLayout>;
}
