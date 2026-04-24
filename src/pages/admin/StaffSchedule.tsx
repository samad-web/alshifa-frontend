import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarX, Clock } from "lucide-react";
import DoctorAvailability from "@/pages/DoctorAvailability";
import AttendanceTracker from "@/pages/admin/AttendanceTracker";

type Tab = "availability" | "attendance";

export default function StaffSchedule() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get("tab") as Tab) || "availability";

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
          subtitle="Manage availability blocks and track attendance in one place."
        />

        <Tabs value={initial} onValueChange={onChange} className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="availability" className="gap-2">
              <CalendarX className="w-4 h-4" /> Availability
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              <Clock className="w-4 h-4" /> Attendance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="availability" className="mt-0">
            <DoctorAvailability embedded />
          </TabsContent>

          <TabsContent value="attendance" className="mt-0">
            <AttendanceTracker embedded />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
