import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays, startOfWeek, addDays, isSameDay, isToday, isFuture } from "date-fns";
import { useState } from "react";

interface DayActivity {
  date: string; // ISO date string
  checkInDone: boolean;
  medicationTaken: boolean;
  exerciseDone: boolean;
  score: number; // 0-100 composite activity score
}

interface StreakHeatMapProps {
  activities: DayActivity[];
  currentStreak: number;
  longestStreak: number;
  className?: string;
}

const WEEKS_TO_SHOW = 12;
const DAYS_IN_WEEK = 7;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getIntensityClass(score: number): string {
  if (score === 0) return "bg-muted/40 dark:bg-muted/20";
  if (score <= 25) return "bg-emerald-200 dark:bg-emerald-900/60";
  if (score <= 50) return "bg-emerald-300 dark:bg-emerald-700/70";
  if (score <= 75) return "bg-emerald-400 dark:bg-emerald-600/80";
  return "bg-emerald-500 dark:bg-emerald-500";
}

function getTooltipText(day: DayActivity | undefined, date: Date): string {
  if (!day || day.score === 0) return `${format(date, "MMM d, yyyy")} - No activity`;
  const activities = [];
  if (day.checkInDone) activities.push("Check-in");
  if (day.medicationTaken) activities.push("Medication");
  if (day.exerciseDone) activities.push("Exercise");
  return `${format(date, "MMM d, yyyy")} - ${activities.join(", ")} (${day.score}%)`;
}

export function StreakHeatMap({ activities, currentStreak, longestStreak, className }: StreakHeatMapProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const activityMap = useMemo(() => {
    const map = new Map<string, DayActivity>();
    activities.forEach((a) => {
      const key = format(new Date(a.date), "yyyy-MM-dd");
      map.set(key, a);
    });
    return map;
  }, [activities]);

  // Generate the grid of dates
  const grid = useMemo(() => {
    const today = new Date();
    const endDate = subDays(today, weekOffset * 7);
    const startDate = subDays(startOfWeek(endDate), (WEEKS_TO_SHOW - 1) * 7);
    const weeks: Date[][] = [];
    let current = startOfWeek(startDate);

    for (let w = 0; w < WEEKS_TO_SHOW; w++) {
      const week: Date[] = [];
      for (let d = 0; d < DAYS_IN_WEEK; d++) {
        week.push(current);
        current = addDays(current, 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [weekOffset]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    grid.forEach((week, colIdx) => {
      const firstDay = week[0];
      const month = firstDay.getMonth();
      if (month !== lastMonth) {
        labels.push({ label: format(firstDay, "MMM"), col: colIdx });
        lastMonth = month;
      }
    });
    return labels;
  }, [grid]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with streak stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-500/10">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground tabular-nums">{currentStreak}</p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Day Streak</p>
            </div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div>
            <p className="text-lg font-bold text-foreground tabular-nums">{longestStreak}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Best Streak</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((o) => o + WEEKS_TO_SHOW)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Previous weeks"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekOffset((o) => Math.max(0, o - WEEKS_TO_SHOW))}
            disabled={weekOffset === 0}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30"
            aria-label="Next weeks"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Heat map grid */}
      <div className="overflow-x-auto scrollbar-calm">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex ml-8 mb-1">
            {monthLabels.map((ml, i) => (
              <div
                key={i}
                className="text-[10px] text-muted-foreground font-bold"
                style={{ marginLeft: ml.col === 0 ? 0 : `${(ml.col - (i > 0 ? monthLabels[i - 1].col : 0)) * 16 - 16}px` }}
              >
                {ml.label}
              </div>
            ))}
          </div>

          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={label}
                  className="h-3.5 flex items-center text-[9px] text-muted-foreground font-bold"
                  style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Grid columns (weeks) */}
            {grid.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-0.5">
                {week.map((date, dIdx) => {
                  const key = format(date, "yyyy-MM-dd");
                  const activity = activityMap.get(key);
                  const score = activity?.score || 0;
                  const future = isFuture(date);
                  const today = isToday(date);

                  return (
                    <motion.div
                      key={key}
                      className={cn(
                        "w-3.5 h-3.5 rounded-[3px] transition-colors cursor-default relative group",
                        future ? "bg-transparent" : getIntensityClass(score),
                        today && "ring-1 ring-primary ring-offset-1 ring-offset-background"
                      )}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: future ? 0 : 1, opacity: future ? 0 : 1 }}
                      transition={{ delay: (wIdx * 7 + dIdx) * 0.003, duration: 0.2 }}
                      title={future ? "" : getTooltipText(activity, date)}
                    >
                      {/* Tooltip */}
                      {!future && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-foreground text-background text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                          {getTooltipText(activity, date)}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            {format(grid[0]?.[0] || new Date(), "MMM d")} - {format(grid[grid.length - 1]?.[6] || new Date(), "MMM d, yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">Less</span>
          {[0, 25, 50, 75, 100].map((score) => (
            <div key={score} className={cn("w-3 h-3 rounded-[3px]", getIntensityClass(score))} />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">More</span>
        </div>
      </div>

      {/* Activity breakdown for today */}
      {(() => {
        const todayKey = format(new Date(), "yyyy-MM-dd");
        const todayActivity = activityMap.get(todayKey);
        if (!todayActivity) return null;
        return (
          <motion.div
            className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-xs font-bold text-foreground">Today:</span>
            {[
              { label: "Check-in", done: todayActivity.checkInDone },
              { label: "Medication", done: todayActivity.medicationTaken },
              { label: "Exercise", done: todayActivity.exerciseDone },
            ].map((item) => (
              <span
                key={item.label}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full font-bold",
                  item.done
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.done ? "✓" : "○"} {item.label}
              </span>
            ))}
          </motion.div>
        );
      })()}
    </div>
  );
}
