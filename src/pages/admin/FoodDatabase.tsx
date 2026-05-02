import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Search, Leaf, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
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
import { FoodCard } from "@/components/diet/FoodCard";
import { AddFoodModal } from "@/components/diet/AddFoodModal";
import { BulkImportModal } from "@/components/diet/BulkImportModal";
import type {
  AyurvedicFood,
  FoodCategory,
  FoodDatabaseStats,
  PaginatedFoods,
  Season,
} from "@/types/ayurvedicFood";

const PAGE_SIZE = 20;
const ALL = "ALL"; // sentinel for "no filter" Select option

const CATEGORIES: FoodCategory[] = ["GRAIN","VEGETABLE","FRUIT","DAIRY","SPICE","OIL","LEGUME","MEAT","HERB","BEVERAGE","OTHER"];
const SEASONS: Season[] = ["WINTER","SUMMER","MONSOON","AUTUMN","SPRING"];
const DOSHAS = ["VATA","PITTA","KAPHA"] as const;

/**
 * /food-database — Ayurvedic Food Database management page.
 *
 * Roles: ADMIN | ADMIN_DOCTOR | DOCTOR.
 *  - All three see the catalogue and the + Add Food button
 *  - Bulk Import is hidden for DOCTOR (admin operation only)
 *  - DOCTOR sees view-only cards (FoodCard.showActions=false). Backend
 *    enforces the same — owner-only edit/delete returns 403 otherwise
 */
export default function FoodDatabase() {
  const { role } = useAuth();
  const qc = useQueryClient();

  // Filter state
  const [query, setQuery]         = useState("");
  const [category, setCategory]   = useState<string>(ALL);
  const [dosha, setDosha]         = useState<string>(ALL);
  const [season, setSeason]       = useState<string>(ALL);
  const [page, setPage]           = useState(1);

  // Modal state
  const [addOpen, setAddOpen]     = useState(false);
  const [editing, setEditing]     = useState<AyurvedicFood | null>(null);
  const [bulkOpen, setBulkOpen]   = useState(false);

  const canManage = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const canBulkImport = canManage;
  const canEditEachCard = role === "ADMIN" || role === "ADMIN_DOCTOR" || role === "DOCTOR";

  const queryKey = useMemo(
    () => ["ayurvedic-foods", { query, category, dosha, season, page }],
    [query, category, dosha, season, page],
  );

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (query.trim())     params.query       = query.trim();
      if (category !== ALL) params.category    = category;
      if (dosha !== ALL)    params.doshaFilter = dosha;
      if (season !== ALL)   params.season      = season;
      const { data } = await apiClient.get<PaginatedFoods>("/api/ayurvedic-foods", params);
      return data;
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep prior page rendered while next page loads
  });

  const stats = useQuery({
    queryKey: ["food-db-stats"],
    queryFn: async () => {
      const { data } = await apiClient.get<FoodDatabaseStats>("/api/ayurvedic-foods/stats");
      return data;
    },
    enabled: canManage, // backend gates this to ADMIN/ADMIN_DOCTOR; skip for DOCTOR
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (food: AyurvedicFood) => {
      const { data } = await apiClient.delete<{ mode: "soft" | "hard"; message: string }>(
        `/api/ayurvedic-foods/${food.id}`,
      );
      return data;
    },
    onSuccess: (data, food) => {
      toast.success(data.mode === "soft" ? `${food.name} deactivated` : `${food.name} deleted`);
      qc.invalidateQueries({ queryKey: ["ayurvedic-foods"] });
      qc.invalidateQueries({ queryKey: ["food-db-stats"] });
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Delete failed";
      toast.error(msg);
    },
  });

  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        <PageHeader
          title="🌿 Ayurvedic Food Database"
          subtitle="Branch-scoped catalogue of foods with dosha effects, rasa/guna metadata, nutrition and allergens."
        >
          <div className="flex items-center gap-2">
            {canBulkImport && (
              <Button variant="outline" onClick={() => setBulkOpen(true)}>
                <Upload className="w-4 h-4 mr-2" /> Bulk Import
              </Button>
            )}
            {canEditEachCard && (
              <Button onClick={() => { setEditing(null); setAddOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Food
              </Button>
            )}
          </div>
        </PageHeader>

        {/* Filter bar */}
        <div className="rounded-xl border bg-card p-3 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name (English or Tamil)…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dosha} onValueChange={(v) => { setDosha(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Dosha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any dosha</SelectItem>
              {DOSHAS.map((d) => <SelectItem key={d} value={d}>Pacifies {d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={season} onValueChange={(v) => { setSeason(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Season" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All seasons</SelectItem>
              {SEASONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Stats strip — 4 chips. Skipped for DOCTOR (backend 403s the
            stats endpoint for them; we hide rather than show zeros). */}
        {canManage && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatChip label="Total Foods"  value={stats.data?.totalFoods}  loading={stats.isLoading} />
            <StatChip label="Grains"       value={stats.data?.byCategory?.GRAIN}      loading={stats.isLoading} />
            <StatChip label="Vegetables"   value={stats.data?.byCategory?.VEGETABLE}  loading={stats.isLoading} />
            <StatChip label="Spices"       value={stats.data?.byCategory?.SPICE}      loading={stats.isLoading} />
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            Failed to load foods. {error instanceof Error ? error.message : ""}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-secondary/5 py-16 px-6 text-center">
            <Leaf className="w-12 h-12 mx-auto mb-3 text-emerald-700/40" />
            <p className="text-sm text-muted-foreground mb-4">No foods found. Add your first Ayurvedic food.</p>
            {canEditEachCard && (
              <Button onClick={() => { setEditing(null); setAddOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" /> Add Food
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.data.map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  showActions={canEditEachCard}
                  onEdit={(f) => { setEditing(f); setAddOpen(true); }}
                  onDelete={async (f) => { await deleteMutation.mutateAsync(f); }}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Showing {(data.pagination.page - 1) * data.pagination.limit + 1}
                  –{Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)}
                  {" of "}{data.pagination.total}
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
        <AddFoodModal
          open={addOpen}
          editing={editing}
          onClose={() => { setAddOpen(false); setEditing(null); }}
        />
        <BulkImportModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
        />
      </div>
    </AppLayout>
  );
}

function StatChip({ label, value, loading }: { label: string; value: number | undefined; loading: boolean }) {
  return (
    <div className="rounded-2xl border bg-card shadow-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {loading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : value ?? 0}
      </div>
    </div>
  );
}
