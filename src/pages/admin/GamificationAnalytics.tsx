import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { gamificationApi } from "@/services/gamification.service";
import type { GamificationAnalytics as GamAnalytics } from "@/types";
import {
  Activity, Award, BarChart3, CheckCircle, Flame, ShieldAlert,
  TrendingUp, Users, Zap, Trophy, Target, AlertTriangle
} from "lucide-react";

export default function GamificationAnalytics() {
  const { role } = useAuth();
  const [data, setData] = useState<GamAnalytics | null>(null);
  const [correlation, setCorrelation] = useState<any>(null);
  const [configImpact, setConfigImpact] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<{ anomalies: any[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      gamificationApi.getAnalytics(),
      gamificationApi.getOutcomeCorrelation(),
      gamificationApi.getConfigImpact(),
      gamificationApi.getAnomalies({ limit: 10 })
    ])
      .then(([analytics, corr, impact, anom]) => {
        setData(analytics);
        setCorrelation(corr);
        setConfigImpact(impact);
        setAnomalies(anom);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (role !== "ADMIN" && role !== "ADMIN_DOCTOR") return <div>Access denied.</div>;

  if (loading) return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <BarChart3 className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Analytics...</p>
        </div>
      </div>
    </AppLayout>
  );

  if (!data) return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 text-center text-attention">Failed to load analytics</div>
    </AppLayout>
  );

  const { engagement, scoreTrend, badgeDistribution, patientStats } = data;

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Gamification Analytics"
          subtitle="Monitor engagement, outcomes, and the impact of gamification across the platform."
        />

        {/* Clinician Engagement Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Competition Rate" value={`${engagement.competitionRate}%`} icon={Activity} description={`${engagement.activelyCompeting} of ${engagement.totalClinicians} clinicians`} />
          <StatCard title="Active Streaks" value={`${engagement.streakRate}%`} icon={Flame} description={`${engagement.activeStreaks} clinicians on streaks`} />
          <StatCard title="Badges Awarded" value={engagement.totalBadgesAwarded} icon={Award} description="Total across all clinicians" />
          <StatCard title="Anomalies" value={engagement.unresolvedAnomalies} icon={ShieldAlert} description="Unresolved flags" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Score Trend Chart */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Average Score Trend (12 Weeks)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scoreTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No trend data yet</p>
              ) : (
                <div className="flex items-end justify-between h-40 px-2 gap-1">
                  {scoreTrend.map((week, i) => {
                    const maxScore = Math.max(...scoreTrend.map(w => w.avgScore), 1);
                    const height = (week.avgScore / maxScore) * 100;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1 flex-1">
                        <span className="text-[8px] font-bold text-primary">{week.avgScore}</span>
                        <div
                          className="w-full max-w-[32px] rounded-t-md bg-primary/20 hover:bg-primary/40 transition-colors"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[7px] font-black text-muted-foreground uppercase truncate w-full text-center">
                          {new Date(week.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Badge Distribution */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Badge Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {badgeDistribution.map(badge => {
                  const maxCount = Math.max(...badgeDistribution.map(b => b.awardedCount), 1);
                  return (
                    <div key={badge.code} className="flex items-center gap-3">
                      <div className="w-24 text-xs font-bold truncate">{badge.name}</div>
                      <div className="flex-1">
                        <Progress value={(badge.awardedCount / maxCount) * 100} className="h-2" />
                      </div>
                      <div className="w-10 text-right">
                        <Badge variant="outline" className="text-[9px]">{badge.awardedCount}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Score vs Outcome Correlation */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-wellness" />
                Score vs Patient Outcomes
              </CardTitle>
              <CardDescription>Does higher leaderboard score correlate with better outcomes?</CardDescription>
            </CardHeader>
            <CardContent>
              {Array.isArray(correlation) && correlation.length > 0 ? (
                <div className="space-y-3">
                  {correlation.map((bucket: any) => (
                    <div key={bucket.scoreRange} className="flex items-center gap-3">
                      <div className="w-28 text-xs font-bold">{bucket.scoreRange}</div>
                      <div className="flex-1 flex items-center gap-2">
                        <Progress value={bucket.avgJourneySuccessRate} className="h-2 flex-1" />
                        <span className="text-xs font-black text-primary w-12 text-right">{bucket.avgJourneySuccessRate}%</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground w-12">{bucket.clinicianCount} docs</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Insufficient data for correlation analysis</p>
              )}
            </CardContent>
          </Card>

          {/* Config Impact */}
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Config Change Impact
              </CardTitle>
              <CardDescription>Before vs after the last weight/target update</CardDescription>
            </CardHeader>
            <CardContent>
              {configImpact?.hasComparison ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-secondary/10 text-center">
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Before</p>
                      <p className="text-2xl font-black">{configImpact.before.avgScore}</p>
                      <p className="text-[9px] text-muted-foreground">{configImpact.before.sampleSize} samples</p>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">After</p>
                      <p className="text-2xl font-black text-primary">{configImpact.after.avgScore}</p>
                      <p className="text-[9px] text-muted-foreground">{configImpact.after.sampleSize} samples</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <span className={`text-lg font-black ${configImpact.impact >= 0 ? 'text-wellness' : 'text-attention'}`}>
                      {configImpact.impact >= 0 ? '+' : ''}{configImpact.impact} pts ({configImpact.impactPercent}%)
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{configImpact?.message || 'No comparison data'}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Patient Gamification Stats */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Patient Gamification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-xl bg-secondary/5">
                <p className="text-2xl font-black text-primary">{patientStats.engagementRate}%</p>
                <p className="text-[9px] font-black text-muted-foreground uppercase">Engagement Rate</p>
                <p className="text-[8px] text-muted-foreground">{patientStats.activePatients}/{patientStats.totalPatients} active</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-secondary/5">
                <p className="text-2xl font-black text-primary">{patientStats.avgZenPoints}</p>
                <p className="text-[9px] font-black text-muted-foreground uppercase">Avg Zen Points</p>
                <p className="text-[8px] text-muted-foreground">Max: {patientStats.maxZenPoints}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-secondary/5">
                <p className="text-2xl font-black text-primary">{patientStats.avgStreakDays}d</p>
                <p className="text-[9px] font-black text-muted-foreground uppercase">Avg Streak</p>
                <p className="text-[8px] text-muted-foreground">Best: {patientStats.longestStreak}d</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-secondary/5">
                <p className="text-2xl font-black text-primary">{patientStats.totalChallengesCompleted}</p>
                <p className="text-[9px] font-black text-muted-foreground uppercase">Challenges Done</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Anomalies */}
        {anomalies && anomalies.total > 0 && (
          <Card className="border-none shadow-sm border-l-4 border-l-attention">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-attention" />
                Unresolved Anomalies ({anomalies.total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {anomalies.anomalies.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-attention/5 border border-attention/20">
                    <div>
                      <p className="text-xs font-bold">{a.anomalyType}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Participant: {a.participantId.slice(0, 8)}... | {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      className="text-[10px] font-bold text-primary hover:underline"
                      onClick={async () => {
                        await gamificationApi.resolveAnomaly(a.id);
                        setAnomalies(prev => prev ? {
                          ...prev,
                          anomalies: prev.anomalies.filter((x: any) => x.id !== a.id),
                          total: prev.total - 1
                        } : null);
                      }}
                    >
                      Resolve
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
