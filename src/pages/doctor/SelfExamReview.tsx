import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2, Eye, ClipboardCheck, BadgeCheck,
} from "lucide-react";
import {
  selfExamService,
  type SelfExamBundle,
  type SelfExamSubmission,
  type SelfExamStatus,
  type PainZone,
} from "@/services/selfExam.service";
import { BundleView } from "@/components/selfexam/BundleView";
import { useAuth } from "@/hooks/useAuth";
import { useBranchScope } from "@/hooks/useBranchScope";
import { GroupedByBranch } from "@/components/common/GroupedByBranch";
import { cn } from "@/lib/utils";

function selfExamBranchId(r: any): string | null {
  return r?.branchId
    ?? r?.patient?.user?.branchId
    ?? r?.patient?.branchId
    ?? null;
}
function selfExamBranchName(r: any): string | null {
  return r?.branch?.name
    ?? r?.patient?.user?.branch?.name
    ?? r?.patient?.branch?.name
    ?? null;
}

function shortRef(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();
}

const STATUS_LABELS: Record<SelfExamStatus, string> = {
  DRAFT: "In Progress",
  SUBMITTED: "Completed · awaiting review",
  REVIEWED: "Reviewed",
};

const ZONE_LABELS: Record<PainZone, string> = {
  HEAD_MIGRAINE: "Head / Migraine",
  NECK: "Neck",
  SHOULDER: "Shoulder",
  CHEST: "Chest",
  LOWER_BACK: "Lower Back",
  ABDOMEN: "Abdomen",
  KNEE: "Knee",
  WRIST_HAND: "Wrist & Hand",
  GENERALISED_MUSCLE: "Generalised Muscle",
};

type Row = SelfExamSubmission & { patient?: { id: string; fullName: string | null } };

export default function SelfExamReview() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const { isAll, branchIdParam } = useBranchScope();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<SelfExamStatus>("SUBMITTED");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Forward the navbar branch scope as `branchId` so the backend can
      // narrow ADMIN's hospital-wide list. Non-admin roles (DOCTOR) are
      // already server-scoped by patient assignment regardless of this param.
      const list = await selfExamService.reviewQueue({
        status,
        ...(branchIdParam ? { branchId: branchIdParam } : {}),
      });
      setRows(list as Row[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Couldn't load queue: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [status, branchIdParam]);

  useEffect(() => { load(); }, [load]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Self-Examination Review</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Patient-submitted pre-consultation bundles — tongue, stool,
              urine, range-of-motion, photos, constitution.
            </p>
          </div>
        </div>

        <Tabs value={status} onValueChange={(v) => setStatus(v as SelfExamStatus)}>
          <TabsList>
            <TabsTrigger value="SUBMITTED">Awaiting review</TabsTrigger>
            <TabsTrigger value="REVIEWED">Reviewed</TabsTrigger>
            <TabsTrigger value="DRAFT">In progress</TabsTrigger>
          </TabsList>

          <TabsContent value={status} className="mt-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : (() => {
              // Backend now applies the role-correct scope (DOCTOR ↦ assigned
              // patients, ADMIN/ADMIN_DOCTOR ↦ hospital ± branch narrowing).
              // No client-side branch filter — that path used stale
              // sessionStorage and was the original cause of submissions
              // disappearing from the doctor's queue.
              if (rows.length === 0) {
                return (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      No submissions in this bucket.
                    </CardContent>
                  </Card>
                );
              }
              if (isAdmin && isAll) {
                return (
                  <GroupedByBranch
                    items={rows}
                    getBranchId={selfExamBranchId}
                    getBranchName={selfExamBranchName}
                    renderItem={(r) => <ReviewRow row={r} onOpen={() => setOpenId(r.id)} />}
                  />
                );
              }
              return (
                <div className="space-y-3">
                  {rows.map((r) => <ReviewRow key={r.id} row={r} onOpen={() => setOpenId(r.id)} />)}
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {openId && (
        <ReviewDialog
          submissionId={openId}
          onClose={() => setOpenId(null)}
          onReviewed={() => { setOpenId(null); load(); }}
        />
      )}
    </AppLayout>
  );
}

function IdBlockRow({
  label, value, mono,
}: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn("truncate", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function ReviewRow({ row, onOpen }: { row: Row; onOpen: () => void }) {
  const submittedCount = row.tongueObservations.length + row.stoolLogs.length + row.urineLogs.length
    + row.romMeasurements.length + row.physicalObservations.length + row.symptomHistory.length
    + (row.digestiveProfile ? 1 : 0) + (row.lifestyleContext ? 1 : 0);

  return (
    <Card>
      <CardContent className="pt-4 pb-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="font-medium flex items-center gap-2 flex-wrap">
            {row.patient?.fullName ?? "Patient"}
            <span className="font-mono text-[10px] text-muted-foreground">
              PT:{shortRef(row.patient?.id)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              SE:{shortRef(row.id)}
            </span>
            {row.appointmentId && (
              <span className="font-mono text-[10px] text-muted-foreground">
                APT:{shortRef(row.appointmentId)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            {row.status === "SUBMITTED" && (
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
            )}
            {row.submittedAt
              ? `${STATUS_LABELS[row.status]} · ${new Date(row.submittedAt).toLocaleString()}`
              : `${STATUS_LABELS[row.status]} · started ${new Date(row.createdAt).toLocaleString()}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.painZones.map((z) => (
            <Badge key={z} variant="secondary">{ZONE_LABELS[z]}</Badge>
          ))}
        </div>
        <Badge variant="outline">{submittedCount} observations</Badge>
        <Button variant="outline" size="sm" onClick={onOpen}>
          <Eye className="h-4 w-4 mr-2" /> View
        </Button>
      </CardContent>
    </Card>
  );
}

function ReviewDialog({
  submissionId, onClose, onReviewed,
}: {
  submissionId: string;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const [bundle, setBundle] = useState<SelfExamBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    setLoading(true);
    selfExamService.get(submissionId)
      .then(setBundle)
      .catch((err) => toast.error(`Load failed: ${err instanceof Error ? err.message : String(err)}`))
      .finally(() => setLoading(false));
  }, [submissionId]);

  const markReviewed = async () => {
    setReviewing(true);
    try {
      await selfExamService.review(submissionId, reviewNotes || undefined);
      toast.success("Marked as reviewed");
      onReviewed();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Review failed: ${msg}`);
    } finally {
      setReviewing(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Self-Examination Bundle</DialogTitle>
          <DialogDescription>
            Read-only view of the patient's pre-consultation observations.
          </DialogDescription>
        </DialogHeader>

        {bundle && (
          <div className="rounded-md border bg-muted/40 px-4 py-3 text-xs grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
            <IdBlockRow label="Patient" value={bundle.submission.patient?.fullName ?? "—"} />
            <IdBlockRow label="Patient ID" value={shortRef(bundle.submission.patient?.id)} mono />
            <IdBlockRow label="Submission ref" value={shortRef(bundle.submission.id)} mono />
            <IdBlockRow
              label="Status"
              value={STATUS_LABELS[bundle.submission.status]}
            />
            <IdBlockRow
              label="Submitted"
              value={
                bundle.submission.submittedAt
                  ? new Date(bundle.submission.submittedAt).toLocaleString()
                  : "—"
              }
            />
            {bundle.submission.appointmentId && (
              <IdBlockRow label="Appointment" value={shortRef(bundle.submission.appointmentId)} mono />
            )}
          </div>
        )}

        {loading && <Skeleton className="h-96 w-full" />}
        {bundle && <BundleView bundle={bundle} />}

        {bundle && bundle.submission.status === "SUBMITTED" && (
          <div className="space-y-2 mt-4">
            <Textarea
              placeholder="Optional review notes..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {bundle && bundle.submission.status === "SUBMITTED" && (
            <Button onClick={markReviewed} disabled={reviewing}>
              {reviewing
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <ClipboardCheck className="h-4 w-4 mr-2" />}
              Mark reviewed
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
