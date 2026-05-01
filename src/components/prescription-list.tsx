import { useMemo, useState } from "react";
import { Download, FileText, Calendar, ExternalLink, Activity, Ban, Loader2, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { PrescriptionAdherenceModal } from "@/components/prescription/PrescriptionAdherenceModal";
import { DiscontinuePrescriptionDialog } from "@/components/prescription/DiscontinuePrescriptionDialog";

/**
 * Convert any YouTube URL format to a proper embed URL.
 * Handles: watch?v=, youtu.be/, shorts/, embed/, and extra query params.
 */
function toEmbedUrl(url: string): string {
    try {
        const parsed = new URL(url);
        let videoId: string | null = null;

        if (parsed.hostname.includes('youtube.com')) {
            if (parsed.pathname === '/watch') {
                videoId = parsed.searchParams.get('v');
            } else if (parsed.pathname.startsWith('/embed/')) {
                return url; // already an embed URL
            } else if (parsed.pathname.startsWith('/shorts/')) {
                videoId = parsed.pathname.split('/shorts/')[1]?.split(/[?&/]/)[0];
            }
        } else if (parsed.hostname === 'youtu.be') {
            videoId = parsed.pathname.slice(1).split(/[?&/]/)[0];
        }

        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    } catch { /* not a valid URL, pass through */ }
    return url;
}

interface Prescription {
    id: string;
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes?: string;
    fileUrl?: string;
    videoUrl?: string;
    createdAt: string;
    // Optional link to the appointment that generated this prescription.
    // Used as the primary visit-grouping key when present; otherwise the
    // UI falls back to (calendar day + prescriber name) — same rule the
    // backend applies when bundling the visit PDF.
    appointmentId?: string | null;
    discontinuedAt?: string | null;
    discontinuedReason?: string | null;
    doctor?: {
        fullName?: string;
        qualification?: string | null;
        specialization?: string | null;
        registrationNumber?: string | null;
        user: {
            email: string;
        };
    };
    therapist?: {
        fullName?: string;
        qualification?: string | null;
        specialization?: string | null;
        registrationNumber?: string | null;
        user: {
            email: string;
        };
    };
}

interface PrescriptionListProps {
    prescriptions: Prescription[];
    emptyMessage?: string;
    onChange?: () => void;
}

interface VisitGroup {
    key: string;
    // Anchor row whose id we hand to the backend — the backend rebundles
    // the rest of the visit by appointmentId or (day + prescriber).
    anchor: Prescription;
    prescriptions: Prescription[];
    prescriberLabel: string;
    qualification: string | null;
    specialization: string | null;
    visitDate: string;
}

const CLINICAL_ROLES = new Set(["DOCTOR", "THERAPIST", "ADMIN", "ADMIN_DOCTOR"]);

export function PrescriptionList({
    prescriptions,
    emptyMessage = "No prescriptions available yet.",
    onChange,
}: PrescriptionListProps) {
    const { role } = useAuth();
    const canManage = !!role && CLINICAL_ROLES.has(role);
    const [adherenceFor, setAdherenceFor] = useState<string | null>(null);
    const [discontinueFor, setDiscontinueFor] = useState<{ id: string; name: string } | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const handleDownload = (fileUrl: string) => {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
        const filename = fileUrl.split("/").pop();
        window.open(`${API_BASE_URL}/api/prescriptions/download/${filename}`, "_blank");
    };

    /**
     * Pull a generated-on-the-fly PDF of the visit's full prescription —
     * the backend bundles every medicine prescribed during the same visit
     * into one document, so passing any anchor row from the group yields
     * the same combined PDF. Goes through apiClient.getBlob so the
     * Authorization header is attached and the existing 401-refresh flow
     * still applies.
     */
    const handleDownloadVisitPdf = async (group: VisitGroup) => {
        setDownloadingId(group.key);
        try {
            const blob = await apiClient.getBlob(
                `/api/prescriptions/${group.anchor.id}/pdf`,
            );
            const url = URL.createObjectURL(blob);
            const dateSlug = new Date(group.anchor.createdAt).toISOString().slice(0, 10);
            const a = document.createElement("a");
            a.href = url;
            a.download = `prescription-${dateSlug}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            const msg = err instanceof Error && err.message ? err.message : "Download failed";
            toast.error(msg);
        } finally {
            setDownloadingId(null);
        }
    };

    // Group prescriptions by the visit they came from. Mirrors the
    // backend's PDF bundling rule (appointmentId, then a same-day /
    // same-prescriber fallback) so the on-screen grouping matches the
    // PDF a user gets when they hit Download on the visit header.
    const groups = useMemo<VisitGroup[]>(() => {
        const byKey = new Map<string, VisitGroup>();
        for (const rx of prescriptions) {
            const dateSlug = new Date(rx.createdAt).toISOString().slice(0, 10);
            const prescriberPerson = rx.doctor || rx.therapist;
            const prescriberName =
                prescriberPerson?.fullName ||
                rx.doctor?.user?.email ||
                rx.therapist?.user?.email ||
                "Unknown";
            const namePrefix = rx.doctor ? "Dr. " : "";
            const roleLabel = rx.doctor ? "Doctor" : "Therapist";
            const key = rx.appointmentId
                ? `appt:${rx.appointmentId}`
                : `day:${dateSlug}|${roleLabel}|${prescriberName}`;
            const existing = byKey.get(key);
            if (existing) {
                existing.prescriptions.push(rx);
                if (new Date(rx.createdAt) < new Date(existing.anchor.createdAt)) {
                    existing.anchor = rx;
                    existing.visitDate = new Date(rx.createdAt).toLocaleDateString();
                }
                continue;
            }
            byKey.set(key, {
                key,
                anchor: rx,
                prescriptions: [rx],
                prescriberLabel: `${namePrefix}${prescriberName} (${roleLabel})`,
                qualification: prescriberPerson?.qualification?.trim() || null,
                specialization: prescriberPerson?.specialization?.trim() || null,
                visitDate: new Date(rx.createdAt).toLocaleDateString(),
            });
        }
        const list = Array.from(byKey.values());
        for (const g of list) {
            g.prescriptions.sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
        }
        list.sort(
            (a, b) =>
                new Date(b.anchor.createdAt).getTime() -
                new Date(a.anchor.createdAt).getTime(),
        );
        return list;
    }, [prescriptions]);

    if (!prescriptions?.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-secondary/5">
                <FileText className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {groups.map((group) => {
                const downloading = downloadingId === group.key;
                return (
                    <section key={group.key} className="space-y-3">
                        {/* Visit header — single Download covers every medicine in the visit. */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {group.visitDate}
                                    <span aria-hidden className="opacity-50">·</span>
                                    <span className="text-[11px] normal-case tracking-normal">
                                        {group.prescriptions.length}{" "}
                                        medicine{group.prescriptions.length === 1 ? "" : "s"}
                                    </span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                    <Stethoscope className="w-3.5 h-3.5 text-primary" />
                                    {group.prescriberLabel}
                                    {group.qualification && (
                                        <span className="font-normal text-muted-foreground">
                                            · {group.qualification}
                                        </span>
                                    )}
                                </div>
                                {group.specialization && (
                                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                                        {group.specialization}
                                    </p>
                                )}
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={downloading}
                                onClick={() => handleDownloadVisitPdf(group)}
                                className="gap-2 h-9 text-xs"
                                title="Download the full prescription for this visit"
                            >
                                {downloading
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Download className="w-3.5 h-3.5" />}
                                {downloading ? "Preparing…" : "Download prescription"}
                            </Button>
                        </div>

                        <div className="space-y-3">
                        {group.prescriptions.map((rx) => {
                const discontinued = !!rx.discontinuedAt;

                return (
                    <Card
                        key={rx.id}
                        className={`p-5 hover:shadow-md transition-shadow ${discontinued ? "opacity-70" : ""}`}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-3">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-lg text-foreground">
                                                {rx.medicationName}
                                            </h4>
                                            {discontinued && (
                                                <Badge variant="outline" className="border-red-300 text-red-700 text-[10px]">
                                                    Discontinued
                                                </Badge>
                                            )}
                                        </div>
                                        {discontinued && rx.discontinuedReason && (
                                            <p className="text-xs text-red-700 mt-1">
                                                Reason: {rx.discontinuedReason}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Dosage Info */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Dosage
                                        </p>
                                        <p className="font-semibold text-sm">{rx.dosage}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Frequency
                                        </p>
                                        <p className="font-semibold text-sm">{rx.frequency}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Duration
                                        </p>
                                        <p className="font-semibold text-sm">{rx.duration}</p>
                                    </div>
                                </div>

                                {/* Notes */}
                                {rx.notes && (
                                    <div className="pt-2 border-t border-border/50">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                            Notes
                                        </p>
                                        <p className="text-sm text-foreground/80 leading-relaxed">
                                            {rx.notes}
                                        </p>
                                    </div>
                                )}

                                {/* Video Player */}
                                {rx.videoUrl && (
                                    <div className="pt-4 border-t border-border/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                Educational Video
                                            </p>
                                            <a
                                                href={rx.videoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-primary flex items-center gap-1 hover:underline"
                                            >
                                                Open in new tab <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                        <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-inner relative group">
                                            <iframe
                                                className="w-full h-full"
                                                src={toEmbedUrl(rx.videoUrl)}
                                                title={`Educational video for ${rx.medicationName}`}
                                                frameBorder="0"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                            ></iframe>
                                        </div>
                                    </div>
                                )}

                                {/* File Attachment */}
                                {rx.fileUrl && (
                                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-medium">
                                                Prescription File Attached
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDownload(rx.fileUrl!)}
                                            className="gap-2"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download
                                        </Button>
                                    </div>
                                )}

                                {/* Clinical actions (DOCTOR / THERAPIST / ADMIN / ADMIN_DOCTOR only) */}
                                {canManage && (
                                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-2 h-8 text-xs"
                                            onClick={() => setAdherenceFor(rx.id)}
                                        >
                                            <Activity className="w-3.5 h-3.5" />
                                            Adherence
                                        </Button>
                                        {!discontinued && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-2 h-8 text-xs text-red-700 hover:text-red-800 hover:bg-red-50"
                                                onClick={() => setDiscontinueFor({ id: rx.id, name: rx.medicationName })}
                                            >
                                                <Ban className="w-3.5 h-3.5" />
                                                Discontinue
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                );
            })}
                        </div>
                    </section>
                );
            })}

            <PrescriptionAdherenceModal
                prescriptionId={adherenceFor}
                onClose={() => setAdherenceFor(null)}
            />
            <DiscontinuePrescriptionDialog
                prescriptionId={discontinueFor?.id ?? null}
                medicationName={discontinueFor?.name}
                onClose={() => setDiscontinueFor(null)}
                onDiscontinued={() => { onChange?.(); }}
            />
        </div>
    );
}
