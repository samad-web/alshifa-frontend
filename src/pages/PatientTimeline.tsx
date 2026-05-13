/**
 * PatientTimeline — chronological event history for a patient.
 *
 * Accessible by: ADMIN, ADMIN_DOCTOR, DOCTOR, THERAPIST (any patient)
 *                PATIENT (own timeline only)
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
    Calendar, Pill, Activity, FileText, Clipboard,
    ChevronLeft, Loader2, AlertCircle, RefreshCw, ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { BodyMapPainSelector } from "@/components/shared/BodyMapPainSelector";
import type { CheckInPainRegion, LastPainRegionsResponse } from "@/services/enhancedDashboard.service";
import { healthReportService } from "@/services/healthReport.service";
import { therapistNotesApi, type TherapistSessionNote } from "@/services/therapistNotes.service";

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    APPOINTMENT:    { label: "Appointment",       icon: Calendar,   color: "bg-blue-100 text-blue-700 border-blue-200" },
    PRESCRIPTION:   { label: "Prescription",      icon: Pill,       color: "bg-green-100 text-green-700 border-green-200" },
    CHECKIN:        { label: "Daily Check-in",    icon: Activity,   color: "bg-amber-100 text-amber-700 border-amber-200" },
    DOCUMENT:       { label: "Document",          icon: FileText,   color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    MEDICATION:     { label: "Medication Log",    icon: Clipboard,  color: "bg-purple-100 text-purple-700 border-purple-200" },
    HEALTH_REPORT:  { label: "Health Report",     icon: FileText,   color: "bg-teal-100 text-teal-700 border-teal-200" },
};

interface TimelineEvent {
    id: string;
    type: keyof typeof EVENT_CONFIG;
    date: string;
    title: string;
    subtitle?: string;
    status?: string;
    meta?: Record<string, unknown>;
}

/** Format an ISO timestamp as DD/MM/YYYY HH:MM in the doctor's local time. */
function formatPainMapTimestamp(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

function PainMapSnapshot({ patientId }: { patientId: string }) {
    const [regions, setRegions] = useState<CheckInPainRegion[]>([]);
    const [recordedAt, setRecordedAt] = useState<string | null>(null);
    const [source, setSource] = useState<"check_in" | "triage" | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await apiClient.get<LastPainRegionsResponse>(
                    `/api/patients/${patientId}/pain-map`,
                );
                if (cancelled) return;
                setRegions(Array.isArray(data?.painRegions) ? data.painRegions : []);
                setRecordedAt(data?.recordedAt ?? null);
                setSource(data?.source ?? null);
            } catch {
                // Silent — panel just renders the empty state.
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [patientId]);

    const ts = formatPainMapTimestamp(recordedAt);
    const sourceLabel = source === "check_in" ? "Daily check-in" : source === "triage" ? "Triage session" : null;

    return (
        <Panel>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Latest pain map</h3>
                {ts && (
                    <span className="text-xs text-muted-foreground">
                        Last updated {ts}{sourceLabel ? ` · ${sourceLabel}` : ""}
                    </span>
                )}
            </div>
            {loading ? (
                <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : regions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                    No pain regions logged yet.
                </p>
            ) : (
                <BodyMapPainSelector initialPainRegions={regions} readOnly />
            )}
        </Panel>
    );
}

export default function PatientTimeline() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const patientId = id || user?.patientId;

    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const today = new Date();
    const defaultFrom = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
        .toISOString()
        .split("T")[0];
    const defaultTo = today.toISOString().split("T")[0];

    const [fromDate, setFromDate] = useState(defaultFrom);
    const [toDate, setToDate] = useState(defaultTo);

    // ── HEALTH_REPORT view-pdf handler ───────────────────────────────────
    // Fetches the PDF as a Blob via the auth-injecting apiClient (a direct
    // window.open won't carry the JWT) and opens it in a new tab.
    const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
    const openHealthReport = useCallback(async (reportId: string) => {
        setPdfBusyId(reportId);
        try {
            const blob = await healthReportService.downloadBlob(reportId);
            const url = window.URL.createObjectURL(
                new Blob([blob], { type: "application/pdf" }),
            );
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to open report";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setPdfBusyId(null);
        }
    }, [toast]);

    const fetchTimeline = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, string> = {};
            if (fromDate) params.from = fromDate;
            if (toDate)   params.to   = toDate;
            // Backend wraps the list as { patientId, total, events } — pull `events` out.
            const { data } = await apiClient.get<{ patientId: string; total: number; events: TimelineEvent[] }>(
                `/api/patients/${patientId}/timeline`,
                params
            );
            setEvents(Array.isArray(data?.events) ? data.events : []);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unexpected error";
            setError(msg);
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [patientId, fromDate, toDate, toast]);

    useEffect(() => { fetchTimeline(); }, [fetchTimeline]);

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto space-y-6 p-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <PageHeader
                        title="Patient Timeline"
                        description="Chronological event history across all care activities"
                    />
                </div>

                {/* Pain map snapshot — read-only body diagram showing the
                    patient's most recent pain regions (latest check-in →
                    triage fallback). */}
                {patientId && <PainMapSnapshot patientId={patientId} />}

                {/* Therapist-authored SOAP notes — visible only to
                    clinicians the author opted-in to share with. Hidden
                    for THERAPIST and PATIENT roles (they have other
                    dedicated surfaces). */}
                {patientId && user?.role && ["DOCTOR", "ADMIN_DOCTOR", "ADMIN"].includes(user.role) && (
                    <TherapistNotesSection patientId={patientId} />
                )}

                {/* Filters */}
                <Panel>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="from">From</Label>
                            <DatePicker
                                id="from"
                                value={fromDate}
                                onChange={(iso) => setFromDate(iso)}
                                className="w-40"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="to">To</Label>
                            <DatePicker
                                id="to"
                                value={toDate}
                                onChange={(iso) => setToDate(iso)}
                                className="w-40"
                            />
                        </div>
                        <Button onClick={fetchTimeline} variant="outline" className="flex gap-2">
                            <RefreshCw className="h-4 w-4" /> Refresh
                        </Button>
                    </div>
                </Panel>

                {/* Content */}
                {loading && (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}

                {!loading && error && (
                    <Panel className="flex items-center gap-3 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </Panel>
                )}

                {!loading && !error && events.length === 0 && (
                    <Panel>
                        <p className="text-center text-muted-foreground py-10">
                            No events found in the selected date range.
                        </p>
                    </Panel>
                )}

                {!loading && !error && events.length > 0 && (
                    <div className="relative pl-6">
                        {/* Timeline vertical line */}
                        <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />

                        <div className="space-y-4">
                            {events.map((event) => {
                                const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.APPOINTMENT;
                                const Icon = cfg.icon;
                                return (
                                    <div key={event.id} className="relative">
                                        {/* Timeline dot */}
                                        <div className={`absolute -left-[1.35rem] top-3 h-3 w-3 rounded-full border-2 border-background ring-2 ring-offset-1 ${cfg.color}`} />

                                        <Panel className="ml-2">
                                            <div className="flex justify-between items-start gap-2 flex-wrap">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg border ${cfg.color}`}>
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-xs ${cfg.color}`}
                                                            >
                                                                {cfg.label}
                                                            </Badge>
                                                            {event.status && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {event.status}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="font-medium mt-1">{event.title}</p>
                                                        {event.subtitle && (
                                                            <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                                                        )}
                                                        {event.type === "HEALTH_REPORT" && (() => {
                                                            const reportId = (event.meta?.reportId as string | undefined) || event.id;
                                                            const busy = pdfBusyId === reportId;
                                                            return (
                                                                <Button
                                                                    variant="link"
                                                                    size="sm"
                                                                    className="px-0 mt-1 h-auto text-teal-700 hover:text-teal-800"
                                                                    disabled={busy}
                                                                    onClick={() => openHealthReport(reportId)}
                                                                >
                                                                    {busy ? (
                                                                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                                    ) : (
                                                                        <ExternalLink className="w-3 h-3 mr-1" />
                                                                    )}
                                                                    View Report
                                                                </Button>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">
                                                    {new Date(event.date).toLocaleDateString("en-GB", {
                                                        day: "numeric", month: "short", year: "numeric"
                                                    })}
                                                </span>
                                            </div>
                                        </Panel>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

/**
 * Doctor-side surface for therapist SOAP notes. Lazy-fetches notes the
 * therapist opted to share (isVisibleToDoctor === true on the backend);
 * private notes never surface here. Self-hides while loading and when
 * there's nothing to show so the timeline stays uncluttered.
 */
function TherapistNotesSection({ patientId }: { patientId: string }) {
    const [notes, setNotes] = useState<TherapistSessionNote[] | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        therapistNotesApi
            .list({ patientId })
            .then((rows) => { if (!cancelled) setNotes(rows); })
            .catch((e: unknown) => {
                if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load notes");
            });
        return () => { cancelled = true; };
    }, [patientId]);

    if (notes === null && !err) return null;
    if (err) {
        return (
            <Panel title="Therapist Session Notes" description="SOAP-format notes shared by the patient's therapist">
                <p className="text-sm text-destructive">{err}</p>
            </Panel>
        );
    }
    if (!notes || notes.length === 0) return null;

    const formatNoteDate = (iso: string): string => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "—";
        return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    };

    return (
        <Panel
            title="Therapist Session Notes"
            description="SOAP-format notes the therapist shared with the care team"
        >
            <ul className="space-y-3">
                {notes.map((n) => (
                    <li key={n.id} className="rounded-xl border bg-card p-4 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <Clipboard className="w-4 h-4 text-primary shrink-0" />
                                <span className="font-semibold truncate">
                                    {n.therapist?.fullName ?? "Therapist"}
                                </span>
                                {n.sessionType && (
                                    <Badge variant="outline" className="text-[10px] capitalize">
                                        {n.sessionType.replace("_", " ").toLowerCase()}
                                    </Badge>
                                )}
                                {n.duration != null && (
                                    <span className="text-xs text-muted-foreground">
                                        · {n.duration} min
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                                {formatNoteDate(n.createdAt)}
                            </span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                            {n.subjective && (
                                <p>
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-primary/10 text-primary text-[10px] font-bold mr-1.5">S</span>
                                    <span className="whitespace-pre-wrap text-foreground/90">{n.subjective}</span>
                                </p>
                            )}
                            {n.objective && (
                                <p>
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-primary/10 text-primary text-[10px] font-bold mr-1.5">O</span>
                                    <span className="whitespace-pre-wrap text-foreground/90">{n.objective}</span>
                                </p>
                            )}
                            {n.assessment && (
                                <p>
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-primary/10 text-primary text-[10px] font-bold mr-1.5">A</span>
                                    <span className="whitespace-pre-wrap text-foreground/90">{n.assessment}</span>
                                </p>
                            )}
                            {n.plan && (
                                <p>
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-primary/10 text-primary text-[10px] font-bold mr-1.5">P</span>
                                    <span className="whitespace-pre-wrap text-foreground/90">{n.plan}</span>
                                </p>
                            )}
                            {n.nextSessionPlan && (
                                <p className="text-xs text-muted-foreground italic">
                                    Next session focus: {n.nextSessionPlan}
                                </p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
