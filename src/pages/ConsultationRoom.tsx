
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
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
} from "lucide-react";
import { toast } from "sonner";
import { ChatWrapper } from "@/components/chat/ChatWrapper";
import { RetentionChecklistModal } from "@/components/RetentionChecklistModal";
import { FollowUpSchedulerModal } from "@/components/followup/FollowUpSchedulerModal";
import { PatientHistoryPanel } from "@/components/consultation/PatientHistoryPanel";
import { GenerateReportButton } from "@/components/consultation/GenerateReportButton";
import { PainMapCard } from "@/components/patient/PainMapCard";
import { PatientRecordReviewTracker } from "@/components/doctor/PatientRecordReviewTracker";
import { VisitSummaryModal } from "@/components/consultation/VisitSummaryModal";
import { videoSessionService } from "@/services/videoSession.service";
import { useAuth } from "@/hooks/useAuth";
import type { FollowUpPayload } from "@/services/followUp.service";
import { iwisApi, type DietPrescription } from "@/services/iwis.service";
import { communicationApi } from "@/services/communication.service";
import { ApiClientError } from "@/lib/api-client";
import type { VisitSummaryEntry } from "@/types";

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

    const fetchAppointment = async () => {
        try {
            const { data } = await apiClient.get<any>(`/api/appointments/${appointmentId}`);
            setAppointment(data);
            setNotes(data.sessionNotes || "");
        } catch (error) {
            toast.error("Failed to fetch appointment details");
        } finally {
            setLoading(false);
        }
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

    const handleSaveNotes = async () => {
        setIsSaving(true);
        try {
            await apiClient.post(`/api/consultations/session/${appointmentId}/notes`, { sessionNotes: notes });
            toast.success("Notes saved successfully");
        } catch (error) {
            toast.error("Failed to save notes");
        } finally {
            setIsSaving(false);
        }
    };

    // Consultation can no longer be completed without a follow-up
    // decision. Clicking "Complete Session" now opens the scheduler;
    // submitting that modal is what actually POSTs /complete with the
    // follow-up payload.
    const handleCompleteSession = () => {
        setShowFollowUpModal(true);
    };

    const submitCompletion = async (followUp: FollowUpPayload) => {
        setCompleting(true);
        try {
            // Save notes first so they persist even if the completion
            // request fails for any reason.
            await handleSaveNotes();

            await apiClient.post(`/api/consultations/session/${appointmentId}/complete`, { followUp });
            toast.success("Session completed — follow-up saved");
            setShowFollowUpModal(false);
            navigate("/therapist");
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
                <div className="px-6 py-4 bg-card border-b border-border/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/therapist")}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                Session with {appointment.patient?.fullName || "Patient"}
                                {appointment.consultationMode === "ONLINE" && (
                                    <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full uppercase tracking-wider">Online</span>
                                )}
                            </h2>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {appointment.patient?.gender || "NA"}, {appointment.patient?.age || "NA"}Y</span>
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Scheduled for {new Date(appointment.date).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
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
                         (appointment.status === "COMPLETED" ||
                          true) && (
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
                                            <p className="text-sm font-medium text-foreground">Main Branch - Room 402</p>
                                        </div>
                                        <div className="p-4 bg-card border border-border/50 rounded-xl text-left">
                                            <p className="text-xs font-bold text-muted-foreground uppercase">Queue Status</p>
                                            <p className="text-sm font-medium text-wellness font-bold">Active Now</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Documentation Area */}
                    <div className="w-96 bg-card border-l border-border/50 p-6 flex flex-col space-y-6 shrink-0">
                        {showPainMap && appointment.patient?.id && (
                            <PainMapCard patientId={appointment.patient.id} />
                        )}

                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-foreground flex items-center gap-2 uppercase tracking-tight">
                                <FileText className="w-4 h-4 text-primary" />
                                Clinical Notes
                            </h3>
                            <p className="text-xs text-muted-foreground">Notes are visible to the assigned clinical team.</p>
                        </div>

                        <textarea
                            className="flex-1 w-full bg-secondary/30 rounded-2xl border-none focus:ring-2 focus:ring-primary/20 p-4 text-sm font-medium leading-relaxed resize-none transition-all"
                            placeholder="Document observations, therapeutic interventions, and patient progress..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />

                        {/* Visit Summary — post-consultation document for the
                            patient. Click "Edit" / "Create" to open the full
                            modal where the doctor authors diagnosis,
                            prescriptions, exercise plan, etc. and optionally
                            sends to the patient portal. */}
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

                        {/* Diet Prescription — patient's active plan. Distinct
                            from diet *packages* (templates); this is the
                            instantiated prescription currently in effect. */}
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

                        <Panel title="Quick Templates" subtitle="Therapeutic frameworks">
                            <div className="space-y-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-left justify-start text-[10px] h-auto p-3"
                                    onClick={() => setNotes(prev => prev + "\n[CBT Framework Applied]: Motivation check, Core belief identification.")}
                                >
                                    Apply CBT Framework
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-left justify-start text-[10px] h-auto p-3"
                                    onClick={() => setNotes(prev => prev + "\n[Progress Evaluation]: Stable, showing improved emotional regulation.")}
                                >
                                    Standard Progress Note
                                </Button>
                            </div>
                        </Panel>

                        {/* Retention Checklist — follow-up adherence tracking */}
                        <div className="space-y-2 pt-2 border-t border-border/50">
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

