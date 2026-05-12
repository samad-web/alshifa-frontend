// ADMIN_DOCTOR's "My Patients" view — card grid of all branch patients
// with a right-side vitals drawer. Replaces the old Patient Roster /
// Tasks / Performance Snapshot stack. Embedded inside DoctorDashboard.tsx
// (only when role === ADMIN_DOCTOR) so the existing /doctor route still
// renders the full clinician dashboard for DOCTOR.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  LineChart, Line, ResponsiveContainer,
} from "recharts";
import {
  Search, X, Users, ArrowRight, ChevronLeft, ChevronRight,
  Activity, Pill, Salad, Calendar, ExternalLink, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";

// ── Types matching the new backend payloads ────────────────────────────────

interface PatientSummary {
  id: string;
  fullName: string | null;
  patientId: string | null;
  profilePhoto: string | null;
  gender: string | null;
  age: number | null;
  assignedDoctorName: string | null;
  lastAppointmentDate: string | null;
  daysSinceLastAppointment: number | null;
  isActive: boolean;
  wellnessScore: number | null;
}

interface PatientListResponse {
  data: {
    patients: PatientSummary[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
}

interface PatientFullDetails {
  patient: {
    id: string;
    name: string | null;
    patientId: string | null;
    email: string | null;
    phone: string | null;
    dob: string | null;
    gender: string | null;
    bloodGroup: string | null;
    profilePhoto: string | null;
    address: string | null;
  };
  vitals: { type: string; value: number; unit: string; recordedAt: string }[];
  dailyCheckIns: { id: string; painLevel: number; mood: string; sleepHours: number; createdAt: string }[];
  activePrescriptions: { id: string; medicationName: string; dosage: string; frequency: string; duration: string }[];
  activeDietPrescription: { id: string; title: string; doshaTarget: string | null; isActive: boolean } | null;
  treatmentJourney: {
    id: string; title: string; condition: string; currentPhase: string | null; progress: number; wellnessScore: number;
  } | null;
  lastAppointment: { id: string; date: string; status: string; notes: string | null; doctor: { fullName: string | null } | null } | null;
  upcomingAppointment: { id: string; date: string; status: string; consultationType: string; doctor: { fullName: string | null } | null } | null;
  wellnessScore: { current: number | null; trend: "improving" | "stable" | "declining" };
  assignedDoctor: { id: string; fullName: string | null; specialization: string | null } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function avatarTone(seed: string): string {
  // Deterministic teal-tinted pastel keyed off the patient's name so a card
  // always renders the same colour across reloads.
  const sum = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tones = [
    "bg-teal-100 text-teal-700",
    "bg-emerald-100 text-emerald-700",
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
  ];
  return tones[sum % tones.length];
}

function lastSeenLabel(days: number | null): string {
  if (days == null) return "Never";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 86400000));
}

// ── Patient card ───────────────────────────────────────────────────────────

interface AdminPatientCardProps {
  patient: PatientSummary;
  onClick: () => void;
}

export function AdminPatientCard({ patient, onClick }: AdminPatientCardProps) {
  const wellness = patient.wellnessScore ?? 0;
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:border-teal-500 hover:shadow-md transition-all rounded-2xl"
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {patient.profilePhoto ? (
            <img
              src={patient.profilePhoto}
              alt={patient.fullName ?? ""}
              className="w-12 h-12 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${avatarTone(patient.fullName ?? "?")}`}
            >
              {initials(patient.fullName)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{patient.fullName || "Unnamed"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              ID: {patient.patientId || "—"}
            </p>
            {patient.assignedDoctorName && (
              <p className="text-[11px] text-muted-foreground truncate">
                Dr. {patient.assignedDoctorName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={
              "w-2 h-2 rounded-full " +
              (patient.isActive ? "bg-emerald-500" : "bg-slate-300")
            }
          />
          <span className="text-[11px] text-muted-foreground">
            {patient.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {patient.wellnessScore != null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Wellness</span>
              <span className="font-semibold tabular-nums">{wellness}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-600 transition-all"
                style={{ width: `${wellness}%` }}
              />
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Last seen: {lastSeenLabel(patient.daysSinceLastAppointment)}
        </p>
      </CardContent>
    </Card>
  );
}

// ── Vitals drawer ──────────────────────────────────────────────────────────

function VitalsDrawer({
  open, onOpenChange, patientId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string | null;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<PatientFullDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !patientId) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: resp } = await apiClient.get<{ data: PatientFullDetails }>(
          `/api/patients/${patientId}/full-details`,
        );
        if (!cancelled) setData(resp.data);
      } catch (err: any) {
        if (!cancelled) toast.error(err?.message || "Failed to load patient details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, patientId]);

  const trendIcon = data?.wellnessScore.trend === "improving" ? TrendingUp
    : data?.wellnessScore.trend === "declining" ? TrendingDown
    : Minus;
  const TrendIcon = trendIcon;
  const trendColor = data?.wellnessScore.trend === "improving" ? "text-emerald-600"
    : data?.wellnessScore.trend === "declining" ? "text-rose-600"
    : "text-amber-600";

  // 7-day painLevel inverted to wellness (10→0 maps to 0→100). Oldest first
  // for left-to-right rendering.
  const wellnessTrendData = (data?.dailyCheckIns ?? [])
    .slice()
    .reverse()
    .map((c, i) => ({
      idx: i,
      score: Math.max(0, Math.min(100, 100 - c.painLevel * 10)),
    }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[600px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="text-base">Patient Details</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 mt-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : data ? (
          <div className="mt-4 space-y-5">
            {/* Header */}
            <div className="flex items-start gap-3">
              {data.patient.profilePhoto ? (
                <img
                  src={data.patient.profilePhoto}
                  alt={data.patient.name ?? ""}
                  className="w-14 h-14 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className={`w-14 h-14 rounded-full flex items-center justify-center font-semibold text-base shrink-0 ${avatarTone(data.patient.name ?? "?")}`}>
                  {initials(data.patient.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-base truncate">{data.patient.name || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">
                  ID: {data.patient.patientId || "—"}
                </p>
                {data.assignedDoctor?.fullName && (
                  <p className="text-xs text-muted-foreground">
                    Dr. {data.assignedDoctor.fullName}
                    {data.assignedDoctor.specialization && ` · ${data.assignedDoctor.specialization}`}
                  </p>
                )}
                <Link
                  to={`/patients/${data.patient.id}/timeline`}
                  className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline mt-1"
                  onClick={() => onOpenChange(false)}
                >
                  View Full Timeline <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Patient details */}
            <Section title="Patient Details">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <DetailRow label="DOB" value={formatDate(data.patient.dob)} />
                <DetailRow
                  label="Age"
                  value={ageFromDob(data.patient.dob) ? `${ageFromDob(data.patient.dob)} yrs` : "—"}
                />
                <DetailRow label="Gender" value={data.patient.gender || "—"} />
                <DetailRow label="Blood Group" value={data.patient.bloodGroup || "—"} />
                <DetailRow label="Phone" value={data.patient.phone || "—"} />
                <DetailRow label="Email" value={data.patient.email || "—"} />
              </div>
              {data.patient.address && (
                <p className="text-xs text-muted-foreground mt-2">📍 {data.patient.address}</p>
              )}
            </Section>

            {/* Current Vitals */}
            <Section title="Current Vitals">
              {data.vitals.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No vitals logged.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {data.vitals.slice(0, 4).map((v, i) => (
                    <div key={i} className="rounded-lg border bg-secondary/30 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {v.type.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-sm font-bold">
                        {v.value}{" "}
                        <span className="text-[10px] text-muted-foreground">{v.unit}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(v.recordedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Wellness Trend */}
            <Section title="Wellness Trend (7 days)">
              {wellnessTrendData.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Not enough data.</p>
              ) : (
                <>
                  <div className="h-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={wellnessTrendData}>
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#0D6E6E"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className={"text-xs flex items-center gap-1 mt-1 " + trendColor}>
                    <TrendIcon className="w-3 h-3" />
                    {data.wellnessScore.trend === "improving" ? "Improving"
                      : data.wellnessScore.trend === "declining" ? "Declining"
                      : "Stable"}
                    {data.wellnessScore.current != null && (
                      <span className="text-muted-foreground ml-1">
                        · current {data.wellnessScore.current}
                      </span>
                    )}
                  </p>
                </>
              )}
            </Section>

            {/* Active Treatment */}
            <Section title="Active Treatment">
              {data.treatmentJourney ? (
                <>
                  <p className="text-sm font-medium">{data.treatmentJourney.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Phase: {data.treatmentJourney.currentPhase || "—"}
                  </p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-teal-600 transition-all"
                      style={{ width: `${data.treatmentJourney.progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {data.treatmentJourney.progress}% complete
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">No active journey.</p>
              )}
            </Section>

            {/* Active Prescriptions */}
            <Section title="Active Prescriptions" icon={Pill}>
              {data.activePrescriptions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No active prescriptions.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.activePrescriptions.slice(0, 5).map((p) => (
                    <li key={p.id} className="text-sm">
                      <span className="font-medium">{p.medicationName}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        — {p.dosage}, {p.frequency}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {data.activePrescriptions.length > 5 && (
                <button
                  onClick={() => { onOpenChange(false); navigate(`/patients/${data.patient.id}/timeline`); }}
                  className="text-xs text-teal-700 hover:underline mt-2"
                >
                  View all →
                </button>
              )}
            </Section>

            {/* Active Diet */}
            <Section title="Active Diet Plan" icon={Salad}>
              {data.activeDietPrescription ? (
                <>
                  <p className="text-sm font-medium">{data.activeDietPrescription.title}</p>
                  {data.activeDietPrescription.doshaTarget && (
                    <p className="text-xs text-muted-foreground">
                      Dosha: {data.activeDietPrescription.doshaTarget}
                    </p>
                  )}
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px] bg-emerald-50 text-emerald-800 border-emerald-200"
                  >
                    Active
                  </Badge>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">No diet plan assigned.</p>
              )}
            </Section>

            {/* Appointments */}
            <Section title="Appointments" icon={Calendar}>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Last appointment
                  </p>
                  {data.lastAppointment ? (
                    <p>
                      {formatDate(data.lastAppointment.date)} ·{" "}
                      Dr. {data.lastAppointment.doctor?.fullName || "—"}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">None on record.</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Next appointment
                  </p>
                  {data.upcomingAppointment ? (
                    <p>
                      {formatDate(data.upcomingAppointment.date)} ·{" "}
                      Dr. {data.upcomingAppointment.doctor?.fullName || "—"} ·{" "}
                      {data.upcomingAppointment.consultationType}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No upcoming appointment.</p>
                  )}
                </div>
              </div>
            </Section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title, icon: Icon, children,
}: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MyPatientsAdminView() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PatientListResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page, limit: 20 };
        if (debounced.trim()) params.search = debounced.trim();
        const { data: resp } = await apiClient.get<PatientListResponse>(
          "/api/patients/my-patients",
          params as Record<string, string | number | boolean>,
        );
        if (!cancelled) setData(resp.data);
      } catch (err: any) {
        if (!cancelled) toast.error(err?.message || "Failed to load patients");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debounced, page]);

  // Reset page when search changes.
  useEffect(() => { setPage(1); }, [debounced]);

  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;

  const handleCardClick = (id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header + count */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-teal-700" /> My Patients
          </h1>
          <p className="text-sm text-muted-foreground">
            Branch-wide patient list — tap any card to view vitals.
          </p>
        </div>
        <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200">
          Total: {total}
        </Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or patient ID..."
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : (data?.patients.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground space-y-2">
            <Users className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm font-medium text-foreground">
              {debounced ? `No patients found matching "${debounced}"` : "No patients yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data!.patients.map((p) => (
              <AdminPatientCard
                key={p.id}
                patient={p}
                onClick={() => handleCardClick(p.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((n) => Math.max(1, n - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                Page {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <VitalsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        patientId={selectedId}
      />

      {/* Hidden link to keep ExternalLink import meaningful for future actions. */}
      <span className="hidden">
        <ExternalLink />
        <Activity />
      </span>
    </div>
  );
}
