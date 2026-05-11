import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Leaf, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { RecipeCard } from "@/components/diet/RecipeCard";
import { RecipeDetailModal } from "@/components/diet/RecipeDetailModal";
import { RecipeBuilderModal } from "@/components/diet/RecipeBuilderModal";
import type {
  AyurvedicRecipe,
  DoshaTarget,
  MealCategory,
  PaginatedRecipes,
} from "@/types/ayurvedicFood";

const PAGE_SIZE = 12;
const ALL = "ALL";

const DOSHA_TARGETS: DoshaTarget[] = ["VATA", "PITTA", "KAPHA", "TRIDOSHA"];
const MEAL_CATEGORIES: MealCategory[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK", "BEVERAGE", "GENERAL"];
const PREP_BUCKETS = ["UNDER_15", "UNDER_30", "UNDER_60"] as const;

/**
 * /recipe-library — reusable Ayurvedic recipe library.
 *
 * Roles: ADMIN | ADMIN_DOCTOR | DOCTOR | THERAPIST.
 *  - Author roles (ADMIN, ADMIN_DOCTOR, DOCTOR) get + New Recipe + per-card edit/delete
 *  - THERAPIST is view-only (consumes recipes when planning therapy meals)
 *  - Card click opens RecipeDetailModal (full recipe + ingredients)
 *  - Backend's per-route role guard mirrors this; the UI just hides the
 *    affordances so therapists never see disabled-state action buttons
 */
/**
 * RecipeLibraryContent — body of the recipe library WITHOUT AppLayout.
 * Exported so the combined Food Database / Recipe Library tabbed page can
 * render it inside its own layout without nesting Navigation twice.
 */
export function RecipeLibraryContent() {
  const { role } = useAuth();
  const qc = useQueryClient();

  const canAuthor = role === "ADMIN" || role === "ADMIN_DOCTOR" || role === "DOCTOR";

  // Filter state
  const [query, setQuery]                   = useState("");
  const [mealCategory, setMealCategory]     = useState<string>(ALL);
  const [doshaTarget, setDoshaTarget]       = useState<string>(ALL);
  const [prepBucket, setPrepBucket]         = useState<string>(ALL);
  const [page, setPage]                     = useState(1);

  // Modal state
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen]           = useState(false);
  const [editing, setEditing]                   = useState<AyurvedicRecipe | null>(null);

  const queryKey = useMemo(
    () => ["ayurvedic-recipes", { query, mealCategory, doshaTarget, page }],
    [query, mealCategory, doshaTarget, page],
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (query.trim())            params.query        = query.trim();
      if (mealCategory !== ALL)    params.mealCategory = mealCategory;
      if (doshaTarget !== ALL)     params.doshaTarget  = doshaTarget;
      const { data } = await apiClient.get<PaginatedRecipes>("/api/ayurvedic-foods/recipes", params);
      return data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  // Prep-time filter is applied client-side — the backend doesn't index on
  // total time and the bucket filter is a UX nicety. Kept here so the URL
  // /// state stays simple (no server param needed).
  const filteredRecipes = useMemo(() => {
    if (!data) return [];
    if (prepBucket === ALL) return data.data;
    const cap = prepBucket === "UNDER_15" ? 15 : prepBucket === "UNDER_30" ? 30 : 60;
    return data.data.filter((r) => (r.prepTimeMinutes + r.cookTimeMinutes) <= cap);
  }, [data, prepBucket]);

  const deleteMutation = useMutation({
    mutationFn: async (recipe: AyurvedicRecipe) => {
      await apiClient.delete(`/api/ayurvedic-foods/recipes/${recipe.id}`);
      return recipe;
    },
    onSuccess: (recipe) => {
      toast.success(`${recipe.name} deleted`);
      qc.invalidateQueries({ queryKey: ["ayurvedic-recipes"] });
      qc.invalidateQueries({ queryKey: ["food-db-stats"] });
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    },
  });

  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        <PageHeader
          title="📖 Recipe Library"
          subtitle="Reusable Ayurvedic recipes built from foods in your branch's database."
        >
          {canAuthor && (
            <Button onClick={() => { setEditing(null); setBuilderOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> New Recipe
            </Button>
          )}
        </PageHeader>

        {/* Filter bar */}
        <div className="rounded-xl border bg-card p-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={mealCategory} onValueChange={(v) => { setMealCategory(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Meal Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All meals</SelectItem>
              {MEAL_CATEGORIES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={doshaTarget} onValueChange={(v) => { setDoshaTarget(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Dosha Target" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any dosha</SelectItem>
              {DOSHA_TARGETS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prepBucket} onValueChange={(v) => setPrepBucket(v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Prep time" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any time</SelectItem>
              {PREP_BUCKETS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b === "UNDER_15" ? "Under 15 min"
                  : b === "UNDER_30" ? "Under 30 min"
                                     : "Under 60 min"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            Failed to load recipes. {error instanceof Error ? error.message : ""}
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-secondary/5 py-16 px-6 text-center">
            <Leaf className="w-12 h-12 mx-auto mb-3 text-emerald-700/40" />
            <p className="text-sm text-muted-foreground mb-4">
              {prepBucket !== ALL && data && data.data.length > 0
                ? "No recipes match the prep-time filter. Widen the filter or clear it."
                : "No recipes yet. Build the first one to seed your library."}
            </p>
            {canAuthor && (
              <Button onClick={() => { setEditing(null); setBuilderOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> New Recipe
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  showActions={canAuthor}
                  onClick={() => setSelectedRecipeId(recipe.id)}
                  onEdit={(r) => { setEditing(r); setBuilderOpen(true); }}
                  onDelete={async (r) => { await deleteMutation.mutateAsync(r); }}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Showing {(data!.pagination.page - 1) * data!.pagination.limit + 1}
                  –{Math.min(data!.pagination.page * data!.pagination.limit, data!.pagination.total)}
                  {" of "}{data!.pagination.total}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline" size="sm" className="h-8 w-8 p-0"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isLoading}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-2 tabular-nums">Page {page} of {totalPages}</span>
                  <Button
                    variant="outline" size="sm" className="h-8 w-8 p-0"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modals */}
        <RecipeDetailModal
          recipeId={selectedRecipeId}
          open={selectedRecipeId !== null}
          onClose={() => setSelectedRecipeId(null)}
        />
        <RecipeBuilderModal
          open={builderOpen}
          editing={editing}
          onClose={() => { setBuilderOpen(false); setEditing(null); }}
        />
      </div>
  );
}

/**
 * /recipe-library — legacy route now points at the combined Food Database
 * page with the recipes tab pre-selected. Keeps existing deep links alive.
 */
export default function RecipeLibrary() {
  return <Navigate to="/food-database?tab=recipes" replace />;
}
