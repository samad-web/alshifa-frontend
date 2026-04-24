import { useEffect, useState } from "react";
import { superAdminApi, FeatureRegistryEntry } from "@/services/superAdmin.service";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR: Record<FeatureRegistryEntry["globalStatus"], string> = {
  ON: "bg-emerald-100 text-emerald-900",
  OFF: "bg-slate-200 text-slate-700",
  MIXED: "bg-amber-100 text-amber-900",
};

export default function FeatureRegistryPage() {
  const [items, setItems] = useState<FeatureRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState<{ feature: FeatureRegistryEntry; enabled: boolean } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    superAdminApi
      .listRegistry()
      .then(setItems)
      .catch((e) => toast.error(e?.message ?? "Failed to load registry"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await superAdminApi.triggerRegistrySync();
      toast.success(`Sync complete — ${r.createdFlagRows} flag rows created across ${r.hospitalCount} hospitals.`);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const confirmToggle = async () => {
    if (!pending) return;
    const { feature, enabled } = pending;
    setBusyKey(feature.key);
    setPending(null);
    try {
      const result = await superAdminApi.toggleFeatureGlobally(feature.key, enabled);
      if (result.skippedForPlan > 0) {
        toast.success(
          `${feature.displayName} ${enabled ? "enabled" : "disabled"} for ${result.appliedTo} hospital(s). ` +
            `${result.skippedForPlan} skipped (plan too low).`
        );
      } else {
        toast.success(
          `${feature.displayName} ${enabled ? "enabled" : "disabled"} for all ${result.appliedTo} hospital(s).`
        );
      }
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? err?.message ?? "Toggle failed");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feature Registry</h1>
          <p className="text-sm text-muted-foreground">
            Every platform feature. Toggle a row to apply the change across all hospitals at once;
            core features are always on and locked.
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Run sync now"}
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Min plan</TableHead>
                <TableHead>Rollout</TableHead>
                <TableHead className="text-right">Global</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((f) => {
                const globalOn = f.globalStatus === "ON";
                const nextState = !globalOn;
                const isBusy = busyKey === f.key;
                return (
                  <TableRow key={f.key}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{f.displayName}</span>
                        {f.isCore && (
                          <Badge variant="outline" className="text-[10px]">
                            <Lock className="mr-1 h-3 w-3" /> Core
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{f.key}</div>
                      {f.description && (
                        <div className="text-xs text-muted-foreground">{f.description}</div>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">{f.phase}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{f.minPlan}</Badge></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLOR[f.globalStatus]}>{f.globalStatus}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {f.enabledHospitalCount} / {f.hospitalCount}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={globalOn}
                        disabled={f.isCore || isBusy}
                        onCheckedChange={() => setPending({ feature: f, enabled: nextState })}
                        aria-label={`Toggle ${f.displayName} globally`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.enabled ? "Enable" : "Disable"} "{pending?.feature.displayName}" globally?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.enabled ? (
                <>
                  This will enable <strong>{pending.feature.displayName}</strong> for every
                  non-decommissioned hospital whose plan is at least{" "}
                  <strong>{pending.feature.minPlan}</strong>. Hospitals on a lower plan are skipped.
                </>
              ) : (
                <>
                  This will disable <strong>{pending?.feature.displayName}</strong> for every
                  hospital on the platform. Users inside those hospitals will lose access
                  immediately on their next request.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle}>
              Yes, {pending?.enabled ? "enable" : "disable"} everywhere
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
