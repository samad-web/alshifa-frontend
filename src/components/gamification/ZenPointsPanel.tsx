import { useEffect, useState } from "react";
import { gamificationApi } from "@/services/gamification.service";
import type { ZenProfile, DailyChallenge, SocialProof } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Star, Sparkles, CheckCircle, Circle, Users, Target, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<number, string> = {
  1: "text-emerald-600",
  2: "text-blue-500",
  3: "text-purple-500",
  4: "text-amber-500",
  5: "text-violet-600",
};

export function ZenPointsPanel() {
  const [profile, setProfile] = useState<ZenProfile | null>(null);
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);
  const [socialProof, setSocialProof] = useState<SocialProof | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      gamificationApi.getZenProfile(),
      gamificationApi.getDailyChallenges(),
      gamificationApi.getSocialProof()
    ])
      .then(([p, c, s]) => {
        setProfile(p);
        setChallenges(c);
        setSocialProof(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCompleteChallenge = async (challengeId: string) => {
    try {
      const result = await gamificationApi.completeChallenge(challengeId);
      if (result.completed) {
        setChallenges(prev => prev.map(c =>
          c.id === challengeId ? { ...c, completed: true, completedAt: new Date().toISOString() } : c
        ));
        // Refresh profile to get updated points
        const updatedProfile = await gamificationApi.getZenProfile();
        setProfile(updatedProfile);
      }
    } catch {}
  };

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Sparkles className="w-6 h-6 text-primary animate-pulse" />
    </div>
  );

  if (!profile) return null;

  const levelColor = LEVEL_COLORS[profile.level.tier] || "text-primary";

  return (
    <div className="space-y-6">
      {/* Points & Level Card */}
      <Card className="border-none shadow-elevated bg-gradient-to-br from-primary/5 via-background to-violet-500/5 overflow-hidden">
        <CardContent className="p-6 space-y-5">
          {/* Level & Points */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Zen Level</p>
              <p className={cn("text-2xl font-black", levelColor)}>{profile.level.name}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-primary">{profile.zenPoints}</p>
              <p className="text-[10px] font-black text-muted-foreground uppercase">Zen Points</p>
            </div>
          </div>

          {/* Level Progress */}
          {profile.level.nextLevel && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[9px] font-black text-muted-foreground uppercase">
                <span>{profile.level.name}</span>
                <span>{profile.level.nextLevel} ({profile.level.nextAt} pts)</span>
              </div>
              <Progress value={profile.level.progress} className="h-2" />
            </div>
          )}

          {/* Streak */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-black">{profile.streak.current} Day Streak</p>
                <p className="text-[9px] text-muted-foreground">Best: {profile.streak.longest} days</p>
              </div>
            </div>
            {profile.streak.current >= 7 && (
              <Badge variant="outline" className="text-[9px] border-orange-500/30 text-orange-600">
                +50 bonus!
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Social Proof */}
      {socialProof && (
        <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-3">
          <Users className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
            {socialProof.message}
          </p>
        </div>
      )}

      {/* Daily Challenges */}
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Today's Challenges
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {challenges.map(challenge => (
            <div
              key={challenge.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border transition-all",
                challenge.completed
                  ? "bg-wellness/5 border-wellness/20"
                  : "bg-secondary/5 border-border/30 hover:border-primary/30 cursor-pointer"
              )}
              onClick={() => !challenge.completed && handleCompleteChallenge(challenge.id)}
            >
              <div className="flex items-center gap-3">
                {challenge.completed ? (
                  <CheckCircle className="w-5 h-5 text-wellness flex-shrink-0" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
                <div>
                  <p className={cn("text-xs font-bold", challenge.completed && "line-through text-muted-foreground")}>
                    {challenge.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{challenge.description}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[9px] flex-shrink-0">
                <Zap className="w-3 h-3 mr-0.5" />
                +{challenge.pointReward}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {profile.recentActivity.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              Recent Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {profile.recentActivity.slice(0, 8).map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatAction(entry.action)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">+{entry.points}</span>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    TASK_COMPLETION: "Task completed",
    VITAL_LOG: "Vital logged",
    APPOINTMENT_ATTENDANCE: "Appointment attended",
    STREAK_BONUS: "Streak bonus",
    MILESTONE: "Milestone achieved",
    CHALLENGE: "Challenge completed",
  };
  return map[action] || action.replace(/_/g, ' ').toLowerCase();
}
