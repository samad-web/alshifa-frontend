import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Stethoscope } from "lucide-react";
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
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface DoctorPerformance {
  doctorId: string;
  doctorName: string;
  specialization?: string;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  completionRate: number;
  totalPrescriptions: number;
}

export function DoctorPerformanceChart() {
  const [data, setData] = useState<DoctorPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ data: DoctorPerformance[] }>("/api/reports/doctor-performance")
      .then(({ data: result }) => setData(result.data))
      .catch(() => toast.error("Failed to load doctor performance data"))
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
        <Stethoscope className="h-12 w-12 mb-3 opacity-20" />
        <p>No doctor performance data available</p>
      </div>
    );
  }

  const avgCompletion = Math.round(
    data.reduce((s, d) => s + d.completionRate, 0) / data.length
  );

  const chartData = data.slice(0, 15).map((d) => ({
    name: d.doctorName?.split(" ").slice(-1)[0] ?? "Dr.",
    completed: d.completedAppointments,
    cancelled: d.cancelledAppointments,
    rate: d.completionRate,
    prescriptions: d.totalPrescriptions,
  }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-primary/5 border-primary/20">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Total Doctors</p>
          <p className="text-3xl font-black">{data.length}</p>
        </Card>
        <Card className="p-5 bg-wellness/5 border-wellness/20">
          <p className="text-[10px] font-bold text-wellness uppercase tracking-widest mb-2">Avg Completion Rate</p>
          <p className="text-3xl font-black text-wellness">{avgCompletion}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Total Prescriptions</p>
          <p className="text-3xl font-black">
            {data.reduce((s, d) => s + d.totalPrescriptions, 0)}
          </p>
        </Card>
      </div>

      {/* Grouped bar chart */}
      <Card className="p-6">
        <h3 className="font-semibold mb-6">Completed vs Cancelled Appointments</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, name: string) => [
                value,
                name === "completed" ? "Completed" : "Cancelled",
              ]}
            />
            <Legend
              formatter={(value) => (value === "completed" ? "Completed" : "Cancelled")}
            />
            <Bar dataKey="completed" fill="hsl(var(--wellness))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cancelled" fill="hsl(var(--risk))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
              <th className="pb-3 pr-4 font-semibold">Doctor</th>
              <th className="pb-3 pr-4 font-semibold">Specialization</th>
              <th className="pb-3 pr-4 font-semibold">Total</th>
              <th className="pb-3 pr-4 font-semibold">Completed</th>
              <th className="pb-3 pr-4 font-semibold">Cancelled</th>
              <th className="pb-3 pr-4 font-semibold">Rate</th>
              <th className="pb-3 font-semibold">Prescriptions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.doctorId} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-3 pr-4 font-medium">{row.doctorName ?? "—"}</td>
                <td className="py-3 pr-4 text-muted-foreground text-xs">{row.specialization ?? "—"}</td>
                <td className="py-3 pr-4 text-center">{row.totalAppointments}</td>
                <td className="py-3 pr-4 text-center text-wellness font-semibold">{row.completedAppointments}</td>
                <td className="py-3 pr-4 text-center text-risk">{row.cancelledAppointments}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${row.completionRate}%`,
                          background:
                            row.completionRate >= 80
                              ? "hsl(var(--wellness))"
                              : row.completionRate >= 50
                              ? "hsl(var(--attention))"
                              : "hsl(var(--risk))",
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold">{row.completionRate}%</span>
                  </div>
                </td>
                <td className="py-3 text-center">{row.totalPrescriptions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
