
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Input } from "@/components/ui/input";
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
    History,
    ChevronDown,
    Salad,
    Loader2,
    UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { ChatWrapper } from "@/components/chat/ChatWrapper";
import { RetentionChecklistModal } from "@/components/RetentionChecklistModal";
import { FollowUpSchedulerModal } from "@/components/followup/FollowUpSchedulerModal";
import { PatientHistoryPanel } from "@/components/consultation/PatientHistoryPanel";
import type { FollowUpPayload } from "@/services/followUp.service";
import { iwisApi, type DietPackage } from "@/services/iwis.service";

interface PreviousPrescription {
    id: string;
    medicationName?: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    notes?: string;
    timing?: string;
    vehicle?: string;
    videoUrl?: string;
    createdAt: string;
    doctor?: { fullName?: string };
}

export default function ConsultationRoom() {
    const { appointmentId } = useParams();
    const navigate = useNavigate();
    const [appointment, setAppointment] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [notes, setNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const [completing, setCompleting] = useState(false);

    // Previous prescriptions panel — collapsible, fetched once the patient is
    // resolved on the appointment payload. The doctor needs a quick read of
    // prior medications without leaving the consultation screen.
    const [previousOpen, setPreviousOpen] = useState(false);
    const [previousList, setPreviousList] = useState<PreviousPrescription[] | null>(null);
    const [previousLoading, setPreviousLoading] = useState(false);

    // Diet package picker — searches APPROVED + active templates and assigns
    // the chosen one to the patient inline so the doctor doesn't have to
    // navigate away to /diet-packages.
    const [dietOpen, setDietOpen] = useState(false);
    const [dietPackages, setDietPackages] = useState<DietPackage[]>([]);
    const [dietLoading, setDietLoading] = useState(false);
    const [dietQuery, setDietQuery] = useState("");
    const [dietAssigningId, setDietAssigningId] = useState<string | null>(null);

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

    // Lazy-load the previous prescriptions list the first time the panel is
    // opened. We don't pre-fetch on mount to keep the consult-room cold start
    // fast — most sessions never need this surface.
    const loadPreviousPrescriptions = async () => {
        if (!patientId || previousList !== null || previousLoading) return;
        setPreviousLoading(true);
        try {
            const { data } = await apiClient.get<PreviousPrescription[]>(`/api/prescriptions/patient/${patientId}`);
            setPreviousList(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load previous prescriptions");
            setPreviousList([]);
        } finally {
            setPreviousLoading(false);
        }
    };

    const togglePrevious = async () => {
        const next = !previousOpen;
        setPreviousOpen(next);
        if (next) await loadPreviousPrescriptions();
    };

    const loadDietPackages = async () => {
        if (dietPackages.length > 0 || dietLoading) return;
        setDietLoading(true);
        try {
            const list = await iwisApi.listDietPackages({ status: "APPROVED" });
            setDietPackages(list.filter((p) => p.isActive));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to load diet packages");
        } finally {
            setDietLoading(false);
        }
    };

    const toggleDiet = async () => {
        const next = !dietOpen;
        setDietOpen(next);
        if (next) await loadDietPackages();
    };

    const filteredDietPackages = useMemo(() => {
        const q = dietQuery.trim().toLowerCase();
        if (!q) return dietPackages;
        return dietPackages.filter((p) =>
            (p.title || "").toLowerCase().includes(q) ||
            (p.doshaTarget || "").toLowerCase().includes(q) ||
            (p.category || "").toLowerCase().includes(q));
    }, [dietPackages, dietQuery]);

    const assignDietPackage = async (pkg: DietPackage) => {
        if (!patientId) return;
        setDietAssigningId(pkg.id);
        try {
            await iwisApi.assignDietPackage(pkg.id, {
                patientId,
                durationDays: pkg.durationDays,
                deactivateExisting: false,
            });
            toast.success(`Assigned "${pkg.title}" — patient notified`);
        } catch (err: unknown) {
            // Surface the conflict in plain text rather than blocking the
            // consultation flow with a modal — the doctor can always retry
            // from the Diet Packages page if they need fine-grained control.
            const msg = err instanceof Error ? err.message : "Assign failed";
            toast.error(msg);
        } finally {
            setDietAssigningId(null);
        }
    };

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

                        {/* Previous Prescriptions — collapsible. Doctor can review
                            prior medications without leaving the consultation. */}
                        <div className="border border-border/50 rounded-xl overflow-hidden">
                            <button
                                type="button"
                                onClick={togglePrevious}
                                className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 text-xs font-bold uppercase tracking-tight hover:bg-muted/60 transition-colors"
                            >
                                <span className="flex items-center gap-1.5 text-foreground">
                                    <History className="w-3.5 h-3.5 text-primary" />
                                    Previous Prescriptions
                                    {previousList && (
                                        <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                                            {previousList.length}
                                        </Badge>
                                    )}
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${previousOpen ? "rotate-180" : ""}`} />
                            </button>
                            {previousOpen && (
                                <div className="p-3 max-h-72 overflow-y-auto">
                                    {previousLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Loading prescriptions…
                                        </div>
                                    ) : !previousList || previousList.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic py-2">
                                            No prior prescriptions on file for this patient.
                                        </p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {previousList.slice(0, 30).map((p) => (
                                                <li key={p.id} className="p-2 rounded-md bg-secondary/30 border border-border/40">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-xs font-bold text-foreground truncate">
                                                            {p.medicationName || "—"}
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                                            {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                                                        {p.dosage && <span>· {p.dosage}</span>}
                                                        {p.frequency && <span>· {p.frequency}</span>}
                                                        {p.duration && <span>· {p.duration}</span>}
                                                    </div>
                                                    {p.notes && <p className="text-[10px] text-muted-foreground italic mt-1 line-clamp-2">{p.notes}</p>}
                                                    {p.doctor?.fullName && (
                                                        <p className="text-[9px] text-muted-foreground mt-0.5">— Dr. {p.doctor.fullName}</p>
                                                    )}
                                                </li>
                                            ))}
                                            {previousList.length > 30 && (
                                                <li className="text-[10px] text-center text-muted-foreground italic">
                                                    + {previousList.length - 30} older entries
                                                </li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Diet Package — search & assign without leaving the consultation. */}
                        <div className="border border-border/50 rounded-xl overflow-hidden">
                            <button
                                type="button"
                                onClick={toggleDiet}
                                className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 text-xs font-bold uppercase tracking-tight hover:bg-muted/60 transition-colors"
                            >
                                <span className="flex items-center gap-1.5 text-foreground">
                                    <Salad className="w-3.5 h-3.5 text-wellness" />
                                    Diet Package
                                </span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${dietOpen ? "rotate-180" : ""}`} />
                            </button>
                            {dietOpen && (
                                <div className="p-3 space-y-2">
                                    <Input
                                        value={dietQuery}
                                        onChange={(e) => setDietQuery(e.target.value)}
                                        placeholder="Search package by title, dosha, category…"
                                        className="h-8 text-xs"
                                    />
                                    {dietLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Loading packages…
                                        </div>
                                    ) : filteredDietPackages.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic py-2">
                                            {dietPackages.length === 0
                                                ? "No approved diet packages available."
                                                : "No packages match your search."}
                                        </p>
                                    ) : (
                                        <ul className="space-y-2 max-h-60 overflow-y-auto">
                                            {filteredDietPackages.slice(0, 25).map((pkg) => (
                                                <li
                                                    key={pkg.id}
                                                    className="p-2 rounded-md bg-secondary/30 border border-border/40 flex items-start justify-between gap-2"
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold truncate">{pkg.title}</div>
                                                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                                                            <span>{pkg.doshaTarget}</span>
                                                            <span>· {pkg.category}</span>
                                                            <span>· {pkg.durationDays}d</span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2 text-[10px] gap-1 shrink-0"
                                                        disabled={!patientId || dietAssigningId === pkg.id}
                                                        onClick={() => assignDietPackage(pkg)}
                                                    >
                                                        {dietAssigningId === pkg.id
                                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                                            : <UserPlus className="w-3 h-3" />}
                                                        Assign
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <p className="text-[9px] text-muted-foreground italic">
                                        Need finer control over duration / start date? Open the full Diet Packages module.
                                    </p>
                                </div>
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
}: {
    meetingLink: string | null;
    patientName: string;
}) {
    const embeddedUrl = useMemo(() => {
        if (!meetingLink) return null;
        try {
            const u = new URL(meetingLink);
            // Jitsi supports config overrides via URL hash parameters.
            if (u.hostname.includes('jit.si')) {
                u.hash = 'config.prejoinPageEnabled=true&config.disableInviteFunctions=true';
            }
            // Daily.co doesn't need parameters — the room config was set at create time.
            return u.toString();
        } catch {
            return meetingLink;
        }
    }, [meetingLink]);

    if (!embeddedUrl) {
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
                src={embeddedUrl}
                className="w-full h-full border-0"
                // Permissions the provider needs to run camera + mic + screen share.
                allow="camera; microphone; fullscreen; speaker; display-capture; autoplay; clipboard-write"
                // Best-effort sandbox — same-origin is required for provider scripts,
                // forms + popups permit post-call surveys or sign-in prompts.
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
                <a href={embeddedUrl} target="_blank" rel="noopener noreferrer" title="Open in a separate tab">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Pop out
                </a>
            </Button>
        </div>
    );
}
