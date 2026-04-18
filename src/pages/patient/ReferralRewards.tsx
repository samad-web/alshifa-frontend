import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Gift,
  Users,
  CheckCircle2,
  Star,
  Copy,
  Check,
  Share2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { patientGamificationApi } from "@/services/patientGamification.service";
import type { ReferralStats } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";

const TIERS = [
  { name: "Bronze", color: "bg-amber-700", textColor: "text-amber-700", emoji: "🥉", minReferrals: 0 },
  { name: "Silver", color: "bg-gray-400", textColor: "text-gray-500", emoji: "🥈", minReferrals: 5 },
  { name: "Gold", color: "bg-yellow-500", textColor: "text-yellow-600", emoji: "🥇", minReferrals: 15 },
  { name: "Platinum", color: "bg-cyan-400", textColor: "text-cyan-500", emoji: "💎", minReferrals: 30 },
];

const STEPS = [
  { step: 1, title: "Share Your Code", description: "Give your referral code to friends and family", icon: Share2 },
  { step: 2, title: "Friend Registers", description: "They sign up using your referral code", icon: Users },
  { step: 3, title: "Earn Rewards", description: "Both of you earn bonus zen points!", icon: Gift },
];

export default function ReferralRewards() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const data = await patientGamificationApi.getReferralStats();
      setStats(data);
    } catch {
      toast({ title: "Error", description: "Failed to load referral stats.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    const code = referralCode;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const currentTierIndex = TIERS.findIndex((t) => t.name === stats?.currentTier) ?? 0;
  const referralCode = user?.id ? `REF-${user.id.slice(0, 8).toUpperCase()}` : "REF-XXXXXX";
  const referralsToNext = stats?.referralsToNext ?? 0;
  const nextTierData = TIERS[currentTierIndex + 1];
  const progressToNext = nextTierData
    ? Math.round(
        ((stats?.completedReferrals ?? 0) /
          (nextTierData.minReferrals || 1)) *
          100
      )
    : 100;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <PageHeader
          title="Referral Rewards"
          subtitle="Invite others and earn rewards together"
        >
          <Badge variant="outline" className="gap-1 text-sm">
            {TIERS[currentTierIndex]?.emoji} {stats?.currentTier || "Bronze"} Tier
          </Badge>
        </PageHeader>

        {/* Tier Progression */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tier Progression</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-6">
              {TIERS.map((tier, idx) => {
                const isActive = idx === currentTierIndex;
                const isCompleted = idx < currentTierIndex;
                return (
                  <div key={tier.name} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${
                          isActive
                            ? "border-primary scale-110 shadow-lg"
                            : isCompleted
                            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                            : "border-muted bg-muted/50"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        ) : (
                          tier.emoji
                        )}
                      </div>
                      <span
                        className={`text-xs mt-1.5 font-medium ${
                          isActive
                            ? tier.textColor
                            : isCompleted
                            ? "text-green-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        {tier.name}
                      </span>
                    </div>
                    {idx < TIERS.length - 1 && (
                      <ArrowRight
                        className={`h-4 w-4 shrink-0 mx-1 ${
                          idx < currentTierIndex
                            ? "text-green-500"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress to next tier */}
            {nextTierData && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Progress to {nextTierData.name}
                  </span>
                  <span className="font-medium">
                    {referralsToNext} more referral{referralsToNext !== 1 ? "s" : ""} needed
                  </span>
                </div>
                <Progress value={Math.min(100, progressToNext)} className="h-2" />
              </div>
            )}
            {!nextTierData && (
              <p className="text-center text-sm text-green-600 font-medium">
                You've reached the highest tier!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <div className="text-3xl font-bold">{stats?.totalReferrals ?? 0}</div>
              <p className="text-sm text-muted-foreground">Total Referrals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <div className="text-3xl font-bold">{stats?.completedReferrals ?? 0}</div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Star className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
              <div className="text-3xl font-bold">{stats?.totalPointsEarned ?? 0}</div>
              <p className="text-sm text-muted-foreground">Points Earned</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral Code */}
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">Your Referral Code</p>
              <div className="inline-flex items-center gap-3 bg-muted/50 rounded-xl px-6 py-4">
                <span className="text-2xl md:text-3xl font-mono font-bold tracking-wider">
                  {referralCode}
                </span>
                <Button variant="ghost" size="icon" onClick={copyCode}>
                  {copied ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Copy className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" className="gap-2" onClick={copyCode}>
                  <Share2 className="h-4 w-4" />
                  Share Code
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.step} className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-sm font-medium">
                      Step {step.step}: {step.title}
                    </div>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
