import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Activity, TrendingUp, Flame, Award, ChevronRight, Wind } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { VitalChart } from '@/components/vitals/VitalChart';
import { ZenPointsPanel } from '@/components/gamification/ZenPointsPanel';
import { AnimatedWellnessRing } from '@/components/wellness/AnimatedWellnessRing';
import { BreathingExercise } from '@/components/wellness/BreathingExercise';
import { AchievementUnlock, useAchievementQueue } from '@/components/wellness/AchievementUnlock';
import { PageTransition, StaggerItem, FadeInView } from '@/components/ui/page-transition';
import { WellnessSkeleton } from '@/components/ui/page-skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { motion } from 'framer-motion';

const MOOD_EMOJIS = [
  { value: 1, icon: '😫', label: 'Terrible' },
  { value: 2, icon: '😔', label: 'Bad' },
  { value: 3, icon: '😐', label: 'Okay' },
  { value: 4, icon: '🙂', label: 'Good' },
  { value: 5, icon: '😄', label: 'Great' },
];

interface WellnessScoreData {
  wellnessScore: number;
  breakdown: {
    taskAdherence: number;
    vitalTrend: number;
    milestoneProgress: number;
    appointmentAttendance: number;
  };
}

export default function WellnessDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState<any[]>([]);
  const [scoreData, setScoreData] = useState<WellnessScoreData | null>(null);
  const [activeJourney, setActiveJourney] = useState<any>(null);
  const [painScore, setPainScore] = useState(3);
  const [mood, setMood] = useState(3);
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(true);
  const [zenPoints, setZenPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showBreathing, setShowBreathing] = useState(false);
  const { current: currentAchievement, enqueue: enqueueAchievement, dismiss: dismissAchievement } = useAchievementQueue();

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user?.id]);

  async function loadData() {
    try {
      const [journeysRaw, wellnessRaw] = await Promise.all([
        apiClient.get(`/api/journeys/patient/${user!.id}`).catch(() => []),
        apiClient.get('/api/wellness/stats').catch(() => ({})),
      ]);

      // Handle both { data: [...] } and plain array responses
      const journeysRes = Array.isArray(journeysRaw) ? journeysRaw : (journeysRaw?.data || []);
      const wellnessRes = wellnessRaw?.data || wellnessRaw || {};

      setJourneys(journeysRes);
      setZenPoints(wellnessRes?.zenPoints || 0);
      setStreak(wellnessRes?.streak || 0);

      const active = journeysRes.find((j: any) => j.status === 'ACTIVE');
      if (active) {
        setActiveJourney(active);
        try {
          const score = await apiClient.get(`/api/journeys/${active.id}/wellness-score`);
          setScoreData(score);
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVitalSubmit() {
    if (!activeJourney) return;
    try {
      await Promise.all([
        apiClient.post(`/api/journeys/${activeJourney.id}/vitals`, { type: 'PAIN_SCORE', value: painScore, unit: 'NRS' }),
        apiClient.post(`/api/journeys/${activeJourney.id}/vitals`, { type: 'MOOD', value: mood, unit: 'scale' }),
        ...(weight ? [apiClient.post(`/api/journeys/${activeJourney.id}/vitals`, { type: 'WEIGHT', value: parseFloat(weight), unit: 'kg' })] : []),
      ]);
      loadData();
      enqueueAchievement({
        id: `vital-${Date.now()}`,
        title: "Vitals Logged",
        description: "Keeping track of your vitals helps your care team optimize your treatment.",
        tier: "bronze",
        pointsAwarded: 10,
      });
    } catch {}
  }

  async function handleTaskComplete(taskId: string) {
    if (!activeJourney) return;
    try {
      await apiClient.post(`/api/journeys/${activeJourney.id}/tasks/${taskId}/complete`, {});
      loadData();
      enqueueAchievement({
        id: `task-${taskId}`,
        title: "Task Completed",
        description: "Every completed task brings you closer to full recovery.",
        tier: "bronze",
        pointsAwarded: 15,
      });
    } catch {}
  }

  const handleBreathingComplete = useCallback(
    (pattern: string, duration: number) => {
      enqueueAchievement({
        id: `breathing-${Date.now()}`,
        title: "Mindful Moment",
        description: `Completed ${pattern}. Your mind and body are in sync.`,
        tier: duration >= 180 ? "silver" : "bronze",
        pointsAwarded: duration >= 180 ? 30 : 15,
      });
    },
    [enqueueAchievement]
  );

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <WellnessSkeleton />
      </div>
    );
  }

  const activePhase = activeJourney?.phases?.find((p: any) => p.status === 'ACTIVE');
  const todayTasks = activePhase?.tasks?.slice(0, 3) || [];
  const milestones = activeJourney?.milestones || [];
  const wellnessScore = scoreData?.wellnessScore || activeJourney?.wellnessScore || 0;

  return (
    <PageTransition className="max-w-4xl mx-auto p-4 space-y-6">
      <StaggerItem>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Wellness Dashboard</h1>
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={() => setShowBreathing(true)}
          >
            <Wind className="w-4 h-4" />
            Breathe
          </Button>
        </div>
      </StaggerItem>

      {/* Section A: Animated Wellness Score Ring */}
      <StaggerItem>
        <Card className="overflow-hidden dark:glow-wellness">
          <CardContent className="pt-8 pb-10 flex flex-col items-center">
            <AnimatedWellnessRing
              score={wellnessScore}
              size={220}
              strokeWidth={14}
              breakdown={scoreData?.breakdown}
              onMilestone={() => {
                if (wellnessScore >= 75) {
                  enqueueAchievement({
                    id: `wellness-high-${Date.now()}`,
                    title: "Wellness Champion",
                    description: "Your wellness score has reached an excellent level!",
                    tier: "gold",
                    pointsAwarded: 100,
                  });
                }
              }}
            />
            {scoreData && (
              <motion.div
                className="mt-4 flex items-center gap-1 text-sm text-green-600 dark:text-green-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                <TrendingUp className="h-4 w-4" /> Tracking your progress
              </motion.div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Section B: Active Journey Card */}
      {activeJourney ? (
        <FadeInView delay={0.1}>
          <Card className="interactive-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{activeJourney.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{activeJourney.condition}</p>
                </div>
                <Badge variant="default">{activePhase?.name || 'Active'}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activePhase && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Phase: {activePhase.name}</span>
                    <span>{activePhase.durationDays} days</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: activePhase.startedAt
                          ? `${Math.min(100, (Math.floor((Date.now() - new Date(activePhase.startedAt).getTime()) / (1000 * 60 * 60 * 24)) / activePhase.durationDays) * 100)}%`
                          : '0%'
                      }}
                      transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}

              {todayTasks.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Today's Tasks</h4>
                  {todayTasks.map((task: any, i: number) => {
                    const completed = task.completions?.length > 0;
                    return (
                      <motion.div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded-lg border interactive-card"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Checkbox
                          checked={completed}
                          onCheckedChange={() => !completed && handleTaskComplete(task.id)}
                        />
                        <div className="flex-1">
                          <span className={`text-sm ${completed ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">{task.frequency}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{task.type}</Badge>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <Button variant="outline" size="sm" onClick={() => navigate(`/journey/${activeJourney.id}`)}>
                View Full Journey <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </FadeInView>
      ) : (
        <FadeInView delay={0.1}>
          <EmptyState
            variant="wellness"
            title="No Active Journey"
            description="Your treatment journey hasn't started yet. Your care team will set one up after your next consultation."
          />
        </FadeInView>
      )}

      {/* Section C: Today's Vitals */}
      <FadeInView delay={0.2}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" /> Quick Vital Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pain Level: {painScore}/10</label>
              <Slider value={[painScore]} min={0} max={10} step={1} onValueChange={([v]) => setPainScore(v)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mood</label>
              <div className="flex gap-2">
                {MOOD_EMOJIS.map(m => (
                  <motion.button
                    key={m.value}
                    onClick={() => setMood(m.value)}
                    className={`text-2xl p-2 rounded-lg transition-all ${mood === m.value ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-muted'}`}
                    aria-label={m.label}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {m.icon}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Weight (optional, kg)</label>
              <input
                type="number"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-ring"
                placeholder="e.g. 68.5"
              />
            </div>

            <Button onClick={handleVitalSubmit} disabled={!activeJourney} className="w-full rounded-xl">
              Log Vitals
            </Button>

            {activeJourney && (
              <div className="h-24">
                <VitalChart journeyId={activeJourney.id} type="PAIN_SCORE" days={7} compact />
              </div>
            )}
          </CardContent>
        </Card>
      </FadeInView>

      {/* Section D: Milestones */}
      {milestones.length > 0 && (
        <FadeInView delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="h-5 w-5" /> Milestones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-4">
                  {milestones.map((m: any, i: number) => (
                    <motion.div
                      key={m.id}
                      className={`flex-shrink-0 w-36 p-3 rounded-lg border text-center interactive-card ${m.isAchieved ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30' : 'bg-muted/50'}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <div className={`text-2xl mb-1 ${m.isAchieved ? '' : 'opacity-30'}`}>
                        {m.badgeIcon || (m.isAchieved ? '🏆' : '🔒')}
                      </div>
                      <div className="text-xs font-medium truncate">{m.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {m.isAchieved
                          ? `Achieved ${new Date(m.achievedAt).toLocaleDateString()}`
                          : m.targetDate
                            ? `Target: ${new Date(m.targetDate).toLocaleDateString()}`
                            : 'Upcoming'
                        }
                      </div>
                    </motion.div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </FadeInView>
      )}

      {/* Section E: Zen Points */}
      <FadeInView delay={0.4}>
        <ZenPointsPanel />
      </FadeInView>

      {/* Modals */}
      <BreathingExercise
        isOpen={showBreathing}
        onClose={() => setShowBreathing(false)}
        onComplete={handleBreathingComplete}
      />
      <AchievementUnlock achievement={currentAchievement} onDismiss={dismissAchievement} />
    </PageTransition>
  );
}
