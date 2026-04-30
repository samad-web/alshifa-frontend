import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Activity, User, Pill, Calendar, FileText, MessageSquare, Heart,
  TrendingUp, ShoppingCart, ExternalLink,
} from "lucide-react";
import { MedicineOrderForm } from "@/components/pharmacy/MedicineOrderForm";
import { PrescribedVitalsManager } from "@/components/patients/PrescribedVitalsManager";
import { VitalChart } from "@/components/vitals/VitalChart";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PatientLocationCard, type PatientLocationFields } from "@/components/PatientLocationCard";
import { PainMapCard } from "@/components/patient/PainMapCard";
import { PatientRecordReviewTracker } from "@/components/doctor/PatientRecordReviewTracker";

// ── Types (loose — upstream API doesn't have strict types here) ──

interface PatientData {
  id: string;
  userId: string;
  fullName?: string;
  phoneNumber?: string;
  user?: { email: string };
  branch?: { id: string; name: string };
  onboardingData?: {
    gender?: string;
    painLevel?: number;
    sleepBedtime?: string;
    sleepWakeTime?: string;
    sleepDuration?: number;
    painLocations?: string[];
  };
  appointments?: AppointmentRow[];
  // Home Therapy: location & contact (optional — may be null on legacy rows)
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  primaryPhone?: string | null;
  alternativePhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationVerified?: boolean;
}

interface AppointmentRow {
  id: string;
  date: string;
  status: string;
  consultationType?: string;
  doctor?: { fullName?: string; user?: { email?: string } } | null;
  therapist?: { fullName?: string; user?: { email?: string } } | null;
}

interface PrescriptionRow {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  createdAt: string;
  doctor?: { fullName?: string } | null;
  therapist?: { fullName?: string } | null;
}

interface JourneyRow {
  id: string;
  title: string;
  condition: string;
  status: string;
  startDate: string;
  wellnessScore: number;
  phases?: Array<{ id: string; name: string; status: string; order: number }>;
}

interface HandoffRow {
  id: string;
  summary: string;
  urgency: string;
  createdAt: string;
  fromUser?: { email: string };
  toUser?: { email: string };
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  SCHEDULED: "bg-indigo-100 text-indigo-700",
  PENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  NO_SHOW: "bg-slate-200 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  DISCONTINUED: "bg-rose-100 text-rose-700",
};

// ── Tabs ────────────────────────────────────────────────────────────────

function OverviewTab({ patient }: { patient: PatientData }) {
  // Pain map is restricted to the consultation doctor + admin doctors. Backend
  // enforces; the card silently 403s for unauthorised callers, but we also
  // skip rendering for non-clinical roles so the UI doesn't show a wasted slot.
  const { role } = useAuth();
  const showPainMap = role === "DOCTOR" || role === "ADMIN_DOCTOR";

  // Local copy so PatientLocationCard's "Re-verify" can update the embedded
  // map without a full page refresh. Synced when the parent re-fetches.
  const [location, setLocation] = useState<PatientLocationFields>(() => ({
    id: patient.id,
    addressLine1: patient.addressLine1 ?? null,
    addressLine2: patient.addressLine2 ?? null,
    city: patient.city ?? null,
    state: patient.state ?? null,
    pincode: patient.pincode ?? null,
    primaryPhone: patient.primaryPhone ?? null,
    alternativePhone: patient.alternativePhone ?? null,
    latitude: patient.latitude ?? null,
    longitude: patient.longitude ?? null,
    locationVerified: patient.locationVerified ?? false,
  }));
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Patient profile
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Full name" value={patient.fullName || "—"} />
          <InfoRow label="Email" value={patient.user?.email || "—"} />
          <InfoRow label="Phone" value={patient.phoneNumber || "—"} />
          <InfoRow label="Branch" value={patient.branch?.name || "Main Clinic"} />
          <InfoRow label="Patient ID" value={patient.id} mono />
        </CardContent>
      </Card>

      <PatientLocationCard
        patient={location}
        onUpdated={(next) => setLocation((prev) => ({ ...prev, ...next, id: prev.id }))}
      />

      {showPainMap && <PainMapCard patientId={patient.id} />}

      {patient.onboardingData && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-primary">
              <Activity className="h-4 w-4" /> Baseline (onboarding)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-2 gap-3 text-sm">
            <InfoRow label="Gender" value={patient.onboardingData.gender || "—"} />
            <InfoRow label="Initial pain" value={`${patient.onboardingData.painLevel ?? "—"}/10`} />
            <InfoRow
              label="Sleep schedule"
              value={`${patient.onboardingData.sleepBedtime || "—"} – ${patient.onboardingData.sleepWakeTime || "—"}`}
            />
            <InfoRow label="Sleep duration" value={`${patient.onboardingData.sleepDuration ?? "—"}h`} />
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Pain locations</p>
              <p className="font-medium">
                {patient.onboardingData.painLocations?.join(", ") || "None reported"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VitalsTab({ patientId, userId }: { patientId: string; userId?: string }) {
  const [journey, setJourney] = useState<JourneyRow | null>(null);
  const [vitalType, setVitalType] = useState<string>("PAIN_SCORE");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    apiClient.get<JourneyRow[]>(`/api/journeys/patient/${userId}`)
      .then(({ data }) => {
        const active = (Array.isArray(data) ? data : []).find((j) => j.status === "ACTIVE");
        setJourney(active || null);
      })
      .catch(() => setJourney(null))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="space-y-4">
      <PrescribedVitalsManager patientId={patientId} editable />

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Vital trends
          </CardTitle>
          <Select value={vitalType} onValueChange={setVitalType}>
            <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PAIN_SCORE">Pain Score</SelectItem>
              <SelectItem value="BP_SYSTOLIC">BP (Systolic)</SelectItem>
              <SelectItem value="BP_DIASTOLIC">BP (Diastolic)</SelectItem>
              <SelectItem value="WEIGHT">Weight</SelectItem>
              <SelectItem value="GLUCOSE">Glucose</SelectItem>
              <SelectItem value="SLEEP_HOURS">Sleep</SelectItem>
              <SelectItem value="MOOD">Mood</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : journey ? (
            <VitalChart journeyId={journey.id} type={vitalType} days={30} />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No active treatment journey — vital trends require an active journey.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JourneyTab({ userId }: { userId?: string }) {
  const [journeys, setJourneys] = useState<JourneyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    apiClient.get<JourneyRow[]>(`/api/journeys/patient/${userId}`)
      .then(({ data }) => setJourneys(Array.isArray(data) ? data : []))
      .catch(() => setJourneys([]))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (journeys.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
        No treatment journeys yet.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {journeys.map((j) => {
        const completedPhases = (j.phases || []).filter((p) => p.status === "COMPLETED").length;
        const totalPhases = (j.phases || []).length;
        const pct = totalPhases ? Math.round((completedPhases / totalPhases) * 100) : 0;
        return (
          <Card key={j.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" /> {j.title}
                </CardTitle>
                <Badge className={cn("text-[10px]", STATUS_COLORS[j.status] || "bg-gray-100")}>
                  {j.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <p className="text-xs text-muted-foreground">{j.condition}</p>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold">{pct}% · wellness {j.wellnessScore}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {(j.phases || []).length > 0 && (
                <div className="flex gap-1">
                  {j.phases!.map((p) => (
                    <div
                      key={p.id}
                      className="flex-1"
                      title={`${p.name} · ${p.status}`}
                    >
                      <div className={cn(
                        "h-2 rounded-full",
                        p.status === "COMPLETED" ? "bg-emerald-500"
                          : p.status === "ACTIVE" ? "bg-primary"
                          : "bg-muted",
                      )} />
                      <p className="text-[9px] text-muted-foreground truncate mt-1">{p.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PrescriptionsTab({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<PrescriptionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get<PrescriptionRow[]>(
        `/api/prescriptions/patient/${patientId}/view`,
      );
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }
  if (rows.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
        No prescriptions yet.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
          <Pill className="h-5 w-5 text-purple-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{r.medicationName}</p>
            <p className="text-xs text-muted-foreground">
              {r.dosage} · {r.frequency} · {r.duration}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {r.doctor?.fullName || r.therapist?.fullName || "—"}
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              {new Date(r.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AppointmentsTab({ appts }: { appts: AppointmentRow[] }) {
  if (!appts || appts.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
        No appointments yet.
      </CardContent></Card>
    );
  }
  return (
    <div className="space-y-2">
      {appts.map((a) => {
        const who = a.doctor?.fullName || a.therapist?.fullName
          || a.doctor?.user?.email || a.therapist?.user?.email || "Unknown staff";
        return (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
            <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{who}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.date).toLocaleString()} {a.consultationType ? `· ${a.consultationType}` : ""}
              </p>
            </div>
            <Badge className={cn("text-[10px]", STATUS_COLORS[a.status] || "bg-gray-100")}>
              {a.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

function HandoffsTab({ patientId }: { patientId: string }) {
  const [rows, setRows] = useState<HandoffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<HandoffRow[]>(`/api/handoff/patient/${patientId}`)
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (rows.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">
        No handoff notes for this patient.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((h) => (
        <Card key={h.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{h.fromUser?.email || "—"} → {h.toUser?.email || "—"}</span>
              </div>
              <Badge variant="outline" className="text-[10px]">{h.urgency}</Badge>
            </div>
            <p className="text-sm">{h.summary}</p>
            <p className="text-[10px] text-muted-foreground mt-2">
              {new Date(h.createdAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PharmacyTab({ patientId }: { patientId: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" /> Order medicine
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <MedicineOrderForm patientId={patientId} />
      </CardContent>
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium truncate", mono && "font-mono text-[11px]")}>{value}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PatientDetails() {
  const { role } = useAuth();
  const { id } = useParams();
  // `?tab=vitals` (or rx, journey, etc.) opens the matching tab on first
  // render — used by the Patients index page's "Assign vitals" deep link.
  const [searchParams] = useSearchParams();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const canEditClinical = role === "ADMIN" || role === "ADMIN_DOCTOR" || role === "DOCTOR";
  const canOrderMedicine = role === "ADMIN" || role === "ADMIN_DOCTOR";

  const initialTab = useMemo(() => {
    const VALID_TABS = ["overview", "vitals", "journey", "rx", "appointments", "handoffs", "pharmacy"];
    const requested = searchParams.get("tab");
    if (requested && VALID_TABS.includes(requested)) {
      // Pharmacy tab is gated on canOrderMedicine — don't deep-link to it for
      // roles that can't see it.
      if (requested === "pharmacy" && !canOrderMedicine) return "overview";
      return requested;
    }
    return "overview";
  }, [searchParams, canOrderMedicine]);

  useEffect(() => {
    if (!id) return;
    apiClient.get<PatientData>(`/api/user/patient/${id}`)
      .then(({ data }) => setPatient(data))
      .catch(() => setError("Failed to load patient details"))
      .finally(() => setLoading(false));
  }, [id]);

  if (!canEditClinical) {
    return (
      <AppLayout>
        <div className="p-6 text-center">Access denied.</div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (error || !patient) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-12 max-w-4xl text-center">
          <p className="text-rose-600 mb-4">{error || "Patient not found."}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Headless: fires once-per-day XP award when the doctor spends ≥60s here. */}
      <PatientRecordReviewTracker patientId={patient.id} />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight">
            {patient.fullName || "Unnamed patient"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {patient.user?.email} · {patient.branch?.name || "Main Clinic"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/patients/${patient.id}/timeline`}>
            Full timeline <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className={cn("grid w-full", canOrderMedicine ? "grid-cols-7" : "grid-cols-6")}>
          <TabsTrigger value="overview" className="gap-1.5"><User className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="vitals" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Vitals</TabsTrigger>
          <TabsTrigger value="journey" className="gap-1.5"><Heart className="h-3.5 w-3.5" /> Journey</TabsTrigger>
          <TabsTrigger value="rx" className="gap-1.5"><Pill className="h-3.5 w-3.5" /> Rx</TabsTrigger>
          <TabsTrigger value="appointments" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Appts</TabsTrigger>
          <TabsTrigger value="handoffs" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Handoffs</TabsTrigger>
          {canOrderMedicine && (
            <TabsTrigger value="pharmacy" className="gap-1.5"><ShoppingCart className="h-3.5 w-3.5" /> Order</TabsTrigger>
          )}
        </TabsList>

        <div className="mt-4">
          <TabsContent value="overview"><OverviewTab patient={patient} /></TabsContent>
          <TabsContent value="vitals"><VitalsTab patientId={patient.id} userId={patient.userId} /></TabsContent>
          <TabsContent value="journey"><JourneyTab userId={patient.userId} /></TabsContent>
          <TabsContent value="rx"><PrescriptionsTab patientId={patient.id} /></TabsContent>
          <TabsContent value="appointments"><AppointmentsTab appts={patient.appointments || []} /></TabsContent>
          <TabsContent value="handoffs"><HandoffsTab patientId={patient.id} /></TabsContent>
          {canOrderMedicine && (
            <TabsContent value="pharmacy"><PharmacyTab patientId={patient.id} /></TabsContent>
          )}
        </div>
      </Tabs>
      </div>
    </AppLayout>
  );
}
