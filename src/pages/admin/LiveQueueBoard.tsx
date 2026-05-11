/**
 * Live Queue Board — real-time view of every doctor's queue in the
 * branch for today. Mounted at /admin/live-queue (ADMIN / ADMIN_DOCTOR /
 * SUPER_ADMIN — branch-selectable) and /branch-admin/live-queue
 * (BRANCH_ADMIN — fixed to the user's branch).
 *
 * - Branch-level summary bar across the top (live counts)
 * - One card per doctor on duty today, showing the in-consultation
 *   patient + the ARRIVED waiting list + ABSENT entries with a
 *   "Contact Patient" button
 * - Subscribes to the branch queue room via useQueueSocket; every event
 *   triggers a re-fetch (server is the source of truth for ordering).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useQueueSocket } from "@/hooks/useQueueSocket";
import { queueApi, type LiveBoardResponse, type QueueEntry, type ArrivalStatus } from "@/services/queue.service";
import { AbsentContactModal } from "@/components/queue/AbsentContactModal";
import {
  Clock, UserCheck, PlayCircle, PhoneMissed, Loader2, Stethoscope,
  Users, AlertCircle, CheckCircle2, UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ARRIVAL_BADGE_STYLES: Record<ArrivalStatus, string> = {
  NOT_ARRIVED: "bg-slate-100 text-slate-600 border-slate-200",
  ARRIVED: "bg-amber-100 text-amber-800 border-amber-300",
  IN_CONSULTATION: "bg-teal-100 text-teal-800 border-teal-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  ABSENT: "bg-red-100 text-red-700 border-red-300",
  CONTACTED: "bg-blue-100 text-blue-700 border-blue-300",
};

const ARRIVAL_LABELS: Record<ArrivalStatus, string> = {
  NOT_ARRIVED: "Waiting",
  ARRIVED: "Arrived",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
  ABSENT: "Absent",
  CONTACTED: "Contacted",
};

function ArrivalBadge({ status }: { status: ArrivalStatus }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wide", ARRIVAL_BADGE_STYLES[status])}>
      {ARRIVAL_LABELS[status]}
    </Badge>
  );
}

function useTickingMinutes(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  return tick;
}
function formatElapsed(fromIso: string | null): string {
  if (!fromIso) return "—";
  const ms = Date.now() - new Date(fromIso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export default function LiveQueueBoard() {
  const { profile } = useAuth();
  const { branchIdParam } = useBranchScope();
  const role = profile?.role;

  // BRANCH_ADMIN is fixed to their assigned branch; ADMIN / ADMIN_DOCTOR
  // pick via the navbar branch selector. SUPER_ADMIN follows the same
  // pattern as ADMIN. When the admin selects "All Branches", branchIdParam
  // is empty — pass null and let the backend return cross-branch data.
  const isCrossBranchAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR" || role === "SUPER_ADMIN";
  const branchId = role === "BRANCH_ADMIN"
    ? (profile?.branchId ?? null)
    : (branchIdParam || null);

  const [board, setBoard] = useState<LiveBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [absentTarget, setAbsentTarget] = useState<QueueEntry | null>(null);

  const refresh = useCallback(async () => {
    // Cross-branch admins are allowed to load the board with no branch filter
    // — the backend treats null branchId as "all branches" for those roles.
    if (!branchId && !isCrossBranchAdmin) {
      setLoading(false);
      setBoard(null);
      return;
    }
    setError(null);
    try {
      // When branchId is null we omit it from the params; the backend treats
      // an absent branchId as cross-branch for ADMIN / ADMIN_DOCTOR /
      // SUPER_ADMIN. Sending the literal string "all" used to confuse the
      // empty-state ("No doctors on duty in this branch today").
      const data = await queueApi.getLiveBoard(branchId ? { branchId } : {});
      setBoard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue board");
    } finally {
      setLoading(false);
    }
  }, [branchId, isCrossBranchAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  // Live updates — every queue event for the branch room triggers a
  // server-authoritative re-fetch.
  useQueueSocket({ branchId, onEvent: () => { refresh(); } });

  useTickingMinutes();

  const onMarkArrived = useCallback(async (e: QueueEntry) => {
    try {
      await queueApi.markArrived(e.appointmentId);
      toast.success(`${e.appointment.patient?.fullName || "Patient"} marked as arrived`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark arrived");
    }
  }, [refresh]);

  const onMarkAbsent = useCallback(async (e: QueueEntry) => {
    try {
      await queueApi.markAbsent(e.appointmentId);
      toast.success(`${e.appointment.patient?.fullName || "Patient"} marked as absent`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark absent");
    }
  }, [refresh]);

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <PageHeader
            title="Live Queue Board"
            description="Real-time queue across all doctors on duty today"
          />
        </div>

        {!branchId && !isCrossBranchAdmin ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Select a branch to view its live queue.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : board ? (
          <>
            <SummaryBar summary={board.summary} />
            {board.doctors.length === 0 ? (
              <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
                {branchId
                  ? "No doctors on duty in this branch today."
                  : "No doctors on duty in any branch today."}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {board.doctors.map((d) => (
                  <DoctorCard
                    key={d.doctor.id}
                    entries={d.entries}
                    doctor={d.doctor}
                    onMarkArrived={onMarkArrived}
                    onMarkAbsent={onMarkAbsent}
                    onContact={(e) => setAbsentTarget(e)}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      <AbsentContactModal
        open={!!absentTarget}
        onClose={() => setAbsentTarget(null)}
        entry={absentTarget}
        onContacted={refresh}
        onNoShow={refresh}
      />
    </AppLayout>
  );
}

function SummaryBar({ summary }: { summary: LiveBoardResponse["summary"] }) {
  const items: Array<{ label: string; value: number; tone: string; icon: typeof Users }> = [
    { label: "Scheduled", value: summary.scheduled, tone: "text-slate-700", icon: Users },
    { label: "Arrived", value: summary.arrived, tone: "text-amber-600", icon: UserCheck },
    { label: "In Consultation", value: summary.inConsultation, tone: "text-teal-600", icon: Stethoscope },
    { label: "Completed", value: summary.completed, tone: "text-emerald-600", icon: CheckCircle2 },
    { label: "Absent", value: summary.absent, tone: "text-red-600", icon: AlertCircle },
    { label: "Waiting", value: summary.waiting, tone: "text-amber-600", icon: Clock },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(({ label, value, tone, icon: Icon }) => (
        <div key={label} className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={cn("w-4 h-4", tone)} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</span>
          </div>
          <p className="text-2xl font-bold leading-none">{value}</p>
        </div>
      ))}
    </div>
  );
}

function DoctorCard({
  doctor, entries, onMarkArrived, onMarkAbsent, onContact,
}: {
  doctor: { id: string; fullName: string | null; profilePhoto: string | null; specialization: string | null };
  entries: QueueEntry[];
  onMarkArrived: (e: QueueEntry) => void;
  onMarkAbsent: (e: QueueEntry) => void;
  onContact: (e: QueueEntry) => void;
}) {
  const inConsult = entries.find((e) => e.arrivalStatus === "IN_CONSULTATION");
  const waiting = entries.filter((e) => e.arrivalStatus === "ARRIVED");
  const notArrived = entries.filter((e) => e.arrivalStatus === "NOT_ARRIVED");
  const absent = entries.filter((e) => e.arrivalStatus === "ABSENT" || e.arrivalStatus === "CONTACTED");

  return (
    <div className="rounded-xl border bg-card shadow-card overflow-hidden">
      {/* Doctor header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-3">
        {doctor.profilePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doctor.profilePhoto} alt={doctor.fullName || "Doctor"} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            {(doctor.fullName || "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">Dr. {doctor.fullName || "—"}</p>
          <p className="text-[10px] text-muted-foreground truncate">{doctor.specialization || "Medical Practitioner"}</p>
        </div>
      </div>

      {/* In consultation now */}
      {inConsult ? (
        <div className="px-4 py-3 bg-teal-50/50 border-b border-teal-200">
          <p className="text-[10px] uppercase tracking-wider text-teal-800 font-bold mb-1">Now in consultation</p>
          <p className="text-sm font-semibold">{inConsult.appointment.patient?.fullName || "Patient"}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
            <Clock className="w-3 h-3" />
            Started {formatElapsed(inConsult.consultationStartedAt)} ago
            <span>·</span>
            Scheduled {new Date(inConsult.appointment.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      ) : (
        <div className="px-4 py-2 border-b border-border/50">
          <p className="text-[11px] text-muted-foreground italic">No active consultation.</p>
        </div>
      )}

      {/* Waiting list */}
      <div className="px-4 py-3 max-h-72 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
          Waiting ({waiting.length})
        </p>
        {waiting.length === 0 && notArrived.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">No patients waiting.</p>
        ) : (
          <div className="space-y-1.5">
            {[...waiting, ...notArrived].map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                    {e.queuePosition}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{e.appointment.patient?.fullName || "Patient"}</span>
                      <ArrivalBadge status={e.arrivalStatus} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Sched {new Date(e.appointment.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {e.arrivalStatus === "ARRIVED" && (
                        <> · Waiting {formatElapsed(e.arrivedAt)}</>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {e.arrivalStatus === "NOT_ARRIVED" && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onMarkArrived(e)} title="Mark Arrived">
                        <UserCheck className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50" onClick={() => onMarkAbsent(e)} title="Mark Absent">
                        <UserX className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Absent list */}
      {absent.length > 0 && (
        <div className="px-4 py-3 border-t border-border/50 bg-red-50/40">
          <p className="text-[10px] uppercase tracking-wider text-red-700 font-bold mb-2">
            Needs follow-up ({absent.length})
          </p>
          <div className="space-y-1.5">
            {absent.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{e.appointment.patient?.fullName || "Patient"}</span>
                    <ArrivalBadge status={e.arrivalStatus} />
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Sched {new Date(e.appointment.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {e.contactNote && <> · {e.contactNote}</>}
                  </p>
                </div>
                {e.arrivalStatus === "ABSENT" && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onContact(e)}>
                    <PhoneMissed className="w-3 h-3 mr-1" /> Contact
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
