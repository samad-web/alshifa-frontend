import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { useBranches } from "@/hooks/useBranches";
import { cn } from "@/lib/utils";

interface ClinicianRow {
  id: string;
  name: string;
  role: "DOCTOR" | "THERAPIST";
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowCount: number;
  avgDailyLoad: number;
  peakDay: string | null;
  appointmentsByWeek: number[];
}

interface WorkloadResponse {
  month: number;
  year: number;
  summary: {
    totalAppointments: number;
    avgPerClinician: number;
    topPerformer: string | null;
    underloadedCount: number;
  };
  clinicians: ClinicianRow[];
  weeklyTotals: number[];
}

type SortKey = "name" | "role" | "totalAppointments" | "completedAppointments" | "cancelledAppointments" | "avgDailyLoad" | "peakDay";

const ROW_PAGE_SIZE = 10;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function WorkloadDistributionChart() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [branchId, setBranchId] = useState<string>("");
  const { branches } = useBranches();

  const [data, setData] = useState<WorkloadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("totalAppointments");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { month: String(month), year: String(year) };
    if (branchId) params.branchId = branchId;
    apiClient
      .get<WorkloadResponse>("/api/reports/workload-distribution", params)
      .then(({ data }) => setData(data))
      .catch((err: Error) => setError(err.message || "Failed to load workload"))
      .finally(() => setLoading(false));
  }, [month, year, branchId]);

  // Reset pagination when the dataset changes underneath us.
  useEffect(() => { setPage(1); }, [month, year, branchId]);

  // Stacked-bar series: { name: 'Week 1', DOCTOR: n, THERAPIST: n }
  const chartData = useMemo(() => {
    if (!data) return [];
    const weekCount = data.weeklyTotals.length;
    const rows = Array.from({ length: weekCount }, (_, w) => ({
      name: `Week ${w + 1}`,
      DOCTOR: 0,
      THERAPIST: 0,
    }));
    for (const c of data.clinicians) {
      c.appointmentsByWeek.forEach((n, w) => {
        if (rows[w]) rows[w][c.role] = (rows[w][c.role] || 0) + n;
      });
    }
    return rows;
  }, [data]);

  const branchAvgDaily = useMemo(() => {
    if (!data || data.clinicians.length === 0) return 0;
    return data.clinicians.reduce((s, c) => s + c.avgDailyLoad, 0) / data.clinicians.length;
  }, [data]);

  const sortedClinicians = useMemo(() => {
    if (!data) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...data.clinicians].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedClinicians.length / ROW_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sortedClinicians.slice((safePage - 1) * ROW_PAGE_SIZE, safePage * ROW_PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortHeader({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) {
    const active = sortKey === k;
    return (
      <th className={cn("px-3 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground", align === "right" && "text-right")}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground font-semibold")}
        >
          {label}
          {active && (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </button>
      </th>
    );
  }

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Monthly Workload Distribution
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-clinician load for {MONTHS[month - 1]} {year}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v, 10))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v, 10))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={branchId || "ALL"} onValueChange={(v) => setBranchId(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All branches" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All branches</SelectItem>
              {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary chips */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : !data || data.summary.totalAppointments === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          No appointments found for {MONTHS[month - 1]} {year}{branchId ? " in the selected branch" : ""}.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <SummaryChip label="Total Appointments" value={data.summary.totalAppointments} />
            <SummaryChip label="Avg per Clinician" value={data.summary.avgPerClinician} />
            <SummaryChip label="Top Performer" value={data.summary.topPerformer || "—"} small />
            <SummaryChip label="Underloaded" value={data.summary.underloadedCount} />
          </div>

          {/* Stacked bar by week */}
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="DOCTOR" stackId="appts" fill="#0D6E6E" name="Doctors" radius={[0, 0, 0, 0]} />
                <Bar dataKey="THERAPIST" stackId="appts" fill="#F59E0B" name="Therapists" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Per-clinician table */}
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <SortHeader k="name"                   label="Clinician" />
                  <SortHeader k="role"                   label="Role" />
                  <SortHeader k="totalAppointments"      label="Total"     align="right" />
                  <SortHeader k="completedAppointments"  label="Completed" align="right" />
                  <SortHeader k="cancelledAppointments"  label="Cancelled" align="right" />
                  <SortHeader k="avgDailyLoad"           label="Avg/Day"   align="right" />
                  <SortHeader k="peakDay"                label="Peak Day" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {pageRows.map((c) => {
                  const tone =
                    branchAvgDaily > 0 && c.avgDailyLoad < branchAvgDaily * 0.6 ? "underloaded"
                    : branchAvgDaily > 0 && c.avgDailyLoad > branchAvgDaily * 1.4 ? "overloaded"
                    : "neutral";
                  const rowClass = tone === "underloaded" ? "bg-amber-50 hover:bg-amber-100/60"
                                 : tone === "overloaded"  ? "bg-rose-50 hover:bg-rose-100/60"
                                 : "hover:bg-muted/20";
                  return (
                    <tr key={`${c.role}-${c.id}`} className={rowClass}>
                      <td className="px-3 py-2 font-medium">{c.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{c.role}</Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.totalAppointments}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.completedAppointments}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.cancelledAppointments}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.avgDailyLoad.toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {c.peakDay ? new Date(c.peakDay).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="px-3 py-2 border-t flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Page {safePage} of {totalPages} · {sortedClinicians.length} clinicians
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function SummaryChip({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-semibold", small ? "text-base truncate" : "text-2xl tabular-nums")}>
        {value}
      </div>
    </div>
  );
}
