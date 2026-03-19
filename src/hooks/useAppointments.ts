/**
 * useAppointments hook — encapsulates all appointment data fetching & mutations.
 *
 * Replaces ~80 lines of inline fetch/state logic duplicated across:
 *   Appointments.tsx, PatientAppointments.tsx, DoctorDashboard.tsx, etc.
 *
 * Usage:
 *   const { appointments, pagination, loading, error, refetch, create, update, cancel } = useAppointments();
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { appointmentsApi, type GetAppointmentsParams } from '@/services/appointments.service';
import { ApiClientError } from '@/lib/api-client';
import type { Appointment, AppointmentListResponse, CreateAppointmentPayload, UpdateAppointmentPayload } from '@/types';

interface UseAppointmentsOptions extends GetAppointmentsParams {
  autoFetch?: boolean;
}

interface AppointmentsState {
  appointments: Appointment[];
  pagination: AppointmentListResponse['pagination'];
  loading: boolean;
  error: string | null;
}

const DEFAULT_PAGINATION: AppointmentListResponse['pagination'] = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
};

export function useAppointments(options: UseAppointmentsOptions = {}) {
  const { autoFetch = true, ...fetchParams } = options;

  const [state, setState] = useState<AppointmentsState>({
    appointments: [],
    pagination: DEFAULT_PAGINATION,
    loading: autoFetch,
    error: null,
  });

  const fetch = useCallback(async (params?: GetAppointmentsParams) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await appointmentsApi.list({ ...fetchParams, ...params });
      setState({
        appointments: result.appointments,
        pagination: result.pagination ?? DEFAULT_PAGINATION,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to fetch appointments';
      setState((prev) => ({ ...prev, loading: false, error: message }));
      toast.error(message);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (autoFetch) fetch();
  }, [autoFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = useCallback(async (payload: CreateAppointmentPayload): Promise<Appointment | null> => {
    try {
      const appointment = await appointmentsApi.create(payload);
      toast.success('Appointment booked successfully');
      await fetch();
      return appointment;
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to book appointment';
      toast.error(message);
      return null;
    }
  }, [fetch]);

  const update = useCallback(async (id: string, payload: UpdateAppointmentPayload): Promise<Appointment | null> => {
    try {
      const appointment = await appointmentsApi.update(id, payload);
      toast.success('Appointment updated successfully');
      await fetch();
      return appointment;
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to update appointment';
      toast.error(message);
      return null;
    }
  }, [fetch]);

  const cancel = useCallback(async (id: string): Promise<boolean> => {
    try {
      await appointmentsApi.cancel(id);
      toast.success('Appointment cancelled successfully');
      await fetch();
      return true;
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Failed to cancel appointment';
      toast.error(message);
      return false;
    }
  }, [fetch]);

  return {
    ...state,
    refetch: fetch,
    create,
    update,
    cancel,
  };
}
