/**
 * useTenantFeatures — reads the set of FeatureRegistry keys enabled for the
 * current user's hospital (via the Super Admin feature flag system).
 *
 * Backed by `GET /api/user/features`; cached by React Query (5 min stale time)
 * so navigation and page renders don't hammer the endpoint.
 *
 * Usage:
 *   const { has, isLoading } = useTenantFeatures();
 *   if (!has('THERAPY_ROOM_MANAGEMENT')) return null;
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

interface FeatureResponse {
    registered: string[];
    enabled: string[];
    isSuperAdmin: boolean;
}

export function useTenantFeatures() {
    const { user } = useAuth();

    const { data, isLoading, error } = useQuery({
        queryKey: ['tenantFeatures', user?.id],
        queryFn: async () => {
            const { data } = await apiClient.get<FeatureResponse>('/api/user/features');
            return data;
        },
        enabled: !!user,
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    const registeredSet = data?.registered ? new Set(data.registered) : null;
    const enabledSet    = data?.enabled    ? new Set(data.enabled)    : null;

    /**
     * Feature check. Three-state logic so we don't hide nav items whose
     * FeatureRegistry row hasn't been migrated yet:
     *   - not loaded yet              → true  (fail-open to avoid nav flicker)
     *   - key NOT in registered set   → true  (fail-open — unknown feature)
     *   - super admin                 → true
     *   - key in enabled set          → true
     *   - otherwise                   → false (registered but disabled)
     */
    const has = (key: string): boolean => {
        if (!registeredSet || !enabledSet) return true;
        if (data?.isSuperAdmin) return true;
        if (!registeredSet.has(key)) return true;
        return enabledSet.has(key);
    };

    return { has, isLoading, isSuperAdmin: data?.isSuperAdmin ?? false, error };
}
