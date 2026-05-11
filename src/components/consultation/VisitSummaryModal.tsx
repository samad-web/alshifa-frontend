/**
 * Visit Summary modal — inline post-consultation document.
 *
 * Mounted from the Consultation Room's right-column "Visit Summary"
 * section. Lets the doctor or therapist write the structured patient
 * takeaway document (diagnosis, prescriptions, exercise plan, etc.)
 * without leaving the consultation.
 *
 * Three modes:
 *   - No summary yet → editable form, pre-filled via auto-generate when
 *     possible. Footer: Cancel | Save Draft | Save & Send to Patient.
 *   - DRAFT summary exists → read-only display + a Send-to-Patient action.
 *     (The backend has no UPDATE endpoint for VisitSummary; once created,
 *     fields are immutable. This mirrors the standalone /visit-summary
 *     page's behaviour.)
 *   - SENT summary → read-only display only. Banner notes the send date.
 *
 * All endpoints reused via the existing `communicationApi`:
 *   - getVisitSummary(appointmentId)         → 404 means no summary yet
 *   - autoGenerateVisitSummary(appointmentId) → pre-fill source for new
 *   - createVisitSummary(payload)            → POST /api/visit-summary
 *   - sendSummaryToPatient(summaryId)        → POST /:id/send
 */

import { useCallback, useEffect, useState } from "react";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, Plus, Save, Send, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { communicationApi } from "@/services/communication.service";
import { ApiClientError } from "@/lib/api-client";
import type { VisitSummaryEntry } from "@/types";

interface PrescriptionRow { medication: string; dosage: string; frequency: string; duration: string; }
interface ExerciseRow    { exercise: string; sets: number; reps: number; frequency: string; }

interface VisitSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointmentId: string;
    /** Called after successful create. Parent uses this to refresh the
     *  right-column badge ("DRAFT" or "SENT"). */
    onSaved?: (record: VisitSummaryEntry) => void;
    /** Called after successful send. Parent flips the badge to "SENT". */
    onSent?: (record: VisitSummaryEntry) => void;
}

const BLANK_RX: PrescriptionRow = { medication: "", dosage: "", frequency: "", duration: "" };
const BLANK_EX: ExerciseRow    = { exercise: "", sets: 0, reps: 0, frequency: "" };

function formatSentAt(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

/** Map auto-generate's exercise shape (which mirrors VideoPrescription) onto
 *  our form's row shape so the inputs render with sane defaults. */
function normaliseExerciseRow(ex: unknown): ExerciseRow {
    const e = ex as Record<string, unknown>;
    return {
        exercise: (e?.exercise as string) || (e?.title as string) || "",
        sets: typeof e?.sets === "number" ? e.sets : 0,
        reps: typeof e?.reps === "number" ? e.reps : 0,
        frequency: (e?.frequency as string) || (e?.notes as string) || "",
    };
}

export function VisitSummaryModal({
    isOpen, onClose, appointmentId, onSaved, onSent,
}: VisitSummaryModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [sending, setSending] = useState(false);
    const [existing, setExisting] = useState<VisitSummaryEntry | null>(null);

    // Form state
    const [diagnosis, setDiagnosis] = useState("");
    const [treatmentNotes, setTreatmentNotes] = useState("");
    const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([{ ...BLANK_RX }]);
    const [exercises, setExercises] = useState<ExerciseRow[]>([{ ...BLANK_EX }]);
    const [dietaryAdvice, setDietaryAdvice] = useState("");
    const [nextSteps, setNextSteps] = useState("");
    const [followUpDate, setFollowUpDate] = useState("");

    function resetForm() {
        setExisting(null);
        setDiagnosis("");
        setTreatmentNotes("");
        setPrescriptions([{ ...BLANK_RX }]);
        setExercises([{ ...BLANK_EX }]);
        setDietaryAdvice("");
        setNextSteps("");
        setFollowUpDate("");
    }

    /** Apply a partial visit summary payload onto the form fields. Shared by
     *  the existing-summary load path AND the auto-generate pre-fill path so
     *  field mapping logic stays in one place. */
    const applyPayload = useCallback((payload: Partial<VisitSummaryEntry>) => {
        if (payload.diagnosis) setDiagnosis(payload.diagnosis);
        if (payload.treatmentNotes) setTreatmentNotes(payload.treatmentNotes);
        if (Array.isArray(payload.prescriptions) && payload.prescriptions.length > 0) {
            setPrescriptions(payload.prescriptions.map((p) => ({
                medication: p.medication || "",
                dosage: p.dosage || "",
                frequency: p.frequency || "",
                duration: p.duration || "",
            })));
        }
        if (Array.isArray(payload.exercisePlan) && payload.exercisePlan.length > 0) {
            setExercises(payload.exercisePlan.map(normaliseExerciseRow));
        }
        if (payload.dietaryAdvice) setDietaryAdvice(payload.dietaryAdvice);
        if (payload.nextSteps) setNextSteps(payload.nextSteps);
        if (payload.followUpDate) {
            // Backend returns ISO datetime; DatePicker wants yyyy-MM-dd.
            setFollowUpDate(String(payload.followUpDate).slice(0, 10));
        }
    }, []);

    // On open: load existing summary if one exists, else auto-generate a draft.
    useEffect(() => {
        if (!isOpen || !appointmentId) return;
        let cancelled = false;
        setLoading(true);
        resetForm();

        (async () => {
            try {
                const found = await communicationApi.getVisitSummary(appointmentId);
                if (cancelled) return;
                setExisting(found);
                applyPayload(found);
            } catch (err) {
                // 404 = no summary yet → try auto-generate for a pre-filled draft.
                if (err instanceof ApiClientError && err.status === 404) {
                    try {
                        const draft = await communicationApi.autoGenerateVisitSummary(appointmentId);
                        if (cancelled) return;
                        applyPayload(draft as Partial<VisitSummaryEntry>);
                    } catch {
                        // Auto-gen failure is non-fatal — leave the form blank for
                        // the user to fill manually. Toast suppressed so the dialog
                        // open doesn't feel error-y to the doctor.
                    }
                }
                // Any other error: silently leave the form blank. Save attempts
                // will surface their own error toasts.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [isOpen, appointmentId, applyPayload]);

    // ── Row helpers ─────────────────────────────────────────────────────
    const addRx    = () => setPrescriptions((p) => [...p, { ...BLANK_RX }]);
    const removeRx = (idx: number) => setPrescriptions((p) => p.filter((_, i) => i !== idx));
    const updateRx = (idx: number, field: keyof PrescriptionRow, value: string) =>
        setPrescriptions((p) => p.map((r, i) => i === idx ? { ...r, [field]: value } : r));

    const addEx    = () => setExercises((p) => [...p, { ...BLANK_EX }]);
    const removeEx = (idx: number) => setExercises((p) => p.filter((_, i) => i !== idx));
    const updateEx = (idx: number, field: keyof ExerciseRow, value: string | number) =>
        setExercises((p) => p.map((r, i) => i === idx ? { ...r, [field]: value } : r));

    // ── Save ────────────────────────────────────────────────────────────
    async function handleSave(sendToPatient: boolean) {
        if (!appointmentId) return;
        setSubmitting(true);
        try {
            // Filter empty rows the same way the standalone page does — keeps
            // the JSON columns from accumulating empty {} objects.
            const filteredRx = prescriptions.filter((p) => p.medication.trim());
            const filteredEx = exercises.filter((e) => e.exercise.trim());

            const summary = await communicationApi.createVisitSummary({
                appointmentId,
                diagnosis: diagnosis.trim() || undefined,
                treatmentNotes: treatmentNotes.trim() || undefined,
                prescriptions: filteredRx.length > 0 ? filteredRx : undefined,
                exercisePlan: filteredEx.length > 0 ? filteredEx : undefined,
                dietaryAdvice: dietaryAdvice.trim() || undefined,
                nextSteps: nextSteps.trim() || undefined,
                followUpDate: followUpDate || undefined,
            });

            setExisting(summary);
            onSaved?.(summary);

            if (sendToPatient) {
                const sent = await communicationApi.sendSummaryToPatient(summary.id);
                setExisting(sent);
                onSent?.(sent);
                toast.success("Summary saved and sent to patient");
                onClose();
            } else {
                toast.success("Visit summary saved");
                // Stay open in read-only mode — the existing summary is now
                // immutable per backend (no UPDATE endpoint), so the form
                // flips to display mode.
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to save summary";
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    }

    // ── Send existing DRAFT to patient (no re-save) ─────────────────────
    async function handleSendExisting() {
        if (!existing?.id) return;
        setSending(true);
        try {
            const sent = await communicationApi.sendSummaryToPatient(existing.id);
            setExisting(sent);
            onSent?.(sent);
            toast.success("Visit summary sent to patient");
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send");
        } finally {
            setSending(false);
        }
    }

    const isReadOnly = !!existing; // Once created, fields are immutable per backend.
    const isSent = !!existing?.sentToPatient;

    return (
        <Dialog open={isOpen} onOpenChange={(o) => { if (!o && !submitting && !sending) onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                        Visit Summary
                    </DialogTitle>
                    <DialogDescription>
                        Structured post-consultation document the patient sees in their portal.
                    </DialogDescription>
                </DialogHeader>

                {/* Status banner — shown for existing summaries */}
                {existing && (
                    <div className={`rounded-md p-3 text-sm ${
                        isSent
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : "bg-amber-50 border border-amber-200 text-amber-800"
                    }`}>
                        {isSent ? (
                            <>✓ Sent to patient on {formatSentAt(existing.sentAt)}. Fields are read-only.</>
                        ) : (
                            <>📝 Saved as draft. Fields are read-only — backend has no edit endpoint. Click <strong>Send to Patient</strong> below to deliver, or close and re-open after a backend update if you need to revise.</>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        {/* Diagnosis */}
                        <div className="space-y-1.5">
                            <Label className="text-sm" htmlFor="vs-diagnosis">Diagnosis</Label>
                            <Textarea
                                id="vs-diagnosis"
                                rows={3}
                                value={diagnosis}
                                onChange={(e) => setDiagnosis(e.target.value)}
                                placeholder="Clinical impression / diagnosis"
                                disabled={isReadOnly}
                            />
                        </div>

                        {/* Treatment notes */}
                        <div className="space-y-1.5">
                            <Label className="text-sm" htmlFor="vs-notes">Treatment notes</Label>
                            <Textarea
                                id="vs-notes"
                                rows={4}
                                value={treatmentNotes}
                                onChange={(e) => setTreatmentNotes(e.target.value)}
                                placeholder="What was discussed and prescribed during this visit"
                                disabled={isReadOnly}
                            />
                        </div>

                        {/* Prescriptions — repeating rows */}
                        <div className="space-y-2">
                            <Label className="text-sm">Prescriptions</Label>
                            {prescriptions.map((rx, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                                    <Input
                                        className="col-span-4"
                                        placeholder="Medication"
                                        value={rx.medication}
                                        onChange={(e) => updateRx(idx, "medication", e.target.value)}
                                        disabled={isReadOnly}
                                    />
                                    <Input
                                        className="col-span-2"
                                        placeholder="Dosage"
                                        value={rx.dosage}
                                        onChange={(e) => updateRx(idx, "dosage", e.target.value)}
                                        disabled={isReadOnly}
                                    />
                                    <Input
                                        className="col-span-3"
                                        placeholder="Frequency"
                                        value={rx.frequency}
                                        onChange={(e) => updateRx(idx, "frequency", e.target.value)}
                                        disabled={isReadOnly}
                                    />
                                    <Input
                                        className="col-span-2"
                                        placeholder="Duration"
                                        value={rx.duration}
                                        onChange={(e) => updateRx(idx, "duration", e.target.value)}
                                        disabled={isReadOnly}
                                    />
                                    {!isReadOnly && prescriptions.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="col-span-1 h-9 w-9 text-muted-foreground"
                                            onClick={() => removeRx(idx)}
                                            aria-label="Remove prescription row"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <Button type="button" variant="outline" size="sm" onClick={addRx} className="gap-1">
                                    <Plus className="w-3 h-3" /> Add prescription
                                </Button>
                            )}
                        </div>

                        {/* Exercise plan — repeating rows */}
                        <div className="space-y-2">
                            <Label className="text-sm">Exercise plan</Label>
                            {exercises.map((ex, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                                    <Input
                                        className="col-span-5"
                                        placeholder="Exercise"
                                        value={ex.exercise}
                                        onChange={(e) => updateEx(idx, "exercise", e.target.value)}
                                        disabled={isReadOnly}
                                    />
                                    <Input
                                        className="col-span-2"
                                        type="number"
                                        min={0}
                                        placeholder="Sets"
                                        value={ex.sets || ""}
                                        onChange={(e) => updateEx(idx, "sets", Number(e.target.value) || 0)}
                                        disabled={isReadOnly}
                                    />
                                    <Input
                                        className="col-span-2"
                                        type="number"
                                        min={0}
                                        placeholder="Reps"
                                        value={ex.reps || ""}
                                        onChange={(e) => updateEx(idx, "reps", Number(e.target.value) || 0)}
                                        disabled={isReadOnly}
                                    />
                                    <Input
                                        className="col-span-2"
                                        placeholder="Frequency"
                                        value={ex.frequency}
                                        onChange={(e) => updateEx(idx, "frequency", e.target.value)}
                                        disabled={isReadOnly}
                                    />
                                    {!isReadOnly && exercises.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="col-span-1 h-9 w-9 text-muted-foreground"
                                            onClick={() => removeEx(idx)}
                                            aria-label="Remove exercise row"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <Button type="button" variant="outline" size="sm" onClick={addEx} className="gap-1">
                                    <Plus className="w-3 h-3" /> Add exercise
                                </Button>
                            )}
                        </div>

                        {/* Dietary advice */}
                        <div className="space-y-1.5">
                            <Label className="text-sm" htmlFor="vs-diet">Dietary advice</Label>
                            <Textarea
                                id="vs-diet"
                                rows={3}
                                value={dietaryAdvice}
                                onChange={(e) => setDietaryAdvice(e.target.value)}
                                placeholder="Ayurvedic diet guidance specific to this visit"
                                disabled={isReadOnly}
                            />
                        </div>

                        {/* Next steps */}
                        <div className="space-y-1.5">
                            <Label className="text-sm" htmlFor="vs-next">Next steps</Label>
                            <Textarea
                                id="vs-next"
                                rows={3}
                                value={nextSteps}
                                onChange={(e) => setNextSteps(e.target.value)}
                                placeholder="What the patient should do before the next visit"
                                disabled={isReadOnly}
                            />
                        </div>

                        {/* Follow-up date */}
                        <div className="space-y-1.5">
                            <Label className="text-sm" htmlFor="vs-followup">Follow-up date (optional)</Label>
                            <DatePicker
                                id="vs-followup"
                                value={followUpDate}
                                onChange={(iso) => setFollowUpDate(iso)}
                                disabled={isReadOnly}
                                className="w-48"
                            />
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {isReadOnly ? (
                        <>
                            <Button variant="ghost" onClick={onClose} disabled={sending}>Close</Button>
                            {!isSent && (
                                <Button onClick={handleSendExisting} disabled={sending}>
                                    {sending
                                        ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending…</>
                                        : <><Send className="w-4 h-4 mr-1" /> Send to Patient</>}
                                </Button>
                            )}
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
                            <Button
                                variant="outline"
                                onClick={() => void handleSave(false)}
                                disabled={submitting || loading}
                            >
                                {submitting
                                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
                                    : <><Save className="w-4 h-4 mr-1" /> Save Draft</>}
                            </Button>
                            <Button
                                onClick={() => void handleSave(true)}
                                disabled={submitting || loading}
                            >
                                {submitting
                                    ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Saving…</>
                                    : <><Send className="w-4 h-4 mr-1" /> Save & Send to Patient</>}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
