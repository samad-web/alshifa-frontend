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
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
    Calendar, Pill, Activity, FileText, Clipboard,
    ChevronLeft, Loader2, AlertCircle, RefreshCw
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    APPOINTMENT:  { label: "Appointment",       icon: Calendar,   color: "bg-blue-100 text-blue-700 border-blue-200" },
    PRESCRIPTION: { label: "Prescription",      icon: Pill,       color: "bg-green-100 text-green-700 border-green-200" },
    CHECKIN:      { label: "Daily Check-in",    icon: Activity,   color: "bg-amber-100 text-amber-700 border-amber-200" },
    DOCUMENT:     { label: "Document",          icon: FileText,   color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    MEDICATION:   { label: "Medication Log",    icon: Clipboard,  color: "bg-purple-100 text-purple-700 border-purple-200" },
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

    const fetchTimeline = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, string> = {};
            if (fromDate) params.from = fromDate;
            if (toDate)   params.to   = toDate;
            const { data } = await apiClient.get<TimelineEvent[]>(`/api/patients/${patientId}/timeline`, params);
            setEvents(data);
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

                {/* Filters */}
                <Panel>
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="from">From</Label>
                            <Input
                                id="from"
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label htmlFor="to">To</Label>
                            <Input
                                id="to"
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
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
