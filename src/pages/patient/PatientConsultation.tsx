import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ArrowLeft, Video, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/app-layout";
import { videoSessionService, type VideoSessionBundle } from "@/services/videoSession.service";
import { ApiClientError } from "@/lib/api-client";

export default function PatientConsultation() {
    const { appointmentId } = useParams<{ appointmentId: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [session, setSession] = useState<VideoSessionBundle | null>(null);

    useEffect(() => {
        if (!appointmentId) {
            setError("Missing appointment id in the URL.");
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const data = await videoSessionService.get(appointmentId);
                if (cancelled) return;
                setSession(data);
            } catch (err) {
                if (cancelled) return;
                setError(messageForError(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [appointmentId]);

    const iframeSrc = session
        ? (session.meetingToken
            ? `${session.url}?t=${encodeURIComponent(session.meetingToken)}`
            : session.url)
        : null;

    return (
        <AppLayout>
            <div className="h-[calc(100vh-4rem)] flex flex-col">
                <div className="border-b border-border/50 bg-card px-4 py-3 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
                            <Video className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-bold text-sm truncate">Video Consultation</h1>
                            <p className="text-[10px] text-muted-foreground truncate">
                                Appointment {appointmentId?.slice(0, 8) ?? ""}
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate("/appointments")}>
                        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                        Leave
                    </Button>
                </div>
                <div className="flex-1 p-4 overflow-hidden bg-secondary/20">
                    {loading && (
                        <Card className="h-full">
                            <CardContent className="h-full flex flex-col items-center justify-center gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground">
                                    Connecting to your consultation room…
                                </p>
                            </CardContent>
                        </Card>
                    )}
                    {!loading && error && (
                        <Card className="h-full">
                            <CardContent className="h-full flex flex-col items-center justify-center gap-3 max-w-md mx-auto text-center">
                                <AlertCircle className="w-10 h-10 text-destructive" />
                                <h2 className="font-bold text-base">Can't join this consultation</h2>
                                <p className="text-sm text-muted-foreground">{error}</p>
                                <Button variant="outline" onClick={() => navigate("/appointments")}>
                                    Back to my appointments
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                    {!loading && !error && iframeSrc && (
                        <div className="h-full bg-black rounded-2xl overflow-hidden">
                            <iframe
                                title="Video consultation"
                                src={iframeSrc}
                                className="w-full h-full border-0"
                                allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
                                allowFullScreen
                            />
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function messageForError(err: unknown): string {
    if (err instanceof ApiClientError) {
        if (err.status === 403) return "This consultation isn't yours to join.";
        if (err.status === 404) return "We couldn't find this appointment.";
        if (err.status === 400) {
            const m = err.message?.toLowerCase() ?? "";
            if (m.includes("expired")) return "This consultation room has expired.";
            if (m.includes("not a video") || m.includes("not online")) return "This is an in-person appointment.";
            if (m.includes("not been provisioned")) return "The video room hasn't been set up yet.";
            return err.message || "This appointment isn't available for video right now.";
        }
        return err.message || "Something went wrong loading your consultation.";
    }
    return "Could not reach the server. Check your connection and try again.";
}
