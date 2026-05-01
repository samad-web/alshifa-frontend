import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, RotateCcw, Wind, Sparkles, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// All patterns share the brand-primary colour family (--primary is already
// teal in the design tokens), so we use Tailwind primary classes throughout.
// The four patterns are differentiated by left-accent opacity, not hue —
// keeps the modal cohesive instead of a four-way colour buffet.

type BreathingPattern = {
  name: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdAfter: number;
  cycles: number;
};

const PATTERNS: BreathingPattern[] = [
  {
    name: "Box Breathing",
    description: "Equal phases for calm focus. Used by Navy SEALs.",
    inhale: 4, hold: 4, exhale: 4, holdAfter: 4, cycles: 6,
  },
  {
    name: "4-7-8 Relaxation",
    description: "Deep relaxation for anxiety and sleep.",
    inhale: 4, hold: 7, exhale: 8, holdAfter: 0, cycles: 4,
  },
  {
    name: "Energizing Breath",
    description: "Quick recharge for mid-day fatigue.",
    inhale: 3, hold: 0, exhale: 3, holdAfter: 0, cycles: 8,
  },
  {
    name: "Pain Relief",
    description: "Slow deep breathing to manage discomfort.",
    inhale: 5, hold: 2, exhale: 7, holdAfter: 0, cycles: 5,
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
                // ── Pattern selection — uses the same Card-on-card visual
                // pattern the rest of the patient dashboard uses (bg-card +
                // border-border/50 + hover:bg-accent/50) so it doesn't look
                // like a one-off component glued in.
                <motion.div className="space-y-2" layout>
                  <p className="text-xs uppercase tracking-tight font-bold text-muted-foreground mb-3">
                    Choose your pattern
                  </p>
                  {PATTERNS.map((pattern, i) => (
                    <motion.button
                      key={pattern.name}
                      type="button"
                      className={cn(
                        "group w-full text-left p-4 rounded-2xl relative overflow-hidden",
                        "border border-border/60 bg-card",
                        "hover:bg-accent/40 hover:border-primary/40",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        "transition-colors active:scale-[0.99]",
                      )}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleStart(pattern)}
                    >
                      {/* Left accent bar — primary teal, full width on hover. */}
                      <span
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-1 bg-primary transition-all",
                          "group-hover:w-1.5",
                        )}
                      />
                      <div className="flex items-center justify-between gap-3 pl-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm leading-tight text-foreground group-hover:text-primary transition-colors">
                            {pattern.name}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {pattern.description}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {[
                              { label: "In", value: pattern.inhale },
                              ...(pattern.hold > 0 ? [{ label: "Hold", value: pattern.hold }] : []),
                              { label: "Out", value: pattern.exhale },
                              ...(pattern.holdAfter > 0 ? [{ label: "Hold", value: pattern.holdAfter }] : []),
                            ].map((p, j) => (
                              <span
                                key={j}
                                className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                              >
                                {p.label} {p.value}s
                              </span>
                            ))}
                            <span className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              ×{pattern.cycles}
                            </span>
                          </div>
                        </div>
                        <Play className="w-5 h-5 flex-shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                // ── Active exercise — single orb, tight type, primary palette ───
                <div className="flex flex-col items-center space-y-5">
                  {/* Pattern name + cycle indicator */}
                  <div className="text-center">
                    <h3 className="text-sm font-bold uppercase tracking-tight text-primary">
                      {selectedPattern.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      Cycle {currentCycle} / {selectedPattern.cycles}
                    </p>
                  </div>

                  {/* Single breathing orb — soft glow + scaling sphere. */}
                  <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
                    {/* Soft outer glow that breathes with the orb. */}
                    <motion.div
                      className="absolute rounded-full bg-primary/20"
                      style={{ width: 220, height: 220, filter: "blur(20px)" }}
                      animate={{ scale: getCircleScale() * 1.08, opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* The orb itself — single sphere using the primary token
                        with a highlight gradient for depth. */}
                    <motion.div
                      className="rounded-full flex items-center justify-center shadow-xl bg-primary"
                      style={{
                        width: 180, height: 180,
                        backgroundImage: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.45), transparent 60%)",
                      }}
                      animate={{ scale: getCircleScale() }}
                      transition={{ duration: 0.8, ease: "easeInOut" }}
                    >
                      <div className="text-center px-2">
                        {currentPhase === "complete" ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring" }}
                          >
                            <Sparkles className="w-7 h-7 mx-auto mb-1 text-primary-foreground" />
                            <span className="block text-base font-bold tracking-tight text-primary-foreground">Done</span>
                          </motion.div>
                        ) : (
                          <>
                            <motion.span
                              key={currentPhase}
                              className="block text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/90"
                              initial={{ opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              {PHASE_LABELS[currentPhase]}
                            </motion.span>
                            <span className="block text-5xl font-black tabular-nums text-primary-foreground leading-none mt-1">
                              {getPhaseSeconds(currentPhase) - phaseTime}
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {/* Progress strip — current cycle elongates into a pill. */}
                  <div className="flex gap-1.5 items-center h-1.5">
                    {Array.from({ length: selectedPattern.cycles }).map((_, i) => {
                      const filled  = i < currentCycle - 1;
                      const current = i === currentCycle - 1;
                      return (
                        <motion.span
                          key={i}
                          className={cn(
                            "rounded-full transition-all",
                            filled  ? "bg-primary" :
                            current ? "bg-primary" : "bg-muted",
                          )}
                          style={{ width: current ? 18 : 6, height: 6 }}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.04 }}
                        />
                      );
                    })}
                  </div>

                  {/* Guidance text */}
                  <motion.p
                    key={currentPhase}
                    className="text-xs text-muted-foreground text-center max-w-xs"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {PHASE_ICONS[currentPhase]}
                  </motion.p>

                  {/* Total elapsed time */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
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
