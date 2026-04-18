import { useState, useEffect } from "react";
import { Navigation } from "@/components/layout/navigation";
import { AppointmentModal } from "@/components/appointment-modal";
import { AppointmentList } from "@/components/appointment-list";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CalendarDays, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/contexts/NotificationContext";
import { apiClient } from "@/lib/api-client";
import { AppointmentsSkeleton } from "@/components/ui/page-skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";

type AppointmentStatus = "ALL" | "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";

export default function Appointments() {
    const { role } = useAuth();
    const { addNotification } = useNotifications();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [pagination, setPagination] = useState<any>({ total: 0, page: 1, limit: 20, totalPages: 0 });
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<AppointmentStatus>("ALL");
    const [cancelTarget, setCancelTarget] = useState<any>(null);
    const [cancelling, setCancelling] = useState(false);

    const canApprove = ["DOCTOR", "THERAPIST", "ADMIN", "ADMIN_DOCTOR"].includes(role || "");

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const { data } = await apiClient.get<any>('/api/appointments');
            if (data.appointments) {
                setAppointments(data.appointments);
                setPagination(data.pagination);
            } else {
                setAppointments(data);
            }
        } catch (error: any) {
            console.error("Failed to fetch appointments:", error);
            toast.error(error?.message || "Could not connect to the server. Please check your internet connection.");
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (appointment: any) => {
        setEditingAppointment(appointment);
        setModalOpen(true);
    };

    const handleCancel = (appointmentId: string) => {
        const appointment = appointments.find(a => a.id === appointmentId);
        setCancelTarget(appointment || { id: appointmentId });
    };

    const confirmCancel = async () => {
        if (!cancelTarget) return;
        setCancelling(true);
        try {
            await apiClient.delete(`/api/appointments/${cancelTarget.id}`);
            toast.success("Appointment cancelled successfully");
            setAppointments((prev) => prev.filter((a) => a.id !== cancelTarget.id));
        } catch (error: any) {
            toast.error(error?.message || "Failed to cancel appointment");
        } finally {
            setCancelling(false);
            setCancelTarget(null);
        }
    };

    const handleApprove = async (appointmentId: string) => {
        try {
            const { data: updatedAppointment } = await apiClient.put<any>(`/api/appointments/${appointmentId}/approve`, {});
            toast.success("Appointment approved successfully");

            // Trigger notification for the patient
            addNotification({
                type: "appointment_confirmed",
                title: "Appointment Confirmed",
                message: `Your appointment on ${new Date(updatedAppointment.date).toLocaleDateString()} has been approved.`,
                data: { appointmentId: updatedAppointment.id },
                priority: 'MEDIUM'
            });

            setAppointments((prev) => prev.map((a) => a.id === appointmentId ? { ...a, ...updatedAppointment } : a));
        } catch (error: any) {
            toast.error(error?.message || "Failed to approve appointment");
        }
    };

    const handleReject = async (appointmentId: string) => {
        // Confirmation is handled by the themed dialog in AppointmentList
        try {
            const { data: updatedAppointment } = await apiClient.put<any>(`/api/appointments/${appointmentId}/reject`, {});
            toast.success("Appointment rejected successfully");

            // Trigger notification for the patient
            addNotification({
                type: "appointment_rejected",
                title: "Appointment Not Approved",
                message: `Your appointment request for ${new Date(updatedAppointment.date).toLocaleDateString()} was not approved.`,
                data: { appointmentId: updatedAppointment.id },
                priority: 'MEDIUM'
            });

            setAppointments((prev) => prev.map((a) => a.id === appointmentId ? { ...a, ...updatedAppointment } : a));
        } catch (error: any) {
            toast.error(error?.message || "Failed to reject appointment");
        }
    };

    const now = new Date();

    // Appointments whose date has passed but status is still active → treat as past
    const isDatePassed = (apt: any) => new Date(apt.date) < now;
    const isActiveStatus = (apt: any) => ["PENDING", "ACCEPTED", "CONFIRMED", "SCHEDULED", "PENDING_THERAPIST_APPROVAL", "PENDING_DOCTOR_APPROVAL"].includes(apt.status);

    const filteredAppointments = appointments.filter((apt) => {
        if (activeTab === "ALL") return true;
        if (activeTab === "PENDING") {
            return ["PENDING", "PENDING_THERAPIST_APPROVAL", "PENDING_DOCTOR_APPROVAL"].includes(apt.status) && !isDatePassed(apt);
        }
        if (activeTab === "CONFIRMED") {
            return ["CONFIRMED", "ACCEPTED", "SCHEDULED"].includes(apt.status) && !isDatePassed(apt);
        }
        if (activeTab === "COMPLETED") {
            // Show completed, cancelled, no-show, AND any active-status appointments whose date has passed
            return apt.status === "COMPLETED" || apt.status === "NO_SHOW" || (isActiveStatus(apt) && isDatePassed(apt));
        }
        if (activeTab === "CANCELLED") {
            return apt.status === "CANCELLED";
        }
        return apt.status === activeTab;
    });

    const getTabCount = (status: AppointmentStatus) => {
        if (status === "ALL") return appointments.length;
        if (status === "PENDING") {
            return appointments.filter((apt) => ["PENDING", "PENDING_THERAPIST_APPROVAL", "PENDING_DOCTOR_APPROVAL"].includes(apt.status) && !isDatePassed(apt)).length;
        }
        if (status === "CONFIRMED") {
            return appointments.filter((apt) => ["CONFIRMED", "ACCEPTED", "SCHEDULED"].includes(apt.status) && !isDatePassed(apt)).length;
        }
        if (status === "COMPLETED") {
            return appointments.filter((apt) => apt.status === "COMPLETED" || apt.status === "NO_SHOW" || (isActiveStatus(apt) && isDatePassed(apt))).length;
        }
        return appointments.filter((apt) => apt.status === status).length;
    };

    return (
        <>
            <Navigation />
            <div className="min-h-screen bg-background pt-16 md:pt-20 px-4 md:px-8 pb-12">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                                <CalendarDays className="h-8 w-8 text-primary" />
                                Appointments
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Manage and approve appointment requests
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AppointmentStatus)}>
                        <TabsList className="flex w-full overflow-x-auto h-auto p-1 bg-muted/50 gap-1 no-scrollbar">
                            <TabsTrigger value="ALL" className="flex-1 min-w-[80px] gap-2">
                                All
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {getTabCount("ALL")}
                                </span>
                            </TabsTrigger>
                            <TabsTrigger value="PENDING" className="flex-1 min-w-[100px] gap-2">
                                <Clock className="h-3 w-3" />
                                Pending
                                <span className="text-xs bg-attention/10 text-attention px-1.5 py-0.5 rounded">
                                    {getTabCount("PENDING")}
                                </span>
                            </TabsTrigger>
                            <TabsTrigger value="CONFIRMED" className="flex-1 min-w-[110px] gap-2">
                                <CheckCircle2 className="h-3 w-3" />
                                Confirmed
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                    {getTabCount("CONFIRMED")}
                                </span>
                            </TabsTrigger>
                            <TabsTrigger value="COMPLETED" className="flex-1 min-w-[110px] gap-2">
                                Completed
                                <span className="text-xs bg-wellness/10 text-wellness px-1.5 py-0.5 rounded">
                                    {getTabCount("COMPLETED")}
                                </span>
                            </TabsTrigger>
                            <TabsTrigger value="CANCELLED" className="flex-1 min-w-[100px] gap-2">
                                <XCircle className="h-3 w-3" />
                                Cancelled
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                    {getTabCount("CANCELLED")}
                                </span>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value={activeTab} className="mt-6">
                            {loading ? (
                                <AppointmentsSkeleton />
                            ) : filteredAppointments.length === 0 ? (
                                <EmptyState
                                    variant="appointments"
                                    title={`No ${activeTab === "ALL" ? "" : activeTab.toLowerCase()} appointments`}
                                    description="Your schedule is clear. New appointments will appear here when booked."
                                />
                            ) : (
                                <AppointmentList
                                    appointments={filteredAppointments}
                                    onEdit={canApprove ? handleEdit : undefined}
                                    onCancel={handleCancel}
                                    onApprove={canApprove ? handleApprove : undefined}
                                    onReject={canApprove ? handleReject : undefined}
                                    showPatientName={true}
                                    emptyMessage={`No ${activeTab === "ALL" ? "" : activeTab.toLowerCase()} appointments`}
                                />
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            {/* Cancel Confirmation Dialog */}
            <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
                <DialogContent className="sm:max-w-sm p-0 rounded-xl overflow-hidden">
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
                        {cancelTarget && (
                            <div className="bg-muted/30 rounded-lg border border-border/50 p-3 space-y-2">
                                {(cancelTarget.patient?.fullName || cancelTarget.patient?.user?.email) && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Patient</span>
                                        <span className="font-bold text-foreground">{cancelTarget.patient.fullName || cancelTarget.patient.user.email}</span>
                                    </div>
                                )}
                                {cancelTarget.date && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Date</span>
                                        <span className="font-bold text-foreground">
                                            {new Date(cancelTarget.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </span>
                                    </div>
                                )}
                                {(cancelTarget.doctor?.fullName || cancelTarget.therapist?.fullName) && (
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Clinician</span>
                                        <span className="font-bold text-foreground">
                                            {cancelTarget.doctor?.fullName || cancelTarget.therapist?.fullName}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            This will permanently cancel the appointment and notify all parties. This action cannot be undone.
                        </p>
                    </div>
                    <div className="flex gap-3 px-5 pb-5">
                        <Button variant="outline" className="flex-1 text-sm" onClick={() => setCancelTarget(null)} disabled={cancelling}>
                            Keep Appointment
                        </Button>
                        <Button className="flex-1 bg-risk hover:bg-risk/90 text-white border-0 text-sm" onClick={confirmCancel} disabled={cancelling}>
                            {cancelling ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <XCircle className="w-4 h-4 mr-1.5" />}
                            {cancelling ? "Cancelling..." : "Confirm Cancel"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Appointment Modal */}
            <AppointmentModal
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingAppointment(null);
                }}
                onSuccess={fetchAppointments}
                appointment={editingAppointment}
            />
        </>
    );
}
