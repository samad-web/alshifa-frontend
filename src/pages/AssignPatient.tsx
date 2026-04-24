import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity, AlertCircle, Loader2, CheckCircle2, UserPlus, UserMinus, ArrowRightLeft, ShieldCheck,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { PatientPicker } from "@/components/clinical/PatientPicker";

type AssignmentType = "PRIMARY" | "CONSULTING" | "TEMPORARY";

interface PatientLite {
  id: string;
  fullName: string | null;
  phoneNumber?: string | null;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  user?: { email?: string } | null;
}

interface DoctorLite {
  id: string;
  fullName: string | null;
  specialization?: string | null;
  branchName?: string | null;
  user?: { email?: string } | null;
  _count?: { patients?: number };
}

interface CurrentAssignment {
  id: string;
  type: AssignmentType;
  assignedAt: string;
  reason?: string | null;
  doctor: { id: string; fullName: string | null; specialization: string | null };
  assignedBy?: { id: string; email: string } | null;
}

export default function AssignPatient() {
  const { role } = useAuth();
  const { toast } = useToast();

  const [doctors, setDoctors] = useState<DoctorLite[]>([]);
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [unassignedIds, setUnassignedIds] = useState<Set<string>>(new Set());
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("PRIMARY");
  const [currentAssignments, setCurrentAssignments] = useState<CurrentAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  // Reassign confirmation dialog
  const [reassignConfirm, setReassignConfirm] = useState<null | { existing: CurrentAssignment; newDoctor: DoctorLite }>(null);
  // Unassign dialog
  const [unassignTarget, setUnassignTarget] = useState<CurrentAssignment | null>(null);
  const [unassignReason, setUnassignReason] = useState("");
  const [unassigning, setUnassigning] = useState(false);

  const fetchPatients = useCallback(async () => {
    const { data } = await apiClient.get<PatientLite[]>("/api/user/list-patients");
    setPatients(data);
  }, []);

  const fetchUnassigned = useCallback(async () => {
    try {
      const { data } = await apiClient.get<Array<{ id: string }>>("/api/user/list-unassigned-patients");
      setUnassignedIds(new Set(data.map((p) => p.id)));
    } catch { /* non-fatal */ }
  }, []);

  const fetchDoctors = async (branchId: string | null) => {
    setDoctorsLoading(true);
    try {
      const { data } = await apiClient.get<DoctorLite[]>("/api/user/list-doctors", branchId ? { branchId } : undefined);
      setDoctors(data);
    } catch {
      setDoctors([]);
    } finally {
      setDoctorsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (role !== "ADMIN" && role !== "ADMIN_DOCTOR") return;
    (async () => {
      try {
        await Promise.all([fetchPatients(), fetchUnassigned()]);
      } catch {
        toast({ title: "Error", description: "Failed to load assignment data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [role, fetchPatients, fetchUnassigned, toast]);

  // When patient selected → load doctors for that branch + their current assignments
  useEffect(() => {
    if (!patientId) {
      setDoctors([]);
      setCurrentAssignments([]);
      return;
    }
    const patient = patients.find((p) => p.id === patientId);
    fetchDoctors(patient?.branchId || null);

    setLoadingAssignments(true);
    apiClient.get<CurrentAssignment[]>(`/api/user/patient/${patientId}/assignments`)
      .then(({ data }) => setCurrentAssignments(data))
      .catch(() => setCurrentAssignments([]))
      .finally(() => setLoadingAssignments(false));
  }, [patientId, patients]);

  const filteredPatients = useMemo(() => {
    if (!unassignedOnly) return patients;
    return patients.filter((p) => unassignedIds.has(p.id));
  }, [patients, unassignedOnly, unassignedIds]);

  const primaryAssignment = currentAssignments.find((a) => a.type === "PRIMARY");
  const secondaryAssignments = currentAssignments.filter((a) => a.type !== "PRIMARY");

  // Core submit — prompts for reassignment confirmation when replacing a primary.
  const onAssignClicked = async () => {
    if (!patientId || !doctorId) {
      toast({ title: "Missing info", description: "Select a patient and a doctor.", variant: "destructive" });
      return;
    }
    // Same-doctor no-op
    if (primaryAssignment && primaryAssignment.doctor.id === doctorId && assignmentType === "PRIMARY") {
      toast({ title: "Already assigned", description: `This patient's primary doctor is already ${primaryAssignment.doctor.fullName || "this clinician"}.` });
      return;
    }
    // Reassignment (replacing an existing primary) → confirm first
    if (assignmentType === "PRIMARY" && primaryAssignment) {
      const newDoc = doctors.find((d) => d.id === doctorId);
      if (newDoc) {
        setReassignConfirm({ existing: primaryAssignment, newDoctor: newDoc });
        return;
      }
    }
    await submitAssignment();
  };

  const submitAssignment = async () => {
    setAssigning(true);
    try {
      await apiClient.post<{ message: string }>("/api/user/assign-patient", {
        patientId, doctorId, type: assignmentType,
      });
      toast({ title: "Assigned", description: "Doctor will see this patient in their My Patients page immediately." });
      setDoctorId("");
      setReassignConfirm(null);
      // Refresh assignments + unassigned list
      await Promise.all([
        fetchUnassigned(),
        apiClient.get<CurrentAssignment[]>(`/api/user/patient/${patientId}/assignments`)
          .then(({ data }) => setCurrentAssignments(data))
          .catch(() => {}),
      ]);
    } catch (err: unknown) {
      toast({
        title: "Assignment failed",
        description: err instanceof Error ? err.message : "Could not assign patient",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const openUnassign = (target: CurrentAssignment) => {
    setUnassignTarget(target);
    setUnassignReason("");
  };

  const submitUnassign = async () => {
    if (!unassignTarget || !patientId) return;
    setUnassigning(true);
    try {
      await apiClient.post("/api/user/unassign-patient", {
        patientId,
        doctorId: unassignTarget.doctor.id,
        type:     unassignTarget.type,
        reason:   unassignReason || undefined,
      });
      toast({ title: "Assignment ended", description: `Patient is no longer under ${unassignTarget.doctor.fullName || "that clinician"}.` });
      setUnassignTarget(null);
      await Promise.all([
        fetchUnassigned(),
        apiClient.get<CurrentAssignment[]>(`/api/user/patient/${patientId}/assignments`)
          .then(({ data }) => setCurrentAssignments(data))
          .catch(() => {}),
      ]);
    } catch (err: unknown) {
      toast({
        title: "Failed to unassign",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setUnassigning(false);
    }
  };

  if (role !== "ADMIN" && role !== "ADMIN_DOCTOR") {
    return <div className="p-8 text-center text-muted-foreground">Access denied.</div>;
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground font-medium italic">Loading assignment data...</p>
        </div>
      </AppLayout>
    );
  }

  const unassignedTotal = unassignedIds.size;

  return (
    <AppLayout>
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <PageHeader
          title="Clinical Assignment"
          subtitle="Link patients to their primary doctor. Reassignments preserve history for audit."
        />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-10 items-start">
          {/* Left column: doctor workload + tip */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm bg-secondary/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10"><Activity className="w-4 h-4 text-primary" /></div>
                  Healthcare Providers
                </CardTitle>
                <CardDescription>Workload across clinicians in this branch</CardDescription>
              </CardHeader>
              <CardContent>
                {doctors.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    {patientId ? "No doctors available in this patient's branch." : "Select a patient to view branch doctors."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {doctors.slice(0, 6).map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50">
                        <div>
                          <div className="font-bold text-sm">{d.fullName || d.user?.email}</div>
                          <div className="text-[11px] text-muted-foreground uppercase">{d.specialization || "General"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-12 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${Math.min((d._count?.patients || 0) * 10, 100)}%` }} />
                          </div>
                          <span className="text-xs font-black text-primary">{d._count?.patients || 0}</span>
                        </div>
                      </div>
                    ))}
                    {doctors.length > 6 && (
                      <p className="text-[11px] text-center text-muted-foreground uppercase font-bold tracking-widest pt-1">
                        + {doctors.length - 6} more
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-primary/5">
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-primary/80 leading-relaxed">
                    <strong>Audit-safe reassignment.</strong> When you replace a patient's primary doctor, the old assignment is flipped to <em>REPLACED</em> with a timestamp — never deleted.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: the assignment form */}
          <div className="lg:col-span-3 space-y-4">
            {/* Unassigned filter + count */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-secondary/10">
              <div className="flex items-center gap-3">
                <Switch
                  id="unassigned-filter"
                  checked={unassignedOnly}
                  onCheckedChange={setUnassignedOnly}
                />
                <Label htmlFor="unassigned-filter" className="text-sm font-medium cursor-pointer">
                  Show only unassigned patients
                </Label>
              </div>
              <Badge variant="outline" className={unassignedTotal > 0 ? "border-amber-500/40 text-amber-600" : ""}>
                {unassignedTotal} unassigned
              </Badge>
            </div>

            <Card className="shadow-elevated border-border/60">
              <CardHeader className="bg-secondary/10 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg shadow-sm">
                    <UserPlus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">New Patient Assignment</CardTitle>
                    <CardDescription>Select a patient, then pick their doctor</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 pt-6">
                {/* Patient picker */}
                <div className="space-y-2">
                  <Label>Patient</Label>
                  <PatientPicker
                    value={patientId}
                    onChange={setPatientId}
                    patients={filteredPatients}
                    placeholder={unassignedOnly ? "Search unassigned patients…" : "Search patients…"}
                  />
                  {unassignedOnly && filteredPatients.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No unassigned patients match — every patient has a primary doctor.
                    </p>
                  )}
                </div>

                {/* Current assignments snapshot */}
                {patientId && (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    {loadingAssignments ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking current assignments…
                      </div>
                    ) : currentAssignments.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-amber-700">
                        <AlertCircle className="w-3.5 h-3.5" /> This patient has no primary doctor assigned.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {primaryAssignment && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-start gap-2">
                              <Badge className="bg-primary/10 text-primary border-primary/30">PRIMARY</Badge>
                              <div>
                                <div className="text-sm font-semibold">{primaryAssignment.doctor.fullName}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {primaryAssignment.doctor.specialization || "—"} · since {new Date(primaryAssignment.assignedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                </div>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => openUnassign(primaryAssignment)}>
                              <UserMinus className="w-3.5 h-3.5 mr-1" /> Unassign
                            </Button>
                          </div>
                        )}
                        {secondaryAssignments.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                            <div className="flex items-start gap-2">
                              <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                              <div>
                                <div className="text-sm">{a.doctor.fullName}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {a.doctor.specialization || "—"} · since {new Date(a.assignedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                </div>
                              </div>
                            </div>
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => openUnassign(a)}>
                              <UserMinus className="w-3.5 h-3.5 mr-1" /> End
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Doctor picker */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-2">
                    <Label>Doctor</Label>
                    <SearchableSelect
                      value={doctorId}
                      onChange={setDoctorId}
                      disabled={doctors.length === 0 || doctorsLoading}
                      loading={doctorsLoading}
                      loadingPlaceholder="Loading doctors…"
                      placeholder={
                        !patientId ? "Select patient first"
                        : doctors.length === 0 ? "No doctors in this branch"
                        : "Select a doctor"
                      }
                      searchPlaceholder="Search by name or specialisation…"
                      items={doctors.map((d) => ({
                        value: d.id,
                        label: d.fullName || d.user?.email || d.id,
                        sub:   d.specialization || undefined,
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Assignment Type</Label>
                    <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as AssignmentType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIMARY">Primary</SelectItem>
                        <SelectItem value="CONSULTING">Consulting</SelectItem>
                        <SelectItem value="TEMPORARY">Temporary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="bg-secondary/5 border-t border-border/50 p-5 flex items-center justify-between">
                <div className="text-xs text-muted-foreground italic">
                  {assignmentType === "PRIMARY" && primaryAssignment
                    ? `This will replace the current primary doctor (${primaryAssignment.doctor.fullName}).`
                    : "Assignments propagate to the doctor's My Patients page immediately."}
                </div>
                <Button onClick={onAssignClicked} disabled={!patientId || !doctorId || assigning} className="h-11 px-6 rounded-xl">
                  {assigning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Assigning…</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Assign</>}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Reassign confirmation dialog */}
        <Dialog open={!!reassignConfirm} onOpenChange={(o) => !o && setReassignConfirm(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Replace primary doctor?</DialogTitle>
              <DialogDescription>
                This patient is currently under a primary doctor. Assigning a new one will end the existing assignment (history is preserved).
              </DialogDescription>
            </DialogHeader>
            {reassignConfirm && (
              <div className="py-3 space-y-3">
                <div className="flex items-center justify-center gap-3">
                  <div className="flex-1 text-center p-3 rounded-lg bg-muted/40">
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Current</div>
                    <div className="font-semibold text-sm mt-1">{reassignConfirm.existing.doctor.fullName}</div>
                    <div className="text-[11px] text-muted-foreground">{reassignConfirm.existing.doctor.specialization || "—"}</div>
                  </div>
                  <ArrowRightLeft className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-center p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-[10px] uppercase text-primary tracking-wide">New</div>
                    <div className="font-semibold text-sm mt-1">{reassignConfirm.newDoctor.fullName}</div>
                    <div className="text-[11px] text-muted-foreground">{reassignConfirm.newDoctor.specialization || "—"}</div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReassignConfirm(null)}>Cancel</Button>
              <Button onClick={submitAssignment} disabled={assigning}>
                {assigning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Replacing…</> : "Confirm Replacement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unassign dialog */}
        <Dialog open={!!unassignTarget} onOpenChange={(o) => !o && setUnassignTarget(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>End assignment?</DialogTitle>
              <DialogDescription>
                This patient will no longer appear in {unassignTarget?.doctor.fullName}'s My Patients list. The assignment history is kept.
              </DialogDescription>
            </DialogHeader>
            <div className="py-3 space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                rows={3}
                value={unassignReason}
                onChange={(e) => setUnassignReason(e.target.value)}
                placeholder="e.g. Patient requested a different specialist, doctor on long-term leave…"
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setUnassignTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={submitUnassign} disabled={unassigning}>
                {unassigning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ending…</> : "End Assignment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
