// "My Progress" tab — patient-facing therapy outcomes timeline.
//
// Pulls the caller's own TherapyOutcome rows via /api/therapy-outcomes/me
// and renders a headline % improvement on pain, two trend charts
// (pain / mobility), a swelling-reduced ratio for the current month, and
// the most-recent therapist observation + next-session goal. Hides the
// therapist's identity and any clinician-shorthand fields by design —
// patients see plain-language progress, not a clinical chart.

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, Heart, Sparkles, Quote, Target as TargetIcon,
} from "lucide-react";
import {
  therapyOutcomesApi,
  type TherapyOutcome,
} from "@/services/therapyOutcomes.service";
import { useAuth } from "@/hooks/useAuth";

const ONE_DAY_MS = 86_400_000;
const NINETY_DAYS_MS = 90 * ONE_DAY_MS;
const TWELVE_MONTHS_MS = 365 * ONE_DAY_MS;

// ── helpers ───────────────────────────────────────────────────────────────

function formatChartDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysAgo(iso: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / ONE_DAY_MS),
  );
}

function daysSpan(firstIso: string, lastIso: string): number {
  return Math.max(
    0,
    Math.floor(
      (new Date(lastIso).getTime() - new Date(firstIso).getTime()) / ONE_DAY_MS,
    ),
  );
}

// Identify "this calendar month" in the viewer's local timezone.
function isInCurrentMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

// ── component ─────────────────────────────────────────────────────────────

export function MyProgressTab() {
  const [showAll, setShowAll] = useState(false);
  const { profile } = useAuth();
  // Scope the cache by the logged-in user's id. Without this, the
  // QueryClient survives login/logout swaps and would return one
  // patient's outcomes to a different patient who later logs in on
  // the same browser session.
  const userId = profile?.id ?? null;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["therapyOutcomes", "mine", userId],
    queryFn: () => therapyOutcomesApi.mine(),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });

  // Sort ascending by sessionDate so "first" = oldest, "last" = newest.
  // Service returns desc; we re-sort for chart math.
  // Also drop anything older than 12 months — old rows aren't meaningful
  // for trend display and dilute the chart axis.
  const outcomesAsc = useMemo(() => {
    if (!data) return [];
    const cutoff = Date.now() - TWELVE_MONTHS_MS;
    return data
      .filter((o) => new Date(o.sessionDate).getTime() >= cutoff)
      .slice()
      .sort(
        (a, b) =>
          new Date(a.sessionDate).getTime() -
          new Date(b.sessionDate).getTime(),
      );
  }, [data]);

  // Charts default to last 90 days when the patient's history is longer;
  // they can opt into the full timeline with the toggle. Headline always
  // uses the full visible window so the % reflects the real journey.
  // Computed at top level (alongside other hooks) so it stays above all
  // early returns — React's rules-of-hooks won't tolerate a conditional
  // useMemo after a loading-state early return.
  const chartOutcomes = useMemo(() => {
    if (outcomesAsc.length < 2) return outcomesAsc;
    const span = daysSpan(
      outcomesAsc[0].sessionDate,
      outcomesAsc[outcomesAsc.length - 1].sessionDate,
    );
    if (showAll || span <= 90) return outcomesAsc;
    const cutoff = Date.now() - NINETY_DAYS_MS;
    return outcomesAsc.filter(
      (o) => new Date(o.sessionDate).getTime() >= cutoff,
    );
  }, [outcomesAsc, showAll]);

  // ── early states ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Could not load your progress. Try refreshing the page.
      </p>
    );
  }

  if (outcomesAsc.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
        <Sparkles className="w-10 h-10 text-emerald-600/40" />
        <p className="text-sm font-medium">No therapy progress yet</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          You haven&apos;t completed any therapy sessions yet. Your progress
          will appear here once your therapist logs your first session.
        </p>
      </div>
    );
  }

  const newest = outcomesAsc[outcomesAsc.length - 1];

  // ── single outcome — no trend yet ───────────────────────────────────────

  if (outcomesAsc.length === 1) {
    return (
      <div className="space-y-3">
        <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-teal-50/30">
          <CardContent className="py-4 space-y-1">
            <p className="text-sm font-semibold text-emerald-800">
              First session logged on {formatLongDate(newest.sessionDate)}
            </p>
            <p className="text-xs text-muted-foreground">
              Check back after your next visit to see your progress over time.
            </p>
          </CardContent>
        </Card>

        <ObservationCard outcome={newest} />
        <GoalCard outcome={newest} />
      </div>
    );
  }

  // ── full view (2+ outcomes) ─────────────────────────────────────────────

  const oldest = outcomesAsc[0];
  const span = daysSpan(oldest.sessionDate, newest.sessionDate);

  const painPoints = chartOutcomes
    .filter((o) => o.painScore !== null && o.painScore !== undefined)
    .map((o) => ({
      date: formatChartDate(o.sessionDate),
      pain: o.painScore as number,
    }));

  const mobilityPoints = chartOutcomes
    .filter((o) => o.mobilityScore !== null && o.mobilityScore !== undefined)
    .map((o) => ({
      date: formatChartDate(o.sessionDate),
      mobility: o.mobilityScore as number,
    }));

  // Pain-score series across ALL outcomes (not just the chart window),
  // used for the headline so it reflects the full journey.
  const painSeries = outcomesAsc.filter(
    (o) => o.painScore !== null && o.painScore !== undefined,
  );

  return (
    <div className="space-y-4">
      <HeadlineCard
        painSeries={painSeries}
        sessionsCount={outcomesAsc.length}
        firstSessionIso={oldest.sessionDate}
        lastSessionIso={newest.sessionDate}
      />

      {/* Pain chart */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" />
              <p className="text-sm font-semibold">Pain over time</p>
              <span className="text-[11px] text-muted-foreground">
                lower is better
              </span>
            </div>
            {span > 90 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Last 90 days" : "View all"}
              </Button>
            )}
          </div>

          {painPoints.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              Your therapist hasn&apos;t recorded numeric pain scores yet.
            </p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={painPoints}
                  margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                >
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pain"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#f43f5e" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobility chart */}
      <Card>
        <CardContent className="py-4 space-y-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold">Mobility over time</p>
            <span className="text-[11px] text-muted-foreground">
              higher is better
            </span>
          </div>

          {mobilityPoints.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-6 text-center">
              Your therapist hasn&apos;t recorded numeric mobility scores yet.
            </p>
          ) : (
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={mobilityPoints}
                  margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                >
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="mobility"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#059669" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <SwellingThisMonthCard outcomes={outcomesAsc} />
      <ObservationCard outcome={newest} />
      <GoalCard outcome={newest} />
    </div>
  );
}

// ── headline card ─────────────────────────────────────────────────────────

function HeadlineCard({
  painSeries,
  sessionsCount,
  firstSessionIso,
  lastSessionIso,
}: {
  painSeries: TherapyOutcome[];
  sessionsCount: number;
  firstSessionIso: string;
  lastSessionIso: string;
}) {
  const span = daysSpan(firstSessionIso, lastSessionIso);
  const lastVisitDays = daysAgo(lastSessionIso);
  const subtitle = `${sessionsCount} session${sessionsCount === 1 ? "" : "s"} logged over ${span} day${span === 1 ? "" : "s"} · last visit ${lastVisitDays} day${lastVisitDays === 1 ? "" : "s"} ago`;

  // Need ≥ 2 pain-score data points to talk about change. Otherwise omit.
  if (painSeries.length < 2) return null;

  const first = painSeries[0];
  const last = painSeries[painSeries.length - 1];

  // first.painScore is non-null by filter; cast for TS.
  const firstScore = first.painScore as number;
  const lastScore = last.painScore as number;

  // Already pain-free at the start — % change isn't meaningful.
  if (firstScore === 0) {
    return (
      <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-teal-50/40">
        <CardContent className="py-4 space-y-1">
          <p className="text-base font-bold text-emerald-800">
            Pain-free since {formatLongDate(first.sessionDate)} 🌱
          </p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardContent>
      </Card>
    );
  }

  // Improvement when pain has decreased; 0 when it stayed the same or rose.
  const rawPct = ((firstScore - lastScore) / firstScore) * 100;
  const pct = Math.max(0, Math.min(100, Math.round(rawPct)));

  return (
    <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-teal-50/40">
      <CardContent className="py-4 space-y-1">
        <p className="text-base font-bold text-emerald-800">
          You&apos;ve improved {pct}% on pain since you started ❤
        </p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ── swelling-this-month card ──────────────────────────────────────────────

function SwellingThisMonthCard({ outcomes }: { outcomes: TherapyOutcome[] }) {
  const thisMonth = outcomes.filter((o) => isInCurrentMonth(o.sessionDate));
  if (thisMonth.length === 0) return null;

  const reduced = thisMonth.filter((o) => o.swellingReduced === true).length;
  const pct = Math.round((reduced / thisMonth.length) * 100);

  return (
    <Card>
      <CardContent className="py-4 space-y-2">
        <p className="text-sm font-semibold">Swelling reduced this month</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-foreground">
            {pct}%
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {reduced} of {thisMonth.length} session
          {thisMonth.length === 1 ? "" : "s"}
        </p>
      </CardContent>
    </Card>
  );
}

// ── observation card ──────────────────────────────────────────────────────

function ObservationCard({ outcome }: { outcome: TherapyOutcome }) {
  const text = outcome.therapistObservation?.trim();
  if (!text) return null;

  return (
    <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/40 to-orange-50/30">
      <CardContent className="py-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
          <Quote className="w-3.5 h-3.5" />
          YOUR THERAPIST WROTE
        </div>
        <p className="text-sm leading-relaxed text-foreground/90 font-serif">
          &ldquo;{text}&rdquo;
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatLongDate(outcome.sessionDate)}
        </p>
      </CardContent>
    </Card>
  );
}

// ── next session goal card ────────────────────────────────────────────────

function GoalCard({ outcome }: { outcome: TherapyOutcome }) {
  const text = outcome.nextSessionGoal?.trim();
  if (!text) return null;

  // Don't surface stale goals — if the patient hasn't been in for over two
  // weeks, the "next session goal" is likely outdated and showing it gives
  // a false sense of currency.
  if (daysAgo(outcome.sessionDate) > 14) return null;

  return (
    <Card>
      <CardContent className="py-3 flex items-start gap-2">
        <TargetIcon className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Next session goal
          </p>
          <p className="text-sm leading-snug">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}
