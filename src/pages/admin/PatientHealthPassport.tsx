/**
 * Patient Health Passport — full-detail page for one PatientHistoryRecord.
 *
 * Route: /admin/patient-history/:id
 * Tabs:  Overview · Appointments · Medications · Photos · Full Timeline
 *
 * The record itself is immutable; the only writes from this page are:
 *   - certificate download (read-only)
 *   - resend certificate (no-op on the snapshot — touches delivery state only)
 *   - schedule follow-up (mutates followUpScheduled flag, not clinical data)
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowLeft, Loader2, Download, CalendarPlus, AlertTriangle, CheckCircle2,
    Activity, Pill, Image, Clock, FileText, TrendingDown, TrendingUp,
    Camera, MapPin, FileSignature,
} from "lucide-react";
import { toast } from "sonner";
import {
    patientHistoryService,
    type HistoryDetailResponse,
    type ReturnRiskLevel,
} from "@/services/patientHistory.service";

const RISK_STYLES: Record<ReturnRiskLevel, { card: string; icon: string; label: string }> = {
    LOW:    { card: "bg-green-50 border-green-200",  icon: "text-green-600",  label: "Low return risk" },
    MEDIUM: { card: "bg-amber-50 border-amber-200",  icon: "text-amber-500",  label: "Medium return risk" },
    HIGH:   { card: "bg-red-50 border-red-200",      icon: "text-red-500",    label: "High return risk" },
};

function fmt(d: string | null | undefined): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function PatientHealthPassport() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [data, setData] = useState<HistoryDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [schedulingFollowUp, setSchedulingFollowUp] = useState(false);
    const [generatingCert, setGeneratingCert] = useState(false);

    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await patientHistoryService.getById(id);
                if (!cancelled) setData(res);
            } catch (err) {
                if (!cancelled) {
                    toast.error(err instanceof Error ? err.message : "Failed to load passport");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    const handleDownloadCertificate = useCallback(async () => {
        if (!id) return;
        setDownloading(true);
        try {
            const blob = await patientHistoryService.downloadCertificate(id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `AlShifa-Wellness-Certificate-${data?.record.patient?.fullName || "patient"}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Certificate download failed");
        } finally {
            setDownloading(false);
        }
    }, [id, data]);

    const handleGenerateCertificate = useCallback(async () => {
        if (!id) return;
        setGeneratingCert(true);
        try {
            const res = await patientHistoryService.generateCertificate(id);
            // Merge the updated certificate fields into local state so the
            // button flips from Generate → Download immediately, without a
            // full refetch.
            if (data) {
                setData({ ...data, record: { ...data.record, ...res.record } });
            }
            toast.success("Certificate generated");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to generate certificate");
        } finally {
            setGeneratingCert(false);
        }
    }, [id, data]);

    const handleScheduleFollowUp = useCallback(async () => {
        if (!id) return;
        setSchedulingFollowUp(true);
        try {
            const res = await patientHistoryService.scheduleFollowUp(id);
            if (data) setData({ ...data, record: { ...data.record, ...res.record } });
            toast.success("Follow-up flagged on this passport");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to flag follow-up");
        } finally {
            setSchedulingFollowUp(false);
        }
    }, [id, data]);

    if (loading) {
        return (
            <AppLayout>
                <div className="container max-w-5xl mx-auto px-4 py-8 flex items-center justify-center min-h-[40vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </AppLayout>
        );
    }
    if (!data) {
        return (
            <AppLayout>
                <div className="container max-w-5xl mx-auto px-4 py-8 space-y-4">
                    <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Card>
                        <CardContent className="py-8 text-center text-sm text-muted-foreground">
                            Health passport not found.
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    const { record, appointments, prescriptions, photos } = data;
    const risk = RISK_STYLES[record.returnRiskLevel] || RISK_STYLES.LOW;
    const beforePhotos = photos.filter((p) => p.stage === "BEFORE");
    const afterPhotos  = photos.filter((p) => p.stage === "AFTER");
    const otherPhotos  = photos.filter((p) => p.stage !== "BEFORE" && p.stage !== "AFTER");

    return (
        <AppLayout>
            <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Patient History
                </Button>

                <PageHeader
                    title={record.patient?.fullName || "Patient"}
                    subtitle={`${record.journeyTitle} · Completed ${fmt(record.completedDate)}`}
                >
                    <div className="flex flex-wrap gap-2">
                        {record.certificatePdfPath ? (
                            <Button variant="outline" size="sm" onClick={handleDownloadCertificate} disabled={downloading}>
                                {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                                Download Certificate
                            </Button>
                        ) : (
                            <Button size="sm" onClick={handleGenerateCertificate} disabled={generatingCert}>
                                {generatingCert ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileSignature className="w-4 h-4 mr-1" />}
                                Generate Certificate
                            </Button>
                        )}
                        {record.returnRiskLevel === "HIGH" && !record.followUpScheduled && (
                            <Button size="sm" variant="outline" onClick={handleScheduleFollowUp} disabled={schedulingFollowUp}>
                                {schedulingFollowUp ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CalendarPlus className="w-4 h-4 mr-1" />}
                                Flag Follow-Up
                            </Button>
                        )}
                    </div>
                </PageHeader>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList className="grid grid-cols-5 w-full max-w-2xl">
                        <TabsTrigger value="overview" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> Overview</TabsTrigger>
                        <TabsTrigger value="appointments" className="gap-1.5"><Clock className="w-3.5 h-3.5" /> Appointments</TabsTrigger>
                        <TabsTrigger value="medications" className="gap-1.5"><Pill className="w-3.5 h-3.5" /> Medications</TabsTrigger>
                        <TabsTrigger value="photos" className="gap-1.5"><Image className="w-3.5 h-3.5" /> Photos</TabsTrigger>
                        <TabsTrigger value="timeline" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Timeline</TabsTrigger>
                    </TabsList>

                    {/* ── Overview ─────────────────────────────────────── */}
                    <TabsContent value="overview" className="space-y-4">
                        {/* Outcome stat boxes */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-xs text-muted-foreground uppercase tracking-tight">Pain</div>
                                    <div className="text-2xl font-semibold mt-1 flex items-baseline gap-1">
                                        {record.painAtStart ?? "—"} <span className="text-sm text-muted-foreground">→</span> {record.painAtEnd ?? "—"}
                                    </div>
                                    {record.painReduction !== null && (
                                        <div className="text-xs text-primary mt-1 flex items-center gap-1">
                                            <TrendingDown className="w-3 h-3" /> {record.painReduction}% reduction
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-xs text-muted-foreground uppercase tracking-tight">Wellness</div>
                                    <div className="text-2xl font-semibold mt-1 flex items-baseline gap-1">
                                        {record.wellnessAtStart ?? "—"} <span className="text-sm text-muted-foreground">→</span> {record.wellnessAtEnd ?? "—"}
                                    </div>
                                    {record.wellnessChange !== null && (
                                        <div className={`text-xs mt-1 flex items-center gap-1 ${record.wellnessChange >= 0 ? "text-primary" : "text-red-500"}`}>
                                            <TrendingUp className="w-3 h-3" /> {record.wellnessChange >= 0 ? "+" : ""}{record.wellnessChange}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-xs text-muted-foreground uppercase tracking-tight">Tasks Done</div>
                                    <div className="text-2xl font-semibold mt-1">
                                        {record.completedTasks}/{record.totalTasks}
                                    </div>
                                    {record.taskCompletionRate !== null && (
                                        <div className="text-xs text-muted-foreground mt-1">{record.taskCompletionRate}%</div>
                                    )}
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-xs text-muted-foreground uppercase tracking-tight">Diet Adherence</div>
                                    <div className="text-2xl font-semibold mt-1">
                                        {record.dietAdherencePercent !== null ? `${record.dietAdherencePercent}%` : "—"}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Return risk card */}
                        <Card className={`border-2 ${risk.card}`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <AlertTriangle className={`w-4 h-4 ${risk.icon}`} /> {risk.label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1.5">
                                <div>Risk score: <strong>{record.returnRiskScore}/10</strong></div>
                                {record.returnRiskNotes && (
                                    <div className="text-muted-foreground">{record.returnRiskNotes}</div>
                                )}
                                {record.followUpScheduled && (
                                    <Badge variant="outline" className="mt-1">Follow-up flagged</Badge>
                                )}
                            </CardContent>
                        </Card>

                        {/* Phase timeline */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Treatment Phases</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {(record.journey?.phases ?? []).length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No phase records.</p>
                                ) : (
                                    <ol className="relative border-l-2 border-border ml-3 space-y-4">
                                        {record.journey?.phases.map((phase) => (
                                            <li key={phase.id} className="pl-4">
                                                <span className={`absolute -left-2 w-4 h-4 rounded-full border-2 ${
                                                    phase.status === "COMPLETED"
                                                        ? "bg-primary border-primary"
                                                        : "bg-background border-border"
                                                }`} />
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">{phase.name}</span>
                                                    <Badge variant="outline" className="text-[10px]">{phase.status}</Badge>
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {phase.durationDays} days planned
                                                    {phase.startedAt ? ` · started ${fmt(phase.startedAt)}` : ""}
                                                    {phase.completedAt ? ` · completed ${fmt(phase.completedAt)}` : ""}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {phase.tasks.length} task{phase.tasks.length === 1 ? "" : "s"}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </CardContent>
                        </Card>

                        {/* Demographics + journey meta */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Patient & Journey</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                                <div><span className="text-muted-foreground">Age at completion:</span> {record.patientAge ?? "—"}</div>
                                <div><span className="text-muted-foreground">Gender:</span> {record.patientGender ?? "—"}</div>
                                <div><span className="text-muted-foreground">Prakriti:</span> {record.prakriti ?? "—"}</div>
                                <div><span className="text-muted-foreground">Condition:</span> {record.condition ?? "—"}</div>
                                <div><span className="text-muted-foreground">Start:</span> {fmt(record.startDate)}</div>
                                <div><span className="text-muted-foreground">Completed:</span> {fmt(record.completedDate)}</div>
                                <div><span className="text-muted-foreground">Duration:</span> {record.durationDays} days</div>
                                <div><span className="text-muted-foreground">Branch:</span> {record.branch?.name ?? "—"}</div>
                                <div><span className="text-muted-foreground">Treating doctor:</span> {record.doctor?.fullName ?? "—"}</div>
                                <div><span className="text-muted-foreground">Milestones:</span> {record.achievedMilestones}/{record.totalMilestones}</div>
                                <div><span className="text-muted-foreground">Photos (BEFORE/AFTER):</span> {record.beforePhotosCount}/{record.afterPhotosCount}</div>
                                <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Certificate:</span>
                                    {record.certificateSent ? <Badge variant="outline" className="text-[10px] bg-green-50">Sent</Badge> : <Badge variant="outline" className="text-[10px]">Not sent</Badge>}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ── Appointments ─────────────────────────────────────── */}
                    <TabsContent value="appointments" className="space-y-2">
                        {appointments.length === 0 ? (
                            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No appointments in this journey window.</CardContent></Card>
                        ) : appointments.map((a) => (
                            <Card key={a.id}>
                                <CardContent className="p-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm">
                                            {new Date(a.date).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {a.doctor?.fullName ? `Dr. ${a.doctor.fullName}` : "—"}
                                            {a.consultationType ? ` · ${a.consultationType}` : ""}
                                        </div>
                                        {a.notes && (
                                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.notes}</div>
                                        )}
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    {/* ── Medications ─────────────────────────────────────── */}
                    <TabsContent value="medications" className="space-y-2">
                        {prescriptions.length === 0 ? (
                            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No prescriptions written during this journey.</CardContent></Card>
                        ) : prescriptions.map((p) => (
                            <Card key={p.id}>
                                <CardContent className="p-4 space-y-1">
                                    <div className="font-medium text-sm">{p.medicationName}</div>
                                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                                        <span>{p.dosage}</span>
                                        <span>· {p.frequency}</span>
                                        <span>· {p.duration}</span>
                                    </div>
                                    {p.notes && <div className="text-xs text-muted-foreground italic mt-1">{p.notes}</div>}
                                    <div className="text-[10px] text-muted-foreground/70 mt-1">{fmt(p.createdAt)}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    {/* ── Photos ─────────────────────────────────────── */}
                    <TabsContent value="photos">
                        {photos.length === 0 ? (
                            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
                                <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                No clinical photos for this journey.
                            </CardContent></Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> BEFORE</CardTitle></CardHeader>
                                    <CardContent>
                                        {beforePhotos.length === 0 ? (
                                            <div className="text-sm text-muted-foreground italic">No before-stage photos.</div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                {beforePhotos.map((ph) => (
                                                    <a key={ph.id} href={ph.filePath} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-md overflow-hidden border">
                                                        <img src={ph.filePath} alt={ph.bodyRegion || "Before"} className="w-full h-full object-cover" loading="lazy" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> AFTER</CardTitle></CardHeader>
                                    <CardContent>
                                        {afterPhotos.length === 0 ? (
                                            <div className="text-sm text-muted-foreground italic">No after-stage photos.</div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2">
                                                {afterPhotos.map((ph) => (
                                                    <a key={ph.id} href={ph.filePath} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-md overflow-hidden border">
                                                        <img src={ph.filePath} alt={ph.bodyRegion || "After"} className="w-full h-full object-cover" loading="lazy" />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                                {otherPhotos.length > 0 && (
                                    <Card className="md:col-span-2">
                                        <CardHeader className="pb-2"><CardTitle className="text-base">During-treatment photos</CardTitle></CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-4 gap-2">
                                                {otherPhotos.map((ph) => (
                                                    <a key={ph.id} href={ph.filePath} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-md overflow-hidden border">
                                                        <img src={ph.filePath} alt={ph.bodyRegion || "Photo"} className="w-full h-full object-cover" loading="lazy" />
                                                    </a>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    {/* ── Timeline ─────────────────────────────────────── */}
                    <TabsContent value="timeline" className="space-y-2">
                        <Card>
                            <CardContent className="py-4 text-sm">
                                <p className="text-muted-foreground mb-3">
                                    Chronological feed of all clinical events captured during this journey.
                                </p>
                                <div className="space-y-2">
                                    {appointments.length === 0 && prescriptions.length === 0 && (record.journey?.milestones ?? []).length === 0 ? (
                                        <p className="italic text-muted-foreground">No events recorded.</p>
                                    ) : (
                                        <>
                                            {(record.journey?.milestones ?? []).filter((m) => m.isAchieved || m.achievedAt).map((m) => (
                                                <div key={m.id} className="flex items-start gap-2 border-l-2 border-primary/40 pl-3 py-1">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-medium">Milestone: {m.title}</div>
                                                        <div className="text-xs text-muted-foreground">{fmt(m.achievedAt)}</div>
                                                        {m.description && <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>}
                                                    </div>
                                                </div>
                                            ))}
                                            {appointments.slice(0, 50).map((a) => (
                                                <div key={a.id} className="flex items-start gap-2 border-l-2 border-border pl-3 py-1">
                                                    <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-sm">Appointment · {a.status}</div>
                                                        <div className="text-xs text-muted-foreground">{fmt(a.date)}{a.doctor?.fullName ? ` · Dr. ${a.doctor.fullName}` : ""}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {prescriptions.slice(0, 50).map((p) => (
                                                <div key={p.id} className="flex items-start gap-2 border-l-2 border-border pl-3 py-1">
                                                    <Pill className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="text-sm">Rx: {p.medicationName}</div>
                                                        <div className="text-xs text-muted-foreground">{fmt(p.createdAt)} · {p.dosage} · {p.frequency}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
