import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  messageTemplateService,
  DeliveryChannel,
  MessageTemplate,
  MessageTemplateCategory,
  StandardPlaceholder,
} from "@/services/messaging.service";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { AppLayout } from "@/components/layout/app-layout";

const CATEGORIES: { key: MessageTemplateCategory; label: string }[] = [
  { key: "DAILY_CHECKIN", label: "Daily Check-in" },
  { key: "APPOINTMENT_CONFIRMATION", label: "Appointment Confirmation" },
  { key: "APPOINTMENT_REMINDER", label: "Appointment Reminder" },
  { key: "CUSTOM", label: "Custom" },
];

const CHANNELS: DeliveryChannel[] = ["WHATSAPP", "SMS", "EMAIL", "IN_APP"];

const emptyTemplate = {
  name: "",
  category: "APPOINTMENT_CONFIRMATION" as MessageTemplateCategory,
  body: "",
  subject: "",
  channels: ["WHATSAPP"] as DeliveryChannel[],
  isDefault: false,
  isActive: true,
};

export default function MessageTemplates() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [placeholders, setPlaceholders] = useState<StandardPlaceholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | MessageTemplateCategory>("all");
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [form, setForm] = useState(emptyTemplate);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => { refresh(); }, []);

  async function refresh() {
    try {
      setLoading(true);
      const [list, phs] = await Promise.all([
        messageTemplateService.list(),
        messageTemplateService.listPlaceholders(),
      ]);
      setTemplates(list.data);
      setPlaceholders(phs.data);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyTemplate);
    setPreviewText(null);
    setDialogOpen(true);
  }

  function openEdit(tpl: MessageTemplate) {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      category: tpl.category,
      body: tpl.body,
      subject: tpl.subject || "",
      channels: tpl.channels,
      isDefault: tpl.isDefault,
      isActive: tpl.isActive,
    });
    setPreviewText(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.body.trim()) {
      toast.error("Name and body are required");
      return;
    }
    try {
      setSaving(true);
      if (editing) {
        await messageTemplateService.update(editing.id, form);
        toast.success("Template updated");
      } else {
        await messageTemplateService.create(form);
        toast.success("Template created");
      }
      setDialogOpen(false);
      refresh();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    try {
      const r = await messageTemplateService.preview({ body: form.body, subject: form.subject });
      setPreviewText(r.data.body);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Preview failed");
    }
  }

  async function remove(tpl: MessageTemplate) {
    const ok = await confirm({
      title: `Delete "${tpl.name}"?`,
      description: "This template cannot be recovered. Active reminders that reference it will fall back to the default copy.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await messageTemplateService.remove(tpl.id);
      toast.success("Deleted");
      refresh();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Delete failed");
    }
  }

  const filtered = useMemo(
    () => templates.filter((t) => (tab === "all" ? true : t.category === tab)),
    [templates, tab],
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Message Templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable messages for daily reminders, appointment confirmations, and custom broadcasts.
            Placeholders (e.g. {'{{patientName}}'}) are filled in automatically when sent.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />New template</Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : filtered.length === 0 ? <p className="text-sm text-muted-foreground">No templates yet — click "New template" to create one.</p>
            : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((tpl) => (
                  <Card key={tpl.id} className={tpl.isActive ? "" : "opacity-60"}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base">{tpl.name}</CardTitle>
                          <div className="flex gap-1 flex-wrap mt-1">
                            <Badge variant="outline">{CATEGORIES.find((c) => c.key === tpl.category)?.label}</Badge>
                            {tpl.isDefault && <Badge>Default</Badge>}
                            {!tpl.isActive && <Badge variant="destructive">Inactive</Badge>}
                            {tpl.channels.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(tpl)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap text-sm font-sans text-muted-foreground line-clamp-6">{tpl.body}</pre>
                      {tpl.placeholders.length > 0 && (
                        <div className="mt-2 flex gap-1 flex-wrap text-xs">
                          {tpl.placeholders.map((k) => <Badge key={k} variant="outline" className="font-mono">{`{{${k}}}`}</Badge>)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. OFFLINE appointment confirmation" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as MessageTemplateCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default for this category</Label>
              <div className="pt-2"><Switch checked={form.isDefault} onCheckedChange={(v) => setForm({ ...form, isDefault: v })} /></div>
            </div>
            <div className="col-span-2">
              <Label>Channels (tried in order — first success wins)</Label>
              <div className="flex gap-3 mt-2">
                {CHANNELS.map((c) => (
                  <label key={c} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={form.channels.includes(c)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.channels, c]
                          : form.channels.filter((x) => x !== c);
                        setForm({ ...form, channels: next });
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Subject (email only)</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Optional email subject" />
            </div>
            <div className="col-span-2">
              <Label>Body</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={10}
                placeholder={'Dear {{patientName}}, your appointment with {{doctorName}} is on {{appointmentDateTime}}.'}
              />
              <div className="mt-2 flex gap-1 flex-wrap text-xs">
                {placeholders.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className="px-2 py-1 rounded border text-muted-foreground hover:bg-muted font-mono"
                    onClick={() => setForm((f) => ({ ...f, body: `${f.body}{{${p.key}}}` }))}
                    title={p.description}
                  >
                    {`{{${p.key}}}`}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={runPreview}><Eye className="w-4 h-4 mr-1" /> Preview</Button>
              {previewText && (
                <div className="mt-2 p-3 rounded bg-muted text-sm whitespace-pre-wrap flex-1">{previewText}</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={saving} onClick={save}>{saving ? "Saving…" : editing ? "Save changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
      </div>
    </AppLayout>
  );
}
