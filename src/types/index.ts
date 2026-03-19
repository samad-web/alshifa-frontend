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
