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
import { Clock, Users, Pencil, Trash2, Leaf } from "lucide-react";
import type { AyurvedicRecipe } from "@/types/ayurvedicFood";

interface Props {
  recipe: AyurvedicRecipe;
  showActions?: boolean;
  onClick?: (recipe: AyurvedicRecipe) => void;
  onEdit?: (recipe: AyurvedicRecipe) => void;
  onDelete?: (recipe: AyurvedicRecipe) => void | Promise<void>;
}

/**
 * Single recipe card for the RecipeLibrary grid. Whole card is clickable
 * (calls onClick → opens RecipeDetailModal); the action buttons are
 * stopPropagation'd so they don't also trigger the click.
 */
export function RecipeCard({ recipe, showActions = false, onClick, onEdit, onDelete }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;

  async function handleConfirm() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(recipe);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Card
        className="overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
        onClick={() => onClick?.(recipe)}
      >
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-32 object-cover" />
        ) : (
          <div className="w-full h-32 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
            <Leaf className="w-10 h-10 text-emerald-700/40" />
          </div>
        )}
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold leading-tight truncate">{recipe.name}</h3>
              {recipe.nameInTamil && (
                <p className="text-xs text-muted-foreground">{recipe.nameInTamil}</p>
              )}
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">{recipe.mealCategory}</Badge>
          </div>

          {recipe.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{recipe.description}</p>
          )}

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {totalTime} min
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> {recipe.servings} serv.
            </span>
            <span>{recipe._count?.ingredients ?? recipe.ingredients?.length ?? 0} ing.</span>
          </div>

          {recipe.doshaTargets.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.doshaTargets.slice(0, 3).map((d) => (
                <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
              ))}
            </div>
          )}

          {showActions && (
            <div
              className="flex items-center justify-end gap-1 pt-1 border-t"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="sm" onClick={() => onEdit?.(recipe)}>
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
            <AlertDialogTitle>Delete &ldquo;{recipe.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The recipe and all of its ingredient rows will be permanently removed. This cannot be undone.
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
