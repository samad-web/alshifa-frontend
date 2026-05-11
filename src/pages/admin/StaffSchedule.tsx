import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, CalendarX, Clock } from "lucide-react";
import DoctorAvailability from "@/pages/DoctorAvailability";
import AttendanceTracker from "@/pages/admin/AttendanceTracker";
import StaffActivityFeed from "@/pages/admin/StaffActivityFeed";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

type Tab = "activity" | "attendance" | "availability";

export default function StaffSchedule() {
  const [params, setParams] = useSearchParams();
  const { role } = useAuth();
  // Activity tab is admin-only and feature-gated; mirrors the standalone
  // /staff-activity route guard. Attendance is owned by ADMIN /
  // ADMIN_DOCTOR / BRANCH_ADMIN. Clinicians and pharmacists no longer see
  // (or self-clock from) the Attendance tab — mirrors the standalone
  // /attendance route guard.
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const showAttendance = isAdmin || role === "BRANCH_ADMIN";
  const hasActivityFlag = useFeatureFlag("STAFF_ACTIVITY_FEED");
  const showActivity = isAdmin && hasActivityFlag;

  // Default tab order (first visible wins): Activity → Attendance →
  // Availability. URL `?tab=` overrides if the requested tab is visible
  // to this role; otherwise we fall back without rewriting the URL.
  const requested = params.get("tab") as Tab | null;
  const visible = new Set<Tab>([
    ...(showActivity ? (["activity"] as const) : []),
    ...(showAttendance ? (["attendance"] as const) : []),
    "availability" as const,
  ]);
  const fallback: Tab = showActivity
    ? "activity"
    : showAttendance
      ? "attendance"
      : "availability";
  const effective: Tab = requested && visible.has(requested) ? requested : fallback;

  const onChange = (value: string) => {
    setParams(
      (p) => {
        p.set("tab", value);
        return p;
      },
      { replace: true },
    );
  };

  // Tailwind needs the grid-cols-N class string to be present statically
  // for the JIT to keep it. Use a switch, not template interpolation.
  const visibleCount = visible.size;
  const tabsListCols =
    visibleCount === 3 ? "grid-cols-3" : visibleCount === 2 ? "grid-cols-2" : "grid-cols-1";

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
        <PageHeader
          title="Staff Schedule"
          subtitle={
            isAdmin
              ? "Live presence, attendance history, and availability blocks in one place."
              : showAttendance
                ? "Track attendance and manage availability blocks in one place."
                : "Manage your weekly availability and blocked dates."
          }
        />

        <Tabs value={effective} onValueChange={onChange} className="space-y-6">
          <TabsList className={`grid w-full max-w-md ${tabsListCols}`}>
            {showActivity && (
              <TabsTrigger value="activity" className="gap-2">
                <Activity className="w-4 h-4" /> Activity
              </TabsTrigger>
            )}
            {showAttendance && (
              <TabsTrigger value="attendance" className="gap-2">
                <Clock className="w-4 h-4" /> Attendance
              </TabsTrigger>
            )}
            <TabsTrigger value="availability" className="gap-2">
              <CalendarX className="w-4 h-4" /> Availability
            </TabsTrigger>
          </TabsList>

          {/* `forceMount` is intentionally NOT used here. Activity polls
              every 30 seconds via setInterval inside StaffActivityFeed; we
              want the poll to pause when the tab is hidden, which the
              default Radix Tabs unmount-on-switch behaviour gives us for
              free. */}
          {showActivity && (
            <TabsContent value="activity" className="mt-0">
              <StaffActivityFeed embedded />
            </TabsContent>
          )}

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
