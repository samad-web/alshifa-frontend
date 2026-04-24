import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { prescriptionsApi } from "@/services/prescriptions.service";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

interface DiscontinuePrescriptionDialogProps {
    prescriptionId: string | null;
    medicationName?: string;
    onClose: () => void;
    onDiscontinued?: () => void;
}

export function DiscontinuePrescriptionDialog({
    prescriptionId,
    medicationName,
    onClose,
    onDiscontinued,
}: DiscontinuePrescriptionDialogProps) {
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!prescriptionId) return;
        setSubmitting(true);
        try {
            await prescriptionsApi.discontinue(prescriptionId, reason.trim() || undefined);
            toast.success("Prescription discontinued");
            onDiscontinued?.();
            setReason("");
            onClose();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to discontinue";
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={!!prescriptionId}
            onOpenChange={(open) => {
                if (!open) {
                    setReason("");
                    onClose();
                }
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-5 w-5" />
                        Discontinue prescription
                    </DialogTitle>
                    <DialogDescription>
                        {medicationName
                            ? `This will stop all refill reminders and missed-dose follow-ups for ${medicationName}. The patient will be notified.`
                            : "This will stop all refill reminders and missed-dose follow-ups. The patient will be notified."}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <label className="text-sm font-medium">
                        Reason <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Course completed, side effects, treatment changed"
                        maxLength={500}
                        rows={3}
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Discontinue"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
