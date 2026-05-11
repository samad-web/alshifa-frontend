// Monday Motivation Card.
//
// Sits at the top of EnhancedPatientDashboard. Shows one personalized
// weekly tip based on the patient's prakriti (Vata/Pitta/Kapha) and the
// current Indian season. The card appears every Monday for all patients
// and persists Tuesday–Sunday until the patient taps "Got it"; once read,
// it disappears for the rest of the week and a fresh card returns next
// Monday. Tapping "Got it" awards +5 Zen Points the first time
// (rate-limited 1/day server-side via PATIENT_RATE_LIMITS.MOTIVATION_READ).

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf, Bookmark, BookmarkCheck, Share2, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  motivationService,
  type MotivationCard as MotivationCardData,
  type Prakriti,
  type Season,
} from "@/services/motivation.service";

interface Props {
  patientName?: string;
}

const PRAKRITI_LABEL: Record<Prakriti, string> = {
  VATA: "Vata",
  PITTA: "Pitta",
  KAPHA: "Kapha",
  GENERAL: "General",
};

const SEASON_LABEL: Record<Season, string> = {
  HEMANTA: "Hemanta · Late Autumn",
  SHISHIRA: "Shishira · Winter",
  VASANTA: "Vasanta · Spring",
  GRISHMA: "Grishma · Summer",
  VARSHA: "Varsha · Monsoon",
  SHARAD: "Sharad · Early Autumn",
};

const PRAKRITI_TONE: Record<Prakriti, string> = {
  VATA: "from-amber-50 to-orange-50 border-amber-200/70",
  PITTA: "from-rose-50 to-red-50 border-rose-200/70",
  KAPHA: "from-emerald-50 to-teal-50 border-emerald-200/70",
  GENERAL: "from-violet-50 to-indigo-50 border-violet-200/70",
};

export function MotivationCard({ patientName }: Props) {
  const queryClient = useQueryClient();
  const [collapsing, setCollapsing] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["motivation", "today"],
    queryFn: async () => (await motivationService.getToday()).data,
    staleTime: 5 * 60 * 1000,
  });

  const card: MotivationCardData | undefined = data?.card;

  const readMutation = useMutation({
    mutationFn: async () => {
      if (!card) throw new Error("No card");
      return (await motivationService.markRead(card.id)).data;
    },
    onSuccess: (resp) => {
      queryClient.setQueryData(["motivation", "today"], { card: resp.card });
      if (resp.zenPointsAwarded > 0) {
        toast.success(`+${resp.zenPointsAwarded} Zen Points 🌟`);
      }
      // 600ms collapse animation, then settle into the read state
      setCollapsing(true);
      setTimeout(() => setCollapsing(false), 600);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not mark as read");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!card) throw new Error("No card");
      return (await motivationService.toggleSave(card.id)).data;
    },
    onSuccess: (resp) => {
      queryClient.setQueryData(["motivation", "today"], { card: resp.card });
      queryClient.invalidateQueries({ queryKey: ["motivation", "saved"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not save tip");
    },
  });

  const onShare = async () => {
    if (!card) return;
    const shareText = `🌿 Monday Motivation\n\n${card.tip}\n\n— Al-Shifa`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Monday Motivation", text: shareText });
        return;
      }
    } catch {
      // user cancelled the share sheet — fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("Tip copied to clipboard");
    } catch {
      toast.error("Could not share — try again");
    }
  };

  if (isLoading) {
    return (
      <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-orange-50/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 animate-pulse text-amber-600" />
            Brewing this week's Monday Motivation…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !card) {
    return null; // Silent fail: we don't want a broken card to scare patients.
  }

  // Show card only on Monday OR if card exists this week and not yet read
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday...6=Saturday
  const isMonday = dayOfWeek === 1;

  // Calculate start of current week (Monday)
  const currentWeekMonday = new Date(today);
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  currentWeekMonday.setDate(today.getDate() - daysFromMonday);
  currentWeekMonday.setHours(0, 0, 0, 0);

  // Show if: today is Monday OR card was created this week and not yet read
  const cardCreatedThisWeek = card && new Date(card.createdAt) >= currentWeekMonday;
  const shouldShowCard = isMonday || (cardCreatedThisWeek && !card.isRead);

  if (!shouldShowCard) return null;

  const tone = PRAKRITI_TONE[card.prakriti];
  const greetingName = patientName?.split(" ")[0];

  return (
    <Card
      className={
        "relative overflow-hidden border bg-gradient-to-br shadow-sm transition-all duration-500 " +
        tone +
        (collapsing ? " scale-[0.99] opacity-90" : "")
      }
    >
      <div className="absolute -right-6 -top-6 opacity-10">
        <Leaf className="w-32 h-32 text-emerald-700" />
      </div>

      <CardContent className="relative py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800/90">
              <Leaf className="w-3.5 h-3.5" />
              <span>Monday Motivation 🌱</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {greetingName ? `For you, ${greetingName} — ` : ""}
              <span className="font-medium">{PRAKRITI_LABEL[card.prakriti]}</span>
              <span className="mx-1.5">·</span>
              <span>{SEASON_LABEL[card.season]}</span>
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              aria-label={card.isSaved ? "Unsave tip" : "Save tip"}
              title={card.isSaved ? "Saved — tap to remove" : "Save to My Tips"}
            >
              {card.isSaved ? (
                <BookmarkCheck className="w-4 h-4 text-emerald-700" />
              ) : (
                <Bookmark className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onShare}
              aria-label="Share tip"
              title="Share"
            >
              <Share2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-foreground/90 font-serif">
          {card.tip}
        </p>

        <div className="flex items-center justify-between gap-2 pt-1">
          {card.isRead ? (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] px-2 py-0.5"
            >
              <Check className="w-3 h-3 mr-1" />
              Read this week · +5 Zen earned
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Tap "Got it" to earn +5 Zen Points
            </span>
          )}

          {!card.isRead && (
            <Button
              size="sm"
              onClick={() => readMutation.mutate()}
              disabled={readMutation.isPending || collapsing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {readMutation.isPending ? "Saving…" : "Got it · +5"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
