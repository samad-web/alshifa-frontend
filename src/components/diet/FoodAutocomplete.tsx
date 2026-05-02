import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DoshaEffectBadge } from "./DoshaEffectBadge";
import type { DoshaTarget, FoodSuggestion } from "@/types/ayurvedicFood";

interface Props {
  /** Optional dosha target — pacifying matches are bumped to the top. */
  doshaTarget?: DoshaTarget;
  /** Fired when the user picks a row. */
  onSelect: (food: FoodSuggestion) => void;
  /** Initial value rendered into the input. Useful when editing an existing link. */
  initialValue?: string;
  placeholder?: string;
  className?: string;
}

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
export function FoodAutocomplete({ doshaTarget, onSelect, initialValue = "", placeholder, className }: Props) {
  const [text, setText] = useState(initialValue);
  const [debounced, setDebounced] = useState(initialValue);
  const [open, setOpen] = useState(false);

  // Debounce text → debounced. Keeps the suggest endpoint quiet during typing.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 250);
    return () => clearTimeout(t);
  }, [text]);

  const { data, isLoading } = useQuery({
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

  const items = useMemo(() => data ?? [], [data]);

  function pick(food: FoodSuggestion) {
    onSelect(food);
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
              No matching foods. Add one in the Food Database.
            </div>
          ) : (
            <ul className="py-1">
              {items.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(f)}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {f.name}
                        {f.nameInTamil ? <span className="text-xs text-muted-foreground ml-1.5">· {f.nameInTamil}</span> : null}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {f.category}
                        {f.calories != null ? ` · ${Math.round(f.calories)} kcal` : ""}
                      </div>
                    </div>
                    <DoshaEffectBadge
                      vata={f.doshaEffectVata}
                      pitta={f.doshaEffectPitta}
                      kapha={f.doshaEffectKapha}
                    />
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
