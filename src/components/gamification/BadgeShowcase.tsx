import { useEffect, useState } from "react";
import { gamificationApi } from "@/services/gamification.service";
import type { Badge as BadgeType, BadgeTier } from "@/types";
import { Award, Flame, Star, Trophy, Crown, CheckCircle, Zap, Heart, Flag, Map, Shield, Medal, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TIER_CONFIG: Record<BadgeTier, {
  bg: string; border: string; text: string; icon: string; glow: string; ring: string; label: string;
}> = {
  BRONZE: {
    bg: "bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20",
    border: "border-amber-300/60 dark:border-amber-600/40",
    text: "text-amber-700 dark:text-amber-400",
    icon: "bg-amber-200/80 dark:bg-amber-800/40",
    glow: "hover:shadow-amber-300/30 dark:hover:shadow-amber-600/20",
    ring: "ring-amber-400/40",
    label: "Bronze",
  },
  SILVER: {
    bg: "bg-gradient-to-br from-slate-100 to-gray-50 dark:from-slate-800/40 dark:to-gray-800/30",
    border: "border-slate-300/60 dark:border-slate-500/40",
    text: "text-slate-600 dark:text-slate-300",
    icon: "bg-slate-200/80 dark:bg-slate-700/40",
    glow: "hover:shadow-slate-300/30 dark:hover:shadow-slate-500/20",
    ring: "ring-slate-400/40",
    label: "Silver",
  },
  GOLD: {
    bg: "bg-gradient-to-br from-yellow-100 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/20",
    border: "border-yellow-400/60 dark:border-yellow-500/40",
    text: "text-yellow-700 dark:text-yellow-400",
    icon: "bg-yellow-200/80 dark:bg-yellow-800/40",
    glow: "hover:shadow-yellow-300/40 dark:hover:shadow-yellow-500/20",
    ring: "ring-yellow-400/40",
    label: "Gold",
  },
  PLATINUM: {
    bg: "bg-gradient-to-br from-violet-100 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/20",
    border: "border-violet-400/60 dark:border-violet-500/40",
    text: "text-violet-700 dark:text-violet-400",
    icon: "bg-violet-200/80 dark:bg-violet-800/40",
    glow: "hover:shadow-violet-300/40 dark:hover:shadow-violet-500/20",
    ring: "ring-violet-400/40",
    label: "Platinum",
  },
};

const TIER_ORDER: BadgeTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Flame, Star, Award, Trophy, Crown, CheckCircle, Zap, Heart, Flag, Map, Shield, Medal,
};

interface BadgeShowcaseProps {
  compact?: boolean;
}

export function BadgeShowcase({ compact = false }: BadgeShowcaseProps) {
  const [badges, setBadges] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gamificationApi.getAllBadges()
      .then(setBadges)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Award className="w-6 h-6 text-primary animate-pulse" />
    </div>
  );

  const earned = badges.filter(b => b.earned);
  const unearned = badges.filter(b => !b.earned);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {earned.map(badge => (
          <BadgeIcon key={badge.id} badge={badge} size="sm" />
        ))}
        {earned.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No badges earned yet</p>
        )}
      </div>
    );
  }

  // Group unearned badges by tier for organized display
  const unearnedByTier = TIER_ORDER.map(tier => ({
    tier,
    config: TIER_CONFIG[tier],
    badges: unearned.filter(b => b.tier === tier),
  })).filter(g => g.badges.length > 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Earned Badges — prominent display */}
        {earned.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
              <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] shrink-0">
                Unlocked ({earned.length})
              </h4>
              <div className="h-px flex-1 bg-gradient-to-l from-primary/20 to-transparent" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {earned.map(badge => (
                <BadgeCard key={badge.id} badge={badge} />
              ))}
            </div>
          </div>
        )}

        {/* Locked Badges — grouped by tier */}
        {unearnedByTier.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] shrink-0">
                Locked ({unearned.length})
              </h4>
              <div className="h-px flex-1 bg-gradient-to-l from-border to-transparent" />
            </div>

            <div className="space-y-5">
              {unearnedByTier.map(({ tier, config, badges: tierBadges }) => (
                <div key={tier}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className={cn("text-[9px] font-black uppercase tracking-[0.15em]", config.text)}>
                      {config.label} Tier
                    </span>
                    <div className={cn("h-px flex-1", config.border)} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                    {tierBadges.map(badge => (
                      <BadgeCard key={badge.id} badge={badge} locked />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function BadgeCard({ badge, locked = false }: { badge: BadgeType; locked?: boolean }) {
  const Icon = ICON_MAP[badge.icon] || Award;
  const config = TIER_CONFIG[badge.tier];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "relative rounded-xl border p-3 transition-all duration-200 cursor-default group",
            locked
              ? "bg-secondary/5 border-border/40 hover:border-border/60 hover:bg-secondary/10"
              : cn(config.bg, config.border, config.glow, "hover:shadow-lg hover:-translate-y-0.5"),
          )}
        >
          {/* Tier accent line */}
          {!locked && (
            <div className={cn(
              "absolute top-0 left-3 right-3 h-0.5 rounded-b-full",
              badge.tier === "PLATINUM" ? "bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400" :
              badge.tier === "GOLD" ? "bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400" :
              badge.tier === "SILVER" ? "bg-gradient-to-r from-slate-300 via-gray-200 to-slate-300" :
              "bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500"
            )} />
          )}

          <div className="flex items-start gap-2.5">
            {/* Icon */}
            <div className={cn(
              "shrink-0 rounded-lg p-2 transition-colors",
              locked
                ? "bg-secondary/30 text-muted-foreground/40"
                : cn(config.icon, config.text)
            )}>
              {locked ? (
                <div className="relative">
                  <Icon className="w-4.5 h-4.5 opacity-30" />
                  <Lock className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-muted-foreground/60" />
                </div>
              ) : (
                <Icon className="w-4.5 h-4.5" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className={cn(
                "text-[11px] font-bold leading-tight truncate",
                locked ? "text-muted-foreground/60" : "text-foreground"
              )}>
                {badge.name}
              </p>
              <p className={cn(
                "text-[9px] leading-snug mt-0.5 line-clamp-2",
                locked ? "text-muted-foreground/40" : "text-muted-foreground"
              )}>
                {badge.description}
              </p>
              {!locked && badge.awardedAt && (
                <p className="text-[8px] text-muted-foreground/60 mt-1">
                  {new Date(badge.awardedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Tier label */}
          <div className={cn(
            "mt-2 text-[7px] font-black uppercase tracking-[0.2em] text-center",
            locked ? "text-muted-foreground/30" : config.text
          )}>
            {badge.tier}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[200px] text-center"
      >
        <p className="font-bold text-xs">{badge.name}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{badge.description}</p>
        {locked && (
          <p className="text-[10px] text-primary mt-1 font-semibold">Keep going to unlock!</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function BadgeIcon({ badge, size = "md" }: { badge: BadgeType; size?: "sm" | "md" }) {
  const Icon = ICON_MAP[badge.icon] || Award;
  const config = TIER_CONFIG[badge.tier];
  const dim = size === "sm" ? "w-8 h-8" : "w-10 h-10";
  const iconDim = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "rounded-full border flex items-center justify-center",
            config.bg, config.border, config.text, dim
          )}
        >
          <Icon className={iconDim} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs font-bold">{badge.name}</p>
        <p className="text-[9px] text-muted-foreground">{badge.tier}</p>
      </TooltipContent>
    </Tooltip>
  );
}
