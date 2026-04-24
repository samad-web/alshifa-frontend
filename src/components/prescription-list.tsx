import { useState } from "react";
import { Download, FileText, Calendar, ExternalLink, Activity, Ban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
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
    discontinuedAt?: string | null;
    discontinuedReason?: string | null;
    doctor?: {
        fullName?: string;
        user: {
            email: string;
        };
    };
    therapist?: {
        fullName?: string;
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
    const handleDownload = (fileUrl: string) => {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
        const filename = fileUrl.split("/").pop();
        window.open(`${API_BASE_URL}/api/prescriptions/download/${filename}`, "_blank");
    };

    if (!prescriptions?.length) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-xl bg-secondary/5">
                <FileText className="w-12 h-12 text-muted-foreground/20 mb-4" />
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {prescriptions.map((rx) => {
                const prescriber =
                    rx.doctor?.fullName ||
                    rx.therapist?.fullName ||
                    rx.doctor?.user?.email ||
                    rx.therapist?.user?.email ||
                    "Unknown";
                const roleLabel = rx.doctor ? "Doctor" : "Therapist";
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
                                        <p className="text-sm text-muted-foreground">
                                            Prescribed by {prescriber} ({roleLabel})
                                        </p>
                                        {discontinued && rx.discontinuedReason && (
                                            <p className="text-xs text-red-700 mt-1">
                                                Reason: {rx.discontinuedReason}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(rx.createdAt).toLocaleDateString()}
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
