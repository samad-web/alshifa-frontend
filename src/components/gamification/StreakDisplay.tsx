import { useEffect, useState } from "react";
import { gamificationApi } from "@/services/gamification.service";
import type { ClinicianStreak } from "@/types";
import { Flame, Shield, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakDisplayProps {
  compact?: boolean;
}

export function StreakDisplay({ compact = false }: StreakDisplayProps) {
  const [streak, setStreak] = useState<ClinicianStreak | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gamificationApi.getMyStreak()
      .then(setStreak)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !streak) return null;

  const flameColor = streak.currentStreak >= 30
    ? "text-violet-500"
    : streak.currentStreak >= 14
      ? "text-yellow-500"
      : streak.currentStreak >= 7
        ? "text-orange-500"
        : streak.currentStreak > 0
          ? "text-red-400"
          : "text-muted-foreground";

  const multiplierLabel = streak.streakMultiplier > 1.0
    ? `${(streak.streakMultiplier * 100 - 100).toFixed(0)}% bonus`
    : null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Flame className={cn("w-4 h-4", flameColor)} />
        <span className="text-sm font-black">{streak.currentStreak}</span>
        {multiplierLabel && (
          <span className="text-[8px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
            {multiplierLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500/5 to-red-500/5 border border-orange-500/20 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-xl">
            <Flame className={cn("w-6 h-6", flameColor)} />
          </div>
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Streak</p>
            <p className="text-3xl font-black">{streak.currentStreak} <span className="text-sm text-muted-foreground">days</span></p>
          </div>
        </div>
        {multiplierLabel && (
          <div className="text-right">
            <div className="flex items-center gap-1 text-primary">
              <TrendingUp className="w-3 h-3" />
              <span className="text-xs font-bold">{multiplierLabel}</span>
            </div>
            <p className="text-[9px] text-muted-foreground">Score boost</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-lg font-black">{streak.currentStreak}</p>
          <p className="text-[8px] font-black text-muted-foreground uppercase">Current</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <p className="text-lg font-black">{streak.longestStreak}</p>
          <p className="text-[8px] font-black text-muted-foreground uppercase">Best</p>
        </div>
        <div className="text-center p-2 rounded-lg bg-background/50">
          <div className="flex items-center justify-center gap-1">
            <Shield className="w-3 h-3 text-muted-foreground" />
            <p className="text-lg font-black">{streak.graceUsedThisWeek ? "Used" : "Ready"}</p>
          </div>
          <p className="text-[8px] font-black text-muted-foreground uppercase">Grace Day</p>
        </div>
      </div>

      {/* Streak tier progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[9px] font-black text-muted-foreground uppercase tracking-widest">
          <span>Streak Tier</span>
          <span>
            {streak.currentStreak >= 30 ? "Max Multiplier" :
              streak.currentStreak >= 14 ? "14+ days (+5%)" :
                streak.currentStreak >= 7 ? "7+ days (+3%)" : "Building..."}
          </span>
        </div>
        <div className="flex gap-1">
          {[7, 14, 30].map(threshold => (
            <div
              key={threshold}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-colors",
                streak.currentStreak >= threshold ? "bg-orange-500" : "bg-secondary/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
