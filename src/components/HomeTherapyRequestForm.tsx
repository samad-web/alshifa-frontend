import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Hospital,
  AlertTriangle,
  CalendarRange,
  Loader2,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

export type HomeTherapyMode = "HOME" | "HOSPITAL";

export interface HomeTherapyDraft {
  /** Whether the doctor enabled the section. */
  enabled: boolean;
  /** Total sessions required. 0 = "no value yet" (default for fresh form). */
  totalSessions: number;
  /** Per-session mode array. Length must equal totalSessions on submit. */
  sessionModes: HomeTherapyMode[];
  /** Whether the doctor wants to specify a between-session interval. */
  intervalEnabled: boolean;
  /** Days between sessions when intervalEnabled. 1 = daily, 7 = weekly. */
  intervalDays: number;
  notes: string;
}

export const EMPTY_HOME_THERAPY_DRAFT: HomeTherapyDraft = {
  enabled: false,
  // Default to 0 so the field reads as "set me" rather than a magic 1.
  // The 0 visually clears on focus (UX detail handled in the input below).
  totalSessions: 0,
  sessionModes: [],
  intervalEnabled: false,
  // 1 day = daily. Reasonable starting point if the doctor flips the toggle.
  intervalDays: 1,
  notes: "",
};

const INTERVAL_PRESETS: Array<{ days: number; label: string }> = [
  { days: 1,  label: "Daily" },
  { days: 2,  label: "Every other day" },
  { days: 3,  label: "Every 3 days" },
  { days: 7,  label: "Weekly" },
  { days: 14, label: "Fortnightly" },
];

interface BranchTherapist {
  id: string;
  fullName?: string | null;
  specialization?: string | null;
  branchId?: string | null;
}

export interface HomeTherapyRequestFormProps {
  draft: HomeTherapyDraft;
  onChange: (next: HomeTherapyDraft) => void;
  /** Patient's branch — used to fetch the available-therapist preview. */
  branchId?: string | null;
}

/**
 * Inline section appended to the prescription composer. Visible only to
 * DOCTOR / ADMIN_DOCTOR (the parent gates this).
 *
 * Step 1 — Yes/No toggle ("Is therapist referral required?")
 *          + a small "available therapists in this branch" preview so the
 *          doctor knows there's capacity. Admin still does the actual
 *          assignment during approval.
 * Step 2 — Numeric "Total therapy sessions" (defaults to 0 — the placeholder
 *          shows "Enter sessions"; min 1 / max 50 enforced on submit).
 *          Each row picks Hospital / Home Therapy. Quick links flip all
 *          rows at once.
 * Step 3 — Optional "Specify scheduling interval" toggle. When on, presets
 *          + custom-days input. Persists as `intervalDays` on
 *          HomeTherapyRequest.
 * Step 4 — Optional notes (max 500 chars).
 *
 * The draft is owned by the parent so it can include `homeTherapy` in the
 * batch-add payload. This component is purely a controlled UI surface
 * (with one local state: the available-therapists fetch).
 */
export function HomeTherapyRequestForm({
  draft,
  onChange,
  branchId,
}: HomeTherapyRequestFormProps) {
  // Display string for totalSessions input — kept separate from the numeric
  // model so we can show empty when value is 0 (the user hasn't picked yet).
  const [totalDisplay, setTotalDisplay] = useState<string>(
    draft.totalSessions > 0 ? String(draft.totalSessions) : "",
  );

  // Reset the display when the model is reset externally (form remount,
  // post-submit clear, etc.).
  useEffect(() => {
    if (draft.totalSessions === 0 && totalDisplay !== "") setTotalDisplay("");
    if (draft.totalSessions > 0 && totalDisplay === "") setTotalDisplay(String(draft.totalSessions));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.totalSessions]);

  // Available-therapists preview — informational only. Lazily fetched the
  // first time the doctor flips "Yes". Kept local because no other part of
  // the prescription form needs the list.
  const [therapists, setTherapists] = useState<BranchTherapist[] | null>(null);
  const [therapistsLoading, setTherapistsLoading] = useState(false);
  const [therapistsExpanded, setTherapistsExpanded] = useState(false);

  useEffect(() => {
    if (!draft.enabled) return;
    if (therapists !== null) return;
    if (!branchId) {
      // No branch context — can't filter the roster meaningfully.
      setTherapists([]);
      return;
    }
    setTherapistsLoading(true);
    apiClient
      .get<BranchTherapist[]>("/api/user/list-therapists", { branchId })
      .then((rows) => setTherapists(Array.isArray(rows) ? rows : []))
      .catch(() => setTherapists([]))
      .finally(() => setTherapistsLoading(false));
  }, [draft.enabled, branchId, therapists]);

  const setEnabled = (enabled: boolean) => {
    if (enabled) {
      onChange({ ...draft, enabled: true });
    } else {
      // Soft disable — keep typed values so re-enabling doesn't wipe them.
      onChange({ ...draft, enabled: false });
    }
  };

  // Keep sessionModes length in sync with totalSessions. Adding rows defaults
  // them to HOME (the most common case for home-therapy referrals). When
  // totalSessions is 0 we hold an empty modes array.
  useEffect(() => {
    if (!draft.enabled) return;
    if (draft.totalSessions <= 0) {
      if (draft.sessionModes.length !== 0) onChange({ ...draft, sessionModes: [] });
      return;
    }
    if (draft.sessionModes.length === draft.totalSessions) return;
    const next: HomeTherapyMode[] = Array.from({ length: draft.totalSessions }, (_, i) =>
      draft.sessionModes[i] ?? "HOME",
    );
    onChange({ ...draft, sessionModes: next });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.enabled, draft.totalSessions]);

  const setTotal = (raw: string) => {
    setTotalDisplay(raw);
    if (raw.trim() === "") {
      onChange({ ...draft, totalSessions: 0 });
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(0, Math.min(50, parsed));
    onChange({ ...draft, totalSessions: clamped });
  };

  const handleTotalFocus = () => {
    // The "0 disappears on focus" UX requested by the doctor — clear the
    // visual input so they can type the real number without backspacing.
    if (draft.totalSessions === 0) setTotalDisplay("");
  };

  const handleTotalBlur = () => {
    // Re-sync the display in case the user blurred without typing.
    setTotalDisplay(draft.totalSessions > 0 ? String(draft.totalSessions) : "");
  };

  const setMode = (idx: number, mode: HomeTherapyMode) => {
    const next = draft.sessionModes.slice();
    next[idx] = mode;
    onChange({ ...draft, sessionModes: next });
  };

  const setAll = (mode: HomeTherapyMode) => {
    if (draft.totalSessions <= 0) return;
    onChange({
      ...draft,
      sessionModes: Array.from({ length: draft.totalSessions }, () => mode),
    });
  };

  const setIntervalEnabled = (intervalEnabled: boolean) => {
    onChange({
      ...draft,
      intervalEnabled,
      // Snap to 1 (daily) if the user toggles on without a prior value.
      intervalDays: intervalEnabled ? Math.max(1, Math.min(30, draft.intervalDays || 1)) : draft.intervalDays,
    });
  };

  const setIntervalDays = (days: number) => {
    if (!Number.isFinite(days)) return;
    const clamped = Math.max(1, Math.min(30, Math.round(days)));
    onChange({ ...draft, intervalDays: clamped });
  };

  const counts = useMemo(() => {
    let home = 0;
    let hospital = 0;
    for (const m of draft.sessionModes) {
      if (m === "HOME") home += 1;
      else if (m === "HOSPITAL") hospital += 1;
    }
    return { home, hospital };
  }, [draft.sessionModes]);

  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/10 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-primary" />
          <Label className="text-sm font-bold">Therapist Referral</Label>
          <Badge variant="outline" className="text-[10px]">Optional</Badge>
        </div>
        {draft.enabled && draft.totalSessions > 0 && (
          <span className="text-xs text-muted-foreground">
            {counts.home} Home · {counts.hospital} Hospital
            {draft.intervalEnabled ? ` · every ${draft.intervalDays}d` : ""}
          </span>
        )}
      </div>

      {/* Step 1 — Therapist Required toggle */}
      <div>
        <Label className="text-xs text-muted-foreground">Is therapist referral required?</Label>
        <div className="mt-2 inline-flex rounded-xl border border-border/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setEnabled(false)}
            aria-pressed={!draft.enabled}
            className={cn(
              "px-5 py-2 text-sm font-semibold transition-colors",
              !draft.enabled ? "bg-secondary text-foreground" : "bg-background text-muted-foreground hover:bg-secondary/30",
            )}
          >
            No
          </button>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            aria-pressed={draft.enabled}
            className={cn(
              "px-5 py-2 text-sm font-semibold transition-colors",
              draft.enabled ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary/30",
            )}
          >
            Yes
          </button>
        </div>
      </div>

      {/* Steps 2–4 only render when enabled */}
      {draft.enabled && (
        <>
          {/* Available therapists preview — informational. Admin assigns
              the actual therapist during approval. */}
          <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setTherapistsExpanded((v) => !v)}
              className="w-full flex items-center justify-between text-left"
              aria-expanded={therapistsExpanded}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {therapistsLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading available therapists…
                  </span>
                ) : therapists === null ? (
                  <span>Available therapists in this branch</span>
                ) : therapists.length === 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    No therapists registered in this branch — admin will assign on approval.
                  </span>
                ) : (
                  <span>
                    {therapists.length} therapist{therapists.length === 1 ? "" : "s"} available in this branch · admin will assign one
                  </span>
                )}
              </div>
              {therapists && therapists.length > 0 && (
                therapistsExpanded
                  ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                  : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
            {therapistsExpanded && therapists && therapists.length > 0 && (
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                {therapists.map((t) => (
                  <li key={t.id} className="text-xs text-foreground flex items-center gap-2">
                    <span className="font-medium truncate">{t.fullName || "Therapist"}</span>
                    {t.specialization && (
                      <span className="text-muted-foreground truncate">· {t.specialization}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Step 2 — Total sessions + per-session mode */}
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 items-end">
              <div className="space-y-1.5">
                <Label htmlFor="ht-total">Total therapy sessions required</Label>
                <Input
                  id="ht-total"
                  type="number"
                  min={0}
                  max={50}
                  inputMode="numeric"
                  // Empty string when value is 0 so the placeholder shows.
                  value={totalDisplay}
                  onChange={(e) => setTotal(e.target.value)}
                  onFocus={handleTotalFocus}
                  onBlur={handleTotalBlur}
                  placeholder="Enter sessions"
                  className="h-11"
                />
                <p className="text-[11px] text-muted-foreground">Min 1 · Max 50</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAll("HOME")}
                  disabled={draft.totalSessions <= 0}
                  className="text-xs text-primary underline hover:no-underline inline-flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
                >
                  <Home className="w-3 h-3" /> Set all to Home
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() => setAll("HOSPITAL")}
                  disabled={draft.totalSessions <= 0}
                  className="text-xs text-primary underline hover:no-underline inline-flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
                >
                  <Hospital className="w-3 h-3" /> Set all to Hospital
                </button>
              </div>
            </div>

            {draft.totalSessions > 0 ? (
              <div className="rounded-xl border border-border/40 bg-background/60 divide-y divide-border/40 max-h-72 overflow-y-auto">
                {draft.sessionModes.map((mode, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="text-sm font-medium text-foreground">Session {i + 1}</div>
                    <div className="inline-flex rounded-lg overflow-hidden border border-border/60">
                      <button
                        type="button"
                        aria-pressed={mode === "HOSPITAL"}
                        onClick={() => setMode(i, "HOSPITAL")}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors",
                          mode === "HOSPITAL"
                            ? "bg-blue-600 text-white"
                            : "bg-background text-muted-foreground hover:bg-secondary/30",
                        )}
                      >
                        <Hospital className="w-3 h-3" /> Hospital
                      </button>
                      <button
                        type="button"
                        aria-pressed={mode === "HOME"}
                        onClick={() => setMode(i, "HOME")}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors",
                          mode === "HOME"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground hover:bg-secondary/30",
                        )}
                      >
                        <Home className="w-3 h-3" /> Home Therapy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/50 bg-background/30 px-3 py-4 text-center text-xs text-muted-foreground">
                Enter the number of sessions to choose Home / Hospital for each.
              </div>
            )}
          </div>

          {/* Step 3 — Optional scheduling interval */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-primary" />
                <Label className="text-sm font-semibold">Schedule interval</Label>
                <span className="text-[11px] text-muted-foreground">(optional)</span>
              </div>
              <div className="inline-flex rounded-lg border border-border/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIntervalEnabled(false)}
                  aria-pressed={!draft.intervalEnabled}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                    !draft.intervalEnabled ? "bg-secondary text-foreground" : "bg-background text-muted-foreground hover:bg-secondary/30",
                  )}
                >
                  Not specified
                </button>
                <button
                  type="button"
                  onClick={() => setIntervalEnabled(true)}
                  aria-pressed={draft.intervalEnabled}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold transition-colors",
                    draft.intervalEnabled ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary/30",
                  )}
                >
                  Specify
                </button>
              </div>
            </div>

            {draft.intervalEnabled && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {INTERVAL_PRESETS.map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setIntervalDays(p.days)}
                      aria-pressed={draft.intervalDays === p.days}
                      className={cn(
                        "px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors",
                        draft.intervalDays === p.days
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-foreground border-border/60 hover:bg-secondary/30",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Custom:</span>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    inputMode="numeric"
                    value={draft.intervalDays}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(parsed)) setIntervalDays(parsed);
                    }}
                    className="h-8 w-20"
                  />
                  <span>day{draft.intervalDays === 1 ? "" : "s"} between sessions</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Admin uses this hint when scheduling each session during approval.
                </p>
              </div>
            )}
          </div>

          {/* Step 4 — Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="ht-notes">Instructions for therapist (optional)</Label>
            <Textarea
              id="ht-notes"
              value={draft.notes}
              onChange={(e) => onChange({ ...draft, notes: e.target.value.slice(0, 500) })}
              maxLength={500}
              placeholder="Any specific instructions, contraindications, or focus areas for the therapist…"
              className="min-h-[88px]"
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {draft.notes.length}/500
            </p>
          </div>

          {/* Approval-required banner */}
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This request will be sent for admin approval before sessions are scheduled.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default HomeTherapyRequestForm;

/**
 * Validation result for a HomeTherapyDraft. The `error` describes why the
 * payload can't ship — surface this via toast in the parent form.
 */
export type HomeTherapyValidation =
  | { ok: true; payload: ReturnType<typeof unsafeBuildPayload> }
  | { ok: false; error: string };

function unsafeBuildPayload(draft: HomeTherapyDraft) {
  const out: {
    totalSessions: number;
    sessionModes: HomeTherapyMode[];
    notes?: string;
    intervalDays?: number;
  } = {
    totalSessions: draft.totalSessions,
    sessionModes: draft.sessionModes.slice(),
  };
  if (draft.notes.trim()) out.notes = draft.notes.trim().slice(0, 500);
  if (draft.intervalEnabled) out.intervalDays = draft.intervalDays;
  return out;
}

/**
 * Convert a HomeTherapyDraft into the API payload, with explicit validation.
 * Returns { ok: true, payload } or { ok: false, error } so the caller can
 * show a precise toast (e.g. "Set the number of sessions before saving").
 *
 * Skipped (returns ok: true with payload: null) when the section is disabled.
 */
export function validateHomeTherapyDraft(
  draft: HomeTherapyDraft,
): { ok: true; payload: ReturnType<typeof unsafeBuildPayload> | null } | { ok: false; error: string } {
  if (!draft.enabled) return { ok: true, payload: null };
  if (!Number.isInteger(draft.totalSessions) || draft.totalSessions < 1) {
    return { ok: false, error: "Set the number of therapy sessions before saving." };
  }
  if (draft.totalSessions > 50) {
    return { ok: false, error: "Total sessions cannot exceed 50." };
  }
  if (draft.sessionModes.length !== draft.totalSessions) {
    return { ok: false, error: "Session modes are out of sync — refresh and try again." };
  }
  if (draft.intervalEnabled) {
    if (!Number.isInteger(draft.intervalDays) || draft.intervalDays < 1 || draft.intervalDays > 30) {
      return { ok: false, error: "Interval must be between 1 and 30 days." };
    }
  }
  return { ok: true, payload: unsafeBuildPayload(draft) };
}

/**
 * Legacy helper kept for back-compat with the parent's prior call site.
 * Returns the payload when valid, null when the section is off OR invalid.
 * New callers should prefer `validateHomeTherapyDraft` so they can surface
 * a precise error message.
 */
export function toHomeTherapyPayload(draft: HomeTherapyDraft) {
  const res = validateHomeTherapyDraft(draft);
  if (!res.ok) return null;
  return res.payload;
}
