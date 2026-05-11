import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { dailyTrackingService } from "@/services/dailyTracking.service";

// Sunday-only weekly nudge for body measurements. Auto-opens once per week
// (per ISO week, stored in localStorage) so a patient who taps Skip on
// Sunday morning isn't pestered again on Sunday evening. Saving routes
// through dailyTrackingService.logMeasurements which already awards
// +10 Zen Points via the route layer (rate-limited to 1/day).

function isoWeekKey(date: Date): string {
  // Lightweight ISO week computation — good enough as a localStorage key.
  // We don't need calendar-perfect ISO 8601; just a stable per-week label.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `measurements-popup-${d.getUTCFullYear()}-W${weekNo}`;
}

export function SundayMeasurementsPopup() {
  const today = useMemo(() => new Date(), []);
  const isSunday = today.getDay() === 0;
  const weekKey = useMemo(() => isoWeekKey(today), [today]);

  const [isOpen, setIsOpen] = useState(false);
  const [arm, setArm] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hip, setHip] = useState("");
  const [weight, setWeight] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Auto-show on Sunday if not already shown this week. Delay 3s so the
  // dashboard finishes its initial render and the patient has visual
  // context before the modal slides in.
  useEffect(() => {
    if (!isSunday) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(weekKey)) return;
    const t = window.setTimeout(() => setIsOpen(true), 3000);
    return () => window.clearTimeout(t);
  }, [isSunday, weekKey]);

  const closeWithDismiss = () => {
    try { window.localStorage.setItem(weekKey, "shown"); } catch { /* ignore quota */ }
    setIsOpen(false);
  };

  const handleSave = async () => {
    const fields = { arm, chest, waist, hip, weight };
    const hasAtLeastOne = Object.values(fields).some((v) => v.trim() !== "");
    if (!hasAtLeastOne) {
      toast.error("Please enter at least one measurement");
      return;
    }
    setIsSaving(true);
    try {
      const parse = (v: string) => {
        const t = v.trim();
        if (!t) return undefined;
        const n = parseFloat(t);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      };
      await dailyTrackingService.logMeasurements({
        arm: parse(arm),
        chest: parse(chest),
        waist: parse(waist),
        hip: parse(hip),
        weight: parse(weight),
      });
      toast.success("Measurements saved! +10 Zen Points");
      closeWithDismiss();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const fieldDefs: Array<{ label: string; value: string; set: (v: string) => void }> = [
    { label: "Waist (cm)", value: waist,  set: setWaist },
    { label: "Weight (kg)", value: weight, set: setWeight },
    { label: "Arm (cm)",   value: arm,    set: setArm },
    { label: "Hip (cm)",   value: hip,    set: setHip },
    { label: "Chest (cm)", value: chest,  set: setChest },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) closeWithDismiss(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogDescription className="text-sm font-medium" style={{ color: "#0F6E56" }}>
            Sunday weekly check-in
          </DialogDescription>
          <DialogTitle className="text-base font-semibold">Log your measurements</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2 mb-4">
          Takes 2 minutes · +10 Zen Points · All fields optional
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {fieldDefs.map((field) => (
            <div key={field.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="text-xs text-gray-400 mb-1">{field.label}</div>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                placeholder="—"
                className="w-full bg-transparent text-sm font-medium border-none outline-none"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={closeWithDismiss}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            Skip this week
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-60"
            style={{ background: "#0D6E6E" }}
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isSaving ? "Saving…" : "Save +10 pts"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SundayMeasurementsPopup;
