/**
 * ReferralPage — patient portal for referral codes and Zen Points tracking.
 *
 * Accessible by: PATIENT
 *
 * Features:
 *  - Displays the patient's unique referral link
 *  - Shows referral history with status tracking
 *  - Highlights Zen Points earned from completed referrals
 */

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
    Loader2, AlertCircle, Copy, CheckCheck,
    Users, Star, Gift, Share2
} from "lucide-react";

import { apiClient } from "@/lib/api-client";

const ZEN_POINTS_PER_REFERRAL = 50;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    PENDING:    { label: "Pending",    className: "bg-amber-100 text-amber-700" },
    REGISTERED: { label: "Registered", className: "bg-blue-100 text-blue-700"  },
    COMPLETED:  { label: "Completed",  className: "bg-green-100 text-green-700" },
};

interface ReferralCodeData {
    referralCode: string;
    referralLink: string;
    status: string;
    completedCount: number;
}

interface Referral {
    id: string;
    referralCode: string;
    status: keyof typeof STATUS_CONFIG;
    rewardGranted: boolean;
    createdAt: string;
    referred?: {
        user?: { firstName: string; lastName: string };
    };
}

export default function ReferralPage() {
    const { toast } = useToast();
    const [codeData, setCodeData] = useState<ReferralCodeData | null>(null);
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loadingCode, setLoadingCode] = useState(true);
    const [loadingReferrals, setLoadingReferrals] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const fetchCode = useCallback(async () => {
        setLoadingCode(true);
        try {
            const { data } = await apiClient.get<ReferralCodeData>('/api/referrals/my-code');
            setCodeData(data);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Error";
            setError(msg);
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setLoadingCode(false);
        }
    }, [toast]);

    const fetchReferrals = useCallback(async () => {
        setLoadingReferrals(true);
        try {
            const { data } = await apiClient.get<Referral[]>('/api/referrals/my');
            setReferrals(data);
        } catch {
            // Non-critical — don't block the page
        } finally {
            setLoadingReferrals(false);
        }
    }, []);

    useEffect(() => {
        fetchCode();
        fetchReferrals();
    }, [fetchCode, fetchReferrals]);

    const handleCopy = async () => {
        if (!codeData?.referralLink) return;
        try {
            await navigator.clipboard.writeText(codeData.referralLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
            toast({ title: "Copied!", description: "Referral link copied to clipboard." });
        } catch {
            toast({ title: "Copy failed", description: "Please copy the link manually.", variant: "destructive" });
        }
    };

    const completedCount = referrals.filter((r) => r.status === "COMPLETED").length;
    const zenEarned = completedCount * ZEN_POINTS_PER_REFERRAL;

    return (
        <AppLayout>
            <div className="max-w-3xl mx-auto space-y-6 p-6">
                <PageHeader
                    title="Refer a Friend"
                    description="Share Al-Shifa with people you care about and earn Zen Points when they complete their first appointment"
                />

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4">
                    <Panel className="text-center">
                        <div className="flex justify-center mb-2">
                            <Users className="h-6 w-6 text-blue-500" />
                        </div>
                        <div className="text-2xl font-bold">{referrals.length}</div>
                        <div className="text-xs text-muted-foreground mt-1">Total Referrals</div>
                    </Panel>
                    <Panel className="text-center">
                        <div className="flex justify-center mb-2">
                            <CheckCheck className="h-6 w-6 text-green-500" />
                        </div>
                        <div className="text-2xl font-bold">{completedCount}</div>
                        <div className="text-xs text-muted-foreground mt-1">Completed</div>
                    </Panel>
                    <Panel className="text-center">
                        <div className="flex justify-center mb-2">
                            <Star className="h-6 w-6 text-amber-500" />
                        </div>
                        <div className="text-2xl font-bold">{zenEarned}</div>
                        <div className="text-xs text-muted-foreground mt-1">Zen Points Earned</div>
                    </Panel>
                </div>

                {/* Referral code + link */}
                {loadingCode ? (
                    <Panel className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </Panel>
                ) : error ? (
                    <Panel className="flex items-center gap-3 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </Panel>
                ) : codeData ? (
                    <Panel>
                        <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                <Share2 className="h-6 w-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold">Your Referral Link</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm font-mono break-all">
                                        {codeData.referralLink}
                                    </code>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCopy}
                                        className="min-w-[90px] flex gap-2"
                                    >
                                        {copied ? (
                                            <><CheckCheck className="h-4 w-4 text-green-600" /> Copied</>
                                        ) : (
                                            <><Copy className="h-4 w-4" /> Copy</>
                                        )}
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Code: <span className="font-mono font-semibold">{codeData.referralCode}</span>
                                    &nbsp;·&nbsp;Earn <span className="text-amber-600 font-semibold">{ZEN_POINTS_PER_REFERRAL} Zen Points</span> when a friend completes their first appointment.
                                </p>
                            </div>
                        </div>
                    </Panel>
                ) : null}

                {/* Referral history */}
                <div>
                    <h2 className="font-semibold text-lg mb-3">Referral History</h2>

                    {loadingReferrals ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : referrals.length === 0 ? (
                        <Panel>
                            <p className="text-center text-muted-foreground py-8">
                                No referrals yet. Share your link to get started!
                            </p>
                        </Panel>
                    ) : (
                        <div className="space-y-3">
                            {referrals.map((ref) => {
                                const statusCfg = STATUS_CONFIG[ref.status] ?? STATUS_CONFIG.PENDING;
                                const referredName = ref.referred?.user
                                    ? `${ref.referred.user.firstName} ${ref.referred.user.lastName}`
                                    : "Pending registration";
                                return (
                                    <Panel key={ref.id}>
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-muted">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{referredName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {new Date(ref.createdAt).toLocaleDateString("en-GB", {
                                                            day: "numeric", month: "short", year: "numeric"
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {ref.rewardGranted && (
                                                    <Badge className="bg-amber-500 text-white flex gap-1 text-xs">
                                                        <Gift className="h-3 w-3" /> +{ZEN_POINTS_PER_REFERRAL} pts
                                                    </Badge>
                                                )}
                                                <Badge
                                                    variant="outline"
                                                    className={`text-xs ${statusCfg.className}`}
                                                >
                                                    {statusCfg.label}
                                                </Badge>
                                            </div>
                                        </div>
                                    </Panel>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
