import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { superAdminApi, HospitalListItem, HospitalStatus, HospitalPlan } from "@/services/superAdmin.service";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRight, Pause, Play } from "lucide-react";
import { toast } from "sonner";

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

export default function HospitalList() {
  const [hospitals, setHospitals] = useState<HospitalListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    superAdminApi
      .listHospitals()
      .then(setHospitals)
      .catch((e) => toast.error(e?.message ?? "Failed to load hospitals"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSuspend = async (id: string) => {
    const reason = window.prompt("Reason for suspension (optional):");
    try {
      await superAdminApi.suspendHospital(id, reason ?? undefined);
      toast.success("Hospital suspended. Active sessions revoked.");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to suspend");
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await superAdminApi.reactivateHospital(id);
      toast.success("Hospital reactivated.");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reactivate");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Hospitals</h1>
          <p className="text-sm text-muted-foreground">
            All tenants on the platform. Click a row to view details and feature flags.
          </p>
        </div>
        <Button asChild>
          <Link to="/super-admin/hospitals/new">
            <Plus className="mr-2 h-4 w-4" /> New hospital
          </Link>
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Branches</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hospitals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No hospitals yet. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                hospitals.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      <Link to={`/super-admin/hospitals/${h.id}`} className="group">
                        <div className="font-medium group-hover:underline">{h.name}</div>
                        <div className="text-xs text-muted-foreground">{h.slug}</div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[h.status]}>{h.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={PLAN_COLOR[h.plan]}>{h.plan}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{h.branchCount}</TableCell>
                    <TableCell className="text-right">{h.userCount}</TableCell>
                    <TableCell>{new Date(h.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {h.status === "ACTIVE" ? (
                        <Button size="sm" variant="outline" onClick={() => handleSuspend(h.id)}>
                          <Pause className="mr-1 h-3 w-3" /> Suspend
                        </Button>
                      ) : h.status === "SUSPENDED" ? (
                        <Button size="sm" variant="outline" onClick={() => handleReactivate(h.id)}>
                          <Play className="mr-1 h-3 w-3" /> Reactivate
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/super-admin/hospitals/${h.id}`}>
                          View <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
