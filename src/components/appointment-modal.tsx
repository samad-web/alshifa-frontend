import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { TriageQuestionnaire } from "./triage/TriageQuestionnaire";
import { apiClient } from "@/lib/api-client";
import { FollowUpSchedulerModal } from "@/components/followup/FollowUpSchedulerModal";
import type { FollowUpPayload } from "@/services/followUp.service";
import { sanitizePhone, isValidPhone, isValidEmail, stripEdgeSpaces } from "@/lib/input-validators";

interface AppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    patientId?: string; // For admin creating appointments
    appointment?: any; // For editing existing appointment
}

// Bridge between the legacy Date-based state and the unified DatePicker,
// which speaks the native input contract (yyyy-MM-dd ISO strings).
const dateToIso = (d: Date | undefined): string => {
    if (!d) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isoToDate = (iso: string): Date | undefined => {
    if (!iso) return undefined;
    const [y, m, day] = iso.split("-").map(Number);
    if (!y || !m || !day) return undefined;
    return new Date(y, m - 1, day);
};

export function AppointmentModal({
    isOpen,
    onClose,
    onSuccess,
    patientId,
    appointment,
}: AppointmentModalProps) {
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [therapists, setTherapists] = useState<any[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>();
    const [selectedHour, setSelectedHour] = useState<string>("09");
    const [selectedMinute, setSelectedMinute] = useState<string>("00");
    const [selectedMeridiem, setSelectedMeridiem] = useState<"AM" | "PM">("AM");
    const [therapistDate, setTherapistDate] = useState<Date | undefined>();
    const [therapistHour, setTherapistHour] = useState<string>("09");
    const [therapistMinute, setTherapistMinute] = useState<string>("00");
    const [therapistMeridiem, setTherapistMeridiem] = useState<"AM" | "PM">("AM");
    const [formData, setFormData] = useState({
        patientId: patientId || appointment?.patientId || "",
        doctorId: appointment?.doctorId || "",
        therapistId: appointment?.therapistId || "",
        status: appointment?.status || "SCHEDULED",
        notes: appointment?.notes || "",
        consultationType: appointment?.consultationType || "DOCTOR",
        consultationMode: appointment?.consultationMode || "OFFLINE",
    });
    const [triageSessionId, setTriageSessionId] = useState<string | null>(null);
    const [triageResult, setTriageResult] = useState<any>(null);
    const [showTriage, setShowTriage] = useState(false);
    const [contactDetails, setContactDetails] = useState({
        fullName: "",
        phoneNumber: "",
        email: "",
    });
    // Follow-up capture: when admin flips status → COMPLETED on an
    // existing appointment, we intercept the submit and open the
    // follow-up scheduler. The payload is then included in the PUT body
    // so the backend writes both atomically.
    const [pendingSubmit, setPendingSubmit] = useState(false);
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [followUpPayload, setFollowUpPayload] = useState<FollowUpPayload | null>(null);

    const { role, profile } = useAuth(); // Get current user's role and profile
    console.log('[AppointmentModal] Role:', role, 'Profile:', profile); // Debug log
    const isAdmin = ['ADMIN', 'ADMIN_DOCTOR'].includes(role || ''); // Only admins can select patients
    const isEditing = !!appointment;

    // Get patient ID for current user if they're a patient
    const currentUserPatientId = role === 'PATIENT' && profile?.patient ? profile.patient.id : null;
    console.log('[AppointmentModal] currentUserPatientId:', currentUserPatientId); // Debug log

    // Initialize and Reset state safely when modal opens or appointment changes
    useEffect(() => {
        if (!isOpen) {
            console.log('[AppointmentModal] Modal closed - clearing states');
            setTriageSessionId(null);
            setTriageResult(null);
            setShowTriage(false);
            setContactDetails({ fullName: "", phoneNumber: "", email: "" });
            return;
        }

        console.log(`[AppointmentModal] Initializing state. Context: ${isEditing ? 'EDIT' : 'NEW'}`);

        // 1. Reset/Initialize form data
        setFormData({
            patientId: patientId || appointment?.patientId || currentUserPatientId || "",
            doctorId: appointment?.doctorId || "",
            therapistId: appointment?.therapistId || "",
            status: appointment?.status || "SCHEDULED",
            notes: appointment?.notes || "",
            consultationType: appointment?.consultationType || "DOCTOR",
            consultationMode: appointment?.consultationMode || "OFFLINE",
        });

        // 2. Reset/Initialize Contact Details and Triage
        setContactDetails({
            fullName: appointment?.patient?.fullName || appointment?.contactDetails?.fullName || "",
            phoneNumber: appointment?.patient?.phoneNumber || appointment?.contactDetails?.phoneNumber || "",
            email: appointment?.patient?.email || appointment?.contactDetails?.email || "",
        });
        setTriageSessionId(appointment?.triageSessionId || null);
        setTriageResult(null); // Fresh start for results

        // 3. Reset/Initialize Dates and Times — converted to 12-hour wall clock
        //    so the form mirrors the AM/PM selector users expect.
        const toTwelveHour = (h24: number) => {
            const meridiem: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
            const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
            return { hour: String(h12).padStart(2, "0"), meridiem };
        };

        if (isEditing && appointment?.date) {
            const aptDate = new Date(appointment.date);
            const { hour, meridiem } = toTwelveHour(aptDate.getHours());
            setSelectedDate(aptDate);
            setSelectedHour(hour);
            setSelectedMinute(String(aptDate.getMinutes()).padStart(2, "0"));
            setSelectedMeridiem(meridiem);
        } else {
            setSelectedDate(undefined);
            setSelectedHour("09");
            setSelectedMinute("00");
            setSelectedMeridiem("AM");
        }

        if (isEditing && appointment?.therapistDate) {
            const tAptDate = new Date(appointment.therapistDate);
            const { hour, meridiem } = toTwelveHour(tAptDate.getHours());
            setTherapistDate(tAptDate);
            setTherapistHour(hour);
            setTherapistMinute(String(tAptDate.getMinutes()).padStart(2, "0"));
            setTherapistMeridiem(meridiem);
        } else {
            setTherapistDate(undefined);
            setTherapistHour("09");
            setTherapistMinute("00");
            setTherapistMeridiem("AM");
        }

        // 4. Triage flow logic
        if (!isAdmin && role === 'PATIENT' && !isEditing) {
            console.log('[AppointmentModal] Triggering triage flow');
            setShowTriage(true);
        } else {
            setShowTriage(false);
        }

        // 5. Audit Log
        console.log('[AppointmentModal] State initialized. Notes length:', (appointment?.notes || "").length);

        return () => {
            console.log('[AppointmentModal] Component unmounting or context switching - cleanup');
        };

    }, [isOpen, appointment, patientId, currentUserPatientId, isAdmin, role, isEditing]);

    // Fetch available staff and patients (for admin)
    useEffect(() => {
        let mounted = true;
        async function fetchData() {
            try {
                // Fetch available staff
                const staffParams = isAdmin ? { allBranches: 'true' } : {};
                const { data: staffData } = await apiClient.get<any>('/api/appointments/available-staff', staffParams);
                if (mounted && staffData.doctors) {
                    setDoctors(staffData.doctors);
                    setTherapists(staffData.therapists || []);
                }

                // Fetch patients if admin
                if (isAdmin) {
                    const { data: pats } = await apiClient.get<any[]>('/api/user/list-patients');
                    console.log('Fetched patients:', pats); // Debug log
                    if (mounted) setPatients(pats);
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
            }
        }
        if (isOpen) {
            fetchData();
        }
        return () => { mounted = false; };
    }, [isOpen, isAdmin]);

    // Auto-prefill contact details when patient is selected or modal opens
    useEffect(() => {
        async function fetchPatientDetails(patId: string) {
            try {
                const { data: patientData } = await apiClient.get<any>(`/api/user/patient/${patId}`);
                {
                    setContactDetails({
                        fullName: patientData.fullName || "",
                        phoneNumber: patientData.phoneNumber || "",
                        email: patientData.email || patientData.user?.email || "",
                    });

                    // Pre-populate notes with onboarding data if it's a new appointment
                    if (!isEditing && (patientData.onboardingData || patientData.triageSessions?.length > 0)) {
                        let additionalNotes = "";

                        // 1. Onboarding Baseline Info
                        if (patientData.onboardingData) {
                            const od = patientData.onboardingData;
                            additionalNotes += `[Baseline Info] \nGender: ${od.gender || 'Not specified'}\nSleep: ${od.sleepBedtime || ''}-${od.sleepWakeTime || ''} (${od.sleepDuration}h)\nPain Level: ${od.painLevel}/10\nPain Locations: ${od.painLocations?.join(', ') || 'N/A'}`;
                        }

                        // 2. Triage Summary (Fresh from Questionnaire)
                        if (patientData.triageSessions?.length > 0) {
                            const latestTriage = patientData.triageSessions[0];
                            const resp = latestTriage.responses || {};
                            const triageSummary = `\n\n[Triage Summary] (${new Date(latestTriage.createdAt).toLocaleDateString()})
Pain Area: ${resp.painArea || 'N/A'}
Severity: ${resp.painSeverity || 0}/10
Symptoms: ${resp.symptoms?.join(', ') || 'None'}
History: ${resp.medicalHistory || 'None'}
Medications: ${resp.medications || 'None'}`;

                            additionalNotes += triageSummary;

                            // Also set the triageSessionId for the appointment record
                            if (!triageSessionId) {
                                setTriageSessionId(latestTriage.id);
                            }
                        }

                        setFormData(prev => {
                            // Prevent double-appending
                            if (prev.notes.includes("[Triage Summary]") || prev.notes.includes("[Baseline Info]")) return prev;
                            const trimmedNotes = prev.notes.trim();
                            return {
                                ...prev,
                                notes: trimmedNotes ? `${trimmedNotes}\n\n${additionalNotes.trim()}` : additionalNotes.trim()
                            };
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to fetch patient details:", error);
            }
        }

        // Determine the actual patient ID to use
        const patId = formData.patientId || currentUserPatientId || patientId;
        if (patId && isOpen) {
            fetchPatientDetails(patId);
        }
    }, [formData.patientId, currentUserPatientId, patientId, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Validate contact details — phone/email rules pulled from the
        // shared validator library so every form in the app stays in sync.
        if (!contactDetails.fullName || contactDetails.fullName.trim().length < 2) {
            toast.error("Please enter a valid full name (minimum 2 characters)");
            setLoading(false);
            return;
        }

        if (!contactDetails.phoneNumber || !isValidPhone(contactDetails.phoneNumber)) {
            toast.error("Phone must be 7-15 digits (optionally starting with +)");
            setLoading(false);
            return;
        }

        if (!contactDetails.email || !isValidEmail(contactDetails.email)) {
            toast.error("Please enter a valid email address");
            setLoading(false);
            return;
        }

        if (!selectedDate) {
            toast.error("Please select a date");
            setLoading(false);
            return;
        }

        if (formData.consultationType !== "THERAPIST" && !formData.doctorId) {
            toast.error("Please select a doctor");
            setLoading(false);
            return;
        }

        if (formData.consultationType !== "DOCTOR" && !formData.therapistId) {
            toast.error("Please select a therapist");
            setLoading(false);
            return;
        }

        try {
            // Convert 12-hour wall clock back to 24-hour for the API.
            // 12 AM → 0, 12 PM → 12; otherwise add 12 only when PM.
            const toTwentyFour = (h12: number, meridiem: "AM" | "PM") => {
                if (meridiem === "AM") return h12 === 12 ? 0 : h12;
                return h12 === 12 ? 12 : h12 + 12;
            };

            // Combine doctor date and time
            const combinedDateTime = new Date(selectedDate);
            combinedDateTime.setHours(toTwentyFour(parseInt(selectedHour), selectedMeridiem));
            combinedDateTime.setMinutes(parseInt(selectedMinute));

            // Combine therapist date and time
            let combinedTherapistDateTime = null;
            if (formData.consultationType === "COMBINED" && therapistDate) {
                combinedTherapistDateTime = new Date(therapistDate);
                combinedTherapistDateTime.setHours(toTwentyFour(parseInt(therapistHour), therapistMeridiem));
                combinedTherapistDateTime.setMinutes(parseInt(therapistMinute));
            } else if (formData.consultationType === "THERAPIST" && selectedDate) {
                // If only therapist, use the primary date selection
                combinedTherapistDateTime = new Date(selectedDate);
                combinedTherapistDateTime.setHours(toTwentyFour(parseInt(selectedHour), selectedMeridiem));
                combinedTherapistDateTime.setMinutes(parseInt(selectedMinute));
            }

            // When an admin marks an existing appointment COMPLETED,
            // require the follow-up decision first. If we don't already
            // have one queued (the modal flow), open the scheduler and
            // short-circuit the submit — it will resume after the
            // scheduler calls handleFollowUpSubmit.
            const isFlippingToCompleted = isEditing
                && formData.status === 'COMPLETED'
                && appointment?.status !== 'COMPLETED';
            if (isFlippingToCompleted && !followUpPayload) {
                setShowFollowUpModal(true);
                setPendingSubmit(true);
                setLoading(false);
                return;
            }

            // Drop any "" values from the form before submit. The backend
            // schema uses z.enum / z.string().optional() — both reject ""
            // (status enum hard-rejects, FK fields reject at the Prisma
            // layer). Radix Select can momentarily set status="" when the
            // current DB value isn't in the visible SelectItems list and
            // the dropdown is dismissed, which would otherwise trigger
            // "Invalid enum value … received ''" on save.
            const cleanFormData: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(formData)) {
                if (value !== "") cleanFormData[key] = value;
            }

            const body: Record<string, unknown> = {
                ...cleanFormData,
                date: combinedDateTime.toISOString(),
                therapistDate: combinedTherapistDateTime?.toISOString() || null,
                contactDetails,
                triageSessionId: triageSessionId,
            };
            if (isFlippingToCompleted && followUpPayload) {
                body.followUp = followUpPayload;
            }

            if (isEditing) {
                await apiClient.put(`/api/appointments/${appointment.id}`, body);
            } else {
                await apiClient.post('/api/appointments', body);
            }
            setFollowUpPayload(null);

            toast.success(isEditing ? "Appointment updated successfully" : "Appointment booked successfully");
            // Reset form
            setFormData({
                patientId: "",
                doctorId: "",
                therapistId: "",
                status: "SCHEDULED",
                notes: "",
                consultationType: "DOCTOR",
                consultationMode: "OFFLINE",
            });
            setContactDetails({
                fullName: "",
                phoneNumber: "",
                email: "",
            });
            setSelectedDate(undefined);
            setSelectedHour("09");
            setSelectedMinute("00");
            setSelectedMeridiem("AM");
            setTherapistDate(undefined);
            setTherapistHour("09");
            setTherapistMinute("00");
            setTherapistMeridiem("AM");
            onSuccess?.();
            onClose();
        } catch (error: any) {
            // Handle specific error cases — guard against `details` being a
            // non-array (some backends return a string) to avoid `.map` crashes.
            if (Array.isArray(error?.details) && error.details.length > 0) {
                const detailMessages = error.details.map((d: any) => d?.message ?? String(d)).join(", ");
                toast.error(`Validation Error: ${detailMessages}`);
            } else {
                toast.error(error?.message || "Failed to save appointment. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    // Called by FollowUpSchedulerModal after the admin picks a cadence.
    // We stash the payload and immediately re-run the form submit so the
    // PUT includes `followUp` alongside the status change.
    const handleFollowUpPicked = async (payload: FollowUpPayload) => {
        setFollowUpPayload(payload);
        setShowFollowUpModal(false);
        // Synthesise a submit event so we reuse the same validation path.
        setTimeout(() => {
            const form = document.getElementById("appointment-modal-form") as HTMLFormElement | null;
            if (form) form.requestSubmit();
            setPendingSubmit(false);
        }, 0);
    };

    // 12-hour clock: 12, 01, 02, ... 11. AM/PM lives in a separate selector.
    const hours = Array.from({ length: 12 }, (_, i) => String(((i + 11) % 12) + 1).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];
    const meridiems: ("AM" | "PM")[] = ["AM", "PM"];

    const filteredDoctors = doctors.filter(doc => {
        if (isAdmin) return true; // Admin sees all
        if (!triageResult) return true; // Before triage, show all (though UI might hide them)

        // If not escalated, hide Admin Doctors
        if (doc.user?.role === 'ADMIN_DOCTOR' && !triageResult.isEscalated) return false;

        // Suggest specialty matching (soft match or priority)
        // For now, only hard restriction is on Admin Doctor
        return true;
    });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? "Edit Appointment" : "Book Appointment"}
                    </DialogTitle>
                </DialogHeader>

                {showTriage ? (
                    <TriageQuestionnaire
                        onComplete={(session) => {
                            setTriageSessionId(session.id);
                            setTriageResult(session);
                            setShowTriage(false);
                            // Pre-select doctor if only one matches specialty? 
                            // For now, just allow selection.
                        }}
                        onCancel={onClose}
                    />
                ) : (
                    <form id="appointment-modal-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Patient Selection (Admin only) */}
                        {isAdmin && (
                            <div className="space-y-2">
                                <Label htmlFor="patient">Patient *</Label>
                                <Select
                                    value={formData.patientId}
                                    onValueChange={(value) => setFormData({ ...formData, patientId: value })}
                                    required
                                >
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select patient..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {patients.map((patient) => (
                                            <SelectItem key={patient?.id || 'unknown'} value={patient?.id || ''}>
                                                {patient?.fullName || patient?.email || patient?.user?.email || `Patient-${patient?.id?.slice(0, 8) || 'unknown'}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Contact Details Section */}
                        <div className="space-y-4 p-4 bg-secondary/10 rounded-lg border border-border">
                            <h3 className="font-semibold text-sm text-foreground">Client Details</h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Full Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Full Name *</Label>
                                    <Input
                                        id="fullName"
                                        type="text"
                                        value={contactDetails.fullName}
                                        onChange={(e) => setContactDetails({ ...contactDetails, fullName: e.target.value })}
                                        placeholder="Enter full name"
                                        required
                                        minLength={2}
                                    />
                                </div>

                                {/* Phone Number */}
                                <div className="space-y-2">
                                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                                    <Input
                                        id="phoneNumber"
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        value={contactDetails.phoneNumber}
                                        onChange={(e) => setContactDetails({ ...contactDetails, phoneNumber: sanitizePhone(e.target.value) })}
                                        onBlur={() => setContactDetails((c) => ({ ...c, phoneNumber: stripEdgeSpaces(c.phoneNumber) }))}
                                        placeholder="+919876543210"
                                        required
                                        pattern="^\+?[0-9]{7,15}$"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={contactDetails.email}
                                    onChange={(e) => setContactDetails({ ...contactDetails, email: e.target.value })}
                                    placeholder="email@example.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Consultation Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                            {/* Consultation Type */}
                            <div className="space-y-2">
                                <Label htmlFor="consultationType">Consultation Type *</Label>
                                <Select
                                    value={formData.consultationType}
                                    onValueChange={(value) => setFormData({ ...formData, consultationType: value })}
                                >
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="DOCTOR">Doctor Only</SelectItem>
                                        <SelectItem value="THERAPIST">Therapist Only</SelectItem>
                                        <SelectItem value="COMBINED">Combined (Doctor + Therapist)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Consultation Mode */}
                            <div className="space-y-2">
                                <Label htmlFor="consultationMode">Visit Mode *</Label>
                                <Select
                                    value={formData.consultationMode}
                                    onValueChange={(value) => setFormData({ ...formData, consultationMode: value })}
                                >
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select mode..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="OFFLINE">In-Person (Clinic)</SelectItem>
                                        <SelectItem value="ONLINE">Online (Virtual)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Doctor/Therapist Selection */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Doctor */}
                            {(formData.consultationType === 'DOCTOR' || formData.consultationType === 'COMBINED') && (
                                <div className="space-y-2">
                                    <Label htmlFor="doctor">Doctor *</Label>
                                    <Select
                                        value={formData.doctorId}
                                        onValueChange={(value) => setFormData({ ...formData, doctorId: value })}
                                        required
                                    >
                                        <SelectTrigger className="bg-background">
                                            <SelectValue placeholder="Select doctor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredDoctors.map((doctor) => (
                                                <SelectItem key={doctor?.id || 'unknown'} value={doctor?.id || ''}>
                                                    <div className="flex flex-col">
                                                        <span>
                                                            {doctor?.fullName || doctor?.user?.email || `Doctor-${doctor?.id?.slice(0, 8) || 'unknown'}`}
                                                            {doctor?.user?.role === 'ADMIN_DOCTOR' && " (Senior)"}
                                                        </span>
                                                        {isAdmin && doctor?.user?.branch?.name && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {doctor.user.branch.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Therapist */}
                            {(formData.consultationType === 'THERAPIST' || formData.consultationType === 'COMBINED') && (
                                <div className="space-y-2">
                                    <Label htmlFor="therapist">Therapist *</Label>
                                    <Select
                                        value={formData.therapistId}
                                        onValueChange={(value) => setFormData({ ...formData, therapistId: value })}
                                        required
                                    >
                                        <SelectTrigger className="bg-background">
                                            <SelectValue placeholder="Select therapist..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.isArray(therapists) && therapists.map((therapist) => (
                                                <SelectItem key={therapist.id} value={therapist.id}>
                                                    <div className="flex flex-col">
                                                        <span>
                                                            {therapist.fullName || therapist.user?.email || `Therapist-${therapist.id.slice(0, 8)}`}
                                                        </span>
                                                        {isAdmin && therapist.user?.branch?.name && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {therapist.user.branch.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Date and Time Selection */}
                        <div className="space-y-6 pt-4 border-t border-primary/10">
                            {/* Doctor/Primary Section */}
                            <div className="space-y-4">
                                <Label className="text-primary font-bold">
                                    {formData.consultationType === 'COMBINED' ? '1. Doctor Appointment Timing' : 'Appointment Date and Time'}
                                </Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Date *</Label>
                                        <DatePicker
                                            value={dateToIso(selectedDate)}
                                            onChange={(iso) => setSelectedDate(isoToDate(iso))}
                                            placeholder="Select date"
                                            fromDate={new Date(new Date().setHours(0, 0, 0, 0))}
                                            displayFormat="PPP"
                                            className="bg-background"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Time *</Label>
                                        <div className="flex gap-2">
                                            <Select value={selectedHour} onValueChange={setSelectedHour}>
                                                <SelectTrigger className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {hours.map((hour) => (
                                                        <SelectItem key={hour} value={hour}>
                                                            {hour}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <span className="flex items-center">:</span>
                                            <Select value={selectedMinute} onValueChange={setSelectedMinute}>
                                                <SelectTrigger className="bg-background">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {minutes.map((min) => (
                                                        <SelectItem key={min} value={min}>
                                                            {min}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select value={selectedMeridiem} onValueChange={(v) => setSelectedMeridiem(v as "AM" | "PM")}>
                                                <SelectTrigger className="bg-background w-[78px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {meridiems.map((m) => (
                                                        <SelectItem key={m} value={m}>
                                                            {m}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Therapist Section (only for COMBINED) */}
                            {formData.consultationType === 'COMBINED' && (
                                <div className="space-y-4 pt-4 border-t border-dashed border-primary/20">
                                    <Label className="text-primary font-bold">2. Therapist Appointment Timing</Label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Date *</Label>
                                            <DatePicker
                                                value={dateToIso(therapistDate)}
                                                onChange={(iso) => setTherapistDate(isoToDate(iso))}
                                                placeholder="Select date"
                                                fromDate={new Date(new Date().setHours(0, 0, 0, 0))}
                                                displayFormat="PPP"
                                                className="bg-background"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Time *</Label>
                                            <div className="flex gap-2">
                                                <Select value={therapistHour} onValueChange={setTherapistHour}>
                                                    <SelectTrigger className="bg-background">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {hours.map((hour) => (
                                                            <SelectItem key={hour} value={hour}>
                                                                {hour}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <span className="flex items-center">:</span>
                                                <Select value={therapistMinute} onValueChange={setTherapistMinute}>
                                                    <SelectTrigger className="bg-background">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {minutes.map((min) => (
                                                            <SelectItem key={min} value={min}>
                                                                {min}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select value={therapistMeridiem} onValueChange={(v) => setTherapistMeridiem(v as "AM" | "PM")}>
                                                    <SelectTrigger className="bg-background w-[78px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {meridiems.map((m) => (
                                                            <SelectItem key={m} value={m}>
                                                                {m}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Status (Admin only) */}
                        {isAdmin && (
                            <div className="space-y-2">
                                <Label htmlFor="status">Status *</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger className="bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                        <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Notes */}
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Any additional notes..."
                                className="min-h-[80px]"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-end pt-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={loading} className="gap-2">
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                {isEditing ? "Update Appointment" : "Book Appointment"}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
            <FollowUpSchedulerModal
                open={showFollowUpModal}
                onClose={() => {
                    setShowFollowUpModal(false);
                    setPendingSubmit(false);
                }}
                onSubmit={handleFollowUpPicked}
                submitting={pendingSubmit}
                patientName={contactDetails.fullName || appointment?.patient?.fullName}
                submitLabel="Mark Completed"
            />
        </Dialog>
    );
}
