import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, FileText } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface MedicationCount {
  medication: string;
  count: number;
}

interface PrescriptionAnalytics {
  total: number;
  topMedications: MedicationCount[];
  byDoctor: Record<string, number>;
}

const SLICE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--wellness))",
  "hsl(var(--attention))",
  "hsl(var(--risk))",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#10b981",
];

export function PrescriptionAnalyticsChart() {
  const [data, setData] = useState<PrescriptionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<{ data: PrescriptionAnalytics }>("/api/reports/prescriptions")
      .then(({ data: result }) => setData(result.data))
      .catch(() => toast.error("Failed to load prescription analytics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileText className="h-12 w-12 mb-3 opacity-20" />
        <p>No prescription data available</p>
      </div>
    );
  }

  const topMeds = data.topMedications.slice(0, 10);
  const byDoctorEntries = Object.entries(data.byDoctor)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-primary/5 border-primary/20">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Total Prescriptions</p>
          <p className="text-3xl font-black">{data.total}</p>
        </Card>
        <Card className="p-5 bg-wellness/5 border-wellness/20">
          <p className="text-[10px] font-bold text-wellness uppercase tracking-widest mb-2">Unique Medications</p>
          <p className="text-3xl font-black text-wellness">{data.topMedications.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Prescribing Clinicians</p>
          <p className="text-3xl font-black">{Object.keys(data.byDoctor).length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top medications bar chart */}
        <Card className="p-6">
          <h3 className="font-semibold mb-6">Top 10 Medications</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={topMeds}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="medication"
                tick={{ fontSize: 10 }}
                width={80}
              />
              <Tooltip formatter={(v: number) => [v, "Prescriptions"]} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* By doctor pie chart */}
        <Card className="p-6">
          <h3 className="font-semibold mb-6">Prescriptions by Clinician</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={byDoctorEntries.map(([name, value]) => ({ name, value }))}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ percent }) => `${Math.round(percent * 100)}%`}
                labelLine={false}
              >
                {byDoctorEntries.map((_, i) => (
                  <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                formatter={(value: string) =>
                  value.length > 18 ? value.slice(0, 18) + "…" : value
                }
              />
              <Tooltip formatter={(v: number, name: string) => [v, name]} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
