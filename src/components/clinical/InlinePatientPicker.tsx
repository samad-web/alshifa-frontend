import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, X, User, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InlinePatientLite {
    id: string;
    fullName?: string | null;
    patientId?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    branchId?: string | null;
    branchName?: string | null;
}

interface InlinePatientPickerProps {
    /** Patients to render. The component is fully controlled — the parent
     *  handles fetching so it can share the list with the rest of the page. */
    patients: InlinePatientLite[];
    /** Currently selected patient id (empty string = none). */
    selectedId: string;
    onSelect: (id: string) => void;
    /** Optional branch list — when provided, renders a branch filter pill. */
    branches?: Array<{ id: string; name: string }>;
    loading?: boolean;
    placeholder?: string;
    /** Cap visible rows. Anything above this surfaces a "+N more" hint instead.
     *  Defaults to 30 — same threshold the dispense flow has shipped with. */
    maxVisibleRows?: number;
    /** Tweak the inline list height. Defaults to 18rem. */
    listMaxHeightClass?: string;
}

/**
 * Live-search patient picker. As the user types, matching rows render inline
 * underneath the input (no popover, no second dropdown). The selected patient
 * surfaces as a confirmation pill above the list with a Clear action.
 *
 * Replaces the old "search box + separate Select" layout where a doctor had
 * to type, then click into a hidden dropdown to pick the row.
 */
export function InlinePatientPicker({
    patients,
    selectedId,
    onSelect,
    branches,
    loading = false,
    placeholder = "Search by name, patient ID, phone, or email…",
    maxVisibleRows = 30,
    listMaxHeightClass = "max-h-72",
}: InlinePatientPickerProps) {
    const [query, setQuery] = useState("");
    const [branchFilter, setBranchFilter] = useState<string>("all");

    const branchNameById = useMemo(() => {
        const m = new Map<string, string>();
        for (const b of branches ?? []) m.set(b.id, b.name);
        return m;
    }, [branches]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return patients.filter((p) => {
            if (branchFilter !== "all" && p.branchId !== branchFilter) return false;
            if (!q) return true;
            return (
                (p.fullName    || "").toLowerCase().includes(q) ||
                (p.patientId   || "").toLowerCase().includes(q) ||
                (p.email       || "").toLowerCase().includes(q) ||
                (p.phoneNumber || "").toLowerCase().includes(q)
            );
        });
    }, [patients, query, branchFilter]);

    const selected = useMemo(
        () => patients.find((p) => p.id === selectedId) ?? null,
        [patients, selectedId],
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-stretch gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder={placeholder}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-10 pr-10"
                        disabled={loading}
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
                {branches && branches.length > 0 && (
                    <Select value={branchFilter} onValueChange={setBranchFilter}>
                        <SelectTrigger className="w-[180px] shrink-0">
                            <SelectValue placeholder="All branches" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All branches</SelectItem>
                            {branches.map((b) => (
                                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {selected && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                    <div className="min-w-0">
                        <div className="text-[10px] text-primary/80 uppercase tracking-wider font-bold">Selected</div>
                        <div className="text-sm font-semibold truncate">
                            {selected.fullName || "Unnamed Patient"}
                            {selected.patientId && (
                                <span className="ml-2 text-xs font-mono text-muted-foreground">
                                    {selected.patientId}
                                </span>
                            )}
                        </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => onSelect("")}>
                        Clear
                    </Button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading patients…
                </div>
            ) : (
                <div className={cn("rounded-lg border border-border/60 overflow-y-auto bg-card", listMaxHeightClass)}>
                    {filtered.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                            {query
                                ? `No patients match "${query}"`
                                : patients.length === 0
                                    ? "No patients available"
                                    : "Type to search patients"}
                        </div>
                    ) : (
                        <>
                            {filtered.slice(0, maxVisibleRows).map((p) => {
                                const branchName = p.branchName
                                    ?? (p.branchId ? branchNameById.get(p.branchId) : undefined);
                                const isSelected = selectedId === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => onSelect(p.id)}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-b border-border/40 last:border-b-0 transition-colors",
                                            isSelected ? "bg-primary/10" : "hover:bg-secondary/50",
                                        )}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                                <span className="text-sm font-semibold truncate">
                                                    {p.fullName || "Unnamed Patient"}
                                                </span>
                                                {p.patientId && (
                                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                        {p.patientId}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-0.5 ml-5 truncate">
                                                {branchName || "—"}
                                                {p.phoneNumber && <> · {p.phoneNumber}</>}
                                                {p.email && <> · {p.email}</>}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                            {filtered.length > maxVisibleRows && (
                                <div className="px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
                                    Showing {maxVisibleRows} of {filtered.length}. Refine the search to narrow down.
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
