import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Flame,
  Trophy,
  TrendingUp,
  Users,
  Activity,
  Star,
  Zap,
  Award,
  Loader2,
} from "lucide-react";
import { patientGamificationApi } from "@/services/patientGamification.service";
import type { EnhancedSocialProof, StreakMilestone } from "@/types";
import { useToast } from "@/components/ui/use-toast";

export default function SocialProofDashboard() {
  const [socialProof, setSocialProof] = useState<EnhancedSocialProof | null>(null);
  const [milestones, setMilestones] = useState<StreakMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (socialProof?.peerActivityPercent) {
      const target = socialProof.peerActivityPercent;
      let current = 0;
      const interval = setInterval(() => {
        current += 1;
        if (current >= target) {
          current = target;
          clearInterval(interval);
        }
        setAnimatedPercent(current);
      }, 20);
      return () => clearInterval(interval);
    }
  }, [socialProof?.peerActivityPercent]);

  async function loadData() {
    try {
      const [sp, ms] = await Promise.all([
        patientGamificationApi.getEnhancedSocialProof(),
        patientGamificationApi.getStreakMilestones(),
      ]);
      setSocialProof(sp);
      setMilestones(ms);
    } catch {
      toast({ title: "Error", description: "Failed to load data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const currentStreak = socialProof?.avgStreakDays ?? 0;
  // Use the first non-achieved milestone's days as the "current streak" hint,
  // or fall back to avg streak days from social proof.
  const activeStreak = milestones.filter((m) => m.achieved).length > 0
    ? milestones.filter((m) => m.achieved).slice(-1)[0]?.days ?? currentStreak
    : currentStreak;

  // Find longest streak (last achieved milestone or current)
  const longestAchieved = milestones
    .filter((m) => m.achieved)
    .sort((a, b) => b.days - a.days);
  const longestStreak = longestAchieved.length > 0 ? longestAchieved[0].days : activeStreak;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Wellness Streaks"
          subtitle="Stay consistent and see how you compare"
        />

        {/* Current Streak */}
        <Card className="overflow-hidden">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <Flame className="h-20 w-20 text-orange-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white font-bold text-lg mt-1">
                    {activeStreak}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold">
                  {activeStreak} Day Streak!
                </h2>
                <p className="text-muted-foreground">
                  You've been active for {activeStreak} day{activeStreak !== 1 ? "s" : ""} in a row!
                </p>
              </div>
              {longestStreak > activeStreak && (
                <Badge variant="outline" className="gap-1">
                  <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                  Longest: {longestStreak} days
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Streak Milestones Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5" />
              Streak Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute top-6 left-0 right-0 h-0.5 bg-muted" />

              <div className="flex justify-between relative">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.days}
                    className="flex flex-col items-center relative z-10"
                  >
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                        milestone.achieved
                          ? "bg-orange-100 dark:bg-orange-900/30 border-orange-400 text-orange-600"
                          : "bg-muted border-muted-foreground/20 text-muted-foreground"
                      }`}
                    >
                      {milestone.achieved ? (
                        <Flame className="h-5 w-5" />
                      ) : (
                        <span className="text-xs font-bold">{milestone.days}d</span>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium mt-2 ${
                        milestone.achieved ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"
                      }`}
                    >
                      {milestone.name}
                    </span>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        milestone.achieved ? "text-yellow-600" : "text-muted-foreground/60"
                      }`}
                    >
                      +{milestone.reward} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Proof Section */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Active Today */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Today</p>
                  <p className="text-2xl font-bold text-green-600">
                    {animatedPercent}%
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                of patients are active today ({socialProof?.activeToday ?? 0} out of{" "}
                {socialProof?.totalPatients ?? 0})
              </p>
            </CardContent>
          </Card>

          {/* Percentile Rank */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Rank</p>
                  <p className="text-2xl font-bold text-blue-600">
                    Top {100 - (socialProof?.percentileRank ?? 50)}%
                  </p>
                </div>
              </div>
              <Progress
                value={socialProof?.percentileRank ?? 50}
                className="h-2 [&>div]:bg-blue-500"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                You're ahead of {socialProof?.percentileRank ?? 50}% of patients
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Motivational Message */}
        {socialProof?.motivationalMessage && (
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6 pb-6">
              <div className="flex items-start gap-3">
                <Zap className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <p className="text-lg font-medium text-primary">
                  {socialProof.motivationalMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Community Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Flame className="h-8 w-8 mx-auto text-orange-500 mb-2" />
              <div className="text-2xl font-bold">{socialProof?.avgStreakDays ?? 0}</div>
              <p className="text-sm text-muted-foreground">Avg. Streak Days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Star className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
              <div className="text-2xl font-bold">{socialProof?.avgZenPoints ?? 0}</div>
              <p className="text-sm text-muted-foreground">Avg. Zen Points</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
