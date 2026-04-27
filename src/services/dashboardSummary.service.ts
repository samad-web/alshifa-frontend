import { apiClient } from "@/lib/api-client";
import type { TodoSummary } from "./todos.service";

// ── Shared ────────────────────────────────────────────────────────────────

export interface Greeting {
  name: string;
  branch?: string | null;
  role: string;
  scope?: string;
}

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  totalXP: number;
  level: number;
  title: string;
  fullName?: string;
}

export interface XPProfile {
  totalXP: number;
  level: number;
  title: string;
  nextLevel?: { level: number; title: string; minXP: number } | null;
  xpToNext?: number;
  progressPercent?: number;
}

export interface PatientRef {
  id: string;
  fullName: string;
  patientId: string | null;
}

// ── Doctor ────────────────────────────────────────────────────────────────

export interface DoctorAppointmentCard {
  id: string;
  date: string;
  status: string;
  consultationMode: string;
  meetingLink: string | null;
  patient: PatientRef;
  triageSession?: {
    id: string;
    urgencyLevel: string | null;
    suggestedSpecialty: string | null;
    compositeScore?: number | null;
    redFlagsMatched?: string[];
  } | null;
}

export interface CareGapAlert {
  id: string;
  patient: PatientRef;
  type: string;
  severity: string;
  suggestedSpecialty?: string | null;
  daysSince: number;
}

export interface RosterEntry {
  journeyId: string;
  title: string;
  condition: string;
  wellnessScore: number;
  patient: PatientRef;
  currentPhase: string | null;
}

export interface GroupSessionTask {
  id: string;
  title: string;
  sessionType: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'OPEN' | 'FULL' | 'COMPLETED' | 'CANCELLED';
  maxCapacity: number;
  enrolledCount: number;
  room: { id: string; name: string } | null;
  therapist: { id: string; fullName: string | null } | null;
  branchId: string;
}

export interface DoctorDashboardSummary {
  greeting: Greeting;
  stats: {
    appointmentsToday: number;
    pendingApproval: number;
    patientsAtRisk: number;
    activePrescriptions: number;
    activeJourneys: number;
    leaderboardRank: number | null;
  };
  appointments: {
    pending: DoctorAppointmentCard[];
    today: DoctorAppointmentCard[];
  };
  careGaps: CareGapAlert[];
  roster: RosterEntry[];
  groupSessions: GroupSessionTask[];
  todos: TodoSummary;
  performance: {
    xp: XPProfile | null;
    rank: LeaderboardEntry | null;
    monthlyCompleted: number;
    monthlyConsults: number;
  };
}

// ── Therapist ─────────────────────────────────────────────────────────────

export interface TherapistDashboardSummary {
  greeting: Greeting;
  stats: {
    sessionsToday: number;
    pendingApproval: number;
    activePatients: number;
    prescriptionsDueReview: number;
    leaderboardRank: number | null;
  };
  sessions: {
    pending: DoctorAppointmentCard[];
    today: DoctorAppointmentCard[];
  };
  exercisePrescriptions: {
    id: string;
    patient: { id: string; fullName: string } | null;
    title?: string;
    prescribedAt: string;
    completionRate: number | null;
  }[];
  todos: TodoSummary;
  performance: {
    xp: XPProfile | null;
    rank: LeaderboardEntry | null;
    completedThisMonth: number;
  };
}

// ── Admin Doctor ──────────────────────────────────────────────────────────

// Staff row on the ADMIN_DOCTOR dashboard. Admin doctor is a program
// supervisor — the row carries BOTH clinical throughput (completion / no-
// show) and gamification signals (XP / level / title) so they get full
// oversight visibility in a single surface.
export interface StaffRow {
  id: string;
  name: string;
  role: string;
  totalXP: number;
  level: number;
  title: string;
  appointmentsToday: number;
  pendingApprovals: number;
  patientLoad: number;
  monthlyCompleted: number;
  monthlyTotal: number;
  completionRate: number | null;
  noShowRate: number | null;
}

export interface AdminDoctorTopPerformer {
  userId: string;
  name: string;
  role: string;
  monthlyCompleted: number;
  completionRate: number | null;
}

export interface WorkloadBucket {
  label: string;
  count: number;
}

export interface EscalationItem {
  id: string;
  type: string;
  patient: { id: string; fullName: string } | null;
  urgency: string;
  suggestedSpecialty: string | null;
  createdAt: string;
}

export interface AssignedByMeRow {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueDate: string | null;
  xpReward: number;
  isOverdue: boolean;
  assignee: { id: string; name: string };
}

export interface AdminDoctorDashboardSummary {
  greeting: Greeting;
  stats: {
    totalAppointmentsToday: number;
    approvalBacklog: number;
    openCareGaps: number;
    staffOnDuty: number;
    unassignedPatients: number;
    activeJourneys: number;
    criticalPatients?: number;
  };
  staff: StaffRow[];
  escalations: EscalationItem[];
  todos: TodoSummary;
  assignedByMe: AssignedByMeRow[];
  // Clinical throughput analytics (top performers, workload distribution,
  // monthly completion). Coexists with `gamification` below.
  analytics: {
    topPerformers: AdminDoctorTopPerformer[];
    workloadDistribution: WorkloadBucket[];
    todoCompletionRate: number | null;
    monthlyCompleted: number;
    monthlyTotal: number;
    monthlyCompletionRate: number | null;
  };
  // Gamification oversight — admin doctor supervises the engagement program
  // (leaderboards, XP distribution) without participating in it themselves.
  gamification: {
    topPodium: LeaderboardEntry[];
    xpDistribution: { level: number; count: number }[];
    todoCompletionRate: number | null;
  };
}

// ── Admin ─────────────────────────────────────────────────────────────────

export interface BranchHealthRow {
  id: string;
  name: string;
  isActive: boolean;
  activePatients: number;
  staffOnDuty: number;
  appointmentsToday: number;
  revenueThisMonth: number;
  bedsAvailable: number | null;
  bedsTotal: number | null;
}

export interface AttendanceRow {
  id: string;
  name: string;
  role: string;
  branch: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: string;
}

export interface AdminDashboardSummary {
  greeting: Greeting;
  systemHealth: {
    status: string;
    unresolvedAnomalies: number;
    pendingRewards: number;
    criticalPatients?: number;
    criticalPatientsHigh?: number;
    criticalPatientsMedium?: number;
    criticalPatientsLow?: number;
  };
  stats: {
    totalPatients: number;
    newPatientsToday: number;
    appointmentsToday: number;
    revenueThisMonth: number;
    activeStaff: number;
    outstandingInvoicesCount: number;
    outstandingInvoicesTotal: number;
  };
  branches: BranchHealthRow[];
  attendance: AttendanceRow[];
  todos: TodoSummary;
  assignedByMe: AssignedByMeRow[];
}

// ── API ───────────────────────────────────────────────────────────────────

export const dashboardSummaryApi = {
  doctor(branchId?: string) {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    return apiClient.get<DoctorDashboardSummary>(`/api/dashboards/doctor/summary${qs}`).then(r => r.data);
  },
  therapist(branchId?: string) {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    return apiClient.get<TherapistDashboardSummary>(`/api/dashboards/therapist/summary${qs}`).then(r => r.data);
  },
  adminDoctor(branchId?: string) {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    return apiClient.get<AdminDoctorDashboardSummary>(`/api/dashboards/admin-doctor/summary${qs}`).then(r => r.data);
  },
  admin(branchId?: string) {
    const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
    return apiClient.get<AdminDashboardSummary>(`/api/dashboards/admin/summary${qs}`).then(r => r.data);
  },
};

export default dashboardSummaryApi;
