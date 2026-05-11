// Body measurements card. All six fields are optional — patient logs
// whichever ones they actually measured. Trend arrows compare the latest
// row vs the prior one. +10 Zen Points / day on first save (rate-limited
// server-side via MEASUREMENTS_LOGGED).

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Ruler, ArrowDown, ArrowUp, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { dailyTrackingService, type BodyMeasurementLog } from "@/services/dailyTracking.service";

const MEASUREMENT_FIELDS: { key: keyof BodyMeasurementLog; label: string; unit: string }[] = [
  { key: "arm",    label: "Arm",    unit: "cm" },
  { key: "chest",  label: "Chest",  unit: "cm" },
  { key: "waist",  label: "Waist",  unit: "cm" },
  { key: "hip",    label: "Hip",    unit: "cm" },
  { key: "thigh",  label: "Thigh",  unit: "cm" },
  { key: "weight", label: "Weight", unit: "kg" },
];

// For these measurements lower = better (good direction = green DOWN-arrow).
const LOWER_IS_BETTER: Partial<Record<keyof BodyMeasurementLog, boolean>> = {
  waist: true,
  weight: true,
};

type FormState = Record<string, string>;

function trendFor(latest: number | null, previous: number | null) {
  if (latest === null || previous === null) return null;
  const diff = latest - previous;
  if (Math.abs(diff) < 0.05) return { diff: 0, direction: "flat" as const };
  return { diff, direction: diff > 0 ? ("up" as const) : ("down" as const) };
}

export function BodyMeasurementsCard() {
  const [logs, setLogs] = useState<BodyMeasurementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const [notes, setNotes] = useState("");

  const load = async () => {
    try {
      const { data } = await dailyTrackingService.getMeasurementHistory();
      setLogs(data.logs);
    } catch (err) {
      // empty state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const latest = logs[0] ?? null;
  const previous = logs[1] ?? null;

  const trends = useMemo(() => {
    if (!latest) return {};
    const out: Partial<Record<keyof BodyMeasurementLog, ReturnType<typeof trendFor>>> = {};
    for (const f of MEASUREMENT_FIELDS) {
      out[f.key] = trendFor(
        latest[f.key] as number | null,
        previous?.[f.key] as number | null,
      );
    }
    return out;
  }, [latest, previous]);

  const submit = async () => {
    const payload: Record<string, number | string> = {};
    let any = false;
    for (const f of MEASUREMENT_FIELDS) {
      const raw = form[f.key as string];
      if (raw === undefined || raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error(`${f.label} must be a positive number`);
        return;
      }
      payload[f.key as string] = n;
      any = true;
    }
    if (!any) {
      toast.error("Fill at least one measurement");
      return;
    }
    if (notes.trim()) payload.notes = notes.trim();

    setSubmitting(true);
    try {
      await dailyTrackingService.logMeasurements(payload);
      // No success toast: the form collapses, the latest tile updates
      // immediately with the new value + trend arrow vs the previous entry.
      // Zen Points total updates via the zen_points_update WebSocket event.
      setForm({});
      setNotes("");
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save measurements");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-violet-600" />
            Body Measurements
          </span>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              Log New
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-xs text-muted-foreground italic">Loading…</p>
        ) : !latest ? (
          <p className="text-xs text-muted-foreground italic">
            No measurements yet. Tap “Log New” to save your first set.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {MEASUREMENT_FIELDS.map((f) => {
              const value = latest[f.key] as number | null;
              const trend = trends[f.key];
              const lowerBetter = LOWER_IS_BETTER[f.key];
              let trendColor = "text-muted-foreground";
              let TrendIcon: React.ElementType = Minus;
              if (trend && trend.direction !== "flat") {
                TrendIcon = trend.direction === "up" ? ArrowUp : ArrowDown;
                if (lowerBetter) {
                  trendColor = trend.direction === "down" ? "text-emerald-600" : "text-rose-600";
                } else {
                  trendColor = trend.direction === "up" ? "text-emerald-600" : "text-rose-600";
                }
              }
              return (
                <div
                  key={f.key as string}
                  className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {f.label}
                  </p>
                  <p className="text-sm font-bold tabular-nums mt-0.5">
                    {value !== null ? `${value}${f.unit}` : "—"}
                  </p>
                  {trend && trend.direction !== "flat" && (
                    <p className={"flex items-center gap-1 text-[10px] mt-0.5 " + trendColor}>
                      <TrendIcon className="w-3 h-3" />
                      {Math.abs(trend.diff).toFixed(1)}{f.unit} vs last
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showForm && (
          <div className="space-y-3 rounded-lg border border-border/60 p-3 bg-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">New measurements</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { setShowForm(false); setForm({}); setNotes(""); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {MEASUREMENT_FIELDS.map((f) => (
                <div key={f.key as string} className="space-y-1">
                  <Label className="text-xs">{f.label} ({f.unit})</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={0}
                    placeholder="—"
                    value={form[f.key as string] ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [f.key as string]: e.target.value }))
                    }
                    className="h-9"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                rows={2}
                placeholder="Anything notable about this measurement?"
                className="text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                +10 Zen Points · all fields optional
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowForm(false); setForm({}); setNotes(""); }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={submit} disabled={submitting}>
                  Save Measurements
                </Button>
              </div>
            </div>
          </div>
        )}

        {!loading && logs.length > 1 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              Recent entries
            </p>
            <div className="space-y-1">
              {logs.slice(0, 5).map((l) => (
                <div key={l.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {new Date(l.loggedAt).toLocaleDateString()}
                  </span>
                  <span className="text-foreground tabular-nums truncate max-w-[260px] text-right">
                    {MEASUREMENT_FIELDS
                      .filter((f) => (l[f.key] as number | null) !== null)
                      .map((f) => `${f.label[0].toLowerCase()}: ${l[f.key]}${f.unit}`)
                      .join(" · ") || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
