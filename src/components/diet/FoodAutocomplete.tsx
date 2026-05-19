import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DoshaEffectBadge } from "./DoshaEffectBadge";
import type {
  DoshaTarget,
  FoodSuggestion,
  RecipeSuggestion,
  FoodOrRecipeSuggestion,
} from "@/types/ayurvedicFood";

// Overloaded prop shape: when `includeRecipes` is true the consumer must
// accept a `FoodOrRecipeSuggestion` (discriminated by `kind`). Without
// the flag, the component behaves like before and emits `FoodSuggestion`.
interface BaseProps {
  /** Optional dosha target — pacifying matches are bumped to the top. */
  doshaTarget?: DoshaTarget;
  /** Initial value rendered into the input. Useful when editing an existing link. */
  initialValue?: string;
  placeholder?: string;
  className?: string;
}
type Props =
  | (BaseProps & {
      includeRecipes?: false;
      onSelect: (food: FoodSuggestion) => void;
    })
  | (BaseProps & {
      includeRecipes: true;
      onSelect: (picked: FoodOrRecipeSuggestion) => void;
    });

/**
 * Typeahead input over /api/ayurvedic-foods/suggest.
 *
 * Behaviour:
 *  - Debounced 250ms — keystrokes within the window collapse into one fetch
 *  - Empty query → fetches a default suggestion list (top alphabetical)
 *  - Pressing Enter or clicking a row fires onSelect, then clears the input
 *  - Doesn't know about the parent's controlled state; the parent decides
 *    what to do with the picked food (link to meal, add as ingredient, …)
 */
export function FoodAutocomplete(props: Props) {
  const { doshaTarget, initialValue = "", placeholder, className } = props;
  const includeRecipes = props.includeRecipes === true;
  const [text, setText] = useState(initialValue);
  const [debounced, setDebounced] = useState(initialValue);
  const [open, setOpen] = useState(false);

  // Debounce text → debounced. Keeps the suggest endpoint quiet during typing.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 250);
    return () => clearTimeout(t);
  }, [text]);

  const foodQuery = useQuery({
    queryKey: ["ayurvedic-food-suggest", debounced, doshaTarget ?? null],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 8 };
      if (debounced.trim()) params.query = debounced.trim();
      if (doshaTarget) params.doshaTarget = doshaTarget;
      const { data } = await apiClient.get<FoodSuggestion[]>("/api/ayurvedic-foods/suggest", params);
      return data;
    },
    enabled: open, // only fetch while the dropdown is visible
    staleTime: 30_000,
  });

  // Recipe results run in parallel. We deliberately fire both queries on
  // every keystroke (within debounce) so the dropdown can show a mixed
  // list without one source blocking the other.
  const recipeQuery = useQuery({
    queryKey: ["ayurvedic-recipe-suggest", debounced, doshaTarget ?? null],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 5 };
      if (debounced.trim()) params.query = debounced.trim();
      if (doshaTarget) params.doshaTarget = doshaTarget;
      const { data } = await apiClient.get<RecipeSuggestion[]>("/api/ayurvedic-foods/recipes/suggest", params);
      return data;
    },
    enabled: open && includeRecipes,
    staleTime: 30_000,
  });

  const isLoading = foodQuery.isLoading || (includeRecipes && recipeQuery.isLoading);

  // Merge foods + recipes into one list. Recipes are surfaced FIRST when
  // the user is actively searching (typed query) — clinicians usually
  // remember a recipe by name and the bulk-add value is high. With an
  // empty query we keep the original "browse foods" feel and show foods
  // first instead.
  const items: FoodOrRecipeSuggestion[] = useMemo(() => {
    const foods: FoodOrRecipeSuggestion[] = (foodQuery.data ?? []).map((f) => ({ kind: "food" as const, ...f }));
    if (!includeRecipes) return foods;
    const recipes: FoodOrRecipeSuggestion[] = (recipeQuery.data ?? []).map((r) => ({ kind: "recipe" as const, ...r }));
    const querying = debounced.trim().length > 0;
    return querying ? [...recipes, ...foods] : [...foods, ...recipes];
  }, [foodQuery.data, recipeQuery.data, includeRecipes, debounced]);

  function pick(item: FoodOrRecipeSuggestion) {
    if (item.kind === "recipe") {
      // The `includeRecipes` guard at the type level ensures we only
      // emit recipe picks when the parent opted in. Narrow with cast.
      (props.onSelect as (picked: FoodOrRecipeSuggestion) => void)(item);
    } else {
      // Strip the discriminator before handing back a plain FoodSuggestion
      // so the back-compat onSelect signature stays clean.
      const { kind: _kind, ...food } = item;
      void _kind;
      if (includeRecipes) {
        (props.onSelect as (picked: FoodOrRecipeSuggestion) => void)(item);
      } else {
        (props.onSelect as (food: FoodSuggestion) => void)(food);
      }
    }
    setText("");
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={text}
          placeholder={placeholder ?? "Search food (e.g. Ashwagandha)…"}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Defer so onClick on a list item lands before we hide it.
            setTimeout(() => setOpen(false), 150);
          }}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && items[0]) {
              e.preventDefault();
              pick(items[0]);
            }
          }}
          className="pl-7"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Searching…
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground italic">
              {includeRecipes
                ? "No matching foods or recipes. Add one from the Food Database + Recipes page."
                : "No matching foods. Add one in the Food Database."}
            </div>
          ) : (
            <ul className="py-1">
              {items.map((item) => (
                <li key={`${item.kind}:${item.id}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(item)}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5">
                        {item.kind === "recipe" && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                            <BookOpen className="w-2.5 h-2.5" /> Recipe
                          </span>
                        )}
                        <span className="truncate">{item.name}</span>
                        {item.nameInTamil ? <span className="text-xs text-muted-foreground">· {item.nameInTamil}</span> : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.kind === "food" ? (
                          <>
                            {item.category}
                            {item.calories != null ? ` · ${Math.round(item.calories)} kcal` : ""}
                          </>
                        ) : (
                          <>
                            {item._count?.ingredients ?? 0} ingredient{(item._count?.ingredients ?? 0) === 1 ? "" : "s"}
                            {item.mealCategory && item.mealCategory !== "GENERAL" ? ` · ${item.mealCategory}` : ""}
                          </>
                        )}
                      </div>
                    </div>
                    {item.kind === "food" && (
                      <DoshaEffectBadge
                        vata={item.doshaEffectVata}
                        pitta={item.doshaEffectPitta}
                        kapha={item.doshaEffectKapha}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
