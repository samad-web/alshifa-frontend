import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";

/**
 * Shared loader for the doctor + therapist roster of a branch.
 *
 * Several pages (StaffDirectory, AttendanceTracker, BranchAdminDashboard)
 * fetched these two endpoints in parallel and built the same row shape.
 * This hook centralises the load + normalisation so callers get a single
 * `staff` array with a stable shape and a `refresh()` to re-fetch on
 * demand (e.g. after creating/removing a staff member).
 *
 * The backend pins BRANCH_ADMIN to their JWT branchId, so passing the
 * branchId from `useAuth().profile.branchId` is sufficient for that role.
 * For ADMIN / ADMIN_DOCTOR, pass the navbar-selected branch (or omit to
 * fetch the active list — the controller still scopes by hospital).
 */
export type BranchStaffRole = "DOCTOR" | "THERAPIST";

export interface BranchStaffRow {
    /** Doctor.id or Therapist.id (the profile-table primary key). */
    profileId: string;
    /** User.id — needed for attendance, scorecards, anything keyed on User. */
    userId: string | null;
    fullName: string | null;
    email: string | null;
    role: BranchStaffRole;
    profilePhoto: string | null;
    specialization: string | null;
    qualification: string | null;
    branchId: string | null;
    branchName: string | null;
    /** Doctor-only — therapists don't surface availability in the list payload. */
    availability?: "AVAILABLE" | "UNAVAILABLE" | "AT_CAPACITY" | null;
    unavailableReason?: string | null;
    appointmentCount?: number;
    appointmentsToday?: number;
}

interface UseBranchStaffResult {
    staff: BranchStaffRow[];
    loading: boolean;
    error: Error | null;
    refresh: () => void;
}

export function useBranchStaff(branchId: string | null | undefined): UseBranchStaffResult {
    const [staff, setStaff] = useState<BranchStaffRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const params = branchId ? { branchId } : undefined;
                const [{ data: docs }, { data: thers }] = await Promise.all([
                    apiClient.get<unknown[]>("/api/user/list-doctors", params),
                    apiClient.get<unknown[]>("/api/user/list-therapists", params),
                ]);
                if (cancelled) return;
                const rows: BranchStaffRow[] = [
                    ...((docs as Record<string, unknown>[]) || []).map(toRow("DOCTOR")),
                    ...((thers as Record<string, unknown>[]) || []).map(toRow("THERAPIST")),
                ].filter((r) => r.profileId);
                setStaff(rows);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [branchId, refreshKey]);

    return useMemo(
        () => ({ staff, loading, error, refresh: () => setRefreshKey((k) => k + 1) }),
        [staff, loading, error],
    );
}

function toRow(role: BranchStaffRole) {
    return (raw: Record<string, unknown>): BranchStaffRow => {
        const user = (raw.user as Record<string, unknown> | undefined) ?? undefined;
        return {
            profileId:        String(raw.id ?? ""),
            userId:           (raw.userId as string | null | undefined)
                              ?? (user?.id as string | null | undefined)
                              ?? null,
            fullName:         (raw.fullName as string | null | undefined) ?? null,
            email:            (raw.email as string | null | undefined)
                              ?? (user?.email as string | null | undefined)
                              ?? null,
            role,
            profilePhoto:     (raw.profilePhoto as string | null | undefined) ?? null,
            specialization:   (raw.specialization as string | null | undefined) ?? null,
            qualification:    (raw.qualification as string | null | undefined) ?? null,
            branchId:         (raw.branchId as string | null | undefined) ?? null,
            branchName:       (raw.branchName as string | null | undefined) ?? null,
            availability:     role === "DOCTOR"
                                ? ((raw.availability as BranchStaffRow["availability"]) ?? null)
                                : undefined,
            unavailableReason: role === "DOCTOR"
                                ? ((raw.unavailableReason as string | null | undefined) ?? null)
                                : undefined,
            appointmentCount:  role === "DOCTOR" ? Number(raw.appointmentCount ?? 0) : undefined,
            appointmentsToday: role === "DOCTOR" ? Number(raw.appointmentsToday ?? 0) : undefined,
        };
    };
}
