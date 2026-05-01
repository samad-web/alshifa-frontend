import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { operationsApi } from "@/services/operations.service";
import { apiClient } from "@/lib/api-client";
import type { ResourceSharingEntry, SharingStatus } from "@/types";
import {
  Loader2, ArrowRightLeft, Plus, CheckCircle, XCircle, Users, Clock, AlertTriangle,
  Pencil, Trash2,
} from "lucide-react";
import { useBranchScope } from "@/hooks/useBranchScope";
import { toast } from "sonner";

function sharingFromBranchId(r: any): string | null {
  return r?.fromBranchId ?? r?.fromBranch?.id ?? null;
}
function sharingFromBranchName(r: any): string | null {
  return r?.fromBranch?.name ?? null;
}

const statusBadge: Record<SharingStatus, { className: string; label: string }> = {
  PENDING: { className: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Pending" },
  APPROVED: { className: "bg-green-100 text-green-800 border-green-300", label: "Approved" },
  REJECTED: { className: "bg-red-100 text-red-800 border-red-300", label: "Rejected" },
  COMPLETED: { className: "bg-blue-100 text-blue-800 border-blue-300", label: "Completed" },
  CANCELLED: { className: "bg-gray-100 text-gray-700 border-gray-300", label: "Cancelled" },
};

export default function ResourceSharing() {
  const { role, user } = useAuth();
  const { branches } = useBranches();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const { isAll, branchIdParam } = useBranchScope();
  const userId = user?.id || "";
  const userBranchId = (user as any)?.branchId || null;

  const [requests, setRequests] = useState<ResourceSharingEntry[]>([]);
  const [todayShared, setTodayShared] = useState<ResourceSharingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // When set, the dialog edits an existing request instead of creating a new one.
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  // Staff roster populated once for the Staff dropdown.
  type StaffOption = { userId: string; name: string; role: string; branchId: string | null };
  const [staff, setStaff] = useState<StaffOption[]>([]);

  // Form state
  const [formUserId, setFormUserId] = useState("");
  const [formFromBranch, setFormFromBranch] = useState("");
  const [formToBranch, setFormToBranch] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formEndDate, setFormEndDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("17:00");
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Live availability check — fires after user/date/time are filled. Admins
  // see "on leave" / "blocked" warnings before they can submit.
  const [availability, setAvailability] = useState<{ available: boolean; reason?: string } | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Fetch assignable staff via the dashboard summary endpoint (auth'd for ADMIN/ADMIN_DOCTOR).
  useEffect(() => {
    if (!dialogOpen || staff.length > 0) return;
    (async () => {
      try {
        const { data } = await apiClient.get<{ staff: Array<{ id: string; name: string; role: string; branch: string | null }> }>(
          "/api/dashboards/staff/assignable"
        );
        const clinicians = (data.staff || []).filter(s => s.role === "DOCTOR" || s.role === "THERAPIST");
        // Cross-reference branchId from branches list by name (since the staff endpoint
        // only gives us the branch NAME, not id). Leaves branchId null if no match.
        const byName = new Map<string, string>((branches as Array<{ id: string; name: string }>).map(b => [b.name, b.id]));
        setStaff(clinicians.map(s => ({
          userId: s.id,
          name: s.name,
          role: s.role,
          branchId: s.branch ? byName.get(s.branch) ?? null : null,
        })));
      } catch { /* non-fatal */ }
    })();
  }, [dialogOpen, staff.length, branches]);

  // Auto-fill From Branch when a staff member is picked.
  const handleSelectStaff = (userId: string) => {
    setFormUserId(userId);
    const s = staff.find(x => x.userId === userId);
    if (s?.branchId) setFormFromBranch(s.branchId);
  };

  // Debounced availability check — re-runs whenever the staff / date / time changes.
  useEffect(() => {
    if (!dialogOpen || !formUserId || !formDate || !formStartTime || !formEndTime) {
      setAvailability(null);
      return;
    }
    if (formStartTime >= formEndTime) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    setCheckingAvailability(true);
    const t = setTimeout(async () => {
      try {
        const result = await operationsApi.checkStaffAvailability(formUserId, {
          date: formDate, startTime: formStartTime, endTime: formEndTime,
        });
        if (!cancelled) setAvailability(result);
      } catch {
        if (!cancelled) setAvailability(null);
      } finally {
        if (!cancelled) setCheckingAvailability(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [dialogOpen, formUserId, formDate, formStartTime, formEndTime]);

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
    if (formEndDate && formEndDate < formDate) {
      toast.error("To Date must be on or after From Date");
      return;
    }
    setSubmitting(true);
    try {
      if (editingRequestId) {
        // Edit existing request — only the patchable fields, not the user
        // (changing the staff member would invalidate the availability
        // check that ran when the request was first created).
        await operationsApi.updateSharingRequest(editingRequestId, {
          fromBranchId: formFromBranch,
          toBranchId: formToBranch,
          date: formDate,
          endDate: formEndDate || null,
          startTime: formStartTime,
          endTime: formEndTime,
          reason: formReason || null,
        });
        toast.success("Sharing request updated");
      } else {
        await operationsApi.createSharingRequest({
          userId: formUserId,
          fromBranchId: formFromBranch,
          toBranchId: formToBranch,
          date: formDate,
          endDate: formEndDate || undefined,
          startTime: formStartTime,
          endTime: formEndTime,
          reason: formReason || undefined,
        });
      }
      setDialogOpen(false);
      resetForm();
      await fetchData();
    } catch (err: unknown) {
      // Surface the backend reason verbatim — it carries the availability
      // rejection text (e.g. "on leave", "has a blocked slot").
      const msg = err instanceof Error && err.message ? err.message : "Failed to save sharing request";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingRequestId(null);
    setFormUserId("");
    setFormFromBranch("");
    setFormToBranch("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormEndDate("");
    setFormStartTime("09:00");
    setFormEndTime("17:00");
    setFormReason("");
    setAvailability(null);
  };

  // Open the dialog pre-populated to edit an existing request. The Staff
  // dropdown is locked since the availability check is keyed on (user,
  // date, time) — changing the user would invalidate the original gate.
  const startEditing = (req: ResourceSharingEntry) => {
    setEditingRequestId(req.id);
    setFormUserId(req.userId);
    setFormFromBranch(req.fromBranchId);
    setFormToBranch(req.toBranchId);
    setFormDate(new Date(req.date).toISOString().split("T")[0]);
    setFormEndDate(req.endDate ? new Date(req.endDate).toISOString().split("T")[0] : "");
    setFormStartTime(req.startTime);
    setFormEndTime(req.endTime);
    setFormReason(req.reason || "");
    setDialogOpen(true);
  };

  const handleApprove = async (id: string) => {
    try {
      await operationsApi.approveSharingRequest(id);
      await fetchData();
    } catch {
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await operationsApi.rejectSharingRequest(id);
      await fetchData();
    } catch {
      toast.error("Failed to reject request");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this pending sharing request?")) return;
    try {
      await operationsApi.deleteSharingRequest(id);
      toast.success("Sharing request deleted");
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete request";
      toast.error(msg);
    }
  };

  // Role gates for inline action buttons. Each button is shown to the
  // narrowest set of actors that can perform it server-side, so the UI
  // never offers an action the API would reject.
  const canEdit = (req: ResourceSharingEntry) =>
    req.status === "PENDING" && (
      role === "ADMIN"
      || (req.createdById && req.createdById === userId)
      || (role === "ADMIN_DOCTOR" && (userBranchId === req.fromBranchId || userBranchId === req.toBranchId))
    );
  const canDelete = (req: ResourceSharingEntry) =>
    req.status === "PENDING" && (
      role === "ADMIN"
      || (req.createdById && req.createdById === userId)
      || (role === "ADMIN_DOCTOR" && (userBranchId === req.fromBranchId || userBranchId === req.toBranchId))
    );
  const canApprove = (req: ResourceSharingEntry) =>
    req.status === "PENDING" && (
      role === "ADMIN" || (role === "ADMIN_DOCTOR" && userBranchId === req.toBranchId)
    );

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
            {(() => {
              const scopedToday = branchIdParam
                ? todayShared.filter(e => e.fromBranchId === branchIdParam || e.toBranchId === branchIdParam)
                : todayShared;
              if (scopedToday.length === 0) {
                return <p className="text-muted-foreground text-sm text-center py-6">No staff shared today</p>;
              }
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {scopedToday.map(entry => (
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
              );
            })()}
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
            {(() => {
              const scopedRequests = branchIdParam
                ? requests.filter(r => r.fromBranchId === branchIdParam || r.toBranchId === branchIdParam)
                : requests;
              if (scopedRequests.length === 0) {
                return (
                  <div className="text-center py-12">
                    <ArrowRightLeft className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No sharing requests yet</p>
                  </div>
                );
              }

              const renderTable = (rows: ResourceSharingEntry[]) => (
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
                      {rows.map(req => {
                        const cfg = statusBadge[req.status];
                        return (
                          <TableRow key={req.id}>
                            <TableCell className="font-medium">{getStaffName(req)}</TableCell>
                            <TableCell>{req.fromBranch?.name || req.fromBranchId.slice(0, 8)}</TableCell>
                            <TableCell>{req.toBranch?.name || req.toBranchId.slice(0, 8)}</TableCell>
                            <TableCell>
                              {new Date(req.date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                              {req.endDate && (
                                <>
                                  {" → "}
                                  {new Date(req.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                </>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{req.startTime} - {req.endTime}</TableCell>
                            <TableCell className="max-w-[150px] truncate text-xs">{req.reason || "--"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                {req.status === "PENDING" && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {canApprove(req) && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                          title="Accept"
                                          onClick={() => handleApprove(req.id)}
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          title="Reject"
                                          onClick={() => handleReject(req.id)}
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </Button>
                                      </>
                                    )}
                                    {canEdit(req) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-primary hover:text-primary hover:bg-primary/10"
                                        title="Edit"
                                        onClick={() => startEditing(req)}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {canDelete(req) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        title="Delete"
                                        onClick={() => handleDelete(req.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
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
              );

              if (isAdmin && isAll) {
                // Group by fromBranchId so admins see outgoing sharing per branch.
                const map = new Map<string, { name: string; rows: ResourceSharingEntry[] }>();
                for (const r of scopedRequests) {
                  const id = sharingFromBranchId(r) ?? "__unassigned__";
                  const name = sharingFromBranchName(r) ?? (id === "__unassigned__" ? "Unassigned" : id);
                  if (!map.has(id)) map.set(id, { name, rows: [] });
                  map.get(id)!.rows.push(r);
                }
                const groups = Array.from(map.entries())
                  .map(([id, g]) => ({ id, ...g }))
                  .sort((a, b) => {
                    if (a.id === "__unassigned__") return 1;
                    if (b.id === "__unassigned__") return -1;
                    return a.name.localeCompare(b.name);
                  });
                return (
                  <div className="space-y-4">
                    {groups.map((g) => (
                      <section key={g.id} className="rounded-lg border bg-card/30 overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 text-sm font-medium">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>From: {g.name}</span>
                          <span className="text-xs text-muted-foreground font-normal">({g.rows.length})</span>
                        </div>
                        <div className="p-2">
                          {renderTable(g.rows)}
                        </div>
                      </section>
                    ))}
                  </div>
                );
              }

              return renderTable(scopedRequests);
            })()}
          </CardContent>
        </Card>

        {/* Create / Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRequestId ? "Edit Sharing Request" : "Create Sharing Request"}</DialogTitle>
              <DialogDescription>
                {editingRequestId
                  ? "Update the date range, time, branches, or reason. The staff member can't be changed once a request exists."
                  : "Assign a staff member to cover another branch temporarily."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Staff Member</label>
                <SearchableSelect
                  value={formUserId}
                  onChange={handleSelectStaff}
                  disabled={!!editingRequestId}
                  placeholder={staff.length === 0 ? "Loading staff…" : "Select a doctor or therapist"}
                  searchPlaceholder="Search staff…"
                  loading={staff.length === 0}
                  items={staff.map((s) => ({
                    value: s.userId,
                    label: s.name,
                    sub:   s.role,
                  }))}
                />
                <p className="text-[11px] text-muted-foreground">
                  {editingRequestId
                    ? "Staff is locked while editing — delete and recreate to assign someone else."
                    : "Their home branch auto-fills as \"From Branch\" — you can still change it."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">From Branch</label>
                  <SearchableSelect
                    value={formFromBranch}
                    onChange={setFormFromBranch}
                    placeholder="Select"
                    searchPlaceholder="Search branches…"
                    items={(branches as any[]).map((b: any) => ({ value: b.id, label: b.name }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">To Branch</label>
                  <SearchableSelect
                    value={formToBranch}
                    onChange={setFormToBranch}
                    placeholder="Select"
                    searchPlaceholder="Search branches…"
                    items={(branches as any[]).map((b: any) => ({ value: b.id, label: b.name }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">From Date</label>
                  <DatePicker value={formDate} onChange={(iso) => setFormDate(iso)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">To Date</label>
                  <DatePicker
                    value={formEndDate}
                    onChange={(iso) => setFormEndDate(iso)}
                    fromDate={formDate ? new Date(formDate) : undefined}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Leave blank for a single-day arrangement.
                  </p>
                </div>
              </div>
              {formEndDate && formEndDate < formDate && (
                <p className="text-xs text-destructive">To Date must be on or after From Date.</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Start Time</label>
                  <TimePicker value={formStartTime} onChange={(hhmm) => setFormStartTime(hhmm)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">End Time</label>
                  <TimePicker value={formEndTime} onChange={(hhmm) => setFormEndTime(hhmm)} />
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

              {/* Live availability verdict — shown once the staff + time window are filled */}
              {formUserId && formStartTime < formEndTime && (
                <div className="pt-1">
                  {checkingAvailability ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking staff availability…
                    </div>
                  ) : availability?.available ? (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-green-800">
                        <span className="font-semibold">Marked available</span> — no blocks or leave on this window.
                      </div>
                    </div>
                  ) : availability && !availability.available ? (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                      <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="text-xs text-red-800">
                        <div className="font-semibold">Not available for sharing</div>
                        <div className="text-red-700">{availability.reason || "No published availability for this window."}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={
                  submitting
                  || checkingAvailability
                  || availability?.available === false
                  || (!!formEndDate && formEndDate < formDate)
                }
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {editingRequestId ? "Save Changes" : "Create Request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
