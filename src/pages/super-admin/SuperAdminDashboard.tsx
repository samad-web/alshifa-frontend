import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  superAdminApi,
  PlatformOverview,
  HospitalListItem,
  HospitalStatus,
  HospitalPlan,
} from "@/services/superAdmin.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  Stethoscope,
  CalendarCheck2,
  ArrowRight,
  Plus,
  GitBranch,
} from "lucide-react";

const STATUS_COLOR: Record<HospitalStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-900",
  SUSPENDED: "bg-amber-100 text-amber-900",
  PENDING_SETUP: "bg-sky-100 text-sky-900",
  DECOMMISSIONED: "bg-slate-200 text-slate-700",
};

const PLAN_COLOR: Record<HospitalPlan, string> = {
  STARTER: "bg-slate-100 text-slate-900",
  PROFESSIONAL: "bg-indigo-100 text-indigo-900",
  ENTERPRISE: "bg-purple-100 text-purple-900",
};

function Metric({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: any;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "border-amber-400 shadow-md" : ""}>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={`rounded-md p-3 ${
            accent ? "bg-amber-400 text-slate-900" : "bg-slate-900 text-amber-400"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-3xl font-bold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboard() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [hospitals, setHospitals] = useState<HospitalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([superAdminApi.platformOverview(), superAdminApi.listHospitals()])
      .then(([o, hs]) => {
        setOverview(o);
        setHospitals(hs);
      })
      .catch((e) => setError(e?.message ?? "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-72" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-60" />
      </div>
    );
  }
  if (error) return <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">{error}</div>;
  if (!overview) return null;

  const t = overview.totals;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform overview</h1>
        <p className="text-sm text-muted-foreground">
          Aggregate metrics across every hospital. Click a hospital to see its branches, users,
          and feature flags.
        </p>
      </div>

      {/* Top row: hospitals count is the headline metric */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Building2} label="Hospitals" value={t.hospitals} accent />
        <Metric icon={GitBranch} label="Branches (active)" value={`${t.branchesActive} / ${t.branches}`} />
        <Metric icon={Stethoscope} label="Staff users" value={t.staffUsers} />
        <Metric icon={Users} label="Patients" value={t.patients} />
        <Metric icon={Users} label="MAU (30d)" value={t.monthlyActiveUsers} />
        <Metric icon={CalendarCheck2} label="Appointments (30d)" value={t.appointmentsLast30d} />
      </div>

      {/* Hospitals — each card drills into its detail page */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Hospitals on the platform</h2>
          <Button asChild size="sm">
            <Link to="/super-admin/hospitals/new">
              <Plus className="mr-2 h-4 w-4" /> New hospital
            </Link>
          </Button>
        </div>

        {hospitals.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No hospitals provisioned yet. Create the first tenant to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {hospitals.map((h) => (
              <Link
                to={`/super-admin/hospitals/${h.id}`}
                key={h.id}
                className="group"
                aria-label={`Open ${h.name} details`}
              >
                <Card className="transition hover:border-slate-900 hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{h.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{h.slug}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-900" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={STATUS_COLOR[h.status]}>{h.status}</Badge>
                      <Badge className={PLAN_COLOR[h.plan]}>{h.plan}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Stat label="Branches" value={h.branchCount} />
                      <Stat label="Users" value={h.userCount} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(h.createdAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hospitals by status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdown counts={overview.hospitalsByStatus} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hospitals by plan</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdown counts={overview.hospitalsByPlan} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function StatusBreakdown({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  if (entries.length === 0) return <div className="text-sm text-muted-foreground">No data.</div>;
  return (
    <ul className="space-y-2 text-sm">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center justify-between">
          <span className="font-medium">{k}</span>
          <span className="text-muted-foreground">{v}</span>
        </li>
      ))}
    </ul>
  );
}
