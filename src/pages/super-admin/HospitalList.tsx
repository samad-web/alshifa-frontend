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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  // Suspend prompt — replaces native window.prompt with an in-app modal so
  // the reason capture matches the rest of the platform's UI.
  const [suspendTarget, setSuspendTarget] = useState<HospitalListItem | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspending, setSuspending] = useState(false);

  const load = () => {
    setLoading(true);
    superAdminApi
      .listHospitals()
      .then(setHospitals)
      .catch((e) => toast.error(e?.message ?? "Failed to load hospitals"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSuspend = (h: HospitalListItem) => {
    setSuspendTarget(h);
    setSuspendReason("");
  };

  const submitSuspend = async () => {
    if (!suspendTarget) return;
    setSuspending(true);
    try {
      await superAdminApi.suspendHospital(suspendTarget.id, suspendReason.trim() || undefined);
      toast.success("Hospital suspended. Active sessions revoked.");
      setSuspendTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to suspend");
    } finally {
      setSuspending(false);
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
                        <Button size="sm" variant="outline" onClick={() => handleSuspend(h)}>
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

      <Dialog open={!!suspendTarget} onOpenChange={(o) => !o && !suspending && setSuspendTarget(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Suspend {suspendTarget?.name}?</DialogTitle>
            <DialogDescription>
              All active sessions for this hospital will be revoked immediately. Add a reason for the audit log if useful.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="suspendReason">Reason (optional)</Label>
            <Input
              id="suspendReason"
              placeholder="e.g. Non-payment, security review, contract pause…"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSuspendTarget(null)} disabled={suspending}>Cancel</Button>
            <Button variant="destructive" onClick={submitSuspend} disabled={suspending}>
              {suspending ? "Suspending…" : "Suspend hospital"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
