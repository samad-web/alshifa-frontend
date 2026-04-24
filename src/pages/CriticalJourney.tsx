import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import {
    AlertTriangle,
    RefreshCw,
    CheckCircle2,
    Pill,
    HeartPulse,
    ClipboardCheck,
    CalendarClock,
    Activity,
    Circle,
    User,
    Phone,
    Building2,
    Filter,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    criticalJourneyService,
    CriticalPatient,
    CriticalReasonType,
    CRITICAL_REASON_LABELS,
} from "@/services/criticalJourney.service";
import { useBranchScope } from "@/hooks/useBranchScope";

const REASON_ICONS: Record<CriticalReasonType, typeof Pill> = {
    MISSED_MEDICATION: Pill,
    MISSED_VITAL_UPLOAD: HeartPulse,
    MISSED_DAILY_CHECKIN: ClipboardCheck,
    MISSED_FOLLOWUP: CalendarClock,
    WELLNESS_DECLINE: Activity,
    OVERDUE_JOURNEY_PHASE: Circle,
};

const SEVERITY_STYLES: Record<string, { pill: string; border: string; text: string }> = {
    HIGH: {
        pill: "bg-red-500 text-white",
        border: "border-red-500/40",
        text: "text-red-600",
    },
    MEDIUM: {
        pill: "bg-amber-500 text-white",
        border: "border-amber-500/40",
        text: "text-amber-600",
    },
    LOW: {
        pill: "bg-slate-500 text-white",
        border: "border-slate-500/40",
        text: "text-slate-600",
    },
};

export default function CriticalJourneyPage() {
    const { toast } = useToast();
    const { branchIdParam } = useBranchScope();
    const [patients, setPatients] = useState<CriticalPatient[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [severityFilter, setSeverityFilter] = useState<string | "ALL">("ALL");
    const [resolveTarget, setResolveTarget] = useState<CriticalPatient | null>(null);
    const [resolveNote, setResolveNote] = useState("");
    const [resolving, setResolving] = useState(false);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await criticalJourneyService.list({
                branchId: branchIdParam,
                severity: severityFilter === "ALL" ? undefined : severityFilter,
            });
            setPatients(rows);
        } catch (err) {
            toast({
                title: "Failed to load critical patients",
                description: err instanceof Error ? err.message : "",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [branchIdParam, severityFilter, toast]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const counts = useMemo(() => {
        const c = { total: patients.length, high: 0, medium: 0, low: 0 };
        for (const p of patients) {
            if (p.severity === "HIGH") c.high++;
            else if (p.severity === "MEDIUM") c.medium++;
            else c.low++;
        }
        return c;
    }, [patients]);

    const handleScan = async () => {
        setScanning(true);
        try {
            const res = await criticalJourneyService.scan({ branchId: branchIdParam });
            toast({
                title: "Scan complete",
                description: `Flagged ${res?.flagged ?? 0} · auto-resolved ${res?.resolved ?? 0} · scanned ${res?.scanned ?? 0}`,
            });
            await refresh();
        } catch (err) {
            toast({
                title: "Scan failed",
                description: err instanceof Error ? err.message : "",
                variant: "destructive",
            });
        } finally {
            setScanning(false);
        }
    };

    const handleResolve = async () => {
        if (!resolveTarget) return;
        setResolving(true);
        try {
            await criticalJourneyService.resolve(resolveTarget.patient.id, resolveNote || undefined);
            toast({ title: "Patient flag resolved" });
            setResolveTarget(null);
            setResolveNote("");
            await refresh();
        } catch (err) {
            toast({
                title: "Resolve failed",
                description: err instanceof Error ? err.message : "",
                variant: "destructive",
            });
        } finally {
            setResolving(false);
        }
    };

    return (
        <AppLayout>
            <PageTransition className="container max-w-7xl mx-auto px-4 py-6 space-y-5">
                <header className="flex items-start justify-between flex-wrap gap-3">
                    <PageHeader
                        title="Critical Journey"
                        subtitle="Patients auto-flagged for non-adherence — missed medications, vital uploads, or follow-ups."
                    />
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleScan} disabled={scanning}>
                            <RefreshCw className={cn("w-4 h-4 mr-2", scanning && "animate-spin")} />
                            {scanning ? "Scanning…" : "Rescan now"}
                        </Button>
                    </div>
                </header>

                {/* Severity counters */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SeverityCard label="All active" count={counts.total} icon={AlertTriangle} tone="primary" active={severityFilter === "ALL"} onClick={() => setSeverityFilter("ALL")} />
                    <SeverityCard label="High severity" count={counts.high} icon={AlertTriangle} tone="red" active={severityFilter === "HIGH"} onClick={() => setSeverityFilter("HIGH")} />
                    <SeverityCard label="Medium" count={counts.medium} icon={AlertTriangle} tone="amber" active={severityFilter === "MEDIUM"} onClick={() => setSeverityFilter("MEDIUM")} />
                    <SeverityCard label="Low" count={counts.low} icon={AlertTriangle} tone="slate" active={severityFilter === "LOW"} onClick={() => setSeverityFilter("LOW")} />
                </section>

                {/* Patient list */}
                {loading ? (
                    <DashboardSkeleton />
                ) : patients.length === 0 ? (
                    <div className="rounded-xl border bg-card shadow-card p-10 text-center">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
                        <p className="text-sm font-medium">No critical patients right now</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            The detector last ran within the cron window. Use "Rescan now" to re-check adherence.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {patients.map((row) => (
                            <PatientCard key={row.id} row={row} onResolve={() => setResolveTarget(row)} />
                        ))}
                    </div>
                )}
            </PageTransition>

            {/* Resolve dialog */}
            <Dialog open={!!resolveTarget} onOpenChange={(v) => !v && setResolveTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Resolve critical flag</DialogTitle>
                        <DialogDescription>
                            Confirm that you've reached out to{" "}
                            <strong>{resolveTarget?.patient.fullName || "this patient"}</strong>{" "}
                            and the issue is handled. Optionally capture a short note for the audit log.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="resolve-note">Note (optional)</Label>
                        <Textarea
                            id="resolve-note"
                            value={resolveNote}
                            onChange={(e) => setResolveNote(e.target.value)}
                            placeholder="e.g. Called patient, confirmed medication resumed"
                            maxLength={500}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setResolveTarget(null)} disabled={resolving}>
                            Cancel
                        </Button>
                        <Button onClick={handleResolve} disabled={resolving}>
                            {resolving ? "Saving…" : "Mark resolved"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function SeverityCard({
    label, count, icon: Icon, tone, active, onClick,
}: {
    label: string;
    count: number;
    icon: typeof AlertTriangle;
    tone: "primary" | "red" | "amber" | "slate";
    active: boolean;
    onClick: () => void;
}) {
    const toneClasses = {
        primary: "text-primary",
        red: "text-red-500",
        amber: "text-amber-500",
        slate: "text-slate-500",
    }[tone];
    return (
        <button
            onClick={onClick}
            className={cn(
                "text-left rounded-xl border bg-card p-4 shadow-card transition-all",
                "hover:border-primary/40",
                active && "ring-2 ring-primary/30 border-primary/60",
            )}
        >
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                </span>
                <Icon className={cn("w-4 h-4", toneClasses)} />
            </div>
            <div className={cn("text-3xl font-bold mt-2", toneClasses)}>{count}</div>
        </button>
    );
}

function PatientCard({
    row, onResolve,
}: { row: CriticalPatient; onResolve: () => void }) {
    const style = SEVERITY_STYLES[row.severity] ?? SEVERITY_STYLES.LOW;
    return (
        <article className={cn("rounded-xl border bg-card shadow-card overflow-hidden", style.border)}>
            <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{row.patient.fullName || "Unnamed patient"}</h3>
                            <Badge className={cn("text-[10px]", style.pill)}>{row.severity}</Badge>
                            {row.patient.age !== null && row.patient.gender && (
                                <span className="text-[10px] text-muted-foreground">
                                    {row.patient.gender.charAt(0)} · {row.patient.age}y
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                            {row.patient.phoneNumber && (
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {row.patient.phoneNumber}</span>
                            )}
                            {row.patient.branch?.name && (
                                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {row.patient.branch.name}</span>
                            )}
                            <span>First flagged {new Date(row.firstDetectedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <Button size="sm" variant="outline" onClick={onResolve}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Resolve
                </Button>
            </div>
            <div className="px-5 pb-4 pt-0 border-t bg-muted/20">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-3">
                    Reasons ({row.reasons.length})
                </div>
                <ul className="space-y-1.5">
                    {row.reasons.map((r, i) => {
                        const Icon = REASON_ICONS[r.type] ?? AlertTriangle;
                        return (
                            <li key={i} className="flex items-start gap-2 text-sm">
                                <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", style.text)} />
                                <div>
                                    <span className="font-medium">{CRITICAL_REASON_LABELS[r.type] ?? r.type}</span>
                                    <span className="text-muted-foreground"> — {r.detail}</span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </article>
    );
}
