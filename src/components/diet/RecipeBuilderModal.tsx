import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
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
import { FoodAutocomplete } from "./FoodAutocomplete";
import type {
  AyurvedicRecipe,
  DoshaTarget,
  MealCategory,
  RecipeIngredientInput,
  FoodSuggestion,
} from "@/types/ayurvedicFood";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pass an existing recipe to edit; omit for create. */
  editing?: AyurvedicRecipe | null;
}

const DOSHA_TARGETS: DoshaTarget[] = ["VATA", "PITTA", "KAPHA", "TRIDOSHA"];
const MEAL_CATEGORIES: MealCategory[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK", "BEVERAGE", "GENERAL"];

interface IngredientRow extends RecipeIngredientInput {
  /** Display-only name carried alongside foodId so the row stays readable
   *  while the user is filling out quantity/unit. Not sent to the backend. */
  _foodName?: string;
  _foodNameInTamil?: string | null;
}

interface FormState {
  name: string;
  nameInTamil: string;
  description: string;
  doshaTargets: DoshaTarget[];
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  servings: string;
  mealCategory: MealCategory;
  imageUrl: string;
  isActive: boolean;
  instructions: string[];
  ingredients: IngredientRow[];
}

function initialForm(): FormState {
  return {
    name: "", nameInTamil: "", description: "",
    doshaTargets: [], prepTimeMinutes: "0", cookTimeMinutes: "0", servings: "2",
    mealCategory: "GENERAL", imageUrl: "", isActive: true,
    instructions: [""],
    ingredients: [],
  };
}

function fromRecipe(r: AyurvedicRecipe): FormState {
  return {
    name: r.name,
    nameInTamil: r.nameInTamil ?? "",
    description: r.description ?? "",
    doshaTargets: (r.doshaTargets ?? []) as DoshaTarget[],
    prepTimeMinutes: String(r.prepTimeMinutes ?? 0),
    cookTimeMinutes: String(r.cookTimeMinutes ?? 0),
    servings: String(r.servings ?? 2),
    mealCategory: (r.mealCategory as MealCategory) || "GENERAL",
    imageUrl: r.imageUrl ?? "",
    isActive: r.isActive,
    instructions: r.instructions?.length ? r.instructions.slice() : [""],
    ingredients: (r.ingredients ?? []).map((ing) => ({
      foodId: ing.foodId,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes ?? null,
      sortOrder: ing.sortOrder,
      _foodName: ing.food?.name,
      _foodNameInTamil: ing.food?.nameInTamil,
    })),
  };
}

export function RecipeBuilderModal({ open, onClose, editing }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(initialForm());

  useEffect(() => {
    if (!open) return;
    setForm(editing ? fromRecipe(editing) : initialForm());
  }, [open, editing]);

  const isEdit = !!editing;

  function addIngredientFromFood(food: FoodSuggestion) {
    setForm((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          foodId: food.id,
          quantity: 1,
          unit: "",
          notes: null,
          sortOrder: prev.ingredients.length,
          _foodName: food.name,
          _foodNameInTamil: food.nameInTamil ?? null,
        },
      ],
    }));
  }

  function removeIngredient(idx: number) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients
        .filter((_, i) => i !== idx)
        .map((row, i) => ({ ...row, sortOrder: i })),
    }));
  }

  function updateIngredient(idx: number, patch: Partial<IngredientRow>) {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((row, i) => i === idx ? { ...row, ...patch } : row),
    }));
  }

  function moveIngredient(idx: number, dir: -1 | 1) {
    setForm((prev) => {
      const next = prev.ingredients.slice();
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return {
        ...prev,
        ingredients: next.map((row, i) => ({ ...row, sortOrder: i })),
      };
    });
  }

  function addStep() {
    setForm((prev) => ({ ...prev, instructions: [...prev.instructions, ""] }));
  }
  function updateStep(idx: number, val: string) {
    setForm((prev) => ({
      ...prev,
      instructions: prev.instructions.map((s, i) => (i === idx ? val : s)),
    }));
  }
  function removeStep(idx: number) {
    setForm((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== idx),
    }));
  }

  function toggleDosha(d: DoshaTarget) {
    setForm((prev) => ({
      ...prev,
      doshaTargets: prev.doshaTargets.includes(d)
        ? prev.doshaTargets.filter((x) => x !== d)
        : [...prev.doshaTargets, d],
    }));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanedIngredients = form.ingredients.map((ing, i) => ({
        foodId: ing.foodId,
        quantity: Number(ing.quantity) || 0,
        unit: ing.unit || "",
        notes: ing.notes || null,
        sortOrder: i,
      }));
      const cleanedSteps = form.instructions.map((s) => s.trim()).filter(Boolean);
      const payload = {
        name: form.name.trim(),
        nameInTamil: form.nameInTamil.trim() || null,
        description: form.description.trim() || null,
        doshaTargets: form.doshaTargets,
        prepTimeMinutes: Math.max(0, Number(form.prepTimeMinutes) || 0),
        cookTimeMinutes: Math.max(0, Number(form.cookTimeMinutes) || 0),
        servings: Math.max(1, Number(form.servings) || 1),
        instructions: cleanedSteps,
        mealCategory: form.mealCategory,
        imageUrl: form.imageUrl.trim() || null,
        isActive: form.isActive,
        ingredients: cleanedIngredients,
      };
      if (isEdit && editing) {
        return (await apiClient.put<AyurvedicRecipe>(`/api/ayurvedic-foods/recipes/${editing.id}`, payload)).data;
      }
      return (await apiClient.post<AyurvedicRecipe>("/api/ayurvedic-foods/recipes", payload)).data;
    },
    onSuccess: () => {
      toast.success(isEdit ? "Recipe updated" : "Recipe created");
      qc.invalidateQueries({ queryKey: ["ayurvedic-recipes"] });
      qc.invalidateQueries({ queryKey: ["ayurvedic-recipe", editing?.id] });
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
      toast.error("Recipe name is required");
      return;
    }
    if (form.ingredients.some((ing) => !ing.foodId || !ing.unit.trim() || ing.quantity <= 0)) {
      toast.error("Each ingredient needs a food, quantity, and unit");
      return;
    }
    saveMutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Recipe" : "New Recipe"}</DialogTitle>
          <DialogDescription>
            Build a reusable Ayurvedic recipe. Ingredients are picked from the Food Database; instructions are free-text.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5 py-2">
          {/* Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Kitchari" />
            </div>
            <div className="space-y-1.5">
              <Label>Tamil name</Label>
              <Input value={form.nameInTamil} onChange={(e) => setForm({ ...form, nameInTamil: e.target.value })} placeholder="கிச்சடி" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Light, balanced one-pot dish for tridoshic patients."
            />
          </div>

          {/* Targets + meal category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Dosha Targets</Label>
              <div className="flex flex-wrap gap-1.5">
                {DOSHA_TARGETS.map((d) => {
                  const selected = form.doshaTargets.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDosha(d)}
                      className={
                        "px-2.5 py-1 rounded-full text-[11px] border " +
                        (selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-muted")
                      }
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Meal category</Label>
              <Select value={form.mealCategory} onValueChange={(v) => setForm({ ...form, mealCategory: v as MealCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEAL_CATEGORIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Times + servings */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Prep (min)</Label>
              <Input type="number" min="0" value={form.prepTimeMinutes} onChange={(e) => setForm({ ...form, prepTimeMinutes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cook (min)</Label>
              <Input type="number" min="0" value={form.cookTimeMinutes} onChange={(e) => setForm({ ...form, cookTimeMinutes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Servings</Label>
              <Input type="number" min="1" value={form.servings} onChange={(e) => setForm({ ...form, servings: e.target.value })} />
            </div>
          </div>

          {/* Image + active */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Image URL (optional)</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} id="recipe-active" />
              <Label htmlFor="recipe-active" className="cursor-pointer">Active</Label>
            </div>
          </div>

          {/* Ingredients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Ingredients {form.ingredients.length > 0 && <Badge variant="outline" className="ml-1.5">{form.ingredients.length}</Badge>}
              </Label>
            </div>
            <FoodAutocomplete onSelect={addIngredientFromFood} placeholder="Search a food to add as ingredient…" />
            {form.ingredients.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No ingredients yet. Search above to add.</p>
            ) : (
              <ul className="border rounded-lg divide-y overflow-hidden">
                {form.ingredients.map((ing, idx) => (
                  <li key={idx} className="grid grid-cols-[1fr_80px_80px_auto] gap-2 items-center px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {ing._foodName ?? "—"}
                        {ing._foodNameInTamil && (
                          <span className="text-xs text-muted-foreground ml-1.5">· {ing._foodNameInTamil}</span>
                        )}
                      </div>
                      <Input
                        value={ing.notes ?? ""}
                        onChange={(e) => updateIngredient(idx, { notes: e.target.value })}
                        placeholder="Notes (optional)"
                        className="h-7 text-xs mt-1"
                      />
                    </div>
                    <Input
                      type="number" min="0" step="any"
                      value={Number.isFinite(ing.quantity) ? ing.quantity : ""}
                      onChange={(e) => updateIngredient(idx, { quantity: Number(e.target.value) })}
                      placeholder="Qty"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={ing.unit}
                      onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                      placeholder="g / cup"
                      className="h-8 text-xs"
                    />
                    <div className="flex flex-col gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveIngredient(idx, -1)} disabled={idx === 0}>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveIngredient(idx, 1)} disabled={idx === form.ingredients.length - 1}>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeIngredient(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Instructions</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addStep}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add step
              </Button>
            </div>
            <ol className="space-y-2">
              {form.instructions.map((step, idx) => (
                <li key={idx} className="flex gap-2 items-start">
                  <span className="text-xs text-muted-foreground tabular-nums pt-2 w-6 text-right">{idx + 1}.</span>
                  <Textarea
                    rows={2}
                    value={step}
                    onChange={(e) => updateStep(idx, e.target.value)}
                    placeholder={`Step ${idx + 1}`}
                    className="flex-1 text-sm"
                  />
                  {form.instructions.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="text-destructive mt-1" onClick={() => removeStep(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saveMutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Save changes" : "Create recipe"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
