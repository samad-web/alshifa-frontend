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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Salad, Loader2, Utensils, CheckCircle2, Package, AlertTriangle, Info, ChevronDown } from "lucide-react";
import { iwisApi, type DietPrescription, type DoshaType, type DietCategory, type MealTime, type DietMealPlan, type DietPackage, type DietAssignContext } from "@/services/iwis.service";
import { HoverActionCard } from "@/components/common/HoverActionCard";
import { Switch } from "@/components/ui/switch";
import { DietMealRow } from "@/components/diet/DietMealRow";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PatientPicker } from "@/components/clinical/PatientPicker";
import { DatePicker } from "@/components/ui/date-picker";
import { fmtDate, fmtShortDate } from "@/lib/format-date";
import { useBranchScope } from "@/hooks/useBranchScope";

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

import { composeInstructions } from "@/lib/dietFrequency";

type MealRow = {
    mealTime: MealTime;
    foods: string;
    avoidFoods: string;
    instructions: string;
    // Number of times per day this meal should be repeated. Bound to a
    // numeric input (1-50). Persisted by encoding into the meal `instructions`
    // string via the shared `composeInstructions` helper — DietMeal has no
    // first-class column for this and we don't want a schema migration.
    frequency: number;
};

const parseFoods = (s: string) =>
    s.split(/[,\n]/).map((f) => f.trim()).filter(Boolean).map((name) => ({ name }));

export default function DietPrescriptionsPage() {
    const { toast } = useToast();
    const { user, role } = useAuth();
    const { branchIdParam } = useBranchScope();
    const [params] = useSearchParams();
    const patientIdParam = params.get("patientId") || "";

    const [patients, setPatients] = useState<Array<{ id: string; fullName: string | null }>>([]);
    const [patientId, setPatientId] = useState(patientIdParam);
    const [prescriptions, setPrescriptions] = useState<DietPrescription[]>([]);
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState({
        title: "", doshaTarget: "VATA" as DoshaType, category: "SATTVIC" as DietCategory,
        startDate: new Date().toISOString().slice(0, 10), endDate: "", notes: "",
    });
    const [meals, setMeals] = useState<MealRow[]>([
        { mealTime: "BREAKFAST", foods: "", avoidFoods: "", instructions: "", frequency: 1 },
    ]);

    // Edit modal — separate from the create dialog so the create flow's meal
    // builder isn't dragged into a metadata-only edit. Meal-row editing has
    // its own UI (Feature 2). Backend enforces the "owning doctor" check, so
    // we gate the icons on role only.
    const [editing, setEditing] = useState<DietPrescription | null>(null);
    const [editForm, setEditForm] = useState({
        title: "", doshaTarget: "VATA" as DoshaType, category: "SATTVIC" as DietCategory,
        startDate: "", endDate: "", notes: "", isActive: true,
    });
    const [editSaving, setEditSaving] = useState(false);
    const canHoverEdit = role === "DOCTOR" || role === "ADMIN_DOCTOR";
    const canHoverDelete = canHoverEdit;

    function openEdit(p: DietPrescription) {
        setEditing(p);
        setEditForm({
            title: p.title,
            doshaTarget: p.doshaTarget,
            category: p.category,
            startDate: p.startDate.slice(0, 10),
            endDate: p.endDate ? p.endDate.slice(0, 10) : "",
            notes: p.notes ?? "",
            isActive: p.isActive,
        });
    }

    async function submitEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editing) return;
        setEditSaving(true);
        try {
            await iwisApi.updateDiet(editing.id, {
                title: editForm.title,
                doshaTarget: editForm.doshaTarget,
                category: editForm.category,
                startDate: editForm.startDate,
                endDate: editForm.endDate || null,
                notes: editForm.notes || undefined,
                isActive: editForm.isActive,
            });
            toast({ title: "Prescription updated" });
            setEditing(null);
            const refreshed = await iwisApi.listDietForPatient(patientId);
            setPrescriptions(refreshed);
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.status === 403) {
                toast({ title: "Forbidden", description: "You can only edit your own prescriptions.", variant: "destructive" });
            } else {
                toast({ title: "Update failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
            }
        } finally {
            setEditSaving(false);
        }
    }

    async function handleDelete(p: DietPrescription) {
        try {
            const result = await iwisApi.deleteDiet(p.id);
            toast({
                title: result.mode === 'soft' ? "Prescription deactivated" : "Prescription deleted",
                description: result.message,
            });
            const refreshed = await iwisApi.listDietForPatient(patientId);
            setPrescriptions(refreshed);
        } catch (err: unknown) {
            if (err instanceof ApiClientError && err.status === 403) {
                toast({ title: "Forbidden", description: "You can only delete your own prescriptions.", variant: "destructive" });
            } else {
                toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
            }
        }
    }

    // Approved packages available as templates
    const [approvedPackages, setApprovedPackages] = useState<DietPackage[]>([]);
    const [assignPkg, setAssignPkg] = useState<DietPackage | null>(null);
    // Default duration is the package's own value once selected; before that
    // we surface a sensible 7-day window so the form is never blank/zero.
    const [assignDuration, setAssignDuration] = useState(7);
    const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [assignNotes, setAssignNotes] = useState("");
    const [assigning, setAssigning] = useState(false);
    const [assignContext, setAssignContext] = useState<DietAssignContext | null>(null);
    const [contextLoading, setContextLoading] = useState(false);
    const [mealsExpanded, setMealsExpanded] = useState(false);
    const [conflicts, setConflicts] = useState<Array<{ id: string; title: string; startDate: string; endDate: string | null }> | null>(null);

    useEffect(() => {
        // Backend already filters status=APPROVED + isActive=true for the
        // assignment selector, but we re-filter on the client as a defensive
        // belt-and-braces — older API builds returned archived rows here and
        // they would silently leak into the patient assignment dropdown.
        iwisApi.listDietPackages({ status: "APPROVED" })
            .then((list) => setApprovedPackages(list.filter((p) => p.isActive && p.status === "APPROVED")))
            .catch((err) => {
                console.error("[DietPrescriptions] failed to load approved packages", err);
            });
    }, []);

    // Patient roster — only patients assigned to the calling doctor/therapist.
    // ADMIN_DOCTOR/ADMIN bypass the filter on the backend and see everyone.
    useEffect(() => {
        const params: Record<string, string> = { assignedToMe: "true" };
        if (branchIdParam) params.branchId = branchIdParam;
        apiClient.get<Array<{ id: string; fullName: string | null }>>("/api/user/list-patients", params)
            .then(({ data }) => setPatients(Array.isArray(data) ? data : []))
            .catch(() => setPatients([]));
    }, [branchIdParam]);

    useEffect(() => {
        if (!patientId) return;
        setLoading(true);
        iwisApi.listDietForPatient(patientId)
            .then(setPrescriptions)
            .finally(() => setLoading(false));
    }, [patientId]);

    const addMeal = () => setMeals([...meals, { mealTime: "LUNCH", foods: "", avoidFoods: "", instructions: "", frequency: 1 }]);
    const removeMeal = (i: number) => setMeals(meals.filter((_, idx) => idx !== i));

    const openAssignFromPackage = (pkg: DietPackage) => {
        setAssignPkg(pkg);
        setAssignDuration(pkg.durationDays);
        setAssignStartDate(new Date().toISOString().slice(0, 10));
        setAssignNotes("");
        setAssignContext(null);
        setMealsExpanded(false);
        setConflicts(null);
    };

    // Fetch assignment context the moment the dialog opens for a patient.
    useEffect(() => {
        if (!assignPkg || !patientId) { setAssignContext(null); return; }
        let cancelled = false;
        setContextLoading(true);
        iwisApi.getDietAssignContext(assignPkg.id, patientId)
            .then((ctx) => { if (!cancelled) setAssignContext(ctx); })
            .catch(() => { if (!cancelled) setAssignContext(null); })
            .finally(() => { if (!cancelled) setContextLoading(false); });
        return () => { cancelled = true; };
    }, [assignPkg, patientId]);

    const computedEndDate = useMemo(() => {
        if (!assignStartDate || !assignDuration) return null;
        const d = new Date(assignStartDate);
        if (isNaN(d.getTime())) return null;
        d.setDate(d.getDate() + Number(assignDuration));
        return d;
    }, [assignStartDate, assignDuration]);

    const runAssign = async (deactivateExisting: boolean) => {
        if (!assignPkg || !patientId) return;
        setAssigning(true);
        try {
            await iwisApi.assignDietPackage(assignPkg.id, {
                patientId,
                startDate: assignStartDate,
                durationDays: Number(assignDuration),
                notes: assignNotes || undefined,
                deactivateExisting,
            });
            toast({
                title: "Diet package assigned",
                description: deactivateExisting ? "Previous active diet was deactivated." : "Patient has been notified.",
            });
            setAssignPkg(null);
            setConflicts(null);
            const refreshed = await iwisApi.listDietForPatient(patientId);
            setPrescriptions(refreshed);
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

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientId) return toast({ title: "Select a patient", variant: "destructive" });
        try {
            // Resolve the caller's Doctor.id explicitly. The backend expects a
            // Doctor primary key (NOT User.id) — falling back to user.id was
            // the root cause of the silent persistence failure: the FK
            // constraint rejected the row but the error toast was lost in
            // the previous catch-all. Refuse to submit when we can't resolve
            // a Doctor profile and surface the reason to the doctor.
            const me = await apiClient.get<{ doctor?: { id: string } | null; role?: string }>("/api/user/me")
                .then(r => r.data)
                .catch(() => null);
            const doctorId = me?.doctor?.id || "";
            if (!doctorId) {
                toast({
                    title: "Cannot save diet plan",
                    description: "Your account has no clinician profile linked. Ask an admin to link a Doctor record before creating diet prescriptions.",
                    variant: "destructive",
                });
                return;
            }

            const payload = {
                patientId,
                doctorId,
                title: form.title,
                doshaTarget: form.doshaTarget,
                category: form.category,
                startDate: form.startDate,
                endDate: form.endDate || undefined,
                notes: form.notes || undefined,
                meals: meals.map((m): DietMealPlan => ({
                    mealTime: m.mealTime,
                    foods: parseFoods(m.foods),
                    avoidFoods: parseFoods(m.avoidFoods),
                    // Persist frequency as a structured prefix on instructions
                    // so the value round-trips without a schema change.
                    instructions: composeInstructions(m.frequency, m.instructions),
                })),
            };
            await iwisApi.createDiet(payload);
            toast({ title: "Diet plan assigned successfully", description: "The patient has been notified." });
            setDialogOpen(false);
            const refreshed = await iwisApi.listDietForPatient(patientId);
            setPrescriptions(refreshed);
        } catch (err: unknown) {
            toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
        }
    };

    return (
        <AppLayout>
            <div className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
                <PageHeader title="Diet Prescriptions" subtitle="Pathya-Apathya — structured meal-level guidance per Dosha target">
                    <div className="flex gap-2">
                        <Link to="/diet-packages"><Button variant="outline"><Package className="w-4 h-4 mr-2" /> Manage Packages</Button></Link>
                        <Button onClick={() => setDialogOpen(true)} disabled={!patientId}><Plus className="w-4 h-4 mr-2" /> New Diet Plan</Button>
                    </div>
                </PageHeader>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-[320px]">
                        <PatientPicker
                            value={patientId}
                            onChange={setPatientId}
                            patients={patients}
                            placeholder="Search patients…"
                        />
                    </div>

                    {patientId && approvedPackages.length > 0 && (
                        <div className="flex items-center gap-2 ml-auto">
                            <Package className="w-4 h-4 text-muted-foreground" />
                            <SearchableSelect
                                value=""
                                onChange={(v) => {
                                    const pkg = approvedPackages.find((p) => p.id === v);
                                    if (pkg) openAssignFromPackage(pkg);
                                }}
                                placeholder="Assign from package…"
                                searchPlaceholder="Search packages…"
                                className="w-[300px]"
                                items={approvedPackages.map((p) => ({
                                    value: p.id,
                                    label: p.title,
                                    sub:   `${p.doshaTarget} · ${p.durationDays}d`,
                                    keywords: [p.doshaTarget, p.category],
                                }))}
                            />
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : !patientId ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                        <Salad className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">Select a patient to view or create diet prescriptions.</p>
                    </div>
                ) : prescriptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                        <Utensils className="w-12 h-12 text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground mb-4">No diet prescriptions yet for this patient.</p>
                        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Create first plan</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {prescriptions.map((p) => (
                            <HoverActionCard
                                key={p.id}
                                canEdit={canHoverEdit}
                                canDelete={canHoverDelete}
                                onEdit={() => openEdit(p)}
                                deleteTitle={`Delete "${p.title}"?`}
                                deleteDescription="If adherence logs reference this prescription it will be deactivated to preserve history; otherwise it's permanently removed."
                                onDelete={() => handleDelete(p)}
                            >
                                <Panel title={p.title}>
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="secondary">Dosha: {p.doshaTarget}</Badge>
                                            <Badge variant="outline">{p.category}</Badge>
                                            {p.isActive && <Badge variant="outline" className="bg-wellness/10 text-wellness border-wellness/30">Active</Badge>}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {fmtDate(p.startDate)} {p.endDate ? `→ ${fmtDate(p.endDate)}` : "(ongoing)"}
                                            {p.doctor?.fullName && <> · Dr. {p.doctor.fullName}</>}
                                        </div>
                                        {p.meals && p.meals.length > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-border/40">
                                                {p.meals.map((m) => (
                                                    <DietMealRow
                                                        key={m.id ?? m.mealTime}
                                                        prescriptionId={p.id}
                                                        meal={m}
                                                        canManage={canHoverEdit}
                                                        onChanged={async () => {
                                                            const refreshed = await iwisApi.listDietForPatient(patientId);
                                                            setPrescriptions(refreshed);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {canHoverEdit && (
                                            <AddMealSlotButton
                                                prescriptionId={p.id}
                                                existingSlots={(p.meals ?? []).map((m) => m.mealTime)}
                                                onAdded={async () => {
                                                    const refreshed = await iwisApi.listDietForPatient(patientId);
                                                    setPrescriptions(refreshed);
                                                }}
                                            />
                                        )}
                                    </div>
                                </Panel>
                            </HoverActionCard>
                        ))}
                    </div>
                )}

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>New Diet Prescription</DialogTitle>
                            <DialogDescription>Meals use comma-separated food lists. Example: "Rice, dal, spinach curry".</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} className="space-y-5 py-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Vata-pacifying diet — Phase 1" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
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
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start date</Label>
                                    <DatePicker
                                        value={form.startDate}
                                        onChange={(iso) => setForm({ ...form, startDate: iso })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End date (optional)</Label>
                                    <DatePicker
                                        value={form.endDate}
                                        onChange={(iso) => setForm({ ...form, endDate: iso })}
                                        placeholder="No end date"
                                        fromDate={form.startDate ? new Date(form.startDate) : undefined}
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
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <Select value={m.mealTime} onValueChange={(v) => { const c = [...meals]; c[i].mealTime = v as MealTime; setMeals(c); }}>
                                                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                                                <SelectContent>{MEAL_TIMES.map((t) => <SelectItem key={t} value={t}>{MEAL_LABEL[t]}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <div className="flex items-center gap-2">
                                                <Label className="text-[11px] text-muted-foreground">Frequency / day</Label>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={50}
                                                    className="w-20 h-9"
                                                    value={m.frequency}
                                                    onChange={(e) => {
                                                        // Bind directly to numeric state. Empty string is preserved
                                                        // mid-edit (NaN → 1 only on blur via clamp below) so the
                                                        // input never feels "stuck" at 1 when the user is typing.
                                                        const raw = e.target.value;
                                                        const next = raw === "" ? 1 : Math.max(1, Math.min(50, Number(raw) || 1));
                                                        const c = [...meals];
                                                        c[i].frequency = next;
                                                        setMeals(c);
                                                    }}
                                                />
                                            </div>
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
                                <Button type="submit"><CheckCircle2 className="w-4 h-4 mr-2" /> Assign Diet Plan</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Assign from package dialog — snapshots package into a new DietPrescription */}
                <Dialog open={!!assignPkg} onOpenChange={(o) => !o && setAssignPkg(null)}>
                    <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Assign "{assignPkg?.title}"</DialogTitle>
                            <DialogDescription>
                                Creates a diet plan for this patient from the package. Duration defaults to the package's baked-in value but can be adjusted.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitAssign} className="space-y-4 py-2">
                            <div className="flex flex-wrap gap-2">
                                {assignPkg && (
                                    <>
                                        <Badge variant="secondary">Dosha: {assignPkg.doshaTarget}</Badge>
                                        <Badge variant="outline">{assignPkg.category}</Badge>
                                        <Badge variant="outline">{assignPkg.meals?.length ?? 0} meals</Badge>
                                    </>
                                )}
                            </div>

                            {/* Context — fit check + existing-diet warning */}
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
                                            <div className="text-muted-foreground">{assignContext.doshaMatch.reason}. Override with clinical judgement if appropriate.</div>
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

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label>Start date</Label>
                                    <DatePicker
                                        value={assignStartDate}
                                        onChange={setAssignStartDate}
                                        required
                                        fromDate={new Date()}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Duration (days)</Label>
                                    <Input type="number" min={1} max={365} required value={assignDuration}
                                        onChange={(e) => setAssignDuration(Number(e.target.value) || 1)} />
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                                {computedEndDate && (
                                    <span>
                                        <span className="font-semibold">Ends:</span>{" "}
                                        {fmtShortDate(computedEndDate)}
                                    </span>
                                )}
                                {assignPkg && assignDuration !== assignPkg.durationDays && (
                                    <span>· Package default {assignPkg.durationDays}d → overriding to {assignDuration}d</span>
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
                                <Textarea rows={2} value={assignNotes}
                                    onChange={(e) => setAssignNotes(e.target.value)} />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setAssignPkg(null)}>Cancel</Button>
                                <Button type="submit" disabled={assigning}>
                                    {assigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                    Assign to Patient
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Conflict resolution prompt */}
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

                {/* Edit prescription dialog. Meals are edited per-row inside
                    the card (Feature 2) so this surface stays metadata-only. */}
                <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Edit Diet Prescription</DialogTitle>
                            <DialogDescription>Update the high-level fields. Meals are edited individually from each meal row.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submitEdit} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input required value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Dosha target</Label>
                                    <Select value={editForm.doshaTarget} onValueChange={(v) => setEditForm({ ...editForm, doshaTarget: v as DoshaType })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{DOSHAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v as DietCategory })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start date</Label>
                                    <DatePicker value={editForm.startDate} onChange={(iso) => setEditForm({ ...editForm, startDate: iso })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>End date (optional)</Label>
                                    <DatePicker value={editForm.endDate} onChange={(iso) => setEditForm({ ...editForm, endDate: iso })} placeholder="No end date" fromDate={editForm.startDate ? new Date(editForm.startDate) : undefined} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch id="edit-active" checked={editForm.isActive} onCheckedChange={(v) => setEditForm({ ...editForm, isActive: v })} />
                                <Label htmlFor="edit-active" className="cursor-pointer">Active</Label>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={editSaving}>Cancel</Button>
                                <Button type="submit" disabled={editSaving}>
                                    {editSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Save changes
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}

// ── Inline helper: "+ Add Meal Slot" button + slot picker dialog ────────────
// Lives in this file because it's only used here. Posts an empty meal at the
// chosen MealTime; foods/avoidFoods/instructions are filled in afterwards via
// the row's edit dialog.
function AddMealSlotButton({
    prescriptionId,
    existingSlots,
    onAdded,
}: {
    prescriptionId: string;
    existingSlots: MealTime[];
    onAdded: () => void;
}) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const available = MEAL_TIMES.filter((t) => !existingSlots.includes(t));
    const [pick, setPick] = useState<MealTime | "">(available[0] ?? "");

    if (available.length === 0) return null;

    async function handleAdd() {
        if (!pick) return;
        setSaving(true);
        try {
            await iwisApi.addDietMeal(prescriptionId, {
                mealTime: pick as MealTime,
                foods: [],
                avoidFoods: [],
                instructions: undefined,
            });
            toast({ title: "Meal slot added", description: "Open it to fill in foods and instructions." });
            setOpen(false);
            onAdded();
        } catch (err: unknown) {
            toast({
                title: "Could not add meal",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <div className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => { setPick(available[0]); setOpen(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Meal Slot
                </Button>
            </div>
            <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Add a meal slot</DialogTitle>
                        <DialogDescription>Pick a slot. You can fill in foods and instructions immediately after.</DialogDescription>
                    </DialogHeader>
                    <div className="py-3 space-y-2">
                        <Label>Meal time</Label>
                        <Select value={pick || undefined} onValueChange={(v) => setPick(v as MealTime)}>
                            <SelectTrigger><SelectValue placeholder="Select a slot" /></SelectTrigger>
                            <SelectContent>
                                {available.map((t) => <SelectItem key={t} value={t}>{MEAL_LABEL[t]}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={saving || !pick}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add slot
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
