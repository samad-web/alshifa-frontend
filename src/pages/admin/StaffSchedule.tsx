import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarX, Clock } from "lucide-react";
import DoctorAvailability from "@/pages/DoctorAvailability";
import AttendanceTracker from "@/pages/admin/AttendanceTracker";
import { useAuth } from "@/hooks/useAuth";

type Tab = "availability" | "attendance";

export default function StaffSchedule() {
  const [params, setParams] = useSearchParams();
  const { role } = useAuth();
  // Doctors no longer self-mark attendance — branch admins do it for them.
  // The attendance tab is still available to every other role that lands on
  // this page (admins managing the branch, therapists self-clock-in, etc.).
  const showAttendance = role !== "DOCTOR";
  const initial = ((params.get("tab") as Tab) || (showAttendance ? "attendance" : "availability")) as Tab;
  const effective: Tab = !showAttendance && initial === "attendance" ? "availability" : initial;

  const onChange = (value: string) => {
    setParams((p) => {
      p.set("tab", value);
      return p;
    }, { replace: true });
  };

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
        <PageHeader
          title="Staff Schedule"
          subtitle={showAttendance
            ? "Track attendance and manage availability blocks in one place."
            : "Manage your weekly availability and blocked dates."}
        />

        <Tabs value={effective} onValueChange={onChange} className="space-y-6">
          <TabsList className={`grid w-full max-w-md ${showAttendance ? "grid-cols-2" : "grid-cols-1"}`}>
            {showAttendance && (
              <TabsTrigger value="attendance" className="gap-2">
                <Clock className="w-4 h-4" /> Attendance
              </TabsTrigger>
            )}
            <TabsTrigger value="availability" className="gap-2">
              <CalendarX className="w-4 h-4" /> Availability
            </TabsTrigger>
          </TabsList>

          {showAttendance && (
            <TabsContent value="attendance" className="mt-0">
              <AttendanceTracker embedded />
            </TabsContent>
          )}

          <TabsContent value="availability" className="mt-0">
            <DoctorAvailability embedded />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
