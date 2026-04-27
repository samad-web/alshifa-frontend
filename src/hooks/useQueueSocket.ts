import { useEffect } from "react";
import { useWebSocket } from "@/contexts/WebSocketContext";

export type QueueEvent =
  | "patient_arrived"
  | "consultation_started"
  | "consultation_ended"
  | "patient_absent"
  | "patient_contacted";

export interface QueueEventPayload {
  appointmentId: string;
  doctorId: string;
  branchId: string;
  arrivalStatus: string;
  contactNote?: string;
}

interface UseQueueSocketOptions {
  /** YYYY-MM-DD; defaults to today in the user's local TZ. */
  date?: string;
  /** Subscribe to the doctor's queue room. */
  doctorId?: string | null;
  /** Subscribe to the branch live-board room. */
  branchId?: string | null;
  /** Fired on any of the five queue events with the doctorId, branchId,
   *  appointmentId, and event name. The dashboard re-fetches the queue
   *  on every event — no client-side reducer attempts to merge state,
   *  which keeps positions/ranks server-authoritative. */
  onEvent?: (event: QueueEvent, payload: QueueEventPayload) => void;
}

const QUEUE_EVENTS: QueueEvent[] = [
  "patient_arrived",
  "consultation_started",
  "consultation_ended",
  "patient_absent",
  "patient_contacted",
];

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Subscribe a component to live queue events for a given doctor or branch.
 * The hook joins the appropriate Socket.IO room (`queue:doctor:...` or
 * `queue:branch:...`) on mount, re-joins on socket reconnect, and leaves
 * cleanly on unmount or when the target id changes.
 *
 * Pass either `doctorId` (Today's Queue panel) or `branchId` (Live Queue
 * Board) — both can be passed simultaneously when an admin doctor
 * watches their own queue and the branch board on the same page.
 */
export function useQueueSocket({ doctorId, branchId, date, onEvent }: UseQueueSocketOptions) {
  const { socket, isConnected } = useWebSocket();
  const dateKey = date || todayKey();

  useEffect(() => {
    if (!socket || !isConnected) return;
    if (!doctorId && !branchId) return;

    if (doctorId) socket.emit("join_queue_doctor", { doctorId, date: dateKey });
    if (branchId) socket.emit("join_queue_branch", { branchId, date: dateKey });

    const handlers: Record<string, (payload: QueueEventPayload) => void> = {};
    if (onEvent) {
      for (const ev of QUEUE_EVENTS) {
        const h = (payload: QueueEventPayload) => onEvent(ev, payload);
        handlers[ev] = h;
        socket.on(ev, h);
      }
    }

    return () => {
      if (doctorId) socket.emit("leave_queue_doctor", { doctorId, date: dateKey });
      if (branchId) socket.emit("leave_queue_branch", { branchId, date: dateKey });
      for (const ev of QUEUE_EVENTS) {
        const h = handlers[ev];
        if (h) socket.off(ev, h);
      }
    };
  }, [socket, isConnected, doctorId, branchId, dateKey, onEvent]);
}
