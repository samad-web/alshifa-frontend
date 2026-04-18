import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sword,
  Clock,
  Star,
  CheckCircle2,
  Play,
  Trophy,
  Target,
  Dumbbell,
  Pill,
  Heart,
  Loader2,
} from "lucide-react";
import { patientGamificationApi } from "@/services/patientGamification.service";
import type { HealthQuest } from "@/types";
import { useToast } from "@/components/ui/use-toast";

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Hard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const TASK_ICONS: Record<string, React.ReactNode> = {
  EXERCISE: <Dumbbell className="h-4 w-4" />,
  MEDICATION: <Pill className="h-4 w-4" />,
  VITAL: <Heart className="h-4 w-4" />,
  CHECKIN: <CheckCircle2 className="h-4 w-4" />,
};

function getDaysRemaining(startedAt: string, durationDays: number): number {
  const start = new Date(startedAt);
  const end = new Date(start.getTime() + durationDays * 86400000);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
}

export default function HealthQuests() {
  const [availableQuests, setAvailableQuests] = useState<HealthQuest[]>([]);
  const [myQuests, setMyQuests] = useState<HealthQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadQuests();
  }, []);

  async function loadQuests() {
    try {
      const [available, mine] = await Promise.all([
        patientGamificationApi.getAvailableQuests(),
        patientGamificationApi.getMyQuests(),
      ]);
      setAvailableQuests(available);
      setMyQuests(mine);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load quests.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleStartQuest(questId: string) {
    setActionLoading(questId);
    try {
      await patientGamificationApi.startQuest(questId);
      toast({ title: "Quest Started!", description: "Good luck on your journey!" });
      await loadQuests();
    } catch {
      toast({
        title: "Error",
        description: "Failed to start quest.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCompleteTask(questId: string, taskIndex: number) {
    setActionLoading(`${questId}-${taskIndex}`);
    try {
      const result = await patientGamificationApi.recordTaskProgress(
        questId,
        taskIndex
      );
      if (result.questCompleted) {
        toast({
          title: "Quest Completed!",
          description: `You earned ${result.pointsEarned} points!`,
        });
      } else {
        toast({ title: "Task Completed!", description: "Keep going!" });
      }
      await loadQuests();
    } catch {
      toast({
        title: "Error",
        description: "Failed to complete task.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  const activeQuests = myQuests.filter((q) => q.progress?.status === "ACTIVE");
  const completedQuests = myQuests.filter(
    (q) => q.progress?.status === "COMPLETED"
  );

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto p-4 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Health Quests"
          subtitle="Complete multi-step quests to earn rewards and improve your health"
        >
          <Badge variant="outline" className="gap-1 text-sm">
            <Trophy className="h-4 w-4 text-yellow-500" />
            {completedQuests.length} Completed
          </Badge>
        </PageHeader>

        <Tabs defaultValue="available">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="available" className="gap-1">
              <Target className="h-4 w-4" />
              Available ({availableQuests.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-1">
              <Sword className="h-4 w-4" />
              Active ({activeQuests.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1">
              <CheckCircle2 className="h-4 w-4" />
              Completed ({completedQuests.length})
            </TabsTrigger>
          </TabsList>

          {/* Available Quests */}
          <TabsContent value="available" className="mt-4">
            {availableQuests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No new quests available right now. Check back later!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {availableQuests.map((quest) => (
                  <Card
                    key={quest.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <span className="text-3xl">{quest.icon || "🎯"}</span>
                        <Badge
                          className={
                            DIFFICULTY_COLORS[quest.difficulty] || ""
                          }
                          variant="secondary"
                        >
                          {quest.difficulty}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-2">
                        {quest.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {quest.description}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          {quest.pointReward} pts
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {quest.durationDays} days
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quest.tasks.length} tasks to complete
                      </div>
                      <Button
                        className="w-full gap-2"
                        onClick={() => handleStartQuest(quest.id)}
                        disabled={actionLoading === quest.id}
                      >
                        {actionLoading === quest.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Start Quest
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Active Quests */}
          <TabsContent value="active" className="mt-4 space-y-4">
            {activeQuests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Sword className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No active quests. Start one from the Available tab!</p>
                </CardContent>
              </Card>
            ) : (
              activeQuests.map((quest) => {
                const completedTasks =
                  quest.progress?.tasksCompleted?.length || 0;
                const totalTasks = quest.tasks.length;
                const progressPercent =
                  totalTasks > 0
                    ? Math.round((completedTasks / totalTasks) * 100)
                    : 0;
                const daysLeft = quest.progress?.startedAt
                  ? getDaysRemaining(
                      quest.progress.startedAt,
                      quest.durationDays
                    )
                  : quest.durationDays;
                const completedIndices = new Set(
                  quest.progress?.tasksCompleted?.map((t) => t.taskIndex) || []
                );

                return (
                  <Card key={quest.id} className="border-primary/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">
                            {quest.icon || "🎯"}
                          </span>
                          <div>
                            <CardTitle className="text-lg">
                              {quest.title}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {quest.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <Badge
                            variant="outline"
                            className="gap-1 text-orange-600 border-orange-300"
                          >
                            <Clock className="h-3 w-3" />
                            {daysLeft}d left
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Progress
                          </span>
                          <span className="font-medium">
                            {completedTasks}/{totalTasks} tasks
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>

                      <div className="space-y-2">
                        {quest.tasks.map((task, idx) => {
                          const isCompleted = completedIndices.has(idx);
                          const loadKey = `${quest.id}-${idx}`;
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${
                                isCompleted
                                  ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
                                  : "bg-background"
                              }`}
                            >
                              <Checkbox
                                checked={isCompleted}
                                disabled={
                                  isCompleted || actionLoading === loadKey
                                }
                                onCheckedChange={() =>
                                  handleCompleteTask(quest.id, idx)
                                }
                              />
                              <div className="flex items-center gap-2 flex-1">
                                {TASK_ICONS[task.type] || (
                                  <Target className="h-4 w-4" />
                                )}
                                <span
                                  className={`text-sm ${
                                    isCompleted
                                      ? "line-through text-muted-foreground"
                                      : "font-medium"
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </div>
                              {!isCompleted && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0"
                                  disabled={actionLoading === loadKey}
                                  onClick={() =>
                                    handleCompleteTask(quest.id, idx)
                                  }
                                >
                                  {actionLoading === loadKey ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Complete"
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Star className="h-4 w-4 text-yellow-500" />
                        Reward: {quest.pointReward} points
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Completed Quests */}
          <TabsContent value="completed" className="mt-4 space-y-3">
            {completedQuests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No completed quests yet. Start your first quest!</p>
                </CardContent>
              </Card>
            ) : (
              completedQuests.map((quest) => (
                <Card
                  key={quest.id}
                  className="bg-muted/30 border-green-200 dark:border-green-500/20"
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{quest.icon || "🎯"}</span>
                      <div className="flex-1">
                        <div className="font-medium">{quest.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            Completed
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-yellow-500" />
                            +{quest.pointReward} pts
                          </span>
                        </div>
                      </div>
                      <Badge
                        className={
                          DIFFICULTY_COLORS[quest.difficulty] || ""
                        }
                        variant="secondary"
                      >
                        {quest.difficulty}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
