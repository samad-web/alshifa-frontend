import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, AlertCircle, Users, Clock, MapPin, Zap,
  Trophy, Plus, PartyPopper, Sparkles, CheckCircle2,
} from "lucide-react";
import { clinicianGamificationApi } from "@/services/clinicianGamification.service";
import type { TeamQuestEntry } from "@/types";

function timeRemaining(endDate: string) {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d remaining`;
  const hrs = Math.floor(diff / 3600000);
  return `${hrs}h remaining`;
}

export default function TeamQuests() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const [quests, setQuests] = useState<TeamQuestEntry[]>([]);
  const [history, setHistory] = useState<TeamQuestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    branchId: "", title: "", description: "", metric: "",
    target: "", startDate: "", endDate: "", rewardXP: "", icon: "",
  });

  useEffect(() => {
    async function load() {
      try {
        const [active, past] = await Promise.all([
          clinicianGamificationApi.getActiveTeamQuests(),
          clinicianGamificationApi.getTeamQuestHistory({ limit: 10 }),
        ]);
        setQuests(active);
        setHistory(past);
      } catch {
        setError("Failed to load team quests");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await clinicianGamificationApi.createTeamQuest({
        branchId: form.branchId,
        title: form.title,
        description: form.description,
        metric: form.metric,
        target: Number(form.target),
        startDate: form.startDate,
        endDate: form.endDate,
        rewardXP: Number(form.rewardXP) || undefined,
        icon: form.icon || undefined,
      });
      setQuests((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ branchId: "", title: "", description: "", metric: "", target: "", startDate: "", endDate: "", rewardXP: "", icon: "" });
    } catch {
      setError("Failed to create quest");
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

  if (error && quests.length === 0) {
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

  const activeQuest = quests.find((q) => !q.completed);
  const completedQuests = quests.filter((q) => q.completed);

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader title="Team Quests" subtitle="Work together as a branch to achieve cooperative goals">
          {isAdmin && (
            <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
              <Plus className="w-4 h-4 mr-2" />
              {showForm ? "Cancel" : "Create Quest"}
            </Button>
          )}
        </PageHeader>

        {/* ── Admin Create Form ──────────────────────────────────── */}
        {isAdmin && showForm && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Create New Team Quest</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Branch ID" required value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })} />
                <Input placeholder="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Input placeholder="Description" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="md:col-span-2" />
                <Input placeholder="Metric" required value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} />
                <Input type="number" placeholder="Target" required value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                <Input type="date" placeholder="Start Date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                <Input type="date" placeholder="End Date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                <Input type="number" placeholder="Reward XP" value={form.rewardXP} onChange={(e) => setForm({ ...form, rewardXP: e.target.value })} />
                <Input placeholder="Icon" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Quest
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Active Quest Hero ──────────────────────────────────── */}
        {activeQuest ? (
          <Card className="bg-gradient-to-br from-primary/10 via-background to-blue-500/5 border-primary/20">
            <CardContent className="py-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <ProgressRing
                  progress={Math.min((activeQuest.currentValue / activeQuest.target) * 100, 100)}
                  size={160}
                  strokeWidth={12}
                  variant="progress"
                >
                  <span className="text-2xl font-bold">{Math.round((activeQuest.currentValue / activeQuest.target) * 100)}%</span>
                  <span className="text-xs text-muted-foreground">complete</span>
                </ProgressRing>

                <div className="flex-1 space-y-3 text-center md:text-left">
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <Trophy className="w-6 h-6 text-primary" />
                    <h2 className="text-2xl font-bold text-foreground">{activeQuest.title}</h2>
                  </div>
                  <p className="text-muted-foreground">{activeQuest.description}</p>

                  <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start">
                    {activeQuest.branchName && (
                      <Badge variant="outline" className="text-sm">
                        <MapPin className="w-3 h-3 mr-1" />
                        {activeQuest.branchName}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-sm">
                      <Clock className="w-3 h-3 mr-1" />
                      {timeRemaining(activeQuest.endDate)}
                    </Badge>
                    <Badge variant="secondary" className="text-sm">
                      <Zap className="w-3 h-3 mr-1" />
                      {activeQuest.rewardXP} XP reward
                    </Badge>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Progress: <strong>{activeQuest.currentValue}</strong> / {activeQuest.target} {activeQuest.metric}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No active team quest right now</p>
            </CardContent>
          </Card>
        )}

        {/* ── Team Contributions Panel ───────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Branch Team Stats
            </CardTitle>
            <CardDescription>Contributions from your branch members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">--</p>
                <p className="text-xs text-muted-foreground">Active Members</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">--</p>
                <p className="text-xs text-muted-foreground">Contributions Today</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">--</p>
                <p className="text-xs text-muted-foreground">Top Contributor</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-foreground">--</p>
                <p className="text-xs text-muted-foreground">Quests Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Completed Quests — Celebration ─────────────────────── */}
        {completedQuests.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-yellow-500" />
              Completed Quests
            </h3>
            {completedQuests.map((q) => (
              <Card key={q.id} className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-green-500/20">
                <CardContent className="py-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      {q.title}
                      <Sparkles className="w-4 h-4 text-yellow-500" />
                    </h4>
                    <p className="text-sm text-muted-foreground">{q.description}</p>
                  </div>
                  <Badge className="bg-green-500 text-white">
                    <Zap className="w-3 h-3 mr-1" />
                    +{q.rewardXP} XP
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Quest History Timeline ─────────────────────────────── */}
        {history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Quest History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 pl-6 before:absolute before:left-2 before:top-0 before:bottom-0 before:w-0.5 before:bg-muted">
                {history.map((q) => (
                  <div key={q.id} className="relative">
                    <div
                      className={`absolute -left-4 w-4 h-4 rounded-full border-2 ${
                        q.completed
                          ? "bg-green-500 border-green-500"
                          : "bg-muted-foreground/30 border-muted-foreground/30"
                      }`}
                    />
                    <div className="ml-2">
                      <p className="text-sm font-medium">{q.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.branchName && `${q.branchName} | `}
                        {q.currentValue}/{q.target} {q.metric}
                        {q.completed && " | Completed"}
                      </p>
                    </div>
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
