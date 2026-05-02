import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    FileText,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Send,
} from "lucide-react";
import { ApiClientError } from "@/lib/api-client";
import {
    healthReportService,
    type HealthReportPreview,
} from "@/services/healthReport.service";

interface GenerateReportButtonProps {
    appointmentId: string;
    patientId: string;
    patientName: string;
    patientHasWhatsApp: boolean;
}

/** ✓ green check / ⚠ amber alert row used in the preview checklist. */
function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
    return (
        <li className="flex items-start gap-2 text-sm">
            {ok ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden />
            )}
            <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        </li>
    );
}

function PreviewSkeleton() {
    return (
        <ul className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded-full" />
                    <Skeleton className="h-3 flex-1 max-w-[60%]" />
                </li>
            ))}
        </ul>
    );
}

function formatReportDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }) + " at " + d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
}

export function GenerateReportButton({
    appointmentId,
    patientId,
    patientName,
    patientHasWhatsApp,
}: GenerateReportButtonProps) {
    const qc = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sendWhatsApp, setSendWhatsApp] = useState(patientHasWhatsApp);
    const [alreadyExisted, setAlreadyExisted] = useState(false);
    const [existingReportId, setExistingReportId] = useState<string | null>(null);
    const [existingReportSentViaWhatsApp, setExistingReportSentViaWhatsApp] = useState(false);
    const [existingReportCreatedAt, setExistingReportCreatedAt] = useState<string | null>(null);

    // Preview only fires when the modal opens — keeps the consult-room cold
    // start fast.
    const { data: previewData, isLoading: previewLoading } = useQuery({
        queryKey: ["report-preview", appointmentId, patientId],
        queryFn: () => healthReportService.getPreview(patientId, appointmentId),
        enabled: isModalOpen,
        staleTime: 15_000,
    });

    // If the preview tells us a report already exists for this appointment,
    // jump straight into State B without making the doctor click Generate first.
    const existingFromPreview = previewData?.existingReport ?? null;
    const showAlreadyExistedScreen =
        alreadyExisted || (!!existingFromPreview && !previewLoading);
    const effectiveExistingReportId = existingReportId ?? existingFromPreview?.id ?? null;
    const effectiveExistingCreatedAt = existingReportCreatedAt ?? existingFromPreview?.createdAt ?? null;
    const effectiveExistingSentViaWA = existingReportSentViaWhatsApp || (existingFromPreview?.sentViaWhatsApp ?? false);

    const generateMutation = useMutation({
        mutationFn: () =>
            healthReportService.generate({
                appointmentId,
                patientId,
                sendWhatsApp: sendWhatsApp && patientHasWhatsApp,
            }),
        onSuccess: (data) => {
            // Refresh the patient's report list / timeline so views stay in sync.
            qc.invalidateQueries({ queryKey: ["health-reports"] });
            qc.invalidateQueries({ queryKey: ["report-preview", appointmentId, patientId] });

            if (data.alreadyExisted) {
                setAlreadyExisted(true);
                setExistingReportId(data.report.id);
                setExistingReportCreatedAt(data.report.createdAt);
                setExistingReportSentViaWhatsApp(data.report.sentViaWhatsApp);
                return;
            }

            const wasSentViaWA = sendWhatsApp && patientHasWhatsApp;
            const deliveryFailed = wasSentViaWA && data.report.whatsappDelivered === false;

            setIsModalOpen(false);
            if (deliveryFailed) {
                toast.warning("Health report generated, but WhatsApp delivery failed", {
                    description: data.report.whatsappError || "You can resend from the patient's report list.",
                });
            } else if (wasSentViaWA && data.report.whatsappDelivered) {
                toast.success("Health report generated and sent to patient via WhatsApp");
            } else {
                toast.success("Health report generated successfully");
            }
        },
        onError: (err) => {
            const msg = err instanceof ApiClientError
                ? err.message
                : err instanceof Error
                    ? err.message
                    : "Failed to generate report";
            toast.error(msg);
        },
    });

    const resendMutation = useMutation({
        mutationFn: () => {
            if (!effectiveExistingReportId) throw new Error("No report to resend");
            return healthReportService.resendWhatsApp(effectiveExistingReportId);
        },
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["health-reports"] });
            if (data.whatsappDelivered) {
                setIsModalOpen(false);
                toast.success("Report resent to patient via WhatsApp");
            } else {
                toast.error(data.whatsappError || "Failed to resend report via WhatsApp");
            }
        },
        onError: () => {
            toast.error("Failed to resend report via WhatsApp");
        },
    });

    function handleOpen() {
        // Reset transient state every time the modal opens so a stale
        // "already existed" view from a prior session doesn't bleed through.
        setAlreadyExisted(false);
        setExistingReportId(null);
        setExistingReportCreatedAt(null);
        setExistingReportSentViaWhatsApp(false);
        setSendWhatsApp(patientHasWhatsApp);
        setIsModalOpen(true);
    }

    function handleClose() {
        if (generateMutation.isPending || resendMutation.isPending) return;
        setIsModalOpen(false);
    }

    const isLoadingAction = generateMutation.isPending || resendMutation.isPending;

    return (
        <TooltipProvider delayDuration={250}>
            <Button
                variant="outline"
                size="sm"
                onClick={handleOpen}
                className="border-primary text-primary hover:bg-primary/10 hover:text-primary"
            >
                <FileText className="w-4 h-4 mr-2" />
                Generate Health Report
            </Button>

            <Dialog open={isModalOpen} onOpenChange={(open) => (open ? setIsModalOpen(true) : handleClose())}>
                <DialogContent className="sm:max-w-[520px]">
                    {showAlreadyExistedScreen ? (
                        // ── State B — report already generated for this appointment ─────
                        <>
                            <DialogHeader>
                                <DialogTitle>Report Already Generated</DialogTitle>
                                <DialogDescription>
                                    A health report was already generated for this consultation
                                    {effectiveExistingCreatedAt
                                        ? ` on ${formatReportDate(effectiveExistingCreatedAt)}`
                                        : ""}
                                    .
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-2">
                                <p className="text-sm text-muted-foreground">
                                    {effectiveExistingSentViaWA ? (
                                        <span className="text-emerald-700">Sent via WhatsApp ✓</span>
                                    ) : (
                                        <span>Not sent via WhatsApp</span>
                                    )}
                                </p>
                                {patientName && (
                                    <p className="mt-1 text-xs text-muted-foreground">Patient: {patientName}</p>
                                )}
                            </div>
                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={handleClose} disabled={isLoadingAction}>
                                    Close
                                </Button>
                                {patientHasWhatsApp && effectiveExistingReportId && (
                                    <Button
                                        onClick={() => resendMutation.mutate()}
                                        disabled={isLoadingAction}
                                        className="bg-primary hover:bg-primary/90"
                                    >
                                        {resendMutation.isPending ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4 mr-2" />
                                        )}
                                        Resend via WhatsApp
                                    </Button>
                                )}
                            </DialogFooter>
                        </>
                    ) : (
                        // ── State A — normal generate flow ──────────────────────────────
                        <>
                            <DialogHeader>
                                <DialogTitle>Generate Health Report</DialogTitle>
                                <DialogDescription>
                                    A branded PDF will be generated from this patient's consultation data.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="py-2 space-y-4">
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                                        What will be included
                                    </p>
                                    {previewLoading ? (
                                        <PreviewSkeleton />
                                    ) : (
                                        <ChecklistFromPreview preview={previewData ?? null} />
                                    )}
                                </div>

                                <div className="rounded-lg border border-border/60 p-3 bg-muted/30">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex flex-col">
                                            <Label htmlFor="send-whatsapp" className="text-sm font-medium">
                                                Send to patient via WhatsApp
                                            </Label>
                                            {sendWhatsApp && patientHasWhatsApp && (
                                                <span className="text-[11px] text-muted-foreground mt-0.5">
                                                    PDF will be sent as a WhatsApp document
                                                </span>
                                            )}
                                        </div>
                                        {patientHasWhatsApp ? (
                                            <Switch
                                                id="send-whatsapp"
                                                checked={sendWhatsApp}
                                                onCheckedChange={setSendWhatsApp}
                                                disabled={generateMutation.isPending}
                                            />
                                        ) : (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    {/* span wrapper required so the disabled Switch still triggers the tooltip */}
                                                    <span>
                                                        <Switch
                                                            id="send-whatsapp"
                                                            checked={false}
                                                            disabled
                                                        />
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>Patient has no WhatsApp number configured</TooltipContent>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                    disabled={generateMutation.isPending}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => generateMutation.mutate()}
                                    disabled={generateMutation.isPending}
                                    className="bg-primary hover:bg-primary/90"
                                >
                                    {generateMutation.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating…
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="w-4 h-4 mr-2" />
                                            Generate Report
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}

/**
 * Renders the "what will be included" checklist from a preview payload.
 * Some rows (patient details, key clinical findings) are always green —
 * the service backfills them from canonical fields that always exist.
 */
function ChecklistFromPreview({ preview }: { preview: HealthReportPreview | null }) {
    const hasTriage          = !!preview?.hasTriage;
    const painRegions        = preview?.painRegionCount ?? 0;
    const hasNotes           = !!preview?.hasConsultationNotes;
    const rxCount            = preview?.prescriptionCount ?? 0;
    const hasJourney         = !!preview?.hasJourney;
    const hasDiet            = !!preview?.hasDiet;
    const hasNextAppointment = !!preview?.hasNextAppointment;

    return (
        <ul className="space-y-1.5">
            <ChecklistRow ok label="Patient details & demographics" />
            <ChecklistRow ok label="Key clinical findings & BMI" />
            <ChecklistRow
                ok={hasTriage && painRegions > 0}
                label={
                    hasTriage && painRegions > 0
                        ? `Pain map findings (${painRegions} region${painRegions === 1 ? "" : "s"})`
                        : hasTriage
                            ? "Pain map findings — no regions logged"
                            : "Pain map findings — no triage on file"
                }
            />
            <ChecklistRow
                ok={hasNotes}
                label={hasNotes ? "Consultation notes" : "Consultation notes — none recorded"}
            />
            <ChecklistRow
                ok={rxCount > 0}
                label={
                    rxCount > 0
                        ? `Medicines prescribed: ${rxCount} item${rxCount === 1 ? "" : "s"}`
                        : "Medicines prescribed — none in this consultation"
                }
            />
            <ChecklistRow
                ok={hasJourney}
                label={
                    hasJourney
                        ? `Active treatment journey${preview?.journeyTitle ? ` — ${preview.journeyTitle}` : ""}`
                        : "Active treatment journey — none assigned"
                }
            />
            <ChecklistRow
                ok={hasDiet}
                label={
                    hasDiet
                        ? `Diet recommendation${preview?.dietTitle ? ` — ${preview.dietTitle}` : ""}`
                        : "Diet recommendation — no diet plan"
                }
            />
            <ChecklistRow
                ok={hasNextAppointment}
                label={hasNextAppointment ? "Next appointment scheduled" : "Next appointment — none scheduled"}
            />
        </ul>
    );
}

export default GenerateReportButton;
