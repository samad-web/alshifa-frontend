import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { operationsApi } from "@/services/operations.service";
import type { ResourceSharingEntry, SharingStatus } from "@/types";
import {
  Loader2, ArrowRightLeft, Plus, CheckCircle, XCircle, Users, Clock,
} from "lucide-react";

const statusBadge: Record<SharingStatus, { className: string; label: string }> = {
  PENDING: { className: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Pending" },
  APPROVED: { className: "bg-green-100 text-green-800 border-green-300", label: "Approved" },
  REJECTED: { className: "bg-red-100 text-red-800 border-red-300", label: "Rejected" },
  COMPLETED: { className: "bg-blue-100 text-blue-800 border-blue-300", label: "Completed" },
  CANCELLED: { className: "bg-gray-100 text-gray-700 border-gray-300", label: "Cancelled" },
};

export default function ResourceSharing() {
  const { role } = useAuth();
  const { branches } = useBranches();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";

  const [requests, setRequests] = useState<ResourceSharingEntry[]>([]);
  const [todayShared, setTodayShared] = useState<ResourceSharingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formUserId, setFormUserId] = useState("");
  const [formFromBranch, setFormFromBranch] = useState("");
  const [formToBranch, setFormToBranch] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("17:00");
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const reqs = await operationsApi.getSharingRequests();
      setRequests(reqs);
      if ((branches as any[]).length > 0) {
        const today = await operationsApi.getSharedStaffToday((branches as any[])[0].id);
        setTodayShared(today);
      }
    } catch {
      setError("Failed to load sharing requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formUserId || !formFromBranch || !formToBranch) return;
    setSubmitting(true);
    try {
      await operationsApi.createSharingRequest({
        userId: formUserId,
        fromBranchId: formFromBranch,
        toBranchId: formToBranch,
        date: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        reason: formReason || undefined,
      });
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch {
      alert("Failed to create sharing request");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormUserId("");
    setFormFromBranch("");
    setFormToBranch("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormStartTime("09:00");
    setFormEndTime("17:00");
    setFormReason("");
  };

  const handleApprove = async (id: string) => {
    try {
      await operationsApi.approveSharingRequest(id);
      await fetchData();
    } catch {
      alert("Failed to approve request");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await operationsApi.rejectSharingRequest(id);
      await fetchData();
    } catch {
      alert("Failed to reject request");
    }
  };

  const getStaffName = (entry: ResourceSharingEntry) => {
    if (entry.user?.doctor) return (entry.user.doctor as any).fullName || entry.user.email;
    if (entry.user?.therapist) return (entry.user.therapist as any).fullName || entry.user.email;
    return entry.user?.email || entry.userId.slice(0, 8);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Resource Sharing...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Resource Sharing"
          subtitle="Manage cross-branch doctor and therapist coverage assignments."
        >
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Sharing Request
          </Button>
        </PageHeader>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Today's Shared Staff */}
        <Card className="border-none shadow-sm border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Today's Shared Staff
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayShared.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No staff shared today</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {todayShared.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <ArrowRightLeft className="w-5 h-5 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{getStaffName(entry)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {entry.fromBranch?.name || "Branch"} &rarr; {entry.toBranch?.name || "Branch"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {entry.startTime} - {entry.endTime}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              All Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-12">
                <ArrowRightLeft className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No sharing requests yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map(req => {
                      const cfg = statusBadge[req.status];
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{getStaffName(req)}</TableCell>
                          <TableCell>{req.fromBranch?.name || req.fromBranchId.slice(0, 8)}</TableCell>
                          <TableCell>{req.toBranch?.name || req.toBranchId.slice(0, 8)}</TableCell>
                          <TableCell>{new Date(req.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-xs">{req.startTime} - {req.endTime}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs">{req.reason || "--"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {req.status === "PENDING" && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleApprove(req.id)}
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleReject(req.id)}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Sharing Request</DialogTitle>
              <DialogDescription>
                Assign a staff member to cover another branch temporarily.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Staff User ID</label>
                <Input
                  placeholder="Enter staff user ID"
                  value={formUserId}
                  onChange={e => setFormUserId(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">From Branch</label>
                  <Select value={formFromBranch} onValueChange={setFormFromBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {(branches as any[]).map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">To Branch</label>
                  <Select value={formToBranch} onValueChange={setFormToBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {(branches as any[]).map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Start Time</label>
                  <Input type="time" value={formStartTime} onChange={e => setFormStartTime(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">End Time</label>
                  <Input type="time" value={formEndTime} onChange={e => setFormEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason (optional)</label>
                <Input
                  placeholder="e.g. Staff shortage at branch"
                  value={formReason}
                  onChange={e => setFormReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
