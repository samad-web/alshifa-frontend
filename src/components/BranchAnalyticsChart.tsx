import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, Building2 } from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface BranchSummary {
  branchId: string;
  branchName: string;
  address?: string | null;
  totalPatients: number;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  completionRate: number;
  totalDoctors: number;
  totalTherapists: number;
}

export function BranchAnalyticsChart() {
  const [data, setData] = useState<BranchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ data: BranchSummary[] }>("/api/reports/branch-summary")
      .then(({ data: result }) => setData(result.data))
      .catch(() => toast.error("Failed to load branch analytics"))
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
        <Building2 className="h-12 w-12 mb-3 opacity-20" />
        <p>No active branch data available</p>
      </div>
    );
  }

  const barData = data.map((b) => ({
    name: b.branchName,
    Completed: b.completedAppointments,
    Cancelled: b.cancelledAppointments,
    Pending: b.totalAppointments - b.completedAppointments - b.cancelledAppointments,
  }));

  const radarData = [
    { metric: "Patients",     ...Object.fromEntries(data.map((b) => [b.branchName, b.totalPatients])) },
    { metric: "Appointments", ...Object.fromEntries(data.map((b) => [b.branchName, b.totalAppointments])) },
    { metric: "Completed",    ...Object.fromEntries(data.map((b) => [b.branchName, b.completedAppointments])) },
    { metric: "Doctors",      ...Object.fromEntries(data.map((b) => [b.branchName, b.totalDoctors])) },
    { metric: "Therapists",   ...Object.fromEntries(data.map((b) => [b.branchName, b.totalTherapists])) },
  ];

  const BRANCH_COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--wellness))",
    "hsl(var(--attention))",
    "hsl(var(--risk))",
    "#8b5cf6",
    "#06b6d4",
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 bg-primary/5 border-primary/20">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Branches</p>
          <p className="text-2xl font-black">{data.length}</p>
        </Card>
        <Card className="p-4 bg-wellness/5 border-wellness/20">
          <p className="text-[10px] font-bold text-wellness uppercase tracking-widest mb-1">Total Patients</p>
          <p className="text-2xl font-black text-wellness">{data.reduce((s, b) => s + b.totalPatients, 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Appointments</p>
          <p className="text-2xl font-black">{data.reduce((s, b) => s + b.totalAppointments, 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Clinicians</p>
          <p className="text-2xl font-black">{data.reduce((s, b) => s + b.totalDoctors + b.totalTherapists, 0)}</p>
        </Card>
      </div>

      {/* Bar chart: appointment outcomes per branch */}
      <Card className="p-6">
        <h3 className="font-semibold mb-6">Appointment Outcomes by Branch</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} margin={{ top: 5, right: 10, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Completed" stackId="a" fill="hsl(var(--wellness))" />
            <Bar dataKey="Pending" stackId="a" fill="hsl(var(--attention))" />
            <Bar dataKey="Cancelled" stackId="a" fill="hsl(var(--risk))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Radar: multi-branch comparison (only useful for 2+ branches) */}
      {data.length >= 2 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-6">Branch Comparison Radar</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
              {data.map((branch, i) => (
                <Radar
                  key={branch.branchId}
                  name={branch.branchName}
                  dataKey={branch.branchName}
                  stroke={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                  fill={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                  fillOpacity={0.15}
                />
              ))}
              <Legend />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
              <th className="pb-3 pr-4 font-semibold">Branch</th>
              <th className="pb-3 pr-4 font-semibold text-center">Patients</th>
              <th className="pb-3 pr-4 font-semibold text-center">Appointments</th>
              <th className="pb-3 pr-4 font-semibold text-center">Completion %</th>
              <th className="pb-3 pr-4 font-semibold text-center">Doctors</th>
              <th className="pb-3 font-semibold text-center">Therapists</th>
            </tr>
          </thead>
          <tbody>
            {data.map((branch) => (
              <tr key={branch.branchId} className="border-b border-border/40 hover:bg-muted/30">
                <td className="py-3 pr-4">
                  <div>
                    <p className="font-medium">{branch.branchName}</p>
                    {branch.address && <p className="text-xs text-muted-foreground">{branch.address}</p>}
                  </div>
                </td>
                <td className="py-3 pr-4 text-center">{branch.totalPatients}</td>
                <td className="py-3 pr-4 text-center">{branch.totalAppointments}</td>
                <td className="py-3 pr-4 text-center">
                  <span
                    className={
                      branch.completionRate >= 80
                        ? "text-wellness font-bold"
                        : branch.completionRate >= 50
                        ? "text-attention font-bold"
                        : "text-risk font-bold"
                    }
                  >
                    {branch.completionRate}%
                  </span>
                </td>
                <td className="py-3 pr-4 text-center">{branch.totalDoctors}</td>
                <td className="py-3 text-center">{branch.totalTherapists}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
