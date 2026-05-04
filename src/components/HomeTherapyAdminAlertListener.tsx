/**
 * Admin-side socket listener that surfaces a popup whenever a doctor's
 * prescription creates a home-therapy request.
 *
 * Backend already fans out `home_therapy_request_created` to ADMIN /
 * ADMIN_DOCTOR / BRANCH_ADMIN (alshifa-backend/services/homeTherapy.service.js
 * → emitRequestCreated). This component is the global popup surface that
 * was missing — existing listeners (HomeTherapyRequests page, the pending-
 * count hook) only refresh data without alerting the admin in real time.
 *
 * Mounts inside <App> so the popup fires from any route. Renders nothing
 * for non-admin roles, so it's safe to leave permanently mounted.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { notify } from "@/lib/notify";
import { homeTherapyService } from "@/services/homeTherapy.service";

const ALERTING_ROLES = new Set(["ADMIN", "ADMIN_DOCTOR", "BRANCH_ADMIN"]);

interface RequestCreatedPayload {
  id: string;
  branchId?: string;
  patientId?: string;
  requestingDoctorId?: string;
  totalSessions?: number;
  sessionMode?: ("HOME" | "HOSPITAL")[];
  status?: string;
  createdAt?: string;
}

export function HomeTherapyAdminAlertListener() {
  const { role } = useAuth();
  const { socket, isConnected } = useWebSocket();

  // De-dupe: the same `id` can arrive twice if the backend redelivers on
  // reconnect. We just track the last few seen ids in a ref so refreshes
  // don't re-popup the same request.
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!socket || !isConnected) return;
    if (!role || !ALERTING_ROLES.has(role)) return;

    const handler = async (payload: RequestCreatedPayload) => {
      // Catch-all so a malformed payload, a failing service call, or a
      // notify-system hiccup can never bubble up to React and unmount the
      // surrounding page. The listener is best-effort; better to drop a
      // popup than to break the admin's session.
      try {
        if (!payload?.id) return;
        if (seenIdsRef.current.has(payload.id)) return;
        seenIdsRef.current.add(payload.id);
        if (seenIdsRef.current.size > 100) {
          const arr = Array.from(seenIdsRef.current);
          seenIdsRef.current = new Set(arr.slice(-100));
        }

        let patientName: string | null = null;
        let doctorName: string | null = null;
        let totalSessions = payload.totalSessions ?? 0;
        let modes = payload.sessionMode ?? [];
        try {
          const full = await homeTherapyService.getRequest(payload.id);
          patientName = full?.patient?.fullName ?? null;
          doctorName  = full?.requestingDoctor?.fullName ?? null;
          totalSessions = full?.totalSessions ?? totalSessions;
          modes = full?.sessionMode ?? modes;
        } catch {
          // Fall back to the lean payload — better a popup with IDs than
          // silently dropping the alert if the GET fails.
        }

        const homeCount = modes.filter((m) => m === "HOME").length;
        const hospitalCount = modes.filter((m) => m === "HOSPITAL").length;
        const breakdown = totalSessions > 0
          ? [
              homeCount     > 0 ? `${homeCount} home`         : null,
              hospitalCount > 0 ? `${hospitalCount} hospital` : null,
            ].filter(Boolean).join(" + ")
          : "";

        const title = patientName
          ? `New therapy request — ${patientName}`
          : "New therapy request";
        const descParts: string[] = [];
        if (doctorName)             descParts.push(`From Dr. ${doctorName}`);
        if (totalSessions > 0)      descParts.push(`${totalSessions} session${totalSessions > 1 ? "s" : ""}${breakdown ? ` (${breakdown})` : ""}`);
        descParts.push("Pending your approval — open Home Therapy to review.");

        notify.info(title, descParts.join(" · "));
      } catch (err) {
        console.warn("[HomeTherapyAdminAlertListener] popup failed:", err);
      }
    };

    socket.on("home_therapy_request_created", handler);
    return () => { socket.off("home_therapy_request_created", handler); };
  }, [socket, isConnected, role]);

  return null;
}

export default HomeTherapyAdminAlertListener;
