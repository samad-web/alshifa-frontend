import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronRight, Sparkles } from "lucide-react";
import { dailyTrackingService } from "@/services/dailyTracking.service";
import { apiClient } from "@/lib/api-client";

// Single rolled-up "this week" view of the four daily-tracking metrics plus
// daily check-in. Each metric is rendered as a 7-day progress bar so the
// patient gets a single glance of consistency, not a grid of fragmented
// cards. The 4 separate tracking cards (WaterIntakeCard, ActivityLogCard,
// BodyMeasurementsCard, MealPhotoCard) stay on the dashboard as a fallback
// so a patient who wants to log mid-day still has a single-purpose surface.

interface WeeklyWellnessSummaryProps {
  /** Opens the existing 5-step CheckInModal in the parent dashboard. */
  onOpenCheckIn: () => void;
  /** Surfaced from the dashboard summary so we don't refetch. */
  pointsEarnedToday: number;
}

interface DayStat {
  date: Date;
  dayLabel: string;
  isoDate: string;
  hasCheckIn: boolean;
  waterOnTarget: boolean;
  hasActivity: boolean;
  hasMealPhoto: boolean;
}

const WATER_GOAL_ML = 2500;

function isoDateOf(d: Date | string): string {
  return new Date(d).toISOString().split("T")[0];
}

export function WeeklyWellnessSummary({ onOpenCheckIn, pointsEarnedToday }: WeeklyWellnessSummaryProps) {
  const [waterLogs, setWaterLogs] = useState<Array<{ date: string; amount: number }>>([]);
  const [activityLogs, setActivityLogs] = useState<Array<{ date: string }>>([]);
  const [mealPhotoLogs, setMealPhotoLogs] = useState<Array<{ date: string }>>([]);
  const [checkIns, setCheckIns] = useState<Array<{ createdAt: string }>>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      dailyTrackingService.getWaterHistory(),
      dailyTrackingService.getActivityHistory(),
      dailyTrackingService.getMealPhotosHistory(),
      apiClient.get<{ dailyCheckIns: Array<{ createdAt: string }> }>("/api/wellness/stats"),
    ])
      .then(([w, a, m, c]) => {
        if (cancelled) return;
        if (w.status === "fulfilled") setWaterLogs(w.value.data?.logs ?? []);
        if (a.status === "fulfilled") setActivityLogs(a.value.data?.logs ?? []);
        if (m.status === "fulfilled") setMealPhotoLogs(m.value.data?.logs ?? []);
        if (c.status === "fulfilled") setCheckIns(c.value.data?.dailyCheckIns ?? []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo<DayStat[]>(() => {
    const last7Days: Date[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    return last7Days.map((day) => {
      const iso = isoDateOf(day);
      const dayWaterTotal = waterLogs
        .filter((l) => isoDateOf(l.date) === iso)
        .reduce((sum, l) => sum + (l.amount || 0), 0);
      return {
        date: day,
        dayLabel: day.toLocaleDateString("en-IN", { weekday: "short" }),
        isoDate: iso,
        hasCheckIn: checkIns.some((c) => isoDateOf(c.createdAt) === iso),
        waterOnTarget: dayWaterTotal >= WATER_GOAL_ML,
        hasActivity: activityLogs.some((l) => isoDateOf(l.date) === iso),
        hasMealPhoto: mealPhotoLogs.some((l) => isoDateOf(l.date) === iso),
      };
    });
  }, [waterLogs, activityLogs, mealPhotoLogs, checkIns]);

  const checkInDays = stats.filter((s) => s.hasCheckIn).length;
  const waterDays = stats.filter((s) => s.waterOnTarget).length;
  const activityDays = stats.filter((s) => s.hasActivity).length;
  const mealPhotoDays = stats.filter((s) => s.hasMealPhoto).length;

  // Best day = the day that scored the most of the four metrics (ties go to
  // the most recent). Surfaces only when a day cleared all four.
  const bestDay = useMemo(() => {
    let best: { date: Date; score: number } | null = null;
    for (const s of stats) {
      const score =
        (s.hasCheckIn ? 1 : 0) +
        (s.waterOnTarget ? 1 : 0) +
        (s.hasActivity ? 1 : 0) +
        (s.hasMealPhoto ? 1 : 0);
      if (!best || score >= best.score) best = { date: s.date, score };
    }
    return best;
  }, [stats]);

  const today = stats[stats.length - 1];
  const todayCompletedCount = today
    ? (today.hasCheckIn ? 1 : 0) +
      (today.waterOnTarget ? 1 : 0) +
      (today.hasActivity ? 1 : 0) +
      (today.hasMealPhoto ? 1 : 0)
    : 0;

  const metrics = [
    { label: "Check-ins",        days: checkInDays },
    { label: "Water on target",  days: waterDays },
    { label: "Activity logged",  days: activityDays },
    { label: "Meal photos",      days: mealPhotoDays },
  ];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            This week's wellness
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats[0]?.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            {" – "}
            {stats[6]?.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </p>
        </div>
        <div
          className="text-xs font-medium px-3 py-1 rounded-full text-white"
          style={{ background: "#0D6E6E" }}
          title="Zen Points earned today"
        >
          +{pointsEarnedToday} pts today
        </div>
      </div>

      <div className="space-y-2.5">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="font-medium text-foreground">{m.days}/7 days</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(m.days / 7) * 100}%`,
                  background: "#0D6E6E",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {bestDay && bestDay.score === 4 && (
        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">
          Best day:{" "}
          <span className="font-medium text-foreground">
            {bestDay.date.toLocaleDateString("en-IN", { weekday: "long" })}
          </span>{" "}
          — all 4 completed
        </div>
      )}

      <button
        type="button"
        onClick={onOpenCheckIn}
        className="w-full flex items-center justify-between p-3 rounded-xl text-left"
        style={{ background: "#E1F5EE" }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: "#0F6E56" }}>
            Today's challenge
          </p>
          <p className="text-xs" style={{ color: "#0D6E6E" }}>
            Log all 4 vitals → +60 pts total
          </p>
        </div>
        <span
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-white flex items-center gap-1"
          style={{ background: "#0D6E6E" }}
        >
          {todayCompletedCount}/4 done
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </button>
    </Card>
  );
}

export default WeeklyWellnessSummary;
