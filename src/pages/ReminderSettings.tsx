import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Clock, Play, Send } from "lucide-react";
import {
  messageTemplateService,
  reminderSettingService,
  MessageTemplate,
  ReminderSetting,
  DeliveryChannel,
  ReminderDeliveryLog,
} from "@/services/messaging.service";

const CHANNELS: DeliveryChannel[] = ["WHATSAPP", "SMS", "EMAIL", "IN_APP"];

export default function ReminderSettings() {
  const [setting, setSetting] = useState<ReminderSetting | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [logs, setLogs] = useState<ReminderDeliveryLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try {
      setBusy(true);
      const [s, t, d] = await Promise.all([
        reminderSettingService.get(),
        messageTemplateService.list({ category: "DAILY_CHECKIN", isActive: true }),
        reminderSettingService.deliveries({ kind: "DAILY_CHECKIN", limit: 50 }),
      ]);
      setSetting(s.data);
      setTemplates(t.data);
      setLogs(d.data.data);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to load reminder settings");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!setting) return;
    try {
      setBusy(true);
      const updated = await reminderSettingService.update({
        dailyReminderEnabled: setting.dailyReminderEnabled,
        dailyReminderTime: setting.dailyReminderTime,
        dailyReminderChannels: setting.dailyReminderChannels,
        dailyReminderTemplateId: setting.dailyReminderTemplateId,
        dailyReminderInlineBody: setting.dailyReminderInlineBody,
        skipIfAlreadyCheckedIn: setting.skipIfAlreadyCheckedIn,
      });
      setSetting(updated.data);
      toast.success("Saved");
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function triggerNow() {
    if (!confirm("Fire the daily reminder broadcast to all patients right now? This will send WhatsApp / SMS / email immediately.")) return;
    try {
      setRunning(true);
      const r = await reminderSettingService.triggerNow();
      toast.success(`Sent to ${r.data.successCount} / ${r.data.targetCount} patients`);
      refresh();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Trigger failed");
    } finally {
      setRunning(false);
    }
  }

  if (!setting) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Daily Check-in Reminder</h1>
          <p className="text-sm text-muted-foreground">
            Sends every morning at the configured time to all onboarded patients at this hospital.
          </p>
        </div>
        <Button onClick={triggerNow} disabled={running} variant="outline">
          <Play className="w-4 h-4 mr-2" /> {running ? "Sending…" : "Run now"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Switch
              checked={setting.dailyReminderEnabled}
              onCheckedChange={(v) => setSetting({ ...setting, dailyReminderEnabled: v })}
            />
            <Label>Enabled</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-2"><Clock className="w-4 h-4" /> Time (HH:MM, 24h)</Label>
              <Input
                type="time"
                value={setting.dailyReminderTime}
                onChange={(e) => setSetting({ ...setting, dailyReminderTime: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">Evaluated in the hospital timezone.</p>
            </div>
            <div>
              <Label>Skip patients who already checked in today</Label>
              <div className="pt-2">
                <Switch
                  checked={setting.skipIfAlreadyCheckedIn}
                  onCheckedChange={(v) => setSetting({ ...setting, skipIfAlreadyCheckedIn: v })}
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Channels (tried in order)</Label>
            <div className="flex gap-3 mt-2">
              {CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={setting.dailyReminderChannels.includes(c)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...setting.dailyReminderChannels, c]
                        : setting.dailyReminderChannels.filter((x) => x !== c);
                      setSetting({ ...setting, dailyReminderChannels: next });
                    }}
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Template</Label>
            <Select
              value={setting.dailyReminderTemplateId || "__inline"}
              onValueChange={(v) => setSetting({
                ...setting,
                dailyReminderTemplateId: v === "__inline" ? null : v,
              })}
            >
              <SelectTrigger><SelectValue placeholder="Inline message" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__inline">Inline message (below)</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}{t.isDefault ? " · default" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!setting.dailyReminderTemplateId && (
            <div>
              <Label>Inline message body</Label>
              <Textarea
                rows={6}
                value={setting.dailyReminderInlineBody || ""}
                onChange={(e) => setSetting({ ...setting, dailyReminderInlineBody: e.target.value })}
                placeholder={'Good morning {{patientName}}, please complete your daily check-in.'}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {'{{patientName}}'} and other placeholders — unmatched tokens render as empty.
              </p>
            </div>
          )}

          <div className="pt-2">
            <Button onClick={save} disabled={busy}>Save schedule</Button>
          </div>

          {setting.lastRunAt && (
            <p className="text-xs text-muted-foreground pt-2">
              Last run: {new Date(setting.lastRunAt).toLocaleString()}
              {setting.lastRunTargetCount !== null && (
                <> · {setting.lastRunSuccessCount} / {setting.lastRunTargetCount} delivered</>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle><Send className="w-4 h-4 inline mr-1" /> Recent deliveries</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries yet.</p>
          ) : (
            <div className="space-y-1 text-xs font-mono">
              {logs.slice(0, 30).map((l) => (
                <div key={l.id} className="flex items-center gap-2 py-1 border-b last:border-0">
                  <span className="text-muted-foreground w-32">{new Date(l.createdAt).toLocaleString()}</span>
                  <Badge variant="outline">{l.channel}</Badge>
                  <Badge variant={l.status === "SENT" ? "default" : l.status === "FAILED" ? "destructive" : "secondary"}>
                    {l.status}
                  </Badge>
                  <span className="truncate flex-1">{l.target || "—"}</span>
                  {l.errorMessage && <span className="text-destructive truncate max-w-xs">{l.errorMessage}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
