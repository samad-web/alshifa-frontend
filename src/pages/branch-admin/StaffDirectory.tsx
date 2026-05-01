import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { apiClient } from "@/lib/api-client";
import { operationsApi } from "@/services/operations.service";
import { iwisApi, type AyurvedicSkill, type Proficiency, type TherapistSkill } from "@/services/iwis.service";
import { formatDate } from "@/lib/format-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, Mail, Stethoscope, Heart, UserPlus, Building2, Clock, CalendarDays, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

type Role = "DOCTOR" | "THERAPIST";

interface StaffRow {
  // Doctor.id or Therapist.id (the profile-table primary key) — used by
  // assign-patient and skill APIs that take a profile id, not a User.id.
  profileId: string;
  // User.id — used by attendance and scorecard endpoints which key on the
  // owning User row.
  userId: string | null;
  fullName: string | null;
  role: Role;
  email: string | null;
  specialization: string | null;
  qualification: string | null;
  profilePhoto: string | null;
  branchId: string | null;
  branchName: string | null;
  // Available only for the doctor variant of the list endpoint; therapists
  // currently surface no availability snapshot in the list payload.
  availability?: "AVAILABLE" | "UNAVAILABLE" | "AT_CAPACITY" | null;
  unavailableReason?: string | null;
  appointmentCount?: number;
  appointmentsToday?: number;
}

interface BlockedSlot {
  id: string;
  date: string | null;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  kind?: string | null;
  reason?: string | null;
}

interface AppointmentLite {
  id: string;
  date: string;
  status: string;
  patient?: { fullName?: string | null } | null;
}

const SKILL_LABEL: Record<AyurvedicSkill, string> = {
  ABHYANGA: "Abhyanga",
  SHIRODHARA: "Shirodhara",
  PANCHAKARMA_GENERAL: "Panchakarma",
  BASTI: "Basti",
  VIRECHANA: "Virechana",
  NASYA: "Nasya",
  KIZHI: "Kizhi",
  NJAVARA: "Njavara",
  PIZHICHIL: "Pizhichil",
  MARMA_THERAPY: "Marma",
  YOGA_THERAPY: "Yoga",
  NATUROPATHY: "Naturopathy",
};

const PROF_TONE: Record<Proficiency, string> = {
  CERTIFIED:   "bg-emerald-100 text-emerald-800 border-emerald-300",
  EXPERIENCED: "bg-primary/15 text-primary border-primary/40",
  LEARNING:    "bg-amber-100 text-amber-800 border-amber-300",
};

const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function availabilityBadge(row: StaffRow) {
  if (row.role === "THERAPIST") {
    return <Badge variant="outline" className="border-muted-foreground/30">Schedule on profile</Badge>;
  }
  if (row.availability === "AVAILABLE") {
    return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">Available</Badge>;
  }
  if (row.availability === "AT_CAPACITY") {
    return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Busy</Badge>;
  }
  if (row.availability === "UNAVAILABLE") {
    return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">On Leave</Badge>;
  }
  return <Badge variant="outline">Unknown</Badge>;
}

function initials(name: string | null) {
  if (!name) return "??";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function StaffDirectory() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const branchId = profile?.branchId ?? null;

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");

  const [openProfile, setOpenProfile] = useState<StaffRow | null>(null);
  const [blocks, setBlocks] = useState<BlockedSlot[]>([]);
  const [appointments, setAppointments] = useState<AppointmentLite[]>([]);
  const [scorecard, setScorecard] = useState<{ overallScore?: number; patientsSeenCount?: number; onTimeRate?: number; treatmentCompletionRate?: number } | null>(null);
  const [skills, setSkills] = useState<TherapistSkill[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Backend hard-pins both endpoints to req.user.branchId for BRANCH_ADMIN
        // — we still pass it explicitly so an ADMIN previewing this page sees
        // the same branch they'd see in the navbar selector.
        const [{ data: docs }, { data: thers }] = await Promise.all([
          apiClient.get<any[]>("/api/user/list-doctors", branchId ? { branchId } : undefined),
          apiClient.get<any[]>("/api/user/list-therapists", branchId ? { branchId } : undefined),
        ]);
        if (cancelled) return;
        const docRows: StaffRow[] = (docs || []).map((d: any) => ({
          profileId: d.id,
          userId: d.userId ?? null,
          fullName: d.fullName ?? null,
          role: "DOCTOR" as const,
          email: d.email ?? null,
          specialization: d.specialization ?? null,
          qualification: d.qualification ?? null,
          profilePhoto: d.profilePhoto ?? null,
          branchId: d.branchId ?? null,
          branchName: d.branchName ?? null,
          availability: d.availability ?? null,
          unavailableReason: d.unavailableReason ?? null,
          appointmentCount: d.appointmentCount ?? 0,
          appointmentsToday: d.appointmentsToday ?? 0,
        }));
        const therRows: StaffRow[] = (thers || []).map((t: any) => ({
          profileId: t.id,
          userId: t.userId ?? null,
          fullName: t.fullName ?? null,
          role: "THERAPIST" as const,
          email: t.email ?? null,
          specialization: t.specialization ?? null,
          qualification: t.qualification ?? null,
          profilePhoto: t.profilePhoto ?? null,
          branchId: t.branchId ?? null,
          branchName: t.branchName ?? null,
        }));
        setRows([...docRows, ...therRows]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load staff");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (!term) return true;
      return (r.fullName || "").toLowerCase().includes(term)
        || (r.email || "").toLowerCase().includes(term)
        || (r.specialization || "").toLowerCase().includes(term);
    });
  }, [rows, search, roleFilter]);

  // Profile panel data — fetched on demand per row.
  useEffect(() => {
    if (!openProfile) return;
    let cancelled = false;
    async function loadProfileExtras(row: StaffRow) {
      setProfileLoading(true);
      setBlocks([]);
      setAppointments([]);
      setScorecard(null);
      setSkills([]);
      try {
        // Availability blocks are looked up against the profile id — Doctor.id
        // for doctors, Therapist.id for therapists.
        const [blocksRes, apptsRes] = await Promise.all([
          apiClient.get<BlockedSlot[]>(`/api/availability/${row.profileId}`).catch(() => ({ data: [] as BlockedSlot[] })),
          row.userId
            ? apiClient.get<{ appointments?: AppointmentLite[] } | AppointmentLite[]>(
                `/api/appointments`,
                row.role === "DOCTOR"
                  ? { doctorUserId: row.userId, limit: 10 }
                  : { therapistUserId: row.userId, limit: 10 },
              ).catch(() => ({ data: [] as AppointmentLite[] }))
            : Promise.resolve({ data: [] as AppointmentLite[] }),
        ]);
        if (cancelled) return;
        setBlocks(Array.isArray(blocksRes.data) ? blocksRes.data : []);
        const apptsRaw = (apptsRes as any).data;
        setAppointments(Array.isArray(apptsRaw) ? apptsRaw.slice(0, 10) : (apptsRaw?.appointments ?? []).slice(0, 10));

        // Scorecards — branch-scoped, server enforces ownership. We pull the
        // branch list once and filter to this clinician.
        if (branchId) {
          operationsApi.getBranchScorecards(branchId)
            .then((cards) => {
              if (cancelled) return;
              const matching = cards.find((c: any) =>
                (row.role === "DOCTOR" ? c.doctorId : c.therapistId) === row.profileId
                || c.userId === row.userId,
              );
              if (matching) setScorecard(matching as any);
            })
            .catch((err) => {
              // Scorecard panel is best-effort — log but don't block the
              // sheet. The render branches gracefully on `scorecard` being null.
              console.warn('[StaffDirectory] scorecard fetch failed', err);
            });
        }

        if (row.role === "THERAPIST") {
          iwisApi.getSkills(row.profileId)
            .then((s) => { if (!cancelled) setSkills(s); })
            .catch((err) => {
              console.warn('[StaffDirectory] skills fetch failed', err);
            });
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }
    loadProfileExtras(openProfile);
    return () => { cancelled = true; };
  }, [openProfile, branchId]);

  const handleAssign = (row: StaffRow) => {
    if (row.role !== "DOCTOR") {
      toast.info("Patient assignment is currently scoped to doctors. Therapist assignment happens via Journey Builder.");
      return;
    }
    // Pre-seed the doctor selection on the AssignPatient page via query param.
    navigate(`/assign-patient?doctorId=${row.profileId}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
        <PageHeader
          title="Staff Directory"
          subtitle="Doctors and therapists assigned to your branch."
        >
          <Badge variant="outline" className="gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            {profile?.branch?.name || "Your branch"}
          </Badge>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search by name, email, specialisation"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
            {(["ALL", "DOCTOR", "THERAPIST"] as const).map((opt) => (
              <Button
                key={opt}
                variant={roleFilter === opt ? "default" : "ghost"}
                size="sm"
                onClick={() => setRoleFilter(opt)}
                className="h-8"
              >
                {opt === "ALL" ? "All" : opt === "DOCTOR" ? "Doctors" : "Therapists"}
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} of {rows.length} staff
          </span>
        </div>

        {filtered.length === 0 ? (
          <Card className="border-none shadow-sm">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
              No staff match the current filter.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((row) => {
              const Icon = row.role === "DOCTOR" ? Stethoscope : Heart;
              return (
                <Card key={`${row.role}-${row.profileId}`} className="border-none shadow-sm">
                  <CardHeader className="flex flex-row items-start gap-3 pb-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      {row.profilePhoto && <AvatarImage src={row.profilePhoto} alt={row.fullName ?? ""} />}
                      <AvatarFallback>{initials(row.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{row.fullName || "Unnamed"}</CardTitle>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Icon className="w-3 h-3" />
                          {row.role === "DOCTOR" ? "Doctor" : "Therapist"}
                        </Badge>
                        {availabilityBadge(row)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {row.specialization && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Specialisation:</span>{" "}
                        {row.specialization}
                      </p>
                    )}
                    {row.role === "DOCTOR" && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Patient load:</span>{" "}
                        {row.appointmentsToday ?? 0} today / {row.appointmentCount ?? 0} total
                      </p>
                    )}
                    {row.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{row.email}</span>
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setOpenProfile(row)}
                      >
                        View Profile
                      </Button>
                      {row.role === "DOCTOR" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleAssign(row)}
                          title="Assign a patient to this doctor"
                        >
                          <UserPlus className="w-4 h-4" />
                          Assign
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Sheet open={!!openProfile} onOpenChange={(o) => !o && setOpenProfile(null)}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            {openProfile && (
              <>
                <SheetHeader className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      {openProfile.profilePhoto && <AvatarImage src={openProfile.profilePhoto} />}
                      <AvatarFallback>{initials(openProfile.fullName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <SheetTitle>{openProfile.fullName || "Unnamed"}</SheetTitle>
                      <SheetDescription className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {openProfile.role === "DOCTOR" ? "Doctor" : "Therapist"}
                        </Badge>
                        {openProfile.specialization && (
                          <span className="text-xs">{openProfile.specialization}</span>
                        )}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-6">
                  <Tabs defaultValue="profile">
                    <TabsList className="w-full grid grid-cols-4">
                      <TabsTrigger value="profile">Profile</TabsTrigger>
                      <TabsTrigger value="schedule">Schedule</TabsTrigger>
                      <TabsTrigger value="appointments">Appointments</TabsTrigger>
                      <TabsTrigger value="performance">Performance</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-3 mt-4">
                      <DetailRow label="Email" value={openProfile.email} />
                      <DetailRow label="Specialisation" value={openProfile.specialization} />
                      <DetailRow label="Qualification" value={openProfile.qualification} />
                      <DetailRow label="Branch" value={openProfile.branchName} />
                      {openProfile.role === "DOCTOR" && (
                        <DetailRow
                          label="Availability today"
                          value={openProfile.availability === "AVAILABLE"
                            ? "Available"
                            : openProfile.availability === "AT_CAPACITY"
                              ? `Fully booked (${openProfile.appointmentsToday} appointments today)`
                              : openProfile.unavailableReason || "Unavailable"}
                        />
                      )}
                      {openProfile.role === "THERAPIST" && skills.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <p className="text-xs font-medium text-foreground uppercase tracking-wide">
                            Therapy skills
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {skills.map((s) => (
                              <Badge
                                key={s.skill}
                                variant="outline"
                                className={PROF_TONE[s.proficiency]}
                              >
                                {SKILL_LABEL[s.skill] || s.skill} · {s.proficiency.charAt(0) + s.proficiency.slice(1).toLowerCase()}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {openProfile.role === "DOCTOR" && (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full mt-4 gap-2"
                          onClick={() => handleAssign(openProfile)}
                        >
                          <UserPlus className="w-4 h-4" />
                          Assign a patient to this doctor
                        </Button>
                      )}
                    </TabsContent>

                    <TabsContent value="schedule" className="mt-4 space-y-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Read-only — only the clinician or an Admin can edit this schedule.
                      </p>
                      {profileLoading ? (
                        <div className="py-6 flex justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : blocks.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No blocked slots on file.</p>
                      ) : (
                        <ul className="space-y-2">
                          {blocks.map((b) => (
                            <li key={b.id} className="flex items-center gap-3 p-2 rounded border">
                              <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0 text-sm">
                                <div className="font-medium">
                                  {b.date
                                    ? formatDate(b.date)
                                    : `Every ${DOW_LABEL[b.dayOfWeek ?? 0]}`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {b.startTime}–{b.endTime}
                                  {b.kind && <> · {b.kind}</>}
                                  {b.reason && <> · {b.reason}</>}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TabsContent>

                    <TabsContent value="appointments" className="mt-4 space-y-3">
                      {profileLoading ? (
                        <div className="py-6 flex justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : appointments.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No recent appointments.</p>
                      ) : (
                        <ul className="space-y-2">
                          {appointments.map((a) => (
                            <li key={a.id} className="flex items-center gap-3 p-2 rounded border">
                              <ClipboardCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0 text-sm">
                                <div className="font-medium truncate">
                                  {a.patient?.fullName || "Patient"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDate(a.date)} · {a.status}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TabsContent>

                    <TabsContent value="performance" className="mt-4 space-y-3">
                      {profileLoading ? (
                        <div className="py-6 flex justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : !scorecard ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No scorecard available for this clinician yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <Stat label="Overall Score" value={scorecard.overallScore ?? "—"} />
                          <Stat label="Patients Seen" value={scorecard.patientsSeenCount ?? "—"} />
                          <Stat label="On-Time %" value={scorecard.onTimeRate != null ? `${scorecard.onTimeRate}%` : "—"} />
                          <Stat label="Completion %" value={scorecard.treatmentCompletionRate != null ? `${scorecard.treatmentCompletionRate}%` : "—"} />
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm border-b py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
