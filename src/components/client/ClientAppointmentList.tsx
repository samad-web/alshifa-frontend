import { useState } from "react";
import { Calendar, Clock, MessageSquare, ChevronRight, Video, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ClientAppointmentStatus } from "@/components/client/ClientAppointmentStatus";

interface Appointment {
    id: string;
    date: string;
    status: string;
    notes?: string;
    doctor?: {
        fullName?: string;
        user: { email: string };
    };
    therapist?: {
        fullName?: string;
        user: { email: string };
    };
    consultationMode?: string;
    consultationType?: string;
    meetingLink?: string;
    doctorApproved: boolean;
    therapistApproved: boolean;
}

interface ClientAppointmentListProps {
    appointments: Appointment[];
    emptyMessage?: string;
    onCancel?: (appointmentId: string) => Promise<void>;
}

const CANCELLABLE_STATUSES = ["PENDING", "SCHEDULED", "CONFIRMED", "ACCEPTED", "PENDING_DOCTOR_APPROVAL", "PENDING_THERAPIST_APPROVAL"];

export function ClientAppointmentList({
    appointments,
    emptyMessage = "No appointments found.",
    onCancel,
}: ClientAppointmentListProps) {
    const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const handleConfirmCancel = async () => {
        if (!cancelTarget || !onCancel) return;
        setCancelling(true);
        try {
            await onCancel(cancelTarget.id);
        } finally {
            setCancelling(false);
            setCancelTarget(null);
        }
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return {
            date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
        };
    };

    if (appointments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-xl bg-muted/30">
                <Calendar className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="grid gap-6">
            {appointments.map((appointment) => {
                const { date, time } = formatDateTime(appointment.date);
                const clinicianName = appointment.doctor?.fullName || appointment.therapist?.fullName || "Assigned Specialist";

                return (
                    <div key={appointment.id} className="card-elevated overflow-hidden bg-card transition-all duration-300 group">
                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x border-b border-border/50">
                            {/* Left Side: Basic Info */}
                            <div className="p-5 flex-1 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Calendar className="w-4 h-4" />
                                            <span className="font-bold">{date}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-sm font-medium">{time}</span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                                        appointment.status === "PENDING" ? "badge-attention" :
                                            appointment.status === "ACCEPTED" || appointment.status === "CONFIRMED" ? "badge-wellness" :
                                                "bg-muted text-muted-foreground"
                                    )}>
                                        {appointment.status.replace(/_/g, " ")}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-4 bg-muted/30 p-3 rounded-lg border border-border/50">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                        {clinicianName.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Your Specialist</p>
                                        <p className="text-sm font-bold text-foreground truncate">{clinicianName}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {appointment.consultationMode === "ONLINE" && (
                                            <div className="p-2 bg-primary/10 rounded-full text-primary" title="Online Session">
                                                <Video className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Detailed Status / Action */}
                            <div className="p-5 md:w-[280px] bg-muted/10 flex flex-col justify-between space-y-4">
                                <ClientAppointmentStatus
                                    status={appointment.status}
                                    doctorApproved={appointment.doctorApproved}
                                    therapistApproved={appointment.therapistApproved}
                                    consultationType={appointment.consultationType}
                                />

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 bg-background text-xs font-bold gap-2 rounded-lg"
                                        onClick={() => window.location.href = `/chat?partner=${appointment.doctor?.user.email || appointment.therapist?.user.email}`}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" /> Message
                                    </Button>
                                    {onCancel && CANCELLABLE_STATUSES.includes(appointment.status) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-xs font-bold gap-1.5 rounded-lg text-risk border-risk/20 hover:bg-risk/10 hover:text-risk"
                                            onClick={() => setCancelTarget(appointment)}
                                        >
                                            <XCircle className="w-3.5 h-3.5" /> Cancel
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        className="rounded-lg shadow-sm"
                                        title="View Details"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Meeting Link for Online Sessions */}
                        {appointment.consultationMode === "ONLINE" && (appointment.status === "ACCEPTED" || appointment.status === "CONFIRMED") && appointment.meetingLink && (
                            <div className="bg-primary/5 px-5 py-3 flex items-center justify-between border-t border-primary/10">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    <p className="text-xs font-semibold text-primary">Your session is ready.</p>
                                </div>
                                <Button
                                    size="sm"
                                    className="h-8 text-[11px] font-bold rounded-md bg-primary hover:bg-primary/90"
                                    onClick={() => window.open(appointment.meetingLink, "_blank")}
                                >
                                    Join Now
                                </Button>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Cancel Confirmation Dialog */}
            <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
                <DialogContent className="sm:max-w-sm p-0 rounded-xl overflow-hidden">
                    {/* Warning banner */}
                    <div className="bg-risk/5 border-b border-risk/10 px-5 pt-5 pb-4">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2.5 text-risk text-base">
                                <div className="p-2 bg-risk/10 rounded-full">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                Cancel Appointment
                            </DialogTitle>
                        </DialogHeader>
                    </div>

                    <div className="px-5 py-4 space-y-4">
                        {/* Appointment summary */}
                        {cancelTarget && (
                            <div className="bg-muted/30 rounded-lg border border-border/50 p-3 space-y-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Specialist</span>
                                    <span className="font-bold text-foreground">
                                        {cancelTarget.doctor?.fullName || cancelTarget.therapist?.fullName || "Assigned Specialist"}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Date</span>
                                    <span className="font-bold text-foreground">
                                        {new Date(cancelTarget.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Time</span>
                                    <span className="font-bold text-foreground">
                                        {new Date(cancelTarget.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                                    </span>
                                </div>
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Are you sure you want to cancel this appointment? This action cannot be undone and your specialist will be notified.
                        </p>
                    </div>

                    <div className="flex gap-3 px-5 pb-5">
                        <Button
                            variant="outline"
                            className="flex-1 text-sm"
                            onClick={() => setCancelTarget(null)}
                            disabled={cancelling}
                        >
                            Keep Appointment
                        </Button>
                        <Button
                            className="flex-1 bg-risk hover:bg-risk/90 text-white border-0 text-sm"
                            onClick={handleConfirmCancel}
                            disabled={cancelling}
                        >
                            {cancelling ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                            ) : (
                                <XCircle className="w-4 h-4 mr-1.5" />
                            )}
                            {cancelling ? "Cancelling..." : "Yes, Cancel"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
