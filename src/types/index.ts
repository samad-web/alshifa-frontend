/**
 * Shared domain types — single source of truth for data shapes
 * used across pages, components, hooks, and API services.
 *
 * Replaces scattered `any` types and inline interface definitions.
 */

// ── Auth & Users ──────────────────────────────────────────────────────────────

export type AppRole =
  | 'ADMIN'
  | 'ADMIN_DOCTOR'
  | 'DOCTOR'
  | 'THERAPIST'
  | 'PATIENT'
  | 'PHARMACIST';

/** Use these constants everywhere instead of bare string literals. */
export const ROLES = {
  ADMIN:        'ADMIN'        as const,
  ADMIN_DOCTOR: 'ADMIN_DOCTOR' as const,
  DOCTOR:       'DOCTOR'       as const,
  THERAPIST:    'THERAPIST'    as const,
  PATIENT:      'PATIENT'      as const,
  PHARMACIST:   'PHARMACIST'   as const,
} satisfies Record<string, AppRole>;

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
}

export interface UserProfile {
  id: string;
  email: string;
  role: AppRole;
  branch?: Branch | null;
  branchId?: string | null;
  doctor?: DoctorProfile | null;
  therapist?: TherapistProfile | null;
  patient?: PatientProfile | null;
  pharmacist?: PharmacistProfile | null;
  createdAt: string;
}

export interface DoctorProfile {
  id: string;
  userId: string;
  fullName?: string | null;
  specialization?: string | null;
  qualification?: string | null;
  clinic?: string | null;
  yearsExperience?: number | null;
  profilePhoto?: string | null;
}

export interface TherapistProfile {
  id: string;
  userId: string;
  fullName?: string | null;
  specialization?: string | null;
  qualification?: string | null;
  yearsExperience?: number | null;
  profilePhoto?: string | null;
}

export interface PatientProfile {
  id: string;
  userId: string;
  fullName?: string | null;
  patientId?: string | null;
  age?: number | null;
  gender?: string | null;
  phoneNumber?: string | null;
  dob?: string | null;
  therapyType?: string | null;
  onboardingCompleted: boolean;
  zenPoints: number;
  branchId?: string | null;
}

export interface PharmacistProfile {
  id: string;
  userId: string;
  fullName?: string | null;
  qualification?: string | null;
}

// ── Branch ────────────────────────────────────────────────────────────────────

export interface Branch {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  createdAt: string;
}

// ── Appointments ──────────────────────────────────────────────────────────────

export type AppointmentStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'PENDING_THERAPIST_APPROVAL'
  | 'PENDING_DOCTOR_APPROVAL'
  | 'ACCEPTED';

export type ConsultationType = 'DOCTOR' | 'THERAPIST' | 'COMBINED';
export type ConsultationMode = 'OFFLINE' | 'ONLINE';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId?: string | null;
  therapistId?: string | null;
  branchId?: string | null;
  date: string;
  therapistDate?: string | null;
  status: AppointmentStatus;
  consultationType: ConsultationType;
  consultationMode: ConsultationMode;
  notes?: string | null;
  meetingLink?: string | null;
  doctorApproved: boolean;
  therapistApproved: boolean;
  notificationSent: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations (when included by the backend)
  doctor?: DoctorProfile | null;
  therapist?: TherapistProfile | null;
  patient?: PatientProfile | null;
  branch?: Branch | null;
}

export interface CreateAppointmentPayload {
  patientId?: string;
  doctorId?: string | null;
  therapistId?: string | null;
  date: string;
  consultationType?: ConsultationType;
  consultationMode?: ConsultationMode;
  branchId?: string;
  notes?: string;
  triageSessionId?: string;
  contactDetails?: {
    fullName: string;
    phoneNumber: string;
    email: string;
  };
}

export interface UpdateAppointmentPayload {
  date?: string;
  status?: AppointmentStatus;
  notes?: string;
}

export interface AvailableSlot {
  time: string;
  available: boolean;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data?: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AppointmentListResponse {
  appointments: Appointment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationPriority = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  relatedId?: string | null;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
}

// ── Pharmacy & Inventory ──────────────────────────────────────────────────────

export interface Medicine {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  type?: string | null;
  price: number;
  sku?: string | null;
  stocks?: MedicineStock[];
}

export interface MedicineStock {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  minStock: number;
  location?: string | null;
  branchId?: string | null;
  medicine?: Medicine;
}

export interface PharmacyOrder {
  id: string;
  patientId: string;
  prescriptionId?: string | null;
  totalAmount: number;
  status: string;
  urgency: string;
  notes?: string | null;
  createdAt: string;
  items: PharmacyOrderItem[];
  patient?: Pick<PatientProfile, 'fullName'>;
}

export interface PharmacyOrderItem {
  id: string;
  orderId: string;
  medicineId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  medicine?: Medicine;
}

// ── Gamification / Leaderboard ────────────────────────────────────────────────

export interface LeaderboardEntry {
  participantId: string;
  participantRole: 'DOCTOR' | 'THERAPIST';
  score: number;
  rank: number;
  metrics: {
    appointmentScore: number;
    adherenceScore: number;
    responseTimeScore: number;
    successRateScore: number;
    consistencyScore: number;
  };
  calculationDate: string;
  // Joined
  fullName?: string;
  specialization?: string;
}

export interface LeaderboardConfig {
  id: string;
  appointmentWeight: number;
  adherenceWeight: number;
  responseTimeWeight: number;
  successRateWeight: number;
  consistencyWeight: number;
  targetAppointments: number;
  targetAdherence: number;
  targetSuccessRate: number;
  targetResponseTime: number;
  isActive: boolean;
}

// ── Gamification: Badges ─────────────────────────────────────────────────────

export type BadgeTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  criteria: Record<string, unknown>;
  earned: boolean;
  awardedAt: string | null;
}

// ── Gamification: Streaks ───────────────────────────────────────────────────

export interface ClinicianStreak {
  id: string;
  participantId: string;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakMultiplier: number;
  graceUsedThisWeek: boolean;
}

// ── Gamification: Branch Competition ────────────────────────────────────────

export interface BranchLeaderboardEntry {
  branchId: string;
  branchName: string;
  clinicianCount: number;
  avgScore: number;
  totalAppointments: number;
  rank: number;
}

export interface BranchCompetition {
  id: string;
  title: string;
  description?: string;
  metric: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  entries: BranchCompetitionEntry[];
}

export interface BranchCompetitionEntry {
  id: string;
  branchId: string;
  branch: { id: string; name: string };
  score: number;
  rank: number | null;
}

// ── Gamification: Zen Points / Patient ──────────────────────────────────────

export interface ZenLevel {
  name: string;
  tier: number;
  minPoints: number;
  nextLevel: string | null;
  nextAt: number | null;
  progress: number;
}

export interface ZenProfile {
  patientId: string;
  zenPoints: number;
  level: ZenLevel;
  streak: { current: number; longest: number; lastActive: string | null };
  recentActivity: { action: string; points: number; date: string }[];
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  type: string;
  pointReward: number;
  completed: boolean;
  completedAt: string | null;
}

export interface SocialProof {
  peerActivityPercent: number;
  activeToday: number;
  totalPatients: number;
  avgStreakDays: number;
  avgZenPoints: number;
  message: string;
}

// ── Gamification: Analytics ─────────────────────────────────────────────────

export interface GamificationAnalytics {
  engagement: {
    totalClinicians: number;
    activelyCompeting: number;
    competitionRate: number;
    activeStreaks: number;
    streakRate: number;
    totalBadgesAwarded: number;
    unresolvedAnomalies: number;
  };
  scoreTrend: { week: string; avgScore: number; sampleSize: number }[];
  badgeDistribution: { code: string; name: string; tier: BadgeTier; icon: string; awardedCount: number }[];
  patientStats: {
    totalPatients: number;
    activePatients: number;
    engagementRate: number;
    avgZenPoints: number;
    maxZenPoints: number;
    avgStreakDays: number;
    longestStreak: number;
    totalChallengesCompleted: number;
  };
}

// ── Retention Checklist ───────────────────────────────────────────────────────

export type RetentionCategory =
  | 'GENERAL_ROUTINE'
  | 'DIET'
  | 'YOGA_EXERCISE'
  | 'THERAPY_HOME'
  | 'OTHERS';

export type RetentionStatus = 'COMPLETED' | 'PARTIAL' | 'NOT_FOLLOWED';

export interface RetentionChecklistItem {
  category: RetentionCategory;
  status: RetentionStatus;
  notes?: string | null;
}

export interface RetentionChecklist {
  id: string;
  appointmentId: string;
  patientId: string;
  clinicianId: string;
  clinicianRole: string;
  items: RetentionChecklistItem[];
  branchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const RETENTION_CATEGORY_LABELS: Record<RetentionCategory, string> = {
  GENERAL_ROUTINE: 'General Routine',
  DIET:            'Diet',
  YOGA_EXERCISE:   'Yoga / Guided Exercises',
  THERAPY_HOME:    'Therapy at Home',
  OTHERS:          'Others',
};

export const RETENTION_STATUS_CONFIG: Record<RetentionStatus, { label: string; color: string; bg: string }> = {
  COMPLETED:    { label: 'Completed',    color: 'text-wellness',   bg: 'bg-wellness/10 border-wellness/30' },
  PARTIAL:      { label: 'Partial',      color: 'text-attention',  bg: 'bg-attention/10 border-attention/30' },
  NOT_FOLLOWED: { label: 'Not Followed', color: 'text-risk',       bg: 'bg-risk/10 border-risk/30' },
};

// ── Prescriptions ─────────────────────────────────────────────────────────────

export interface Prescription {
  id: string;
  patientId: string;
  doctorId?: string | null;
  therapistId?: string | null;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string | null;
  fileUrl?: string | null;
  videoUrl?: string | null;
  totalQuantity: number;
  createdAt: string;
  patient?: PatientProfile;
  doctor?: DoctorProfile;
}

// ── Auth responses ────────────────────────────────────────────────────────────

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  profile: UserProfile;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
}

// ── Billing & Invoices ───────────────────────────────────────────────────────

export interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface Invoice {
    id: string;
    invoiceNumber?: string;
    patientId: string;
    appointmentId?: string;
    status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    dueDate?: string;
    paidAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    items: InvoiceItem[];
    patient?: { fullName: string; phoneNumber?: string; patientId?: string };
    appointment?: { date: string; consultationType: string };
    payments?: Payment[];
}

export interface Payment {
    id: string;
    invoiceId: string;
    amount: number;
    method: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    transactionId?: string;
    paidAt?: string;
    createdAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// NEW FEATURE TYPES
// ══════════════════════════════════════════════════════════════════════════════

// ── Feature 4: Resource Sharing ─────────────────────────────────────────────

export type SharingStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

export interface ResourceSharingEntry {
  id: string;
  userId: string;
  user?: { email: string; doctor?: DoctorProfile; therapist?: TherapistProfile };
  fromBranchId: string;
  fromBranch?: Branch;
  toBranchId: string;
  toBranch?: Branch;
  date: string;
  startTime: string;
  endTime: string;
  status: SharingStatus;
  reason?: string;
  createdAt: string;
}

// ── Feature 6: Centralized Inventory ────────────────────────────────────────

export type TransferStatus = 'PENDING' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'REJECTED';

export interface CentralizedInventoryItem {
  medicine: Medicine;
  branches: { branchId: string; branchName: string; totalQty: number; expiringCount: number }[];
  totalStock: number;
}

export interface StockTransferEntry {
  id: string;
  medicineId: string;
  medicine?: Medicine;
  fromBranch?: Branch;
  toBranch?: Branch;
  quantity: number;
  status: TransferStatus;
  requestedBy: string;
  notes?: string;
  createdAt: string;
}

// ── Feature 7: Staff Activity Feed ──────────────────────────────────────────

export type StaffPresenceStatus = 'ONLINE' | 'IN_CONSULTATION' | 'ON_BREAK' | 'IDLE' | 'OFFLINE';

export interface StaffActivityEntry {
  userId: string;
  fullName: string;
  role: AppRole;
  status: StaffPresenceStatus;
  currentActivity?: string;
  branchName?: string;
  lastSeen: string;
  profilePhoto?: string;
}

// ── Feature 8: Performance Scorecards ───────────────────────────────────────

export interface PerformanceScorecard {
  id: string;
  clinicianId: string;
  clinicianRole: AppRole;
  period: string;
  periodType: string;
  patientsSeenCount: number;
  avgConsultationMins: number;
  avgPatientRating: number;
  noShowRate: number;
  treatmentCompletionRate: number;
  prescriptionAccuracy: number;
  onTimeRate: number;
  overallScore: number;
  rank?: number;
  generatedAt: string;
  fullName?: string;
}

// ── Feature 9: Attendance ───────────────────────────────────────────────────

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'LEAVE';

export interface StaffAttendanceEntry {
  id: string;
  userId: string;
  fullName?: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  scheduledStart?: string;
  status: AttendanceStatus;
  lateMinutes: number;
}

export interface AttendanceStats {
  presentDays: number;
  lateDays: number;
  absentDays: number;
  avgLateMinutes: number;
  totalDays: number;
}

// ── Feature 13: Staff Skill Matrix ──────────────────────────────────────────

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface StaffSkillEntry {
  id: string;
  userId: string;
  skillType: string;
  skillName: string;
  proficiency: SkillLevel;
  certifiedAt?: string;
  expiresAt?: string;
  isVerified: boolean;
}

export interface SkillMatrixRow {
  userId: string;
  fullName: string;
  role: AppRole;
  skills: StaffSkillEntry[];
}

// ── Feature 14: XP & Level System ───────────────────────────────────────────

export interface ClinicianXPProfile {
  totalXP: number;
  level: number;
  title: string;
  nextLevel?: { level: number; title: string; xpRequired: number };
  xpToNext: number;
  progress: number;
}

export interface XPTransaction {
  id: string;
  action: string;
  xpAmount: number;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface XPLeaderboardEntry {
  userId: string;
  fullName: string;
  totalXP: number;
  level: number;
  title: string;
  rank: number;
}

// ── Feature 15: Seasonal Challenges ─────────────────────────────────────────

export interface SeasonalChallengeEntry {
  id: string;
  title: string;
  description: string;
  icon: string;
  metric: string;
  target: number;
  startDate: string;
  endDate: string;
  rewardXP: number;
  rewardPoints: number;
  progress?: { currentValue: number; completed: boolean; completedAt?: string };
}

// ── Feature 16: Team Quests ─────────────────────────────────────────────────

export interface TeamQuestEntry {
  id: string;
  branchId: string;
  branchName?: string;
  title: string;
  description: string;
  icon: string;
  metric: string;
  target: number;
  currentValue: number;
  completed: boolean;
  startDate: string;
  endDate: string;
  rewardXP: number;
}

// ── Feature 17: Achievement Showcase ────────────────────────────────────────

export interface AchievementShowcase {
  userId: string;
  fullName: string;
  badges: Badge[];
  level: number;
  title: string;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
}

// ── Feature 18: Reward Store ────────────────────────────────────────────────

export interface RewardItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  pointsCost: number;
  stock?: number | null;
  isActive: boolean;
}

export type RedemptionStatus = 'PENDING' | 'APPROVED' | 'FULFILLED' | 'REJECTED';

export interface RewardRedemption {
  id: string;
  userId: string;
  reward: RewardItem;
  pointsSpent: number;
  status: RedemptionStatus;
  createdAt: string;
  processedAt?: string;
}

// ── Feature 19: Mentor Sessions ─────────────────────────────────────────────

export interface MentorSessionEntry {
  id: string;
  mentorId: string;
  mentorName?: string;
  menteeId: string;
  menteeName?: string;
  topic: string;
  notes?: string;
  durationMins: number;
  date: string;
  status: string;
}

export interface MentorStats {
  totalSessions: number;
  totalMentees: number;
  xpEarned: number;
}

// ── Feature 21: Health Quests ───────────────────────────────────────────────

export type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'ABANDONED';

export interface HealthQuestTask {
  title: string;
  type: string;
  target: number;
}

export interface HealthQuest {
  id: string;
  title: string;
  description: string;
  icon: string;
  tasks: HealthQuestTask[];
  pointReward: number;
  durationDays: number;
  difficulty: string;
  progress?: {
    status: QuestStatus;
    tasksCompleted: { taskIndex: number; completedAt: string }[];
    startedAt: string;
  };
}

// ── Feature 22: Health Avatar ───────────────────────────────────────────────

export interface HealthAvatarState {
  id: string;
  patientId: string;
  avatarType: string;
  name: string;
  level: number;
  health: number;
  happiness: number;
  xp: number;
  stageName: string;
  nextLevel?: { level: number; stageName: string; xpRequired: number };
  xpToNext: number;
  progress: number;
  appearance: Record<string, unknown>;
  lastFedAt: string;
}

// ── Feature 23: Family Leaderboard ──────────────────────────────────────────

export interface PatientFamilyEntry {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  totalZenPoints: number;
  members: {
    patientId: string;
    fullName: string;
    zenPoints: number;
    streak: number;
    avatarLevel: number;
    role: string;
  }[];
}

// ── Feature 24: Referral Gamification ───────────────────────────────────────

export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  currentTier: string;
  nextTier?: string;
  referralsToNext: number;
  totalPointsEarned: number;
}

// ── Feature 25: Enhanced Social Proof ───────────────────────────────────────

export interface EnhancedSocialProof extends SocialProof {
  percentileRank: number;
  motivationalMessage: string;
}

export interface StreakMilestone {
  days: number;
  name: string;
  reward: number;
  achieved: boolean;
}

// ── Feature 26: Health Content ──────────────────────────────────────────────

export interface HealthContentEntry {
  id: string;
  title: string;
  description: string;
  type: string;
  contentUrl: string;
  thumbnail?: string;
  category?: string;
  requiredLevel: number;
  requiredPoints: number;
  isLocked: boolean;
  unlockedAt?: string;
}

// ── Feature 33: Announcements ───────────────────────────────────────────────

export type AnnouncementPriority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

export interface AnnouncementEntry {
  id: string;
  authorId: string;
  authorName?: string;
  branchId?: string;
  branchName?: string;
  title: string;
  message: string;
  priority: AnnouncementPriority;
  targetRoles: string[];
  isPinned: boolean;
  isRead: boolean;
  expiresAt?: string;
  createdAt: string;
}

// ── Feature 35: Handoff Notes ───────────────────────────────────────────────

export interface HandoffNoteEntry {
  id: string;
  patientId: string;
  patientName?: string;
  fromClinicianId: string;
  fromClinicianName?: string;
  toClinicianId?: string;
  toClinicianName?: string;
  toBranchId?: string;
  toBranchName?: string;
  summary: string;
  currentMedications?: { name: string; dosage: string; frequency: string }[];
  activeConditions: string[];
  nextSteps?: string;
  urgency: string;
  isRead: boolean;
  createdAt: string;
}

// ── Feature 37: Patient Portal ──────────────────────────────────────────────

export interface PatientPortalDashboard {
  upcomingAppointments: Appointment[];
  recentPrescriptions: Prescription[];
  treatmentProgress: {
    activeJourneys: number;
    completedJourneys: number;
    wellnessScore: number;
  };
  unreadNotifications: number;
  zenProfile: { zenPoints: number; level: ZenLevel; streak: { current: number; longest: number } };
  avatar?: HealthAvatarState;
  recentDocuments: { id: string; fileName: string; category: string; createdAt: string }[];
}

// ── Feature 39: Visit Summary ───────────────────────────────────────────────

export interface VisitSummaryEntry {
  id: string;
  appointmentId: string;
  patientId: string;
  clinicianId: string;
  clinicianName: string;
  diagnosis?: string;
  treatmentNotes?: string;
  prescriptions?: { medication: string; dosage: string; frequency: string; duration: string }[];
  exercisePlan?: { exercise: string; sets: number; reps: number; frequency: string }[];
  dietaryAdvice?: string;
  nextSteps?: string;
  followUpDate?: string;
  sentToPatient: boolean;
  createdAt: string;
}
