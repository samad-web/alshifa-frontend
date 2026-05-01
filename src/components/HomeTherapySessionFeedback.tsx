/**
 * Home Therapy — Session Completion + Feedback Flow (Task 8).
 *
 * Two reusable modals:
 *
 *   <TherapistCompleteSessionModal />
 *     Step 1 — confirmation copy + Yes/Cancel
 *     On confirm → POST /api/home-therapy/sessions/:id/complete
 *     Step 2 — therapist feedback (5-star rating, multi-select tag pills,
 *     optional notes). Submit → POST /api/feedback/home-therapy-session
 *     with { authorRole: 'THERAPIST' }.
 *     After submit, hand control back to the parent which decides what to
 *     do next (the therapist dashboard surfaces a "Next Patient" card).
 *
 *   <PatientHomeTherapyFeedbackModal />
 *     Single step. Triggered by Socket.IO `session_completed` on the
 *     patient's user room. Submits to the same endpoint with
 *     `{ authorRole: 'PATIENT' }`.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Star, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import {
  homeTherapyService,
  type HomeTherapySession,
} from "@/services/homeTherapy.service";
import { apiClient, ApiClientError } from "@/lib/api-client";

/**
 * Format a thrown error for the user-facing toast. Pulls structured context
 * out of ApiClientError (HTTP status + server message) so the description
 * actually tells the therapist what went wrong, instead of just
 * "Submission failed". Also catches network/CORS failures, where `fetch()`
 * throws a plain TypeError with no status info.
 */
function describeSubmitError(err: unknown): { description: string; raw: string } {
  if (err instanceof ApiClientError) {
    const code = err.status;
    const detail = err.details && err.details.length > 0
      ? err.details.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join("; ")
      : err.message;
    return {
      description: `(${code}) ${detail || err.message || "Server rejected the request"}`,
      raw: `${code} ${err.message}${detail ? ` — ${detail}` : ""}`,
    };
  }
  if (err instanceof TypeError) {
    return {
      description: "Network error — couldn't reach the backend. Check the server is running and CORS allows http://localhost:8080.",
      raw: err.message,
    };
  }
  if (err instanceof Error) return { description: err.message || "Unknown error", raw: err.message };
  return { description: "Unknown error", raw: String(err) };
}

const THERAPIST_TAGS = [
  { value: "PATIENT_COOPERATIVE",      label: "Patient cooperative" },
  { value: "HOME_SUITABLE",            label: "Home suitable" },
  { value: "EQUIPMENT_ADEQUATE",       label: "Equipment adequate" },
  { value: "SESSION_COMPLETED_FULLY",  label: "Session completed fully" },
  { value: "FOLLOWUP_NEEDED",          label: "Follow-up needed" },
] as const;

const PATIENT_TAGS = [
  { value: "THERAPIST_ON_TIME",  label: "On time" },
  { value: "PROFESSIONAL",       label: "Professional" },
  { value: "TREATMENT_HELPFUL",  label: "Treatment helpful" },
  { value: "COMFORTABLE",        label: "Comfortable" },
  { value: "WOULD_RECOMMEND",    label: "Would recommend" },
] as const;

interface StarRatingProps {
  value: number;
  onChange: (n: number) => void;
  size?: "sm" | "md" | "lg";
}

function StarRating({ value, onChange, size = "md" }: StarRatingProps) {
  const cls = size === "lg" ? "w-8 h-8" : size === "sm" ? "w-4 h-4" : "w-6 h-6";
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              cls,
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
    </div>
  );
}

interface TagPillsProps {
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}

function TagPills({ options, selected, onToggle }: TagPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            aria-pressed={active}
            className={cn(
              "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border/60 hover:bg-secondary/30",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Therapist completion modal
// ─────────────────────────────────────────────────────────────────────

export interface TherapistCompleteSessionModalProps {
  session: HomeTherapySession | null;
  /** Closes the modal — caller must reset its `session` prop to null. */
  onClose: () => void;
  /** Fired after the therapist successfully submits feedback. The dashboard
   *  uses this to refresh the schedule and drop in the "Next Patient" card. */
  onComplete: (sessionId: string) => void;
}

export function TherapistCompleteSessionModal({
  session,
  onClose,
  onComplete,
}: TherapistCompleteSessionModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"confirm" | "feedback">("confirm");
  const [completing, setCompleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [nextSession, setNextSession] = useState<HomeTherapySession | null>(null);

  // Reset internal state every time a new session is targeted.
  useEffect(() => {
    setStep("confirm");
    setRating(0);
    setTags([]);
    setNotes("");
    setNextSession(null);
  }, [session?.id]);

  const isOpen = !!session;
  const total  = session?.request?.totalSessions ?? null;

  const onConfirmComplete = async () => {
    if (!session) return;
    setCompleting(true);
    try {
      await homeTherapyService.complete(session.id);
      // Pre-fetch the next session so step 2 can render the "Next Patient"
      // card immediately on submit without a second round-trip.
      try {
        const next = await homeTherapyService.getNext(session.id);
        setNextSession(next);
      } catch { /* silent — next-session is optional */ }
      setStep("feedback");
    } catch (err) {
      toast({
        title: "Failed to mark session complete",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      setCompleting(false);
    }
  };

  const toggleTag = (val: string) => setTags((prev) =>
    prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]
  );

  const onSubmitFeedback = async () => {
    if (!session) return;
    if (rating < 1) {
      toast({ title: "Pick a rating before submitting", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post("/api/feedback/home-therapy-session", {
        sessionId: session.id,
        authorRole: "THERAPIST",
        rating,
        tags,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Feedback submitted", description: "Thanks for the update." });
      onComplete(session.id);
      onClose();
    } catch (err) {
      const { description, raw } = describeSubmitError(err);
      // Allow "already submitted" to count as a soft success — the session
      // is closed regardless, and the therapist might be re-opening from
      // an earlier interrupted submit.
      if (/already submitted/i.test(description)) {
        toast({ title: "Feedback already on file" });
        onComplete(session.id);
        onClose();
        return;
      }
      // Echo the raw error to the console too so it's visible in DevTools
      // (the toast can be dismissed before the user reads the details).
      console.error("[home-therapy feedback] therapist submit failed:", raw, err);
      toast({
        title: "Submission failed",
        description,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onSkipFeedback = () => {
    if (!session) return;
    onComplete(session.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            {step === "confirm" ? "Mark Session Complete" : "Session Feedback"}
          </DialogTitle>
          {session && (
            <DialogDescription>
              {step === "confirm" ? (
                <>
                  Are you sure you want to mark Session{" "}
                  <span className="font-semibold text-foreground">{session.sessionNumber}</span>
                  {total ? (
                    <> of <span className="font-semibold text-foreground">{total}</span></>
                  ) : null}{" "}
                  as complete?
                </>
              ) : (
                <>How did the session with {session.patient?.fullName ?? "the patient"} go?</>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "confirm" && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={completing}>Cancel</Button>
            <Button onClick={onConfirmComplete} disabled={completing} className="gap-2">
              {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Yes, Complete
            </Button>
          </DialogFooter>
        )}

        {step === "feedback" && session && (
          <div className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="mt-2"><StarRating value={rating} onChange={setRating} size="lg" /></div>
            </div>
            <div>
              <Label>Tags</Label>
              <div className="mt-2"><TagPills options={THERAPIST_TAGS} selected={tags} onToggle={toggleTag} /></div>
            </div>
            <div>
              <Label htmlFor="ht-fb-notes">Notes (optional)</Label>
              <Textarea
                id="ht-fb-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
                maxLength={1000}
                placeholder="Anything the doctor / admin should know about this session…"
                className="mt-1 min-h-[88px]"
              />
              <p className="text-[11px] text-muted-foreground text-right">{notes.length}/1000</p>
            </div>

            {nextSession && <NextPatientCard session={nextSession} />}

            <DialogFooter>
              <Button variant="ghost" onClick={onSkipFeedback} disabled={submitting}>Skip</Button>
              <Button onClick={onSubmitFeedback} disabled={submitting || rating < 1} className="gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Submit Feedback
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NextPatientCard({ session }: { session: HomeTherapySession }) {
  const lat = session.patient?.latitude ?? null;
  const lng = session.patient?.longitude ?? null;
  const directionsHref = lat != null && lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null;
  const address = [session.patient?.addressLine1, session.patient?.city]
    .filter(Boolean)
    .join(", ");
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-wide text-primary">Next Patient</div>
      <div className="text-sm font-semibold text-foreground">{session.patient?.fullName ?? "Patient"}</div>
      {address && <div className="text-xs text-muted-foreground">{address}</div>}
      <div className="text-xs text-muted-foreground">Scheduled at {session.scheduledTime}</div>
      {directionsHref && (
        <Button asChild size="sm" variant="outline" className="mt-1">
          <a href={directionsHref} target="_blank" rel="noreferrer noopener">Get Directions</a>
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Patient feedback modal
// ─────────────────────────────────────────────────────────────────────

export interface PatientHomeTherapyFeedbackModalProps {
  /** When set, the modal is open and bound to this sessionId. null = closed. */
  sessionId: string | null;
  onClose: () => void;
}

export function PatientHomeTherapyFeedbackModal({
  sessionId,
  onClose,
}: PatientHomeTherapyFeedbackModalProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRating(0); setTags([]); setNotes("");
  }, [sessionId]);

  const isOpen = !!sessionId;
  const toggleTag = (val: string) => setTags((prev) =>
    prev.includes(val) ? prev.filter((t) => t !== val) : [...prev, val]
  );

  const onSubmit = async () => {
    if (!sessionId) return;
    if (rating < 1) {
      toast({ title: "Pick a rating before submitting", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post("/api/feedback/home-therapy-session", {
        sessionId,
        authorRole: "PATIENT",
        rating,
        tags,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Thank you!", description: "Your feedback helps us improve." });
      onClose();
    } catch (err) {
      const { description, raw } = describeSubmitError(err);
      if (/already submitted/i.test(description)) {
        toast({ title: "We've recorded your feedback already" });
        onClose();
        return;
      }
      console.error("[home-therapy feedback] patient submit failed:", raw, err);
      toast({
        title: "Submission failed",
        description,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>How was your home therapy session?</DialogTitle>
          <DialogDescription>
            Your rating helps us improve our service.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Rating</Label>
            <div className="mt-2 flex justify-center"><StarRating value={rating} onChange={setRating} size="lg" /></div>
          </div>
          <div>
            <Label>What stood out?</Label>
            <div className="mt-2"><TagPills options={PATIENT_TAGS} selected={tags} onToggle={toggleTag} /></div>
          </div>
          <div>
            <Label htmlFor="ht-pt-notes">Notes (optional)</Label>
            <Textarea
              id="ht-pt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
              maxLength={1000}
              placeholder="Anything you'd like the clinic to know…"
              className="mt-1 min-h-[80px]"
            />
            <p className="text-[11px] text-muted-foreground text-right">{notes.length}/1000</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Skip</Button>
          <Button onClick={onSubmit} disabled={submitting || rating < 1} className="gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TherapistCompleteSessionModal;
