import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Pencil, Trash2 } from "lucide-react";
import { DoshaEffectBadge } from "./DoshaEffectBadge";
import type { AyurvedicFood } from "@/types/ayurvedicFood";
import { cn } from "@/lib/utils";

interface Props {
  food: AyurvedicFood;
  showActions?: boolean;
  onEdit?: (food: AyurvedicFood) => void;
  onDelete?: (food: AyurvedicFood) => void | Promise<void>;
}

const CATEGORY_TONE: Record<string, string> = {
  GRAIN:     "bg-amber-100 text-amber-900 border-amber-200",
  VEGETABLE: "bg-emerald-100 text-emerald-900 border-emerald-200",
  FRUIT:     "bg-rose-100 text-rose-900 border-rose-200",
  DAIRY:     "bg-sky-100 text-sky-900 border-sky-200",
  SPICE:     "bg-orange-100 text-orange-900 border-orange-200",
  OIL:       "bg-yellow-100 text-yellow-900 border-yellow-200",
  LEGUME:    "bg-lime-100 text-lime-900 border-lime-200",
  MEAT:      "bg-red-100 text-red-900 border-red-200",
  HERB:      "bg-teal-100 text-teal-900 border-teal-200",
  BEVERAGE:  "bg-indigo-100 text-indigo-900 border-indigo-200",
  OTHER:     "bg-slate-100 text-slate-900 border-slate-200",
};

/**
 * Single AyurvedicFood card for the FoodDatabase grid.
 * Edit / Delete are gated by `showActions` — caller decides per-role.
 * Delete uses an inline shadcn AlertDialog confirm.
 */
export function FoodCard({ food, showActions = false, onEdit, onDelete }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(food);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="font-semibold leading-tight truncate">{food.name}</h3>
                {food.nameInTamil && (
                  <span className="text-xs text-muted-foreground">{food.nameInTamil}</span>
                )}
              </div>
              {food.nameInSanskrit && (
                <p className="text-[11px] text-muted-foreground italic">{food.nameInSanskrit}</p>
              )}
            </div>
            <Badge variant="outline" className={cn("text-[10px] shrink-0", CATEGORY_TONE[food.category] ?? CATEGORY_TONE.OTHER)}>
              {food.category}
            </Badge>
          </div>

          <DoshaEffectBadge
            vata={food.doshaEffectVata}
            pitta={food.doshaEffectPitta}
            kapha={food.doshaEffectKapha}
          />

          {(food.rasa.length > 0 || food.guna.length > 0 || food.virya !== "NEUTRAL") && (
            <div className="flex flex-wrap gap-1 text-[10px]">
              {food.rasa.slice(0, 3).map((r) => (
                <Badge key={`rasa-${r}`} variant="secondary" className="text-[10px]">{r}</Badge>
              ))}
              {food.guna.slice(0, 2).map((g) => (
                <Badge key={`guna-${g}`} variant="outline" className="text-[10px]">{g}</Badge>
              ))}
              {food.virya && food.virya !== "NEUTRAL" && (
                <Badge variant="outline" className={cn("text-[10px]", food.virya === "HOT" ? "border-rose-300 text-rose-800" : "border-sky-300 text-sky-800")}>
                  {food.virya}
                </Badge>
              )}
            </div>
          )}

          {(food.calories != null || food.protein != null) && (
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
              {food.calories != null && <span>{Math.round(food.calories)} kcal</span>}
              {food.protein != null  && <span>P {food.protein}g</span>}
              {food.carbs != null    && <span>C {food.carbs}g</span>}
              {food.fat != null      && <span>F {food.fat}g</span>}
              {food.fiber != null    && <span>Fb {food.fiber}g</span>}
            </div>
          )}

          {food.commonAllergies.length > 0 && (
            <div className="text-[11px]">
              <span className="font-semibold text-rose-700">⚠ Allergens: </span>
              <span className="text-rose-600">{food.commonAllergies.join(", ")}</span>
            </div>
          )}

          {showActions && (
            <div className="flex items-center justify-end gap-1 pt-1 border-t">
              <Button variant="ghost" size="sm" onClick={() => onEdit?.(food)}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{food.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              If recipes or diet plans reference this food it will be deactivated to preserve those references; otherwise it&apos;s permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
