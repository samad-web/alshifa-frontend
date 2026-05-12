import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput, toDDMMYYYY } from "@/components/common/DateInput";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Loader2, Video, MapPin, ChevronRight, ChevronLeft, Activity, Check, Sun, Sunset, Moon, CalendarOff } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { TriageQuestionnaire } from "../triage/TriageQuestionnaire";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiClient } from "@/lib/api-client";
import {
    selfExamService,
    type SelfExamBundle,
    type PainZone,
} from "@/services/selfExam.service";
import { ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ClientBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialBranchId?: string;
}

type Step = "branch" | "type" | "clinician" | "triage" | "self-exam-intro" | "time" | "confirm";

export function ClientBookingModal({
    isOpen,
    onClose,
    onSuccess,
    initialBranchId,
}: ClientBookingModalProps) {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<Step>("branch");
    const [branches, setBranches] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [availableSlots, setAvailableSlots] = useState<any[]>([]);
    const [fetchingSlots, setFetchingSlots] = useState(false);
    const [triageSessionId, setTriageSessionId] = useState<string | null>(null);
    const [triageResult, setTriageResult] = useState<any>(null);
    const [suggestedSlot, setSuggestedSlot] = useState<string | null>(null);
    // When true the patient has tapped "Change branch" — we expand the
    // full branch grid. Default false so the Branch step shows only the
    // registered branch with a "Change branch" affordance below it.
    const [changingBranch, setChangingBranch] = useState(false);
    // Self-exam kit preview — auto-created by the triage hook.
    const [selfExamBundle, setSelfExamBundle] = useState<SelfExamBundle | null>(null);
    const [loadingSelfExam, setLoadingSelfExam] = useState(false);
    const navigate = useNavigate();

    // Patient booking is doctor-only by design. If therapy is needed, the
    // doctor arranges it after the consultation — not the patient through
    // this flow. consultationType is frozen to "DOCTOR".
    const [formData, setFormData] = useState({
        branchId: "",
        consultationType: "DOCTOR" as const,
        consultationMode: "OFFLINE" as "OFFLINE" | "ONLINE",
        doctorId: "",
        date: undefined as Date | undefined,
        slot: "",
        notes: "",
    });

    const { profile } = useAuth();

    useEffect(() => {
        if (isOpen) {
            fetchBranches();
            setStep(initialBranchId ? "type" : "branch");
            setTriageSessionId(null);
            setTriageResult(null);
            // Pre-seed branchId with the patient's registered branch so the
            // Continue button on the locked-in branch view already has a
            // value to commit. URL-passed initialBranchId still wins.
            setFormData({
                branchId: initialBranchId ?? profile?.branchId ?? "",
                consultationType: "DOCTOR",
                consultationMode: "OFFLINE",
                doctorId: "",
                date: undefined,
                slot: "",
                notes: "",
            });
            setSuggestedSlot(null);
            setChangingBranch(false);
        }
    }, [isOpen, initialBranchId, profile?.branchId]);

    // Fetch staff when entering the clinician step or when branchId changes while on it.
    // No longer depends on date/slot because clinician is now chosen BEFORE date selection.
    useEffect(() => {
        if (formData.branchId && step === "clinician") {
            fetchStaff();
        }
    }, [formData.branchId, step]);

    useEffect(() => {
        if (formData.date && formData.doctorId) {
            fetchSlots();
        }
    }, [formData.date, formData.doctorId]);

    // Load the DRAFT self-exam submission created by the triage-submit hook.
    // Fires once when the patient lands on the self-exam-intro step.
    useEffect(() => {
        if (step !== "self-exam-intro") return;
        let cancelled = false;
        setLoadingSelfExam(true);
        (async () => {
            try {
                const list = await selfExamService.mine();
                const draft = list.find((s) => s.status === "DRAFT");
                if (cancelled || !draft) {
                    if (!cancelled) setSelfExamBundle(null);
                    return;
                }
                const bundle = await selfExamService.get(draft.id);
                if (!cancelled) setSelfExamBundle(bundle);
            } catch {
                // Soft-fail: the intro step renders the "no tests needed" state.
                if (!cancelled) setSelfExamBundle(null);
            } finally {
                if (!cancelled) setLoadingSelfExam(false);
            }
        })();
        return () => { cancelled = true; };
    }, [step]);

    const fetchBranches = async () => {
        try {
            const { data } = await apiClient.get<any[]>('/api/branches');
            setBranches(data || []);
        } catch (error) {
            console.error("Failed to fetch branches:", error);
        }
    };

    const fetchStaff = async () => {
        try {
            const params: Record<string, string> = {};
            if (formData.branchId) params.branchId = formData.branchId;
            if (formData.date) params.date = formData.date.toISOString();
            if (formData.slot) params.slot = formData.slot;

            const { data } = await apiClient.get<any>('/api/appointments/available-staff', params);
            setDoctors(data.doctors || []);

            // If the currently-selected doctor is no longer in the list, clear it.
            if (formData.doctorId && !data.doctors.some((d: any) => d.id === formData.doctorId)) {
                setFormData(prev => ({ ...prev, doctorId: "" }));
                if (step === "confirm") {
                    toast.error("Selected doctor is no longer available for this time. Please choose another.");
                    setStep("clinician");
                }
            }
        } catch (error) {
            console.error("Failed to fetch staff:", error);
        }
    };

    const fetchSlots = async () => {
        if (!formData.date || !formData.doctorId) return;

        setFetchingSlots(true);
        try {
            // Send as YYYY-MM-DD (no time / no timezone offset) so the backend always
            // queries the calendar date the user sees, regardless of the server's UTC offset.
            const dateParam = format(formData.date, "yyyy-MM-dd");
            const { data: slots } = await apiClient.get<any[]>('/api/appointments/available-slots', { clinicianId: formData.doctorId, date: dateParam });
            setAvailableSlots(Array.isArray(slots) ? slots : []);
        } catch (error: any) {
            console.error("Failed to fetch slots:", error);
            setAvailableSlots([]);
            toast.error(error?.message || "Network error — could not load available time slots.");
        } finally {
            setFetchingSlots(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.date || !formData.slot) {
            toast.error("Please select a date and time slot");
            return;
        }
        if (!formData.doctorId) {
            toast.error("Please choose a doctor before confirming.");
            return;
        }

        setLoading(true);
        try {
            const [startTime] = formData.slot.split(" - ");
            const appointmentDate = new Date(formData.date);
            const [hours, minutes] = startTime.split(":");
            appointmentDate.setHours(parseInt(hours), parseInt(minutes));

            await apiClient.post('/api/appointments', {
                consultationType: formData.consultationType,
                consultationMode: formData.consultationMode,
                doctorId: formData.doctorId,
                therapistId: null,
                date: appointmentDate.toISOString(),
                notes: formData.notes,
                triageSessionId: triageSessionId,
                branchId: formData.branchId
            });
            toast.success("Appointment request submitted successfully!");
            // Refresh the parent dashboard now — the booking is durable
            // regardless of whether the patient opens the kit next or skips.
            onSuccess?.();
            // Pivot to the post-booking kit prompt instead of closing. The
            // patient can either start the kit (which closes + navigates)
            // or skip for now (which just closes). Either way the
            // appointment is already on file.
            setStep("self-exam-intro");
        } catch (error: any) {
            if (error?.status === 409) {
                setSuggestedSlot(error?.details?.suggestedSlot || null);
                toast.error("That slot was just taken! We found another one for you.");
            } else {
                toast.error(error?.message || "An error occurred. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const nextStep = () => {
        // self-exam-intro is no longer in the pre-booking chain — it shows
        // up only AFTER `handleSubmit` succeeds, so opening the kit can't
        // abandon a half-finished booking like it used to.
        if (step === "branch") setStep("type");
        else if (step === "type") setStep("triage");
        else if (step === "triage") setStep("clinician");
        else if (step === "clinician") setStep("time");    // slots fetched once clinician is known
        else if (step === "time") setStep("confirm");
    };

    const prevStep = () => {
        if (step === "type" && !initialBranchId) setStep("branch");
        else if (step === "triage") setStep("type");
        else if (step === "clinician") {
            setStep("triage");
            setFormData(prev => ({ ...prev, doctorId: "" }));
        }
        else if (step === "time") setStep("clinician");
        else if (step === "confirm") setStep("time");
    };

    const selectedDoctor = doctors.find(d => d.id === formData.doctorId);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md p-0 bg-card border border-border shadow-elevated rounded-xl max-h-[92vh] overflow-y-auto">
                <div className="px-5 pt-5 pb-3 border-b border-border/50 relative">
                    <DialogHeader className="text-left mb-2">
                        <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-primary" />
                            Book Appointment
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex gap-1.5 mt-4">
                    {(["branch", "type", "triage", "clinician", "time", "confirm"] as Step[]).map((s, i) => (
                            <div
                                key={s}
                                className={cn(
                                    "h-1 flex-1 rounded-full transition-all duration-300",
                                    step === s ? "bg-primary" : (i < ["branch", "type", "triage", "clinician", "time", "confirm"].indexOf(step) ? "bg-primary/40" : "bg-muted")
                                )}
                            />
                        ))}
                    </div>
                </div>

                <div className="p-5 space-y-6">
                    {step === "branch" && (() => {
                        // Default-and-confirm flow: when the patient has a
                        // registered branch and hasn't tapped "Change branch",
                        // show only that branch as a locked-in card with a
                        // Continue button. The full branch grid is one tap
                        // away via the "Change branch" link below it.
                        const registeredBranch = profile?.branchId
                            ? branches.find((b) => b.id === profile.branchId)
                            : null;
                        const showRegisteredOnly = !changingBranch && !!registeredBranch;

                        if (showRegisteredOnly) {
                            return (
                                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                    <Label className="text-base font-bold text-foreground">Your Branch</Label>
                                    <div className="flex items-center gap-3.5 p-3.5 rounded-lg border border-primary bg-primary/5 shadow-sm">
                                        <div className="p-2 bg-primary/10 rounded-md text-primary">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold">{registeredBranch.name}</p>
                                            <p className="text-[11px] text-muted-foreground">{registeredBranch.address}</p>
                                            <p className="text-[10px] text-primary font-semibold mt-0.5 uppercase tracking-wider">Your registered branch</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 pt-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-muted-foreground hover:text-foreground"
                                            onClick={() => setChangingBranch(true)}
                                        >
                                            Change branch
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                setFormData({ ...formData, branchId: registeredBranch.id });
                                                nextStep();
                                            }}
                                        >
                                            Continue <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-base font-bold text-foreground">
                                        {registeredBranch ? "Select a Different Branch" : "Select a Branch"}
                                    </Label>
                                    {registeredBranch && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                                            onClick={() => setChangingBranch(false)}
                                        >
                                            <ChevronLeft className="w-3 h-3 mr-1" />
                                            Use my branch
                                        </Button>
                                    )}
                                </div>
                                <div className="grid gap-2.5">
                                    {branches.map((b) => (
                                        <button
                                            key={b.id}
                                            onClick={() => {
                                                setFormData({ ...formData, branchId: b.id });
                                                nextStep();
                                            }}
                                            className={cn(
                                                "flex items-center gap-3.5 p-3.5 rounded-lg border transition-all hover:border-primary/50 hover:bg-primary/5 text-left",
                                                formData.branchId === b.id ? "border-primary bg-primary/5 shadow-sm" : "border-border"
                                            )}
                                        >
                                            <div className="p-2 bg-primary/10 rounded-md text-primary">
                                                <MapPin className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{b.name}</p>
                                                <p className="text-[11px] text-muted-foreground">{b.address}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                    {step === "type" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <Label className="text-base font-bold text-foreground">How would you like to meet your doctor?</Label>
                            <p className="text-[11px] text-muted-foreground -mt-2">
                                Patients book a doctor. If therapy is needed, the doctor will arrange it after your consultation.
                            </p>
                            <div className="flex gap-2.5">
                                <button
                                    onClick={() => setFormData({ ...formData, consultationMode: "OFFLINE" })}
                                    className={cn(
                                        "flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border text-sm font-medium transition-all",
                                        formData.consultationMode === "OFFLINE" ? "bg-primary/5 border-primary text-primary shadow-sm" : "bg-background border-border hover:bg-muted"
                                    )}
                                >
                                    <MapPin className="w-5 h-5" />
                                    <span className="font-bold">In-person</span>
                                    <span className="text-[10px] text-muted-foreground text-center">Visit the clinic</span>
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, consultationMode: "ONLINE" })}
                                    className={cn(
                                        "flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border text-sm font-medium transition-all",
                                        formData.consultationMode === "ONLINE" ? "bg-primary/5 border-primary text-primary shadow-sm" : "bg-background border-border hover:bg-muted"
                                    )}
                                >
                                    <Video className="w-5 h-5" />
                                    <span className="font-bold">Online</span>
                                    <span className="text-[10px] text-muted-foreground text-center">Video consultation</span>
                                </button>
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button onClick={nextStep}>
                                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === "triage" && (
                        <div className="animate-in fade-in slide-in-from-right-2">
                            <TriageQuestionnaire
                                onComplete={(session) => {
                                    setTriageSessionId(session.id);
                                    setTriageResult(session);
                                    nextStep();
                                }}
                                onCancel={onClose}
                            />
                        </div>
                    )}

                    {step === "self-exam-intro" && (
                        <SelfExamIntroStep
                            bundle={selfExamBundle}
                            loading={loadingSelfExam}
                            confirmed
                            onOpenKit={() => {
                                // Close the Radix dialog first, then navigate on the next tick.
                                // Navigating synchronously while the dialog is still closing
                                // leaves `pointer-events: none` on body → stuck page.
                                onClose();
                                setTimeout(() => navigate("/self-exam"), 0);
                            }}
                            // The booking is already submitted at this point, so
                            // skipping just dismisses the modal — there's no
                            // remaining step to advance to.
                            onLater={onClose}
                        />
                    )}

                    {step === "clinician" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                            {triageResult && (
                                <div className={cn(
                                    "p-3 rounded-lg border text-[11px] leading-relaxed",
                                    triageResult.classification === 'Escalation Required'
                                        ? "bg-risk/10 border-risk/20 text-risk"
                                        : "bg-primary/5 border-primary/20 text-primary"
                                )}>
                                    <p className="font-bold flex items-center gap-1.5 mb-1 uppercase">
                                        <Activity className="w-3 h-3" />
                                        Assessment Result: {triageResult.classification || 'Standard'}
                                    </p>
                                    <p>{triageResult.reasoning || `Based on your responses, we recommend a ${triageResult.suggestedSpecialty || 'General Physician'}.`}</p>
                                </div>
                            )}

                            <Label className="text-base font-bold text-foreground">
                                {triageResult?.classification === 'Escalation Required'
                                    ? "Consult with a Senior Specialist"
                                    : "Choose your Doctor"}
                            </Label>

                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 customize-scrollbar">
                                {doctors
                                    .filter(staff => {
                                        if (!triageResult) return true;

                                        // Escalation enforcement
                                        if (triageResult.classification === 'Escalation Required') {
                                            return staff.user?.role === 'ADMIN_DOCTOR';
                                        }

                                        // Specialist preference
                                        if (triageResult.classification === 'Specialist Required' && triageResult.suggestedSpecialty) {
                                            return staff.specialization?.toLowerCase() === triageResult.suggestedSpecialty.toLowerCase() ||
                                                staff.specialization?.toLowerCase().includes(triageResult.suggestedSpecialty.toLowerCase());
                                        }

                                        return true;
                                    })
                                    .map((staff) => (
                                        <button
                                            key={staff.id}
                                            onClick={() => {
                                                // Admin doctors are reserved for escalations. If the
                                                // patient's triage didn't classify as Escalation Required,
                                                // selecting one is invalid — surface immediately and
                                                // clear the selection so they can pick someone else.
                                                if (
                                                    staff.user?.role === 'ADMIN_DOCTOR' &&
                                                    triageResult?.classification !== 'Escalation Required'
                                                ) {
                                                    toast.error("This case does not qualify for an Admin Doctor. Please select a different doctor.");
                                                    setFormData({ ...formData, doctorId: "" });
                                                    return;
                                                }
                                                setFormData({ ...formData, doctorId: staff.id });
                                                // Real-time availability sniff. Best-effort — failure
                                                // here just means no toast, never blocks the booking.
                                                const dateParam = (formData.date ?? new Date()).toISOString().slice(0, 10);
                                                apiClient
                                                    .get<{ hasAvailableSlots: boolean; nextAvailable: string | null }>(
                                                        '/api/availability/check',
                                                        { doctorId: staff.id, date: dateParam },
                                                    )
                                                    .then(({ data }) => {
                                                        if (!data.hasAvailableSlots) {
                                                            const next = data.nextAvailable
                                                                ? new Date(data.nextAvailable).toLocaleDateString()
                                                                : 'No upcoming slots found';
                                                            toast.error(
                                                                `Dr. ${staff.fullName || 'Selected'} is not available on this date. Next available: ${next}`,
                                                            );
                                                            // Wipe any stale slots so the time picker doesn't suggest
                                                            // a slot the patient can't actually book.
                                                            setAvailableSlots([]);
                                                        }
                                                    })
                                                    .catch(() => { /* silent — backend will surface real errors at slot fetch */ });
                                                nextStep();
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between p-3.5 rounded-lg border transition-all hover:border-primary/50",
                                                formData.doctorId === staff.id
                                                    ? "border-primary bg-primary/5 shadow-sm" : "border-border"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-primary font-bold text-sm">
                                                    {staff.fullName?.charAt(0) || "C"}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{staff.fullName}</p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        {staff.specialization || (staff.user?.role === 'ADMIN_DOCTOR' ? 'Senior Consultant' : 'Medical Practitioner')}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    ))}
                            </div>

                            <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={prevStep}>
                                <ChevronLeft className="w-3.5 h-3.5" />
                                Back to assessment
                            </Button>
                        </div>
                    )}

                    {step === "time" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                            <div className="flex flex-col items-center">
                                <Label className="text-base font-bold mb-4 self-start">Select Date & Time</Label>
                                {/* Text-only DD/MM/YYYY input replaces the
                                    calendar grid platform-wide. minDate=today
                                    enforces "no past bookings". The slot list
                                    below re-fetches automatically once a
                                    valid date is entered (the form watches
                                    formData.date). */}
                                <div className="w-full max-w-xs mb-5">
                                    <DateInput
                                        value={formData.date ? toDDMMYYYY(formData.date) : ""}
                                        onChange={(v) => {
                                            if (!v) {
                                                setFormData({ ...formData, date: undefined, slot: "" });
                                                return;
                                            }
                                            const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
                                            if (!m) return;
                                            const [, dd, mm, yyyy] = m;
                                            const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                                            setFormData({ ...formData, date: d, slot: "" });
                                        }}
                                        minDate={toDDMMYYYY(new Date())}
                                        placeholder="DD/MM/YYYY"
                                    />
                                </div>

                                {formData.date && (() => {
                                    // Only AVAILABLE, non-held slots are bookable. We filter
                                    // here (not inside SlotPicker) so the empty state below
                                    // fires correctly even when the API returns rows that
                                    // are all BOOKED/BLOCKED/HELD — the patient should not
                                    // see disabled tiles for a clinician with no openings.
                                    const bookableSlots = availableSlots.filter(
                                        (s: any) => s.status === 'AVAILABLE' && !s.isHeld,
                                    );
                                    return (
                                        <div className="w-full space-y-3">
                                            <div className="flex items-baseline justify-between">
                                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                    Available times for {format(formData.date, "PPP")}
                                                </Label>
                                                {!fetchingSlots && (
                                                    <span
                                                        className={cn(
                                                            "text-[11px] font-medium",
                                                            bookableSlots.length > 0 ? "text-green-600" : "text-red-500",
                                                        )}
                                                        aria-live="polite"
                                                    >
                                                        {bookableSlots.length > 0
                                                            ? `${bookableSlots.length} slot${bookableSlots.length === 1 ? "" : "s"} available`
                                                            : "Doctor not available on this date"}
                                                    </span>
                                                )}
                                            </div>

                                            {fetchingSlots ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-busy="true" aria-label="Loading available time slots">
                                                    {Array.from({ length: 9 }).map((_, i) => (
                                                        <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
                                                    ))}
                                                </div>
                                            ) : bookableSlots.length > 0 ? (
                                                <SlotPicker
                                                    slots={bookableSlots}
                                                    selected={formData.slot}
                                                    onSelect={(slot) => setFormData({ ...formData, slot })}
                                                />
                                            ) : (
                                                <div className="rounded-xl border border-dashed border-red-300 bg-red-50/40 p-6 text-center space-y-2">
                                                    <CalendarOff className="w-8 h-8 mx-auto text-red-400" aria-hidden="true" />
                                                    <p className="text-sm font-medium text-red-700">Doctor is not available on this date</p>
                                                    <p className="text-xs text-red-600/80">
                                                        Please select another date.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="flex gap-2 pt-4">
                                <Button variant="ghost" size="sm" className="flex-1 gap-2 text-muted-foreground" onClick={prevStep}>
                                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                                </Button>
                                <Button
                                    className="flex-1 text-xs font-bold rounded-lg shadow-sm"
                                    size="sm"
                                    disabled={!formData.date || !formData.slot}
                                    onClick={nextStep}
                                >
                                    Review Details
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === "confirm" && (
                        <div className="space-y-6 animate-in fade-in zoom-in-98">
                            <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-3">
                                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Consultation</span>
                                    <span className="text-sm font-bold">Doctor ({formData.consultationMode === "ONLINE" ? "Online" : "In-person"})</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Doctor</span>
                                    <span className="text-sm font-bold">{selectedDoctor?.fullName || "—"}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-border/40 pb-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
                                    <span className="text-sm font-bold">{formData.date ? format(formData.date, "PPP") : ""}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Time Slot</span>
                                    <span className="text-sm font-bold text-primary">{formData.slot}</span>
                                </div>
                            </div>

                            {suggestedSlot && (
                                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg animate-in fade-in zoom-in-95">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-primary/20 rounded-full text-primary">
                                            <CalendarIcon className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-foreground">Next Available SlotFound</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                The requested time is no longer available. How about <span className="font-bold text-primary">{suggestedSlot}</span> instead?
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="mt-2 h-8 text-[11px] font-bold border-primary/40 hover:bg-primary/20 hover:text-primary transition-all"
                                                onClick={() => {
                                                    setFormData({ ...formData, slot: suggestedSlot });
                                                    setSuggestedSlot(null);
                                                }}
                                            >
                                                Accept Suggestion
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Additional Information (Optional)</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Briefly describe your concern..."
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="min-h-[100px] rounded-lg focus-visible:ring-primary text-sm bg-card border-border/60"
                                />
                            </div>

                            {selfExamBundle && selfExamBundle.submission.painZones.length > 0 && (
                                <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 flex items-start gap-2">
                                    <ClipboardList className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <div className="text-[11px] leading-relaxed text-primary">
                                        <span className="font-bold">Your pre-consultation kit is ready.</span>{" "}
                                        Please complete and submit it before your appointment so your doctor has full context.
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <Button variant="ghost" className="flex-1 text-xs font-bold" onClick={prevStep} disabled={loading}>
                                    Back
                                </Button>
                                <Button
                                    className="flex-[2] text-xs font-bold rounded-lg shadow-md h-11"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm Booking"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Self-Exam Intro (kit preview) step ────────────────────────────────
// Shown right after the triage step. Explains that the 9-zone body-map
// selection yields a tailored, 3-day test list the Vaidya will see before
// the consultation. Deliberately non-blocking — patients can book now and
// complete the tests in the days leading up to the appointment.

const ZONE_LABELS: Record<PainZone, string> = {
    HEAD_MIGRAINE: "Head / Migraine",
    NECK: "Neck",
    SHOULDER: "Shoulder",
    CHEST: "Chest",
    LOWER_BACK: "Lower Back",
    ABDOMEN: "Abdomen",
    KNEE: "Knee",
    WRIST_HAND: "Wrist & Hand",
    GENERALISED_MUSCLE: "Generalised Muscle",
};

function SelfExamIntroStep({
    bundle,
    loading,
    onOpenKit,
    onLater,
    confirmed = false,
}: {
    bundle: SelfExamBundle | null;
    loading: boolean;
    onOpenKit: () => void;
    onLater: () => void;
    /**
     * When true, this screen renders as the post-booking follow-up rather
     * than a pre-booking preview. Adds an explicit "appointment confirmed"
     * banner so the patient sees the booking went through, and uses
     * follow-up wording on the buttons.
     */
    confirmed?: boolean;
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Preparing your pre-consultation tests…
            </div>
        );
    }

    // The "booking confirmed" banner sits at the top of the post-booking
    // version of this screen. Same component renders for both pre- and
    // post-booking — the wording differs based on `confirmed`.
    const confirmedBanner = confirmed && (
        <div className="p-3 rounded-lg border-2 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-700/60 flex items-start gap-2">
            <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100 leading-tight">
                    Appointment confirmed
                </p>
                <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
                    You'll see it on your dashboard. Optional next step below — you can also start it later from your dashboard.
                </p>
            </div>
        </div>
    );

    // No DRAFT came back — either the triage covered regions outside the 9
    // supported zones, or the auto-init hook failed. Render a soft message
    // and let the patient continue.
    if (!bundle || bundle.submission.painZones.length === 0) {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                {confirmedBanner}
                <div className="p-4 rounded-lg border bg-muted/40 text-sm text-muted-foreground">
                    {confirmed
                        ? "No pre-consultation tests are required for your visit. You're all set."
                        : "No pre-consultation tests are required for the area you selected. Continue to pick a clinician."}
                </div>
                <div className="flex justify-end">
                    <Button onClick={onLater}>
                        {confirmed ? "Done" : <>Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
                    </Button>
                </div>
            </div>
        );
    }

    // Group checklist items by zone for the summary.
    const perZone = new Map<PainZone, number>();
    for (const item of bundle.checklist) {
        if (!item.zone) continue;
        perZone.set(item.zone, (perZone.get(item.zone) ?? 0) + 1);
    }
    // Has the constitution quiz been rolled in?
    const hasConstitution = bundle.checklist.some((i) => i.type === "CONSTITUTION");

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
            {confirmedBanner}
            <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 text-[11px] leading-relaxed text-primary">
                <p className="font-bold flex items-center gap-1.5 mb-1 uppercase">
                    <ClipboardList className="w-3 h-3" />
                    Pre-consultation kit
                </p>
                <p>
                    Based on the areas you marked, your Vaidya needs a few
                    short observations before your appointment (tongue photos,
                    stool texture, urine, posture). Some are 3-day logs —
                    please start them now and submit before your visit.
                </p>
            </div>

            <div className="space-y-2">
                {Array.from(perZone.entries()).map(([zone, count]) => (
                    <div
                        key={zone}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-background"
                    >
                        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <ClipboardList className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">{ZONE_LABELS[zone]}</div>
                            <div className="text-xs text-muted-foreground">
                                {count} test{count === 1 ? "" : "s"} — includes 3-day logs where applicable
                            </div>
                        </div>
                    </div>
                ))}
                {hasConstitution && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold">Constitution quiz</div>
                            <div className="text-xs text-muted-foreground">
                                Prakriti · Satva · Agni — one-time, ~2 minutes
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="text-[11px] text-muted-foreground leading-relaxed px-1">
                Tests will be sent to the doctor you book with, attached to
                your appointment. You can complete them over the next few
                days — no rush.
            </div>

            <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={onLater}>
                    I'll do it later <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button onClick={onOpenKit}>
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Open kit now
                </Button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotPicker — a self-contained, accessible time-slot selector. Groups raw
// 24-hour slots into Morning / Afternoon / Evening sections and formats
// labels in 12-hour display form. Receives only AVAILABLE, non-held slots
// (the parent filters out BOOKED / BLOCKED / HELD rows so unavailable
// times never reach the patient). `isNearlyFull` slots remain selectable
// and get an amber dot accent.
//
// Touch targets are 48px (h-12) to satisfy WCAG 2.5.5; focus rings rely on
// the underlying <button> defaults so keyboard users can tab through.
// ─────────────────────────────────────────────────────────────────────────────

interface SlotPickerSlot {
    slot?: string;
    time?: string;
    startTime?: string;
    status?: 'AVAILABLE' | string;
    isNearlyFull?: boolean;
    spotsLeft?: number;
}

interface SlotPickerProps {
    slots: SlotPickerSlot[];
    selected: string;
    onSelect: (slot: string) => void;
}

function formatSlotLabel(raw: string): string {
    // Accepts "HH:MM" (24h) and renders "h:MM AM/PM" for human display.
    const m = /^(\d{1,2}):(\d{2})/.exec(raw);
    if (!m) return raw;
    const h = Number(m[1]);
    const min = m[2];
    const period = h >= 12 ? "PM" : "AM";
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display}:${min} ${period}`;
}

function bucketForSlot(raw: string): "morning" | "afternoon" | "evening" {
    const m = /^(\d{1,2}):/.exec(raw);
    const h = m ? Number(m[1]) : 12;
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
}

function SlotPicker({ slots, selected, onSelect }: SlotPickerProps) {
    // Normalise slot strings up-front — the legacy shape sometimes carries
    // the time on `slot`, sometimes on `time` or `startTime`.
    const normalised = slots
        .map((s) => ({
            ...s,
            label: (typeof s === 'string' ? (s as unknown as string) : (s.slot ?? s.time ?? s.startTime ?? "")) as string,
        }))
        .filter((s) => !!s.label);

    const buckets: Record<"morning" | "afternoon" | "evening", typeof normalised> = {
        morning: [], afternoon: [], evening: [],
    };
    for (const s of normalised) buckets[bucketForSlot(s.label)].push(s);

    const sectionMeta: Record<keyof typeof buckets, { label: string; icon: JSX.Element; range: string }> = {
        morning:   { label: "Morning",   icon: <Sun    className="w-3.5 h-3.5 text-amber-500" />,    range: "before 12:00" },
        afternoon: { label: "Afternoon", icon: <Sunset className="w-3.5 h-3.5 text-orange-500" />,   range: "12:00 – 5:00" },
        evening:   { label: "Evening",   icon: <Moon   className="w-3.5 h-3.5 text-indigo-500" />,   range: "after 5:00"   },
    };

    return (
        <TooltipProvider delayDuration={200}>
            <div className="space-y-4" role="radiogroup" aria-label="Available time slots">
                {(Object.keys(buckets) as Array<keyof typeof buckets>).map((key) => {
                    const items = buckets[key];
                    if (items.length === 0) return null;
                    const meta = sectionMeta[key];
                    return (
                        <section key={key} className="space-y-2">
                            <header className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                    {meta.icon}
                                    <span>{meta.label}</span>
                                </div>
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.range}</span>
                            </header>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {items.map((s) => {
                                    const label = s.label;
                                    const display = formatSlotLabel(label);
                                    const isSelected = selected === label;
                                    const ariaState = isSelected
                                        ? `${display}, selected`
                                        : `${display}, available${s.isNearlyFull ? ', nearly full' : ''}`;

                                    const button = (
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={isSelected}
                                            aria-label={ariaState}
                                            onClick={() => onSelect(label)}
                                            className={cn(
                                                "relative h-12 rounded-xl border text-sm font-semibold transition-all",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/30"
                                                    : "bg-background border-border/60 text-foreground hover:border-primary hover:bg-primary/5 hover:-translate-y-0.5 hover:shadow-sm",
                                            )}
                                        >
                                            <span className="flex items-center justify-center gap-1.5">
                                                {isSelected && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                                                <span>{display}</span>
                                            </span>
                                            {!isSelected && s.isNearlyFull && (
                                                <span
                                                    className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500"
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </button>
                                    );

                                    if (!s.isNearlyFull) return <div key={label}>{button}</div>;

                                    return (
                                        <Tooltip key={label}>
                                            <TooltipTrigger asChild>
                                                <div>{button}</div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                                Nearly full — book soon
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}

                {normalised.some((s) => s.isNearlyFull) && (
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Selected</span>
                        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Nearly full</span>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}
