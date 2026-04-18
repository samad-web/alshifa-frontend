import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, AlertCircle, CheckCircle2, Clock, Target,
  Zap, Star, Trophy, Plus, ChevronDown, ChevronUp,
} from "lucide-react";
import { clinicianGamificationApi } from "@/services/clinicianGamification.service";
import type { SeasonalChallengeEntry } from "@/types";

function timeRemaining(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d remaining`;
  const hrs = Math.floor(diff / 3600000);
  return `${hrs}h remaining`;
}

function challengeIcon(icon: string) {
  const iconMap: Record<string, React.ReactNode> = {
    star: <Star className="w-6 h-6 text-yellow-500" />,
    trophy: <Trophy className="w-6 h-6 text-purple-500" />,
    target: <Target className="w-6 h-6 text-blue-500" />,
    zap: <Zap className="w-6 h-6 text-orange-500" />,
  };
  return iconMap[icon?.toLowerCase()] ?? <Target className="w-6 h-6 text-primary" />;
}

export default function SeasonalChallenges() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const [challenges, setChallenges] = useState<SeasonalChallengeEntry[]>([]);
  const [pastChallenges, setPastChallenges] = useState<SeasonalChallengeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "", description: "", metric: "", target: "",
    startDate: "", endDate: "", scope: "", targetRoles: "",
    rewardXP: "", rewardPoints: "", icon: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const active = await clinicianGamificationApi.getActiveSeasonalChallenges();
        setChallenges(active);
      } catch {
        setError("Failed to load challenges");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function loadPast() {
    setShowPast(!showPast);
    if (pastChallenges.length === 0) {
      try {
        const past = await clinicianGamificationApi.getSeasonalChallengeHistory();
        setPastChallenges(past);
      } catch {
        /* silently fail for past challenges */
      }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await clinicianGamificationApi.createSeasonalChallenge({
        title: form.title,
        description: form.description,
        metric: form.metric,
        target: Number(form.target),
        startDate: form.startDate,
        endDate: form.endDate,
        scope: form.scope || undefined,
        targetRoles: form.targetRoles ? form.targetRoles.split(",").map((r) => r.trim()) : undefined,
        rewardXP: Number(form.rewardXP) || undefined,
        rewardPoints: Number(form.rewardPoints) || undefined,
        icon: form.icon || undefined,
      });
      setChallenges((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ title: "", description: "", metric: "", target: "", startDate: "", endDate: "", scope: "", targetRoles: "", rewardXP: "", rewardPoints: "", icon: "" });
    } catch {
      setError("Failed to create challenge");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error && challenges.length === 0) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle className="w-8 h-8" />
            <p>{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader title="Seasonal Challenges" subtitle="Complete challenges to earn bonus XP and points">
          {isAdmin && (
            <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
              <Plus className="w-4 h-4 mr-2" />
              {showForm ? "Cancel" : "Create Challenge"}
            </Button>
          )}
        </PageHeader>

        {/* ── Admin Create Form ──────────────────────────────────── */}
        {isAdmin && showForm && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Create New Challenge</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Input placeholder="Metric (e.g. consultations_completed)" required value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} />
                <Input placeholder="Description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="md:col-span-2" />
                <Input type="number" placeholder="Target" required value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                <Input placeholder="Icon (star, trophy, target, zap)" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
                <Input type="date" placeholder="Start Date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                <Input type="date" placeholder="End Date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                <Input placeholder="Scope (optional)" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
                <Input placeholder="Target Roles (comma-separated)" value={form.targetRoles} onChange={(e) => setForm({ ...form, targetRoles: e.target.value })} />
                <Input type="number" placeholder="Reward XP" value={form.rewardXP} onChange={(e) => setForm({ ...form, rewardXP: e.target.value })} />
                <Input type="number" placeholder="Reward Points" value={form.rewardPoints} onChange={(e) => setForm({ ...form, rewardPoints: e.target.value })} />
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Challenge
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Challenge Grid ─────────────────────────────────────── */}
        {challenges.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No active challenges right now. Check back soon!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {challenges.map((ch) => {
              const completed = ch.progress?.completed ?? false;
              const current = ch.progress?.currentValue ?? 0;
              const pct = Math.min((current / ch.target) * 100, 100);

              return (
                <Card
                  key={ch.id}
                  className={`relative overflow-hidden transition-all hover:shadow-md ${
                    completed ? "border-green-500/30 bg-green-500/5" : ""
                  }`}
                >
                  {completed && (
                    <div className="absolute top-3 right-3">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                        {challengeIcon(ch.icon)}
                      </div>
                      <div>
                        <CardTitle className="text-base">{ch.title}</CardTitle>
                        <CardDescription className="text-xs">{ch.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {current} / {ch.target}
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {timeRemaining(ch.endDate)}
                      </div>
                      <div className="flex items-center gap-2">
                        {ch.rewardXP > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Zap className="w-3 h-3 mr-1" />
                            {ch.rewardXP} XP
                          </Badge>
                        )}
                        {ch.rewardPoints > 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            {ch.rewardPoints} pts
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Past Challenges ────────────────────────────────────── */}
        <div>
          <Button variant="ghost" onClick={loadPast} className="text-muted-foreground">
            {showPast ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
            {showPast ? "Hide" : "Show"} Past Challenges
          </Button>
          {showPast && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastChallenges.length === 0 ? (
                <p className="text-sm text-muted-foreground col-span-full text-center py-6">No past challenges</p>
              ) : (
                pastChallenges.map((ch) => (
                  <Card key={ch.id} className="opacity-70">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        {challengeIcon(ch.icon)}
                        <CardTitle className="text-sm">{ch.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{ch.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {ch.progress?.completed ? (
                          <Badge className="bg-green-500 text-white text-xs">Completed</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {ch.progress?.currentValue ?? 0}/{ch.target}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
