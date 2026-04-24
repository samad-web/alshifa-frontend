import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  superAdminApi,
  HospitalDetail as TDetail,
  HospitalFeature,
  HospitalUsage,
  AuditLogEntry,
} from "@/services/superAdmin.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Lock, ExternalLink } from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  CORE: "Core (always enabled)",
  PHASE_2: "Phase 2 — Professional & Enterprise",
  PHASE_3: "Phase 3 — Professional & Enterprise",
  PHASE_4: "Phase 4 — Enterprise only",
  TRIAGE_V2: "Triage v2",
  IWIS_COMPETITOR: "Ayurveda clinical ops",
  OPERATIONS: "Multi-branch operations",
  CLINICIAN_GAMIFICATION: "Clinician gamification",
  PATIENT_GAMIFICATION: "Patient gamification",
  COMMUNICATION: "Communication & portal",
};

// Controls the display order of phase groups in the UI.
const PHASE_ORDER: string[] = [
  "CORE",
  "IWIS_COMPETITOR",
  "OPERATIONS",
  "COMMUNICATION",
  "CLINICIAN_GAMIFICATION",
  "PATIENT_GAMIFICATION",
  "TRIAGE_V2",
  "PHASE_2",
  "PHASE_3",
  "PHASE_4",
];

export default function HospitalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [hospital, setHospital] = useState<TDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) return;
    setLoading(true);
    superAdminApi
      .getHospital(id)
      .then(setHospital)
      .catch((e) => toast.error(e?.message ?? "Failed to load hospital"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [id]);

  if (loading) return <Skeleton className="h-80" />;
  if (!hospital || !id) return <div>Hospital not found.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{hospital.name}</h1>
            <Badge>{hospital.status}</Badge>
            <Badge variant="outline">{hospital.plan}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{hospital.slug}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/super-admin/hospitals">Back</Link>
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab hospital={hospital} />
        </TabsContent>
        <TabsContent value="branches">
          <BranchesTab hospital={hospital} />
        </TabsContent>
        <TabsContent value="features">
          <FeaturesTab hospitalId={id} planUpdated={load} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab hospitalId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ hospital }: { hospital: TDetail }) {
  const [usage, setUsage] = useState<HospitalUsage | null>(null);
  useEffect(() => {
    superAdminApi.hospitalUsage(hospital.id).then(setUsage).catch(() => null);
  }, [hospital.id]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Email: </span>{hospital.contactEmail}</div>
          <div><span className="text-muted-foreground">Phone: </span>{hospital.contactPhone ?? "—"}</div>
          <div><span className="text-muted-foreground">Address: </span>{hospital.address ?? "—"}</div>
          <div><span className="text-muted-foreground">Timezone: </span>{hospital.timezone}</div>
          <div><span className="text-muted-foreground">Country: </span>{hospital.country}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Usage (last 30 days)</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!usage ? (
            <Skeleton className="h-24" />
          ) : (
            <>
              <UsageRow label="Branches" value={usage.totals.branches} />
              <UsageRow label="Staff users" value={usage.totals.staffUsers} />
              <UsageRow label="Patients" value={usage.totals.patients} />
              <UsageRow label="Appointments (30d)" value={usage.totals.appointmentsLast30d} />
              <UsageRow label="Prescriptions (30d)" value={usage.totals.prescriptionsLast30d} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsageRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function BranchesTab({ hospital }: { hospital: TDetail }) {
  if (hospital.branches.length === 0) {
    return <p className="text-sm text-muted-foreground">No branches yet.</p>;
  }
  return (
    <ul className="divide-y rounded-md border bg-white">
      {hospital.branches.map((b) => (
        <li key={b.id} className="flex items-center justify-between p-3">
          <div>
            <div className="font-medium">{b.name}</div>
            <div className="text-xs text-muted-foreground">
              Created {new Date(b.createdAt).toLocaleDateString()}
            </div>
          </div>
          <Badge variant={b.isActive ? "default" : "outline"}>
            {b.isActive ? "Active" : "Inactive"}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function FeaturesTab({ hospitalId, planUpdated }: { hospitalId: string; planUpdated: () => void }) {
  const [features, setFeatures] = useState<HospitalFeature[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    superAdminApi
      .listHospitalFeatures(hospitalId)
      .then(setFeatures)
      .catch((e) => toast.error(e?.message ?? "Failed to load features"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [hospitalId]);

  const grouped = useMemo(() => {
    const g: Record<string, HospitalFeature[]> = {};
    for (const f of features) {
      (g[f.phase] ||= []).push(f);
    }
    return g;
  }, [features]);

  const handleToggle = async (f: HospitalFeature, next: boolean) => {
    if (!f.planAllowed && next) {
      toast.error(`Feature requires ${f.minPlan}. Upgrade the hospital's plan first.`);
      return;
    }
    try {
      await superAdminApi.setHospitalFeature(hospitalId, f.key, next);
      toast.success(`${f.displayName} ${next ? "enabled" : "disabled"}.`);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? "Toggle failed";
      toast.error(msg);
    }
  };

  const handleSync = async () => {
    try {
      const r = await superAdminApi.triggerRegistrySync();
      toast.success(`Sync complete: ${r.createdFlagRows} flag rows created.`);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Sync failed");
    }
  };

  if (loading) return <Skeleton className="h-80" />;

  const phaseKeys = Object.keys(grouped).sort((a, b) => {
    const ai = PHASE_ORDER.indexOf(a);
    const bi = PHASE_ORDER.indexOf(b);
    // Known phases go first in explicit order; unknown phases fall to the bottom alphabetically.
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Core features are always on. Toggling an optional feature creates or updates the hospital's flag.
        </p>
        <Button size="sm" variant="outline" onClick={handleSync}>
          Run registry sync
        </Button>
      </div>

      {phaseKeys.map((phase) => (
        <Card key={phase}>
          <CardHeader>
            <CardTitle className="text-sm">{PHASE_LABELS[phase] ?? phase}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {grouped[phase].map((f) => (
              <FeatureRow key={f.key} feature={f} onToggle={(next) => handleToggle(f, next)} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FeatureRow({
  feature,
  onToggle,
}: {
  feature: HospitalFeature;
  onToggle: (next: boolean) => void;
}) {
  const { displayName, description, minPlan, isCore, enabled, enabledAt, enabledByEmail, syncPending, planAllowed } = feature;
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{displayName}</span>
          {isCore && (
            <Badge variant="outline" className="text-[10px]">
              <Lock className="mr-1 h-3 w-3" /> Core
            </Badge>
          )}
          {!planAllowed && (
            <Badge variant="outline" className="text-[10px] text-amber-700">
              Requires {minPlan}
            </Badge>
          )}
          {syncPending && (
            <Badge variant="outline" className="text-[10px] text-amber-700">
              <AlertTriangle className="mr-1 h-3 w-3" /> Sync pending
            </Badge>
          )}
        </div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
        {enabled && enabledAt && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            Enabled {new Date(enabledAt).toLocaleString()}
            {enabledByEmail ? ` · by ${enabledByEmail}` : ""}
          </div>
        )}
      </div>
      <Switch
        checked={enabled}
        disabled={isCore || (!planAllowed && !enabled)}
        onCheckedChange={(v) => onToggle(v)}
      />
    </div>
  );
}

function AuditTab({ hospitalId }: { hospitalId: string }) {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superAdminApi
      .listAudit({ hospitalId, pageSize: 50 })
      .then((p) => setItems(p.items))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [hospitalId]);

  if (loading) return <Skeleton className="h-60" />;
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No audit entries for this hospital yet.</p>;

  return (
    <ul className="divide-y rounded-md border bg-white">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between p-3">
          <div>
            <div className="font-medium">{a.action}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(a.createdAt).toLocaleString()} · {a.superAdmin?.email ?? a.superAdminId}
            </div>
            {a.featureKey && (
              <div className="text-xs text-muted-foreground">Feature: {a.featureKey}</div>
            )}
          </div>
          {a.details ? (
            <pre className="max-w-sm overflow-hidden text-ellipsis rounded bg-slate-50 p-2 text-[10px] text-slate-700">
              {JSON.stringify(a.details, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
