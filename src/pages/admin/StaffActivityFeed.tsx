import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { useBranchScope } from "@/hooks/useBranchScope";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { operationsApi } from "@/services/operations.service";
import type { StaffActivityEntry, StaffPresenceStatus } from "@/types";
import {
  Activity, Loader2, Users, Stethoscope, Coffee, Clock, WifiOff, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const statusConfig: Record<StaffPresenceStatus, { label: string; color: string; dot: string }> = {
  ONLINE: { label: "Online", color: "bg-green-100 text-green-800 border-green-300", dot: "bg-green-500" },
  IN_CONSULTATION: { label: "In Consultation", color: "bg-blue-100 text-blue-800 border-blue-300", dot: "bg-blue-500" },
  ON_BREAK: { label: "On Break", color: "bg-yellow-100 text-yellow-800 border-yellow-300", dot: "bg-yellow-500" },
  IDLE: { label: "Idle", color: "bg-gray-100 text-gray-600 border-gray-300", dot: "bg-gray-400" },
  OFFLINE: { label: "Offline", color: "bg-red-100 text-red-800 border-red-300", dot: "bg-red-400" },
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string | null | undefined) {
  if (!dateStr) return "Never";
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return "Never";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    if (hrs < 2) return `${hrs}h ago`;
    // Same-day reads like "Yesterday at 3:45 PM" once we cross midnight.
    return `${hrs}h ago`;
  }
  const days = Math.floor(hrs / 24);
  if (days === 1) {
    return `Yesterday at ${new Date(dateStr).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export interface StaffActivityFeedProps {
  /** Render without page-level chrome (AppLayout + PageHeader). Used
   *  when the page is embedded as a tab inside <StaffSchedule />.
   *  Default false preserves the standalone /staff-activity render
   *  shape — and the FeatureGate empty state when a tenant doesn't
   *  have STAFF_ACTIVITY_FEED enabled. */
  embedded?: boolean;
}

export default function StaffActivityFeed({ embedded = false }: StaffActivityFeedProps = {}) {
  const { role } = useAuth();
  const { branches } = useBranches();
  // Reads the global navbar branch scope. `branchIdParam` is `undefined`
  // when the navbar has "All branches" picked — we surface staff across
  // all branches in that case for ADMIN/ADMIN_DOCTOR.
  const { branchIdParam } = useBranchScope();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";

  const [staff, setStaff] = useState<StaffActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      let data: StaffActivityEntry[];
      if (isAdmin && !branchIdParam) {
        data = await operationsApi.getAllBranchesStaffFeed() as unknown as StaffActivityEntry[];
      } else {
        data = await operationsApi.getLiveStaffFeed(branchIdParam);
      }
      setStaff(data);
    } catch {
      setError("Failed to load staff activity feed");
    } finally {
      setLoading(false);
    }
  }, [branchIdParam, isAdmin]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const counts = {
    online: staff.filter(s => s.status === "ONLINE").length,
    inConsultation: staff.filter(s => s.status === "IN_CONSULTATION").length,
    onBreak: staff.filter(s => s.status === "ON_BREAK").length,
    idle: staff.filter(s => s.status === "IDLE").length,
  };

  if (loading) {
    const loadingBody = (
      <div className={embedded
        ? "flex items-center justify-center min-h-[50vh]"
        : "container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]"}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Staff Feed...</p>
        </div>
      </div>
    );
    return embedded ? loadingBody : <AppLayout>{loadingBody}</AppLayout>;
  }

  const body = (
    <div className={embedded ? "space-y-8" : "container max-w-7xl mx-auto px-4 py-8 space-y-8"}>
      {!embedded && (
        <PageHeader
          title="Staff Activity Feed"
          subtitle="Real-time view of all staff members and their current status."
        >
          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="text-sm text-muted-foreground">
                Branch: <span className="font-semibold text-foreground">
                  {branchIdParam
                    ? (branches as any[]).find((b: any) => b.id === branchIdParam)?.name || "—"
                    : "All branches"}
                </span>{" "}
                <span className="text-xs">(switch via navbar)</span>
              </span>
            )}
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </PageHeader>
      )}

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Status Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Online" value={counts.online} icon={Users} variant="wellness" />
          <StatCard title="In Consultation" value={counts.inConsultation} icon={Stethoscope} />
          <StatCard title="On Break" value={counts.onBreak} icon={Coffee} variant="attention" />
          <StatCard title="Idle" value={counts.idle} icon={Clock} />
        </div>

        {/* Staff Grid */}
        {staff.length === 0 ? (
          <Card className="border-none shadow-sm">
            <CardContent className="py-12 text-center">
              <WifiOff className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No staff activity data available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {staff.map(member => {
              const cfg = statusConfig[member.status];
              return (
                <Card key={member.userId} className="border-none shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {member.profilePhoto ? (
                          <img
                            src={member.profilePhoto}
                            alt={member.fullName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {getInitials(member.fullName)}
                          </div>
                        )}
                        <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${cfg.dot}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{member.fullName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{member.role.toLowerCase().replace("_", " ")}</p>
                        {member.branchName && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{member.branchName}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                      {member.currentActivity && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Activity className="w-3 h-3" />
                          {member.currentActivity}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        Last seen: {timeAgo(member.lastSeen)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      <p className="text-[10px] text-muted-foreground text-center">Auto-refreshes every 30 seconds</p>
    </div>
  );

  return embedded ? body : <AppLayout>{body}</AppLayout>;
}
