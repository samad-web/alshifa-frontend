import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, AlertCircle, Users, Calendar, Clock, Zap,
  BookOpen, CheckCircle2, XCircle, Flame, TrendingUp, Plus,
} from "lucide-react";
import { clinicianGamificationApi } from "@/services/clinicianGamification.service";
import type { MentorSessionEntry, MentorStats } from "@/types";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function MentorHub() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<MentorSessionEntry[]>([]);
  const [stats, setStats] = useState<MentorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [sessionTab, setSessionTab] = useState("Upcoming");

  const [form, setForm] = useState({
    menteeId: "", topic: "", date: "", durationMins: "60",
  });

  useEffect(() => {
    async function load() {
      try {
        const [s, st] = await Promise.all([
          clinicianGamificationApi.getMySessions(),
          clinicianGamificationApi.getMentorStats(),
        ]);
        setSessions(s);
        setStats(st);
      } catch {
        setError("Failed to load mentor data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await clinicianGamificationApi.createMentorSession({
        menteeId: form.menteeId,
        topic: form.topic,
        date: form.date,
        durationMins: Number(form.durationMins) || 60,
      });
      setSessions((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ menteeId: "", topic: "", date: "", durationMins: "60" });
    } catch {
      setError("Failed to schedule session");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComplete(sessionId: string) {
    setCompleting(sessionId);
    try {
      const updated = await clinicianGamificationApi.completeSession(sessionId);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      // Refresh stats
      const st = await clinicianGamificationApi.getMentorStats();
      setStats(st);
    } catch {
      setError("Failed to complete session");
    } finally {
      setCompleting(null);
    }
  }

  async function handleCancel(sessionId: string) {
    try {
      const updated = await clinicianGamificationApi.cancelSession(sessionId);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch {
      setError("Failed to cancel session");
    }
  }

  const upcomingSessions = sessions.filter((s) => s.status === "SCHEDULED" || s.status === "PENDING");
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED");
  const displaySessions =
    sessionTab === "Upcoming" ? upcomingSessions :
    sessionTab === "Completed" ? completedSessions : sessions;

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (error && sessions.length === 0 && !stats) {
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
        <PageHeader title="Mentor Hub" subtitle="Manage mentoring sessions and track your impact">
          <Button onClick={() => setShowForm(!showForm)} variant={showForm ? "outline" : "default"}>
            <Plus className="w-4 h-4 mr-2" />
            {showForm ? "Cancel" : "Schedule Session"}
          </Button>
        </PageHeader>

        {/* ── Stats Cards ────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="py-6 flex flex-col items-center gap-2">
                <Calendar className="w-8 h-8 text-blue-500" />
                <span className="text-3xl font-extrabold text-foreground">{stats.totalSessions}</span>
                <span className="text-sm text-muted-foreground">Total Sessions</span>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
              <CardContent className="py-6 flex flex-col items-center gap-2">
                <Users className="w-8 h-8 text-purple-500" />
                <span className="text-3xl font-extrabold text-foreground">{stats.totalMentees}</span>
                <span className="text-sm text-muted-foreground">Total Mentees</span>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
              <CardContent className="py-6 flex flex-col items-center gap-2">
                <Zap className="w-8 h-8 text-yellow-500" />
                <span className="text-3xl font-extrabold text-foreground">{stats.xpEarned.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">XP from Mentoring</span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Consistency Multiplier ─────────────────────────────── */}
        <Card className="bg-gradient-to-r from-orange-500/10 via-red-500/5 to-orange-500/10 border-orange-500/20">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
              <Flame className="w-10 h-10 text-orange-500" />
              <div className="text-center sm:text-left">
                <p className="text-lg font-semibold text-foreground">
                  Your consistency multiplier: <span className="text-orange-600 text-2xl font-extrabold">1.5x</span>
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 justify-center sm:justify-start">
                  <TrendingUp className="w-4 h-4" />
                  Longer streaks = more XP per action
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Schedule Session Form ──────────────────────────────── */}
        {showForm && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Schedule a Mentor Session</CardTitle>
              <CardDescription>Set up a meeting with a junior clinician</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSession} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input placeholder="Mentee User ID" required value={form.menteeId} onChange={(e) => setForm({ ...form, menteeId: e.target.value })} />
                <Input placeholder="Topic" required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
                <Input type="datetime-local" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                <Input type="number" placeholder="Duration (minutes)" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: e.target.value })} />
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Schedule
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Sessions List ──────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={sessionTab} onValueChange={setSessionTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="Upcoming">
                  Upcoming ({upcomingSessions.length})
                </TabsTrigger>
                <TabsTrigger value="Completed">
                  Completed ({completedSessions.length})
                </TabsTrigger>
                <TabsTrigger value="All">
                  All ({sessions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={sessionTab}>
                {displaySessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No sessions found</p>
                ) : (
                  <div className="space-y-3">
                    {displaySessions.map((session) => {
                      const isUpcoming = session.status === "SCHEDULED" || session.status === "PENDING";
                      const isCompleted = session.status === "COMPLETED";

                      return (
                        <div
                          key={session.id}
                          className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border transition-colors ${
                            isCompleted ? "bg-green-500/5 border-green-500/20" : "bg-card hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isCompleted
                                  ? "bg-green-500/10 text-green-600"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{session.topic}</p>
                              <p className="text-xs text-muted-foreground">
                                {session.mentorName && `Mentor: ${session.mentorName}`}
                                {session.mentorName && session.menteeName && " | "}
                                {session.menteeName && `Mentee: ${session.menteeName}`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {formatDate(session.date)}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {session.durationMins}min
                            </div>
                            <Badge
                              variant={isCompleted ? "default" : isUpcoming ? "secondary" : "outline"}
                              className="text-xs"
                            >
                              {session.status}
                            </Badge>

                            {isUpcoming && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleComplete(session.id)}
                                  disabled={completing === session.id}
                                >
                                  {completing === session.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                  )}
                                  Complete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancel(session.id)}
                                >
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
