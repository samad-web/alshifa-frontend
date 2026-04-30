import { useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { HoverActionCard } from "@/components/common/HoverActionCard";
import { iwisApi, type DietMealPlan, type MealTime } from "@/services/iwis.service";
import { ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface DietMealRowProps {
  prescriptionId: string;
  meal: DietMealPlan;
  canManage: boolean;
  onChanged: () => void;
}

const MEAL_LABEL: Record<MealTime, string> = {
  MORNING_EMPTY: "🌅 Morning (empty stomach)",
  BREAKFAST:     "🥣 Breakfast",
  MID_MORNING:   "🍵 Mid-morning",
  LUNCH:         "🍛 Lunch",
  EVENING:       "☕ Evening",
  DINNER:        "🍲 Dinner",
  BEDTIME:       "🌙 Bedtime",
};

// Time-of-day chip colours — keeps the row scannable at a glance.
const MEAL_TONE: Record<MealTime, string> = {
  MORNING_EMPTY: "bg-amber-100 text-amber-900 border-amber-200",
  BREAKFAST:     "bg-orange-100 text-orange-900 border-orange-200",
  MID_MORNING:   "bg-yellow-100 text-yellow-900 border-yellow-200",
  LUNCH:         "bg-emerald-100 text-emerald-900 border-emerald-200",
  EVENING:       "bg-sky-100 text-sky-900 border-sky-200",
  DINNER:        "bg-violet-100 text-violet-900 border-violet-200",
  BEDTIME:       "bg-slate-200 text-slate-900 border-slate-300",
};

type FoodRow = { name: string; quantity?: string; unit?: string; notes?: string };
type AvoidRow = { name: string; reason?: string };

export function DietMealRow({ prescriptionId, meal, canManage, onChanged }: DietMealRowProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local working copies seeded from props on dialog open. Edits don't bleed
  // back into the parent until a successful PUT lands.
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [avoidFoods, setAvoidFoods] = useState<AvoidRow[]>([]);
  const [instructions, setInstructions] = useState("");

  function openEdit() {
    setFoods(meal.foods.length > 0 ? meal.foods.map((f) => ({ ...f })) : [{ name: "" }]);
    setAvoidFoods(meal.avoidFoods.length > 0 ? meal.avoidFoods.map((f) => ({ ...f })) : []);
    setInstructions(meal.instructions ?? "");
    setEditing(true);
  }

  async function handleSave() {
    if (!meal.id) {
      toast({ title: "This meal isn't saved yet.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await iwisApi.updateDietMeal(prescriptionId, meal.id, {
        foods: foods.filter((f) => f.name.trim().length > 0),
        avoidFoods: avoidFoods.filter((f) => f.name.trim().length > 0),
        instructions: instructions.trim(),
      });
      toast({ title: "Meal updated" });
      setEditing(false);
      onChanged();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!meal.id) return;
    try {
      await iwisApi.deleteDietMeal(prescriptionId, meal.id);
      toast({ title: "Meal removed" });
      onChanged();
    } catch (err) {
      if (err instanceof ApiClientError && (err.payload as { code?: string } | undefined)?.code === "LAST_MEAL") {
        toast({
          title: "Cannot delete last meal",
          description: err.message,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <>
      <HoverActionCard
        canEdit={canManage && !!meal.id}
        canDelete={canManage && !!meal.id}
        onEdit={openEdit}
        onDelete={handleDelete}
        deleteTitle={`Remove "${MEAL_LABEL[meal.mealTime]}"?`}
        deleteDescription="This meal slot will be removed from the prescription. Adherence history is unaffected."
      >
        <div className="p-3 rounded-lg bg-secondary/5 border border-border/40">
          <div className="flex items-start justify-between mb-2 gap-2">
            <Badge variant="outline" className={cn("text-[11px]", MEAL_TONE[meal.mealTime])}>
              {MEAL_LABEL[meal.mealTime]}
            </Badge>
          </div>
          {meal.foods.length > 0 && (
            <div className="text-xs">
              <span className="font-bold text-wellness">Eat:</span>{" "}
              {meal.foods.map((f, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  {f.name}
                  {(f.quantity || f.unit) && <span className="text-muted-foreground"> ({[f.quantity, f.unit].filter(Boolean).join(" ")})</span>}
                </span>
              ))}
            </div>
          )}
          {meal.avoidFoods.length > 0 && (
            <div className="text-xs mt-1">
              <span className="font-bold text-destructive">Avoid:</span>{" "}
              <span className="text-destructive/80">
                {meal.avoidFoods.map((f) => f.name).join(", ")}
              </span>
            </div>
          )}
          {meal.instructions && (
            <div className="text-xs text-muted-foreground italic mt-1">{meal.instructions}</div>
          )}
        </div>
      </HoverActionCard>

      <Dialog open={editing} onOpenChange={(o) => !o && setEditing(false)}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {MEAL_LABEL[meal.mealTime]}</DialogTitle>
            <DialogDescription>The meal slot itself is fixed. Update foods, items to avoid, and instructions.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <FoodList
              title="Foods to eat"
              rows={foods}
              setRows={setFoods}
              showQuantityFields
            />
            <FoodList
              title="Foods to avoid"
              rows={avoidFoods}
              setRows={setAvoidFoods}
              showReasonField
            />
            <div className="space-y-2">
              <Label>Instructions</Label>
              <Textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="E.g. Eat warm. Chew thoroughly."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Sub-component: dynamic foods / avoidFoods row builder ───────────────────

interface FoodListProps<T extends FoodRow | AvoidRow> {
  title: string;
  rows: T[];
  setRows: (next: T[]) => void;
  showQuantityFields?: boolean;
  showReasonField?: boolean;
}

function FoodList<T extends FoodRow | AvoidRow>({
  title, rows, setRows, showQuantityFields, showReasonField,
}: FoodListProps<T>) {
  function update(i: number, patch: Partial<T>) {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    setRows(next);
  }
  function add() {
    const blank = (showReasonField ? { name: "", reason: "" } : { name: "" }) as T;
    setRows([...rows, blank]);
  }
  function remove(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No items.</p>
      )}
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn("grid gap-2 items-center", showQuantityFields ? "grid-cols-[1fr_80px_80px_auto]" : "grid-cols-[1fr_1fr_auto]")}
        >
          <Input
            value={row.name}
            onChange={(e) => update(i, { name: e.target.value } as Partial<T>)}
            placeholder="Food name"
          />
          {showQuantityFields && (
            <>
              <Input
                value={(row as FoodRow).quantity ?? ""}
                onChange={(e) => update(i, { quantity: e.target.value } as unknown as Partial<T>)}
                placeholder="Qty"
              />
              <Input
                value={(row as FoodRow).unit ?? ""}
                onChange={(e) => update(i, { unit: e.target.value } as unknown as Partial<T>)}
                placeholder="Unit"
              />
            </>
          )}
          {showReasonField && (
            <Input
              value={(row as AvoidRow).reason ?? ""}
              onChange={(e) => update(i, { reason: e.target.value } as unknown as Partial<T>)}
              placeholder="Reason (optional)"
            />
          )}
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
