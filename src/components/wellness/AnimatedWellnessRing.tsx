import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

interface AnimatedWellnessRingProps {
  score: number;
  maxScore?: number;
  size?: number;
  strokeWidth?: number;
  breakdown?: {
    taskAdherence: number;
    vitalTrend: number;
    milestoneProgress: number;
    appointmentAttendance: number;
  };
  className?: string;
  onMilestone?: () => void;
}

const SEGMENT_COLORS = {
  taskAdherence: { stroke: "#10b981", glow: "#10b98140" },
  vitalTrend: { stroke: "#3b82f6", glow: "#3b82f640" },
  milestoneProgress: { stroke: "#f59e0b", glow: "#f59e0b40" },
  appointmentAttendance: { stroke: "#8b5cf6", glow: "#8b5cf640" },
};

const PARTICLE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];

function generateParticles(count: number, centerX: number, centerY: number, radius: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const dist = radius + 8 + Math.random() * 24;
    return {
      id: i,
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    };
  });
}

function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: "Excellent", color: "text-emerald-500" };
  if (score >= 60) return { text: "Good", color: "text-blue-500" };
  if (score >= 40) return { text: "Fair", color: "text-amber-500" };
  if (score >= 20) return { text: "Needs Work", color: "text-orange-500" };
  return { text: "Getting Started", color: "text-muted-foreground" };
}

export function AnimatedWellnessRing({
  score,
  maxScore = 100,
  size = 220,
  strokeWidth = 14,
  breakdown,
  className,
  onMilestone,
}: AnimatedWellnessRingProps) {
  const center = size / 2;
  const radius = (size - strokeWidth * 2 - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = Math.min(score / maxScore, 1) * 100;

  const motionScore = useMotionValue(0);
  const displayScore = useTransform(motionScore, (v) => Math.round(v));
  const [displayedScore, setDisplayedScore] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevScoreRef = useRef(0);

  const particles = generateParticles(16, center, center, radius);

  useEffect(() => {
    const unsubscribe = displayScore.on("change", (v) => setDisplayedScore(v));
    return unsubscribe;
  }, [displayScore]);

  useEffect(() => {
    const controls = animate(motionScore, normalizedScore, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => {
        if (normalizedScore >= 50 && !hasAnimated) {
          setShowParticles(true);
          setHasAnimated(true);
          onMilestone?.();
          setTimeout(() => setShowParticles(false), 3000);
        }
      },
    });
    prevScoreRef.current = normalizedScore;
    return controls.stop;
  }, [normalizedScore, motionScore, hasAnimated, onMilestone]);

  const scoreLabel = getScoreLabel(normalizedScore);

  // Compute segment arcs for breakdown
  const segments = breakdown
    ? [
        { key: "taskAdherence" as const, weight: 0.4, value: breakdown.taskAdherence },
        { key: "vitalTrend" as const, weight: 0.3, value: breakdown.vitalTrend },
        { key: "milestoneProgress" as const, weight: 0.2, value: breakdown.milestoneProgress },
        { key: "appointmentAttendance" as const, weight: 0.1, value: breakdown.appointmentAttendance },
      ]
    : null;

  let cumulativeOffset = 0;

  return (
    <div ref={containerRef} className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Glow effect behind the ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size - 20,
          height: size - 20,
          background: `radial-gradient(circle, ${normalizedScore >= 60 ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.08)"} 0%, transparent 70%)`,
        }}
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted/40"
        />

        {/* Glow filter */}
        <defs>
          <filter id="ring-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Segmented progress or single arc */}
        {segments ? (
          segments.map((seg) => {
            const segLength = (seg.value / 100) * seg.weight * circumference;
            const offset = -cumulativeOffset;
            cumulativeOffset += (seg.value / 100) * seg.weight * circumference;
            const colors = SEGMENT_COLORS[seg.key];
            return (
              <motion.circle
                key={seg.key}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                stroke={colors.stroke}
                filter="url(#ring-glow)"
                initial={{ strokeDasharray: `0 ${circumference}`, strokeDashoffset: offset }}
                animate={{ strokeDasharray: `${segLength} ${circumference}`, strokeDashoffset: offset }}
                transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              />
            );
          })
        ) : (
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="stroke-primary"
            filter="url(#ring-glow)"
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{
              strokeDasharray: `${(normalizedScore / 100) * circumference} ${circumference}`,
            }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {/* Tick marks around the ring */}
        {Array.from({ length: 40 }).map((_, i) => {
          const angle = (i / 40) * Math.PI * 2 - Math.PI / 2;
          const isMajor = i % 10 === 0;
          const innerR = radius + strokeWidth / 2 + 2;
          const outerR = innerR + (isMajor ? 6 : 3);
          return (
            <line
              key={i}
              x1={center + Math.cos(angle) * innerR}
              y1={center + Math.sin(angle) * innerR}
              x2={center + Math.cos(angle) * outerR}
              y2={center + Math.sin(angle) * outerR}
              stroke="currentColor"
              className="text-muted-foreground/20"
              strokeWidth={isMajor ? 1.5 : 0.5}
            />
          );
        })}
      </svg>

      {/* Particles on milestone */}
      {showParticles &&
        particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              left: center,
              top: center,
            }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{
              x: p.x - center,
              y: p.y - center,
              opacity: [0, 1, 1, 0],
              scale: [0, 1.5, 1, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: "easeOut",
            }}
          />
        ))}

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-4xl font-black text-foreground tabular-nums"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
        >
          {displayedScore}
        </motion.span>
        <motion.span
          className={cn("text-xs font-bold mt-0.5", scoreLabel.color)}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {scoreLabel.text}
        </motion.span>
        <motion.span
          className="text-[10px] text-muted-foreground mt-0.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Wellness Score
        </motion.span>
      </div>

      {/* Breakdown legend */}
      {breakdown && (
        <motion.div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          {[
            { label: "Adherence", color: "bg-emerald-500" },
            { label: "Vitals", color: "bg-blue-500" },
            { label: "Milestones", color: "bg-amber-500" },
            { label: "Attendance", color: "bg-purple-500" },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className={cn("w-1.5 h-1.5 rounded-full", item.color)} />
              {item.label}
            </span>
          ))}
        </motion.div>
      )}
    </div>
  );
}
