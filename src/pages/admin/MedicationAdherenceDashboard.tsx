// Medication Adherence Dashboard — admin-doctor / admin operational view of
// patient compliance. Fed by GET /api/reports/medication-adherence which
// aggregates MedicationLog rows over the requested window. Used as the
// click target for the "Medication Adherence" stat / report link.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import { Pill, ArrowRight, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Period = "7d" | "30d" | "90d";

interface AdherenceResponse {
  data: {
    summary: {
      overallRate: number;
      totalPatients: number;
      adherentPatients: number;
      atRiskPatients: number;
      nonAdherentPatients: number;
    };
    trend: { date: string; rate: number }[];
    byMedicine: { medicineName: string; adherenceRate: number; patientCount: number }[];
    nonAdherentList: {
      patientId: string;
      patientName: string;
      adherenceRate: number;
      missedDoses: number;
      lastTaken: string | null;
      assignedDoctorName: string;
    }[];
  };
}

function formatLastTaken(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function rowTone(rate: number): string {
  if (rate < 40) return "bg-rose-50/70 hover:bg-rose-50";
  if (rate < 60) return "bg-amber-50/60 hover:bg-amber-50";
  return "bg-card hover:bg-muted/40";
}

function rateBadge(rate: number): string {
  if (rate < 40) return "bg-rose-100 text-rose-800 border-rose-200";
  if (rate < 60) return "bg-amber-100 text-amber-800 border-amber-200";
  if (rate < 80) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

export default function MedicationAdherenceDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AdherenceResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (p: Period) => {
    setLoading(true);
    try {
      const { data: resp } = await apiClient.get<AdherenceResponse>(
        "/api/reports/medication-adherence",
        { period: p },
      );
      setData(resp.data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load adherence data");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(period); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period]);

  const trendChartData = useMemo(
    () => (data?.trend ?? []).map((t) => ({
      date: new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      rate: t.rate,
    })),
    [data],
  );

  const isEmpty =
    !loading &&
    data &&
    data.summary.totalPatients === 0 &&
    data.trend.every((t) => t.rate === 0);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-5">
        <PageHeader
          title="💊 Medication Adherence"
          subtitle="Patient compliance overview for your branch"
        />

        {/* Period switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Period:</span>
          {(["7d", "30d", "90d"] as Period[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "default" : "outline"}
              onClick={() => setPeriod(p)}
            >
              {p === "7d" ? "7 days" : p === "30d" ? "30 days" : "90 days"}
            </Button>
          ))}
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryStat
            label="Overall"
            value={loading ? null : `${data?.summary.overallRate ?? 0}%`}
            tone="bg-teal-50 text-teal-800 border-teal-200"
          />
          <SummaryStat
            label="Adherent (≥80%)"
            value={loading ? null : `${data?.summary.adherentPatients ?? 0} patients`}
            tone="bg-emerald-50 text-emerald-800 border-emerald-200"
          />
          <SummaryStat
            label="At Risk (60–79%)"
            value={loading ? null : `${data?.summary.atRiskPatients ?? 0} patients`}
            tone="bg-amber-50 text-amber-800 border-amber-200"
          />
          <SummaryStat
            label="Non-Adherent (<60%)"
            value={loading ? null : `${data?.summary.nonAdherentPatients ?? 0} patients`}
            tone="bg-rose-50 text-rose-800 border-rose-200"
          />
        </div>

        {isEmpty ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <Pill className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm font-medium text-foreground">
                No medication data found for this period
              </p>
              <p className="text-xs">Try a different range or wait for new logs.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Trend chart */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Pill className="w-4 h-4 text-teal-700" />
                  <p className="text-sm font-semibold">Adherence Trend</p>
                </div>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        stroke="#0D6E6E"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Adherence %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Non-adherent patients table */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <p className="text-sm font-semibold">Non-Adherent Patients</p>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Sorted worst first
                  </span>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (data?.nonAdherentList ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-6 text-center">
                    No non-adherent patients in this period 🎉
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Patient</th>
                          <th className="text-left px-3 py-2 font-semibold">Rate</th>
                          <th className="text-left px-3 py-2 font-semibold">Missed</th>
                          <th className="text-left px-3 py-2 font-semibold">Last Taken</th>
                          <th className="text-left px-3 py-2 font-semibold">Doctor</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.nonAdherentList.map((p) => (
                          <tr
                            key={p.patientId}
                            className={cn("border-t transition", rowTone(p.adherenceRate))}
                          >
                            <td className="px-3 py-3 font-medium">{p.patientName}</td>
                            <td className="px-3 py-3">
                              <Badge variant="outline" className={rateBadge(p.adherenceRate)}>
                                {p.adherenceRate}%
                              </Badge>
                            </td>
                            <td className="px-3 py-3 tabular-nums">{p.missedDoses}</td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {formatLastTaken(p.lastTaken)}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {p.assignedDoctorName}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/patients/${p.patientId}/timeline`)}
                                className="gap-1"
                              >
                                View
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Per-medicine bar chart */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Pill className="w-4 h-4 text-teal-700" />
                  <p className="text-sm font-semibold">Adherence by Medicine</p>
                </div>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (data?.byMedicine ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-6 text-center">
                    No medicine logs yet for this period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(200, (data!.byMedicine.length * 32) + 60)}>
                    <BarChart data={data!.byMedicine} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <YAxis
                        type="category"
                        dataKey="medicineName"
                        tick={{ fontSize: 11 }}
                        width={140}
                      />
                      <Tooltip />
                      <Bar dataKey="adherenceRate" fill="#0D6E6E" name="Adherence %" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function SummaryStat({
  label, value, tone,
}: { label: string; value: string | null; tone: string }) {
  return (
    <Card className={`border ${tone}`}>
      <CardContent className="py-3 px-4">
        <p className="text-[10px] uppercase tracking-wide opacity-80">{label}</p>
        {value === null ? (
          <Skeleton className="h-7 w-20 mt-1" />
        ) : (
          <p className="text-xl font-bold leading-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
