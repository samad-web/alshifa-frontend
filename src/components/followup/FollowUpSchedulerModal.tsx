import { useEffect, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
    CalendarClock,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import {
    FOLLOW_UP_OPTIONS,
    FollowUpInterval,
    FollowUpPayload,
} from "@/services/followUp.service";

/**
 * Mandatory follow-up scheduler.
 *
 * Called from the consultation-completion flow: the clinician must
 * either pick a preset interval (7 / 14 / 30 / 60 / 90 days), supply a
 * custom day offset, or explicitly mark the case as a single-visit.
 * The parent owns the "complete" API call — this component only
 * collects the decision and hands it back via onSubmit.
 */
export interface FollowUpSchedulerModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (payload: FollowUpPayload) => Promise<void> | void;
    patientName?: string;
    /** Rendered when the caller is processing the final API call */
    submitting?: boolean;
    /** Previously-saved follow-up, if editing instead of first-time set */
    initial?: FollowUpPayload | null;
    /** Override the CTA label (defaults to "Complete Consultation") */
    submitLabel?: string;
}

export function FollowUpSchedulerModal({
    open,
    onClose,
    onSubmit,
    patientName,
    submitting,
    initial,
    submitLabel = "Complete Consultation",
}: FollowUpSchedulerModalProps) {
    const [interval, setInterval] = useState<FollowUpInterval | null>(initial?.interval ?? null);
    const [customDays, setCustomDays] = useState<string>(
        initial?.interval === "CUSTOM" && initial.daysOffset ? String(initial.daysOffset) : "21",
    );
    const [notes, setNotes] = useState(initial?.notes ?? "");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setInterval(initial?.interval ?? null);
            setCustomDays(initial?.interval === "CUSTOM" && initial.daysOffset ? String(initial.daysOffset) : "21");
            setNotes(initial?.notes ?? "");
            setError(null);
        }
    }, [open, initial]);

    const handleSubmit = async () => {
        if (!interval) {
            setError("Pick a follow-up interval or mark as single visit");
            return;
        }
        let daysOffset: number | undefined;
        if (interval === "CUSTOM") {
            const parsed = parseInt(customDays, 10);
            if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
                setError("Custom follow-up must be between 1 and 365 days");
                return;
            }
            daysOffset = parsed;
        }
        setError(null);
        const payload: FollowUpPayload = {
            interval,
            ...(daysOffset !== undefined ? { daysOffset } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
        await onSubmit(payload);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarClock className="w-5 h-5 text-primary" />
                        Assign a follow-up schedule
                    </DialogTitle>
                    <DialogDescription>
                        {patientName
                            ? `Every completed consultation for ${patientName} needs a follow-up decision.`
                            : "Every completed consultation needs a follow-up decision."}
                        {" "}Choose when to see the patient again, or mark this as a single visit.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {FOLLOW_UP_OPTIONS.map((opt) => {
                            const isSelected = interval === opt.interval;
                            const isSingle = opt.interval === "SINGLE_VISIT";
                            return (
                                <button
                                    key={opt.interval}
                                    type="button"
                                    onClick={() => setInterval(opt.interval)}
                                    className={cn(
                                        "text-left p-3 rounded-xl border transition-all",
                                        "hover:border-primary/40 hover:bg-primary/5",
                                        isSelected
                                            ? isSingle
                                                ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20"
                                                : "border-primary bg-primary/10 ring-2 ring-primary/20"
                                            : "border-border bg-card",
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-sm">{opt.label}</span>
                                        {isSelected && (
                                            <CheckCircle2
                                                className={cn(
                                                    "w-4 h-4",
                                                    isSingle ? "text-emerald-500" : "text-primary",
                                                )}
                                            />
                                        )}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {opt.description}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {interval === "CUSTOM" && (
                        <div className="space-y-1.5">
                            <Label htmlFor="fu-days">Days until follow-up</Label>
                            <Input
                                id="fu-days"
                                type="number"
                                min={1}
                                max={365}
                                value={customDays}
                                onChange={(e) => setCustomDays(e.target.value)}
                                placeholder="e.g. 21"
                            />
                            <p className="text-xs text-muted-foreground">
                                Must be between 1 and 365 days.
                            </p>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="fu-notes">Notes (optional)</Label>
                        <Textarea
                            id="fu-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Anything the patient should prepare, bring, or watch for…"
                            className="min-h-[80px]"
                            maxLength={500}
                        />
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-sm text-destructive">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !interval}>
                        {submitting ? "Saving…" : submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default FollowUpSchedulerModal;
