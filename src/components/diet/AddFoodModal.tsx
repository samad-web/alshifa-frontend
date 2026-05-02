import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type {
  AyurvedicFood,
  FoodCategory,
  RasaType,
  GunaType,
  Season,
  DoshaEffect,
  Virya,
} from "@/types/ayurvedicFood";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass an existing food to switch to edit mode; omit for create mode. */
  editing?: AyurvedicFood | null;
}

const CATEGORIES: FoodCategory[] = ["GRAIN","VEGETABLE","FRUIT","DAIRY","SPICE","OIL","LEGUME","MEAT","HERB","BEVERAGE","OTHER"];
const RASAS:      RasaType[]     = ["SWEET","SOUR","SALTY","PUNGENT","BITTER","ASTRINGENT"];
const GUNAS:      GunaType[]     = ["HEAVY","LIGHT","OILY","DRY","HOT","COLD","SHARP","SOFT","STABLE","MOBILE"];
const SEASONS:    Season[]       = ["WINTER","SUMMER","MONSOON","AUTUMN","SPRING"];
const DOSHA_EFFECTS: DoshaEffect[] = ["PACIFYING","NEUTRAL","AGGRAVATING"];
const VIRYAS:     Virya[]        = ["HOT","COLD","NEUTRAL"];

interface FormState {
  name: string;
  nameInTamil: string;
  nameInSanskrit: string;
  category: FoodCategory;
  doshaEffectVata: DoshaEffect;
  doshaEffectPitta: DoshaEffect;
  doshaEffectKapha: DoshaEffect;
  rasa: RasaType[];
  guna: GunaType[];
  virya: Virya;
  seasons: Season[];
  preparationMethods: string; // comma-separated in form
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  commonAllergies: string; // comma-separated in form
  isActive: boolean;
}

function initialForm(): FormState {
  return {
    name: "", nameInTamil: "", nameInSanskrit: "", category: "OTHER",
    doshaEffectVata: "NEUTRAL", doshaEffectPitta: "NEUTRAL", doshaEffectKapha: "NEUTRAL",
    rasa: [], guna: [], virya: "NEUTRAL", seasons: [],
    preparationMethods: "", calories: "", protein: "", carbs: "", fat: "", fiber: "",
    commonAllergies: "", isActive: true,
  };
}

function fromFood(f: AyurvedicFood): FormState {
  return {
    name: f.name,
    nameInTamil: f.nameInTamil ?? "",
    nameInSanskrit: f.nameInSanskrit ?? "",
    category: f.category,
    doshaEffectVata: (f.doshaEffectVata as DoshaEffect) || "NEUTRAL",
    doshaEffectPitta: (f.doshaEffectPitta as DoshaEffect) || "NEUTRAL",
    doshaEffectKapha: (f.doshaEffectKapha as DoshaEffect) || "NEUTRAL",
    rasa: f.rasa,
    guna: f.guna,
    virya: (f.virya as Virya) || "NEUTRAL",
    seasons: f.seasons,
    preparationMethods: (f.preparationMethods ?? []).join(", "),
    calories: f.calories != null ? String(f.calories) : "",
    protein:  f.protein  != null ? String(f.protein)  : "",
    carbs:    f.carbs    != null ? String(f.carbs)    : "",
    fat:      f.fat      != null ? String(f.fat)      : "",
    fiber:    f.fiber    != null ? String(f.fiber)    : "",
    commonAllergies: (f.commonAllergies ?? []).join(", "),
    isActive: f.isActive,
  };
}

function splitCsv(s: string): string[] {
  return s.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
}

function numOrNull(s: string): number | null {
  if (!s.trim()) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Multi-select chip group used for rasa / guna / seasons. Keeps the form
 * compact compared to a hardcoded checkbox grid.
 */
function ChipMultiSelect<T extends string>({
  label, options, value, onChange,
}: { label: string; options: T[]; value: T[]; onChange: (next: T[]) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() =>
                onChange(selected ? value.filter((v) => v !== opt) : [...value, opt])
              }
              className={
                "px-2.5 py-1 rounded-full text-[11px] border transition-colors " +
                (selected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted")
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Add / edit Ayurvedic food. Refreshes ['ayurvedic-foods'] queries on success. */
export function AddFoodModal({ open, onClose, editing }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm());

  // Reset / hydrate every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setForm(editing ? fromFood(editing) : initialForm());
  }, [open, editing]);

  const isEdit = !!editing;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        nameInTamil: form.nameInTamil.trim() || null,
        nameInSanskrit: form.nameInSanskrit.trim() || null,
        category: form.category,
        doshaEffectVata: form.doshaEffectVata,
        doshaEffectPitta: form.doshaEffectPitta,
        doshaEffectKapha: form.doshaEffectKapha,
        rasa: form.rasa,
        guna: form.guna,
        virya: form.virya,
        seasons: form.seasons,
        preparationMethods: splitCsv(form.preparationMethods),
        calories: numOrNull(form.calories),
        protein:  numOrNull(form.protein),
        carbs:    numOrNull(form.carbs),
        fat:      numOrNull(form.fat),
        fiber:    numOrNull(form.fiber),
        commonAllergies: splitCsv(form.commonAllergies).map((s) => s.toUpperCase()),
        isActive: form.isActive,
      };
      if (isEdit && editing) {
        return (await apiClient.put<AyurvedicFood>(`/api/ayurvedic-foods/${editing.id}`, payload)).data;
      }
      return (await apiClient.post<AyurvedicFood>("/api/ayurvedic-foods", payload)).data;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Food updated" : "Food added");
      qc.invalidateQueries({ queryKey: ["ayurvedic-foods"] });
      qc.invalidateQueries({ queryKey: ["food-db-stats"] });
      onClose();
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Save failed";
      toast.error(msg);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Ayurvedic Food" : "Add Ayurvedic Food"}</DialogTitle>
          <DialogDescription>
            Fields marked with <span className="text-destructive">*</span> are required. Allergy tags are auto-uppercased.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ashwagandha root" />
            </div>
            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as FoodCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tamil name</Label>
              <Input value={form.nameInTamil} onChange={(e) => setForm({ ...form, nameInTamil: e.target.value })} placeholder="அமுக்கரா" />
            </div>
            <div className="space-y-1.5">
              <Label>Sanskrit name</Label>
              <Input value={form.nameInSanskrit} onChange={(e) => setForm({ ...form, nameInSanskrit: e.target.value })} placeholder="अश्वगन्धा" />
            </div>
          </div>

          {/* Dosha effects */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dosha Effects</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["Vata", "Pitta", "Kapha"] as const).map((dosha) => {
                const key = `doshaEffect${dosha}` as const;
                return (
                  <div key={dosha} className="space-y-1">
                    <Label className="text-[11px]">{dosha}</Label>
                    <Select
                      value={form[key as keyof FormState] as string}
                      onValueChange={(v) => setForm({ ...form, [key]: v as DoshaEffect })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOSHA_EFFECTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>

          <ChipMultiSelect label="Rasa (taste)" options={RASAS} value={form.rasa} onChange={(v) => setForm({ ...form, rasa: v })} />
          <ChipMultiSelect label="Guna (qualities)" options={GUNAS} value={form.guna} onChange={(v) => setForm({ ...form, guna: v })} />
          <ChipMultiSelect label="Seasons" options={SEASONS} value={form.seasons} onChange={(v) => setForm({ ...form, seasons: v })} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Virya (energy)</Label>
              <Select value={form.virya} onValueChange={(v) => setForm({ ...form, virya: v as Virya })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VIRYAS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} id="is-active" />
              <Label htmlFor="is-active" className="cursor-pointer">Active</Label>
            </div>
          </div>

          {/* Nutrition */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nutrition (per 100g)</Label>
            <div className="grid grid-cols-5 gap-2">
              {(["calories","protein","carbs","fat","fiber"] as const).map((k) => (
                <div key={k} className="space-y-1">
                  <Label className="text-[11px]">{k[0].toUpperCase() + k.slice(1)}</Label>
                  <Input
                    type="number" step="any" min="0"
                    value={form[k] as string}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Preparation methods (comma-separated)</Label>
            <Textarea
              rows={2}
              value={form.preparationMethods}
              onChange={(e) => setForm({ ...form, preparationMethods: e.target.value })}
              placeholder="boil, steam, raw"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Common allergies (comma-separated)</Label>
            <Textarea
              rows={2}
              value={form.commonAllergies}
              onChange={(e) => setForm({ ...form, commonAllergies: e.target.value })}
              placeholder="NUTS, DAIRY, GLUTEN"
            />
            {form.commonAllergies.trim() && (
              <div className="flex flex-wrap gap-1 pt-1">
                {splitCsv(form.commonAllergies).map((a) => (
                  <Badge key={a} variant="outline" className="border-rose-300 text-rose-700 text-[10px]">{a.toUpperCase()}</Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Save changes" : "Add food"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
