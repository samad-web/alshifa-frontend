import { useEffect, useState, useCallback } from "react";
import { Activity, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VITAL_TYPES: Array<{ value: string; label: string; defaultUnit: string }> = [
  { value: "BP_SYSTOLIC", label: "Blood Pressure (Systolic)", defaultUnit: "mmHg" },
  { value: "BP_DIASTOLIC", label: "Blood Pressure (Diastolic)", defaultUnit: "mmHg" },
  { value: "WEIGHT", label: "Weight", defaultUnit: "kg" },
  { value: "GLUCOSE", label: "Blood Glucose", defaultUnit: "mg/dL" },
  { value: "SLEEP_HOURS", label: "Sleep Hours", defaultUnit: "hours" },
  { value: "PAIN_SCORE", label: "Pain Score", defaultUnit: "/10" },
  { value: "MOOD", label: "Mood", defaultUnit: "/10" },
];

const FREQUENCIES = [
  { value: "DAILY", label: "Daily" },
  { value: "TWICE_DAILY", label: "Twice daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "AS_NEEDED", label: "As needed" },
];

interface PrescribedVitalRow {
  id: string;
  vitalType: string;
  frequency: string;
  notes: string | null;
  prescribedBy: { id: string; name: string | null; email?: string | null } | null;
  createdAt: string;
}

interface Props {
  patientId: string;
  /** Whether the current user can add/remove (defaults to true). */
  editable?: boolean;
}

export function PrescribedVitalsManager({ patientId, editable = true }: Props) {
  const [rows, setRows] = useState<PrescribedVitalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [vitalType, setVitalType] = useState("");
  const [frequency, setFrequency] = useState("DAILY");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get<{ data: PrescribedVitalRow[] }>(
        `/api/patients/${patientId}/prescribed-vitals`,
      );
      setRows(data.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load prescribed vitals");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setVitalType(""); setFrequency("DAILY"); setNotes(""); setAdding(false); };

  const submit = async () => {
    if (!vitalType) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/api/patients/${patientId}/prescribed-vitals`, {
        vitalType, frequency, notes: notes.trim() || undefined,
      });
      toast.success("Prescribed vital added");
      reset();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to prescribe vital");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this prescribed vital?")) return;
    try {
      await apiClient.delete(`/api/patients/${patientId}/prescribed-vitals/${id}`);
      toast.success("Removed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  const labelFor = (type: string) =>
    VITAL_TYPES.find((v) => v.value === type)?.label || type;
  const freqLabel = (f: string) =>
    FREQUENCIES.find((x) => x.value === f)?.label || f;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-primary flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Prescribed Vitals
        </h3>
        {editable && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {rows.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground italic">
              No vitals prescribed yet. Use Add to specify which vitals this patient should track daily.
            </p>
          )}

          {rows.length > 0 && (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md bg-background border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{labelFor(r.vitalType)}</span>
                      <Badge variant="outline" className="text-[10px]">{freqLabel(r.frequency)}</Badge>
                    </div>
                    {r.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>
                    )}
                    {r.prescribedBy?.name && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        by {r.prescribedBy.name}
                      </p>
                    )}
                  </div>
                  {editable && (
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => remove(r.id)}
                      className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {adding && (
            <div className={cn("mt-3 p-3 rounded-md bg-background border space-y-2")}>
              <Select value={vitalType} onValueChange={setVitalType}>
                <SelectTrigger><SelectValue placeholder="Choose vital to track" /></SelectTrigger>
                <SelectContent>
                  {VITAL_TYPES.filter((v) => !rows.some((r) => r.vitalType === v.value)).map((v) => (
                    <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes for the patient (optional)"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={reset}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={!vitalType || submitting}>
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Prescribe
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PrescribedVitalsManager;
