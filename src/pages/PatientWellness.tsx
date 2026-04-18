import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel } from "@/components/ui/panel";
import {
  Award,
  Moon,
  Smile,
  Plus,
  PlayCircle,
  ChevronRight,
  Flame,
  Wind,
} from "lucide-react";
import { Button } from "@/components/common/button";
import { DailyCheckIn } from "@/components/wellness/DailyCheckIn";
import { AnimatedWellnessRing } from "@/components/wellness/AnimatedWellnessRing";
import { HealthInsightsCards } from "@/components/wellness/HealthInsightsCards";
import { BreathingExercise } from "@/components/wellness/BreathingExercise";
import { StreakHeatMap } from "@/components/wellness/StreakHeatMap";
import { AchievementUnlock, useAchievementQueue } from "@/components/wellness/AchievementUnlock";
import { PageTransition, StaggerItem, FadeInView } from "@/components/ui/page-transition";
import { WellnessSkeleton } from "@/components/ui/page-skeletons";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { format, subDays } from "date-fns";

export default function PatientWellness() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const { current: currentAchievement, enqueue: enqueueAchievement, dismiss: dismissAchievement } = useAchievementQueue();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await apiClient.get<any>("/api/wellness/stats");
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch wellness stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInSuccess = useCallback(
    (points: number) => {
      fetchStats();
      if (points >= 20) {
        enqueueAchievement({
          id: `checkin-${Date.now()}`,
          title: "Daily Check-in Complete",
          description: "You logged your health data today. Consistency is the key to recovery.",
          tier: "bronze",
          pointsAwarded: points,
        });
      }
    },
    [enqueueAchievement]
  );

  const handleBreathingComplete = useCallback(
    (pattern: string, duration: number) => {
      enqueueAchievement({
        id: `breathing-${Date.now()}`,
        title: "Mindful Moment",
        description: `Completed ${pattern} for ${Math.floor(duration / 60)}m ${duration % 60}s. Your body thanks you.`,
        tier: duration >= 180 ? "silver" : "bronze",
        pointsAwarded: duration >= 180 ? 30 : 15,
      });
    },
    [enqueueAchievement]
  );

  // Generate heatmap data from check-ins
  const heatMapActivities = (stats?.dailyCheckIns || []).map((ci: any) => ({
    date: ci.createdAt,
    checkInDone: true,
    medicationTaken: ci.medicationTaken ?? false,
    exerciseDone: ci.exerciseDone ?? false,
    score: Math.min(100, (ci.painLevel != null ? 25 : 0) + (ci.sleepHours != null ? 25 : 0) + (ci.mood != null ? 25 : 0) + (ci.medicationTaken ? 25 : 0)),
  }));

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <WellnessSkeleton />
        </div>
      </AppLayout>
    );
  }

  const zenProgress = ((stats?.zenPoints || 0) % 500) / 5;

  return (
    <AppLayout>
      <PageTransition className="container max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <StaggerItem>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <PageHeader
              title="My Wellness Journey"
              subtitle="Track your progress, earn Zen Points, and heal faster."
            />
            <div className="flex gap-3">
              <Button
                className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/20 h-12 px-5 rounded-2xl font-bold flex items-center gap-2"
                onClick={() => setShowBreathing(true)}
              >
                <Wind className="w-5 h-5" />
                Breathe
              </Button>
              <Button
                className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 h-12 px-6 rounded-2xl font-bold flex items-center gap-2"
                onClick={() => setShowCheckIn(true)}
              >
                <Plus className="w-5 h-5" />
                Daily Check-in
              </Button>
            </div>
          </div>
        </StaggerItem>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Points & Level Card */}
          <StaggerItem className="lg:col-span-1">
            <Panel
              title="Zen Status"
              className="h-full bg-gradient-to-br from-primary/5 via-background to-background border-primary/10 overflow-hidden dark:glow-primary"
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="p-4 bg-primary/10 rounded-3xl">
                  <Award className="w-12 h-12 text-primary" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-3xl font-black text-foreground">{stats?.zenPoints || 0}</h2>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Zen Points Earned
                  </p>
                </div>

                <AnimatedWellnessRing
                  score={zenProgress}
                  size={180}
                  strokeWidth={12}
                  onMilestone={() => {
                    if (zenProgress >= 80) {
                      enqueueAchievement({
                        id: `level-${Date.now()}`,
                        title: "Almost There!",
                        description: "You're close to reaching the next tier. Keep pushing!",
                        tier: "gold",
                        pointsAwarded: 50,
                      });
                    }
                  }}
                />

                {(stats?.adherenceStreak ?? 0) > 0 && (
                  <div className="w-full flex items-center gap-3 p-3 bg-attention/10 border border-attention/20 rounded-2xl interactive-card">
                    <Flame className="w-5 h-5 text-attention flex-none" />
                    <div className="text-left">
                      <p className="text-sm font-black text-foreground">
                        {stats.adherenceStreak}-day streak
                      </p>
                      <p className="text-[10px] text-muted-foreground">Medication adherence</p>
                    </div>
                    {[7, 14, 30].find((m) => stats.adherenceStreak < m) && (
                      <span className="ml-auto text-[10px] text-attention font-bold">
                        {[7, 14, 30].find((m) => stats.adherenceStreak < m)! - stats.adherenceStreak}d to
                        bonus
                      </span>
                    )}
                  </div>
                )}
                <div className="w-full p-4 bg-secondary/20 rounded-2xl border border-border/50 text-sm">
                  Next tier at <strong>500 points</strong>
                  <p className="text-muted-foreground text-xs mt-1">
                    Keep checking in daily to level up!
                  </p>
                </div>
              </div>
            </Panel>
          </StaggerItem>

          {/* Activity Trends */}
          <div className="lg:col-span-2 space-y-6">
            <StaggerItem>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard
                  title="Recent Mood"
                  value={stats?.dailyCheckIns?.[0]?.mood || "N/A"}
                  icon={Smile}
                  variant="wellness"
                />
                <StatCard
                  title="Sleep Avg (7d)"
                  value={`${
                    stats?.dailyCheckIns && stats.dailyCheckIns.length > 0
                      ? (
                          stats.dailyCheckIns.reduce(
                            (a: any, b: any) => a + (b.sleepHours || 0),
                            0
                          ) / stats.dailyCheckIns.length
                        ).toFixed(1)
                      : 0
                  }h`}
                  icon={Moon}
                />
              </div>
            </StaggerItem>

            {/* Health Insights */}
            <FadeInView delay={0.2}>
              <HealthInsightsCards checkIns={stats?.dailyCheckIns} />
            </FadeInView>

            {/* Streak Heat Map */}
            <FadeInView delay={0.3}>
              <Panel title="Activity History" subtitle="Your health check-in consistency">
                <StreakHeatMap
                  activities={heatMapActivities}
                  currentStreak={stats?.adherenceStreak || 0}
                  longestStreak={stats?.longestStreak || stats?.adherenceStreak || 0}
                />
              </Panel>
            </FadeInView>

            <FadeInView delay={0.4}>
              <Panel title="Weekly Health Pulse" subtitle="Monitoring your pain and sleep trends">
                <div className="h-64 flex items-end justify-between gap-2 px-4">
                  {(stats?.dailyCheckIns || [])
                    .slice()
                    .reverse()
                    .map((day: any, idx: number) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                        <div className="w-full flex flex-col-reverse items-center gap-1 h-48">
                          <div
                            className="w-4 bg-destructive/20 rounded-t-full transition-all group-hover:bg-destructive/40"
                            style={{ height: `${(day.painLevel || 0) * 10}%` }}
                            title={`Pain: ${day.painLevel || 0}`}
                          />
                          <div
                            className="w-4 bg-primary/20 rounded-t-full transition-all group-hover:bg-primary/40"
                            style={{ height: `${((day.sleepHours || 0) / 12) * 100}%` }}
                            title={`Sleep: ${day.sleepHours || 0}h`}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase truncate w-full text-center">
                          {day.createdAt
                            ? new Date(day.createdAt).toLocaleDateString(undefined, {
                                weekday: "short",
                              })
                            : "N/A"}
                        </span>
                      </div>
                    ))}
                  {(!stats?.dailyCheckIns || stats.dailyCheckIns.length === 0) && (
                    <div className="w-full flex items-center justify-center text-muted-foreground italic h-full">
                      No data recorded yet.
                    </div>
                  )}
                </div>
                <div className="flex justify-center gap-6 mt-6 border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <div className="w-3 h-3 bg-primary/30 rounded-full" /> Sleep (Hrs)
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <div className="w-3 h-3 bg-destructive/30 rounded-full" /> Pain (0-10)
                  </div>
                </div>
              </Panel>
            </FadeInView>

            <FadeInView delay={0.5}>
              <Link to="/exercise-library">
                <Panel
                  title="Exercises"
                  className="group hover:border-primary/30 transition-all cursor-pointer interactive-card"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-accent/10 rounded-2xl group-hover:scale-110 transition-transform">
                        <PlayCircle className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Prescribed Exercises</h3>
                        <p className="text-sm text-muted-foreground">
                          Activities assigned by your clinical team
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </Panel>
              </Link>
            </FadeInView>
          </div>
        </div>

        {/* Modals */}
        <DailyCheckIn
          isOpen={showCheckIn}
          onClose={() => setShowCheckIn(false)}
          onSuccess={handleCheckInSuccess}
        />

        <BreathingExercise
          isOpen={showBreathing}
          onClose={() => setShowBreathing(false)}
          onComplete={handleBreathingComplete}
        />

        <AchievementUnlock achievement={currentAchievement} onDismiss={dismissAchievement} />
      </PageTransition>
    </AppLayout>
  );
}
