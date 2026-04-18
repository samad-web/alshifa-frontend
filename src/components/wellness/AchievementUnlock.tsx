import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Trophy, Star, Flame, Zap, Award, Heart, Shield, Target } from "lucide-react";
import { cn } from "@/lib/utils";

type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon?: string;
  tier: AchievementTier;
  pointsAwarded?: number;
}

interface AchievementUnlockProps {
  achievement: Achievement | null;
  onDismiss: () => void;
  autoDismissMs?: number;
}

const TIER_CONFIG: Record<AchievementTier, {
  label: string;
  gradient: string;
  border: string;
  glow: string;
  confettiColors: string[];
  icon: typeof Trophy;
}> = {
  bronze: {
    label: "Bronze",
    gradient: "from-amber-700/20 via-orange-600/10 to-yellow-700/20",
    border: "border-amber-600/40",
    glow: "shadow-amber-500/20",
    confettiColors: ["#b45309", "#d97706", "#f59e0b"],
    icon: Award,
  },
  silver: {
    label: "Silver",
    gradient: "from-slate-400/20 via-gray-300/10 to-slate-500/20",
    border: "border-slate-400/40",
    glow: "shadow-slate-400/20",
    confettiColors: ["#94a3b8", "#cbd5e1", "#e2e8f0"],
    icon: Shield,
  },
  gold: {
    label: "Gold",
    gradient: "from-yellow-500/20 via-amber-400/10 to-yellow-600/20",
    border: "border-yellow-500/40",
    glow: "shadow-yellow-500/30",
    confettiColors: ["#eab308", "#facc15", "#fde047"],
    icon: Star,
  },
  platinum: {
    label: "Platinum",
    gradient: "from-violet-500/20 via-purple-400/10 to-indigo-500/20",
    border: "border-violet-500/40",
    glow: "shadow-violet-500/30",
    confettiColors: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#7c3aed"],
    icon: Trophy,
  },
};

const BADGE_ICONS: Record<string, typeof Trophy> = {
  trophy: Trophy,
  star: Star,
  flame: Flame,
  zap: Zap,
  award: Award,
  heart: Heart,
  shield: Shield,
  target: Target,
};

export function AchievementUnlock({ achievement, onDismiss, autoDismissMs = 6000 }: AchievementUnlockProps) {
  const confettiFired = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fireConfetti = useCallback((colors: string[]) => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    const count = 100;
    const defaults = {
      origin: { y: 0.6 },
      zIndex: 9999,
      colors,
      disableForReducedMotion: true,
    };

    confetti({ ...defaults, particleCount: Math.floor(count * 0.25), spread: 26, startVelocity: 55 });
    confetti({ ...defaults, particleCount: Math.floor(count * 0.2), spread: 60 });
    confetti({ ...defaults, particleCount: Math.floor(count * 0.35), spread: 100, decay: 0.91, scalar: 0.8 });
    confetti({ ...defaults, particleCount: Math.floor(count * 0.1), spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    confetti({ ...defaults, particleCount: Math.floor(count * 0.1), spread: 120, startVelocity: 45 });
  }, []);

  useEffect(() => {
    if (!achievement) {
      confettiFired.current = false;
      return;
    }

    const tier = TIER_CONFIG[achievement.tier];
    fireConfetti(tier.confettiColors);

    timerRef.current = setTimeout(onDismiss, autoDismissMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [achievement, fireConfetti, onDismiss, autoDismissMs]);

  if (!achievement) return null;

  const tier = TIER_CONFIG[achievement.tier];
  const BadgeIcon = (achievement.icon && BADGE_ICONS[achievement.icon]) || tier.icon;

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />

          {/* Achievement card */}
          <motion.div
            className={cn(
              "relative pointer-events-auto mx-4 max-w-sm w-full rounded-3xl border-2 overflow-hidden",
              "bg-gradient-to-br", tier.gradient, tier.border,
              "shadow-2xl", tier.glow,
              "bg-card"
            )}
            initial={{ scale: 0, rotate: -10, opacity: 0 }}
            animate={{
              scale: 1,
              rotate: 0,
              opacity: 1,
              transition: { type: "spring", damping: 15, stiffness: 200, delay: 0.1 },
            }}
            exit={{
              scale: 0.8,
              opacity: 0,
              y: 40,
              transition: { duration: 0.3 },
            }}
            onClick={onDismiss}
          >
            {/* Shimmer line */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ x: "-100%" }}
              animate={{ x: "200%" }}
              transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
            >
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
            </motion.div>

            <div className="relative p-8 text-center space-y-4">
              {/* Badge icon with pulse */}
              <motion.div
                className="mx-auto w-20 h-20 rounded-full flex items-center justify-center bg-background/60 border border-border/50 backdrop-blur-sm"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.6, delay: 0.3, times: [0, 0.6, 1] }}
              >
                <motion.div
                  animate={{
                    rotate: [0, -10, 10, -5, 5, 0],
                  }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                >
                  <BadgeIcon className={cn("w-10 h-10", {
                    "text-amber-600": achievement.tier === "bronze",
                    "text-slate-400": achievement.tier === "silver",
                    "text-yellow-500": achievement.tier === "gold",
                    "text-violet-500": achievement.tier === "platinum",
                  })} />
                </motion.div>
              </motion.div>

              {/* Tier label */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <span className={cn(
                  "inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  {
                    "bg-amber-500/10 text-amber-600": achievement.tier === "bronze",
                    "bg-slate-500/10 text-slate-400": achievement.tier === "silver",
                    "bg-yellow-500/10 text-yellow-600": achievement.tier === "gold",
                    "bg-violet-500/10 text-violet-500": achievement.tier === "platinum",
                  }
                )}>
                  {tier.label} Achievement
                </span>
              </motion.div>

              {/* Title */}
              <motion.h2
                className="text-xl font-black text-foreground"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                {achievement.title}
              </motion.h2>

              {/* Description */}
              <motion.p
                className="text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              >
                {achievement.description}
              </motion.p>

              {/* Points */}
              {achievement.pointsAwarded && achievement.pointsAwarded > 0 && (
                <motion.div
                  className="flex items-center justify-center gap-2 pt-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.9, type: "spring" }}
                >
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="text-lg font-black text-primary">+{achievement.pointsAwarded}</span>
                  <span className="text-xs text-muted-foreground font-bold">Zen Points</span>
                </motion.div>
              )}

              {/* Dismiss hint */}
              <motion.p
                className="text-[10px] text-muted-foreground/60 pt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                Tap to dismiss
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook to manage achievement queue
export function useAchievementQueue() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [current, setCurrent] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [current, queue]);

  const enqueue = useCallback((achievement: Achievement) => {
    setQueue((q) => [...q, achievement]);
  }, []);

  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  return { current, enqueue, dismiss };
}
