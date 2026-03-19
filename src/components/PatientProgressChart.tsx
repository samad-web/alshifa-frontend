import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface PatientProgress {
  patientName: string;
  totalSessions: number;
  completedSessions: number;
  progress: number;
  status: string;
  doctorName: string;
}

export function PatientProgressChart() {
  const [data, setData] = useState<PatientProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ data: PatientProgress[] }>("/api/reports/patient-progress")
      .then(({ data: result }) => setData(result.data))
      .catch(() => toast.error("Failed to load patient progress data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Users className="h-12 w-12 mb-3 opacity-20" />
        <p>No patient journey data available</p>
      </div>
    );
  }

  const avgProgress = Math.round(data.reduce((s, d) => s + d.progress, 0) / data.length);
  const chartData = data.slice(0, 20).map((d) => ({
    name: d.patientName?.split(" ")[0] ?? "Patient",
    progress: d.progress,
    completed: d.completedSessions,
    total: d.totalSessions,
    status: d.status,
  }));

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-primary/5 border-primary/20">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Total Journeys</p>
          <p className="text-3xl font-black">{data.length}</p>
        </Card>
        <Card className="p-5 bg-wellness/5 border-wellness/20">
          <p className="text-[10px] font-bold text-wellness uppercase tracking-widest mb-2">Avg Progress</p>
          <p className="text-3xl font-black text-wellness">{avgProgress}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Active Journeys</p>
          <p className="text-3xl font-black">
            {data.filter((d) => d.status === "ACTIVE").length}
          </p>
        </Card>
      </div>

      {/* Bar chart */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Session Completion Rate by Patient</h3>
          <span className="text-xs text-muted-foreground ml-auto">Showing top 20</span>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-40}
              textAnchor="end"
              interval={0}
            />
            <YAxis unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
            <Tooltip
              formatter={(value: number, _name: string, props: { payload?: { completed?: number; total?: number } }) => [
                `${value}% (${props.payload?.completed ?? 0}/${props.payload?.total ?? 0} sessions)`,
                "Progress",
              ]}
            />
            <Bar dataKey="progress" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.progress >= 75 ? "hsl(var(--wellness))" : entry.progress >= 40 ? "hsl(var(--attention))" : "hsl(var(--risk))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-wellness inline-block" />≥75% complete</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-attention inline-block" />40–74%</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-risk inline-block" />&lt;40%</span>
        </div>
      </Card>

      {/* Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
              <th className="pb-3 pr-4 font-semibold">Patient</th>
              <th className="pb-3 pr-4 font-semibold">Doctor</th>
              <th className="pb-3 pr-4 font-semibold">Sessions</th>
              <th className="pb-3 pr-4 font-semibold">Progress</th>
              <th className="pb-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 15).map((row, i) => (
              <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-3 pr-4 font-medium">{row.patientName ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{row.doctorName ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {row.completedSessions}/{row.totalSessions}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${row.progress}%`,
                          background: row.progress >= 75 ? "hsl(var(--wellness))" : row.progress >= 40 ? "hsl(var(--attention))" : "hsl(var(--risk))",
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold">{row.progress}%</span>
                  </div>
                </td>
                <td className="py-3">
                  <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
