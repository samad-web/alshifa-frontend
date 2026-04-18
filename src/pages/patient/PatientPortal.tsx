import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Calendar, Clock, User, Pill, FileText, Download, Bell,
  Star, Flame, Trophy, Activity, ArrowRight,
} from "lucide-react";
import { communicationApi } from "@/services/communication.service";
import { toast } from "sonner";
import type { PatientPortalDashboard } from "@/types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
  SCHEDULED: "bg-indigo-100 text-indigo-700",
};

export default function PatientPortal() {
  const { profile } = useAuth();
  const [dashboard, setDashboard] = useState<PatientPortalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const patientName =
    (profile as any)?.patient?.fullName ||
    (profile as any)?.doctor?.fullName ||
    profile?.email ||
    "Patient";

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await communicationApi.getPortalDashboard();
      setDashboard(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard");
      toast.error(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-40 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !dashboard) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <PageHeader title="Patient Portal" />
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Activity className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">Unable to load dashboard</p>
              <p className="text-sm mb-4">{error}</p>
              <Button onClick={loadDashboard}>Retry</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const { upcomingAppointments, recentPrescriptions, treatmentProgress, zenProfile, recentDocuments, unreadNotifications } = dashboard;

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <PageHeader
          title={`Welcome, ${patientName}`}
          subtitle="Your health dashboard at a glance"
        >
          {unreadNotifications > 0 && (
            <Button variant="outline" size="sm" className="gap-2">
              <Bell className="h-4 w-4" />
              <Badge variant="destructive" className="h-5 min-w-5 text-[10px] px-1.5">
                {unreadNotifications}
              </Badge>
              Notifications
            </Button>
          )}
        </PageHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card className="md:row-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No upcoming appointments
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.slice(0, 5).map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center bg-background rounded-md p-2 w-14 text-center border">
                        <span className="text-xs font-medium text-muted-foreground">
                          {new Date(apt.date).toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-lg font-bold leading-tight">
                          {new Date(apt.date).getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate">
                            {apt.doctor?.fullName || apt.therapist?.fullName || "Doctor"}
                          </span>
                          <Badge
                            className={`text-[10px] py-0 ${STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-600"}`}
                          >
                            {apt.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(apt.date)}
                          <span className="text-muted-foreground/40">|</span>
                          {apt.consultationType}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-3">
                <Calendar className="h-4 w-4 mr-2" />
                Book New Appointment
              </Button>
            </CardContent>
          </Card>

          {/* Treatment Progress */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                Treatment Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-center gap-8 py-4">
                {/* Wellness Score Ring */}
                <div className="relative flex items-center justify-center">
                  <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-muted/30"
                    />
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={`${(treatmentProgress.wellnessScore / 100) * 264} 264`}
                      strokeLinecap="round"
                      className="text-green-500 transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-bold">{treatmentProgress.wellnessScore}</span>
                    <span className="text-[10px] text-muted-foreground">Wellness</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {treatmentProgress.activeJourneys}
                    </p>
                    <p className="text-xs text-muted-foreground">Active Journeys</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {treatmentProgress.completedJourneys}
                    </p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zen Profile */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Zen Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
                    <Trophy className="h-7 w-7" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {zenProfile.level.name}
                  </span>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Zen Points</span>
                      <span className="text-sm font-bold text-amber-600">
                        {zenProfile.zenPoints.toLocaleString()}
                      </span>
                    </div>
                    {zenProfile.level.nextAt && (
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-amber-400 to-orange-500 h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(zenProfile.level.progress * 100, 100)}%` }}
                        />
                      </div>
                    )}
                    {zenProfile.level.nextLevel && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Next: {zenProfile.level.nextLevel}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">{zenProfile.streak.current} day streak</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      (Best: {zenProfile.streak.longest})
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Prescriptions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Pill className="h-4 w-4 text-purple-500" />
                Recent Prescriptions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentPrescriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No prescriptions yet
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentPrescriptions.slice(0, 10).map((rx) => (
                    <div
                      key={rx.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{rx.medicationName}</p>
                        <p className="text-xs text-muted-foreground">
                          {rx.dosage} - {rx.frequency}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-xs text-muted-foreground">
                          {rx.doctor?.fullName || "Doctor"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {formatDate(rx.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
                View Full History
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          {/* Recent Documents (full width) */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-teal-500" />
                Recent Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {recentDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No documents available
                </p>
              ) : (
                <div className="space-y-2">
                  {recentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] py-0">
                              {doc.category}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(doc.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
