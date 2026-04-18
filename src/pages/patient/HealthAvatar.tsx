import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  Heart,
  Smile,
  Activity,
  Pill,
  Dumbbell,
  ClipboardCheck,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { patientGamificationApi } from "@/services/patientGamification.service";
import type { HealthAvatarState } from "@/types";
import { useToast } from "@/components/ui/use-toast";

const AVATAR_EMOJIS: Record<string, string[]> = {
  PLANT: ["🌱", "🌿", "🌳", "🌲", "🏔️"],
  PET: ["🥚", "🐣", "🐕", "🦁", "🐉"],
  CHARACTER: ["👶", "🧒", "🧑", "🦸", "🧙"],
};

function getAvatarEmoji(type: string, level: number): string {
  const emojis = AVATAR_EMOJIS[type] || AVATAR_EMOJIS.PET;
  const idx = Math.min(level, emojis.length) - 1;
  return emojis[Math.max(0, idx)];
}

const FEED_ACTIONS = [
  {
    activityType: "LOG_VITALS",
    label: "Log Vitals",
    icon: Activity,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30",
  },
  {
    activityType: "CHECK_IN",
    label: "Check In",
    icon: ClipboardCheck,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30",
  },
  {
    activityType: "EXERCISE",
    label: "Exercise",
    icon: Dumbbell,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30",
  },
  {
    activityType: "TAKE_MEDICATION",
    label: "Take Medication",
    icon: Pill,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30",
  },
];

export default function HealthAvatar() {
  const [avatar, setAvatar] = useState<HealthAvatarState | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedingAction, setFeedingAction] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAvatar();
  }, []);

  async function loadAvatar() {
    try {
      const data = await patientGamificationApi.getAvatar();
      setAvatar(data);
    } catch {
      toast({
        title: "Error",
        description: "Failed to load avatar.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleFeed(activityType: string) {
    setFeedingAction(activityType);
    try {
      const updated = await patientGamificationApi.feedAvatar(activityType);
      setAvatar(updated);
      toast({
        title: "Your companion is happy!",
        description: `${avatar?.name || "Your companion"} enjoyed that!`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to feed companion.",
        variant: "destructive",
      });
    } finally {
      setFeedingAction(null);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto p-4 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!avatar) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto p-4">
          <PageHeader title="Health Companion" subtitle="Your virtual wellness buddy" />
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <span className="text-6xl block mb-4">🥚</span>
              <p>Your health companion hasn't hatched yet. Complete some activities to get started!</p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const emoji = getAvatarEmoji(avatar.avatarType, avatar.level);
  const needsAttention = avatar.health < 40 || avatar.happiness < 40;
  const xpProgress = avatar.xpToNext > 0 ? Math.round(avatar.progress) : 100;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Health Companion"
          subtitle="Take care of your virtual wellness buddy"
        >
          <Badge variant="outline" className="gap-1 text-sm">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            Level {avatar.level}
          </Badge>
        </PageHeader>

        {/* Avatar Display */}
        <Card className={needsAttention ? "border-orange-300 dark:border-orange-500/50" : ""}>
          <CardContent className="pt-8 pb-6">
            <div className="flex flex-col items-center space-y-4">
              {/* Main Avatar */}
              <div className="relative">
                <div className="text-[8rem] leading-none select-none animate-bounce" style={{ animationDuration: "3s" }}>
                  {emoji}
                </div>
                {needsAttention && (
                  <div className="absolute -top-2 -right-2 bg-orange-100 dark:bg-orange-900/40 rounded-full p-1.5">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  </div>
                )}
              </div>

              {/* Name and Level */}
              <div className="text-center">
                <h2 className="text-2xl font-bold">{avatar.name}</h2>
                <p className="text-muted-foreground">{avatar.stageName}</p>
              </div>

              {/* Decay Warning */}
              {needsAttention && (
                <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-4 py-2 rounded-lg text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Your companion needs attention!
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Health Bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Heart className="h-4 w-4 text-green-500" />
                Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={avatar.health}
                className="h-3 [&>div]:bg-green-500"
              />
              <p className="text-right text-sm text-muted-foreground mt-1">
                {Math.round(avatar.health)}%
              </p>
            </CardContent>
          </Card>

          {/* Happiness Bar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Smile className="h-4 w-4 text-blue-500" />
                Happiness
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={avatar.happiness}
                className="h-3 [&>div]:bg-blue-500"
              />
              <p className="text-right text-sm text-muted-foreground mt-1">
                {Math.round(avatar.happiness)}%
              </p>
            </CardContent>
          </Card>

          {/* XP Progress Ring */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                XP to Next Level
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ProgressRing
                progress={xpProgress}
                size={80}
                strokeWidth={6}
                variant="progress"
              >
                <span className="text-sm font-semibold">{avatar.xp} XP</span>
                {avatar.nextLevel && (
                  <span className="text-[10px] text-muted-foreground">
                    /{avatar.nextLevel.xpRequired}
                  </span>
                )}
              </ProgressRing>
            </CardContent>
          </Card>
        </div>

        {/* Feed Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Feed Your Companion</CardTitle>
            <p className="text-sm text-muted-foreground">
              Complete activities to keep your companion healthy and happy
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {FEED_ACTIONS.map((action) => {
                const Icon = action.icon;
                const isFeeding = feedingAction === action.activityType;
                return (
                  <Button
                    key={action.activityType}
                    variant="outline"
                    className={`h-auto py-4 flex flex-col items-center gap-2 ${action.bg}`}
                    disabled={isFeeding}
                    onClick={() => handleFeed(action.activityType)}
                  >
                    {isFeeding ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Icon className={`h-6 w-6 ${action.color}`} />
                    )}
                    <span className="text-sm font-medium">{action.label}</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Last Fed */}
        {avatar.lastFedAt && (
          <p className="text-center text-sm text-muted-foreground">
            Last fed: {new Date(avatar.lastFedAt).toLocaleString()}
          </p>
        )}
      </div>
    </AppLayout>
  );
}
