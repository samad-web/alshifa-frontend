/**
 * Patient Health Passport summary panel for clinicians.
 *
 * Rendered on PatientTimeline.tsx (which has no tabs) as a top-of-page
 * collapsible card. Shows every completed-journey snapshot for the patient,
 * each linking to the full passport at /admin/patient-history/:id.
 *
 * Empty state: no card rendered when the patient has zero completed journeys.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ChevronRight, Loader2, TrendingDown } from "lucide-react";
import {
    patientHistoryService,
    type PatientHistoryRecord,
} from "@/services/patientHistory.service";

interface Props {
    patientId: string;
}

const RISK_COLOR: Record<string, string> = {
    LOW: "text-green-600",
    MEDIUM: "text-amber-500",
    HIGH: "text-red-500",
};

function fmt(d: string): string {
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function PatientHealthPassportPanel({ patientId }: Props) {
    const [records, setRecords] = useState<PatientHistoryRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const data = await patientHistoryService.listForPatient(patientId);
                if (!cancelled) setRecords(data.records);
            } catch {
                // Silent — empty list is the visual fallback. Console noise here
                // pollutes a page that's still useful without the panel.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [patientId]);

    // Hide the entire panel for patients with no completed journeys — keeps
    // the timeline page focused on active care for the common case.
    if (!loading && records.length === 0) return null;

    return (
        <Card className="rounded-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Health Passport
                    <span className="text-xs font-normal text-muted-foreground">
                        ({records.length} completed journey{records.length === 1 ? "" : "s"})
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {loading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                    </div>
                ) : (
                    records.map((r) => (
                        <Link
                            key={r.id}
                            to={`/admin/patient-history/${r.id}`}
                            className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:border-primary/50 transition-colors"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{r.journeyTitle}</div>
                                <div className="text-xs text-muted-foreground">
                                    {fmt(r.startDate)} – {fmt(r.completedDate)} · {r.durationDays} days
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs shrink-0 ml-3">
                                {r.painReduction !== null && (
                                    <span className="text-primary flex items-center gap-1">
                                        <TrendingDown className="w-3 h-3" /> Pain ↓{r.painReduction}%
                                    </span>
                                )}
                                <Badge variant="outline" className={`text-[10px] ${RISK_COLOR[r.returnRiskLevel] || ""}`}>
                                    {r.returnRiskLevel}
                                </Badge>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                        </Link>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
