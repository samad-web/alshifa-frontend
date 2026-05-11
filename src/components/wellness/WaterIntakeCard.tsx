// Water intake card for the patient dashboard.
//
// Shows today's intake against the 2500ml goal as a circular progress
// ring, four quick-add buttons, and a per-entry log strip. The first log
// of the day awards +5 Zen Points (server-rate-limited via WATER_LOGGED).

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Droplet, Plus } from "lucide-react";
import { toast } from "sonner";
import { dailyTrackingService, type WaterTodayResponse } from "@/services/dailyTracking.service";

const QUICK_AMOUNTS = [250, 500, 750];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function WaterIntakeCard() {
  const [data, setData] = useState<WaterTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const customInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    try {
      const { data } = await dailyTrackingService.getWaterToday();
      setData(data);
    } catch (err) {
      // Silent — empty state renders below.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (showCustom) {
      // Microtask focus — Dialog/inline expansion mounts before we can focus.
      setTimeout(() => customInputRef.current?.focus(), 0);
    }
  }, [showCustom]);

  const log = async (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSubmitting(true);
    try {
      const { data: result } = await dailyTrackingService.logWater(amount);
      setData({
        logs: [...(data?.logs ?? []), result.log],
        todayTotal: result.todayTotal,
        goalMl: result.goalMl,
        percentage: result.percentage,
      });
      // No success toast: the ring fills, the chip appears in "Today's logs",
      // and the Zen Points total updates via the existing zen_points_update
      // WebSocket event. Showing a centered Dismiss-modal on every +250ml
      // click was too spammy.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log water");
    } finally {
      setSubmitting(false);
    }
  };

  const submitCustom = async () => {
    const n = Number(customAmount);
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a positive amount in millilitres");
      return;
    }
    await log(Math.round(n));
    setCustomAmount("");
    setShowCustom(false);
  };

  const pct = data?.percentage ?? 0;
  const todayMl = data?.todayTotal ?? 0;
  const goalMl = data?.goalMl ?? 2500;

  // Circular progress ring (SVG). Stroke-dashoffset tracks pct.
  const ringSize = 96;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircum = 2 * Math.PI * ringRadius;
  const ringOffset = useMemo(
    () => ringCircum - (pct / 100) * ringCircum,
    [pct, ringCircum],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Droplet className="w-4 h-4 text-sky-500" />
          Water Intake
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth={ringStroke}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringRadius}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={ringCircum}
                strokeDashoffset={ringOffset}
                style={{ transition: "stroke-dashoffset 400ms ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-sky-700">
              {pct}%
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold tabular-nums">
              {todayMl.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/ {goalMl.toLocaleString()} ml</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pct >= 100
                ? "Goal hit. Keep it gentle from here."
                : `${(goalMl - todayMl).toLocaleString()} ml to go today`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((ml) => (
            <Button
              key={ml}
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => log(ml)}
            >
              +{ml}ml
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => setShowCustom((v) => !v)}
          >
            <Plus className="w-3 h-3 mr-1" /> Custom
          </Button>
        </div>

        {showCustom && (
          <div className="flex items-center gap-2">
            <Input
              ref={customInputRef}
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              placeholder="ml"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submitCustom(); }}
              className="h-9"
            />
            <Button size="sm" disabled={submitting || !customAmount} onClick={submitCustom}>
              Log
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowCustom(false); setCustomAmount(""); }}>
              Cancel
            </Button>
          </div>
        )}

        {!loading && (data?.logs?.length ?? 0) > 0 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Today's logs</p>
            <div className="flex flex-wrap gap-2">
              {data!.logs.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700"
                >
                  <Droplet className="w-3 h-3" />
                  {formatTime(l.loggedAt)} · +{l.amount}ml
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
