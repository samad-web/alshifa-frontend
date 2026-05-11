import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import {
    Plus, Search, Edit2, Upload, ChevronLeft, ChevronRight,
    Filter, X, Youtube, AlertTriangle, ArrowUpDown, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MedicineModal } from "@/components/pharmacy/MedicineModal";
import { MedicineImportModal } from "@/components/pharmacy/MedicineImportModal";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { useBranchScope } from "@/hooks/useBranchScope";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";

type Availability = "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

interface Medicine {
    id: string;
    name: string;
    sku?: string;
    brand?: string;
    category?: string;
    type?: string;
    manufacturer?: string;
    riskLevel?: string;
    price: number;
    videoUrl?: string;
    youtubeId?: string | null;
    totalStock?: number;
    availabilityStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
    nearestExpiry?: string | null;
    hasVideo?: boolean;
    expiringSoon?: boolean | null;
}

interface SearchResponse {
    medicines: Medicine[];
    facets: {
        availability: { IN_STOCK: number; LOW_STOCK: number; OUT_OF_STOCK: number };
        withVideo: number;
    };
    pagination: { total: number; page: number; limit: number; totalPages: number };
}

interface FilterOptions {
    categories: string[];
    types: string[];
    manufacturers: string[];
    riskLevels: string[];
}

const PAGE_SIZE = 30;

export default function MedicineInventory() {
    const { branchIdParam } = useBranchScope();
    const [data, setData] = useState<SearchResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        categories: [], types: [], manufacturers: [], riskLevels: [],
    });

    // Filter state
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [category, setCategory] = useState<string>("ALL");
    const [type, setType] = useState<string>("ALL");
    const [manufacturer, setManufacturer] = useState<string>("ALL");
    const [availability, setAvailability] = useState<Availability>("ALL");
    const [hasVideoOnly, setHasVideoOnly] = useState(false);
    const [expiringInDays, setExpiringInDays] = useState<string>("");
    const [sortBy, setSortBy] = useState<string>("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);

    // Modals
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);

    // Debounce text search to keep typing smooth
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm), 250);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // Reset to page 1 when any filter changes
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, category, type, manufacturer, availability, hasVideoOnly, expiringInDays, sortBy, sortOrder, branchIdParam]);

    const queryParams = useMemo(() => {
        const params: Record<string, string | number | boolean | undefined> = {
            page,
            limit: PAGE_SIZE,
            sortBy,
            sortOrder,
        };
        if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
        if (category !== "ALL")     params.category = category;
        if (type !== "ALL")         params.type = type;
        if (manufacturer !== "ALL") params.manufacturer = manufacturer;
        if (availability !== "ALL") params.availability = availability;
        if (hasVideoOnly)           params.hasVideo = true;
        if (expiringInDays.trim())  params.expiringInDays = expiringInDays.trim();
        if (branchIdParam)          params.branchId = branchIdParam;
        return params;
    }, [page, sortBy, sortOrder, debouncedSearch, category, type, manufacturer, availability, hasVideoOnly, expiringInDays, branchIdParam]);

    const fetchMedicines = async () => {
        setLoading(true);
        try {
            const { data: resp } = await apiClient.get<SearchResponse>(
                "/api/pharmacy/medicines/search",
                queryParams,
            );
            setData(resp);
        } catch (error) {
            toast.error("Failed to fetch medicines");
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchFilterOptions = async () => {
        try {
            const { data: opts } = await apiClient.get<FilterOptions>(
                "/api/pharmacy/medicines/filter-options",
                branchIdParam ? { branchId: branchIdParam } : undefined,
            );
            setFilterOptions(opts);
        } catch {
            // Silent fail — empty dropdowns are fine, the user can still type.
        }
    };

    useEffect(() => { fetchMedicines(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [queryParams]);
    useEffect(() => { fetchFilterOptions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [branchIdParam]);

    const handleAdd = () => {
        setSelectedMedicine(null);
        setIsModalOpen(true);
    };

    const handleEdit = (med: Medicine) => {
        setSelectedMedicine(med);
        setIsModalOpen(true);
    };

    // Delete-medicine flow — admin-only on the backend, gated through an
    // AlertDialog confirmation so a stray click can't wipe a row.
    const { role } = useAuth();
    const canDelete = role === "ADMIN" || role === "ADMIN_DOCTOR";
    const [medicineToDelete, setMedicineToDelete] = useState<Medicine | null>(null);
    const [deleting, setDeleting] = useState(false);

    const confirmDeleteMedicine = async () => {
        if (!medicineToDelete) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/api/pharmacy/medicines/${medicineToDelete.id}`);
            toast.success(`${medicineToDelete.name} deleted`);
            setMedicineToDelete(null);
            await fetchMedicines();
        } catch (err: unknown) {
            // Backend wraps the in-use case as { error: { code: 'MEDICINE_IN_USE', message } }
            // and surfaces it as a 409 — show that copy verbatim.
            if (err instanceof ApiClientError && err.status === 409) {
                const payload = err.payload as { error?: { message?: string } } | undefined;
                toast.error(payload?.error?.message || "Cannot delete: medicine is in use.");
            } else {
                toast.error(err instanceof Error ? err.message : "Failed to delete medicine");
            }
        } finally {
            setDeleting(false);
        }
    };

    const clearFilters = () => {
        setSearchTerm(""); setCategory("ALL"); setType("ALL");
        setManufacturer("ALL"); setAvailability("ALL"); setHasVideoOnly(false);
        setExpiringInDays(""); setSortBy("name"); setSortOrder("asc");
    };

    const activeFilterCount =
        (debouncedSearch ? 1 : 0) +
        (category !== "ALL" ? 1 : 0) +
        (type !== "ALL" ? 1 : 0) +
        (manufacturer !== "ALL" ? 1 : 0) +
        (availability !== "ALL" ? 1 : 0) +
        (hasVideoOnly ? 1 : 0) +
        (expiringInDays.trim() ? 1 : 0);

    const medicines = data?.medicines ?? [];
    const facets = data?.facets;
    const pagination = data?.pagination;

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-6">
                <PageHeader
                    title="Medicine Inventory"
                    subtitle="Manage stock levels, drug details, and patient education videos"
                />

                {/* Search bar + actions */}
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    <div className="flex-1 flex gap-2">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by name, SKU, brand, manufacturer, or composition…"
                                className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none transition"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button
                            variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
                            className="gap-2"
                            onClick={() => setShowFilters(v => !v)}
                        >
                            <Filter className="h-4 w-4" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="ml-1 px-1.5 rounded-full bg-background/30 text-xs font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </Button>
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                                <X className="h-3.5 w-3.5" /> Clear
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="gap-2" onClick={() => setIsImportOpen(true)}>
                            <Upload className="h-4 w-4" /> Import CSV
                        </Button>
                        <Button className="gap-2" onClick={handleAdd}>
                            <Plus className="h-4 w-4" /> Add Medicine
                        </Button>
                    </div>
                </div>

                {/* Active filter chips — each removable individually so the
                    user can drop a single filter (e.g. just "Type") without
                    nuking the whole filter set. The "Clear all" button stays
                    as the bulk-reset escape hatch. */}
                {activeFilterCount > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">Active filters:</span>
                        {debouncedSearch && (
                            <FilterChip label={`Search: "${debouncedSearch}"`} onClear={() => setSearchTerm("")} />
                        )}
                        {category !== "ALL" && (
                            <FilterChip label={`Category: ${category}`} onClear={() => setCategory("ALL")} />
                        )}
                        {type !== "ALL" && (
                            <FilterChip label={`Type: ${type}`} onClear={() => setType("ALL")} />
                        )}
                        {manufacturer !== "ALL" && (
                            <FilterChip label={`Manufacturer: ${manufacturer}`} onClear={() => setManufacturer("ALL")} />
                        )}
                        {availability !== "ALL" && (
                            <FilterChip label={`Availability: ${availability.replace("_", " ").toLowerCase()}`} onClear={() => setAvailability("ALL")} />
                        )}
                        {expiringInDays.trim() && (
                            <FilterChip label={`Expiring in ${expiringInDays}d`} onClear={() => setExpiringInDays("")} />
                        )}
                        {hasVideoOnly && (
                            <FilterChip label="Has video" onClear={() => setHasVideoOnly(false)} />
                        )}
                        <button
                            onClick={clearFilters}
                            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
                        >
                            Clear all
                        </button>
                    </div>
                )}

                {/* Expanded filter panel */}
                {showFilters && (
                    <div className="rounded-xl border bg-card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <FilterSelect
                            label="Category"
                            value={category}
                            onChange={setCategory}
                            options={[{ value: "ALL", label: "All categories" }, ...filterOptions.categories.map(c => ({ value: c, label: c }))]}
                        />
                        <FilterSelect
                            label="Type"
                            value={type}
                            onChange={setType}
                            options={[{ value: "ALL", label: "All types" }, ...filterOptions.types.map(t => ({ value: t, label: t }))]}
                        />
                        <FilterSelect
                            label="Manufacturer"
                            value={manufacturer}
                            onChange={setManufacturer}
                            options={[{ value: "ALL", label: "All manufacturers" }, ...filterOptions.manufacturers.map(m => ({ value: m, label: m }))]}
                        />
                        <FilterSelect
                            label="Availability"
                            value={availability}
                            onChange={(v) => setAvailability(v as Availability)}
                            options={[
                                { value: "ALL",          label: "All availability" },
                                { value: "IN_STOCK",     label: `In stock${facets ? ` (${facets.availability.IN_STOCK})` : ""}` },
                                { value: "LOW_STOCK",    label: `Low stock${facets ? ` (${facets.availability.LOW_STOCK})` : ""}` },
                                { value: "OUT_OF_STOCK", label: `Out of stock${facets ? ` (${facets.availability.OUT_OF_STOCK})` : ""}` },
                            ]}
                        />
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expiring in (days)</label>
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={expiringInDays}
                                onChange={(e) => setExpiringInDays(e.target.value)}
                                placeholder="e.g. 30"
                                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                            />
                        </div>
                        <FilterSelect
                            label="Sort by"
                            value={sortBy}
                            onChange={setSortBy}
                            options={[
                                { value: "name",       label: "Name" },
                                { value: "price",      label: "Price" },
                                { value: "totalStock", label: "Stock level" },
                                { value: "createdAt",  label: "Recently added" },
                            ]}
                        />
                        <FilterSelect
                            label="Sort order"
                            value={sortOrder}
                            onChange={(v) => setSortOrder(v as "asc" | "desc")}
                            options={[
                                { value: "asc",  label: "Ascending" },
                                { value: "desc", label: "Descending" },
                            ]}
                        />
                        <div className="flex flex-col justify-end">
                            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer h-9 px-3 rounded-md border bg-background hover:bg-muted/40 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={hasVideoOnly}
                                    onChange={(e) => setHasVideoOnly(e.target.checked)}
                                    className="rounded"
                                />
                                <Youtube className="w-4 h-4 text-red-600" />
                                Has video {facets ? `(${facets.withVideo})` : ""}
                            </label>
                        </div>
                    </div>
                )}

                <Panel
                    title="Medicine List"
                    subtitle={pagination ? `${pagination.total} medicine${pagination.total === 1 ? "" : "s"} matching filters` : "Comprehensive list of all drugs in stock"}
                >
                    {/* Mobile card view */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {loading ? (
                            <div className="py-12 text-center text-muted-foreground">Loading inventory…</div>
                        ) : medicines.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">No medicines match the current filters.</div>
                        ) : medicines.map((med) => (
                            <MedicineCard
                                key={med.id}
                                med={med}
                                onEdit={() => handleEdit(med)}
                                onDelete={canDelete ? () => setMedicineToDelete(med) : undefined}
                            />
                        ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b">
                                    <SortableTh column="name"        label="Medicine"     sortBy={sortBy} sortOrder={sortOrder} onSort={(c, o) => { setSortBy(c); setSortOrder(o); }} />
                                    <th className="pb-4 pt-2 font-semibold text-center">SKU</th>
                                    <th className="pb-4 pt-2 font-semibold">Category / Type</th>
                                    <SortableTh column="totalStock"  label="Stock"        sortBy={sortBy} sortOrder={sortOrder} onSort={(c, o) => { setSortBy(c); setSortOrder(o); }} align="center" />
                                    <th className="pb-4 pt-2 font-semibold text-center">Video</th>
                                    <SortableTh column="price"       label="Price"        sortBy={sortBy} sortOrder={sortOrder} onSort={(c, o) => { setSortBy(c); setSortOrder(o); }} />
                                    <th className="pb-4 pt-2 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-muted-foreground">Loading inventory…</td>
                                    </tr>
                                ) : medicines.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-muted-foreground">No medicines match the current filters.</td>
                                    </tr>
                                ) : medicines.map((med) => (
                                    <MedicineRow
                                        key={med.id}
                                        med={med}
                                        onEdit={() => handleEdit(med)}
                                        onDelete={canDelete ? () => setMedicineToDelete(med) : undefined}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {!loading && pagination && pagination.total > 0 && (
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-border/40">
                            <p className="text-xs text-muted-foreground">
                                Page <span className="font-semibold text-foreground">{pagination.page}</span> of{" "}
                                <span className="font-semibold text-foreground">{pagination.totalPages}</span>
                                {" — "}
                                <span className="font-semibold text-foreground">{pagination.total}</span> total
                            </p>
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="sm" className="h-8 gap-1" disabled={pagination.page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                                </Button>
                                <span className="text-xs px-3 font-medium">
                                    {pagination.page} / {pagination.totalPages}
                                </span>
                                <Button variant="outline" size="sm" className="h-8 gap-1" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                                    Next <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Panel>
            </div>

            <MedicineModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchMedicines}
                medicine={selectedMedicine}
            />

            <MedicineImportModal
                isOpen={isImportOpen}
                onClose={() => setIsImportOpen(false)}
                onSuccess={fetchMedicines}
            />

            <AlertDialog
                open={!!medicineToDelete}
                onOpenChange={(open) => { if (!open) setMedicineToDelete(null); }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Medicine</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{medicineToDelete?.name}"? This cannot be undone.
                            Medicines with active prescriptions cannot be deleted — discontinue them first.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleting}
                            onClick={(e) => { e.preventDefault(); confirmDeleteMedicine(); }}
                        >
                            {deleting ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
    return (
        <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
            {label}
            <button
                type="button"
                onClick={onClear}
                className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                title={`Clear ${label}`}
                aria-label={`Clear ${label}`}
            >
                <X className="h-3 w-3" />
            </button>
        </span>
    );
}

function FilterSelect({
    label, value, onChange, options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function SortableTh({
    column, label, sortBy, sortOrder, onSort, align = "left",
}: {
    column: string;
    label: string;
    sortBy: string;
    sortOrder: "asc" | "desc";
    onSort: (column: string, order: "asc" | "desc") => void;
    align?: "left" | "right" | "center";
}) {
    const active = sortBy === column;
    return (
        <th className={cn("pb-4 pt-2 font-semibold cursor-pointer select-none", align === "center" && "text-center", align === "right" && "text-right")}>
            <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                onClick={() => onSort(column, active && sortOrder === "asc" ? "desc" : "asc")}
            >
                {label}
                <ArrowUpDown className={cn("h-3 w-3", active ? "text-primary" : "text-muted-foreground/40")} />
            </button>
        </th>
    );
}

function StockBadge({ status, count }: { status?: string; count: number }) {
    const map = {
        IN_STOCK:     { cls: "text-foreground",        label: "In stock" },
        LOW_STOCK:    { cls: "text-amber-600",         label: "Low" },
        OUT_OF_STOCK: { cls: "text-risk",              label: "Out" },
    } as const;
    const cfg = (status && map[status as keyof typeof map]) || map.IN_STOCK;
    return (
        <span className={cn("font-bold", cfg.cls)} title={cfg.label}>
            {count}
        </span>
    );
}

function MedicineRow({ med, onEdit, onDelete }: { med: Medicine; onEdit: () => void; onDelete?: () => void }) {
    return (
        <tr className="group hover:bg-secondary/50 transition">
            <td className="py-4">
                <div className="flex items-center gap-2">
                    <div className="font-medium">{med.name}</div>
                    {med.expiringSoon && (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{med.brand}</div>
            </td>
            <td className="py-4 text-center">
                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{med.sku}</code>
            </td>
            <td className="py-4">
                <div className="flex flex-col gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] w-fit font-semibold">{med.category || "General"}</span>
                    <span className="text-[10px] text-muted-foreground pl-1">{med.type}</span>
                </div>
            </td>
            <td className="py-4 text-center">
                <StockBadge status={med.availabilityStatus} count={med.totalStock || 0} />
            </td>
            <td className="py-4 text-center">
                {med.youtubeId ? (
                    <a
                        href={`https://youtu.be/${med.youtubeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                        title="Watch instructional video"
                    >
                        <Youtube className="w-4 h-4" />
                    </a>
                ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                )}
            </td>
            <td className="py-4 text-accent font-medium">₹{med.price}</td>
            <td className="py-4 text-right">
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="Add Stock">
                        <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="Edit Medicine" onClick={onEdit}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    {onDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Delete Medicine" onClick={onDelete}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </td>
        </tr>
    );
}

function MedicineCard({ med, onEdit, onDelete }: { med: Medicine; onEdit: () => void; onDelete?: () => void }) {
    return (
        <div className="p-4 rounded-xl border border-border/50 bg-card space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-foreground">{med.name}</h4>
                        {med.youtubeId && (
                            <a href={`https://youtu.be/${med.youtubeId}`} target="_blank" rel="noopener noreferrer" className="text-red-600">
                                <Youtube className="w-4 h-4" />
                            </a>
                        )}
                    </div>
                    <p className="text-[10px] text-primary/70 font-mono tracking-tight">{med.sku}</p>
                    <p className="text-xs text-muted-foreground mt-1">{med.brand || "Generics"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-1 rounded-full bg-secondary text-[10px] font-bold uppercase">{med.category || "General"}</span>
                    <span className="text-[9px] text-muted-foreground italic">{med.type}</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/30">
                <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Stock</p>
                    <StockBadge status={med.availabilityStatus} count={med.totalStock || 0} />
                </div>
                <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Price</p>
                    <p className="text-sm font-bold text-accent">₹{med.price}</p>
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" className="h-8 gap-2">
                    <Plus className="h-3.5 w-3.5" /> Stock
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={onEdit}>
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
                {onDelete && (
                    <Button variant="outline" size="sm" className="h-8 gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={onDelete}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                )}
            </div>
        </div>
    );
}
