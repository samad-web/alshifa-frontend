// Doctor-facing summary of a patient's last 7 days of Sheizen daily
// tracking. Rendered inside PatientTimeline.tsx as a Panel above the
// chronological event list.

import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Activity, Droplet, Image as ImageIcon, Ruler, Loader2 } from "lucide-react";
import { dailyTrackingService, type DoctorTrackingSummary, type MealPhotoLog } from "@/services/dailyTracking.service";

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

export function DailyTrackingPanel({ patientId }: { patientId: string }) {
  const [data, setData] = useState<DoctorTrackingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLog, setPreviewLog] = useState<MealPhotoLog | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await dailyTrackingService.getPatientSummary(patientId);
        if (!cancelled) setData(data);
      } catch (err) {
        // silent — empty-state below
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  // Group water totals by day for the bar chart (last 7 days, oldest first).
  const waterByDay = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const log of data.waterLogs) {
      const k = dateKey(log.date);
      map.set(k, (map.get(k) ?? 0) + log.amount);
    }
    const days: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const k = d.toISOString().slice(0, 10);
      days.push({ date: k, total: map.get(k) ?? 0 });
    }
    return days;
  }, [data]);

  const goalMl = data?.goalMl ?? 2500;
  const maxWater = Math.max(goalMl, ...waterByDay.map((d) => d.total));

  const totalActivityMins = useMemo(
    () => (data?.activityLogs ?? []).reduce((sum, l) => sum + l.durationMins, 0),
    [data],
  );

  const photosByDay = useMemo(() => {
    const out = new Map<string, MealPhotoLog[]>();
    for (const p of data?.mealPhotos ?? []) {
      const k = dateKey(p.date);
      if (!out.has(k)) out.set(k, []);
      out.get(k)!.push(p);
    }
    return Array.from(out.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [data]);

  const latestMeasurement = data?.measurementLogs?.[0] ?? null;

  if (loading) {
    return (
      <Panel>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading daily tracking…
        </div>
      </Panel>
    );
  }

  if (!data) {
    return (
      <Panel>
        <p className="text-sm text-muted-foreground italic">Daily tracking unavailable.</p>
      </Panel>
    );
  }

  const noData =
    data.waterLogs.length === 0 &&
    data.activityLogs.length === 0 &&
    data.measurementLogs.length === 0 &&
    data.mealPhotos.length === 0;

  return (
    <>
      <Panel>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-700" />
            Daily Tracking — Last 7 Days
          </h3>
          {noData && <Badge variant="secondary" className="text-[10px]">No entries</Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ── Water (bar chart) ───────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-sky-500" /> Water Intake
              </p>
              <span className="text-[10px] text-muted-foreground">Goal {goalMl} ml/day</span>
            </div>
            <div className="flex items-end gap-1 h-24">
              {waterByDay.map((d) => {
                const pct = maxWater > 0 ? (d.total / maxWater) * 100 : 0;
                const goalPct = maxWater > 0 ? (goalMl / maxWater) * 100 : 0;
                const hitGoal = d.total >= goalMl;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="relative w-full flex-1 bg-secondary/30 rounded-t-sm">
                      <div
                        className="absolute inset-x-0 border-t border-dashed border-sky-300"
                        style={{ bottom: `${goalPct}%` }}
                      />
                      <div
                        className={"absolute inset-x-0 bottom-0 rounded-t-sm transition-all " + (hitGoal ? "bg-sky-500" : "bg-sky-300")}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground tabular-nums">
                      {formatDateShort(d.date)}
                    </span>
                    <span className="text-[9px] text-foreground tabular-nums">
                      {d.total > 0 ? `${(d.total / 1000).toFixed(1)}L` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Activity ────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-600" /> Activity
              </p>
              <span className="text-[10px] text-muted-foreground">{totalActivityMins} min total</span>
            </div>
            {data.activityLogs.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic py-3">No activity logged.</p>
            ) : (
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {data.activityLogs.slice(0, 8).map((l) => (
                  <li key={l.id} className="text-[11px] flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                      {l.activityType}
                    </Badge>
                    <span className="font-medium tabular-nums">{l.durationMins} min</span>
                    <span className="text-muted-foreground">{formatDateShort(l.date)}</span>
                  </li>
                ))}
                {data.activityLogs.length > 8 && (
                  <li className="text-[10px] text-muted-foreground italic">
                    +{data.activityLogs.length - 8} more
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* ── Measurements ────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-violet-600" /> Body Measurements
              </p>
              {latestMeasurement && (
                <span className="text-[10px] text-muted-foreground">
                  Latest {formatDateShort(latestMeasurement.loggedAt)}
                </span>
              )}
            </div>
            {!latestMeasurement ? (
              <p className="text-[11px] text-muted-foreground italic py-3">No measurements logged.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  ["Arm",    latestMeasurement.arm,    "cm"],
                  ["Chest",  latestMeasurement.chest,  "cm"],
                  ["Waist",  latestMeasurement.waist,  "cm"],
                  ["Hip",    latestMeasurement.hip,    "cm"],
                  ["Thigh",  latestMeasurement.thigh,  "cm"],
                  ["Weight", latestMeasurement.weight, "kg"],
                ].map(([label, value, unit]) => (
                  <div
                    key={label as string}
                    className="rounded border border-border/40 bg-secondary/20 px-2 py-1"
                  >
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="text-xs font-bold tabular-nums">
                      {value === null || value === undefined ? "—" : `${value}${unit}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Meal photos ─────────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-amber-600" /> Meal Photos
              </p>
              <span className="text-[10px] text-muted-foreground">{data.mealPhotos.length} photos</span>
            </div>
            {photosByDay.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic py-3">No meal photos logged.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {photosByDay.map(([day, photos]) => (
                  <div key={day}>
                    <p className="text-[10px] text-muted-foreground mb-1">{formatDateShort(day)}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {photos.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPreviewLog(p)}
                          className="block aspect-square overflow-hidden rounded border border-border/40 hover:opacity-90 transition-opacity"
                        >
                          {p.photoUrl ? (
                            <img
                              src={p.photoUrl}
                              alt={p.mealType}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-full h-full bg-secondary/40 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Dialog open={!!previewLog} onOpenChange={(open) => { if (!open) setPreviewLog(null); }}>
        <DialogContent className="max-w-2xl">
          {previewLog && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{previewLog.mealType}</p>
                <span className="text-xs text-muted-foreground">
                  {new Date(previewLog.loggedAt).toLocaleString()}
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
