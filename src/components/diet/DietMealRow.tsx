import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, X, Link2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { HoverActionCard } from "@/components/common/HoverActionCard";
import { iwisApi, type DietMealPlan, type MealTime } from "@/services/iwis.service";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { FoodAutocomplete } from "./FoodAutocomplete";
import { DoshaEffectBadge } from "./DoshaEffectBadge";
import { AllergyConflictAlert } from "./AllergyConflictAlert";
import type {
  AllergyConflictResponse,
  DoshaTarget,
  FoodSuggestion,
  MealFoodLinks,
  DietMealFoodLink,
} from "@/types/ayurvedicFood";

interface DietMealRowProps {
  prescriptionId: string;
  meal: DietMealPlan;
  canManage: boolean;
  onChanged: () => void;
  // ── Optional Feature 1 wiring (additive). When patientId is provided
  // the structured-food section also runs an allergy conflict check after
  // each successful link. When doshaTarget is provided, the autocomplete
  // surfaces pacifying foods first.
  patientId?: string;
  doshaTarget?: DoshaTarget;
}

const UNIT_OPTIONS = ["grams", "cups", "tsp", "tbsp", "pieces", "ml"];

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

export function DietMealRow({ prescriptionId, meal, canManage, onChanged, patientId, doshaTarget }: DietMealRowProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Feature 1: structured Food links + allergy check ──────────────────────

  // Linker panel state — collapsed by default; expanded by + Link Food.
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);
  const [pickedFood, setPickedFood]       = useState<FoodSuggestion | null>(null);
  const [linkQty, setLinkQty]             = useState<string>("");
  const [linkUnit, setLinkUnit]           = useState<string>("grams");
  const [linkIsAvoid, setLinkIsAvoid]     = useState(false);

  const linksKey = ["meal-food-links", meal.id];
  const linksQuery = useQuery({
    queryKey: linksKey,
    queryFn: async () => {
      if (!meal.id) return { foods: [], avoidFoods: [] } as MealFoodLinks;
      const { data } = await apiClient.get<MealFoodLinks>(`/api/ayurvedic-foods/meals/${meal.id}/foods`);
      return data;
    },
    enabled: !!meal.id,
    staleTime: 30_000,
  });
  const links = linksQuery.data ?? { foods: [], avoidFoods: [] };

  // Allergy check runs against EVERY structured food currently on the meal
  // (both eat + avoid lists carry foodIds when picked from the catalogue).
  const allFoodIds = [...links.foods, ...links.avoidFoods]
    .map((l) => l.foodId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const conflictQuery = useQuery({
    queryKey: ["meal-food-conflict", meal.id, patientId, ...allFoodIds],
    queryFn: async () => {
      if (!meal.id || !patientId || allFoodIds.length === 0) {
        return { hasConflict: false, conflicts: [] } as AllergyConflictResponse;
      }
      const { data } = await apiClient.get<AllergyConflictResponse>(
        "/api/ayurvedic-foods/conflict-check",
        { foodIds: allFoodIds.join(","), patientId },
      );
      return data;
    },
    enabled: !!meal.id && !!patientId && allFoodIds.length > 0,
    staleTime: 30_000,
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!meal.id || !pickedFood) throw new Error("Pick a food first");
      const { data } = await apiClient.post<DietMealFoodLink>(
        `/api/ayurvedic-foods/meals/${meal.id}/foods`,
        {
          foodId: pickedFood.id,
          quantity: linkQty.trim() === "" ? null : Number(linkQty),
          unit: linkUnit || null,
          isAvoid: linkIsAvoid,
        },
      );
      return data;
    },
    onSuccess: () => {
      toast({ title: linkIsAvoid ? "Avoid-food linked" : "Food linked" });
      qc.invalidateQueries({ queryKey: linksKey });
      // Reset linker
      setPickedFood(null); setLinkQty(""); setLinkUnit("grams"); setLinkIsAvoid(false);
      setLinkPanelOpen(false);
    },
    onError: (err) => {
      toast({
        title: "Could not link food",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (link: DietMealFoodLink) => {
      if (!meal.id) return;
      await apiClient.delete(`/api/ayurvedic-foods/meals/${meal.id}/foods/${link.id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: linksKey });
    },
    onError: (err) => {
      toast({
        title: "Could not remove link",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

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

          {/* ── Feature 1: Structured food links (additive) ────────────────── */}
          {meal.id && (
            <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
              <div className="text-xs font-medium text-gray-600 dark:text-muted-foreground flex items-center gap-1.5">
                <Link2 className="w-3 h-3" /> Structured Foods
              </div>
              {linksQuery.isLoading ? (
                <div className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                </div>
              ) : links.foods.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No structured foods linked yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {links.foods.map((l) => (
                    <FoodChip
                      key={l.id}
                      link={l}
                      canRemove={canManage}
                      onRemove={() => unlinkMutation.mutate(l)}
                    />
                  ))}
                </div>
              )}

              {links.avoidFoods.length > 0 && (
                <>
                  <div className="text-xs font-medium text-rose-700 mt-2">Avoid Foods</div>
                  <div className="flex flex-wrap gap-1.5">
                    {links.avoidFoods.map((l) => (
                      <FoodChip
                        key={l.id}
                        link={l}
                        avoid
                        canRemove={canManage}
                        onRemove={() => unlinkMutation.mutate(l)}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Allergy conflict alert — only when patientId is provided
                  and the backend actually flagged something. */}
              {conflictQuery.data?.hasConflict && (
                <AllergyConflictAlert conflicts={conflictQuery.data.conflicts} className="mt-2" />
              )}

              {canManage && (
                <div className="pt-1">
                  {!linkPanelOpen ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setLinkPanelOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Link Food
                    </Button>
                  ) : (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <FoodAutocomplete
                        doshaTarget={doshaTarget}
                        onSelect={(food) => setPickedFood(food)}
                        placeholder="Search the food database…"
                      />
                      {pickedFood && (
                        <div className="text-[11px] text-muted-foreground">
                          Selected: <span className="font-semibold text-foreground">{pickedFood.name}</span>
                          {pickedFood.nameInTamil ? <> · {pickedFood.nameInTamil}</> : null}
                        </div>
                      )}
                      <div className="grid grid-cols-[80px_1fr_auto] gap-2 items-center">
                        <Input
                          type="number" step="any" min="0"
                          value={linkQty}
                          onChange={(e) => setLinkQty(e.target.value)}
                          placeholder="Qty"
                          className="h-8 text-xs"
                        />
                        <Select value={linkUnit} onValueChange={setLinkUnit}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkIsAvoid}
                            onChange={(e) => setLinkIsAvoid(e.target.checked)}
                          />
                          Mark as Avoid
                        </label>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <Button
                          type="button" variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => {
                            setLinkPanelOpen(false);
                            setPickedFood(null); setLinkQty(""); setLinkUnit("grams"); setLinkIsAvoid(false);
                          }}
                          disabled={linkMutation.isPending}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button" size="sm" className="h-7 text-xs"
                          disabled={!pickedFood || linkMutation.isPending}
                          onClick={() => linkMutation.mutate()}
                        >
                          {linkMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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

// ── Sub-component: structured-food chip with optional remove button ────────

function FoodChip({
  link, avoid, canRemove, onRemove,
}: {
  link: DietMealFoodLink;
  avoid?: boolean;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const display = link.food?.name ?? link.foodNameFree ?? "Unnamed";
  const qtyUnit = [link.quantity, link.unit].filter((v) => v !== null && v !== undefined && `${v}`.length > 0).join(" ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
        avoid
          ? "bg-rose-50 text-rose-900 border-rose-200"
          : "bg-emerald-50 text-emerald-900 border-emerald-200",
      )}
    >
      <span className="font-medium">{display}</span>
      {qtyUnit && <span className="opacity-70">{qtyUnit}</span>}
      {link.food && (
        <DoshaEffectBadge
          vata={link.food.doshaEffectVata}
          pitta={link.food.doshaEffectPitta}
          kapha={link.food.doshaEffectKapha}
        />
      )}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${display}`}
          className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
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
