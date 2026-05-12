// Care Gap Dashboard — admin-doctor / admin operational view of patients
// at risk of falling through the cracks. Fed by GET /api/care-gaps which
// runs the same five detection signals as the cron (no_recent_visit,
// incomplete_triage, low_adherence, wellness_decline, overdue_phase) but
// returns the rows live instead of writing notifications.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Search, ArrowRight, Activity, ClipboardList,
  TrendingDown, Clock, CheckCircle2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface CareGap {
  id: string;
  patientId: string | null;
  patientName: string;
  patientAvatar: string | null;
  gapType: "NO_RECENT_VISIT" | "INCOMPLETE_TRIAGE" | "LOW_ADHERENCE" | "WELLNESS_DECLINE" | "OVERDUE_PHASE";
  severity: "HIGH" | "MEDIUM" | "LOW";
  detectedAt: string;
  detail: string;
  assignedDoctorName: string;
  suggestedAction: string;
}

interface CareGapResponse {
  data: {
    summary: {
      totalGaps: number;
      highSeverity: number;
      mediumSeverity: number;
      lowSeverity: number;
      byType: Record<CareGap["gapType"], number>;
    };
    gaps: CareGap[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  };
}

const GAP_TYPE_LABEL: Record<CareGap["gapType"], string> = {
  NO_RECENT_VISIT: "No Recent Visit",
  INCOMPLETE_TRIAGE: "Incomplete Triage",
  LOW_ADHERENCE: "Low Adherence",
  WELLNESS_DECLINE: "Wellness Decline",
  OVERDUE_PHASE: "Overdue Phase",
};

const GAP_TYPE_TONE: Record<CareGap["gapType"], string> = {
  NO_RECENT_VISIT: "bg-sky-50 text-sky-800 border-sky-200",
  INCOMPLETE_TRIAGE: "bg-violet-50 text-violet-800 border-violet-200",
  LOW_ADHERENCE: "bg-amber-50 text-amber-800 border-amber-200",
  WELLNESS_DECLINE: "bg-rose-50 text-rose-800 border-rose-200",
  OVERDUE_PHASE: "bg-orange-50 text-orange-800 border-orange-200",
};

const GAP_TYPE_ICON: Record<CareGap["gapType"], React.ElementType> = {
  NO_RECENT_VISIT: Clock,
  INCOMPLETE_TRIAGE: ClipboardList,
  LOW_ADHERENCE: Activity,
  WELLNESS_DECLINE: TrendingDown,
  OVERDUE_PHASE: AlertTriangle,
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function avatarTone(seed: string): string {
  // Deterministic pastel based on the patient's name so the same patient
  // gets a consistent chip color across loads.
  const sum = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const tones = [
    "bg-emerald-100 text-emerald-700",
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-teal-100 text-teal-700",
    "bg-indigo-100 text-indigo-700",
  ];
  return tones[sum % tones.length];
}

function rowTone(severity: CareGap["severity"]): string {
  if (severity === "HIGH") return "bg-rose-50/60 hover:bg-rose-50";
  if (severity === "MEDIUM") return "bg-amber-50/40 hover:bg-amber-50";
  return "bg-card hover:bg-muted/40";
}

function severityBadge(severity: CareGap["severity"]) {
  if (severity === "HIGH") return "bg-rose-100 text-rose-800 border-rose-200";
  if (severity === "MEDIUM") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function CareGapDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<CareGapResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [gapType, setGapType] = useState<string>("ALL");
  const [severity, setSeverity] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | undefined> = {};
      if (gapType !== "ALL") params.gapType = gapType;
      if (severity !== "ALL") params.severity = severity;
      const { data: resp } = await apiClient.get<CareGapResponse>("/api/care-gaps", params);
      setData(resp.data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load care gaps");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [gapType, severity]);

  const filteredGaps = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.gaps;
    const q = search.trim().toLowerCase();
    return data.gaps.filter(
      (g) =>
        g.patientName.toLowerCase().includes(q) ||
        g.assignedDoctorName.toLowerCase().includes(q) ||
        g.detail.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-5">
        <PageHeader
          title="🔴 Care Gap Dashboard"
          subtitle="Patients at risk of falling through the cracks"
        />

        {/* Severity summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryStat
            label="Total"
            value={data?.summary.totalGaps ?? 0}
            tone="bg-slate-50 text-slate-800 border-slate-200"
            loading={loading}
          />
          <SummaryStat
            label="High"
            value={data?.summary.highSeverity ?? 0}
            tone="bg-rose-50 text-rose-800 border-rose-200"
            loading={loading}
          />
          <SummaryStat
            label="Medium"
            value={data?.summary.mediumSeverity ?? 0}
            tone="bg-amber-50 text-amber-800 border-amber-200"
            loading={loading}
          />
          <SummaryStat
            label="Low"
            value={data?.summary.lowSeverity ?? 0}
            tone="bg-slate-50 text-slate-700 border-slate-200"
            loading={loading}
          />
        </div>

        {/* Gap type breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(Object.keys(GAP_TYPE_LABEL) as CareGap["gapType"][]).map((t) => {
            const Icon = GAP_TYPE_ICON[t];
            const count = data?.summary.byType[t] ?? 0;
            return (
              <Card
                key={t}
                className={`cursor-pointer transition border ${
                  gapType === t ? "ring-2 ring-primary/40" : ""
                } ${GAP_TYPE_TONE[t]}`}
                onClick={() => setGapType(gapType === t ? "ALL" : t)}
              >
                <CardContent className="p-3 flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wide font-medium opacity-80 truncate">
                      {GAP_TYPE_LABEL[t]}
                    </p>
                    <p className="text-xl font-bold leading-tight">{count}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search patient or doctor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={gapType} onValueChange={setGapType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {(Object.keys(GAP_TYPE_LABEL) as CareGap["gapType"][]).map((t) => (
                <SelectItem key={t} value={t}>{GAP_TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Severity</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredGaps.length === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="text-base font-medium text-foreground">
                No care gaps detected
              </p>
              <p className="text-sm">All patients are on track. 👍</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Patient</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Gap Type</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Severity</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Detail</th>
                    <th className="text-left px-4 py-2.5 font-semibold">Suggested Action</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGaps.map((g) => {
                    const Icon = GAP_TYPE_ICON[g.gapType];
                    const navigable = !!g.patientId;
                    return (
                      <tr
                        key={g.id}
                        className={`group border-t transition ${rowTone(g.severity)} ${navigable ? "cursor-pointer" : ""}`}
                        onClick={navigable ? () => navigate(`/patients/${g.patientId}/timeline`) : undefined}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarTone(g.patientName)}`}
                            >
                              {initials(g.patientName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{g.patientName}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                Dr. {g.assignedDoctorName}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`gap-1 ${GAP_TYPE_TONE[g.gapType]}`}
                          >
                            <Icon className="w-3 h-3" />
                            {GAP_TYPE_LABEL[g.gapType]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={severityBadge(g.severity)}>
                            {g.severity}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-foreground/90">{g.detail}</td>
                        <td className="px-4 py-3 text-muted-foreground italic">
                          {g.suggestedAction}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {g.patientId && (
                            <Button
                              size="sm"
                              variant="outline"
                              // Stop propagation so this click doesn't re-fire
                              // the row-level navigate handler added above.
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/patients/${g.patientId}/timeline`);
                              }}
                              className="gap-1 group-hover:underline"
                            >
                              View
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryStat({
  label, value, tone, loading,
}: { label: string; value: number; tone: string; loading: boolean }) {
  return (
    <Card className={`border ${tone}`}>
      <CardContent className="py-3 px-4">
        <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-12 mt-1" />
        ) : (
          <p className="text-2xl font-bold leading-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
