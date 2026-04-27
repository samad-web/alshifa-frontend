import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { selfExamService, type SelfExamBundle } from "@/services/selfExam.service";
import { BundleView } from "@/components/selfexam/BundleView";

/**
 * Triage urgency badge — shared between DoctorDashboard and TherapistDashboard
 * pending/today appointment cards. Returns `null` when no level is supplied so
 * the caller can drop it inline without conditional wrappers.
 */
export function urgencyBadge(level?: string | null) {
  if (!level) return null;
  const map: Record<string, string> = {
    CRITICAL: "bg-red-600 text-white",
    URGENT: "bg-red-500 text-white",
    HIGH: "bg-orange-500 text-white",
    MODERATE: "bg-yellow-500 text-white",
    LOW: "bg-emerald-500 text-white",
  };
  return (
    <Badge className={cn("text-[10px]", map[level] ?? "bg-slate-400 text-white")}>
      {level}
    </Badge>
  );
}

/**
 * Lazy-loads and renders the patient's self-examination protocol submission
 * for an appointment. Used inside the "Pre-consultation kit" / "Triage details"
 * expand on dashboard appointment cards. Self-hides when there is no bundle
 * (404 from the service) or on error so the parent expand panel stays clean.
 */
export function SelfExamBundlePanel({ appointmentId }: { appointmentId: string }) {
  const [bundle, setBundle] = useState<SelfExamBundle | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "none" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    selfExamService
      .getByAppointment(appointmentId)
      .then((b) => {
        if (cancelled) return;
        setBundle(b);
        setState("ready");
      })
      .catch((err: { status?: number }) => {
        if (cancelled) return;
        if (err?.status === 404) setState("none");
        else setState("error");
      });
    return () => { cancelled = true; };
  }, [appointmentId]);

  if (state === "loading") {
    return (
      <div className="rounded bg-muted/40 p-3 text-xs text-muted-foreground">
        Loading self-exam bundle…
      </div>
    );
  }
  if (state === "none" || state === "error" || !bundle) return null;

  const { submission, completion } = bundle;
  const pct = completion.totalCount === 0
    ? 0
    : Math.round((completion.completedCount / completion.totalCount) * 100);
  return (
    <div className="rounded border bg-background p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <ClipboardList className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Self-Exam Bundle</span>
        <Badge variant={submission.status === "SUBMITTED" ? "default" : "secondary"}>
          {submission.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {completion.completedCount}/{completion.totalCount} ({pct}%)
        </span>
      </div>
      <BundleView bundle={bundle} />
    </div>
  );
}
