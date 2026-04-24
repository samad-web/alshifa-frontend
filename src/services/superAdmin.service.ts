/**
 * Super Admin API service — all /api/super-admin/* routes.
 * Accessible only to users with role SUPER_ADMIN; the backend enforces.
 */
import { apiClient } from '@/lib/api-client';

export type HospitalStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_SETUP' | 'DECOMMISSIONED';
export type HospitalPlan = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface HospitalListItem {
  id: string;
  name: string;
  slug: string;
  status: HospitalStatus;
  plan: HospitalPlan;
  contactEmail: string;
  contactPhone: string | null;
  country: string;
  timezone: string;
  branchCount: number;
  userCount: number;
  createdAt: string;
  suspendedAt: string | null;
}

export interface HospitalDetail extends HospitalListItem {
  address: string | null;
  branches: Array<{ id: string; name: string; isActive: boolean; createdAt: string }>;
  _count: { branches: number; users: number };
}

export interface HospitalFeature {
  key: string;
  displayName: string;
  description: string | null;
  phase: string;
  minPlan: HospitalPlan;
  isCore: boolean;
  addedInVersion: string | null;
  enabled: boolean;
  enabledAt: string | null;
  enabledById: string | null;
  enabledByEmail: string | null;
  notes: string | null;
  syncPending: boolean;
  planAllowed: boolean;
}

export interface FeatureRegistryEntry {
  id: string;
  key: string;
  displayName: string;
  description: string | null;
  phase: string;
  minPlan: HospitalPlan;
  isCore: boolean;
  defaultEnabled: boolean;
  addedInVersion: string | null;
  createdAt: string;
  updatedAt: string;
  hospitalCount: number;
  enabledHospitalCount: number;
  globalStatus: 'ON' | 'OFF' | 'MIXED';
}

export interface GlobalToggleResult {
  featureKey: string;
  enabled: boolean;
  appliedTo: number;
  skippedForPlan: number;
  totalHospitals: number;
}

export interface PlatformOverview {
  totals: {
    hospitals: number;
    branches: number;
    branchesActive: number;
    staffUsers: number;
    patients: number;
    monthlyActiveUsers: number;
    appointmentsLast30d: number;
  };
  hospitalsByStatus: Record<string, number>;
  hospitalsByPlan: Record<string, number>;
}

export interface HospitalUsage {
  hospital: {
    id: string;
    name: string;
    slug: string;
    plan: HospitalPlan;
    status: HospitalStatus;
    createdAt: string;
  };
  totals: {
    branches: number;
    staffUsers: number;
    patients: number;
    appointmentsLast30d: number;
    prescriptionsLast30d: number;
  };
}

export interface TriageUrgencyMix {
  ROUTINE: number;
  MODERATE: number;
  URGENT: number;
  CRITICAL: number;
}

export interface HospitalTriageBucket {
  hospital: { id: string; name: string; slug: string; plan: HospitalPlan; status: HospitalStatus };
  totalSessions: number;
  urgencyMix: TriageUrgencyMix;
  redFlagFired: number;
  autoHeldSlots: number;
  reTriaged: number;
  escalatedOnReTriage: number;
  overridesTotal: number;
  urgencyOverrides: number;
  specialtyOverrides: number;
  disagreementRate: number;
}

export interface TriageOverview {
  windowDays: number;
  totals: {
    totalSessions: number;
    urgencyMix: TriageUrgencyMix;
    redFlagFired: number;
    redFlagsByType: Record<string, number>;
    autoHeldSlots: number;
    reTriaged: number;
    escalatedOnReTriage: number;
    overridesTotal: number;
    urgencyOverrides: number;
    specialtyOverrides: number;
    disagreementRate: number;
  };
  perHospital: HospitalTriageBucket[];
}

export interface SpecialtyRoute {
  id: string;
  specialty: string;
  tags: string[];
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  superAdminId: string;
  action: string;
  hospitalId: string | null;
  featureKey: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
  superAdmin: { id: string; email: string };
  hospital: { id: string; name: string; slug: string } | null;
}

type Wrap<T> = { data: T };

export const superAdminApi = {
  // ── Hospitals ──────────────────────────────────────────────────────────
  async listHospitals(): Promise<HospitalListItem[]> {
    const { data } = await apiClient.get<Wrap<HospitalListItem[]>>('/api/super-admin/hospitals');
    return data.data;
  },
  async getHospital(id: string): Promise<HospitalDetail> {
    const { data } = await apiClient.get<Wrap<HospitalDetail>>(`/api/super-admin/hospitals/${id}`);
    return data.data;
  },
  async createHospital(payload: {
    name: string;
    slug: string;
    contactEmail: string;
    contactPhone?: string;
    address?: string;
    timezone?: string;
    plan: HospitalPlan;
    adminUser?: { name?: string; email: string };
    defaultFeatures?: string[];
  }): Promise<{ hospital: HospitalDetail; adminUserId: string | null }> {
    const { data } = await apiClient.post<{ hospital: HospitalDetail; adminUserId: string | null }>(
      '/api/super-admin/hospitals',
      payload,
    );
    return data;
  },
  async updateHospital(id: string, patch: Partial<HospitalDetail> & { plan?: HospitalPlan }): Promise<HospitalDetail> {
    const { data } = await apiClient.patch<Wrap<HospitalDetail>>(`/api/super-admin/hospitals/${id}`, patch);
    return data.data;
  },
  async suspendHospital(id: string, reason?: string): Promise<HospitalDetail> {
    const { data } = await apiClient.post<Wrap<HospitalDetail>>(
      `/api/super-admin/hospitals/${id}/suspend`,
      { reason },
    );
    return data.data;
  },
  async reactivateHospital(id: string): Promise<HospitalDetail> {
    const { data } = await apiClient.post<Wrap<HospitalDetail>>(
      `/api/super-admin/hospitals/${id}/reactivate`,
      {},
    );
    return data.data;
  },
  async decommissionHospital(id: string): Promise<HospitalDetail> {
    const { data } = await apiClient.delete<Wrap<HospitalDetail>>(`/api/super-admin/hospitals/${id}`);
    return data.data;
  },

  // ── Feature flags ──────────────────────────────────────────────────────
  async listHospitalFeatures(hospitalId: string): Promise<HospitalFeature[]> {
    const { data } = await apiClient.get<Wrap<HospitalFeature[]>>(
      `/api/super-admin/hospitals/${hospitalId}/features`,
    );
    return data.data;
  },
  async setHospitalFeature(hospitalId: string, key: string, enabled: boolean, notes?: string) {
    const { data } = await apiClient.put<Wrap<unknown>>(
      `/api/super-admin/hospitals/${hospitalId}/features/${key}`,
      { enabled, notes },
    );
    return data.data;
  },
  async bulkSetHospitalFeatures(
    hospitalId: string,
    changes: Array<{ featureKey: string; enabled: boolean; notes?: string }>,
  ) {
    const { data } = await apiClient.post<Wrap<unknown>>(
      `/api/super-admin/hospitals/${hospitalId}/features/bulk`,
      { changes },
    );
    return data.data;
  },

  // ── Feature registry ───────────────────────────────────────────────────
  async listRegistry(): Promise<FeatureRegistryEntry[]> {
    const { data } = await apiClient.get<Wrap<FeatureRegistryEntry[]>>('/api/super-admin/feature-registry');
    return data.data;
  },
  async updateRegistryMeta(
    key: string,
    patch: Partial<Pick<FeatureRegistryEntry, 'displayName' | 'description' | 'addedInVersion'>>,
  ) {
    const { data } = await apiClient.patch<Wrap<FeatureRegistryEntry>>(
      `/api/super-admin/feature-registry/${key}`,
      patch,
    );
    return data.data;
  },
  async toggleFeatureGlobally(key: string, enabled: boolean): Promise<GlobalToggleResult> {
    const { data } = await apiClient.post<Wrap<GlobalToggleResult>>(
      `/api/super-admin/feature-registry/${key}/toggle-all`,
      { enabled },
    );
    return data.data;
  },
  async triggerRegistrySync(): Promise<{
    hospitalCount: number;
    featureCount: number;
    createdFlagRows: number;
    durationMs: number;
  }> {
    const { data } = await apiClient.post<
      Wrap<{ hospitalCount: number; featureCount: number; createdFlagRows: number; durationMs: number }>
    >('/api/super-admin/feature-registry/sync', {});
    return data.data;
  },

  // ── Analytics ──────────────────────────────────────────────────────────
  async platformOverview(): Promise<PlatformOverview> {
    const { data } = await apiClient.get<Wrap<PlatformOverview>>('/api/super-admin/analytics');
    return data.data;
  },
  async hospitalUsage(id: string): Promise<HospitalUsage> {
    const { data } = await apiClient.get<Wrap<HospitalUsage>>(`/api/super-admin/analytics/hospitals/${id}`);
    return data.data;
  },

  // ── Triage oversight ───────────────────────────────────────────────────
  async triageOverview(days = 30): Promise<TriageOverview> {
    const { data } = await apiClient.get<Wrap<TriageOverview>>(
      `/api/super-admin/triage/overview?days=${days}`,
    );
    return data.data;
  },
  async listSpecialtyRoutes(): Promise<SpecialtyRoute[]> {
    const { data } = await apiClient.get<Wrap<SpecialtyRoute[]>>(
      '/api/super-admin/triage/specialty-routes',
    );
    return data.data;
  },
  async upsertSpecialtyRoute(payload: {
    specialty: string;
    tags: string[];
    priority?: number;
    isActive?: boolean;
  }): Promise<SpecialtyRoute> {
    const { data } = await apiClient.put<Wrap<SpecialtyRoute>>(
      '/api/super-admin/triage/specialty-routes',
      payload,
    );
    return data.data;
  },
  async deleteSpecialtyRoute(id: string): Promise<{ id: string }> {
    const { data } = await apiClient.delete<Wrap<{ id: string }>>(
      `/api/super-admin/triage/specialty-routes/${id}`,
    );
    return data.data;
  },

  // ── Audit ──────────────────────────────────────────────────────────────
  async listAudit(
    params: {
      action?: string;
      hospitalId?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) {
    const { data } = await apiClient.get<{
      items: AuditLogEntry[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>('/api/super-admin/audit', params as Record<string, string | number | boolean | undefined | null>);
    return data;
  },
};
