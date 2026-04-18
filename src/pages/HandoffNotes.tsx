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
  ArrowRightLeft, Plus, X, Pill, ChevronDown, ChevronUp,
  Clock, Wand2, AlertTriangle, AlertCircle, Info, Circle,
} from "lucide-react";
import { communicationApi } from "@/services/communication.service";
import { toast } from "sonner";
import type { HandoffNoteEntry } from "@/types";

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

interface MedicationRow {
  name: string;
  dosage: string;
  frequency: string;
}

export default function HandoffNotes() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState("received");
  const [received, setReceived] = useState<HandoffNoteEntry[]>([]);
  const [sent, setSent] = useState<HandoffNoteEntry[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [loadingSent, setLoadingSent] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // Form state
  const [patientId, setPatientId] = useState("");
  const [toClinicianId, setToClinicianId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [summary, setSummary] = useState("");
  const [medications, setMedications] = useState<MedicationRow[]>([{ name: "", dosage: "", frequency: "" }]);
  const [conditions, setConditions] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [urgency, setUrgency] = useState("Normal");
  const [appointmentId, setAppointmentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [autoPopulating, setAutoPopulating] = useState(false);

  useEffect(() => {
    loadReceived();
    loadSent();
  }, []);

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
    if (!patientId.trim() || !summary.trim()) {
      toast.error("Patient and summary are required");
      return;
    }
    try {
      setSubmitting(true);
      const filteredMeds = medications.filter((m) => m.name.trim());
      const conditionsList = conditions
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await communicationApi.createHandoffNote({
        patientId: patientId.trim(),
        toClinicianId: toClinicianId.trim() || undefined,
        toBranchId: toBranchId.trim() || undefined,
        summary: summary.trim(),
        currentMedications: filteredMeds.length > 0 ? filteredMeds : undefined,
        activeConditions: conditionsList.length > 0 ? conditionsList : undefined,
        nextSteps: nextSteps.trim() || undefined,
        urgency,
      });
      toast.success("Handoff note created");
      resetForm();
      setFormOpen(false);
      loadSent();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create handoff note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoPopulate = async () => {
    if (!appointmentId.trim()) {
      toast.error("Enter an appointment ID first");
      return;
    }
    try {
      setAutoPopulating(true);
      const data = await communicationApi.autoPopulateHandoff(appointmentId.trim());
      if (data.patientId) setPatientId(data.patientId);
      if (data.summary) setSummary(data.summary);
      if (data.currentMedications && data.currentMedications.length > 0) {
        setMedications(data.currentMedications);
      }
      if (data.activeConditions && data.activeConditions.length > 0) {
        setConditions(data.activeConditions.join(", "));
      }
      if (data.nextSteps) setNextSteps(data.nextSteps);
      if (data.urgency) setUrgency(data.urgency);
      toast.success("Form populated from appointment data");
    } catch (err: any) {
      toast.error(err?.message || "Failed to auto-populate");
    } finally {
      setAutoPopulating(false);
    }
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

  const addMedRow = () => {
    setMedications((prev) => [...prev, { name: "", dosage: "", frequency: "" }]);
  };

  const removeMedRow = (idx: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMedRow = (idx: number, field: keyof MedicationRow, value: string) => {
    setMedications((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  };

  const resetForm = () => {
    setPatientId("");
    setToClinicianId("");
    setToBranchId("");
    setSummary("");
    setMedications([{ name: "", dosage: "", frequency: "" }]);
    setConditions("");
    setNextSteps("");
    setUrgency("Normal");
    setAppointmentId("");
  };

  const renderHandoffCard = (h: HandoffNoteEntry, type: "received" | "sent") => {
    const uc = URGENCY_CONFIG[h.urgency] || URGENCY_CONFIG.Normal;
    const UIcon = uc.icon;
    const isExpanded = expandedId === h.id;

    return (
      <Card
        key={h.id}
        className={`transition-colors ${!h.isRead && type === "received" ? "border-l-4 border-l-blue-500" : ""}`}
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
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Handoff
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Handoff Note</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {/* Auto-populate */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <Label className="text-xs text-muted-foreground">Auto-populate from appointment</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Appointment ID"
                      value={appointmentId}
                      onChange={(e) => setAppointmentId(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleAutoPopulate}
                      disabled={autoPopulating}
                    >
                      <Wand2 className="h-4 w-4 mr-1" />
                      {autoPopulating ? "Loading..." : "Auto-populate"}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Patient ID *</Label>
                    <Input
                      placeholder="Patient ID"
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                    />
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Receiving Clinician (optional)</Label>
                    <Input
                      placeholder="Clinician ID"
                      value={toClinicianId}
                      onChange={(e) => setToClinicianId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Receiving Branch (optional)</Label>
                    <Input
                      placeholder="Branch ID"
                      value={toBranchId}
                      onChange={(e) => setToBranchId(e.target.value)}
                    />
                  </div>
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

                {/* Medications */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Current Medications</Label>
                    <Button variant="ghost" size="sm" onClick={addMedRow}>
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {medications.map((med, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <Input
                          placeholder="Medication"
                          value={med.name}
                          onChange={(e) => updateMedRow(idx, "name", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Dosage"
                          value={med.dosage}
                          onChange={(e) => updateMedRow(idx, "dosage", e.target.value)}
                          className="w-28"
                        />
                        <Input
                          placeholder="Frequency"
                          value={med.frequency}
                          onChange={(e) => updateMedRow(idx, "frequency", e.target.value)}
                          className="w-28"
                        />
                        {medications.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 flex-shrink-0"
                            onClick={() => removeMedRow(idx)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Active Conditions</Label>
                  <Input
                    placeholder="Comma-separated (e.g., Diabetes, Hypertension)"
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
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
                  <Button variant="outline" onClick={() => setFormOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={submitting}>
                    {submitting ? "Creating..." : "Create Handoff"}
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
            <TabsTrigger value="sent">Sent</TabsTrigger>
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
                {sent.map((h) => renderHandoffCard(h, "sent"))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
