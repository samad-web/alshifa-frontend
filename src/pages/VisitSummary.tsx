import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Plus, X, Wand2, Send, Printer, ChevronDown, ChevronUp,
  Stethoscope, Pill, Dumbbell, Apple, ArrowRight, Calendar, CheckCircle,
} from "lucide-react";
import { communicationApi } from "@/services/communication.service";
import { toast } from "sonner";
import type { VisitSummaryEntry } from "@/types";
import { useBranchScope } from "@/hooks/useBranchScope";
import { GroupedByBranch } from "@/components/common/GroupedByBranch";

function summaryBranchId(s: any): string | null {
  return s?.branchId
    ?? s?.appointment?.branchId
    ?? s?.appointment?.patient?.user?.branchId
    ?? s?.appointment?.patient?.branchId
    ?? s?.appointment?.doctor?.branchId
    ?? s?.patient?.user?.branchId
    ?? s?.patient?.branchId
    ?? null;
}
function summaryBranchName(s: any): string | null {
  return s?.branch?.name
    ?? s?.appointment?.branch?.name
    ?? s?.appointment?.patient?.user?.branch?.name
    ?? s?.appointment?.doctor?.branch?.name
    ?? s?.patient?.user?.branch?.name
    ?? null;
}

interface PrescriptionRow {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface ExerciseRow {
  exercise: string;
  sets: number;
  reps: number;
  frequency: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const DOCTOR_ROLES = ["DOCTOR", "THERAPIST", "ADMIN_DOCTOR", "ADMIN"];

export default function VisitSummary() {
  const { role, user } = useAuth();
  const isDoctor = DOCTOR_ROLES.includes(role || "");
  const isPatient = role === "PATIENT";

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {isDoctor ? <DoctorView userId={user?.id || ""} /> : <PatientView userId={user?.id || ""} />}
      </div>
    </AppLayout>
  );
}

// ── Doctor View ───────────────────────────────────────────────────────────────

interface AppointmentOption {
  id: string;
  date: string;
  patient?: { id: string; fullName: string | null } | null;
  doctor?: { id: string; fullName: string | null } | null;
  therapist?: { id: string; fullName: string | null } | null;
  consultationType?: string;
}

function DoctorView({ userId }: { userId: string }) {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const { isAll, branchIdParam } = useBranchScope();
  const [summaries, setSummaries] = useState<VisitSummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Appointments dropdown source for the picker. Loaded lazily when the
  // dialog opens so the page render stays cheap.
  const [appointments, setAppointments] = useState<AppointmentOption[]>([]);

  // Form state
  const [appointmentId, setAppointmentId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatmentNotes, setTreatmentNotes] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([
    { medication: "", dosage: "", frequency: "", duration: "" },
  ]);
  const [exercises, setExercises] = useState<ExerciseRow[]>([
    { exercise: "", sets: 0, reps: 0, frequency: "" },
  ]);
  const [dietaryAdvice, setDietaryAdvice] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  // Used in confirmation labels: "For: <patient name>".
  const selectedAppointment = appointments.find((a) => a.id === appointmentId) ?? null;

  useEffect(() => {
    loadSummaries();
  }, []);

  // Lazy-load completed appointments the first time the dialog opens.
  useEffect(() => {
    if (!formOpen || appointments.length > 0) return;
    (async () => {
      try {
        const { apiClient } = await import("@/lib/api-client");
        const { data } = await apiClient.get<any>("/api/appointments");
        const list: AppointmentOption[] = Array.isArray(data?.appointments)
          ? data.appointments
          : Array.isArray(data) ? data : [];
        setAppointments(list);
      } catch {
        setAppointments([]);
      }
    })();
  }, [formOpen, appointments.length]);

  const loadSummaries = async () => {
    try {
      setLoading(true);
      // Doctor / therapist view: summaries the *current clinician* authored.
      // Previously this incorrectly called the patient endpoint with the
      // doctor's user id, which returned empty for everyone.
      const data = await communicationApi.getMyVisitSummaries({ limit: 50 });
      setSummaries(data.summaries);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load summaries");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async () => {
    if (!appointmentId.trim()) {
      toast.error("Select an appointment first");
      return;
    }
    try {
      setAutoGenerating(true);
      const data = await communicationApi.autoGenerateVisitSummary(appointmentId.trim());
      if (data.diagnosis) setDiagnosis(data.diagnosis);
      if (data.treatmentNotes) setTreatmentNotes(data.treatmentNotes);
      if (data.prescriptions && data.prescriptions.length > 0) setPrescriptions(data.prescriptions);
      if (data.exercisePlan && data.exercisePlan.length > 0) setExercises(data.exercisePlan);
      if (data.dietaryAdvice) setDietaryAdvice(data.dietaryAdvice);
      if (data.nextSteps) setNextSteps(data.nextSteps);
      if (data.followUpDate) setFollowUpDate(data.followUpDate);
      toast.success("Summary auto-generated from appointment data");
    } catch (err: any) {
      toast.error(err?.message || "Failed to auto-generate");
    } finally {
      setAutoGenerating(false);
    }
  };

  const handleSave = async (sendToPatient: boolean) => {
    if (!appointmentId.trim()) {
      toast.error("Appointment is required");
      return;
    }
    try {
      setSubmitting(true);
      const filteredRx = prescriptions.filter((p) => p.medication.trim());
      const filteredEx = exercises.filter((e) => e.exercise.trim());
      const summary = await communicationApi.createVisitSummary({
        appointmentId: appointmentId.trim(),
        diagnosis: diagnosis.trim() || undefined,
        treatmentNotes: treatmentNotes.trim() || undefined,
        prescriptions: filteredRx.length > 0 ? filteredRx : undefined,
        exercisePlan: filteredEx.length > 0 ? filteredEx : undefined,
        dietaryAdvice: dietaryAdvice.trim() || undefined,
        nextSteps: nextSteps.trim() || undefined,
        followUpDate: followUpDate || undefined,
      });

      if (sendToPatient) {
        await communicationApi.sendSummaryToPatient(summary.id);
        toast.success("Summary saved and sent to patient");
      } else {
        toast.success("Summary saved");
      }

      resetForm();
      setFormOpen(false);
      loadSummaries();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save summary");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendExisting = async (summaryId: string) => {
    try {
      await communicationApi.sendSummaryToPatient(summaryId);
      setSummaries((prev) =>
        prev.map((s) => (s.id === summaryId ? { ...s, sentToPatient: true } : s))
      );
      toast.success("Summary sent to patient");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send");
    }
  };

  const addRxRow = () =>
    setPrescriptions((prev) => [...prev, { medication: "", dosage: "", frequency: "", duration: "" }]);
  const removeRxRow = (idx: number) =>
    setPrescriptions((prev) => prev.filter((_, i) => i !== idx));
  const updateRxRow = (idx: number, field: keyof PrescriptionRow, value: string) =>
    setPrescriptions((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const addExRow = () =>
    setExercises((prev) => [...prev, { exercise: "", sets: 0, reps: 0, frequency: "" }]);
  const removeExRow = (idx: number) =>
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  const updateExRow = (idx: number, field: keyof ExerciseRow, value: string | number) =>
    setExercises((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const resetForm = () => {
    setAppointmentId("");
    setDiagnosis("");
    setTreatmentNotes("");
    setPrescriptions([{ medication: "", dosage: "", frequency: "", duration: "" }]);
    setExercises([{ exercise: "", sets: 0, reps: 0, frequency: "" }]);
    setDietaryAdvice("");
    setNextSteps("");
    setFollowUpDate("");
  };

  return (
    <>
      <PageHeader title="Visit Summaries" subtitle="Create and manage post-visit summaries">
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Summary
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Visit Summary</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 mt-2">
              {/* Appointment picker + Auto-generate. Replaces the previous
                  raw-ID input — clinicians see patient name + visit date. */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="space-y-2">
                  <Label>Appointment *</Label>
                  <Select value={appointmentId} onValueChange={setAppointmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick an appointment" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {appointments.length === 0 && (
                        <div className="px-2 py-3 text-xs text-muted-foreground">
                          No appointments to show
                        </div>
                      )}
                      {appointments.map((a) => {
                        const patientName = a.patient?.fullName || "Unnamed patient";
                        const when = a.date ? new Date(a.date).toLocaleString(undefined, {
                          month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                        }) : "Date pending";
                        return (
                          <SelectItem key={a.id} value={a.id}>
                            <span className="flex flex-col">
                              <span className="text-sm font-medium">{patientName}</span>
                              <span className="text-xs text-muted-foreground">{when}</span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedAppointment?.patient?.fullName && (
                    <p className="text-xs text-muted-foreground ml-1">
                      Patient: <span className="font-medium text-foreground">{selectedAppointment.patient.fullName}</span>
                    </p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAutoGenerate}
                  disabled={autoGenerating || !appointmentId}
                >
                  <Wand2 className="h-4 w-4 mr-1" />
                  {autoGenerating ? "Generating..." : "Auto-generate from appointment"}
                </Button>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Diagnosis</Label>
                <Textarea
                  placeholder="Primary diagnosis..."
                  rows={2}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Treatment Notes</Label>
                <Textarea
                  placeholder="Treatment details..."
                  rows={3}
                  value={treatmentNotes}
                  onChange={(e) => setTreatmentNotes(e.target.value)}
                />
              </div>

              {/* Prescriptions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Pill className="h-4 w-4" /> Prescriptions
                  </Label>
                  <Button variant="ghost" size="sm" onClick={addRxRow}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {prescriptions.map((rx, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <Input
                        placeholder="Medication"
                        value={rx.medication}
                        onChange={(e) => updateRxRow(idx, "medication", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Dosage"
                        value={rx.dosage}
                        onChange={(e) => updateRxRow(idx, "dosage", e.target.value)}
                        className="w-24"
                      />
                      <Input
                        placeholder="Frequency"
                        value={rx.frequency}
                        onChange={(e) => updateRxRow(idx, "frequency", e.target.value)}
                        className="w-28"
                      />
                      <Input
                        placeholder="Duration"
                        value={rx.duration}
                        onChange={(e) => updateRxRow(idx, "duration", e.target.value)}
                        className="w-24"
                      />
                      {prescriptions.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => removeRxRow(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Exercise Plan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Dumbbell className="h-4 w-4" /> Exercise Plan
                  </Label>
                  <Button variant="ghost" size="sm" onClick={addExRow}>
                    <Plus className="h-3 w-3 mr-1" /> Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {exercises.map((ex, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <Input
                        placeholder="Exercise"
                        value={ex.exercise}
                        onChange={(e) => updateExRow(idx, "exercise", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Sets"
                        type="number"
                        value={ex.sets || ""}
                        onChange={(e) => updateExRow(idx, "sets", parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                      <Input
                        placeholder="Reps"
                        type="number"
                        value={ex.reps || ""}
                        onChange={(e) => updateExRow(idx, "reps", parseInt(e.target.value) || 0)}
                        className="w-20"
                      />
                      <Input
                        placeholder="Frequency"
                        value={ex.frequency}
                        onChange={(e) => updateExRow(idx, "frequency", e.target.value)}
                        className="w-28"
                      />
                      {exercises.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => removeExRow(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Apple className="h-4 w-4" /> Dietary Advice
                </Label>
                <Textarea
                  placeholder="Dietary recommendations..."
                  rows={2}
                  value={dietaryAdvice}
                  onChange={(e) => setDietaryAdvice(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Next Steps</Label>
                <Textarea
                  placeholder="Next steps and recommendations..."
                  rows={2}
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Follow-up Date
                </Label>
                <DatePicker
                  value={followUpDate}
                  onChange={(iso) => setFollowUpDate(iso)}
                />
              </div>

              <Separator />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button variant="secondary" onClick={() => handleSave(false)} disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </Button>
                <Button onClick={() => handleSave(true)} disabled={submitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? "Saving..." : "Save & Send"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Recent Summaries Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (() => {
        const scoped = branchIdParam
          ? summaries.filter((s) => summaryBranchId(s) === branchIdParam)
          : summaries;
        if (scoped.length === 0) {
          return (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-40" />
                <p className="text-lg font-medium">No visit summaries yet</p>
                <p className="text-sm">Create your first post-visit summary</p>
              </CardContent>
            </Card>
          );
        }
        const renderSummary = (s: VisitSummaryEntry) => (
          <Card key={s.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-medium">
                      {/* Patient name first; visit date as the secondary
                          context. The raw appointment id is no longer
                          surfaced — it had zero meaning to the clinician. */}
                      Patient: {s.patient?.fullName || s.patientName || "Unnamed patient"}
                    </span>
                    <Badge
                      variant={s.sentToPatient ? "default" : "secondary"}
                      className="text-[10px] py-0"
                    >
                      {s.sentToPatient ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Sent
                        </span>
                      ) : (
                        "Draft"
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {s.diagnosis || "No diagnosis recorded"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{formatDate(s.createdAt)}</span>
                    {s.appointment?.date && (
                      <>
                        <span>·</span>
                        <span>Visit {formatDate(s.appointment.date)}</span>
                      </>
                    )}
                  </p>
                </div>
                {!s.sentToPatient && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendExisting(s.id)}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Send
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
        if (isAdmin && isAll) {
          return (
            <GroupedByBranch
              items={scoped}
              getBranchId={summaryBranchId}
              getBranchName={summaryBranchName}
              renderItem={renderSummary}
            />
          );
        }
        return (
          <div className="space-y-3">
            {scoped.map(renderSummary)}
          </div>
        );
      })()}
    </>
  );
}

// ── Patient View ──────────────────────────────────────────────────────────────

function PatientView({ userId: _userId }: { userId: string }) {
  const [summaries, setSummaries] = useState<VisitSummaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadSummaries();
  }, []);

  const loadSummaries = async () => {
    try {
      setLoading(true);
      // /me resolves the patient id server-side from the JWT — previously
      // we passed user.id where Patient.id was expected, so the page
      // always rendered empty for patients.
      const data = await communicationApi.getMySharedVisitSummaries({ limit: 50 });
      setSummaries(data.summaries);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load visit summaries");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="My Visit Summaries" subtitle="Review your post-visit records" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-1/3 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="My Visit Summaries" subtitle="Review your post-visit records" />

      {summaries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No visit summaries</p>
            <p className="text-sm">Summaries from your visits will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {summaries.map((s) => {
            const isExpanded = expandedId === s.id;
            return (
              <Card key={s.id} className="transition-shadow hover:shadow-sm">
                <CardContent className="p-5">
                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Stethoscope className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <span className="text-sm font-medium">{s.clinicianName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(s.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {s.diagnosis || "No diagnosis recorded"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.print();
                          }}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {s.treatmentNotes && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Treatment Notes</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.treatmentNotes}</p>
                        </div>
                      )}

                      {s.prescriptions && s.prescriptions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                            <Pill className="h-4 w-4" /> Prescriptions
                          </h4>
                          <div className="bg-muted/50 rounded-md p-3 overflow-x-auto">
                            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground mb-2 min-w-[400px]">
                              <span>Medication</span>
                              <span>Dosage</span>
                              <span>Frequency</span>
                              <span>Duration</span>
                            </div>
                            {s.prescriptions.map((rx, i) => (
                              <div key={i} className="grid grid-cols-4 gap-2 text-sm py-1.5 border-t border-border/50 min-w-[400px]">
                                <span className="font-medium">{rx.medication}</span>
                                <span>{rx.dosage}</span>
                                <span>{rx.frequency}</span>
                                <span>{rx.duration}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {s.exercisePlan && s.exercisePlan.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                            <Dumbbell className="h-4 w-4" /> Exercise Plan
                          </h4>
                          <div className="bg-muted/50 rounded-md p-3 overflow-x-auto">
                            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground mb-2 min-w-[360px]">
                              <span>Exercise</span>
                              <span>Sets</span>
                              <span>Reps</span>
                              <span>Frequency</span>
                            </div>
                            {s.exercisePlan.map((ex, i) => (
                              <div key={i} className="grid grid-cols-4 gap-2 text-sm py-1.5 border-t border-border/50 min-w-[360px]">
                                <span className="font-medium">{ex.exercise}</span>
                                <span>{ex.sets}</span>
                                <span>{ex.reps}</span>
                                <span>{ex.frequency}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {s.dietaryAdvice && (
                        <div>
                          <h4 className="text-sm font-medium mb-1 flex items-center gap-1.5">
                            <Apple className="h-4 w-4" /> Dietary Advice
                          </h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.dietaryAdvice}</p>
                        </div>
                      )}

                      {s.nextSteps && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Next Steps</h4>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{s.nextSteps}</p>
                        </div>
                      )}

                      {s.followUpDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Follow-up:</span>
                          <span className="text-muted-foreground">{formatDate(s.followUpDate)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
