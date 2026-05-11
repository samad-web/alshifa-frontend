import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { dailyTrackingService, type MealType, type MealPhotoLog } from "@/services/dailyTracking.service";

// Time-aware meal-photo banner. Shows at the top of the patient dashboard
// only when (a) the local clock is inside one of the meal windows below,
// (b) the patient hasn't already uploaded a photo for that meal today, and
// (c) the patient hasn't tapped Skip on this session.
//
// Backed by GET /api/daily-tracking/meal-photos/today + POST /meal-photo —
// no new endpoints. The check-in modal's Step 5 covers the same upload at
// daily-check-in time; this banner just makes the offer ambient when the
// patient lands on the dashboard mid-meal.

const MEAL_WINDOWS: Array<{ mealType: MealType; start: number; end: number; label: string }> = [
  { mealType: "BREAKFAST", start: 7,  end: 10, label: "Breakfast time" },
  { mealType: "LUNCH",     start: 12, end: 14, label: "Lunch time" },
  { mealType: "DINNER",    start: 19, end: 21, label: "Dinner time" },
];

export function MealPhotoBanner() {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [todayPhotos, setTodayPhotos] = useState<MealPhotoLog[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute the active meal window once on mount; the dashboard typically
  // re-mounts on hard navigation so we don't need a 1-Hz tick.
  const activeMeal = useMemo(() => {
    const h = new Date().getHours();
    return MEAL_WINDOWS.find((w) => h >= w.start && h < w.end) ?? null;
  }, []);

  // Pull today's photos so we don't nag a patient who's already logged this
  // meal (e.g. via the check-in modal earlier today).
  useEffect(() => {
    if (!activeMeal) return;
    let cancelled = false;
    dailyTrackingService.getMealPhotosToday()
      .then(({ data }) => { if (!cancelled) setTodayPhotos(data?.logs ?? []); })
      .catch(() => { if (!cancelled) setTodayPhotos([]); });
    return () => { cancelled = true; };
  }, [activeMeal]);

  if (!activeMeal || isDismissed) return null;
  if (todayPhotos?.some((l) => l.mealType === activeMeal.mealType)) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await dailyTrackingService.uploadMealPhoto(activeMeal.mealType, file);
      toast.success(`${activeMeal.label} photo uploaded! +10 Zen Points`);
      setIsDismissed(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setIsUploading(false);
      // Reset the input so picking the same file twice (after a failure)
      // still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 p-3 mb-3 rounded-xl"
      style={{ background: "#E1F5EE", border: "0.5px solid #9FE1CB" }}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: "#0F6E56" }}>
          {activeMeal.label} — add a meal photo?
        </p>
        <p className="text-xs" style={{ color: "#0D6E6E" }}>
          Earn +10 Zen Points
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleUpload}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-60"
          style={{ background: "#0D6E6E", color: "white" }}
        >
          {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          {isUploading ? "Uploading…" : "Take photo"}
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-xs text-gray-500 px-2"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

export default MealPhotoBanner;
