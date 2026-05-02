import { useQuery } from "@tanstack/react-query";
import { Loader2, Clock, Users, Leaf } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import type { AyurvedicRecipe } from "@/types/ayurvedicFood";

interface Props {
  recipeId: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Read-only recipe viewer. Lazy-fetches the full recipe (with ingredients
 * and food joins) when the dialog is opened. The list endpoint returns the
 * lighter shape — we re-fetch here to get the joined food rows.
 */
export function RecipeDetailModal({ recipeId, open, onClose }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ayurvedic-recipe", recipeId],
    queryFn: async () => {
      if (!recipeId) return null;
      const { data } = await apiClient.get<AyurvedicRecipe>(`/api/ayurvedic-foods/recipes/${recipeId}`);
      return data;
    },
    enabled: !!recipeId && open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            {data?.name ?? "Recipe"}
          </DialogTitle>
          {data?.nameInTamil && (
            <DialogDescription>{data.nameInTamil}</DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading recipe…
          </div>
        ) : error ? (
          <div className="py-6 text-sm text-destructive">
            Couldn&apos;t load this recipe.
          </div>
        ) : !data ? null : (
          <div className="space-y-5">
            {data.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.imageUrl} alt={data.name} className="w-full max-h-56 object-cover rounded-lg" />
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {data.prepTimeMinutes + data.cookTimeMinutes} min total</span>
              <span className="text-[11px]">(prep {data.prepTimeMinutes} · cook {data.cookTimeMinutes})</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {data.servings} servings</span>
              <Badge variant="outline">{data.mealCategory}</Badge>
            </div>

            {data.doshaTargets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground self-center">Targets:</span>
                {data.doshaTargets.map((d) => (
                  <Badge key={d} variant="secondary">{d}</Badge>
                ))}
              </div>
            )}

            {data.description && (
              <p className="text-sm">{data.description}</p>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                Ingredients ({data.ingredients?.length ?? 0})
              </h3>
              {data.ingredients && data.ingredients.length > 0 ? (
                <ul className="divide-y border rounded-lg overflow-hidden">
                  {data.ingredients.map((ing) => (
                    <li key={ing.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {ing.food?.name ?? "—"}
                          {ing.food?.nameInTamil && (
                            <span className="text-xs text-muted-foreground ml-1.5">· {ing.food.nameInTamil}</span>
                          )}
                        </div>
                        {ing.notes && <div className="text-[11px] text-muted-foreground">{ing.notes}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {ing.quantity} {ing.unit}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">No ingredients listed.</p>
              )}
            </div>

            {data.instructions.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  Instructions
                </h3>
                <ol className="space-y-1.5 list-decimal pl-5 text-sm">
                  {data.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
