import { useEffect, useState } from "react";
import { Award, Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface BadgeHolder {
  userId: string;
  name: string;
  role: string;
  branchName: string | null;
  profilePhoto: string | null;
  awardedAt: string;
  currentRank: number | null;
}

interface BadgeHoldersResponse {
  badge: {
    id: string;
    code: string;
    name: string;
    icon: string;
    tier: string;
    description: string;
  };
  holders: BadgeHolder[];
  totalCount: number;
}

interface BadgeHoldersModalProps {
  /** Either Badge.id or Badge.code — backend resolves both. */
  badgeId: string | null;
  badgeName: string | null;
  open: boolean;
  onClose: () => void;
}

const TIER_CLASSES: Record<string, string> = {
  BRONZE:   "bg-orange-200 text-orange-900",
  SILVER:   "bg-slate-200 text-slate-900",
  GOLD:     "bg-yellow-200 text-yellow-900",
  PLATINUM: "bg-cyan-200 text-cyan-900",
};

// Deterministic colour from a userId so the same person keeps the same
// avatar tint across page reloads. Mirrors the PatientCard avatar logic.
const AVATAR_PALETTE = [
  "bg-rose-200 text-rose-900",
  "bg-amber-200 text-amber-900",
  "bg-emerald-200 text-emerald-900",
  "bg-sky-200 text-sky-900",
  "bg-violet-200 text-violet-900",
  "bg-pink-200 text-pink-900",
];
function avatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function BadgeHoldersModal({ badgeId, badgeName, open, onClose }: BadgeHoldersModalProps) {
  const [data, setData] = useState<BadgeHoldersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy fetch — only triggered when the modal opens, never on background mount.
  // Re-fetches if the user clicks a different badge while one is already open.
  useEffect(() => {
    if (!open || !badgeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    apiClient
      .get<BadgeHoldersResponse>(`/api/gamification/badges/${encodeURIComponent(badgeId)}/holders`)
      .then(({ data }) => { if (!cancelled) setData(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message || "Failed to load badge holders"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, badgeId]);

  const tierClass = data ? (TIER_CLASSES[data.badge.tier] ?? "bg-muted text-muted-foreground") : "bg-muted text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-tight">
                {data?.badge.name || badgeName || "Badge"}
              </div>
              {data?.badge.tier && (
                <Badge className={cn("text-[10px] mt-1 hover:bg-current", tierClass)}>
                  {data.badge.tier}
                </Badge>
              )}
            </div>
          </DialogTitle>
          {data && (
            <DialogDescription>
              {data.totalCount === 0
                ? "No one has earned this badge yet."
                : `${data.totalCount} ${data.totalCount === 1 ? "clinician has" : "clinicians have"} earned this badge.`}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="py-10 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : !data || data.holders.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No one has earned this badge yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.holders.map((h) => (
                <li
                  key={h.userId}
                  className="flex items-center gap-3 p-2.5 rounded-xl border bg-card hover:bg-muted/30"
                >
                  <Avatar className="h-10 w-10">
                    {h.profilePhoto && <AvatarImage src={h.profilePhoto} />}
                    <AvatarFallback className={avatarTint(h.userId)}>
                      {initialsOf(h.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold truncate">{h.name}</span>
                      <Badge variant="outline" className="text-[10px]">{h.role}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {h.branchName ? `${h.branchName} · ` : ""}
                      Earned on {new Date(h.awardedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {h.currentRank !== null && (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                      #{h.currentRank}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
