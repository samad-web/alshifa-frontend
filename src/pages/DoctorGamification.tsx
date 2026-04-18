
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Users, Award, Activity, TrendingUp, TrendingDown, MapPin, Flame } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { LeaderboardDetailModal } from "@/components/gamification/LeaderboardDetailModal";
import { BadgeShowcase } from "@/components/gamification/BadgeShowcase";
import { StreakDisplay } from "@/components/gamification/StreakDisplay";
import { BranchCompetitionPanel } from "@/components/gamification/BranchCompetitionPanel";

export default function DoctorGamification() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  useEffect(() => {
    if (!isAdmin) return;
    apiClient.get<any[]>('/api/branches')
      .then(({ data }) => setBranches(data))
      .catch(err => console.error("Failed to fetch branches", err));
  }, [isAdmin]);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (isAdmin && selectedBranchId !== "all") {
      params.branchId = selectedBranchId;
    }

    apiClient.get<{ data: any[] } | any[]>('/api/leaderboard', params)
      .then(({ data }) => setStats(Array.isArray(data) ? data : data?.data ?? []))
      .catch(() => setError("Failed to load clinical statistics"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, isAdmin]);

  const isTherapist = role === "THERAPIST";

  if (role !== "DOCTOR" && role !== "ADMIN_DOCTOR" && role !== "ADMIN" && role !== "THERAPIST") return <div>Access denied.</div>;

  if (loading) return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            {isTherapist ? "Aggregating Therapeutic Data..." : "Aggregating Clinical Data..."}
          </p>
        </div>
      </div>
    </AppLayout>
  );

  if (error) return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 text-center text-attention font-bold">{error}</div>
    </AppLayout>
  );

  // --- Gamification logic ---
  const getLevel = (score: number, userRole: string | null): { label: string; band: "excellent" | "good" | "needs-attention"; next: string | null; nextAt: number | null; color: string } => {
    const isTherapist = userRole === "THERAPIST";
    if (score >= 90) return {
      label: isTherapist ? "Master of Therapy" : "Master of Wellness",
      band: "excellent",
      next: null,
      nextAt: null,
      color: "text-amber-500"
    };
    if (score >= 60) return {
      label: isTherapist ? "Lead Therapist" : "Attending Physician",
      band: "good",
      next: isTherapist ? "Master of Therapy" : "Master of Wellness",
      nextAt: 90,
      color: "text-slate-400"
    };
    return {
      label: isTherapist ? "Associate Therapist" : "Clinical Resident",
      band: "needs-attention",
      next: isTherapist ? "Lead Therapist" : "Attending Physician",
      nextAt: 60,
      color: "text-amber-700"
    };
  };

  const totalExcellence = stats.length > 0 ? Math.round(stats.reduce((sum, d) => sum + (d.score || 0), 0) / stats.length) : 0;
  const avgRecovery = stats.length > 0 ? Math.round(stats.reduce((sum, d) => sum + (d.metrics?.successRate?.value || 0), 0) / stats.length) : 0;
  const activeDoctors = stats.length;

  const currentDoc = stats[0] || {};
  const docExcellence = currentDoc.score || 0;
  const level = getLevel(docExcellence, role);
  const toNext = level.nextAt ? Math.max(0, level.nextAt - docExcellence) : 0;

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-8">
        <PageHeader
          title={isTherapist ? "Therapeutic Intelligence & Excellence" : "Clinical Intelligence & Excellence"}
          subtitle={isTherapist
            ? "Visualize therapeutic quality, patient recovery trajectories, and specialized performance bands."
            : "Visualize clinical quality, patient recovery trajectories, and specialized performance bands."
          }
        >
          {isAdmin ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end mr-2">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Performance Segment</span>
                <p className="text-xs font-bold text-foreground/70">Branch-wise Filtering</p>
              </div>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-[200px] h-10 border-border/60 bg-card/50 backdrop-blur-sm shadow-sm ring-offset-background focus:ring-primary/20">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <SelectValue placeholder="All Branches" />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-card border-border shadow-elevated">
                  <SelectItem value="all" className="text-xs font-bold py-2.5">All Branches (Global)</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs font-bold py-2.5">
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-card/50">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Your Branch</span>
            </div>
          )}
        </PageHeader>

        {/* Global Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Network Excellence" value={`${totalExcellence}%`} icon={Award} description="Avg excellence score" />
          <StatCard title="Recovery Index" value={`${avgRecovery}%`} icon={Activity} description="Avg patient progress" />
          <StatCard title={isTherapist ? "Therapist Network" : "Provider Network"} value={activeDoctors} icon={Users} />
          <StatCard title={isTherapist ? "Therapist Rank" : "Primary Rank"} value={level.label} icon={Award} description="Current prestige tier" />
        </div>

        {/* Row 1: Performance Card + Streak + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* Performance Card */}
          <Card className="lg:col-span-5 border-none shadow-elevated bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden border-l-4 border-l-primary/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Award className={`w-5 h-5 ${level.color}`} />
                </div>
                <Badge variant="outline" className="font-black uppercase tracking-widest text-[10px]">
                  Current Standing
                </Badge>
              </div>
              <CardTitle className="text-xl font-black">{level.label}</CardTitle>
              <CardDescription className="text-xs">Based on clinical quality and patient volume</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              <div className="flex justify-around items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <ProgressRing
                      progress={docExcellence}
                      size={110}
                      variant="progress"
                      strokeWidth={10}
                      showLabel={false}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-foreground">{docExcellence}%</span>
                      <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">Excellence</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <ProgressRing
                      progress={currentDoc.recoveryRate || 0}
                      size={90}
                      variant="recovery"
                      strokeWidth={8}
                      showLabel={false}
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-black text-wellness">{Math.round(currentDoc.metrics?.successRate?.value || 0)}%</span>
                      <span className="text-[6px] font-bold text-muted-foreground uppercase tracking-widest">Recovery</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl bg-wellness/5 border border-wellness/10">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Recovered</p>
                  <p className="text-xl font-black text-wellness">{currentDoc.completedJourneysCount || 0}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-accent/5 border border-accent/10">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Response</p>
                  <p className="text-xl font-black text-accent">
                    {currentDoc.metrics?.responseTime?.value !== undefined
                      ? Number(currentDoc.metrics.responseTime.value).toFixed(1)
                      : 0}m
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-secondary/20 border border-border/50 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Next Level:</span>
                  <span className="text-xs font-bold text-primary">{level.next || "Highest Achieved"}</span>
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed">
                  {level.next ? (
                    `Increase excellence by ${toNext} points through successful recoveries and consistent engagement.`
                  ) : (
                    isTherapist
                      ? "Peak therapeutic excellence achieved. Your patient dedication is exemplary."
                      : "Peak clinical excellence achieved. Your patient dedication is exemplary."
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Streak + Rankings column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Streak */}
            <StreakDisplay />

            {/* Rankings Table */}
            <Card className="shadow-sm border-border/60">
              <CardHeader className="border-b border-border/50 bg-secondary/10 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{isTherapist ? "Therapist Excellence Rankings" : "Clinician Excellence Rankings"}</CardTitle>
                    <CardDescription className="text-xs">Ranked by outcome-weighted excellence scores</CardDescription>
                  </div>
                  <div className="p-2 bg-background rounded-lg border border-border/50">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {stats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 bg-secondary/5">
                    <Activity className="w-10 h-10 text-muted-foreground/20 mb-3" />
                    <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">No clinical records found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {stats.map((doc, idx) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4 hover:bg-secondary/10 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedParticipantId(doc.id);
                          setModalOpen(true);
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-full bg-secondary/40 flex items-center justify-center text-xs font-black text-muted-foreground border border-border/50 group-hover:border-primary/50 group-hover:text-primary transition-all shrink-0">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                              <span className="truncate">{doc.fullName || doc.email || "Confidential Provider"}</span>
                              {doc.trend === 'up' && <TrendingUp className="w-3 h-3 text-wellness shrink-0" />}
                              {doc.trend === 'down' && <TrendingDown className="w-3 h-3 text-attention shrink-0" />}
                              {doc.metrics?.streak?.currentStreak >= 7 && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                                  <Flame className="w-2.5 h-2.5" />{doc.metrics.streak.currentStreak}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter">
                                {doc.specialization || "General Specialist"}
                              </span>
                              <div className="flex items-center gap-1">
                                <Activity className="w-3 h-3 text-wellness" />
                                <span className="text-[10px] font-bold text-wellness">{Math.round(doc.metrics?.successRate?.value || 0)}% Success</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div className="text-xl font-black text-primary">{doc.score}</div>
                          <div className="text-[9px] font-black text-muted-foreground uppercase">Score</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Row 2: Achievements — full width for better desktop utilization */}
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-500" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BadgeShowcase />
          </CardContent>
        </Card>

        {/* Row 3: Branch Competition */}
        <BranchCompetitionPanel />
      </div>

      <LeaderboardDetailModal
        participantId={selectedParticipantId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </AppLayout>
  );
}

