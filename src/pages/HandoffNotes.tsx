import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRightLeft, Plus, Pill, ChevronDown, ChevronUp,
  Clock, AlertTriangle, AlertCircle, Info, Circle, Send, Pencil, Sparkles,
} from "lucide-react";
import { communicationApi } from "@/services/communication.service";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import type { HandoffNoteEntry } from "@/types";
import { PatientPicker, type PatientLite } from "@/components/clinical/PatientPicker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DateInput, toDDMMYYYY } from "@/components/common/DateInput";

interface ClinicianLite {
  id: string;       // User.id (used as toClinicianId)
  fullName: string | null;
  email?: string | null;
  role: string;
  specialization?: string | null;
  branchId?: string | null;
  branchName?: string | null;
}

// Returned by GET /api/patients/:patientId/handoff-summary. Powers the
// auto-loaded patient history panel and gates the "Create Handoff" button.
interface HandoffSummary {
  patient: { id: string; name: string | null; age: number | null; gender: string | null; phone: string | null };
  assignedDoctor: { fullName: string | null; specialization: string | null } | null;
  activeMedications: Array<{ id: string; medicationName: string; dosage: string | null; frequency: string | null; duration: string | null }>;
  activeConditions: string[];
  activeJourneys: Array<{ id: string; title: string; condition: string }>;
  activeDiet: { id: string; title: string; doshaTarget: string } | null;
  lastAppointment: { id: string; date: string; notes: string | null; doctor: { fullName: string | null } | null } | null;
  upcomingAppointment: { id: string; date: string; status: string; doctor: { fullName: string | null } | null } | null;
  lastCheckIn: { painLevel: number; mood: string | null; sleepHours: number | null; createdAt: string } | null;
}

const URGENCY_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  Critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  High:     { label: "High",     color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  Normal:   { label: "Normal",   color: "bg-blue-100 text-blue-700 border-blue-200", icon: Info },
  Low:      { label: "Low",      color: "bg-gray-100 text-gray-600 border-gray-200", icon: Circle },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function HandoffNotes() {
  const { role, user } = useAuth();
  const [activeTab, setActiveTab] = useState("received");
  const [received, setReceived] = useState<HandoffNoteEntry[]>([]);
  const [sent, setSent] = useState<HandoffNoteEntry[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [loadingSent, setLoadingSent] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Lookup lists for the form dropdowns. Pulled once when the dialog opens.
  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [clinicians, setClinicians] = useState<ClinicianLite[]>([]);
  const [branchOptions, setBranchOptions] = useState<{ id: string; name: string }[]>([]);

  // Form state. Medications / active conditions / appointment-id auto-populate
  // were retired from the create form — clinicians now rely on the auto-loaded
  // patient-history panel (Feature 18) for that context, so the form only
  // captures the routing fields plus summary / next-steps / urgency.
  const [patientId, setPatientId] = useState("");
  const [toClinicianId, setToClinicianId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [handoffDate, setHandoffDate] = useState(""); // DD/MM/YYYY — required, must not be in the past.
  const [summary, setSummary] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [submitting, setSubmitting] = useState(false);
  const todayDDMM = toDDMMYYYY(new Date());
  // When set, the form is editing an existing DRAFT rather than creating fresh.
  // Two flows converge on one Dialog — submit branches on this state.
  const [editingDraft, setEditingDraft] = useState<HandoffNoteEntry | null>(null);
  const [sendAfterSave, setSendAfterSave] = useState(false);

  // Auto-loaded patient history panel (FIX 18). Replaces the manual
  // medications / conditions inputs the form used to ask for. Submit is
  // gated on this loading successfully — until then we don't trust that the
  // receiving doctor will see the correct context.
  const [summaryData, setSummaryData] = useState<HandoffSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryRetryNonce, setSummaryRetryNonce] = useState(0);

  useEffect(() => {
    if (!formOpen) return;
    const id = patientId.trim();
    if (!id) {
      setSummaryData(null);
      setSummaryError(null);
      setSummaryLoading(false);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    apiClient.get<{ data: HandoffSummary }>(`/api/patients/${id}/handoff-summary`)
      .then(({ data }) => { if (!cancelled) setSummaryData(data.data); })
      .catch((err) => {
        if (cancelled) return;
        setSummaryData(null);
        setSummaryError(err?.message || "Could not load patient history");
      })
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, formOpen, summaryRetryNonce]);

  // Resolve the selected patient's display name from the loaded list. Used
  // both in the auto-populate badge and in the read-only confirmation label.
  const selectedPatient = patients.find((p) => p.id === patientId) ?? null;
  const selectedPatientName = selectedPatient?.fullName ?? null;

  useEffect(() => {
    loadReceived();
    loadSent();
  }, []);

  // Pre-load patient/clinician/branch lookups on first dialog open. Cached
  // in component state so reopening doesn't refetch.
  useEffect(() => {
    if (!formOpen) return;
    if (patients.length === 0) {
      apiClient.get<PatientLite[]>("/api/user/list-patients")
        .then(({ data }) => setPatients(Array.isArray(data) ? data : []))
        .catch(() => setPatients([]));
    }
    if (clinicians.length === 0) {
      // Receiving DOCTOR only (per spec). Therapists are no longer surfaced
      // as handoff recipients — handoffs flow doctor → doctor.
      apiClient.get<any[]>("/api/user/list-doctors")
        .then(({ data }) => {
          const docs: ClinicianLite[] = (Array.isArray(data) ? data : [])
            .map((r) => ({
              id: r.userId || r.user?.id || r.id,
              fullName: r.fullName ?? r.user?.fullName ?? null,
              email: r.email ?? r.user?.email ?? null,
              role: r.user?.role || "DOCTOR",
              specialization: r.specialization ?? null,
              branchId: r.branchId ?? r.user?.branchId ?? null,
              branchName: r.branch?.name ?? r.user?.branch?.name ?? null,
            }))
            .filter((c) => c.id && c.id !== user?.id); // exclude self
          setClinicians(docs);
        })
        .catch(() => setClinicians([]));
    }
    if (branchOptions.length === 0) {
      apiClient.get<{ id: string; name: string }[]>("/api/branches")
        .then(({ data }) => setBranchOptions(Array.isArray(data) ? data : []))
        .catch(() => setBranchOptions([]));
    }
  }, [formOpen, patients.length, clinicians.length, branchOptions.length, user?.id]);

  const loadReceived = async () => {
    try {
      setLoadingReceived(true);
      const data = await communicationApi.getReceivedHandoffs({ limit: 50 });
      setReceived(data.handoffs);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load received handoffs");
    } finally {
      setLoadingReceived(false);
    }
  };

  const loadSent = async () => {
    try {
      setLoadingSent(true);
      const data = await communicationApi.getSentHandoffs({ limit: 50 });
      setSent(data.handoffs);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load sent handoffs");
    } finally {
      setLoadingSent(false);
    }
  };

  const handleCreate = async () => {
    if (!patientId.trim()) {
      toast.error("Please select a patient");
      return;
    }
    if (!summary.trim()) {
      toast.error("Summary is required");
      return;
    }
    // Drafts are allowed to be addressless. Anything actually leaving the
    // outbox (new SENT handoff, or draft → send) requires a doctor + date.
    const goingLive = !editingDraft || sendAfterSave;
    if (goingLive) {
      if (!toClinicianId.trim()) {
        toast.error("Please select a receiving doctor");
        return;
      }
      if (!handoffDate.trim() || !/^\d{2}\/\d{2}\/\d{4}$/.test(handoffDate)) {
        toast.error("Please enter a valid handoff date (DD/MM/YYYY)");
        return;
      }
      // Block past dates so a clinician can't accidentally schedule in the past.
      const [dd, mm, yyyy] = handoffDate.split("/").map((p) => parseInt(p, 10));
      const entered = new Date(Date.UTC(yyyy, mm - 1, dd));
      const todayUTC = new Date();
      todayUTC.setUTCHours(0, 0, 0, 0);
      if (entered.getTime() < todayUTC.getTime()) {
        toast.error("Handoff date cannot be in the past");
        return;
      }
    }
    try {
      setSubmitting(true);
      if (editingDraft) {
        // Draft edit path: save fields, then optionally promote to SENT.
        await communicationApi.updateHandoffNote(editingDraft.id, {
          summary: summary.trim(),
          nextSteps: nextSteps.trim() || "",
          urgency,
          toClinicianId: toClinicianId.trim() || null,
          toBranchId: toBranchId.trim() || null,
        });
        if (sendAfterSave) {
          await communicationApi.sendHandoffDraft(editingDraft.id);
          const recipientName =
            clinicians.find((c) => c.id === toClinicianId)?.fullName || "the receiving doctor";
          toast.success(`Handoff note sent and Dr. ${recipientName} has been notified`);
        } else {
          toast.success("Draft saved");
        }
      } else {
        await communicationApi.createHandoffNote({
          patientId: patientId.trim(),
          toClinicianId: toClinicianId.trim(),
          toBranchId: toBranchId.trim() || undefined,
          handoffDate,
          summary: summary.trim(),
          nextSteps: nextSteps.trim() || undefined,
          urgency,
        });
        const recipientName =
          clinicians.find((c) => c.id === toClinicianId)?.fullName || "the receiving doctor";
        toast.success(`Handoff note created and Dr. ${recipientName} has been notified`);
      }
      resetForm();
      setFormOpen(false);
      loadSent();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save handoff note");
    } finally {
      setSubmitting(false);
    }
  };

  const openDraftEditor = (h: HandoffNoteEntry, sendAfter: boolean) => {
    setEditingDraft(h);
    setSendAfterSave(sendAfter);
    setPatientId(h.patientId);
    setToClinicianId(h.toClinicianId || "");
    setToBranchId(h.toBranchId || "");
    setHandoffDate(toDDMMYYYY((h as { handoffDate?: string | null }).handoffDate ?? null));
    setSummary(h.summary || "");
    setNextSteps(h.nextSteps || "");
    // Form's Select uses TitleCase values; backend stores UPPER. Map defensively.
    const u = (h.urgency || "Normal").toLowerCase();
    setUrgency(u.charAt(0).toUpperCase() + u.slice(1));
    setFormOpen(true);
  };

  const handleMarkRead = async (id: string) => {
    try {
      await communicationApi.markHandoffRead(id);
      setReceived((prev) =>
        prev.map((h) => (h.id === id ? { ...h, isRead: true } : h))
      );
      toast.success("Marked as read");
    } catch {
      // silent
    }
  };

  const resetForm = () => {
    setPatientId("");
    setToClinicianId("");
    setToBranchId("");
    setHandoffDate("");
    setSummary("");
    setNextSteps("");
    setUrgency("Normal");
    setEditingDraft(null);
    setSendAfterSave(false);
    setSummaryData(null);
    setSummaryError(null);
    setSummaryLoading(false);
  };

  const renderHandoffCard = (h: HandoffNoteEntry, type: "received" | "sent") => {
    const uc = URGENCY_CONFIG[h.urgency] || URGENCY_CONFIG.Normal;
    const UIcon = uc.icon;
    const isExpanded = expandedId === h.id;
    const isDraft = type === "sent" && h.status === "DRAFT";
    const needsRecipient = isDraft && !h.toClinicianId && !h.toBranchId;

    return (
      <Card
        key={h.id}
        className={`transition-colors ${
          !h.isRead && type === "received" ? "border-l-4 border-l-blue-500" : ""
        } ${isDraft ? "border-l-4 border-l-amber-500 bg-amber-50/30" : ""}`}
      >
        <CardContent className="p-5">
          <div
            className="cursor-pointer"
            onClick={() => setExpandedId(isExpanded ? null : h.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge className={`${uc.color} border text-xs`}>
                    <UIcon className="h-3 w-3 mr-1" />
                    {uc.label}
                  </Badge>
                  {isDraft && (
                    <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-xs">
                      Draft
                    </Badge>
                  )}
                  {isDraft && h.isAutoGenerated && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Sparkles className="h-3 w-3" />
                      Auto-seeded
                    </Badge>
                  )}
                  {needsRecipient && (
                    <span className="text-[11px] text-amber-700 font-medium">
                      Recipient needed
                    </span>
                  )}
                  {!h.isRead && type === "received" && (
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
                  )}
                </div>
                <h3 className="font-semibold text-sm mb-1">
                  Patient: {h.patientName || h.patientId}
                </h3>
                <p className="text-xs text-muted-foreground mb-1">
                  {type === "received"
                    ? `From: ${h.fromClinicianName || h.fromClinicianId}`
                    : `To: ${h.toClinicianName || h.toClinicianId || "Unassigned"}`}
                  {h.toBranchName && ` | Branch: ${h.toBranchName}`}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">{h.summary}</p>
              </div>
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(h.createdAt)}
                </span>
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
              <div>
                <h4 className="text-sm font-medium mb-1">Summary</h4>
                <p className="text-sm text-muted-foreground">{h.summary}</p>
              </div>
              {h.currentMedications && h.currentMedications.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Pill className="h-4 w-4" /> Current Medications
                  </h4>
                  <div className="bg-muted/50 rounded-md p-3">
                    <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground mb-2">
                      <span>Medication</span>
                      <span>Dosage</span>
                      <span>Frequency</span>
                    </div>
                    {h.currentMedications.map((m, i) => (
                      <div key={i} className="grid grid-cols-3 gap-2 text-sm py-1 border-t border-border/50">
                        <span>{m.name}</span>
                        <span>{m.dosage}</span>
                        <span>{m.frequency}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {h.activeConditions && h.activeConditions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Active Conditions</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {h.activeConditions.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {h.nextSteps && (
                <div>
                  <h4 className="text-sm font-medium mb-1">Next Steps</h4>
                  <p className="text-sm text-muted-foreground">{h.nextSteps}</p>
                </div>
              )}
              {type === "received" && !h.isRead && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkRead(h.id);
                  }}
                >
                  Mark as Read
                </Button>
              )}
              {isDraft && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); openDraftEditor(h, true); }}
                    className="gap-1"
                  >
                    <Send className="h-4 w-4" />
                    Review & Send
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); openDraftEditor(h, false); }}
                    className="gap-1"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-5 w-24 mb-3" />
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <PageHeader title="Handoff Notes" subtitle="Patient handoff management between clinicians">
          <Dialog
            open={formOpen}
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Handoff
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingDraft
                    ? sendAfterSave ? "Review & Send Handoff" : "Edit Draft Handoff"
                    : "Create Handoff Note"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Patient *</Label>
                    <PatientPicker
                      value={patientId}
                      onChange={setPatientId}
                      patients={patients}
                      placeholder="Search patient by name or phone…"
                    />
                    {/* Confirmation echo: shows the resolved patient name as
                        soon as one is picked or auto-populated, so clinicians
                        no longer have to read raw IDs. */}
                    {patientId && selectedPatientName && (
                      <p className="text-xs text-muted-foreground ml-1">
                        Patient: <span className="font-medium text-foreground">{selectedPatientName}</span>
                      </p>
                    )}
                    {patientId && !selectedPatientName && (
                      <p className="text-xs text-amber-600 ml-1">
                        Patient ID set, but the matching record could not be loaded — refresh and retry if needed.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Urgency</Label>
                    <Select value={urgency} onValueChange={setUrgency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Auto-loaded patient history. The receiving doctor sees this
                    inline so they don't have to flip back to the patient
                    profile, and "Create Handoff" stays disabled until it
                    loads (or until the clinician retries past an error). */}
                {patientId && !editingDraft && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Patient history (auto-loaded)
                      </div>
                      {summaryLoading && (
                        <span className="text-xs text-muted-foreground">Loading…</span>
                      )}
                    </div>

                    {summaryError && (
                      <div className="flex items-center justify-between gap-2 rounded border border-destructive/40 bg-destructive/5 px-3 py-2">
                        <div className="text-xs text-destructive">{summaryError}</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSummaryRetryNonce((n) => n + 1)}
                        >
                          Retry
                        </Button>
                      </div>
                    )}

                    {summaryData && !summaryLoading && (
                      <div className="space-y-3 text-xs">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                          {summaryData.patient.age != null && <span>Age: <span className="font-semibold text-foreground">{summaryData.patient.age}</span></span>}
                          {summaryData.patient.gender && <span>Gender: <span className="font-semibold text-foreground">{summaryData.patient.gender}</span></span>}
                          {summaryData.assignedDoctor?.fullName && <span>Primary: <span className="font-semibold text-foreground">Dr. {summaryData.assignedDoctor.fullName}</span></span>}
                        </div>

                        {summaryData.activeConditions.length > 0 && (
                          <div className="space-y-1">
                            <div className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Active conditions</div>
                            <div className="flex flex-wrap gap-1.5">
                              {summaryData.activeConditions.map((c, i) => (
                                <Badge key={i} variant="secondary" className="text-[11px]">{c}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {summaryData.activeMedications.length > 0 && (
                          <div className="space-y-1">
                            <div className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground flex items-center gap-1.5">
                              <Pill className="h-3 w-3" /> Current medications
                            </div>
                            <div className="space-y-0.5">
                              {summaryData.activeMedications.slice(0, 5).map((m) => (
                                <div key={m.id} className="text-foreground">
                                  {m.medicationName}
                                  {(m.dosage || m.frequency) && (
                                    <span className="text-muted-foreground"> — {[m.dosage, m.frequency].filter(Boolean).join(" · ")}</span>
                                  )}
                                </div>
                              ))}
                              {summaryData.activeMedications.length > 5 && (
                                <div className="italic text-muted-foreground">+{summaryData.activeMedications.length - 5} more</div>
                              )}
                            </div>
                          </div>
                        )}

                        {summaryData.activeDiet && (
                          <div className="space-y-0.5">
                            <div className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Active diet plan</div>
                            <div>{summaryData.activeDiet.title} <span className="text-muted-foreground">({summaryData.activeDiet.doshaTarget})</span></div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {summaryData.lastAppointment && (
                            <div>
                              <div className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Last visit</div>
                              <div>{new Date(summaryData.lastAppointment.date).toLocaleDateString()}{summaryData.lastAppointment.doctor?.fullName ? ` · Dr. ${summaryData.lastAppointment.doctor.fullName}` : ""}</div>
                            </div>
                          )}
                          {summaryData.upcomingAppointment && (
                            <div>
                              <div className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Upcoming visit</div>
                              <div>{new Date(summaryData.upcomingAppointment.date).toLocaleDateString()}{summaryData.upcomingAppointment.doctor?.fullName ? ` · Dr. ${summaryData.upcomingAppointment.doctor.fullName}` : ""}</div>
                            </div>
                          )}
                          {summaryData.lastCheckIn && (
                            <div>
                              <div className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">Latest check-in</div>
                              <div>Pain {summaryData.lastCheckIn.painLevel}/10{summaryData.lastCheckIn.mood ? ` · ${summaryData.lastCheckIn.mood}` : ""}</div>
                            </div>
                          )}
                        </div>

                        {summaryData.activeConditions.length === 0 && summaryData.activeMedications.length === 0 && !summaryData.activeDiet && (
                          <div className="text-muted-foreground italic">No active medications, conditions or diet plans on file.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Receiving Doctor <span className="text-rose-600">*</span>
                    </Label>
                    <SearchableSelect
                      value={toClinicianId}
                      onChange={setToClinicianId}
                      placeholder="Select a doctor"
                      searchPlaceholder="Search doctors…"
                      items={clinicians.map((c) => {
                        const roleLabel = c.role === "ADMIN_DOCTOR" ? "Admin Doctor" : "Doctor";
                        const subBits = [
                          roleLabel,
                          c.specialization || null,
                          c.branchName || null,
                        ].filter(Boolean) as string[];
                        return {
                          value: c.id,
                          label: c.fullName || c.email || "Unnamed doctor",
                          sub: subBits.join(" · ") || undefined,
                        };
                      })}
                    />
                  </div>
                  <DateInput
                    label="Handoff Date"
                    required
                    value={handoffDate}
                    onChange={setHandoffDate}
                    minDate={todayDDMM}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Receiving Branch (optional)</Label>
                  <Select
                    value={toBranchId || undefined}
                    onValueChange={(v) => setToBranchId(v === "__none__" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No specific branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No specific branch</SelectItem>
                      {branchOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Summary *</Label>
                  <Textarea
                    placeholder="Patient summary..."
                    rows={3}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Next Steps</Label>
                  <Textarea
                    placeholder="Recommended next steps..."
                    rows={2}
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                  />
                </div>

                <Separator />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  {/* Gate the create flow on the patient-history panel
                      successfully loading. Drafts (editingDraft) bypass — those
                      are pre-populated and don't need the auto-load. */}
                  <Button
                    onClick={handleCreate}
                    disabled={
                      submitting ||
                      (!editingDraft && !!patientId && (summaryLoading || !!summaryError || !summaryData))
                    }
                    title={
                      !editingDraft && patientId && (summaryLoading || summaryError || !summaryData)
                        ? "Waiting for patient history to load…"
                        : undefined
                    }
                  >
                    {submitting
                      ? "Saving..."
                      : editingDraft
                        ? sendAfterSave ? "Send Handoff" : "Save Draft"
                        : "Create Handoff"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </PageHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="received" className="gap-1.5">
              Received
              {received.filter((h) => !h.isRead).length > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 text-[10px] px-1.5">
                  {received.filter((h) => !h.isRead).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-1.5">
              Sent
              {sent.filter((h) => h.status === "DRAFT").length > 0 && (
                <Badge className="h-5 min-w-5 text-[10px] px-1.5 bg-amber-100 text-amber-800 border border-amber-200">
                  {sent.filter((h) => h.status === "DRAFT").length} draft
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            {loadingReceived ? (
              renderSkeleton()
            ) : received.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-lg font-medium">No received handoffs</p>
                  <p className="text-sm">Handoff notes sent to you will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {received.map((h) => renderHandoffCard(h, "received"))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent">
            {loadingSent ? (
              renderSkeleton()
            ) : sent.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-lg font-medium">No sent handoffs</p>
                  <p className="text-sm">Handoff notes you create will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {[...sent]
                  .sort((a, b) => {
                    const aDraft = a.status === "DRAFT" ? 0 : 1;
                    const bDraft = b.status === "DRAFT" ? 0 : 1;
                    if (aDraft !== bDraft) return aDraft - bDraft;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                  })
                  .map((h) => renderHandoffCard(h, "sent"))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
