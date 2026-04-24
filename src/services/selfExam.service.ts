/**
 * Self-Examination Protocol (IWIS pre-consultation) API client.
 *
 * Matches backend routes/self-exam.js. The submission is auto-initialised
 * from a TriageSession; typical flow is:
 *   1. Patient completes triage → backend creates DRAFT SelfExamSubmission.
 *   2. Patient opens the kit, sees a checklist built from pain zones.
 *   3. Patient fills typed exams over 3 days (tongue/stool/urine/etc.).
 *   4. Patient calls `submit()` → status flips to SUBMITTED, Vaidya gets notified.
 *
 * Stool is captured as structured texture + habit fields only. No photos.
 */
import apiClient from '@/lib/api-client';

// ─── Enums (mirror Prisma) ─────────────────────────────────────────────

export type PainZone =
  | 'HEAD_MIGRAINE' | 'NECK' | 'SHOULDER' | 'CHEST' | 'LOWER_BACK'
  | 'ABDOMEN' | 'KNEE' | 'WRIST_HAND' | 'GENERALISED_MUSCLE';

export type PainCharacter =
  | 'THROBBING' | 'PRESSING' | 'STABBING' | 'DULL' | 'BURNING' | 'SHARP'
  | 'ACHING' | 'CRAMPING' | 'GRINDING' | 'HEAVY' | 'TIGHT' | 'COLICKY' | 'BLOATING';

export type TongueCoatingColor = 'NONE' | 'WHITE' | 'YELLOW' | 'RED';
export type TongueCoatingThickness = 'NONE' | 'THIN' | 'THICK';

export type StoolConsistency =
  | 'HARD_PELLETS' | 'FORMED' | 'SOFT' | 'LOOSE' | 'WATERY' | 'MUCOUSY';
export type StoolColour = 'BROWN' | 'PALE' | 'YELLOW_GREEN' | 'DARK';
export type StoolMealRelation = 'BEFORE_MEALS' | 'AFTER_MEALS' | 'BOTH' | 'NONE';

export type UrineColour = 'PALE' | 'NORMAL_YELLOW' | 'DARK_YELLOW' | 'BROWN';

export type RoMJoint =
  | 'NECK' | 'SHOULDER_LEFT' | 'SHOULDER_RIGHT' | 'KNEE_LEFT' | 'KNEE_RIGHT';

export type RoMDirection =
  | 'NECK_ROTATE_LEFT' | 'NECK_ROTATE_RIGHT' | 'NECK_FLEX' | 'NECK_EXTEND'
  | 'NECK_LATERAL_LEFT' | 'NECK_LATERAL_RIGHT'
  | 'SHOULDER_FLEX_OVERHEAD' | 'SHOULDER_ABDUCT' | 'SHOULDER_CROSS_BODY'
  | 'SHOULDER_BEHIND_BACK' | 'SHOULDER_EXTERNAL_ROT' | 'SHOULDER_INTERNAL_ROT'
  | 'KNEE_FLEX' | 'KNEE_EXTEND';

export type PhysicalObservationType =
  | 'POSTURE_FULL_BODY' | 'FACE_EYE' | 'HAND_FLAT' | 'KNEE_COMPARE'
  | 'SHOULDER_SYMMETRY' | 'GENERAL_APPEARANCE';

export type PrakritiType =
  | 'VATA' | 'PITTA' | 'KAPHA' | 'VATA_PITTA' | 'PITTA_KAPHA' | 'VATA_KAPHA' | 'TRIDOSHA';

export type AgniType = 'MANDAGNI' | 'TIKSHNA' | 'VISHAMA' | 'SAMA';
export type AppetiteLevel = 'STRONG' | 'MODERATE' | 'WEAK' | 'IRREGULAR';
export type SleepPosition = 'BACK' | 'LEFT_SIDE' | 'RIGHT_SIDE' | 'STOMACH' | 'MIXED';

export type SelfExamStatus = 'DRAFT' | 'SUBMITTED' | 'REVIEWED';

// ─── Row types ─────────────────────────────────────────────────────────

export interface SymptomHistoryEntry {
  id: string;
  submissionId: string;
  painZone: PainZone;
  subLocation: string | null;
  characters: PainCharacter[];
  triggers: string[];
  relievingFactors: string[];
  timing: string[];
  severity: number;
  radiatesTo: string | null;
  associatedSymptoms: string[];
  warningSignsBeforeEpisode: string[];
  injuryHistory: string | null;
  occupationContext: string | null;
  freeText: string | null;
  createdAt: string;
}

export interface TongueObservation {
  id: string;
  submissionId: string;
  patientId: string;
  dayIndex: number;
  observedOn: string;
  photoUrl: string | null;
  coatingColor: TongueCoatingColor;
  coatingThickness: TongueCoatingThickness;
  dryness: boolean;
  cracks: boolean;
  tremor: boolean;
  correlatedPainLevel: number | null;
  notes: string | null;
  createdAt: string;
}

export interface StoolLog {
  id: string;
  submissionId: string;
  patientId: string;
  dayIndex: number;
  observedOn: string;
  consistency: StoolConsistency;
  colour: StoolColour;
  frequencyPerDay: number;
  daysSinceLastMovement: number | null;
  strainingEffort: number;
  incompleteEvacuation: boolean;
  bloatingGas: boolean;
  bloodPresent: boolean;
  mucusPresent: boolean;
  undigestedFood: boolean;
  relationshipToMeal: StoolMealRelation;
  notes: string | null;
  createdAt: string;
}

export interface UrineLog {
  id: string;
  submissionId: string;
  patientId: string;
  dayIndex: number;
  observedOn: string;
  colour: UrineColour;
  frequencyPerDay: number;
  burning: boolean;
  urgency: boolean;
  painCorrelation: boolean;
  notes: string | null;
  createdAt: string;
}

export interface RoMMeasurement {
  id: string;
  submissionId: string;
  joint: RoMJoint;
  direction: RoMDirection;
  angleDegrees: number | null;
  restriction: string | null;
  painScore: number;
  crepitus: boolean;
  catchOrSharp: boolean;
  notes: string | null;
  createdAt: string;
}

export interface PhysicalObservation {
  id: string;
  submissionId: string;
  observationType: PhysicalObservationType;
  painZone: PainZone | null;
  photoFrontUrl: string | null;
  photoSideUrl: string | null;
  photoBackUrl: string | null;
  photoExtraUrl: string | null;
  details: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
}

export interface VoiceObservation {
  id: string;
  submissionId: string;
  dayIndex: number;
  morningRecUrl: string | null;
  eveningRecUrl: string | null;
  fatigueNotes: string | null;
  createdAt: string;
}

export interface DigestiveProfile {
  id: string;
  submissionId: string;
  agniType: AgniType | null;
  appetiteLevel: AppetiteLevel | null;
  bloatingAfterMeals: boolean;
  bloatingDurationMins: number | null;
  heartburnPerWeek: number | null;
  waterIntakeGlasses: number | null;
  coldFoodAggravates: boolean;
  foodTriggers: string[];
  incompatibleCombinations: string[];
  notes: string | null;
  createdAt: string;
}

export interface LifestyleContext {
  id: string;
  submissionId: string;
  pillowType: string | null;
  pillowFirmness: string | null;
  sleepPosition: SleepPosition | null;
  sleepHours: number | null;
  screenHoursPerDay: number | null;
  occupation: string | null;
  pastInjuries: string | null;
  regularExercise: string | null;
  stressEventsPast6mo: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ConstitutionProfile {
  id: string;
  patientId: string;
  prakriti: PrakritiType | null;
  satvaRating: number | null;
  agniType: AgniType | null;
  quizAnswers: Record<string, unknown> | null;
  lastUpdatedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SelfExamSubmission {
  id: string;
  triageSessionId: string | null;
  patientId: string;
  appointmentId: string | null;
  branchId: string | null;
  hospitalId: string | null;
  painZones: PainZone[];
  status: SelfExamStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;

  symptomHistory: SymptomHistoryEntry[];
  tongueObservations: TongueObservation[];
  stoolLogs: StoolLog[];
  urineLogs: UrineLog[];
  romMeasurements: RoMMeasurement[];
  physicalObservations: PhysicalObservation[];
  voiceObservations: VoiceObservation[];
  digestiveProfile: DigestiveProfile | null;
  lifestyleContext: LifestyleContext | null;
}

// Raw checklist shape returned by `buildChecklist` on the backend — has no
// completion state. The `complete` flag is attached by `computeCompletion`
// and only appears on `CompletionSummary.items`. Render from there, not here.
export interface ChecklistProtocolItem {
  key: string;
  zone: PainZone | null;
  type:
    | 'SYMPTOM_HISTORY' | 'TONGUE' | 'STOOL' | 'URINE' | 'ROM'
    | 'PHYSICAL' | 'VOICE' | 'DIGESTIVE' | 'LIFESTYLE' | 'CONSTITUTION';
  dayIndex?: number;
  joint?: RoMJoint;
  direction?: RoMDirection;
  observationType?: PhysicalObservationType;
  critical?: boolean;
  urgentCareWarning?: boolean;
}

export interface ChecklistItem extends ChecklistProtocolItem {
  complete: boolean;
}

export interface CompletionSummary {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
}

export interface SelfExamBundle {
  submission: SelfExamSubmission & { patient?: { id: string; fullName: string | null } };
  constitution: ConstitutionProfile | null;
  checklist: ChecklistProtocolItem[];
  completion: CompletionSummary;
}

// ─── API ───────────────────────────────────────────────────────────────

export const selfExamService = {
  listZones: () =>
    apiClient.get<{ zones: PainZone[] }>('/api/self-exam/zones').then((r) => r.data.zones),

  createManual: (zones: PainZone[], appointmentId?: string) =>
    apiClient
      .post<SelfExamSubmission>('/api/self-exam', { zones, appointmentId })
      .then((r) => r.data),

  mine: () =>
    apiClient.get<SelfExamSubmission[]>('/api/self-exam/mine').then((r) => r.data),

  reviewQueue: (params?: { branchId?: string; status?: SelfExamStatus }) =>
    apiClient
      .get<SelfExamSubmission[]>('/api/self-exam/review-queue', params)
      .then((r) => r.data),

  get: (submissionId: string) =>
    apiClient.get<SelfExamBundle>(`/api/self-exam/${submissionId}`).then((r) => r.data),

  getByAppointment: (appointmentId: string) =>
    apiClient
      .get<SelfExamBundle>(`/api/self-exam/by-appointment/${appointmentId}`)
      .then((r) => r.data),

  // ─── Photo upload helper ────────────────────────────────────────────
  // The form submits each asset separately and the returned url is then
  // attached to whichever observation it belongs to. Stool does NOT use this.
  uploadAsset: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.upload<{ url: string }>(
      '/api/self-exam/upload-asset',
      form
    );
    return data.url;
  },

  // ─── Typed upserts ──────────────────────────────────────────────────

  symptomHistory: (
    submissionId: string,
    body: { zone: PainZone } & Omit<SymptomHistoryEntry, 'id' | 'submissionId' | 'painZone' | 'createdAt'>
  ) =>
    apiClient
      .post<SymptomHistoryEntry>(`/api/self-exam/${submissionId}/symptom-history`, body)
      .then((r) => r.data),

  tongue: (
    submissionId: string,
    body: { dayIndex: number } & Partial<
      Omit<TongueObservation, 'id' | 'submissionId' | 'patientId' | 'dayIndex' | 'createdAt'>
    > & Pick<TongueObservation, 'coatingColor' | 'coatingThickness'>
  ) =>
    apiClient
      .post<TongueObservation>(`/api/self-exam/${submissionId}/tongue`, body)
      .then((r) => r.data),

  stool: (
    submissionId: string,
    body: { dayIndex: number } & Omit<
      StoolLog,
      'id' | 'submissionId' | 'patientId' | 'dayIndex' | 'createdAt'
    >
  ) =>
    apiClient
      .post<StoolLog>(`/api/self-exam/${submissionId}/stool`, body)
      .then((r) => r.data),

  urine: (
    submissionId: string,
    body: { dayIndex: number } & Omit<
      UrineLog,
      'id' | 'submissionId' | 'patientId' | 'dayIndex' | 'createdAt'
    >
  ) =>
    apiClient
      .post<UrineLog>(`/api/self-exam/${submissionId}/urine`, body)
      .then((r) => r.data),

  rom: (
    submissionId: string,
    body: { joint: RoMJoint; direction: RoMDirection } & Omit<
      RoMMeasurement,
      'id' | 'submissionId' | 'joint' | 'direction' | 'createdAt'
    >
  ) =>
    apiClient
      .post<RoMMeasurement>(`/api/self-exam/${submissionId}/rom`, body)
      .then((r) => r.data),

  physical: (
    submissionId: string,
    body: { observationType: PhysicalObservationType } & Partial<
      Omit<PhysicalObservation, 'id' | 'submissionId' | 'observationType' | 'createdAt'>
    >
  ) =>
    apiClient
      .post<PhysicalObservation>(`/api/self-exam/${submissionId}/physical`, body)
      .then((r) => r.data),

  voice: (
    submissionId: string,
    body: { dayIndex: number } & Partial<
      Omit<VoiceObservation, 'id' | 'submissionId' | 'dayIndex' | 'createdAt'>
    >
  ) =>
    apiClient
      .post<VoiceObservation>(`/api/self-exam/${submissionId}/voice`, body)
      .then((r) => r.data),

  digestive: (
    submissionId: string,
    body: Partial<Omit<DigestiveProfile, 'id' | 'submissionId' | 'createdAt'>>
  ) =>
    apiClient
      .post<DigestiveProfile>(`/api/self-exam/${submissionId}/digestive`, body)
      .then((r) => r.data),

  lifestyle: (
    submissionId: string,
    body: Partial<Omit<LifestyleContext, 'id' | 'submissionId' | 'createdAt'>>
  ) =>
    apiClient
      .post<LifestyleContext>(`/api/self-exam/${submissionId}/lifestyle`, body)
      .then((r) => r.data),

  // ─── Constitution quiz (patient-level) ──────────────────────────────
  getConstitution: () =>
    apiClient
      .get<ConstitutionProfile | null>('/api/self-exam/constitution/me')
      .then((r) => r.data),

  upsertConstitution: (body: Partial<
    Pick<ConstitutionProfile, 'prakriti' | 'satvaRating' | 'agniType' | 'quizAnswers'>
  >) =>
    apiClient
      .post<ConstitutionProfile>('/api/self-exam/constitution', body)
      .then((r) => r.data),

  // ─── Workflow ───────────────────────────────────────────────────────

  attachAppointment: (submissionId: string, appointmentId: string) =>
    apiClient
      .post<SelfExamSubmission>(
        `/api/self-exam/${submissionId}/attach-appointment`,
        { appointmentId }
      )
      .then((r) => r.data),

  submit: (submissionId: string) =>
    apiClient
      .post<SelfExamSubmission>(`/api/self-exam/${submissionId}/submit`, {})
      .then((r) => r.data),

  review: (submissionId: string, reviewNotes?: string) =>
    apiClient
      .post<SelfExamSubmission>(`/api/self-exam/${submissionId}/review`, { reviewNotes })
      .then((r) => r.data),

  // ─── Admin protocol tuning ────────────────────────────────────────
  listProtocols: () =>
    apiClient
      .get<ProtocolOverviewRow[]>('/api/self-exam/protocols')
      .then((r) => r.data),

  upsertProtocol: (zone: PainZone, config: ZoneProtocolConfig) =>
    apiClient
      .put<ProtocolOverrideRow>(`/api/self-exam/protocols/${zone}`, { config })
      .then((r) => r.data),

  resetProtocol: (zone: PainZone) =>
    apiClient
      .delete<{ zone: PainZone; reverted: boolean }>(`/api/self-exam/protocols/${zone}`)
      .then((r) => r.data),
};

// ─── Protocol override types ────────────────────────────────────────
// Mirror of the code-level default in `services/selfExam.protocol.js`.
// All fields optional because an override row may toggle any subset.

export interface ZoneProtocolConfig {
  symptomHistory?: boolean | { critical?: boolean; urgentCareWarning?: boolean };
  tongue?:   { days: number; critical?: boolean };
  stool?:    { days: number; critical?: boolean };
  urine?:    { days: number };
  rom?:      { joints: RoMJoint[]; directions: RoMDirection[] };
  physicalObservations?: PhysicalObservationType[];
  voice?:    { days: number };
  digestive?:       boolean;
  lifestyle?:       boolean;
  constitutionQuiz?: boolean;
}

export interface ProtocolOverrideRow {
  id: string;
  hospitalId: string;
  painZone: PainZone;
  config: ZoneProtocolConfig;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProtocolOverviewRow {
  zone: PainZone;
  default: ZoneProtocolConfig;
  override: ProtocolOverrideRow | null;
  effective: ZoneProtocolConfig;
}
