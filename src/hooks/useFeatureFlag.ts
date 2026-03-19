/**
 * useFeatureFlag — fetches a single feature flag from the backend.
 *
 * Returns `true` if the flag is enabled for the authenticated user's role/branch,
 * `false` otherwise (fail-open: also false on network error or unauthenticated state).
 *
 * Usage:
 *   const hasTimeline = useFeatureFlag('patient_timeline');
 *   if (!hasTimeline) return null;
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';

export function useFeatureFlag(key: string): boolean {
    const { user } = useAuth();
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        if (!user) {
            setEnabled(false);
            return;
        }

        apiClient.get<{ enabled: boolean }>(`/api/feature-flags/${key}`)
            .then(({ data }) => setEnabled(data?.enabled ?? false))
            .catch(() => setEnabled(false));
    }, [key, user]);

    return enabled;
}
