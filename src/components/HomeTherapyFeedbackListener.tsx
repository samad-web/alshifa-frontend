/**
 * Patient-side socket listener for home-therapy session completion.
 *
 * Mounted by EnhancedPatientDashboard and PatientPortal. Subscribes to the
 * default Socket.IO namespace (where `session_completed` is fanned out via
 * `emitToUser(patient.userId, ...)` in homeTherapy.service.transitionSession)
 * and opens the patient feedback modal. Renders nothing until an event
 * arrives — safe to drop into any patient page.
 */

import { useEffect, useState } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { PatientHomeTherapyFeedbackModal } from "@/components/HomeTherapySessionFeedback";

interface SessionCompletedPayload {
  sessionId?: string;
  patientId?: string;
}

export function HomeTherapyFeedbackListener() {
  const { socket, isConnected } = useWebSocket();
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !isConnected) return;
    const handler = (payload: SessionCompletedPayload) => {
      if (payload?.sessionId) setPendingSessionId(payload.sessionId);
    };
    socket.on("session_completed", handler);
    return () => { socket.off("session_completed", handler); };
  }, [socket, isConnected]);

  return (
    <PatientHomeTherapyFeedbackModal
      sessionId={pendingSessionId}
      onClose={() => setPendingSessionId(null)}
    />
  );
}

export default HomeTherapyFeedbackListener;
