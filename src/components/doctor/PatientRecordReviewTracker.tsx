import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PatientRecordReviewTrackerProps {
  patientId: string;
}

interface ReviewResponse {
  xpAwarded?: number;
  totalXP?: number;
  alreadyAwarded?: boolean;
  tooShort?: boolean;
  excludedRole?: boolean;
  message?: string;
}

const REVIEW_THRESHOLD_SECS = 60;

/**
 * Visible chip that tracks how long a clinician has spent on a patient
 * record. Counts up to 60s, then auto-claims +15 XP via the backend.
 *
 *  • DOCTOR  — earns XP (capped to once per patient per day).
 *  • ADMIN_DOCTOR — backend acknowledges but the XP pipeline excludes the
 *    role; we surface that explicitly so the user knows the trigger fired.
 *  • Other roles — chip never renders.
 *
 * Rendered as a fixed bottom-right chip so it's discoverable without
 * crowding the page layout. A manual "Claim now" button is exposed once
 * the timer crosses the threshold for users who don't want to wait.
 */
export function PatientRecordReviewTracker({ patientId }: PatientRecordReviewTrackerProps) {
  const { role } = useAuth();
  const startedAt = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState<"counting" | "claiming" | "awarded" | "already" | "excluded" | "error">("counting");
  const claimedRef = useRef(false);

  const eligibleRole = role === "DOCTOR" || role === "ADMIN_DOCTOR";
  const [dismissed, setDismissed] = useState(false);

  // Debug: mounted-state log so the user can verify in DevTools that the
  // tracker actually rendered on the page they're testing on.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[PatientRecordReviewTracker] mounted", { patientId, role, eligibleRole });
  }, [patientId, role, eligibleRole]);

  // Auto-dismiss the chip a few seconds after it reaches a terminal state
  // so it stops blocking the right-column content (Retention Checklist /
  // Quick Templates) once its job is done. The toast already gives a
  // persistent ack for the same event.
  useEffect(() => {
    if (status === "awarded" || status === "already" || status === "excluded" || status === "error") {
      const t = setTimeout(() => setDismissed(true), 4000);
      return () => clearTimeout(t);
    }
  }, [status]);

  // Reset dismissal when the patient changes (new appointment → new tracker).
  useEffect(() => { setDismissed(false); }, [patientId]);

  // Tick every second so the chip shows live progress.
  useEffect(() => {
    if (!eligibleRole || !patientId) return;
    startedAt.current = Date.now();
    setElapsed(0);
    setStatus("counting");
    claimedRef.current = false;
    const t = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [patientId, eligibleRole]);

  // Auto-claim once the threshold is crossed. claimedRef guards against
  // re-entry from the interval / re-renders.
  useEffect(() => {
    if (!eligibleRole) return;
    if (claimedRef.current) return;
    if (elapsed < REVIEW_THRESHOLD_SECS) return;
    claimedRef.current = true;
    void claim(elapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, eligibleRole]);

  async function claim(durationSeconds: number) {
    setStatus("claiming");
    // eslint-disable-next-line no-console
    console.log("[PatientRecordReviewTracker] claiming", { patientId, durationSeconds });
    try {
      const { data } = await apiClient.post<ReviewResponse>(
        `/api/patients/${patientId}/record-review`,
        { durationSeconds },
      );
      // eslint-disable-next-line no-console
      console.log("[PatientRecordReviewTracker] response", data);
      if (data.xpAwarded && data.xpAwarded > 0) {
        setStatus("awarded");
        toast.success(`+${data.xpAwarded} XP · Patient review`, {
          icon: <FileText className="w-4 h-4" />,
          duration: 5000,
        });
      } else if (data.alreadyAwarded) {
        setStatus("already");
        toast.message("XP already awarded for reviewing this patient today.", {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
        });
      } else if (data.excludedRole) {
        setStatus("excluded");
        toast.message("Review tracked. Admin Doctors don't earn XP (oversight role).", {
          icon: <FileText className="w-4 h-4" />,
        });
      } else {
        setStatus("error");
        toast.error(data.message || "Could not record review.");
      }
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Could not record review.");
    }
  }

  if (!eligibleRole || !patientId || dismissed) return null;

  const remaining = Math.max(0, REVIEW_THRESHOLD_SECS - elapsed);

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[9999] rounded-2xl shadow-lg border-2 border-primary/40 bg-card text-foreground",
        "px-3 py-2 flex items-center gap-3 text-sm min-w-[220px] max-w-[260px] animate-in slide-in-from-right-2",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {status === "claiming" ? <Loader2 className="w-4 h-4 animate-spin" /> :
         status === "awarded"  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
         <FileText className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        {status === "counting" && remaining > 0 && (
          <>
            <div className="font-semibold leading-tight">Reviewing patient record</div>
            <div className="text-[11px] text-muted-foreground">
              +15 XP unlocks in <span className="tabular-nums font-medium">{remaining}s</span>
            </div>
          </>
        )}
        {status === "counting" && remaining === 0 && (
          <>
            <div className="font-semibold leading-tight">Ready to claim</div>
            <div className="text-[11px] text-muted-foreground">+15 XP — click claim</div>
          </>
        )}
        {status === "claiming" && (
          <div className="font-semibold leading-tight">Claiming XP…</div>
        )}
        {status === "awarded" && (
          <>
            <div className="font-semibold leading-tight text-emerald-700">+15 XP awarded</div>
            <div className="text-[11px] text-muted-foreground">Visible in your XP Dashboard</div>
          </>
        )}
        {status === "already" && (
          <>
            <div className="font-semibold leading-tight">Already claimed today</div>
            <div className="text-[11px] text-muted-foreground">One XP grant per patient per day</div>
          </>
        )}
        {status === "excluded" && (
          <>
            <div className="font-semibold leading-tight">Tracked (no XP)</div>
            <div className="text-[11px] text-muted-foreground">Admin Doctors are oversight, not participants</div>
          </>
        )}
        {status === "error" && (
          <div className="font-semibold leading-tight text-destructive">Couldn't record review</div>
        )}
      </div>
      {status === "counting" && remaining === 0 && (
        <Button
          size="sm"
          onClick={() => { claimedRef.current = true; void claim(elapsed); }}
        >
          Claim
        </Button>
      )}
    </div>
  );
}
