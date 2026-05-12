/**
 * Patient-facing "My Journey History" tab.
 *
 * Mounted inside PatientPortal.tsx. Fetches the patient's own completed-
 * journey records via /api/patient-history/patient/:patientId (the calling
 * patient's id is resolved through /api/user/me first — same pattern
 * HealthReportsTab uses).
 *
 * Each completed journey is shown as a "story card" with a gradient
 * background and a Download Certificate action.
 */

import { useEffect, useState } from "react";
import { Loader2, Sprout, Download, Leaf } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import {
    patientHistoryService,
    type PatientHistoryRecord,
} from "@/services/patientHistory.service";

interface UserMe {
    patient?: { id?: string | null } | null;
}

function fmtRange(start: string, end: string): string {
    const s = new Date(start).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const e = new Date(end).toLocaleDateString("en-IN",   { month: "short", year: "numeric" });
    return `${s} – ${e}`;
}

export function JourneyHistoryTab() {
    const [records, setRecords] = useState<PatientHistoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const me = await apiClient.get<UserMe>("/api/user/me");
                const pid = me.data.patient?.id;
                if (!pid) {
                    if (!cancelled) setRecords([]);
                    return;
                }
                const data = await patientHistoryService.listForPatient(pid);
                if (!cancelled) setRecords(data.records);
            } catch (err) {
                if (!cancelled) {
                    toast.error(err instanceof Error ? err.message : "Failed to load journey history");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    async function handleDownload(recordId: string) {
        setDownloadingId(recordId);
        try {
            const blob = await patientHistoryService.downloadCertificate(recordId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "AlShifa-Wellness-Certificate.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Certificate download failed");
        } finally {
            setDownloadingId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    <Sprout className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    No completed journeys yet. Your wellness milestones will appear here when you finish your first treatment program.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            {records.map((r) => (
                <div
                    key={r.id}
                    className="rounded-2xl border border-emerald-100 p-4"
                    style={{ background: "linear-gradient(135deg, #E1F5EE, #f0fdf4)" }}
                >
                    <div className="text-xs text-teal-700 font-medium mb-1 flex items-center gap-1">
                        <Leaf className="w-3 h-3" /> Journey Complete
                    </div>
                    <div className="font-semibold text-base">{r.journeyTitle}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                        {r.durationDays} days · {fmtRange(r.startDate, r.completedDate)}
                    </div>
                    {r.painReduction !== null && (
                        <div className="text-sm font-medium text-teal-700 mt-2">
                            Pain reduced by {r.painReduction}% 💚
                        </div>
                    )}
                    {r.taskCompletionRate !== null && (
                        <div className="text-xs text-teal-700/80 mt-0.5">
                            {r.taskCompletionRate}% of treatment tasks completed
                        </div>
                    )}
                    <div className="flex gap-2 mt-3">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleDownload(r.id)}
                            disabled={!r.certificatePdfPath || downloadingId === r.id}
                            className="text-xs border-teal-200 text-teal-700 hover:bg-teal-100/50"
                        >
                            {downloadingId === r.id
                                ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                : <Download className="w-3 h-3 mr-1" />}
                            Download Certificate
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
