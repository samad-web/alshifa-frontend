/**
 * IWIS Competitor Features API service
 *
 * Covers features 0-6 from IWIS_Competitor_Feature_Additions.md:
 *   0. Branch capacity
 *   1. Therapy rooms
 *   2. Diet prescriptions
 *   3. Clinical photos
 *   4. Therapist skills / matching
 *   5. Treatment packages
 *   6. Group sessions
 */
import apiClient from '@/lib/api-client';

// ── Shared types ────────────────────────────────────────────────────────────
export type TherapyRoomType = 'SHIRODHARA' | 'ABHYANGA' | 'PANCHAKARMA_GENERAL' | 'STEAM' | 'CONSULTATION' | 'GROUP';
export type DoshaType = 'VATA' | 'PITTA' | 'KAPHA' | 'TRIDOSHA';
export type DietCategory = 'SATTVIC' | 'RAJASIC' | 'TAMASIC';
export type MealTime = 'MORNING_EMPTY' | 'BREAKFAST' | 'MID_MORNING' | 'LUNCH' | 'EVENING' | 'DINNER' | 'BEDTIME';
export type PhotoCategory = 'SKIN_CONDITION' | 'SWELLING_OEDEMA' | 'WOUND_HEALING' | 'WEIGHT_CHANGE' | 'GENERAL_PROGRESS';
export type PhotoStage = 'BEFORE' | 'DURING' | 'AFTER';
export type AyurvedicSkill =
  'ABHYANGA' | 'SHIRODHARA' | 'PANCHAKARMA_GENERAL' | 'BASTI' | 'VIRECHANA' |
  'NASYA' | 'KIZHI' | 'NJAVARA' | 'PIZHICHIL' | 'MARMA_THERAPY' | 'YOGA_THERAPY' | 'NATUROPATHY';
export type Proficiency = 'CERTIFIED' | 'EXPERIENCED' | 'LEARNING';
export type EnrolmentStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'PAUSED';
export type GroupSessionStatus = 'OPEN' | 'FULL' | 'COMPLETED' | 'CANCELLED';

export interface BranchCapacity {
  id: string; name: string;
  totalBeds: number | null; availableBeds: number | null;
  totalRooms: number | null; totalTherapyRooms: number | null;
  ipdEnabled: boolean; opdEnabled: boolean;
  operatingHoursFrom: string | null; operatingHoursTo: string | null;
  registeredTherapyRooms: number;
  occupiedBeds: number;
  activeInpatientEnrolments: number;
  therapyRoomRegistrationGap: number;
}

export interface TherapyRoom {
  id: string; branchId: string; name: string;
  type: TherapyRoomType; capacity: number;
  isActive: boolean; notes?: string;
  _count?: { bookings: number };
  branch?: { id: string; name: string };
}

export interface TherapyRoomBooking {
  id: string; roomId: string; appointmentId: string;
  date: string; startTime: string; endTime: string; notes?: string;
  appointment?: { id: string; patientId: string; status: string };
}

export interface DietMealPlan {
  mealTime: MealTime;
  foods: Array<{ name: string; quantity?: string; unit?: string; notes?: string }>;
  avoidFoods: Array<{ name: string; reason?: string }>;
  instructions?: string;
}

export interface DietPrescription {
  id: string; patientId: string; doctorId: string;
  title: string; doshaTarget: DoshaType; category: DietCategory;
  startDate: string; endDate?: string | null; notes?: string;
  isActive: boolean;
  packageId?: string | null;
  meals?: DietMealPlan[];
  doctor?: { fullName: string | null };
}

export interface DietDailyPlan {
  prescription: DietPrescription;
  meals: Array<DietMealPlan & { loggedToday: { followed: boolean } | null }>;
}

export type DietPackageStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface DietPackage {
  id: string;
  hospitalId?: string | null;
  title: string;
  description?: string | null;
  doshaTarget: DoshaType;
  category: DietCategory;
  durationDays: number;
  status: DietPackageStatus;
  notes?: string | null;
  isActive: boolean;
  createdById: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  xpAwarded?: number | null;
  approvalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  meals?: DietMealPlan[];
  createdBy?: { id: string; email: string; doctor?: { fullName: string | null } | null };
  approvedBy?: { id: string; email: string; doctor?: { fullName: string | null } | null } | null;
  _count?: { prescriptions: number };
}

export interface DietPackageAssignPayload {
  patientId: string;
  doctorId?: string;
  startDate?: string;
  durationDays?: number;
  title?: string;
  notes?: string;
  journeyId?: string;
  deactivateExisting?: boolean;
}

export type PrakritiType =
  | 'VATA' | 'PITTA' | 'KAPHA'
  | 'VATA_PITTA' | 'PITTA_KAPHA' | 'VATA_KAPHA' | 'TRIDOSHA';
export type AgniType = 'MANDAGNI' | 'TIKSHNA' | 'VISHAMA' | 'SAMA';

export interface DietAssignContext {
  package: { id: string; title: string; doshaTarget: DoshaType; durationDays: number };
  patient: { id: string; fullName: string | null };
  activePrescriptions: Array<{
    id: string; title: string; doshaTarget: DoshaType; category: DietCategory;
    startDate: string; endDate: string | null; packageId: string | null;
  }>;
  constitution: { prakriti: PrakritiType | null; agniType: AgniType | null; completedAt: string | null } | null;
  doshaMatch: {
    known: boolean; compatible: boolean; reason: string | null;
    prakriti?: PrakritiType; agniType?: AgniType | null;
  };
  hasConflict: boolean;
}

export interface DietPackageAssignConflict {
  code: 'ACTIVE_DIET_CONFLICT';
  error: string;
  conflicts: Array<{ id: string; title: string; startDate: string; endDate: string | null }>;
}

export interface ClinicalPhoto {
  id: string; patientId: string; uploadedById: string;
  journeyId?: string | null; phaseId?: string | null;
  category: PhotoCategory; stage: PhotoStage;
  bodyRegion?: string | null; notes?: string | null;
  filePath: string; takenAt: string;
}

export interface ClinicalPhotoPair {
  category: PhotoCategory;
  bodyRegion?: string | null;
  before: ClinicalPhoto | null;
  after: ClinicalPhoto | null;
}

export interface TherapistSkill {
  id: string; therapistId: string; skill: AyurvedicSkill; proficiency: Proficiency;
  certifiedAt?: string | null; notes?: string | null;
}

export interface TherapistMatchResult {
  therapist: { id: string; fullName: string | null; gender: string | null; qualification: string | null };
  matchedSkills: Array<{ skill: AyurvedicSkill; proficiency: Proficiency }>;
  missingSkills: AyurvedicSkill[];
  coverage: number;
  score: number;
  activePatientLoad: number;
}

export interface TreatmentPackage {
  id: string; branchId: string; name: string; description?: string;
  durationDays: number; price: number; taxPercent: number;
  isActive: boolean;
  components: Array<{ type: string; description: string; quantity: number }>;
  _count?: { enrolments: number };
  branch?: { id: string; name: string };
}

export interface PackageEnrolment {
  id: string; packageId: string; patientId: string;
  invoiceId?: string | null; startDate: string; endDate: string;
  status: EnrolmentStatus; sessionsTotal: number; sessionsUsed: number;
  notes?: string | null;
  package?: TreatmentPackage;
  invoice?: { id: string; status: string; netAmount: number };
}

export interface PackageProgress {
  enrolment: PackageEnrolment;
  daysRemaining: number;
  sessionsRemaining: number;
  progressPct: number;
}

export interface GroupSession {
  id: string; branchId: string; therapistId: string; roomId?: string | null;
  title: string; sessionType: string; date: string;
  startTime: string; endTime: string;
  maxCapacity: number; status: GroupSessionStatus;
  spotsLeft?: number;
  therapist?: { fullName: string | null };
  room?: { id: string; name: string; type: TherapyRoomType } | null;
  _count?: { appointments: number };
}

// ── API ─────────────────────────────────────────────────────────────────────
export const iwisApi = {
  // Feature 0: Branch capacity
  async getBranchCapacity(branchId: string): Promise<BranchCapacity> {
    const { data } = await apiClient.get<BranchCapacity>(`/api/branches/${branchId}/capacity`);
    return data;
  },

  // Feature 1: Therapy rooms
  // branchId is optional — when omitted (admin "All Branches" navbar
  // scope) the backend returns rooms across every branch in the user's
  // hospital, with each row carrying its `branch` relation for display.
  listRooms: async (branchId?: string) =>
    (await apiClient.get<TherapyRoom[]>('/api/therapy-rooms', branchId ? { branchId } : undefined)).data,
  createRoom: async (data: Partial<TherapyRoom>) => (await apiClient.post<TherapyRoom>('/api/therapy-rooms', data)).data,
  updateRoom: async (id: string, data: Partial<TherapyRoom>) => (await apiClient.put<TherapyRoom>(`/api/therapy-rooms/${id}`, data)).data,
  deactivateRoom: async (id: string) => (await apiClient.delete(`/api/therapy-rooms/${id}`)).data,
  getRoomAvailability: async (id: string, date: string) =>
    (await apiClient.get<{ room: TherapyRoom; bookings: TherapyRoomBooking[]; date: string }>(`/api/therapy-rooms/${id}/availability`, { date })).data,
  bookRoom: async (roomId: string, data: { appointmentId: string; date: string; startTime: string; endTime: string; notes?: string }) =>
    (await apiClient.post<TherapyRoomBooking>(`/api/therapy-rooms/${roomId}/book`, data)).data,
  cancelBooking: async (bookingId: string) => (await apiClient.delete(`/api/therapy-rooms/bookings/${bookingId}`)).data,
  getTherapistRoomSchedule: async (therapistId: string, date: string) =>
    (await apiClient.get<unknown[]>(`/api/therapy-rooms/therapist/${therapistId}/schedule`, { date })).data,

  // Feature 2: Diet
  listDietForPatient: async (patientId: string) =>
    (await apiClient.get<DietPrescription[]>('/api/diet-prescriptions', { patientId })).data,
  // Cross-patient search powered by the new GET /api/diet-prescriptions?search=
  // dispatch. Each row carries a flat `patientName` plus the nested `patient`
  // record so the card can render and link without a follow-up fetch.
  searchDiet: async (search: string) =>
    (await apiClient.get<Array<DietPrescription & {
      patientName: string | null;
      patient?: { id: string; fullName: string | null };
    }>>(
      '/api/diet-prescriptions',
      { search },
    )).data,
  createDiet: async (data: Partial<DietPrescription> & { meals?: DietMealPlan[] }) =>
    (await apiClient.post<DietPrescription>('/api/diet-prescriptions', data)).data,
  updateDiet: async (id: string, data: Partial<DietPrescription> & { meals?: DietMealPlan[] }) =>
    (await apiClient.put<DietPrescription>(`/api/diet-prescriptions/${id}`, data)).data,
  getDietToday: async (id: string) =>
    (await apiClient.get<DietDailyPlan>(`/api/diet-prescriptions/${id}/today`)).data,
  logDietMeal: async (id: string, payload: { patientId: string; mealTime: MealTime; followed: boolean; notes?: string }) =>
    (await apiClient.post(`/api/diet-prescriptions/${id}/log`, payload)).data,
  getDietAdherence: async (id: string, days = 30) =>
    (await apiClient.get<{ totalLogs: number; followed: number; missed: number; adherencePct: number; days: number }>(`/api/diet-prescriptions/${id}/adherence`, { days })).data,

  // Feature 2b: Diet Packages (reusable templates with approval workflow)
  listDietPackages: async (params?: { status?: DietPackageStatus }) =>
    (await apiClient.get<DietPackage[]>('/api/diet-packages', { status: params?.status })).data,
  getDietPackage: async (id: string) =>
    (await apiClient.get<DietPackage>(`/api/diet-packages/${id}`)).data,
  createDietPackage: async (data: Partial<DietPackage> & { meals?: DietMealPlan[]; durationDays: number }) =>
    (await apiClient.post<DietPackage>('/api/diet-packages', data)).data,
  updateDietPackage: async (id: string, data: Partial<DietPackage> & { meals?: DietMealPlan[] }) =>
    (await apiClient.put<DietPackage>(`/api/diet-packages/${id}`, data)).data,
  approveDietPackage: async (id: string, opts?: { xpAmount?: number; notes?: string }) =>
    (await apiClient.post<DietPackage>(`/api/diet-packages/${id}/approve`, opts ?? {})).data,
  rejectDietPackage: async (id: string, reason: string) =>
    (await apiClient.post<DietPackage>(`/api/diet-packages/${id}/reject`, { reason })).data,
  archiveDietPackage: async (id: string) =>
    (await apiClient.post<DietPackage>(`/api/diet-packages/${id}/archive`, {})).data,
  assignDietPackage: async (id: string, payload: DietPackageAssignPayload) =>
    (await apiClient.post<DietPrescription>(`/api/diet-packages/${id}/assign`, payload)).data,
  getDietAssignContext: async (id: string, patientId: string) =>
    (await apiClient.get<DietAssignContext>(`/api/diet-packages/${id}/assign-context`, { patientId })).data,

  // Feature 3: Clinical photos
  listPhotos: async (params: { patientId?: string; journeyId?: string; category?: PhotoCategory; stage?: PhotoStage }) =>
    (await apiClient.get<ClinicalPhoto[]>('/api/clinical-photos', params)).data,
  comparePhotos: async (params: { patientId: string; category?: PhotoCategory }) =>
    (await apiClient.get<ClinicalPhotoPair[]>('/api/clinical-photos/compare', params)).data,
  uploadPhoto: async (formData: FormData) =>
    (await apiClient.upload<ClinicalPhoto>('/api/clinical-photos', formData)).data,
  deletePhoto: async (id: string) => (await apiClient.delete(`/api/clinical-photos/${id}`)).data,

  // Feature 4: Therapist skills
  getSkills: async (therapistId: string) =>
    (await apiClient.get<TherapistSkill[]>(`/api/therapists/${therapistId}/skills`)).data,
  upsertSkill: async (therapistId: string, data: Partial<TherapistSkill>) =>
    (await apiClient.post<TherapistSkill>(`/api/therapists/${therapistId}/skills`, data)).data,
  removeSkill: async (therapistId: string, skill: AyurvedicSkill) =>
    (await apiClient.delete(`/api/therapists/${therapistId}/skills/${skill}`)).data,
  matchTherapists: async (params: { skills: AyurvedicSkill[]; branchId?: string; top?: number }) =>
    (await apiClient.get<TherapistMatchResult[]>('/api/therapists/match', {
      skills: params.skills.join(','), branchId: params.branchId, top: params.top
    })).data,
  skillCoverage: async () =>
    (await apiClient.get<Array<{ skill: AyurvedicSkill; byBranch: Record<string, { CERTIFIED: number; EXPERIENCED: number; LEARNING: number; total: number }> }>>('/api/therapists/coverage')).data,

  // Feature 5: Treatment packages
  // branchId is optional — admins picking "All Branches" in the navbar
  // get the cross-branch list back, scoped server-side to their hospital.
  listPackages: async (branchId?: string) =>
    (await apiClient.get<TreatmentPackage[]>('/api/packages', branchId ? { branchId } : undefined)).data,
  createPackage: async (data: Partial<TreatmentPackage>) =>
    (await apiClient.post<TreatmentPackage>('/api/packages', data)).data,
  updatePackage: async (id: string, data: Partial<TreatmentPackage>) =>
    (await apiClient.put<TreatmentPackage>(`/api/packages/${id}`, data)).data,
  deactivatePackage: async (id: string) => (await apiClient.delete(`/api/packages/${id}`)).data,
  enrolInPackage: async (packageId: string, data: { patientId: string; sessionsTotal: number; startDate?: string; notes?: string }) =>
    (await apiClient.post<PackageEnrolment>(`/api/packages/${packageId}/enrol`, data)).data,
  listEnrolments: async (patientId: string) =>
    (await apiClient.get<PackageEnrolment[]>('/api/packages/enrolments', { patientId })).data,
  getEnrolmentProgress: async (enrolmentId: string) =>
    (await apiClient.get<PackageProgress>(`/api/packages/enrolments/${enrolmentId}/progress`)).data,
  logPackageSession: async (enrolmentId: string, data: { sessionType: string; conductedById: string; conductedAt?: string; appointmentId?: string; notes?: string }) =>
    (await apiClient.post(`/api/packages/enrolments/${enrolmentId}/log-session`, data)).data,

  // Feature 6: Group sessions
  listGroupSessions: async (params: { branchId?: string; date?: string; therapistId?: string }) =>
    (await apiClient.get<GroupSession[]>('/api/group-sessions', params)).data,
  createGroupSession: async (data: Partial<GroupSession> & { patientIds?: string[] }) =>
    (await apiClient.post<GroupSession>('/api/group-sessions', data)).data,
  joinGroupSession: async (id: string, patientId?: string) =>
    (await apiClient.post(`/api/group-sessions/${id}/join`, { patientId })).data,
  completeGroupSession: async (id: string) =>
    (await apiClient.post(`/api/group-sessions/${id}/complete`, {})).data,
  cancelGroupSession: async (id: string) =>
    (await apiClient.post(`/api/group-sessions/${id}/cancel`, {})).data,
  getGroupRoster: async (id: string) =>
    (await apiClient.get<GroupSession & { appointments: Array<{ id: string; patient: { id: string; fullName: string | null; phoneNumber: string | null } }> }>(`/api/group-sessions/${id}/roster`)).data,
};
