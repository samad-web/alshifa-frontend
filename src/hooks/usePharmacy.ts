/**
 * usePharmacy hook — medicine inventory, stock alerts, order management.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { pharmacyApi } from '@/services/pharmacy.service';
import { ApiClientError } from '@/lib/api-client';
import type { Medicine, MedicineStock, PharmacyOrder } from '@/types';

interface PharmacyState {
  medicines: Medicine[];
  lowStockAlerts: MedicineStock[];
  orders: PharmacyOrder[];
  total: number;
  loading: boolean;
  error: string | null;
}

export function usePharmacy({ autoFetch = true }: { autoFetch?: boolean } = {}) {
  const [state, setState] = useState<PharmacyState>({
    medicines: [],
    lowStockAlerts: [],
    orders: [],
    total: 0,
    loading: autoFetch,
    error: null,
  });

  const fetchMedicines = useCallback(async (params?: Record<string, string | number>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await pharmacyApi.getMedicines(params);
      setState((prev) => ({
        ...prev,
        medicines: result.medicines,
        total: result.total,
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to fetch medicines';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      toast.error(message);
    }
  }, []);

  const fetchLowStockAlerts = useCallback(async () => {
    try {
      const alerts = await pharmacyApi.getLowStockAlerts();
      setState((prev) => ({ ...prev, lowStockAlerts: alerts }));
    } catch {
      // Non-critical — don't toast
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchMedicines();
      fetchLowStockAlerts();
    }
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const adjustStock = useCallback(async (stockId: string, quantityDelta: number, reason?: string) => {
    try {
      const result = await pharmacyApi.adjustStock(stockId, { quantityDelta, reason });
      toast.success('Stock adjusted successfully');
      await fetchMedicines();
      await fetchLowStockAlerts();
      return result;
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to adjust stock';
      toast.error(message);
      return null;
    }
  }, [fetchMedicines, fetchLowStockAlerts]);

  return {
    ...state,
    refetch: fetchMedicines,
    fetchLowStockAlerts,
    adjustStock,
  };
}
