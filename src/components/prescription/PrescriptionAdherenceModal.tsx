import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { prescriptionsApi, type PrescriptionAdherence } from "@/services/prescriptions.service";
import { Activity, Calendar, Pill, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrescriptionAdherenceModalProps {
    prescriptionId: string | null;
    onClose: () => void;
}

export function PrescriptionAdherenceModal({ prescriptionId, onClose }: PrescriptionAdherenceModalProps) {
    const [data, setData] = useState<PrescriptionAdherence | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!prescriptionId) {
            setData(null);
            setError(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError(null);
        prescriptionsApi
            .getAdherence(prescriptionId)
            .then((res) => {
                if (!cancelled) setData(res);
            })
            .catch((err) => {
                if (!cancelled) setError(err?.message || "Failed to load adherence");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [prescriptionId]);

    return (
        <Dialog open={!!prescriptionId} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Medication Adherence
                    </DialogTitle>
                    <DialogDescription>
                        Patient consumption and dispense history for this prescription.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="space-y-3">
                        <Skeleton className="h-20 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </div>
                )}

                {error && !loading && (
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {data && !loading && !error && (
                    <div className="space-y-4">
                        {/* Header */}
                        <div className="p-4 rounded-lg bg-muted/40">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Pill className="h-4 w-4 text-primary" />
                                {data.medicationName}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {data.dosage} · {data.frequency} · {data.dailyDoseCount} dose{data.dailyDoseCount === 1 ? "" : "s"}/day
                            </p>
                        </div>

                        {/* Adherence stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <AdherenceTile
                                label="7-day adherence"
                                rate={data.adherenceRate7d}
                            />
                            <AdherenceTile
                                label="30-day adherence"
                                rate={data.adherenceRate30d}
                            />
                            <StatTile
                                label="Doses logged (7d)"
                                value={data.logsLast7d}
                            />
                            <StatTile
                                label="Doses logged (30d)"
                                value={data.logsLast30d}
                            />
                        </div>

                        {/* Supply */}
                        <div className="p-4 rounded-lg border bg-card">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Supply
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <Kv label="Dispensed" value={String(data.dispensedQty)} />
                                <Kv label="Consumed" value={String(data.consumedQty)} />
                                <Kv
                                    label="Started"
                                    value={data.startDate ? new Date(data.startDate).toLocaleDateString() : "—"}
                                />
                                <Kv
                                    label="Expected end"
                                    value={data.expectedEndDate ? new Date(data.expectedEndDate).toLocaleDateString() : "—"}
                                />
                            </div>
                        </div>

                        {/* Dispense history */}
                        <div className="p-4 rounded-lg border bg-card">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                Dispense history ({data.dispenseHistory.length})
                            </h4>
                            {data.dispenseHistory.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No dispenses recorded yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.dispenseHistory.slice(0, 10).map((d) => (
                                        <div
                                            key={d.id}
                                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/30"
                                        >
                                            <div className="flex-1">
                                                <p className="font-medium">
                                                    {new Date(d.createdAt).toLocaleDateString()}
                                                </p>
                                                <p className="text-muted-foreground">
                                                    {d.items
                                                        .map((i) => `${i.medicine?.name || "?"} ×${i.quantity}`)
                                                        .join(", ")}
                                                </p>
                                            </div>
                                            <div className="text-right font-medium">
                                                ₹{d.totalAmount.toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Missed slots */}
                        {data.missedSlots.length > 0 && (
                            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                                <h4 className="text-sm font-semibold mb-2 text-amber-900">
                                    Missed slots ({data.missedSlots.length})
                                </h4>
                                <p className="text-xs text-amber-800">
                                    Last 30 days. Review with patient during next consultation.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function AdherenceTile({ label, rate }: { label: string; rate: number | null }) {
    const pct = rate != null ? Math.round(rate * 100) : null;
    const color =
        pct == null ? "text-muted-foreground"
            : pct >= 80 ? "text-emerald-700"
                : pct >= 60 ? "text-amber-700"
                    : "text-red-700";
    return (
        <div className="p-3 rounded-lg bg-muted/40">
            <div className="text-[10px] uppercase text-muted-foreground font-medium">{label}</div>
            <div className={cn("text-xl font-bold mt-1", color)}>
                {pct != null ? `${pct}%` : "—"}
            </div>
        </div>
    );
}

function StatTile({ label, value }: { label: string; value: number }) {
    return (
        <div className="p-3 rounded-lg bg-muted/40">
            <div className="text-[10px] uppercase text-muted-foreground font-medium">{label}</div>
            <div className="text-xl font-bold mt-1">{value}</div>
        </div>
    );
}

function Kv({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-muted-foreground">{label}</div>
            <div className="font-medium">{value}</div>
        </div>
    );
}
