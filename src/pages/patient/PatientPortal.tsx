import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Calendar, Pill, FileText, Download, Search, ChevronLeft, ChevronRight,
  ClipboardList, Activity, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  communicationApi,
  type PaginationInfo,
  type PortalDocument,
  type PortalAppointment,
} from "@/services/communication.service";
import type { Prescription, VisitSummaryEntry } from "@/types";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────

const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  SCHEDULED: "bg-indigo-100 text-indigo-700",
  PENDING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-rose-100 text-rose-700",
  NO_SHOW: "bg-slate-200 text-slate-700",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const DEFAULT_PAGINATION: PaginationInfo = { page: 1, limit: 10, total: 0, totalPages: 1 };

// ── Pagination control ────────────────────────────────────────────────────

function PaginationBar({
  pagination, onPage,
}: { pagination: PaginationInfo; onPage: (p: number) => void }) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-3 px-1">
      <span className="text-xs text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          disabled={pagination.page <= 1}
          onClick={() => onPage(pagination.page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline" size="icon" className="h-7 w-7"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Appointments tab ──────────────────────────────────────────────────────

function AppointmentsTab() {
  const [rows, setRows] = useState<PortalAppointment[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION);
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communicationApi.getMyAppointmentHistory({ page, limit: 10, status });
      setRows(res.data);
      setPagination(res.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          Your full appointment history.
        </p>
        <Select
          value={status}
          onValueChange={(v) => { setStatus(v); setPage(1); }}
        >
          <SelectTrigger className="w-[170px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="UPCOMING">Upcoming</SelectItem>
            <SelectItem value="PAST">Past</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="NO_SHOW">No-show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Calendar className="h-8 w-8" />} text="No appointments to show." />
      ) : (
        <div className="space-y-2">
          {rows.map((a) => {
            const clinician =
              a.doctor?.fullName || a.therapist?.fullName ||
              a.doctor?.user?.name || a.therapist?.user?.name || "—";
            return (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/40 transition-colors"
              >
                <div className="flex flex-col items-center justify-center bg-muted rounded-md p-2 w-14 text-center">
                  <span className="text-[10px] font-medium uppercase text-muted-foreground">
                    {new Date(a.date).toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="text-lg font-bold leading-tight">
                    {new Date(a.date).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium truncate">{clinician}</span>
                    <Badge className={cn("text-[10px] py-0", APPOINTMENT_STATUS_COLORS[a.status] || "bg-gray-100 text-gray-600")}>
                      {a.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {formatTime(a.date)} · {a.consultationType}
                    {a.branch?.name ? ` · ${a.branch.name}` : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar pagination={pagination} onPage={setPage} />
    </div>
  );
}

// ── Prescriptions tab ─────────────────────────────────────────────────────

function PrescriptionsTab() {
  const [rows, setRows] = useState<Prescription[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communicationApi.getMyPrescriptions({ page, limit: 15 });
      setRows(res.prescriptions);
      // Backend may return either `total` or pagination object — synthesize.
      setPagination((prev) => ({
        page,
        limit: 15,
        total: res.total ?? rows.length,
        totalPages: Math.max(1, Math.ceil((res.total ?? rows.length) / 15)),
        ..._unused(prev),
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? rows.filter((r) =>
      r.medicationName.toLowerCase().includes(search.toLowerCase()) ||
      r.dosage.toLowerCase().includes(search.toLowerCase()),
    )
    : rows;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <p className="text-sm text-muted-foreground">
          All prescriptions, newest first.
        </p>
        <div className="relative w-56">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medication"
            className="pl-8 h-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-8 w-8" />}
          text={search ? "No prescriptions match your search." : "No prescriptions yet."}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-background"
            >
              <Pill className="h-5 w-5 text-purple-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.medicationName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.dosage} · {r.frequency} · {r.duration}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">
                  {(r.doctor as { fullName?: string } | undefined)?.fullName ?? "—"}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {formatDate(r.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationBar pagination={pagination} onPage={setPage} />
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────

function DocumentsTab() {
  const [rows, setRows] = useState<PortalDocument[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communicationApi.getMyReports({ page, limit: 15 });
      setRows(res.documents.data);
      setPagination(res.documents.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Reports, lab results, and other files shared with you.
      </p>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileText className="h-8 w-8" />} text="No documents available." />
      ) : (
        <div className="space-y-2">
          {rows.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-teal-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {doc.category}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(doc.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              {doc.fileUrl && (
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0"
                  onClick={() => window.open(doc.fileUrl, "_blank")}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <PaginationBar pagination={pagination} onPage={setPage} />
    </div>
  );
}

// ── Visit Summaries tab ───────────────────────────────────────────────────

interface VisitSummaryRow extends VisitSummaryEntry {
  appointment?: { id: string; date: string; consultationType: string };
}

function VisitSummariesTab() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<VisitSummaryRow[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communicationApi.getMyReports({ page, limit: 15 });
      setRows(res.summaries.data as VisitSummaryRow[]);
      setPagination(res.summaries.pagination);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load visit summaries");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Doctor's notes from each completed visit.
      </p>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-8 w-8" />} text="No visit summaries yet." />
      ) : (
        <div className="space-y-2">
          {rows.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start gap-3 min-w-0">
                <ClipboardList className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {s.diagnosis || s.appointment?.consultationType || "Visit summary"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.appointment?.date ? formatDate(s.appointment.date) : formatDate(s.createdAt)}
                    {s.clinicianName ? ` · ${s.clinicianName}` : ""}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  const apptId = s.appointment?.id || s.appointmentId;
                  navigate(`/visit-summary?appointmentId=${apptId}`);
                }}
              >
                View <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <PaginationBar pagination={pagination} onPage={setPage} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="opacity-40 mb-2">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PatientPortal() {
  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <PageHeader
          title="My Records"
          subtitle="Full history of your appointments, prescriptions, and documents."
        >
          <Activity className="h-5 w-5 text-muted-foreground" />
        </PageHeader>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <Tabs defaultValue="appointments" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="appointments" className="gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Appointments
                </TabsTrigger>
                <TabsTrigger value="prescriptions" className="gap-1.5">
                  <Pill className="h-3.5 w-3.5" /> Prescriptions
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Documents
                </TabsTrigger>
                <TabsTrigger value="summaries" className="gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Visit Summaries
                </TabsTrigger>
              </TabsList>
              <TabsContent value="appointments" className="pt-4"><AppointmentsTab /></TabsContent>
              <TabsContent value="prescriptions" className="pt-4"><PrescriptionsTab /></TabsContent>
              <TabsContent value="documents" className="pt-4"><DocumentsTab /></TabsContent>
              <TabsContent value="summaries" className="pt-4"><VisitSummariesTab /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// Tiny helper used so the prescriptions pagination synthesis remains type-safe.
function _unused<T>(_: T): Record<string, never> { return {}; }
