import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, Moon, Activity, Droplets,
  Heart, Brain, Utensils, Footprints, Sparkles, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthInsight {
  id: string;
  category: "sleep" | "pain" | "mood" | "activity" | "nutrition" | "vitals";
  title: string;
  message: string;
  trend: "improving" | "declining" | "stable";
  value?: string;
  change?: string;
  tip?: string;
}

interface HealthInsightsCardsProps {
  checkIns?: Array<{
    painLevel?: number;
    sleepHours?: number;
    mood?: number;
    mobility?: number;
    createdAt?: string;
  }>;
  className?: string;
}

const CATEGORY_CONFIG = {
  sleep: { icon: Moon, gradient: "from-indigo-500/10 to-violet-500/10", border: "border-indigo-500/20", iconColor: "text-indigo-500", darkGradient: "dark:from-indigo-500/20 dark:to-violet-500/20" },
  pain: { icon: Activity, gradient: "from-rose-500/10 to-orange-500/10", border: "border-rose-500/20", iconColor: "text-rose-500", darkGradient: "dark:from-rose-500/20 dark:to-orange-500/20" },
  mood: { icon: Brain, gradient: "from-amber-500/10 to-yellow-500/10", border: "border-amber-500/20", iconColor: "text-amber-500", darkGradient: "dark:from-amber-500/20 dark:to-yellow-500/20" },
  activity: { icon: Footprints, gradient: "from-emerald-500/10 to-teal-500/10", border: "border-emerald-500/20", iconColor: "text-emerald-500", darkGradient: "dark:from-emerald-500/20 dark:to-teal-500/20" },
  nutrition: { icon: Utensils, gradient: "from-orange-500/10 to-amber-500/10", border: "border-orange-500/20", iconColor: "text-orange-500", darkGradient: "dark:from-orange-500/20 dark:to-amber-500/20" },
  vitals: { icon: Heart, gradient: "from-red-500/10 to-pink-500/10", border: "border-red-500/20", iconColor: "text-red-500", darkGradient: "dark:from-red-500/20 dark:to-pink-500/20" },
};

const TREND_CONFIG = {
  improving: { icon: TrendingUp, color: "text-emerald-500", label: "Improving", bg: "bg-emerald-500/10" },
  declining: { icon: TrendingDown, color: "text-rose-500", label: "Declining", bg: "bg-rose-500/10" },
  stable: { icon: Minus, color: "text-blue-500", label: "Stable", bg: "bg-blue-500/10" },
};

function generateInsights(checkIns: HealthInsightsCardsProps["checkIns"]): HealthInsight[] {
  if (!checkIns || checkIns.length < 2) {
    return [
      {
        id: "welcome",
        category: "vitals",
        title: "Start Your Journey",
        message: "Complete daily check-ins to unlock personalized health insights powered by your data.",
        trend: "stable",
        tip: "Your first check-in is the hardest step. The rest gets easier.",
      },
    ];
  }

  const insights: HealthInsight[] = [];
  const recent = checkIns.slice(0, 7);
  const older = checkIns.slice(7, 14);

  // Sleep insight
  const avgSleep = recent.reduce((sum, c) => sum + (c.sleepHours || 0), 0) / recent.length;
  const prevAvgSleep = older.length > 0
    ? older.reduce((sum, c) => sum + (c.sleepHours || 0), 0) / older.length
    : avgSleep;
  const sleepDiff = avgSleep - prevAvgSleep;

  insights.push({
    id: "sleep",
    category: "sleep",
    title: "Sleep Quality",
    message: avgSleep >= 7
      ? "Great sleep pattern! You're averaging the recommended hours."
      : avgSleep >= 5
        ? "Your sleep could be better. Aim for 7-8 hours for optimal recovery."
        : "Your sleep is significantly below recommended levels. This affects healing.",
    trend: sleepDiff > 0.3 ? "improving" : sleepDiff < -0.3 ? "declining" : "stable",
    value: `${avgSleep.toFixed(1)}h`,
    change: `${sleepDiff >= 0 ? "+" : ""}${sleepDiff.toFixed(1)}h vs last week`,
    tip: avgSleep < 7
      ? "Try winding down 30 min before bed with no screens."
      : "Keep this rhythm going, it accelerates recovery.",
  });

  // Pain insight
  const avgPain = recent.reduce((sum, c) => sum + (c.painLevel || 0), 0) / recent.length;
  const prevAvgPain = older.length > 0
    ? older.reduce((sum, c) => sum + (c.painLevel || 0), 0) / older.length
    : avgPain;
  const painDiff = avgPain - prevAvgPain;

  insights.push({
    id: "pain",
    category: "pain",
    title: "Pain Levels",
    message: avgPain <= 3
      ? "Your pain levels are well-managed. Treatment is working."
      : avgPain <= 6
        ? "Moderate pain detected. Consistency with exercises helps reduce it."
        : "Elevated pain levels recorded. Consider discussing with your doctor.",
    trend: painDiff < -0.3 ? "improving" : painDiff > 0.3 ? "declining" : "stable",
    value: `${avgPain.toFixed(1)}/10`,
    change: `${painDiff >= 0 ? "+" : ""}${painDiff.toFixed(1)} vs last week`,
    tip: avgPain > 5
      ? "Gentle stretching between sessions can help manage spikes."
      : "Low pain means your body is responding well to treatment.",
  });

  // Mood insight
  const avgMood = recent.reduce((sum, c) => sum + (c.mood || 3), 0) / recent.length;
  const prevAvgMood = older.length > 0
    ? older.reduce((sum, c) => sum + (c.mood || 3), 0) / older.length
    : avgMood;
  const moodDiff = avgMood - prevAvgMood;

  insights.push({
    id: "mood",
    category: "mood",
    title: "Emotional Wellbeing",
    message: avgMood >= 4
      ? "Your mood has been positive! Mental wellness supports physical healing."
      : avgMood >= 3
        ? "Mood is neutral. Small activities you enjoy can boost your outlook."
        : "We notice you've been feeling low. Remember, it's okay to seek support.",
    trend: moodDiff > 0.2 ? "improving" : moodDiff < -0.2 ? "declining" : "stable",
    value: ["", "Very Low", "Low", "Neutral", "Good", "Great"][Math.round(avgMood)] || "Neutral",
    tip: avgMood < 3
      ? "Try our guided breathing exercise. It helps more than you'd think."
      : "Positive mindset can speed recovery by up to 30%.",
  });

  return insights;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.15,
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

export function HealthInsightsCards({ checkIns, className }: HealthInsightsCardsProps) {
  const insights = generateInsights(checkIns);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Personalized Insights</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight, i) => {
          const config = CATEGORY_CONFIG[insight.category];
          const trendConfig = TREND_CONFIG[insight.trend];
          const Icon = config.icon;
          const TrendIcon = trendConfig.icon;

          return (
            <motion.div
              key={insight.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={cn(
                "group relative rounded-2xl border p-5 overflow-hidden cursor-default",
                "bg-gradient-to-br",
                config.gradient,
                config.darkGradient,
                config.border,
                "transition-shadow hover:shadow-lg"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={cn("p-2 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm")}>
                    <Icon className={cn("w-4 h-4", config.iconColor)} />
                  </div>
                  <span className="text-sm font-bold text-foreground">{insight.title}</span>
                </div>
                <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", trendConfig.bg, trendConfig.color)}>
                  <TrendIcon className="w-3 h-3" />
                  {trendConfig.label}
                </div>
              </div>

              {/* Value */}
              {insight.value && (
                <div className="mb-2">
                  <span className="text-2xl font-black text-foreground">{insight.value}</span>
                  {insight.change && (
                    <span className="text-[11px] text-muted-foreground ml-2">{insight.change}</span>
                  )}
                </div>
              )}

              {/* Message */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {insight.message}
              </p>

              {/* Tip */}
              {insight.tip && (
                <motion.div
                  className="flex items-start gap-2 p-2.5 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.15 }}
                >
                  <ArrowRight className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-[11px] text-foreground/80 leading-relaxed">{insight.tip}</span>
                </motion.div>
              )}

              {/* Decorative shimmer on hover */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent rotate-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
