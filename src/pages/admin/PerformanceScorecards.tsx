import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useBranches";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { operationsApi } from "@/services/operations.service";
import type { PerformanceScorecard } from "@/types";
import {
  Loader2, BarChart3, TrendingUp, TrendingDown, Award, Users, Sparkles, Home, Star, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { useBranchScope } from "@/hooks/useBranchScope";
import { homeTherapyService } from "@/services/homeTherapy.service";

const metricLabels: { key: keyof PerformanceScorecard; label: string; max: number; color: string; invert?: boolean }[] = [
  { key: "patientsSeenCount", label: "Patients Seen", max: 100, color: "bg-blue-500" },
  { key: "avgPatientRating", label: "Avg Rating", max: 5, color: "bg-yellow-500" },
  { key: "onTimeRate", label: "On-Time Rate", max: 100, color: "bg-green-500" },
  { key: "treatmentCompletionRate", label: "Treatment Completion", max: 100, color: "bg-purple-500" },
  { key: "noShowRate", label: "No-Show Rate", max: 100, color: "bg-red-400", invert: true },
];

function ScoreDisplay({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="text-center">
      <p className={`text-5xl font-black ${color}`}>{score}</p>
      <p className="text-xs text-muted-foreground mt-1">Overall Score</p>
    </div>
  );
}

export default function PerformanceScorecards() {
  const { role, profile } = useAuth();
  const { branches } = useBranches();
  // Branch is read from the global navbar selector. We fall back to the
  // first available branch when admin has "All branches" picked, since the
  // scorecard endpoint requires a single branchId.
  const { branchIdParam } = useBranchScope();
  const isBranchAdmin = role === "BRANCH_ADMIN";
  const canSeeBranchTab = role === "ADMIN" || role === "ADMIN_DOCTOR" || isBranchAdmin;
  const canGenerate = role === "ADMIN" || role === "ADMIN_DOCTOR";
  // Backwards-compat alias used by the older render code below.
  const isAdmin = canSeeBranchTab;

  const [myCards, setMyCards] = useState<PerformanceScorecard[]>([]);
  const [branchCards, setBranchCards] = useState<PerformanceScorecard[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [periodType, setPeriodType] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string>("overallScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    // BRANCH_ADMIN has no Doctor/Therapist profile, so the personal scorecard
    // call would 404 — skip it and land them on the Branch tab instead.
    if (isBranchAdmin) {
      setMyCards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    operationsApi.getMyScorecards({ periodType })
      .then(setMyCards)
      .catch(() => setError("Failed to load your scorecard"))
      .finally(() => setLoading(false));
  }, [periodType, isBranchAdmin]);

  // Resolve the current period string ("2026-04" / "2026-Q2") that the
  // backend filters scorecards by. The previous code mistakenly forwarded
  // periodType ("monthly") here, so the WHERE clause never matched any row
  // and the Branch Overview was always empty even right after a successful
  // generation.
  const currentPeriod = useMemo(() => {
    const now = new Date();
    return periodType === "monthly"
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
      : `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  }, [periodType]);

  useEffect(() => {
    if (!isAdmin || !branchId) return;
    operationsApi.getBranchScorecards(branchId, { period: currentPeriod })
      .then(setBranchCards)
      .catch(() => {});
  }, [branchId, currentPeriod, isAdmin]);

  // Sync from navbar branch scope. Defaults to the first branch when
  // "All branches" is active. BRANCH_ADMIN is hard-pinned to their own
  // branchId regardless of the navbar selection — backend re-enforces this
  // server-side, but we lock it client-side too to keep the UI honest.
  useEffect(() => {
    if (isBranchAdmin) {
      const ownBranch = profile?.branchId ?? null;
      if (ownBranch) setBranchId(ownBranch);
      return;
    }
    if (!isAdmin) return;
    if (branchIdParam) { setBranchId(branchIdParam); return; }
    if ((branches as any[]).length > 0 && !branchId) {
      setBranchId((branches as any[])[0].id);
    }
  }, [branches, isAdmin, isBranchAdmin, profile?.branchId, branchIdParam, branchId]);

  const handleGenerate = async () => {
    if (!branchId) return;
    setGenerating(true);
    try {
      const result = await operationsApi.generateScorecards({ period: currentPeriod, periodType });
      toast.success(`Generated ${result.generated} scorecards`);
      // Refresh branch cards using the same period we just generated for —
      // mismatched period strings here were why the Branch Overview stayed
      // empty after generation.
      const updated = await operationsApi.getBranchScorecards(branchId, { period: currentPeriod });
      setBranchCards(updated);
    } catch {
      toast.error("Failed to generate scorecards");
    } finally {
      setGenerating(false);
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedBranch = [...branchCards].sort((a, b) => {
    const aVal = (a as any)[sortKey] ?? 0;
    const bVal = (b as any)[sortKey] ?? 0;
    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const latest = myCards[0];

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Scorecards...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Performance Scorecards"
          subtitle="Track clinician performance metrics and generate reports."
        >
          <Select value={periodType} onValueChange={setPeriodType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </PageHeader>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <Tabs defaultValue={isBranchAdmin ? "branch" : "my"}>
          <TabsList>
            {!isBranchAdmin && <TabsTrigger value="my">My Scorecard</TabsTrigger>}
            {isAdmin && <TabsTrigger value="branch">Branch Overview</TabsTrigger>}
          </TabsList>

          {/* My Scorecard */}
          <TabsContent value="my" className="mt-6">
            {!latest ? (
              <Card className="border-none shadow-sm">
                <CardContent className="py-12 text-center">
                  <BarChart3 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No scorecard data available yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Overall Score */}
                <Card className="border-none shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Award className="w-5 h-5 text-yellow-500" />
                      Overall Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-4">
                    <ScoreDisplay score={latest.overallScore} />
                    {latest.rank && (
                      <Badge variant="outline" className="text-sm">
                        Rank #{latest.rank}
                      </Badge>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Period: {latest.period} ({latest.periodType})
                    </p>
                    {myCards.length > 1 && (
                      <div className="flex items-center gap-1 text-xs">
                        {latest.overallScore >= myCards[1].overallScore ? (
                          <>
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span className="text-green-600">
                              +{latest.overallScore - myCards[1].overallScore} from last period
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            <span className="text-red-600">
                              {latest.overallScore - myCards[1].overallScore} from last period
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Metrics Bars */}
                <Card className="border-none shadow-sm lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Performance Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {metricLabels.map(m => {
                      const rawVal = (latest as any)[m.key] as number;
                      const displayVal = m.key === "avgPatientRating" ? rawVal.toFixed(1) : rawVal;
                      const pct = m.invert
                        ? Math.max(0, 100 - (rawVal / m.max) * 100)
                        : Math.min(100, (rawVal / m.max) * 100);
                      return (
                        <div key={m.key} className="space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{m.label}</span>
                            <span className="text-muted-foreground font-semibold">
                              {displayVal}{m.key !== "patientsSeenCount" && m.key !== "avgPatientRating" ? "%" : ""}
                              {m.key === "avgPatientRating" ? "/5" : ""}
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-secondary/20 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${m.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-3 border-t space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Avg Consultation</span>
                        <span className="text-muted-foreground">{latest.avgConsultationMins} min</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Prescription Accuracy</span>
                        <span className="text-muted-foreground">{latest.prescriptionAccuracy}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Branch Overview */}
          {isAdmin && (
            <TabsContent value="branch" className="mt-6 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  Branch: <span className="font-semibold text-foreground">
                    {(branches as any[]).find((b: any) => b.id === branchId)?.name || "—"}
                  </span>{" "}
                  <span className="text-xs">(switch via navbar)</span>
                </span>
                {canGenerate && (
                  <Button onClick={handleGenerate} disabled={generating} size="sm">
                    {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Generate Scorecards
                  </Button>
                )}
              </div>

              {/* Home Therapy section — sessions completed / scheduled / on-time / patient rating per therapist */}
              {branchId && <HomeTherapyScorecardsSection branchId={branchId} />}

              {sortedBranch.length === 0 ? (
                <Card className="border-none shadow-sm">
                  <CardContent className="py-12 text-center">
                    <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No scorecard data for this branch and period.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-none shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Clinician</TableHead>
                          {[
                            { key: "overallScore", label: "Score" },
                            { key: "patientsSeenCount", label: "Patients" },
                            { key: "avgPatientRating", label: "Rating" },
                            { key: "onTimeRate", label: "On-Time %" },
                            { key: "treatmentCompletionRate", label: "Completion %" },
                            { key: "noShowRate", label: "No-Show %" },
                            { key: "prescriptionAccuracy", label: "Rx Accuracy" },
                          ].map(col => (
                            <TableHead
                              key={col.key}
                              className="cursor-pointer hover:text-foreground select-none"
                              onClick={() => handleSort(col.key)}
                            >
                              {col.label}
                              {sortKey === col.key && (
                                <span className="ml-1">{sortDir === "desc" ? "\u2193" : "\u2191"}</span>
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedBranch.map(sc => (
                          <TableRow key={sc.id}>
                            <TableCell className="font-medium">{sc.fullName || sc.clinicianId.slice(0, 8)}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  sc.overallScore >= 80 ? "bg-green-50 text-green-700 border-green-300"
                                    : sc.overallScore >= 60 ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                                      : "bg-red-50 text-red-700 border-red-300"
                                }
                              >
                                {sc.overallScore}
                              </Badge>
                            </TableCell>
                            <TableCell>{sc.patientsSeenCount}</TableCell>
                            <TableCell>{sc.avgPatientRating.toFixed(1)}</TableCell>
                            <TableCell>{sc.onTimeRate}%</TableCell>
                            <TableCell>{sc.treatmentCompletionRate}%</TableCell>
                            <TableCell>{sc.noShowRate}%</TableCell>
                            <TableCell>{sc.prescriptionAccuracy}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

/**
 * Home Therapy section for the Branch Overview — one row per therapist
 * with sessions this month, completion rate, average patient feedback
 * rating, and on-time arrival rate (≤ scheduledTime + 15 min).
 *
 * Self-hides when there is no home-therapy activity in the period.
 */
function HomeTherapyScorecardsSection({ branchId }: { branchId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof homeTherapyService.getBranchScorecards>>["rows"]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    homeTherapyService.getBranchScorecards(branchId, "month")
      .then((res) => { if (!cancelled) setRows(res?.rows ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchId]);

  if (loading) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" /> Home Therapy
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </CardContent>
      </Card>
    );
  }
  if (rows.length === 0) return null;

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Home className="w-4 h-4 text-primary" /> Home Therapy — this month
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Therapist</TableHead>
                <TableHead className="text-center">Completed</TableHead>
                <TableHead className="text-center">Scheduled</TableHead>
                <TableHead className="text-center">Completion %</TableHead>
                <TableHead className="text-center">
                  <span className="inline-flex items-center gap-1"><Star className="w-3 h-3" /> Avg Rating</span>
                </TableHead>
                <TableHead className="text-center">
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> On-Time %</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.therapistId}>
                  <TableCell className="font-medium">
                    {r.fullName || r.therapistId.slice(0, 8)}
                    {r.specialization && (
                      <div className="text-[11px] text-muted-foreground">{r.specialization}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{r.completed}</TableCell>
                  <TableCell className="text-center">{r.scheduled}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        r.completionRate >= 80 ? "bg-green-50 text-green-700 border-green-300"
                        : r.completionRate >= 60 ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                        : "bg-red-50 text-red-700 border-red-300"
                      }
                    >
                      {r.completionRate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {r.feedbackCount > 0 ? `${r.avgPatientRating.toFixed(1)} (${r.feedbackCount})` : "—"}
                  </TableCell>
                  <TableCell className="text-center">{r.onTimeRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
