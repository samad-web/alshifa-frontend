
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { PatientCard } from "@/components/ui/patient-card";
import { useAuth } from "@/hooks/useAuth";
import { Users, Search, Filter, MessageSquare, ActivitySquare, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { DateInput, toDDMMYYYY, toISOFromDDMMYYYY } from "@/components/common/DateInput";
import { apiClient } from "@/lib/api-client";
import { useBranchScope } from "@/hooks/useBranchScope";
import { GroupedByBranch } from "@/components/common/GroupedByBranch";
import { therapyOutcomesApi } from "@/services/therapyOutcomes.service";

function patientBranchId(p: any): string | null {
    return p?.branchId
        ?? p?.user?.branchId
        ?? p?.patient?.user?.branchId
        ?? p?.patient?.branchId
        ?? null;
}
function patientBranchName(p: any): string | null {
    return p?.branch?.name
        ?? p?.user?.branch?.name
        ?? p?.patient?.user?.branch?.name
        ?? null;
}

// Log-Outcome dialog state — lifted to the page so the dialog can target
// any patient card without each card carrying its own component state.
interface OutcomeDraft {
    patientId: string;
    patientName: string;
    sessionDate: string;        // DD/MM/YYYY (DateInput controlled)
    painScore: number;
    mobilityScore: number;
    swellingReduced: boolean | null;
    functionalImprovement: string;
    therapistObservation: string;
    nextSessionGoal: string;
}

function emptyDraft(): OutcomeDraft {
    return {
        patientId: "",
        patientName: "",
        sessionDate: toDDMMYYYY(new Date()),
        painScore: 5,
        mobilityScore: 50,
        swellingReduced: null,
        functionalImprovement: "",
        therapistObservation: "",
        nextSessionGoal: "",
    };
}

export default function TherapistPatients() {
    const { profile, role } = useAuth();
    const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
    const { isAll, branchIdParam } = useBranchScope();
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Log-Outcome dialog state.
    const [outcomeOpen, setOutcomeOpen] = useState(false);
    const [outcomeDraft, setOutcomeDraft] = useState<OutcomeDraft>(emptyDraft);
    const [savingOutcome, setSavingOutcome] = useState(false);

    const openOutcomeDialog = (patient: any) => {
        setOutcomeDraft({
            ...emptyDraft(),
            patientId: patient.id,
            patientName: patient.fullName || patient.email || "Patient",
        });
        setOutcomeOpen(true);
    };

    const submitOutcome = async () => {
        if (!outcomeDraft.patientId) return;
        const sessionIso = toISOFromDDMMYYYY(outcomeDraft.sessionDate);
        if (!sessionIso) {
            toast.error("Enter a valid session date in DD/MM/YYYY format.");
            return;
        }
        setSavingOutcome(true);
        try {
            await therapyOutcomesApi.create({
                patientId: outcomeDraft.patientId,
                // Backend takes YYYY-MM-DD; strip the time component
                // from the ISO string the helper returns.
                sessionDate: sessionIso.slice(0, 10),
                painScore: outcomeDraft.painScore,
                mobilityScore: outcomeDraft.mobilityScore,
                swellingReduced: outcomeDraft.swellingReduced ?? undefined,
                functionalImprovement: outcomeDraft.functionalImprovement.trim() || undefined,
                therapistObservation: outcomeDraft.therapistObservation.trim() || undefined,
                nextSessionGoal: outcomeDraft.nextSessionGoal.trim() || undefined,
            });
            toast.success(`Outcome logged for ${outcomeDraft.patientName}`);
            setOutcomeOpen(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to log outcome");
        } finally {
            setSavingOutcome(false);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            const { data } = await apiClient.get<any[]>('/api/user/assigned-patients');
            setPatients(Array.isArray(data) ? data : []);
        } catch (error) {
            // Surface the failure so the empty roster isn't mistaken for
            // "no patients assigned" — that mismatch was the original bug.
            console.error("Failed to fetch patients:", error);
            setPatients([]);
        } finally {
            setLoading(false);
        }
    };

    const searchedPatients = patients.filter(p =>
        (p.fullName || p.email).toLowerCase().includes(search.toLowerCase())
    );
    const filteredPatients = branchIdParam
        ? searchedPatients.filter(p => patientBranchId(p) === branchIdParam)
        : searchedPatients;

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-8 md:py-12 space-y-10">
                <PageHeader
                    title="Patient Roster"
                    subtitle="Manage and track clinical progress for all assigned patients."
                />

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or email..."
                            className="pl-10 h-11 bg-background/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        <span className="text-sm font-bold text-foreground">{filteredPatients.length} Active Profiles</span>
                    </div>
                </div>

                <Panel title="Clinical Roster" subtitle="Detailed patient health journeys">
                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">Loading roster...</div>
                    ) : filteredPatients.length > 0 ? (() => {
                        const renderCard = (patient: any) => (
                            <PatientCard
                                key={patient.id}
                                name={patient.fullName || patient.email}
                                status={patient.status === "AT_RISK" ? "needs-attention" : "on-track"}
                                sittings={{
                                    current: patient.completedSittings || 0,
                                    total: patient.totalSittings || 20
                                }}
                                phoneNumber={patient.phoneNumber}
                                reason={Array.isArray(patient.therapyTypes) && patient.therapyTypes.length > 0
                                    ? patient.therapyTypes.join(", ")
                                    : null}
                            >
                                <div className="space-y-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-2"
                                        onClick={() => window.location.href = `/chat?partner=${patient.userId}`}
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Message
                                    </Button>
                                    {/* Per-session outcome capture. Doctors see the
                                        trend on PatientTimeline via TherapyOutcomesSection. */}
                                    <Button
                                        size="sm"
                                        className="w-full gap-2"
                                        onClick={() => openOutcomeDialog(patient)}
                                    >
                                        <ActivitySquare className="w-4 h-4" />
                                        Log Outcome
                                    </Button>
                                </div>
                            </PatientCard>
                        );
                        if (isAdmin && isAll) {
                            return (
                                <GroupedByBranch
                                    items={filteredPatients}
                                    getBranchId={patientBranchId}
                                    getBranchName={patientBranchName}
                                    renderItem={renderCard}
                                />
                            );
                        }
                        return (
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredPatients.map(renderCard)}
                            </div>
                        );
                    })() : (
                        <div className="text-center py-12 border-2 border-dashed rounded-3xl bg-secondary/5">
                            <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                            <p className="text-muted-foreground">No patients found matching your search.</p>
                        </div>
                    )}
                </Panel>
            </div>

            {/* Log Outcome dialog — one-per-page; targets whichever patient
                card's "Log Outcome" button was clicked. Stays mounted across
                target patients so dialog state survives card filter changes. */}
            <Dialog
                open={outcomeOpen}
                onOpenChange={(o) => { if (!savingOutcome) setOutcomeOpen(o); }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Log session outcome</DialogTitle>
                        <DialogDescription>
                            {outcomeDraft.patientName
                                ? `Record progress for ${outcomeDraft.patientName}.`
                                : "Record progress for this patient."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs" htmlFor="outcome-date">Session date</Label>
                            <DateInput
                                id="outcome-date"
                                value={outcomeDraft.sessionDate}
                                onChange={(v) => setOutcomeDraft((d) => ({ ...d, sessionDate: v }))}
                                placeholder="DD/MM/YYYY"
                                maxDate={toDDMMYYYY(new Date())}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Pain score (0–10)</Label>
                                <span className="text-sm font-mono font-semibold text-foreground">
                                    {outcomeDraft.painScore}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={10}
                                step={1}
                                value={outcomeDraft.painScore}
                                onChange={(e) =>
                                    setOutcomeDraft((d) => ({ ...d, painScore: Number(e.target.value) }))
                                }
                                className="w-full accent-primary"
                                aria-label="Pain score"
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>0 — none</span>
                                <span>10 — worst</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Mobility score (0–100%)</Label>
                                <span className="text-sm font-mono font-semibold text-foreground">
                                    {outcomeDraft.mobilityScore}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={outcomeDraft.mobilityScore}
                                onChange={(e) =>
                                    setOutcomeDraft((d) => ({ ...d, mobilityScore: Number(e.target.value) }))
                                }
                                className="w-full accent-primary"
                                aria-label="Mobility score"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Swelling reduced?</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: true,  label: "Yes" },
                                    { value: false, label: "No" },
                                    { value: null,  label: "Not assessed" },
                                ].map((opt) => {
                                    const active = outcomeDraft.swellingReduced === opt.value;
                                    return (
                                        <button
                                            key={String(opt.value)}
                                            type="button"
                                            onClick={() => setOutcomeDraft((d) => ({ ...d, swellingReduced: opt.value }))}
                                            className={
                                                "h-9 rounded-md border text-xs font-medium transition-colors " +
                                                (active
                                                    ? "bg-primary/10 border-primary text-primary"
                                                    : "bg-background border-input hover:bg-muted")
                                            }
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs" htmlFor="outcome-fn">
                                Functional improvement (optional)
                            </Label>
                            <Textarea
                                id="outcome-fn"
                                rows={2}
                                maxLength={2000}
                                value={outcomeDraft.functionalImprovement}
                                onChange={(e) =>
                                    setOutcomeDraft((d) => ({ ...d, functionalImprovement: e.target.value }))
                                }
                                placeholder="e.g. Can climb stairs without support…"
                                className="text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs" htmlFor="outcome-obs">
                                Therapist observation (optional)
                            </Label>
                            <Textarea
                                id="outcome-obs"
                                rows={2}
                                maxLength={2000}
                                value={outcomeDraft.therapistObservation}
                                onChange={(e) =>
                                    setOutcomeDraft((d) => ({ ...d, therapistObservation: e.target.value }))
                                }
                                placeholder="Clinical notes for the care team…"
                                className="text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs" htmlFor="outcome-goal">
                                Goal for next session (optional)
                            </Label>
                            <Textarea
                                id="outcome-goal"
                                rows={2}
                                maxLength={2000}
                                value={outcomeDraft.nextSessionGoal}
                                onChange={(e) =>
                                    setOutcomeDraft((d) => ({ ...d, nextSessionGoal: e.target.value }))
                                }
                                placeholder="e.g. Improve ROM to 90°…"
                                className="text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => setOutcomeOpen(false)}
                            disabled={savingOutcome}
                        >
                            Cancel
                        </Button>
                        <Button onClick={() => void submitOutcome()} disabled={savingOutcome}>
                            {savingOutcome
                                ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
                                : <><Save className="w-4 h-4 mr-1" /> Save outcome</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
