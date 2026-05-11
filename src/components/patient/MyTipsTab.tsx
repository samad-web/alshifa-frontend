// "My Tips" tab — patient's saved Monday Motivations.
//
// Lists every Monday Motivation the patient has bookmarked
// (most-recently-saved first), with the tip text, prakriti+season tags,
// and a one-tap unsave button. Empty state nudges them to start saving
// from the dashboard card.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, BookmarkCheck, Leaf, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  motivationService,
  type MotivationCard,
  type Prakriti,
  type Season,
} from "@/services/motivation.service";

const PRAKRITI_LABEL: Record<Prakriti, string> = {
  VATA: "Vata",
  PITTA: "Pitta",
  KAPHA: "Kapha",
  GENERAL: "General",
};

const SEASON_LABEL: Record<Season, string> = {
  HEMANTA: "Hemanta",
  SHISHIRA: "Shishira",
  VASANTA: "Vasanta",
  GRISHMA: "Grishma",
  VARSHA: "Varsha",
  SHARAD: "Sharad",
};

function formatSavedDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MyTipsTab() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["motivation", "saved"],
    queryFn: async () => (await motivationService.getSaved()).data,
  });

  const unsaveMutation = useMutation({
    mutationFn: async (cardId: string) => {
      return (await motivationService.toggleSave(cardId)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motivation", "saved"] });
      queryClient.invalidateQueries({ queryKey: ["motivation", "today"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not update tip");
    },
  });

  const onShare = async (tip: MotivationCard) => {
    const shareText = `🌿 Monday Motivation\n\n${tip.tip}\n\n— Al-Shifa`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "Monday Motivation", text: shareText });
        return;
      }
    } catch {
      // user cancelled
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
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-lg bg-muted/40 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Could not load saved tips. Try refreshing the page.
      </p>
    );
  }

  const cards = data?.cards ?? [];

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
        <Leaf className="w-10 h-10 text-emerald-600/40" />
        <p className="text-sm font-medium">No saved Monday Motivations yet</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Tap the bookmark icon on your Monday Motivation to save it here for later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {cards.length} saved {cards.length === 1 ? "Monday Motivation" : "Monday Motivations"}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {cards.map((card) => (
          <Card
            key={card.id}
            className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 to-teal-50/30"
          >
            <CardContent className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-white/70 border-emerald-200 text-emerald-800"
                  >
                    {PRAKRITI_LABEL[card.prakriti]}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-white/70 border-amber-200 text-amber-800"
                  >
                    {SEASON_LABEL[card.season]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Saved {formatSavedDate(card.savedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onShare(card)}
                    aria-label="Share tip"
                  >
                    <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => unsaveMutation.mutate(card.id)}
                    disabled={unsaveMutation.isPending}
                    aria-label="Remove from saved"
                    title="Remove from saved"
                  >
                    {card.isSaved ? (
                      <BookmarkCheck className="w-3.5 h-3.5 text-emerald-700" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 font-serif">
                {card.tip}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
