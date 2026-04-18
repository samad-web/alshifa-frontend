import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, RotateCcw, Wind, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BreathingPattern = {
  name: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdAfter: number;
  cycles: number;
  color: string;
  gradient: string;
};

const PATTERNS: BreathingPattern[] = [
  {
    name: "Box Breathing",
    description: "Equal phases for calm focus. Used by Navy SEALs.",
    inhale: 4, hold: 4, exhale: 4, holdAfter: 4, cycles: 6,
    color: "text-blue-500", gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    name: "4-7-8 Relaxation",
    description: "Deep relaxation for anxiety and sleep.",
    inhale: 4, hold: 7, exhale: 8, holdAfter: 0, cycles: 4,
    color: "text-violet-500", gradient: "from-violet-500/20 to-purple-500/20",
  },
  {
    name: "Energizing Breath",
    description: "Quick recharge for mid-day fatigue.",
    inhale: 3, hold: 0, exhale: 3, holdAfter: 0, cycles: 8,
    color: "text-amber-500", gradient: "from-amber-500/20 to-orange-500/20",
  },
  {
    name: "Pain Relief",
    description: "Slow deep breathing to manage discomfort.",
    inhale: 5, hold: 2, exhale: 7, holdAfter: 0, cycles: 5,
    color: "text-emerald-500", gradient: "from-emerald-500/20 to-teal-500/20",
  },
];

type Phase = "inhale" | "hold" | "exhale" | "holdAfter" | "complete";

const PHASE_LABELS: Record<Phase, string> = {
  inhale: "Breathe In",
  hold: "Hold",
  exhale: "Breathe Out",
  holdAfter: "Hold",
  complete: "Complete",
};

const PHASE_ICONS: Record<Phase, string> = {
  inhale: "Expand your lungs fully",
  hold: "Keep the air inside",
  exhale: "Release slowly and completely",
  holdAfter: "Stay empty and calm",
  complete: "You did amazing",
};

interface BreathingExerciseProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (pattern: string, duration: number) => void;
}

export function BreathingExercise({ isOpen, onClose, onComplete }: BreathingExerciseProps) {
  const [selectedPattern, setSelectedPattern] = useState<BreathingPattern | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<Phase>("inhale");
  const [phaseTime, setPhaseTime] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef(0);

  const getPhaseSeconds = useCallback((phase: Phase): number => {
    if (!selectedPattern) return 0;
    switch (phase) {
      case "inhale": return selectedPattern.inhale;
      case "hold": return selectedPattern.hold;
      case "exhale": return selectedPattern.exhale;
      case "holdAfter": return selectedPattern.holdAfter;
      default: return 0;
    }
  }, [selectedPattern]);

  const getNextPhase = useCallback((current: Phase): Phase => {
    if (!selectedPattern) return "complete";
    switch (current) {
      case "inhale": return selectedPattern.hold > 0 ? "hold" : "exhale";
      case "hold": return "exhale";
      case "exhale": return selectedPattern.holdAfter > 0 ? "holdAfter" : "inhale";
      case "holdAfter": return "inhale";
      default: return "complete";
    }
  }, [selectedPattern]);

  useEffect(() => {
    if (!isActive || !selectedPattern) return;

    intervalRef.current = setInterval(() => {
      setPhaseTime((prev) => {
        const phaseDuration = getPhaseSeconds(currentPhase);
        if (prev + 1 >= phaseDuration) {
          const nextPhase = getNextPhase(currentPhase);
          if (nextPhase === "inhale") {
            setCurrentCycle((c) => {
              if (c >= selectedPattern.cycles) {
                setIsActive(false);
                setCurrentPhase("complete");
                const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
                onComplete?.(selectedPattern.name, duration);
                return c;
              }
              return c + 1;
            });
          }
          setCurrentPhase(nextPhase === "inhale" ? "inhale" : nextPhase);
          return 0;
        }
        return prev + 1;
      });
      setTotalElapsed((t) => t + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, currentPhase, selectedPattern, getPhaseSeconds, getNextPhase, onComplete]);

  const handleStart = (pattern: BreathingPattern) => {
    setSelectedPattern(pattern);
    setIsActive(true);
    setCurrentPhase("inhale");
    setPhaseTime(0);
    setCurrentCycle(1);
    setTotalElapsed(0);
    startTimeRef.current = Date.now();
  };

  const handleReset = () => {
    setIsActive(false);
    setCurrentPhase("inhale");
    setPhaseTime(0);
    setCurrentCycle(1);
    setTotalElapsed(0);
  };

  const handlePause = () => setIsActive((a) => !a);

  const handleCloseAll = () => {
    handleReset();
    setSelectedPattern(null);
    onClose();
  };

  // Circle animation scale based on phase
  const getCircleScale = () => {
    if (!isActive && currentPhase !== "complete") return 1;
    const phaseDuration = getPhaseSeconds(currentPhase);
    const progress = phaseDuration > 0 ? phaseTime / phaseDuration : 0;
    switch (currentPhase) {
      case "inhale": return 1 + progress * 0.5;
      case "hold": return 1.5;
      case "exhale": return 1.5 - progress * 0.5;
      case "holdAfter": return 1;
      case "complete": return 1.2;
      default: return 1;
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && handleCloseAll()}
        >
          <motion.div
            className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-3xl bg-background border border-border shadow-2xl"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold">Breathing Exercise</h2>
              </div>
              <button onClick={handleCloseAll} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pb-6">
              {!selectedPattern ? (
                // Pattern selection
                <motion.div className="space-y-3" layout>
                  <p className="text-sm text-muted-foreground mb-4">
                    Choose a breathing pattern that suits your current need.
                  </p>
                  {PATTERNS.map((pattern, i) => (
                    <motion.button
                      key={pattern.name}
                      className={cn(
                        "w-full text-left p-4 rounded-2xl border transition-all",
                        "bg-gradient-to-r", pattern.gradient,
                        "hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                      )}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => handleStart(pattern)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className={cn("font-bold text-sm", pattern.color)}>{pattern.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{pattern.description}</p>
                          <div className="flex gap-2 mt-2">
                            {[
                              { label: "In", value: pattern.inhale },
                              ...(pattern.hold > 0 ? [{ label: "Hold", value: pattern.hold }] : []),
                              { label: "Out", value: pattern.exhale },
                              ...(pattern.holdAfter > 0 ? [{ label: "Hold", value: pattern.holdAfter }] : []),
                            ].map((p, j) => (
                              <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 text-foreground font-bold">
                                {p.label} {p.value}s
                              </span>
                            ))}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/60 text-foreground font-bold">
                              {pattern.cycles}x
                            </span>
                          </div>
                        </div>
                        <Play className={cn("w-5 h-5 flex-shrink-0", pattern.color)} />
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                // Active exercise
                <div className="flex flex-col items-center space-y-6">
                  {/* Pattern name */}
                  <div className="text-center">
                    <h3 className={cn("font-bold", selectedPattern.color)}>{selectedPattern.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Cycle {currentCycle} of {selectedPattern.cycles}
                    </p>
                  </div>

                  {/* Breathing circle */}
                  <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
                    {/* Outer pulse */}
                    <motion.div
                      className="absolute rounded-full bg-primary/5 dark:bg-primary/10"
                      animate={{
                        scale: getCircleScale() * 1.1,
                        opacity: [0.3, 0.6, 0.3],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ width: 200, height: 200 }}
                    />

                    {/* Main circle */}
                    <motion.div
                      className={cn(
                        "rounded-full flex items-center justify-center",
                        "bg-gradient-to-br",
                        selectedPattern.gradient,
                        "border-2 border-primary/20"
                      )}
                      animate={{ scale: getCircleScale() }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                      style={{ width: 160, height: 160 }}
                    >
                      <div className="text-center">
                        {currentPhase === "complete" ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring" }}
                          >
                            <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
                            <span className="text-lg font-black text-foreground">Done!</span>
                          </motion.div>
                        ) : (
                          <>
                            <motion.span
                              key={currentPhase}
                              className="block text-lg font-black text-foreground"
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              {PHASE_LABELS[currentPhase]}
                            </motion.span>
                            <span className="text-3xl font-black text-primary tabular-nums">
                              {getPhaseSeconds(currentPhase) - phaseTime}
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>

                    {/* Progress dots */}
                    {Array.from({ length: selectedPattern.cycles }).map((_, i) => {
                      const angle = ((i / selectedPattern.cycles) * 360 - 90) * (Math.PI / 180);
                      const dotRadius = 110;
                      return (
                        <motion.div
                          key={i}
                          className={cn(
                            "absolute w-2.5 h-2.5 rounded-full transition-colors",
                            i < currentCycle - 1
                              ? "bg-primary"
                              : i === currentCycle - 1
                                ? "bg-primary/60 ring-2 ring-primary/30"
                                : "bg-muted"
                          )}
                          style={{
                            left: 120 + Math.cos(angle) * dotRadius - 5,
                            top: 120 + Math.sin(angle) * dotRadius - 5,
                          }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                        />
                      );
                    })}
                  </div>

                  {/* Guidance text */}
                  <motion.p
                    key={currentPhase}
                    className="text-sm text-muted-foreground text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {PHASE_ICONS[currentPhase]}
                  </motion.p>

                  {/* Timer and controls */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Timer className="w-3 h-3" />
                    {formatTime(totalElapsed)}
                  </div>

                  <div className="flex gap-3">
                    {currentPhase !== "complete" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePause}
                          className="rounded-xl"
                        >
                          {isActive ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                          {isActive ? "Pause" : "Resume"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleReset}
                          className="rounded-xl"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reset
                        </Button>
                      </>
                    )}
                    {currentPhase === "complete" && (
                      <>
                        <Button
                          onClick={() => handleStart(selectedPattern)}
                          size="sm"
                          className="rounded-xl"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Repeat
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleReset();
                            setSelectedPattern(null);
                          }}
                          className="rounded-xl"
                        >
                          Try Another
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
