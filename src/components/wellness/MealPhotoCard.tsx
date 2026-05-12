// Meal photo card. Five meal slots; each opens the device camera (rear
// camera by default on mobile, falls back to file picker if camera
// access is denied or unavailable). +10 Zen Points per upload, capped at
// 3/day server-side via PATIENT_RATE_LIMITS.MEAL_PHOTO_LOGGED.

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Image as ImageIcon, X, Sunrise, Coffee, UtensilsCrossed, Moon, Apple } from "lucide-react";
import { toast } from "sonner";
import {
  dailyTrackingService,
  type MealPhotoLog,
  type MealType,
} from "@/services/dailyTracking.service";

const MEAL_SLOTS: { value: MealType; label: string; Icon: React.ElementType }[] = [
  { value: "MORNING_EMPTY", label: "Morning (empty)", Icon: Sunrise },
  { value: "BREAKFAST",     label: "Breakfast",       Icon: Coffee },
  { value: "LUNCH",         label: "Lunch",           Icon: UtensilsCrossed },
  { value: "DINNER",        label: "Dinner",          Icon: Moon },
  { value: "SNACK",         label: "Snack",           Icon: Apple },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

interface MealSlotProps {
  meal: { value: MealType; label: string; Icon: React.ElementType };
  log: MealPhotoLog | undefined;
  onUploaded: () => void;
  onPreview: (log: MealPhotoLog) => void;
}

function MealSlot({ meal, log, onUploaded, onPreview }: MealSlotProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!pendingFile) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Pick an image file");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Photo must be under 10MB");
      return;
    }
    setPendingFile(f);
  };

  const upload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      await dailyTrackingService.uploadMealPhoto(meal.value, pendingFile, notes.trim() || undefined);
      // No success toast: the slot's preview block disappears and is
      // replaced inline with the uploaded thumbnail + timestamp + notes.
      // Zen Points total updates via the zen_points_update WebSocket event.
      setPendingFile(null);
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const cancel = () => {
    setPendingFile(null);
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="rounded-lg border border-border/60 p-3 bg-secondary/20 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <meal.Icon className="w-4 h-4 text-amber-600" />
          {meal.label}
        </span>
        {log && (
          <span className="text-[10px] text-muted-foreground">{formatTime(log.loggedAt)}</span>
        )}
      </div>

      {pendingFile && preview ? (
        <div className="space-y-2">
          <div className="relative">
            <img
              src={preview}
              alt="preview"
              className="w-full h-32 object-cover rounded-md border border-border/40"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6 shadow"
              onClick={cancel}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="Any notes? (optional)"
            rows={1}
            className="text-xs"
          />
          <Button size="sm" className="w-full" disabled={uploading} onClick={upload}>
            {uploading ? "Uploading…" : "Upload Photo · +10 Zen Points"}
          </Button>
        </div>
      ) : log?.photoUrl ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onPreview(log)}
            className="block w-full"
          >
            <img
              src={log.photoUrl}
              alt={meal.label}
              className="w-full h-32 object-cover rounded-md border border-border/40 hover:opacity-90 transition-opacity"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </button>
          {log.notes && <p className="text-[11px] text-muted-foreground italic line-clamp-2">{log.notes}</p>}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="w-3.5 h-3.5 mr-1" />
            Replace
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="w-3.5 h-3.5 mr-1" />
          Add Photo
        </Button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPick}
        style={{ display: "none" }}
      />
    </div>
  );
}

export function MealPhotoCard() {
  const [logs, setLogs] = useState<MealPhotoLog[]>([]);
  const [previewLog, setPreviewLog] = useState<MealPhotoLog | null>(null);

  const load = async () => {
    try {
      const { data } = await dailyTrackingService.getMealPhotosToday();
      setLogs(data.logs);
    } catch (err) {
      // empty state
    }
  };

  useEffect(() => { load(); }, []);

  // For each meal slot, pick the most recent matching log.
  const logBySlot: Record<MealType, MealPhotoLog | undefined> = MEAL_SLOTS.reduce(
    (acc, m) => {
      acc[m.value] = logs.find((l) => l.mealType === m.value);
      return acc;
    },
    {} as Record<MealType, MealPhotoLog | undefined>,
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="w-4 h-4 text-amber-600" />
            Meal Photos
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {logs.length} today
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MEAL_SLOTS.map((meal) => (
              <MealSlot
                key={meal.value}
                meal={meal}
                log={logBySlot[meal.value]}
                onUploaded={load}
                onPreview={(l) => setPreviewLog(l)}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            +10 Zen Points per photo · max 3/day
          </p>
        </CardContent>
      </Card>

      <Dialog open={!!previewLog} onOpenChange={(open) => { if (!open) setPreviewLog(null); }}>
        <DialogContent className="max-w-2xl">
          {previewLog && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {MEAL_SLOTS.find((s) => s.value === previewLog.mealType)?.label || previewLog.mealType}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatTime(previewLog.loggedAt)}
                </span>
              </div>
              <img
                src={previewLog.photoUrl ?? undefined}
                alt="meal"
                className="w-full max-h-[70vh] object-contain rounded-md"
              />
              {previewLog.notes && (
                <p className="text-sm text-muted-foreground italic">{previewLog.notes}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
