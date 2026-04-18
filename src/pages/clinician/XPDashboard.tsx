import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Star, Zap, Trophy, TrendingUp, Flame, ArrowUp,
  Loader2, AlertCircle, Crown, Shield, Award,
} from "lucide-react";
import { clinicianGamificationApi } from "@/services/clinicianGamification.service";
import type { ClinicianXPProfile, XPTransaction, XPLeaderboardEntry } from "@/types";

const LEVEL_TIERS = [
  { level: 1, title: "Intern", icon: Shield },
  { level: 2, title: "Practitioner", icon: Star },
  { level: 3, title: "Specialist", icon: Award },
  { level: 4, title: "Expert", icon: Trophy },
  { level: 5, title: "Master", icon: Crown },
  { level: 6, title: "Legend", icon: Zap },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function actionIcon(action: string) {
  if (action.toLowerCase().includes("consult")) return <Star className="w-4 h-4 text-yellow-500" />;
  if (action.toLowerCase().includes("mentor")) return <Award className="w-4 h-4 text-purple-500" />;
  if (action.toLowerCase().includes("streak")) return <Flame className="w-4 h-4 text-orange-500" />;
  return <Zap className="w-4 h-4 text-primary" />;
}

export default function XPDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ClinicianXPProfile | null>(null);
  const [history, setHistory] = useState<XPTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<XPLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [p, h, lb] = await Promise.all([
          clinicianGamificationApi.getXPProfile(),
          clinicianGamificationApi.getXPHistory({ limit: 10 }),
          clinicianGamificationApi.getXPLeaderboard({ limit: 5 }),
        ]);
        setProfile(p);
        setHistory(h.transactions);
        setLeaderboard(lb);
      } catch {
        setError("Failed to load XP data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error || !profile) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="w-8 h-8" />
            <p>{error || "Could not load profile"}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const currentTier = LEVEL_TIERS.find((t) => t.level === profile.level) ?? LEVEL_TIERS[0];

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader title="XP Dashboard" subtitle="Track your experience, level up, and compete" />

        {/* ── Hero Section ──────────────────────────────────────────── */}
        <Card className="bg-gradient-to-br from-primary/10 via-background to-primary/5 border-primary/20">
          <CardContent className="py-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Level badge */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
                    <currentTier.icon className="w-14 h-14 text-primary-foreground" />
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs font-bold px-3">
                      Lvl {profile.level}
                    </Badge>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-foreground mt-2">
                  Level {profile.level} — {profile.title}
                </h2>
              </div>

              {/* XP progress ring */}
              <div className="flex flex-col items-center gap-2">
                <ProgressRing progress={profile.progress} size={140} strokeWidth={10} variant="progress">
                  <span className="text-3xl font-bold text-foreground">{Math.round(profile.progress)}%</span>
                  <span className="text-xs text-muted-foreground">to next level</span>
                </ProgressRing>
                {profile.nextLevel && (
                  <p className="text-sm text-muted-foreground">
                    {profile.xpToNext} XP to <strong>{profile.nextLevel.title}</strong>
                  </p>
                )}
              </div>

              {/* Total XP */}
              <div className="flex flex-col items-center gap-1 bg-card rounded-xl px-8 py-6 border shadow-sm">
                <Zap className="w-8 h-8 text-yellow-500" />
                <span className="text-4xl font-extrabold text-foreground">{profile.totalXP.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground font-medium">Total XP</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Level Progression Bar ────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Level Progression
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 w-full">
              {LEVEL_TIERS.map((tier) => {
                const isActive = tier.level === profile.level;
                const isPast = tier.level < profile.level;
                return (
                  <div key={tier.level} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isActive
                          ? "bg-primary border-primary text-primary-foreground scale-110 shadow-lg shadow-primary/25"
                          : isPast
                          ? "bg-primary/20 border-primary/40 text-primary"
                          : "bg-muted border-muted-foreground/20 text-muted-foreground"
                      }`}
                    >
                      <tier.icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-xs font-medium text-center ${
                        isActive ? "text-primary font-bold" : isPast ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {tier.title}
                    </span>
                    {/* connector line */}
                    {tier.level < LEVEL_TIERS.length && (
                      <div
                        className={`absolute h-0.5 ${isPast ? "bg-primary" : "bg-muted"}`}
                        style={{ width: "100%" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── XP Feed ───────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Recent XP Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">No XP activity yet. Start completing tasks to earn XP!</p>
                ) : (
                  <div className="space-y-3">
                    {history.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border">
                          {actionIcon(tx.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{tx.action}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(tx.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-bold text-green-600">
                          <ArrowUp className="w-3 h-3" />
                          +{tx.xpAmount} XP
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Sidebar: Leaderboard ──────────────────────────────── */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Top Clinicians
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No leaderboard data yet</p>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.map((entry, i) => (
                      <div key={entry.userId} className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            i === 0
                              ? "bg-yellow-100 text-yellow-700"
                              : i === 1
                              ? "bg-gray-100 text-gray-600"
                              : i === 2
                              ? "bg-orange-100 text-orange-700"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {entry.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.fullName}</p>
                          <p className="text-xs text-muted-foreground">{entry.title}</p>
                        </div>
                        <span className="text-sm font-bold text-foreground">
                          {entry.totalXP.toLocaleString()} XP
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Streak Multiplier ─────────────────────────────── */}
            <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/5 border-orange-500/20">
              <CardContent className="py-6 flex flex-col items-center gap-3">
                <Flame className="w-10 h-10 text-orange-500" />
                <p className="text-sm text-muted-foreground">Your streak multiplier</p>
                <span className="text-3xl font-extrabold text-orange-600">1.5x</span>
                <p className="text-xs text-muted-foreground text-center">
                  Complete tasks daily to increase your multiplier
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
