
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { AppointmentModal } from "@/components/appointment-modal";
import { AppointmentList } from "@/components/appointment-list";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Users, UserPlus, Activity, MapPin, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranches } from "@/hooks/useBranches";
import { appointmentsApi, type GetAppointmentsParams } from "@/services/appointments.service";
import { apiClient } from "@/lib/api-client";

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ doctors: 0, patients: 0 });
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [sortByBranch, setSortByBranch] = useState<boolean>(false);
  const { branches } = useBranches();

  useEffect(() => {
    async function fetchCounts() {
      setLoadingCounts(true);
      try {
        const [{ data: doctors }, { data: patients }] = await Promise.all([
          apiClient.get<any[]>('/api/user/list-doctors'),
          apiClient.get<any[]>('/api/user/list-patients'),
        ]);
        setCounts({ doctors: doctors.length, patients: patients.length });
      } catch (error) {
        console.error("Failed to fetch counts:", error);
      } finally {
        setLoadingCounts(false);
      }
    }
    fetchCounts();
  }, []);

  // Re-fetch appointments whenever branch filter or sort order changes (including initial mount)
  const fetchAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const params: GetAppointmentsParams = {};
      if (selectedBranch) params.branchId = selectedBranch;
      if (sortByBranch) params.sort = "branch";
      const data = await appointmentsApi.list(params);
      setAppointments(data.appointments);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      toast.error("Failed to fetch appointments");
    } finally {
      setLoadingAppointments(false);
    }
  }, [selectedBranch, sortByBranch]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleAppointmentSuccess = () => {
    fetchAppointments();
    setShowModal(false);
    setEditingAppointment(null);
  };

  const handleEdit = (appointment: any) => {
    setEditingAppointment(appointment);
    setShowModal(true);
  };

  const handleCancel = async (appointmentId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    try {
      await apiClient.delete(`/api/appointments/${appointmentId}`);
      toast.success("Appointment cancelled successfully");
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel appointment");
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
  };

  const handleApprove = async (appointmentId: string) => {
    try {
      const { data: updated } = await apiClient.put<any>(`/api/appointments/${appointmentId}/approve`, {});
      toast.success("Appointment approved");
      setAppointments((prev) => prev.map((a) => a.id === appointmentId ? { ...a, ...updated } : a));
    } catch (error: any) {
      toast.error(error?.message || "Failed to approve");
    }
  };

  const handleReject = async (appointmentId: string) => {
    // Confirmation is handled by the themed dialog in AppointmentList
    try {
      const { data: updated } = await apiClient.put<any>(`/api/appointments/${appointmentId}/reject`, {});
      toast.success("Appointment rejected");
      setAppointments((prev) => prev.map((a) => a.id === appointmentId ? { ...a, ...updated } : a));
    } catch (error: any) {
      toast.error(error?.message || "Failed to reject");
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Manage users, patients, and appointments"
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Panel title="Doctors" subtitle="Total registered doctors">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              {loadingCounts ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                <div className="text-3xl font-bold text-foreground">{counts.doctors}</div>
              )}
            </div>
          </Panel>

          <Panel title="Patients" subtitle="Total registered patients">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-wellness/10">
                <Users className="w-6 h-6 text-wellness" />
              </div>
              {loadingCounts ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                <div className="text-3xl font-bold text-foreground">{counts.patients}</div>
              )}
            </div>
          </Panel>

          <Panel title="Appointments" subtitle="Total scheduled appointments">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-secondary">
                <Calendar className="w-6 h-6 text-foreground" />
              </div>
              {loadingAppointments || loadingCounts ? (
                <Skeleton className="h-9 w-12" />
              ) : (
                <div className="text-3xl font-bold text-foreground">
                  {appointments.filter(a => a.status === "SCHEDULED").length}
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Quick Actions */}
        <Panel title="Quick Actions" subtitle="Common administrative tasks">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/create-user"
              className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg shadow hover:shadow-lg transition font-semibold"
            >
              <UserPlus className="w-5 h-5" />
              Create User
            </Link>
            <Link
              to="/manage-users"
              className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-risk to-risk/80 text-risk-foreground rounded-lg shadow hover:shadow-lg transition font-semibold"
            >
              <Users className="w-5 h-5" />
              Manage Users
            </Link>
            <Link
              to="/assign-patient"
              className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-wellness to-wellness/80 text-wellness-foreground rounded-lg shadow hover:shadow-lg transition font-semibold"
            >
              <Users className="w-5 h-5" />
              Assign Patient
            </Link>
            <Link
              to="/doctor-gamification"
              className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-accent to-accent/80 text-accent-foreground rounded-lg shadow hover:shadow-lg transition font-semibold"
            >
              <Activity className="w-5 h-5" />
              Doctor Gamification
            </Link>
          </div>
        </Panel>

        {/* Appointment Management */}
        <Panel
          title="Appointment Management"
          subtitle="View and manage all appointments"
        >
          <div className="space-y-4">
            {/* Toolbar: branch filter + sort (left) and book button (right) */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>Branch:</span>
                </div>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-44 h-9 text-sm">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Branches</SelectItem>
                    {(branches as any[]).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={sortByBranch ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortByBranch((prev) => !prev)}
                  className="gap-1.5 h-9 text-sm"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {sortByBranch ? "Sorted by Branch" : "Sort by Branch"}
                </Button>
              </div>
              <Button onClick={() => setShowModal(true)} className="gap-2">
                <Calendar className="w-4 h-4" />
                Book Appointment
              </Button>
            </div>

            {loadingAppointments ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (
              <AppointmentList
                appointments={appointments}
                onEdit={handleEdit}
                onCancel={handleCancel}
                onApprove={handleApprove}
                onReject={handleReject}
                showPatientName={true}
              />
            )}
          </div>
        </Panel>

        {/* Appointment Modal */}
        <AppointmentModal
          isOpen={showModal}
          onClose={handleCloseModal}
          onSuccess={handleAppointmentSuccess}
          appointment={editingAppointment}
        />
      </div>
    </AppLayout>
  );
}