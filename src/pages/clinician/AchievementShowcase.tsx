import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, AlertCircle, Award, Lock, Flame, Star,
  Users, HeartPulse, BarChart3, Shield, Trophy, Crown, Zap,
} from "lucide-react";
import { clinicianGamificationApi } from "@/services/clinicianGamification.service";
import type { AchievementShowcase as ShowcaseType, Badge as BadgeType } from "@/types";

const TIER_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  BRONZE: { border: "border-amber-500", bg: "bg-amber-500/10", text: "text-amber-600" },
  SILVER: { border: "border-gray-400", bg: "bg-gray-400/10", text: "text-gray-500" },
  GOLD: { border: "border-yellow-500", bg: "bg-yellow-500/10", text: "text-yellow-600" },
  PLATINUM: { border: "border-purple-500", bg: "bg-purple-500/10", text: "text-purple-600" },
};

const LEVEL_TIERS = [
  { level: 1, title: "Intern" },
  { level: 2, title: "Practitioner" },
  { level: 3, title: "Specialist" },
  { level: 4, title: "Expert" },
  { level: 5, title: "Master" },
  { level: 6, title: "Legend" },
];

function badgeIcon(iconName: string) {
  const map: Record<string, React.ReactNode> = {
    star: <Star className="w-6 h-6" />,
    trophy: <Trophy className="w-6 h-6" />,
    award: <Award className="w-6 h-6" />,
    shield: <Shield className="w-6 h-6" />,
    crown: <Crown className="w-6 h-6" />,
    zap: <Zap className="w-6 h-6" />,
  };
  return map[iconName?.toLowerCase()] ?? <Award className="w-6 h-6" />;
}

export default function AchievementShowcase() {
  const { userId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const targetId = userId || user?.id || "";

  const [showcase, setShowcase] = useState<ShowcaseType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!targetId) return;
    async function load() {
      try {
        const data = await clinicianGamificationApi.getShowcase(targetId);
        setShowcase(data);
      } catch {
        setError("Failed to load showcase");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [targetId]);

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error || !showcase) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="w-8 h-8" />
            <p>{error || "Profile not found"}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const earnedBadges = showcase.badges.filter((b) => b.earned);
  const lockedBadges = showcase.badges.filter((b) => !b.earned);
  const currentLevelInfo = LEVEL_TIERS.find((t) => t.level === showcase.level);

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader title="Achievement Showcase" subtitle={userId ? `Viewing ${showcase.fullName}'s profile` : "Your achievements and badges"} />

        {/* ── Profile Header ─────────────────────────────────────── */}
        <Card className="bg-gradient-to-br from-primary/10 via-background to-purple-500/5 border-primary/20">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Avatar / Level */}
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg text-primary-foreground">
                  <Trophy className="w-12 h-12" />
                </div>
                <Badge className="bg-primary text-primary-foreground font-bold">
                  Lvl {showcase.level}
                </Badge>
              </div>

              <div className="flex-1 text-center md:text-left space-y-2">
                <h2 className="text-2xl font-bold">{showcase.fullName}</h2>
                <p className="text-lg text-primary font-medium">{showcase.title}</p>
                <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                  <Badge variant="secondary" className="text-sm">
                    <Zap className="w-3 h-3 mr-1" />
                    {showcase.totalXP.toLocaleString()} XP
                  </Badge>
                  <Badge variant="secondary" className="text-sm">
                    <Award className="w-3 h-3 mr-1" />
                    {earnedBadges.length} Badges
                  </Badge>
                </div>
              </div>

              {/* Streak display */}
              <div className="flex gap-6">
                <div className="flex flex-col items-center gap-1 bg-card rounded-xl px-6 py-4 border">
                  <Flame className="w-8 h-8 text-orange-500" />
                  <span className="text-2xl font-extrabold text-orange-600">{showcase.currentStreak}</span>
                  <span className="text-xs text-muted-foreground">Current Streak</span>
                </div>
                <div className="flex flex-col items-center gap-1 bg-card rounded-xl px-6 py-4 border">
                  <Flame className="w-8 h-8 text-red-400" />
                  <span className="text-2xl font-extrabold text-red-500">{showcase.longestStreak}</span>
                  <span className="text-xs text-muted-foreground">Longest Streak</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Level Progression Bar ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Level Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 w-full">
              {LEVEL_TIERS.map((tier) => {
                const isActive = tier.level === showcase.level;
                const isPast = tier.level < showcase.level;
                return (
                  <div key={tier.level} className="flex-1">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-full h-2 rounded-full ${
                          isPast || isActive ? "bg-primary" : "bg-muted"
                        }`}
                      />
                      <span
                        className={`text-xs font-medium ${
                          isActive ? "text-primary font-bold" : isPast ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {tier.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Badge Collection ───────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Badge Collection
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {earnedBadges.length}/{showcase.badges.length} earned
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Earned badges */}
            {earnedBadges.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Earned</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {earnedBadges.map((badge) => {
                    const style = TIER_STYLES[badge.tier] ?? TIER_STYLES.BRONZE;
                    return (
                      <div
                        key={badge.id}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 ${style.border} ${style.bg} transition-all hover:scale-105 hover:shadow-md`}
                      >
                        <div className={style.text}>{badgeIcon(badge.icon)}</div>
                        <p className="text-xs font-semibold text-center">{badge.name}</p>
                        <Badge variant="outline" className={`text-[10px] ${style.text}`}>
                          {badge.tier}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Locked badges */}
            {lockedBadges.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Locked</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {lockedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="relative flex flex-col items-center gap-2 p-4 rounded-xl border border-muted bg-muted/30 opacity-50"
                    >
                      <div className="relative text-muted-foreground">
                        {badgeIcon(badge.icon)}
                        <Lock className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-center text-muted-foreground">{badge.name}</p>
                      <p className="text-[10px] text-muted-foreground text-center">{badge.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showcase.badges.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No badges available yet</p>
            )}
          </CardContent>
        </Card>

        {/* ── Stats Cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-6 flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold">--</span>
              <span className="text-xs text-muted-foreground">Total Patients</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6 flex flex-col items-center gap-2">
              <HeartPulse className="w-8 h-8 text-green-500" />
              <span className="text-2xl font-bold">--</span>
              <span className="text-xs text-muted-foreground">Journeys Completed</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-6 flex flex-col items-center gap-2">
              <BarChart3 className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold">--</span>
              <span className="text-xs text-muted-foreground">Avg Rating</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
