/**
 * Tracks the count of PENDING_APPROVAL home-therapy requests for the
 * current admin scope so the sidebar entry can render a badge.
 *
 * RBAC scope:
 *   - ADMIN: hospital-wide; honours the navbar branch switcher when set
 *   - ADMIN_DOCTOR / BRANCH_ADMIN: pinned to their own branch
 *   - any other role: returns 0 and never fetches
 *
 * Real-time updates via the default Socket.IO namespace:
 *   - `home_therapy_request_created` → count +1 (when branch matches scope)
 *   - `home_therapy_approved`        → refetch (the row left PENDING)
 *   - `home_therapy_rejected`        → refetch
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { homeTherapyService } from "@/services/homeTherapy.service";

const ADMIN_LIKE = new Set(["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN"]);

export function useHomeTherapyPendingCount(): number {
  const { profile, role } = useAuth();
  const { branchIdParam } = useBranchScope();
  const { socket, isConnected } = useWebSocket();
  const [count, setCount] = useState(0);

  const homeBranchId = (profile as { branchId?: string | null } | null)?.branchId ?? null;
  const effectiveBranchId =
    role === "BRANCH_ADMIN" || role === "ADMIN_DOCTOR"
      ? homeBranchId ?? undefined
      : branchIdParam;

  const enabled = !!role && ADMIN_LIKE.has(role);

  const refresh = useCallback(async () => {
    if (!enabled) { setCount(0); return; }
    try {
      const rows = await homeTherapyService.listRequests({
        branchId: effectiveBranchId,
        status: "PENDING_APPROVAL",
      });
      setCount(Array.isArray(rows) ? rows.length : 0);
    } catch {
      // Swallow — a transient failure should not crash the navbar.
    }
  }, [enabled, effectiveBranchId]);

  // Initial + scope-change fetch.
  useEffect(() => { refresh(); }, [refresh]);

  // Live updates.
  useEffect(() => {
    if (!enabled || !socket || !isConnected) return;
    const onCreated = (payload: { branchId?: string }) => {
      if (effectiveBranchId && payload?.branchId && payload.branchId !== effectiveBranchId) return;
      setCount((n) => n + 1);
    };
    const onAfterDecision = () => { refresh(); };
    socket.on("home_therapy_request_created", onCreated);
    socket.on("home_therapy_approved", onAfterDecision);
    socket.on("home_therapy_rejected", onAfterDecision);
    return () => {
      socket.off("home_therapy_request_created", onCreated);
      socket.off("home_therapy_approved", onAfterDecision);
      socket.off("home_therapy_rejected", onAfterDecision);
    };
  }, [enabled, socket, isConnected, effectiveBranchId, refresh]);

  return count;
}

export default useHomeTherapyPendingCount;
