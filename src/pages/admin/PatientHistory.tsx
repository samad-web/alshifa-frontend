/**
 * Patient History — admin dashboard listing immutable health-passport
 * snapshots of every completed TreatmentJourney within the branch.
 *
 * Visible to ADMIN and ADMIN_DOCTOR only (gated by the route's allowedRoles).
 *
 * Filters: doctor (via doctorId), return risk level, free-text name search.
 * Stats strip aggregates over the entire branch — independent of the
 * row-level filters above so the four numbers stay stable as the user
 * narrows the list.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, History, AlertTriangle, CheckCircle2, Clock, TrendingDown, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { patientHistoryService, type PatientHistoryRecord, type HistoryListStats, type ReturnRiskLevel } from "@/services/patientHistory.service";

const RISK_CONFIG: Record<ReturnRiskLevel, { className: string; emoji: string; label: string }> = {
    LOW:    { className: "text-green-600",  emoji: "✓", label: "Low return risk" },
    MEDIUM: { className: "text-amber-500",  emoji: "🟡", label: "Medium return risk" },
    HIGH:   { className: "text-red-500",    emoji: "⚠",  label: "High return risk" },
};

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function PatientHistory() {
    const navigate = useNavigate();

    const [records, setRecords] = useState<PatientHistoryRecord[]>([]);
    const [stats, setStats] = useState<HistoryListStats>({
        totalCompleted: 0, avgPainReduction: 0, avgDuration: 0, returnedPatients: 0,
    });
    const [loading, setLoading] = useState(true);
    const [riskFilter, setRiskFilter] = useState<ReturnRiskLevel | "">("");
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await patientHistoryService.list({
                riskLevel: riskFilter || undefined,
                search: search.trim() || undefined,
                limit: 50,
            });
            setRecords(data.records);
            setStats(data.stats);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to load patient history";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }, [riskFilter, search]);

    useEffect(() => {
        const t = setTimeout(() => { void load(); }, 250);
        return () => clearTimeout(t);
    }, [load]);

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
                <PageHeader
                    title="Patient History"
                    subtitle="Immutable health passports for every completed treatment journey in this branch."
                />

                {/* Stats strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Completed Journeys"
                        value={stats.totalCompleted}
                        icon={CheckCircle2}
                    />
                    <StatCard
                        title="Avg Pain Reduction"
                        value={`${stats.avgPainReduction}%`}
                        icon={TrendingDown}
                        variant="wellness"
                    />
                    <StatCard
                        title="Avg Duration"
                        value={`${stats.avgDuration} days`}
                        icon={Clock}
                    />
                    <StatCard
                        title="Returned Patients"
                        value={stats.returnedPatients}
                        icon={Users}
                        variant="attention"
                    />
                </div>

                {/* Filter row */}
                <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[220px]">
                        <label className="text-xs text-muted-foreground block mb-1">Search patient</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Patient name…"
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground block mb-1">Return risk</label>
                        <select
                            value={riskFilter}
                            onChange={(e) => setRiskFilter(e.target.value as ReturnRiskLevel | "")}
                            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
                        >
                            <option value="">All risk levels</option>
                            <option value="HIGH">⚠ High Risk</option>
                            <option value="MEDIUM">🟡 Medium Risk</option>
                            <option value="LOW">✓ Low Risk</option>
                        </select>
                    </div>
                </div>

                {/* Records list */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : records.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-sm text-muted-foreground">
                            <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            No completed journeys yet for this branch.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {records.map((r) => {
                            const risk = RISK_CONFIG[r.returnRiskLevel] || RISK_CONFIG.LOW;
                            return (
                                <div
                                    key={r.id}
                                    onClick={() => {
                                        // Navigate to the patient's full profile + chronological
                                        // history. Falls back to the legacy /admin/patient-history
                                        // route if the joined patient row is missing (shouldn't
                                        // happen — backend always includes it — but defensive).
                                        const pid = r.patient?.id || r.patientId;
                                        if (pid) navigate(`/patients/${pid}/timeline`);
                                        else navigate(`/patient-history`);
                                    }}
                                    className="flex items-center justify-between p-4 bg-white border border-border/60 rounded-2xl cursor-pointer hover:border-primary/50 transition-colors"
                                >
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0">
                                            {(r.patient?.fullName || "P").slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-medium text-sm truncate">
                                                {r.patient?.fullName || "Patient"}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {r.journeyTitle}
                                                {r.doctor?.fullName ? ` · Dr. ${r.doctor.fullName}` : ""}
                                                {` · ${r.durationDays} days`}
                                            </div>
                                            <div className="text-xs text-muted-foreground/70 mt-0.5">
                                                Completed {formatDate(r.completedDate)}
                                                {r.condition ? ` · ${r.condition}` : ""}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        {r.painReduction !== null && (
                                            <div className="text-sm font-medium text-primary">
                                                Pain ↓{r.painReduction}%
                                            </div>
                                        )}
                                        <div className={`text-xs font-medium mt-1 ${risk.className} flex items-center gap-1 justify-end`}>
                                            <span>{risk.emoji}</span> {r.returnRiskLevel}
                                        </div>
                                        {r.followUpScheduled && (
                                            <Badge variant="outline" className="mt-1 text-[10px]">Follow-up scheduled</Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
