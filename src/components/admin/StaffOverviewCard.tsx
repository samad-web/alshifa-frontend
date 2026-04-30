import { useEffect, useMemo, useState } from "react";
import { LucideIcon, Search, Users as UsersEmptyIcon } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";

export type StaffOverviewRole = "DOCTOR" | "THERAPIST" | "PHARMACIST" | "ADMIN_DOCTOR";

interface StaffOverviewCardProps {
  role: StaffOverviewRole;
  label: string;
  count: number;
  icon: LucideIcon;
}

interface StaffOverviewItem {
  id: string;
  name: string;
  email: string;
  branchName: string | null;
  profilePhoto: string | null;
  isActive: boolean;
  joinedAt: string;
  lastLogin: string | null;
  // Role-specific (any of these may be present)
  specialization?: string | null;
  todayAppointments?: number;
  thisMonthAppointments?: number;
  currentStreak?: number;
  leaderboardRank?: number | null;
  totalDispensedThisMonth?: number;
  managedPatientCount?: number;
}

interface StaffOverviewResponse {
  role: StaffOverviewRole;
  page: number;
  pageSize: number;
  total: number;
  items: StaffOverviewItem[];
}

const ROLE_TITLES: Record<StaffOverviewRole, string> = {
  DOCTOR: "Doctors",
  THERAPIST: "Therapists",
  PHARMACIST: "Pharmacists",
  ADMIN_DOCTOR: "Admin Doctors",
};

function isActiveByLogin(lastLogin: string | null): boolean {
  if (!lastLogin) return false;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastLogin).getTime() < SEVEN_DAYS;
}

function formatLastLogin(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function roleMetricLabel(role: StaffOverviewRole, item: StaffOverviewItem): string {
  if (role === "DOCTOR" || role === "THERAPIST") {
    const month = item.thisMonthAppointments ?? 0;
    const rank = item.leaderboardRank;
    const rankPart = rank ? ` · Rank #${rank}` : "";
    return `${month} appt${month === 1 ? "" : "s"} this month${rankPart}`;
  }
  if (role === "PHARMACIST") {
    const n = item.totalDispensedThisMonth ?? 0;
    return `${n} dispense${n === 1 ? "" : "s"} this month`;
  }
  // ADMIN_DOCTOR
  const n = item.managedPatientCount ?? 0;
  return `${n} patient${n === 1 ? "" : "s"} managed`;
}

export function StaffOverviewCard({ role, label, count, icon }: StaffOverviewCardProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StaffOverviewResponse | null>(null);
  const [query, setQuery] = useState("");

  // Lazy-load on first open. Re-fetch each time the drawer opens so cards stay
  // current without polling while the dashboard sits idle.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get<StaffOverviewResponse>(`/api/operations/staff-overview/${role}`, {
        pageSize: 100,
      })
      .then(({ data: payload }) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Failed to load staff");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, role]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter((i) => (i.name || "").toLowerCase().includes(q));
  }, [data, query]);

  return (
    <>
      <StatCard
        title={label}
        value={count}
        icon={icon}
        onClick={() => setOpen(true)}
      />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {ROLE_TITLES[role]}
              <Badge variant="outline" className="text-xs">
                {data?.total ?? count}
              </Badge>
            </SheetTitle>
            <SheetDescription>
              Click a row to view their full profile (coming soon).
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${ROLE_TITLES[role].toLowerCase()} by name…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="mt-4">
            {loading && !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <UsersEmptyIcon className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">
                  {query ? "No matches for that name." : `No ${ROLE_TITLES[role].toLowerCase()} found.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Branch</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-left px-3 py-2 font-medium">Last Login</th>
                      <th className="text-left px-4 py-2 font-medium">
                        {role === "PHARMACIST"
                          ? "Dispenses"
                          : role === "ADMIN_DOCTOR"
                          ? "Patients"
                          : "Workload"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredItems.map((item) => {
                      const active = isActiveByLogin(item.lastLogin);
                      return (
                        <tr key={item.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <div className="font-medium leading-tight">{item.name}</div>
                            <div className="text-[11px] text-muted-foreground">{item.email}</div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{item.branchName ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <Badge
                              className={
                                active
                                  ? "bg-emerald-500 text-white hover:bg-emerald-500"
                                  : "bg-rose-500 text-white hover:bg-rose-500"
                              }
                            >
                              {active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground tabular-nums">
                            {formatLastLogin(item.lastLogin)}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {roleMetricLabel(role, item)}
                            {(role === "DOCTOR" || role === "THERAPIST") && (item.todayAppointments ?? 0) > 0 && (
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                {item.todayAppointments} today
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
