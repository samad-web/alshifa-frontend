import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { superAdminApi, HospitalPlan, FeatureRegistryEntry } from "@/services/superAdmin.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const PLAN_RANK: Record<HospitalPlan, number> = { STARTER: 0, PROFESSIONAL: 1, ENTERPRISE: 2 };

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function HospitalCreate() {
  const nav = useNavigate();
  const [registry, setRegistry] = useState<FeatureRegistryEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    timezone: "Asia/Kolkata",
    plan: "STARTER" as HospitalPlan,
    adminEmail: "",
    defaultFeatures: [] as string[],
  });
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    superAdminApi.listRegistry().then(setRegistry).catch(() => null);
  }, []);

  // Auto-slug from name until user edits slug manually.
  useEffect(() => {
    if (!slugEdited) setForm((f) => ({ ...f, slug: slugify(f.name) }));
  }, [form.name, slugEdited]);

  const planRank = PLAN_RANK[form.plan];
  const optionalFeatures = registry.filter((f) => !f.isCore);

  const toggleFeature = (key: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      defaultFeatures: checked
        ? Array.from(new Set([...f.defaultFeatures, key]))
        : f.defaultFeatures.filter((k) => k !== key),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug || !form.contactEmail) {
      toast.error("Name, slug and contact email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await superAdminApi.createHospital({
        name: form.name,
        slug: form.slug,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone || undefined,
        address: form.address || undefined,
        timezone: form.timezone,
        plan: form.plan,
        adminUser: form.adminEmail ? { email: form.adminEmail } : undefined,
        defaultFeatures: form.defaultFeatures,
      });
      toast.success(`Hospital "${result.hospital.name}" created.`);
      nav(`/super-admin/hospitals/${result.hospital.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? err?.message ?? "Failed to create hospital");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New hospital</h1>
        <p className="text-sm text-muted-foreground">
          Provisions a tenant, creates its root ADMIN user, and seeds feature flags.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Hospital details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setForm({ ...form, slug: slugify(e.target.value) });
                }}
                required
              />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} required />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </div>
            <div>
              <Label>Plan</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v as HospitalPlan })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STARTER">Starter</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Root ADMIN user</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label>Email (password setup link will be sent)</Label>
            <Input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Optional. If omitted, you can create the root admin later from the hospital detail page.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Default features</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Core features are always enabled. Pick which optional features ship on day one.
              Features above the hospital's plan are hidden — upgrade the plan to enable them.
            </p>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {optionalFeatures.map((f) => {
                const allowed = PLAN_RANK[f.minPlan] <= planRank;
                const checked = form.defaultFeatures.includes(f.key);
                return (
                  <li key={f.key} className="flex items-start gap-2 rounded-md border p-2">
                    <Checkbox
                      checked={checked}
                      disabled={!allowed}
                      onCheckedChange={(v) => toggleFeature(f.key, Boolean(v))}
                      id={`f-${f.key}`}
                    />
                    <label htmlFor={`f-${f.key}`} className="flex-1 cursor-pointer text-sm">
                      <div className="font-medium">{f.displayName}</div>
                      <div className="text-xs text-muted-foreground">{f.phase} · requires {f.minPlan}</div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => nav(-1)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create hospital"}
          </Button>
        </div>
      </form>
    </div>
  );
}
