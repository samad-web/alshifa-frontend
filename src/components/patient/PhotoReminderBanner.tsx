import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { apiClient } from "@/lib/api-client";
import { JourneyPhotoUpload } from "./JourneyPhotoUpload";
import { cn } from "@/lib/utils";

interface PhotoReminderPayload {
  journeyId: string;
  phaseId: string;
  phaseName: string;
}

interface NotificationRow {
  id: string;
  type: string;
  data?: PhotoReminderPayload;
  createdAt: string;
}

const STORAGE_KEY = "photoReminder.dismissed";

/**
 * Persistent teal banner that nudges patients to upload a progress photo
 * for their current journey phase. Sources of truth (in priority order):
 *
 *   1. Live socket event 'photo_reminder' — fires on phase activation OR
 *      on the daily 9 AM sweep.
 *   2. The most recent unread PHOTO_REMINDER notification on mount.
 *
 * Dismissal is per-(journey, phase) and persisted in localStorage so a
 * patient who dismisses today's nudge isn't shown the same one tomorrow
 * just because the daily job fired again — they get a fresh banner only
 * when the *phase* changes or they upload a photo.
 */
export function PhotoReminderBanner() {
  const { socket } = useWebSocket();
  const [active, setActive] = useState<PhotoReminderPayload | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Resolve Patient.id once. ClinicalPhoto upload keys on Patient.id, not User.id.
  useEffect(() => {
    apiClient
      .get<{ patient?: { id: string } | null }>("/api/user/me")
      .then(({ data }) => setPatientId(data.patient?.id ?? null))
      .catch(() => setPatientId(null));
  }, []);

  // Backfill: catch the most recent unread PHOTO_REMINDER notification on mount.
  useEffect(() => {
    apiClient
      .get<{ notifications: NotificationRow[] } | NotificationRow[]>("/api/notifications", { limit: 20 })
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : data.notifications ?? [];
        const reminder = list.find((n) => n.type === "PHOTO_REMINDER" && n.data?.phaseId);
        if (reminder?.data) {
          maybeShow(reminder.data);
        }
      })
      .catch(() => { /* silent — banner is best-effort */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live socket event.
  useEffect(() => {
    if (!socket) return;
    const handler = (payload: PhotoReminderPayload) => maybeShow(payload);
    socket.on("photo_reminder", handler);
    return () => { socket.off("photo_reminder", handler); };
  }, [socket]);

  function maybeShow(payload: PhotoReminderPayload) {
    if (!payload?.phaseId || !payload?.journeyId) return;
    const dismissedKey = dismissalKey(payload);
    if (typeof window !== "undefined" && localStorage.getItem(dismissedKey)) return;
    setActive(payload);
  }

  function dismissalKey(p: PhotoReminderPayload) {
    return `${STORAGE_KEY}:${p.journeyId}:${p.phaseId}`;
  }

  function dismiss() {
    if (active) localStorage.setItem(dismissalKey(active), "1");
    setActive(null);
  }

  function handleUploaded() {
    // After a successful upload, drop the banner and remember the dismissal
    // so the daily sweep doesn't re-summon it for the same phase.
    if (active) localStorage.setItem(dismissalKey(active), "1");
    setActive(null);
  }

  if (!active) return null;

  return (
    <>
      <div className={cn(
        "rounded-2xl border border-primary/30 bg-primary/10 text-foreground shadow-sm",
        "p-4 flex items-center gap-3 flex-wrap",
      )}>
        <Camera className="w-6 h-6 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Your doctor wants to see your progress!</p>
          <p className="text-xs text-muted-foreground">
            Tap to upload a photo for your current phase: <span className="font-medium">{active.phaseName}</span>
          </p>
        </div>
        <Button size="sm" disabled={!patientId} onClick={() => setUploadOpen(true)}>
          Upload Now
        </Button>
        <Button size="icon" variant="ghost" onClick={dismiss} aria-label="Dismiss reminder">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {patientId && (
        <JourneyPhotoUpload
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          patientId={patientId}
          journeyId={active.journeyId}
          phaseId={active.phaseId}
          phaseName={active.phaseName}
          onUploaded={handleUploaded}
        />
      )}
    </>
  );
}
