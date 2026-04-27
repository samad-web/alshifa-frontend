import { useEffect, useState } from "react";
import { superAdminApi, SpecialtyRoute } from "@/services/superAdmin.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Tag } from "lucide-react";
import { useConfirm } from "@/components/common/ConfirmDialog";

interface Draft {
  specialty: string;
  tags: string;
  priority: number;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = { specialty: "", tags: "", priority: 0, isActive: true };

function toDraft(r: SpecialtyRoute): Draft {
  return { specialty: r.specialty, tags: r.tags.join(", "), priority: r.priority, isActive: r.isActive };
}

export default function SpecialtyRoutesAdmin() {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<SpecialtyRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY_DRAFT);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const reload = () => {
    setLoading(true);
    superAdminApi
      .listSpecialtyRoutes()
      .then((rs) => {
        setRoutes(rs);
        setDrafts(Object.fromEntries(rs.map((r) => [r.id, toDraft(r)])));
      })
      .catch((e) => toast({ title: "Load failed", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const parseTags = (s: string) =>
    s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

  const saveRow = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setSaving(true);
    try {
      await superAdminApi.upsertSpecialtyRoute({
        specialty: d.specialty,
        tags: parseTags(d.tags),
        priority: d.priority,
        isActive: d.isActive,
      });
      toast({ title: "Saved", description: `${d.specialty} updated.` });
      reload();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createRow = async () => {
    if (!newDraft.specialty.trim()) {
      toast({ title: "Specialty required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await superAdminApi.upsertSpecialtyRoute({
        specialty: newDraft.specialty,
        tags: parseTags(newDraft.tags),
        priority: newDraft.priority,
        isActive: newDraft.isActive,
      });
      setNewDraft(EMPTY_DRAFT);
      toast({ title: "Created", description: `${newDraft.specialty} added.` });
      reload();
    } catch (e: any) {
      toast({ title: "Create failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (id: string, specialty: string) => {
    const ok = await confirm({
      title: `Delete route "${specialty}"?`,
      description: "Triage will fall back to in-code routing for the tags this route currently owns.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    setSaving(true);
    try {
      await superAdminApi.deleteSpecialtyRoute(id);
      toast({ title: "Deleted", description: specialty });
      reload();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Specialty routing</h1>
        <p className="text-sm text-muted-foreground">
          Maps pain-region IDs, symptoms, and pain characters to a specialty. Tags are
          matched exactly (normalized to lowercase). Changes take effect on the next
          triage submission — no deploy required.
        </p>
      </div>

      {/* Existing routes */}
      <div className="space-y-3">
        {routes.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No specialty routes configured. Triage is falling back to in-code routing.
            </CardContent>
          </Card>
        )}
        {routes.map((r) => {
          const d = drafts[r.id] ?? toDraft(r);
          return (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span>{r.specialty}</span>
                  <div className="flex items-center gap-2">
                    {!r.isActive && <Badge variant="outline">Inactive</Badge>}
                    <Badge variant="secondary">priority {r.priority}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Specialty name</Label>
                  <Input
                    value={d.specialty}
                    onChange={(e) => update(r.id, { specialty: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Tags — comma separated, exact match
                  </Label>
                  <Input
                    value={d.tags}
                    onChange={(e) => update(r.id, { tags: e.target.value })}
                    placeholder="knee, shoulder, left-knee"
                  />
                  <div className="mt-1 flex flex-wrap gap-1">
                    {parseTags(d.tags).map((t) => (
                      <Badge key={t} variant="outline" className="font-mono text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-4">
                  <div className="w-32">
                    <Label className="text-xs">Priority</Label>
                    <Input
                      type="number"
                      value={d.priority}
                      onChange={(e) => update(r.id, { priority: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={d.isActive}
                      onCheckedChange={(v) => update(r.id, { isActive: v })}
                    />
                    <Label className="text-xs">Active</Label>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => deleteRow(r.id, r.specialty)} disabled={saving}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                    <Button size="sm" onClick={() => saveRow(r.id)} disabled={saving}>
                      <Save className="mr-1 h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* New route */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add specialty route
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Specialty name</Label>
            <Input
              value={newDraft.specialty}
              onChange={(e) => setNewDraft({ ...newDraft, specialty: e.target.value })}
              placeholder="e.g. Paediatric Care"
            />
          </div>
          <div>
            <Label className="text-xs">Tags</Label>
            <Input
              value={newDraft.tags}
              onChange={(e) => setNewDraft({ ...newDraft, tags: e.target.value })}
              placeholder="paediatric, child, kid"
            />
          </div>
          <div className="flex items-end gap-4">
            <div className="w-32">
              <Label className="text-xs">Priority</Label>
              <Input
                type="number"
                value={newDraft.priority}
                onChange={(e) => setNewDraft({ ...newDraft, priority: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newDraft.isActive}
                onCheckedChange={(v) => setNewDraft({ ...newDraft, isActive: v })}
              />
              <Label className="text-xs">Active</Label>
            </div>
            <Button className="ml-auto" size="sm" onClick={createRow} disabled={saving}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Create
            </Button>
          </div>
        </CardContent>
      </Card>
      {confirmDialog}
    </div>
  );
}
