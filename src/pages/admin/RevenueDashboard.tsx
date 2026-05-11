// Revenue Today dashboard — admin / admin-doctor financial snapshot.
// Powered by GET /api/revenue/today which buckets invoice items into
// appointment / medicine / package, computes hourly totals from Payment.amount,
// and lists recent transactions. Date can be changed via the DD/MM/YYYY
// text input at the top — submits a yyyy-MM-dd query param to the backend.

import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { IndianRupee } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { DateInput, toDDMMYYYY } from "@/components/common/DateInput";

interface RevenueResponse {
  data: {
    today: {
      totalRevenue: number;
      appointmentRevenue: number;
      medicineRevenue: number;
      packageRevenue: number;
      invoiceCount: number;
      paidCount: number;
      pendingCount: number;
    };
    recentTransactions: {
      id: string;
      patientName: string;
      amount: number;
      type: "APPOINTMENT" | "MEDICINE" | "PACKAGE";
      status: string;
      time: string;
    }[];
    hourlyBreakdown: { hour: string; amount: number }[];
  };
}

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function statusBadge(status: string): string {
  const s = status.toUpperCase();
  if (s === "PAID" || s === "COMPLETED") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "PENDING" || s === "UNPAID") return "bg-amber-100 text-amber-800 border-amber-200";
  if (s === "OVERDUE" || s === "FAILED") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function ddmmToISO(ddmm: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmm);
  if (!m) return "";
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function RevenueDashboard() {
  const today = new Date();
  const [dateDDMM, setDateDDMM] = useState(toDDMMYYYY(today));
  const [data, setData] = useState<RevenueResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (ddmm: string) => {
    setLoading(true);
    try {
      const iso = ddmmToISO(ddmm);
      const params = iso ? { date: iso } : {};
      const { data: resp } = await apiClient.get<RevenueResponse>("/api/revenue/today", params);
      setData(resp.data);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load revenue data");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateDDMM)) load(dateDDMM);
  }, [dateDDMM]);

  const hasAnyData = useMemo(() => {
    if (!data) return false;
    return (
      data.today.invoiceCount > 0 ||
      data.recentTransactions.length > 0 ||
      data.hourlyBreakdown.some((h) => h.amount > 0)
    );
  }, [data]);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-7xl space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <PageHeader title="💰 Revenue" subtitle="Financial overview" />
          <div className="w-[180px]">
            <DateInput
              value={dateDDMM}
              onChange={setDateDDMM}
              maxDate={toDDMMYYYY(new Date())}
            />
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryStat
            label="Total"
            value={loading ? null : formatINR(data?.today.totalRevenue ?? 0)}
            tone="bg-teal-50 text-teal-800 border-teal-200"
          />
          <SummaryStat
            label="Appointments"
            value={loading ? null : formatINR(data?.today.appointmentRevenue ?? 0)}
            tone="bg-sky-50 text-sky-800 border-sky-200"
          />
          <SummaryStat
            label="Medicine"
            value={loading ? null : formatINR(data?.today.medicineRevenue ?? 0)}
            tone="bg-violet-50 text-violet-800 border-violet-200"
          />
          <SummaryStat
            label="Packages"
            value={loading ? null : formatINR(data?.today.packageRevenue ?? 0)}
            tone="bg-amber-50 text-amber-800 border-amber-200"
          />
        </div>

        {/* Status chips */}
        {!loading && data && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200">
              Paid: {data.today.paidCount}
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
              Pending: {data.today.pendingCount}
            </Badge>
            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
              Total invoices: {data.today.invoiceCount}
            </Badge>
          </div>
        )}

        {!loading && !hasAnyData ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <IndianRupee className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm font-medium text-foreground">
                No revenue recorded yet
              </p>
              <p className="text-xs">Pick a different date or check back later.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Hourly chart */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <IndianRupee className="w-4 h-4 text-teal-700" />
                  <p className="text-sm font-semibold">Revenue by Hour</p>
                </div>
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data?.hourlyBreakdown ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip formatter={(v: number) => formatINR(v)} />
                      <Bar dataKey="amount" fill="#0D6E6E" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Recent transactions */}
            <Card>
              <CardContent className="py-4">
                <p className="text-sm font-semibold mb-3">Recent Transactions</p>
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : (data?.recentTransactions ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-6 text-center">
                    No transactions for this date.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Patient</th>
                          <th className="text-left px-3 py-2 font-semibold">Amount</th>
                          <th className="text-left px-3 py-2 font-semibold">Type</th>
                          <th className="text-left px-3 py-2 font-semibold">Status</th>
                          <th className="text-left px-3 py-2 font-semibold">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data!.recentTransactions.map((t) => (
                          <tr key={t.id} className="border-t hover:bg-muted/30 transition">
                            <td className="px-3 py-3 font-medium">{t.patientName}</td>
                            <td className="px-3 py-3 tabular-nums">{formatINR(t.amount)}</td>
                            <td className="px-3 py-3">
                              <Badge variant="outline" className="text-[10px]">
                                {t.type}
                              </Badge>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant="outline" className={statusBadge(t.status)}>
                                {t.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">{t.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
          <Skeleton className="h-7 w-24 mt-1" />
        ) : (
          <p className="text-xl font-bold leading-tight tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
