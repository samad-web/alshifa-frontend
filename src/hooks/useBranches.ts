import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export function useBranches() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const { data } = await apiClient.get<any[]>('/api/branches');
                setBranches(data);
            } catch (err: any) {
                setError(err?.message || 'Failed to fetch branches');
            } finally {
                setLoading(false);
            }
        };

        fetchBranches();
    }, []);

    return { branches, loading, error };
}
