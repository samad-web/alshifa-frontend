import { cn } from "@/lib/utils";

/**
 * Compact V/P/K trio chip showing each dosha's effect.
 *
 * Color encoding:
 *   - PACIFYING   → emerald (good for that dosha)
 *   - AGGRAVATING → rose    (avoid for that dosha)
 *   - NEUTRAL     → muted   (no notable effect)
 *
 * `size="sm"` is the default; `size="md"` is used inside detail modals.
 */
interface Props {
  vata: string;
  pitta: string;
  kapha: string;
  size?: "sm" | "md";
  className?: string;
}

const TONE: Record<string, string> = {
  PACIFYING:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  AGGRAVATING: "bg-rose-100 text-rose-800 border-rose-200",
  NEUTRAL:     "bg-muted text-muted-foreground border-border",
};

function tone(effect: string) {
  return TONE[effect] ?? TONE.NEUTRAL;
}

export function DoshaEffectBadge({ vata, pitta, kapha, size = "sm", className }: Props) {
  const sizeClass = size === "sm"
    ? "text-[10px] px-1.5 py-0 h-5 min-w-[22px]"
    : "text-xs px-2 py-0.5 h-6 min-w-[28px]";
  return (
    <div className={cn("inline-flex items-center gap-1", className)} title={`Vata: ${vata} · Pitta: ${pitta} · Kapha: ${kapha}`}>
      <span className={cn("rounded-full border font-bold inline-flex items-center justify-center", sizeClass, tone(vata))}>V</span>
      <span className={cn("rounded-full border font-bold inline-flex items-center justify-center", sizeClass, tone(pitta))}>P</span>
      <span className={cn("rounded-full border font-bold inline-flex items-center justify-center", sizeClass, tone(kapha))}>K</span>
    </div>
  );
}
