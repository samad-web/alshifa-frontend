import { useEffect, useState } from "react";
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
  Loader2, BarChart3, TrendingUp, TrendingDown, Award, Users, Sparkles,
} from "lucide-react";

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
  const { role } = useAuth();
  const { branches } = useBranches();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";

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
    setLoading(true);
    operationsApi.getMyScorecards({ periodType })
      .then(setMyCards)
      .catch(() => setError("Failed to load your scorecard"))
      .finally(() => setLoading(false));
  }, [periodType]);

  useEffect(() => {
    if (!isAdmin || !branchId) return;
    operationsApi.getBranchScorecards(branchId, { period: periodType })
      .then(setBranchCards)
      .catch(() => {});
  }, [branchId, periodType, isAdmin]);

  // Set default branch
  useEffect(() => {
    if (isAdmin && (branches as any[]).length > 0 && !branchId) {
      setBranchId((branches as any[])[0].id);
    }
  }, [branches, isAdmin, branchId]);

  const handleGenerate = async () => {
    if (!branchId) return;
    setGenerating(true);
    try {
      const now = new Date();
      const period = periodType === "monthly"
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        : `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;
      const result = await operationsApi.generateScorecards({ period, periodType });
      alert(`Generated ${result.generated} scorecards`);
      // Refresh branch cards
      const updated = await operationsApi.getBranchScorecards(branchId, { period: periodType });
      setBranchCards(updated);
    } catch {
      alert("Failed to generate scorecards");
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

        <Tabs defaultValue="my">
          <TabsList>
            <TabsTrigger value="my">My Scorecard</TabsTrigger>
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
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches as any[]).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleGenerate} disabled={generating} size="sm">
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generate Scorecards
                </Button>
              </div>

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
