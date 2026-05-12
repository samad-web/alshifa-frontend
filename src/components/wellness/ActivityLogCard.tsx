// Activity log card. Patient picks a type pill + duration, optionally
// adds a note, and logs the session. Server caps at 3 awards/day via
// PATIENT_RATE_LIMITS.ACTIVITY_LOGGED (10 pts each).

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Activity, PersonStanding, Zap, Dumbbell, Brain, Footprints, Wind, Star,
} from "lucide-react";
import { toast } from "sonner";
import {
  dailyTrackingService,
  type ActivityLog,
  type ActivityType,
} from "@/services/dailyTracking.service";

const ACTIVITY_TYPES: { value: ActivityType; label: string; Icon: React.ElementType }[] = [
  { value: "YOGA",        label: "Yoga",         Icon: PersonStanding },
  { value: "AEROBIC",     label: "Aerobic",      Icon: Zap },
  { value: "STRENGTH",    label: "Strength",     Icon: Dumbbell },
  { value: "FLEXIBILITY", label: "Flexibility",  Icon: Star },
  { value: "MEDITATION",  label: "Meditation",   Icon: Brain },
  { value: "WALKING",     label: "Walking",      Icon: Footprints },
  { value: "PRANAYAMA",   label: "Pranayama",    Icon: Wind },
  { value: "OTHER",       label: "Other",        Icon: Activity },
];

const ICONS_BY_TYPE = ACTIVITY_TYPES.reduce<Record<ActivityType, React.ElementType>>(
  (acc, t) => { acc[t.value] = t.Icon; return acc; },
  {} as Record<ActivityType, React.ElementType>,
);

const QUICK_DURATIONS = [15, 30, 60];

export function ActivityLogCard() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [type, setType] = useState<ActivityType | "">("");
  const [duration, setDuration] = useState<number>(30);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    try {
      const { data } = await dailyTrackingService.getActivityToday();
      setLogs(data.logs);
      setTotalMinutes(data.totalMinutes);
    } catch (err) {
      // empty state
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!type) {
      toast.error("Pick an activity type first");
      return;
    }
    const dur = showCustomDuration ? Number(customDuration) : duration;
    if (!Number.isFinite(dur) || dur <= 0) {
      toast.error("Duration must be greater than zero");
      return;
    }
    setSubmitting(true);
    try {
      await dailyTrackingService.logActivity({
        activityType: type,
        durationMins: Math.round(dur),
        notes: notes.trim() || undefined,
      });
      // No success toast: the new session appears immediately in
      // "Today's sessions" with type, duration, and points. Zen Points
      // total updates via the zen_points_update WebSocket event.
      setNotes("");
      setCustomDuration("");
      setShowCustomDuration(false);
      setType("");
      setDuration(30);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log activity");
    } finally {
      setSubmitting(false);
    }
  };

  const previewPoints = 10; // Server-side fixed via PATIENT_RATE_LIMITS

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            Activity Log
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {totalMinutes} min today
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Activity type</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={
                  "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors " +
                  (type === value
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-card text-foreground border-border hover:bg-muted")
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Duration</p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_DURATIONS.map((m) => (
              <Button
                key={m}
                variant={!showCustomDuration && duration === m ? "default" : "outline"}
                size="sm"
                onClick={() => { setShowCustomDuration(false); setDuration(m); }}
              >
                {m} min
              </Button>
            ))}
            <Button
              variant={showCustomDuration ? "default" : "outline"}
              size="sm"
              onClick={() => setShowCustomDuration((v) => !v)}
            >
              Custom
            </Button>
          </div>
          {showCustomDuration && (
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              placeholder="Minutes"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              className="mt-2 h-9"
            />
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Notes (optional)</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="How did it feel? Any soreness or fatigue?"
            rows={2}
            className="text-sm"
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted-foreground">
            +{previewPoints} Zen Points per session · max 3/day
          </p>
          <Button onClick={submit} disabled={submitting || !type}>
            Log Activity
          </Button>
        </div>

        {logs.length > 0 && (
          <div className="pt-2 border-t border-border/50 space-y-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Today's sessions</p>
            <ul className="space-y-1">
              {logs.map((l) => {
                const Icon = ICONS_BY_TYPE[l.activityType] ?? Activity;
                return (
                  <li key={l.id} className="flex items-center gap-2 text-xs">
                    <Icon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-medium">
                      {ACTIVITY_TYPES.find((t) => t.value === l.activityType)?.label || l.activityType}
                    </span>
                    <span className="text-muted-foreground">· {l.durationMins} min</span>
                    {l.zenPointsAwarded > 0 && (
                      <span className="text-emerald-600">· +{l.zenPointsAwarded} pts</span>
                    )}
                    {l.notes && (
                      <span className="text-muted-foreground italic truncate">— {l.notes}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
