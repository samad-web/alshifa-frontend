
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import {
    Video,
    MessageSquare,
    FileText,
    Save,
    CheckCircle,
    ArrowLeft,
    User,
    Clock,
    ExternalLink,
    ClipboardList,
    Salad,
    ClipboardCheck,
    Loader2,
    AlertTriangle,
    Shield,
    Activity,
    Plus,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ChatWrapper } from "@/components/chat/ChatWrapper";
import { RetentionChecklistModal } from "@/components/RetentionChecklistModal";
import { FollowUpSchedulerModal } from "@/components/followup/FollowUpSchedulerModal";
import { PatientHistoryPanel } from "@/components/consultation/PatientHistoryPanel";
import { GenerateReportButton } from "@/components/consultation/GenerateReportButton";
import { RecordIntakeModal } from "@/components/consultation/RecordIntakeModal";
import { DoshaForecastPanel } from "@/components/consultation/DoshaForecastPanel";
import { TongueTrendChart } from "@/components/consultation/TongueTrendChart";
import { DigitalTwinPanel } from "@/components/consultation/DigitalTwinPanel";
import { PatientRecordReviewTracker } from "@/components/doctor/PatientRecordReviewTracker";
import { VisitSummaryModal } from "@/components/consultation/VisitSummaryModal";
import { videoSessionService } from "@/services/videoSession.service";
import { useAuth } from "@/hooks/useAuth";
import type { FollowUpPayload } from "@/services/followUp.service";
import { iwisApi, type DietPrescription } from "@/services/iwis.service";
import { communicationApi } from "@/services/communication.service";
import { ApiClientError } from "@/lib/api-client";
import type { VisitSummaryEntry } from "@/types";
import { formatTime } from "@/lib/format-date";
import { roleToDashboard } from "@/lib/role-routes";

// ── Inline Patient Snapshot ─────────────────────────────────────────────
// Inlined here (rather than as a separate component file) because Vite's
// HMR was repeatedly failing to re-bundle the standalone component file
// (OneDrive sync confusing chokidar). Defining it in the same file as the
// parent guarantees it reloads whenever ConsultationRoom does.

interface VitalReading { value: number; unit: string; recordedAt: string; source: string | "clinician" | "self-reported" }
interface HealthSummary {
    patientId: string;
    latestVitals: Record<string, VitalReading>;
    height: { cm: number; source: string } | null;
    weight: { kg: number; recordedAt: string } | null;
    bmi: { value: number; category: string } | null;
    idealWeight: { kg: number } | null;
    prakriti: { type: string; display: string; satvaRating: number | null; agniType: string | null; assessedAt: string; assessedBy: string | null } | null;
    lifestyle: { sleepQuality: number | null; stressLevel: number | null; exerciseFrequency: string | null; dietType: string | null; recordedAt: string; source: string } | null;
    painRegions: Array<{ region?: string; regionLabel?: string; intensity?: number }>;
}

function relTime(iso: string | null | undefined): string {
    if (!iso) return "";
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Build a compact "5m ago · self" sub-label including source provenance for
// the snapshot rows. "self" means patient self-reported (DailyCheckIn);
// clinician readings show just the timestamp.
function vitalSub(reading: VitalReading | undefined): string | undefined {
    if (!reading) return undefined;
    const time = relTime(reading.recordedAt);
    if (reading.source === 'self-reported') return `${time} · self`;
    return time;
}

// Defined at module scope so React doesn't recreate it on every parent
// render — repeatedly recreated inline components cause the child subtree
// to remount on every render, which can manifest as a visible "flash and
// disappear" of the wrapping card.
function SnapshotRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-2 py-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{label}</span>
            <span className="text-xs font-semibold tabular-nums truncate text-right">
                {value}
                {sub && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{sub}</span>}
            </span>
        </div>
    );
}

function InlinePatientSnapshot({ patientId, onRecord }: { patientId: string; onRecord: () => void }) {
    const { data, isLoading, isError, refetch } = useQuery<HealthSummary>({
        queryKey: ["health-summary", patientId],
        queryFn: async () => {
            const { data } = await apiClient.get<HealthSummary>(`/api/patients/${patientId}/health-summary`);
            return data;
        },
        enabled: !!patientId,
    });

    // `shrink-0` on every render branch is LOAD-BEARING — do not remove.
    // The right column is `flex flex-col` with `overflow-y-auto min-h-0`,
    // which lets flex children be compressed. The Notes textarea has
    // `min-h-[200px]` so it claims its space; without `shrink-0` this
    // snapshot gets squeezed to 0 height and becomes invisible. Reproduced
    // and traced in the long debug saga; see commit history for context.
    if (isLoading) {
        return (
            <div className="shrink-0 rounded-2xl border border-border bg-secondary/30 p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Loading patient snapshot…</span>
            </div>
        );
    }
    if (isError || !data) {
        return (
            <div className="shrink-0 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs">
                <p className="font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    Patient Snapshot
                </p>
                <p className="text-amber-800">Couldn't load summary. <button type="button" onClick={() => refetch()} className="text-primary hover:underline">Retry</button></p>
            </div>
        );
    }

    // Defensive accessors — the API contract says all these fields are present,
    // but a malformed response (304 cache race, server bug, etc.) could leave
    // them undefined. Accessing `.length` on undefined throws, which would
    // surface as the snapshot "loading then disappearing". Default everything
    // to safe values so the render is bulletproof.
    const latestVitals = (data.latestVitals ?? {}) as Record<string, { value: number; recordedAt: string } | undefined>;
    const painRegions  = Array.isArray(data.painRegions) ? data.painRegions : [];
    const pain   = latestVitals.PAIN_SCORE;
    const sleep  = latestVitals.SLEEP_HOURS;
    const mood   = latestVitals.MOOD;
    const weight = data.weight;
    const height = data.height;

    return (
        <div className="shrink-0 rounded-2xl border border-border bg-secondary/30 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-secondary/60">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    Patient Snapshot
                </h3>
                <Button size="sm" variant="outline" onClick={onRecord} className="h-7 px-2.5 text-[10px] gap-1 bg-card">
                    <Plus className="w-3 h-3" /> Record
                </Button>
            </div>

            <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Vitals
                    </p>
                    <SnapshotRow label="Height" value={height ? `${height.cm} cm` : "—"} />
                    <SnapshotRow label="Weight" value={weight ? `${weight.kg} kg` : "—"} sub={weight ? relTime(weight.recordedAt) : undefined} />
                    {data.bmi && <SnapshotRow label="BMI" value={String(data.bmi.value)} sub={data.bmi.category} />}
                    <SnapshotRow label="Pain"   value={pain  ? `${pain.value}/10`  : "—"} sub={vitalSub(pain)} />
                    <SnapshotRow label="Sleep"  value={sleep ? `${sleep.value} hrs` : "—"} sub={vitalSub(sleep)} />
                    <SnapshotRow label="Mood"   value={mood  ? `${mood.value}/5`   : "—"} sub={vitalSub(mood)} />
                </div>
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Salad className="w-3 h-3" /> Clinical
                    </p>
                    <SnapshotRow label="Prakriti" value={data.prakriti?.display ?? "—"} sub={data.prakriti?.agniType ? `Agni: ${data.prakriti.agniType}` : undefined} />
                    <SnapshotRow label="Sleep Q"  value={data.lifestyle?.sleepQuality != null ? `${data.lifestyle.sleepQuality}/5` : "—"} />
                    <SnapshotRow label="Stress"   value={data.lifestyle?.stressLevel  != null ? `${data.lifestyle.stressLevel}/10` : "—"} />
                    <SnapshotRow label="Diet"     value={data.lifestyle?.dietType ?? "—"} />
                    <SnapshotRow label="Exercise" value={data.lifestyle?.exerciseFrequency ?? "—"} />
                    <SnapshotRow label="Pain rgns" value={painRegions.length > 0 ? String(painRegions.length) : "—"} />
                </div>
            </div>
        </div>
    );
}

// Generate Health Report is hidden only for statuses where there is no
// consultation to report on yet — pending approval, still being scheduled,
// or cancelled. Anything else (CONFIRMED/ACCEPTED/IN_PROGRESS/COMPLETED/
// NO_SHOW/etc.) renders the button, including statuses added later.
const REPORT_HIDDEN_STATUSES = new Set([
    "PENDING",
    "PENDING_DOCTOR_APPROVAL",
    "PENDING_THERAPIST_APPROVAL",
    "SCHEDULED",
    "CANCELLED",
]);

// Statuses where the patient can no longer "be late" — either it's done,
// it never happened, or it was abandoned. The header late-badge stays
// hidden for these so we don't render absurd "Late by 6 hours" for a row
// that's already been marked NO_SHOW.
const LATENESS_TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);

// Maps `Appointment.arrivalStatus` (defaulted on every row, mirrored
// from QueueEntry) to a human label + tone for the right-column card.
function describeQueueStatus(
    arrivalStatus: string | null | undefined,
    queuePosition: number | null | undefined,
): { label: string; tone: "muted" | "ok" | "warn" | "attention" } {
    switch (arrivalStatus) {
        case "ARRIVED":
            return queuePosition === 1
                ? { label: "Up next", tone: "ok" }
                : queuePosition && queuePosition > 1
                    ? { label: `Position ${queuePosition} in queue`, tone: "ok" }
                    : { label: "Arrived — waiting", tone: "ok" };
        case "IN_CONSULTATION": return { label: "In consultation now", tone: "ok" };
        case "COMPLETED":       return { label: "Completed", tone: "muted" };
        case "ABSENT":          return { label: "Marked absent", tone: "attention" };
        case "CONTACTED":       return { label: "Contacted — pending", tone: "warn" };
        case "NOT_ARRIVED":
        default:                return { label: "Not arrived yet", tone: "muted" };
    }
}

const queueToneClass: Record<"muted" | "ok" | "warn" | "attention", string> = {
    muted:     "text-muted-foreground",
    ok:        "text-wellness",
    warn:      "text-amber-600",
    attention: "text-red-600",
};

export default function ConsultationRoom() {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const { role } = useAuth();
    const showPainMap = role === "DOCTOR" || role === "ADMIN_DOCTOR";
    const [appointment, setAppointment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [showIntakeModal, setShowIntakeModal] = useState(false);
    const [completing, setCompleting] = useState(false);

    // Visit summary + active diet prescription drive the right column.
    // Both are loaded lazily once the appointment + patient resolve, so the
    // initial render isn't blocked on them.
    const [visitSummary, setVisitSummary] = useState<VisitSummaryEntry | null>(null);
    const [showVisitSummaryModal, setShowVisitSummaryModal] = useState(false);
    const [activeDiet, setActiveDiet] = useState<DietPrescription | null>(null);

    useEffect(() => {
        fetchAppointment();
    }, [appointmentId]);

    const [savedNotes, setSavedNotes] = useState("");

    const fetchAppointment = async () => {
        try {
            const { data } = await apiClient.get<any>(`/api/appointments/${appointmentId}`);
            setAppointment(data);
            setNotes(data.sessionNotes || "");
            setSavedNotes(data.sessionNotes || "");
        } catch (error) {
            toast.error("Failed to fetch appointment details");
        } finally {
            setLoading(false);
        }
    };

    // Dirty-notes guard — warn before tab close / refresh if the textarea
    // diverges from the last persisted value. SPA navigation via in-page
    // back/forward is guarded separately in `safeBack()`. (Full router-level
    // blocking would require migrating from <BrowserRouter> to a data router.)
    const isDirty = notes !== savedNotes;
    useEffect(() => {
        if (!isDirty) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty]);

    const dashboardPath = roleToDashboard(role);
    const safeBack = () => {
        if (isDirty && !window.confirm("You have unsaved notes. Leave without saving?")) return;
        navigate(dashboardPath);
    };

    const patientId: string | undefined = appointment?.patient?.id;

    // Pull the existing visit summary for this appointment, if any. A 404 just
    // means the doctor hasn't written one yet — surfaced as `null` so the
    // right column renders the empty-state CTA instead of an error toast.
    useEffect(() => {
        if (!appointmentId) return;
        let cancelled = false;
        communicationApi
            .getVisitSummary(appointmentId)
            .then((summary) => { if (!cancelled) setVisitSummary(summary); })
            .catch((err) => {
                if (cancelled) return;
                if (err instanceof ApiClientError && err.status === 404) {
                    setVisitSummary(null);
                } else {
                    // Don't block the room on a transient summary fetch fail.
                    setVisitSummary(null);
                }
            });
        return () => { cancelled = true; };
    }, [appointmentId]);

    // Pull the patient's active diet prescription. There is at most one
    // active row at a time per the diet workflow rules; pick the first
    // `isActive: true` row and render its title + dosha + status badge.
    useEffect(() => {
        if (!patientId) return;
        let cancelled = false;
        iwisApi
            .listDietForPatient(patientId)
            .then((list) => {
                if (cancelled) return;
                setActiveDiet(list.find((p) => p.isActive) ?? null);
            })
            .catch(() => { if (!cancelled) setActiveDiet(null); });
        return () => { cancelled = true; };
    }, [patientId]);

    // Re-throws on failure so callers (submitCompletion) can abort before
    // POSTing /complete — previously the catch swallowed the error and
    // completion proceeded with notes silently lost.
    const handleSaveNotes = async () => {
        setIsSaving(true);
        try {
            await apiClient.post(`/api/consultations/session/${appointmentId}/notes`, { sessionNotes: notes });
            setSavedNotes(notes);
            toast.success("Notes saved successfully");
        } catch (error) {
            toast.error("Failed to save notes");
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    // Consultation can no longer be completed without a follow-up
    // decision. Clicking "Complete Session" now opens the scheduler;
    // submitting that modal is what actually POSTs /complete with the
    // follow-up payload.
    const handleCompleteSession = () => {
        if (notes.trim() === "" &&
            !window.confirm("No clinical notes have been written. Complete the session anyway?")) {
            return;
        }
        setShowFollowUpModal(true);
    };

    const submitCompletion = async (followUp: FollowUpPayload) => {
        setCompleting(true);
        try {
            // Save notes first; if the save fails we abort here so completion
            // never runs with un-persisted notes.
            try {
                await handleSaveNotes();
            } catch {
                return;
            }

            await apiClient.post(`/api/consultations/session/${appointmentId}/complete`, { followUp });
            toast.success("Session completed — follow-up saved");
            setShowFollowUpModal(false);
            navigate(dashboardPath);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to complete session";
            toast.error(msg);
        } finally {
            setCompleting(false);
        }
    };

    if (loading) return <AppLayout><div className="p-8 text-center">Loading session...</div></AppLayout>;
    if (!appointment) return <AppLayout><div className="p-8 text-center text-attention">Session not found</div></AppLayout>;

    return (
        <AppLayout>
            {/* XP tracker — fixed bottom-right chip; awards +15 XP after 60s */}
            {appointment.patient?.id && (
                <PatientRecordReviewTracker patientId={appointment.patient.id} />
            )}
            <div className="h-[calc(100vh-4rem)] flex flex-col">
                {/* Session Header */}
                <div className="px-6 py-4 bg-card border-b border-border/50 flex items-center justify-between shrink-0 gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <Button variant="ghost" size="icon" onClick={safeBack} className="shrink-0">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 truncate">
                                <span className="truncate">Session with {appointment.patient?.fullName || "Patient"}</span>
                                {appointment.consultationMode === "ONLINE" && (
                                    <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase tracking-wider shrink-0">Online</span>
                                )}
                            </h2>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {appointment.patient?.gender || "NA"}, {appointment.patient?.age || "NA"}Y</span>
                                {typeof appointment.patient?.age === "number" && appointment.patient.age < 18 && (
                                    <span
                                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider"
                                        title="Patient is a minor — parental consent and guardian contact may be required."
                                    >
                                        <Shield className="w-3 h-3" /> Minor
                                    </span>
                                )}
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Scheduled for {formatTime(appointment.date)}</span>
                                {(() => {
                                    if (!appointment.date) return null;
                                    if (appointment.arrivedAt) return null;
                                    if (LATENESS_TERMINAL_STATUSES.has(appointment.status)) return null;
                                    const lateMs = Date.now() - new Date(appointment.date).getTime();
                                    const lateMin = Math.floor(lateMs / 60000);
                                    if (lateMin < 5) return null;
                                    const display = lateMin >= 60
                                        ? `${Math.floor(lateMin / 60)}h ${lateMin % 60}m late`
                                        : `Late by ${lateMin} min`;
                                    return (
                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                                            {display}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <Button variant="outline" size="sm" onClick={handleSaveNotes} disabled={isSaving}>
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? "Saving..." : "Save Notes"}
                        </Button>
                        {/* Generate Health Report (Feature 2). Visible to clinicians on
                            in-progress / completed appointments. Idempotent per
                            appointmentId — modal flips to "Resend" if a report already
                            exists. */}
                        {(role === "DOCTOR" || role === "ADMIN_DOCTOR") &&
                         appointment.patient?.id &&
                         !REPORT_HIDDEN_STATUSES.has(appointment.status) && (
                            <GenerateReportButton
                                appointmentId={appointment.id}
                                patientId={appointment.patient.id}
                                patientName={appointment.patient?.fullName || "Patient"}
                                patientHasWhatsApp={
                                    !!appointment.patient?.user?.notificationPreference?.whatsappNumber
                                    || !!appointment.patient?.phoneNumber
                                    || !!appointment.patient?.primaryPhone
                                }
                            />
                        )}
                        <Button size="sm" onClick={handleCompleteSession} className="bg-wellness hover:bg-wellness/90">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Complete Session
                        </Button>
                    </div>
                </div>

                {/* Allergy strip — pinned directly under the header so it can't
                    be missed before prescribing or selecting templates. Sourced
                    from `Patient.allergies` (intake form). Hidden entirely when
                    the patient has no recorded allergies — clinicians need the
                    space, not a "none" sticker. */}
                {appointment.patient?.allergies?.length > 0 && (
                    <div className="px-6 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2 shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-red-700 shrink-0">Allergies</span>
                        <div className="flex flex-wrap gap-1.5">
                            {appointment.patient.allergies.map((a: string) => (
                                <span
                                    key={a}
                                    className="px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-xs font-bold"
                                >
                                    {a}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Split View — patient history rail | consultation | docs */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Far Left: Patient History Panel (collapsible) */}
                    <PatientHistoryPanel patientId={appointment.patient?.id || null} />

                    {/* Left: Consultation Area */}
                    <div className="flex-1 bg-secondary/20 p-6 overflow-y-auto">
                        {appointment.consultationMode === "ONLINE" ? (
                            <div className="h-full flex flex-col gap-6">
                                <VideoCallFrame
                                    meetingLink={appointment.meetingLink}
                                    patientName={appointment.patient?.fullName || "Patient"}
                                    appointmentId={appointmentId}
                                />

                                {/* Chat Section */}
                                <div className="h-64 bg-card border border-border/50 rounded-2xl flex flex-col overflow-hidden">
                                    <div className="px-4 py-2 border-b border-border/50 bg-muted/50 text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 shrink-0">
                                        <MessageSquare className="w-3 h-3" /> Secure Session Chat
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        {appointment.patient?.userId && appointment.doctor?.userId ? (
                                            <ChatWrapper
                                                patientId={appointment.patient.id}
                                                doctorId={appointment.doctor.id}
                                            />
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic h-full">
                                                Messaging will be available once the participants join.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="max-w-md text-center space-y-6">
                                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                        <User className="w-12 h-12 text-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-2xl font-black text-foreground">Offline Consultation</h3>
                                        <p className="text-muted-foreground">The patient is present in-clinic. Use this interface to document session notes and clinical recommendations.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-card border border-border/50 rounded-xl text-left">
                                            <p className="text-xs font-bold text-muted-foreground uppercase">Clinic Location</p>
                                            <p className="text-sm font-medium text-foreground">
                                                {appointment.branch?.name || "—"}
                                                {appointment.therapyRoomBooking?.room?.name && (
                                                    <>
                                                        <span className="text-muted-foreground"> · </span>
                                                        {appointment.therapyRoomBooking.room.name}
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                        <div className="p-4 bg-card border border-border/50 rounded-xl text-left">
                                            <p className="text-xs font-bold text-muted-foreground uppercase">Queue Status</p>
                                            {(() => {
                                                const { label, tone } = describeQueueStatus(
                                                    appointment.arrivalStatus,
                                                    appointment.queuePosition,
                                                );
                                                return (
                                                    <p className={`text-sm font-bold ${queueToneClass[tone]}`}>
                                                        {label}
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Documentation Area.
                        `overflow-y-auto min-h-0` lets this column scroll
                        independently when the stacked sections (PainMap +
                        Notes + Visit Summary + Diet + Templates + Retention)
                        exceed the viewport — previously they were clipped
                        because the column was a fixed-height flex child with
                        no scroll. */}
                    <div className="w-96 bg-card border-l border-border/50 p-6 flex flex-col space-y-6 shrink-0 overflow-y-auto min-h-0">
                        {/* ── 1. Clinical Notes ─────────────────────────────────────
                            Doctor's primary work surface — typed all session. Quick
                            Templates live inline (chips above the textarea) instead
                            of as a standalone card lower down, since they only ever
                            modify the textarea below them. */}
                        <div className="space-y-2">
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-foreground flex items-center gap-2 uppercase tracking-tight">
                                    <FileText className="w-4 h-4 text-primary" />
                                    Clinical Notes
                                </h3>
                                <p className="text-xs text-muted-foreground">Notes are visible to the assigned clinical team.</p>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] font-medium"
                                    onClick={() => setNotes(prev => prev + "\n[CBT Framework Applied]: Motivation check, Core belief identification.")}
                                >
                                    + CBT Framework
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] font-medium"
                                    onClick={() => setNotes(prev => prev + "\n[Progress Evaluation]: Stable, showing improved emotional regulation.")}
                                >
                                    + Progress Note
                                </Button>
                            </div>

                            <textarea
                                className="min-h-[200px] w-full bg-secondary/30 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 p-4 text-sm font-medium leading-relaxed resize-y transition-all"
                                placeholder="Document observations, therapeutic interventions, and patient progress..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        {/* ── 2. Visit Summary ─────────────────────────────────────
                            Post-consultation document for the patient. Open the
                            modal to author diagnosis, prescriptions, exercise plan,
                            and optionally send to the patient portal. */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                <ClipboardCheck className="w-4 h-4 text-primary" />
                                Visit Summary
                            </h3>
                            {visitSummary ? (
                                <div className="p-4 bg-secondary/30 rounded-xl space-y-2">
                                    <p className="text-xs text-muted-foreground line-clamp-3">
                                        {visitSummary.diagnosis
                                            || visitSummary.treatmentNotes
                                            || "Summary draft saved — open to review."}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowVisitSummaryModal(true)}
                                        className="text-xs font-medium text-primary hover:underline"
                                    >
                                        {visitSummary.sentToPatient ? "View summary →" : "Edit summary →"}
                                    </button>
                                </div>
                            ) : (
                                <div className="p-4 bg-secondary/30 rounded-xl text-center space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                        No visit summary yet
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowVisitSummaryModal(true)}
                                        className="text-xs font-medium text-primary hover:underline"
                                    >
                                        Create summary →
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── 3. Patient Snapshot ──────────────────────────────────
                            Inlined (see InlinePatientSnapshot above) because the
                            standalone component file kept getting served stale
                            by Vite's HMR — likely OneDrive timestamps. The
                            `showPainMap` role gate was removed: the snapshot
                            is useful to every clinician role in the room
                            (DOCTOR, ADMIN_DOCTOR, THERAPIST) and the +Record
                            action is itself role-gated server-side. */}
                        {/* F01 — Digital Twin (top of column). Renders nothing
                            when feature off or fetch fails. Sits ABOVE the
                            patient snapshot per spec. */}
                        <DigitalTwinPanel patientId={appointment.patient?.id ?? null} />

                        {appointment.patient?.id && (
                            <InlinePatientSnapshot
                                patientId={appointment.patient.id}
                                onRecord={() => setShowIntakeModal(true)}
                            />
                        )}

                        {/* F04 — Dosha Forecast (renders nothing when flag is off
                            or the patient has no forecast history yet). */}
                        <DoshaForecastPanel patientId={appointment.patient?.id ?? null} />

                        {/* F03 — Tongue Pariksha trend (renders nothing when
                            flag is off or no observations exist). */}
                        <TongueTrendChart patientId={appointment.patient?.id ?? null} />

                        {/* Subtle separator — informational sections above, action
                            items below. Mirrors the conceptual grouping. */}
                        <div className="border-t border-border/50" />

                        {/* ── 4. Diet Prescription ─────────────────────────────────
                            Patient's active plan. Distinct from diet *packages*
                            (templates); this is the instantiated prescription
                            currently in effect. */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                <Salad className="w-4 h-4 text-wellness" />
                                Diet Prescription
                            </h3>
                            {activeDiet ? (
                                <div className="p-4 bg-wellness/5 border border-wellness/20 rounded-xl space-y-1">
                                    <p className="text-sm font-medium text-foreground truncate">
                                        {activeDiet.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {activeDiet.doshaTarget} · {activeDiet.category}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic p-4 bg-secondary/30 rounded-xl">
                                    No active diet prescription on file.
                                </p>
                            )}
                        </div>

                        {/* ── 5. Retention Checklist — follow-up adherence ─────── */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-black text-foreground uppercase tracking-tight flex items-center gap-1.5">
                                        <ClipboardList className="w-3.5 h-3.5 text-primary" />
                                        Retention Checklist
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Record patient follow-up adherence across 5 structured categories.
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowChecklist(true)}
                                    className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5 shrink-0"
                                >
                                    <ClipboardList className="w-3 h-3" />
                                    Open
                                </Button>
                            </div>
                        </div>

                        {appointmentId && (
                            <RetentionChecklistModal
                                isOpen={showChecklist}
                                onClose={() => setShowChecklist(false)}
                                appointmentId={appointmentId}
                                patientName={appointment?.patient?.fullName || appointment?.patient?.user?.email}
                                onSuccess={() => toast.success("Retention checklist saved")}
                            />
                        )}

                        {appointmentId && (
                            <VisitSummaryModal
                                isOpen={showVisitSummaryModal}
                                onClose={() => setShowVisitSummaryModal(false)}
                                appointmentId={appointmentId}
                                onSaved={(record) => setVisitSummary(record)}
                                onSent={(record) => setVisitSummary(record)}
                            />
                        )}

                        <FollowUpSchedulerModal
                            open={showFollowUpModal}
                            onClose={() => setShowFollowUpModal(false)}
                            onSubmit={submitCompletion}
                            submitting={completing}
                            patientName={appointment?.patient?.fullName}
                            submitLabel="Complete Session"
                        />

                        {appointment.patient?.id && (
                            <RecordIntakeModal
                                open={showIntakeModal}
                                onOpenChange={setShowIntakeModal}
                                patientId={appointment.patient.id}
                                patientGender={appointment.patient?.gender}
                            />
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

// ── Embedded video call frame ─────────────────────────────────────────
//
// Embeds the meeting URL directly in an iframe so the doctor never leaves
// the app. Works with both providers:
//
//   - Daily.co: rooms at `*.daily.co/...` — the hosted room page handles
//     camera/mic setup, waiting-room admit (knocking), chat, screenshare.
//   - Jitsi: rooms at `meet.jit.si/...` — hosted page similarly handles
//     everything; we pass `#config.prejoinPageEnabled=true` to get a proper
//     pre-join screen.
//
// If meetingLink is null (booking glitch), render a recovery card with a
// plain external-tab fallback so the call is still reachable.
function VideoCallFrame({
    meetingLink,
    patientName,
    appointmentId,
}: {
    meetingLink: string | null;
    patientName: string;
    appointmentId?: string;
}) {
    const [tokenedUrl, setTokenedUrl] = useState<string | null>(null);
    const [tokenResolved, setTokenResolved] = useState(false);

    useEffect(() => {
        if (!appointmentId) {
            setTokenResolved(true);
            return;
        }
        let cancelled = false;
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        const FETCH_TIMEOUT_MS = 5000;
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
                () => reject(new Error("videoSession.get timed out")),
                FETCH_TIMEOUT_MS,
            );
        });
        (async () => {
            try {
                const data = await Promise.race([
                    videoSessionService.get(appointmentId),
                    timeoutPromise,
                ]);
                if (cancelled) return;
                if (data?.meetingToken && data?.url) {
                    setTokenedUrl(`${data.url}?t=${encodeURIComponent(data.meetingToken)}`);
                }
            } catch (err) {
                if (!cancelled) {
                    console.warn("[VideoCallFrame] token fetch failed — using raw meetingLink", err);
                }
            } finally {
                if (timeoutHandle !== null) clearTimeout(timeoutHandle);
                if (!cancelled) setTokenResolved(true);
            }
        })();
        return () => {
            cancelled = true;
            if (timeoutHandle !== null) clearTimeout(timeoutHandle);
        };
    }, [appointmentId]);

    const embeddedUrl = useMemo(() => {
        if (!meetingLink) return null;
        try {
            const u = new URL(meetingLink);
            if (u.hostname.includes('jit.si')) {
                u.hash = 'config.prejoinPageEnabled=true&config.disableInviteFunctions=true';
            }
            return u.toString();
        } catch {
            return meetingLink;
        }
    }, [meetingLink]);

    const finalSrc = tokenedUrl || embeddedUrl;

    if (!tokenResolved) {
        return (
            <div className="flex-1 bg-black rounded-3xl overflow-hidden flex items-center justify-center">
                <div className="text-center space-y-4 p-8">
                    <Loader2 className="w-10 h-10 text-white/50 animate-spin mx-auto" />
                    <p className="text-white/60 text-sm font-medium">
                        Connecting to consultation room…
                    </p>
                </div>
            </div>
        );
    }

    if (!finalSrc) {
        return (
            <div className="flex-1 bg-black rounded-3xl overflow-hidden flex items-center justify-center">
                <div className="text-center space-y-4 p-8">
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mx-auto">
                        <Video className="w-10 h-10 text-white/50" />
                    </div>
                    <p className="text-white/60 text-sm font-medium">
                        This appointment doesn't have a meeting link yet.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 bg-black rounded-3xl overflow-hidden relative group">
            <iframe
                title={`Video call with ${patientName}`}
                src={finalSrc}
                className="w-full h-full border-0"
                allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; clipboard-write"
                allowFullScreen
            />
            <div className="absolute bottom-6 left-6 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-bold border border-white/10 pointer-events-none">
                Embedded call with {patientName}
            </div>
            <Button
                asChild
                size="sm"
                variant="outline"
                className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white border-white/20 hover:bg-black/60 hover:text-white"
            >
                <a href={finalSrc} target="_blank" rel="noopener noreferrer" title="Open in a separate tab">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Pop out
                </a>
            </Button>
        </div>
    );
}

