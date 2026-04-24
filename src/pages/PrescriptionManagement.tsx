import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { MultiplePrescriptionForm } from "@/components/prescription/MultiplePrescriptionForm";
import { PrescriptionList } from "@/components/prescription-list";
import { useAuth } from "@/hooks/useAuth";
import {
    FilePlus2, Filter, Search, X, Youtube, Loader2,
    CheckCircle2, Ban, AlertTriangle, Calendar as CalendarIcon, Stethoscope, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiClient } from "@/lib/api-client";

type RxStatusFilter = "ALL" | "ACTIVE" | "DISCONTINUED" | "OUT_OF_SUPPLY";

export default function PrescriptionManagement() {
    const { role } = useAuth();
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<string>("");
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [prescriptionFacets, setPrescriptionFacets] = useState<{ active: number; discontinued: number; withVideo: number } | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [prescriptionSearchQuery, setPrescriptionSearchQuery] = useState("");
    const [prescriptionBranchFilter, setPrescriptionBranchFilter] = useState("all");

    // Prescription-list filters (apply to the per-patient list once a patient is picked)
    const [rxQuery, setRxQuery] = useState("");
    const [rxQueryDebounced, setRxQueryDebounced] = useState("");
    const [rxStatus, setRxStatus] = useState<RxStatusFilter>("ALL");
    const [rxMedicineId, setRxMedicineId] = useState<string>("");
    const [rxPrescriberId, setRxPrescriberId] = useState<string>("");
    const [rxHasVideo, setRxHasVideo] = useState(false);
    const [rxDateFrom, setRxDateFrom] = useState("");
    const [rxDateTo, setRxDateTo] = useState("");
    const [rxSortBy, setRxSortBy] = useState<"createdAt" | "medicationName" | "totalQuantity" | "dispensedQty">("createdAt");
    const [rxSortOrder, setRxSortOrder] = useState<"asc" | "desc">("desc");
    const [showRxFilters, setShowRxFilters] = useState(false);
    const [medicineCatalog, setMedicineCatalog] = useState<Array<{ id: string; name: string; sku?: string; brand?: string }>>([]);
    const [prescribers, setPrescribers] = useState<Array<{ id: string; name: string }>>([]);

    const isAdminRole = role === "ADMIN" || role === "ADMIN_DOCTOR";

    // Lookup map for chip labels — avoids re-fetch when only the chip needs to render the medicine name.
    const rxMedicineNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const m of medicineCatalog) map.set(m.id, m.name);
        return map;
    }, [medicineCatalog]);

    // Pull the medicine catalogue once. The dropdown uses SearchableSelect
    // so a few hundred medicines stays usable; larger catalogues should
    // switch to async type-ahead if perf becomes an issue.
    useEffect(() => {
        let cancelled = false;
        apiClient.get<any[]>('/api/pharmacy/medicines')
            .then(({ data }) => {
                if (cancelled) return;
                if (Array.isArray(data)) {
                    setMedicineCatalog(data.map((m: any) => ({
                        id: m.id, name: m.name, sku: m.sku, brand: m.brand,
                    })));
                }
            })
            .catch((err) => console.warn('Failed to load medicine catalogue for filter:', err?.message));
        return () => { cancelled = true; };
    }, []);

    // Prescriber dropdown (admin only). Endpoint is admin-gated.
    useEffect(() => {
        if (!isAdminRole) return;
        let cancelled = false;
        apiClient.get<any[]>('/api/user/list-doctors')
            .then(({ data }) => {
                if (cancelled || !Array.isArray(data)) return;
                setPrescribers(data.map((d: any) => ({
                    id: d.userId || d.id,
                    name: d.fullName || d.email || d.userId,
                })));
            })
            .catch(() => { /* silent — not critical */ });
        return () => { cancelled = true; };
    }, [isAdminRole]);

    const prescriberNameById = useMemo(() => {
        const map = new Map<string, string>();
        for (const p of prescribers) map.set(p.id, p.name);
        return map;
    }, [prescribers]);

    // ── Date-range presets ────────────────────────────────────────────
    // Each preset returns ISO date strings (YYYY-MM-DD) so they slot
    // straight into the dateFrom/dateTo inputs and the backend search.
    const today = useMemo(() => new Date(), []);
    const isoDate = (d: Date) => d.toISOString().slice(0, 10);
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

    type DatePreset = "TODAY" | "LAST_7" | "LAST_30" | "THIS_MONTH" | "LAST_3_MONTHS";
    const datePresets: Array<{ id: DatePreset; label: string; from: () => string; to: () => string }> = [
        { id: "TODAY",         label: "Today",         from: () => isoDate(startOfDay(today)),               to: () => isoDate(today) },
        { id: "LAST_7",        label: "Last 7 days",   from: () => isoDate(addDays(startOfDay(today), -7)),  to: () => isoDate(today) },
        { id: "LAST_30",       label: "Last 30 days",  from: () => isoDate(addDays(startOfDay(today), -30)), to: () => isoDate(today) },
        { id: "THIS_MONTH",    label: "This month",    from: () => isoDate(startOfMonth(today)),             to: () => isoDate(today) },
        { id: "LAST_3_MONTHS", label: "Last 3 months", from: () => isoDate(new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())), to: () => isoDate(today) },
    ];

    const activeDatePreset: DatePreset | null = useMemo(() => {
        if (!rxDateFrom || !rxDateTo) return null;
        const match = datePresets.find(p => p.from() === rxDateFrom && p.to() === rxDateTo);
        return match?.id ?? null;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [rxDateFrom, rxDateTo]);

    const applyDatePreset = (id: DatePreset) => {
        const p = datePresets.find(x => x.id === id);
        if (!p) return;
        setRxDateFrom(p.from());
        setRxDateTo(p.to());
    };

    // ── Quick preset filters ──────────────────────────────────────────
    // One-tap shortcuts that set/clear underlying filters in combination.
    const isQuickActive = rxStatus === "ACTIVE" && !rxMedicineId && !rxHasVideo && !rxDateFrom && !rxDateTo && !rxQueryDebounced && !rxPrescriberId;
    const isQuickDiscontinued = rxStatus === "DISCONTINUED" && !rxMedicineId && !rxHasVideo && !rxDateFrom && !rxDateTo && !rxQueryDebounced && !rxPrescriberId;
    const isQuickHasVideo = rxHasVideo && rxStatus === "ALL" && !rxMedicineId && !rxDateFrom && !rxDateTo && !rxQueryDebounced && !rxPrescriberId;
    const isQuickOutOfSupply = rxStatus === "OUT_OF_SUPPLY";
    const isQuickAll = rxStatus === "ALL" && !rxMedicineId && !rxHasVideo && !rxDateFrom && !rxDateTo && !rxQueryDebounced && !rxPrescriberId;

    type QuickPreset = "ALL" | "ACTIVE" | "DISCONTINUED" | "HAS_VIDEO" | "OUT_OF_SUPPLY";
    const applyQuickPreset = (preset: QuickPreset) => {
        // Clear everything first so presets are mutually exclusive.
        setRxQuery(""); setRxMedicineId(""); setRxPrescriberId(""); setRxHasVideo(false);
        setRxDateFrom(""); setRxDateTo("");
        switch (preset) {
            case "ALL":           setRxStatus("ALL"); break;
            case "ACTIVE":        setRxStatus("ACTIVE"); break;
            case "DISCONTINUED":  setRxStatus("DISCONTINUED"); break;
            case "HAS_VIDEO":     setRxStatus("ALL"); setRxHasVideo(true); break;
            case "OUT_OF_SUPPLY": setRxStatus("OUT_OF_SUPPLY"); break;
        }
    };

    useEffect(() => {
        const t = setTimeout(() => setRxQueryDebounced(rxQuery), 250);
        return () => clearTimeout(t);
    }, [rxQuery]);

    const rxQueryParams = useMemo(() => {
        const params: Record<string, string | number | boolean | undefined> = {
            patientId: selectedPatient || undefined,
            sortBy: rxSortBy,
            sortOrder: rxSortOrder,
            limit: 100,
        };
        if (rxQueryDebounced.trim()) params.q = rxQueryDebounced.trim();
        if (rxStatus !== "ALL")     params.status = rxStatus;
        if (rxMedicineId)           params.medicineId = rxMedicineId;
        if (rxPrescriberId)         params.prescriberId = rxPrescriberId;
        if (rxHasVideo)             params.hasVideo = true;
        if (rxDateFrom)             params.dateFrom = rxDateFrom;
        if (rxDateTo)               params.dateTo = rxDateTo;
        return params;
    }, [selectedPatient, rxQueryDebounced, rxStatus, rxMedicineId, rxPrescriberId, rxHasVideo, rxDateFrom, rxDateTo, rxSortBy, rxSortOrder]);

    const activeRxFilterCount =
        (rxQueryDebounced ? 1 : 0) +
        (rxStatus !== "ALL" ? 1 : 0) +
        (rxMedicineId ? 1 : 0) +
        (rxPrescriberId ? 1 : 0) +
        (rxHasVideo ? 1 : 0) +
        (rxDateFrom ? 1 : 0) +
        (rxDateTo ? 1 : 0);

    const clearRxFilters = () => {
        setRxQuery(""); setRxStatus("ALL"); setRxMedicineId(""); setRxPrescriberId("");
        setRxHasVideo(false); setRxDateFrom(""); setRxDateTo("");
        setRxSortBy("createdAt"); setRxSortOrder("desc");
    };

    // Fetch patients and available branches in parallel
    useEffect(() => {
        async function fetchInitialData() {
            try {
                const [{ data: patientsData }, { data: branchesData }] = await Promise.all([
                    apiClient.get<any[]>('/api/user/list-patients'),
                    apiClient.get<any[]>('/api/branches'),
                ]);
                setPatients(patientsData);
                setBranches(branchesData);
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            }
        }
        fetchInitialData();
    }, []);

    // Fetch prescriptions whenever the patient OR any filter changes.
    // Uses the new /search endpoint so all filtering happens server-side
    // — the UI no longer paginates client-side.
    useEffect(() => {
        async function fetchPrescriptions() {
            if (!selectedPatient) {
                setPrescriptions([]);
                setPrescriptionFacets(null);
                return;
            }
            setLoadingPrescriptions(true);
            try {
                const { data } = await apiClient.get<{ prescriptions: any[]; facets: { active: number; discontinued: number; withVideo: number } }>(
                    `/api/prescriptions/search`, rxQueryParams,
                );
                setPrescriptions(Array.isArray(data?.prescriptions) ? data.prescriptions : []);
                setPrescriptionFacets(data?.facets ?? null);
            } catch (error: any) {
                // Non-2xx (e.g. 403 for unassigned doctor/therapist) — clear stale data
                setPrescriptions([]);
                setPrescriptionFacets(null);
                console.warn("Prescriptions fetch failed:", error?.message);
            } finally {
                setLoadingPrescriptions(false);
            }
        }
        fetchPrescriptions();
    }, [rxQueryParams, selectedPatient]);

    const handlePrescriptionAdded = () => {
        // Force a refetch by re-running with the same params (state-update
        // triggers the existing effect because we set a fresh debounced
        // marker via current rxQuery).
        if (selectedPatient) {
            setRxQueryDebounced(prev => prev); // no-op state nudge — kept for clarity; the effect re-fires when selectedPatient is constant only on actual filter change.
            // Explicit refetch:
            apiClient.get<{ prescriptions: any[]; facets: any }>(
                `/api/prescriptions/search`, rxQueryParams,
            )
                .then(({ data }) => {
                    setPrescriptions(Array.isArray(data?.prescriptions) ? data.prescriptions : []);
                    setPrescriptionFacets(data?.facets ?? null);
                })
                .catch(console.error);
        }
    };

    if (!role || !["DOCTOR", "THERAPIST", "ADMIN", "ADMIN_DOCTOR"].includes(role)) {
        return (
            <AppLayout>
                <div className="container max-w-4xl mx-auto px-4 py-8 text-center">
                    <p className="text-muted-foreground">
                        {!role ? "Loading..." : "Access denied. Only medical staff can access this page."}
                    </p>
                </div>
            </AppLayout>
        );
    }

    const selectedPatientData = patients.find((p) => p.id === selectedPatient);

    // Client-side filter: branch classification + text search applied to the already-fetched list
    const filteredPatients = patients.filter((p: any) => {
        const q = prescriptionSearchQuery.toLowerCase();
        const matchesSearch = !q ||
            (p.fullName  || "").toLowerCase().includes(q) ||
            (p.patientId || "").toLowerCase().includes(q) ||
            (p.email     || "").toLowerCase().includes(q);
        const matchesBranch = prescriptionBranchFilter === "all" || p.branchId === prescriptionBranchFilter;
        return matchesSearch && matchesBranch;
    });

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8">
                <PageHeader
                    title="Prescription Management"
                    subtitle="Upload, view, and download patient prescriptions"
                />

                {/* Patient Selection */}
                <Panel title="Select Patient" subtitle="Choose a patient to manage their prescriptions">
                    {/* Branch + Search Filter — augments the existing patient dropdown without changing layout */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <input
                            type="text"
                            placeholder="Search by name, patient ID, or email..."
                            value={prescriptionSearchQuery}
                            onChange={(e) => setPrescriptionSearchQuery(e.target.value)}
                            className="flex-1 min-w-[160px] h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <SearchableSelect
                            value={prescriptionBranchFilter}
                            onChange={setPrescriptionBranchFilter}
                            placeholder="All branches"
                            searchPlaceholder="Search branches…"
                            className="w-[180px] shrink-0"
                            items={[
                                { value: "all", label: "All branches" },
                                ...branches.map((b) => ({ value: b.id, label: b.name })),
                            ]}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <SearchableSelect
                                value={selectedPatient}
                                onChange={setSelectedPatient}
                                placeholder="Select a patient..."
                                searchPlaceholder="Search patients by name or email…"
                                items={filteredPatients.map((patient: any) => ({
                                    value: patient.id,
                                    label: patient.fullName || patient.email || patient.id,
                                    keywords: [patient.email || "", patient.phoneNumber || ""],
                                }))}
                            />
                        </div>
                        {selectedPatient && (
                            <Button onClick={() => setShowModal(true)} className="gap-2">
                                <FilePlus2 className="w-4 h-4" />
                                Add Prescription
                            </Button>
                        )}
                    </div>
                </Panel>

                {/* Add Prescription Form */}
                {selectedPatient && showModal && (
                    <Panel title="New Prescription" subtitle={`Create a structured prescription for ${selectedPatientData?.fullName}`}>
                        <MultiplePrescriptionForm
                            patientId={selectedPatient}
                            patientName={selectedPatientData?.fullName || selectedPatientData?.email}
                            onSuccess={() => {
                                setShowModal(false);
                                handlePrescriptionAdded();
                            }}
                            onCancel={() => setShowModal(false)}
                        />
                    </Panel>
                )}

                {/* Prescriptions Display */}
                {selectedPatient && !showModal && (
                    <Panel
                        title={`Prescriptions for ${selectedPatientData?.fullName || "Patient"}`}
                        subtitle={prescriptionFacets
                            ? `${prescriptionFacets.active} active · ${prescriptionFacets.discontinued} discontinued · ${prescriptionFacets.withVideo} with video`
                            : "View and download prescription history"
                        }
                    >
                        {/* Filters block — only renders once at least one
                            prescription exists (or the user has active
                            filters that need a "Clear" escape hatch).
                            Hides the Quick preset row + inline filter bar +
                            advanced panel for the empty initial state so the
                            user just sees the "Add Prescription" CTA. */}
                        {(prescriptions.length > 0 || activeRxFilterCount > 0) && (
                          <>
                        {/* Quick preset filters — one-tap shortcuts for the most
                            common views. Each preset clears all other filters
                            so the result set is unambiguous. */}
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Quick:</span>
                            <QuickPresetChip
                                label="All"
                                icon={Activity}
                                active={isQuickAll}
                                onClick={() => applyQuickPreset("ALL")}
                            />
                            <QuickPresetChip
                                label={`Active${prescriptionFacets ? ` · ${prescriptionFacets.active}` : ""}`}
                                icon={CheckCircle2}
                                tone="emerald"
                                active={isQuickActive}
                                onClick={() => applyQuickPreset("ACTIVE")}
                            />
                            <QuickPresetChip
                                label={`Discontinued${prescriptionFacets ? ` · ${prescriptionFacets.discontinued}` : ""}`}
                                icon={Ban}
                                tone="slate"
                                active={isQuickDiscontinued}
                                onClick={() => applyQuickPreset("DISCONTINUED")}
                            />
                            <QuickPresetChip
                                label="Out of supply"
                                icon={AlertTriangle}
                                tone="amber"
                                active={isQuickOutOfSupply}
                                onClick={() => applyQuickPreset("OUT_OF_SUPPLY")}
                            />
                            <QuickPresetChip
                                label={`With video${prescriptionFacets ? ` · ${prescriptionFacets.withVideo}` : ""}`}
                                icon={Youtube}
                                tone="red"
                                active={isQuickHasVideo}
                                onClick={() => applyQuickPreset("HAS_VIDEO")}
                            />
                        </div>

                        {/* Advanced filter bar — search + status + date range + sort.
                            Filters are applied server-side via /api/prescriptions/search. */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <div className="relative flex-1 min-w-[200px] max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by medication, SKU, or patient…"
                                    value={rxQuery}
                                    onChange={(e) => setRxQuery(e.target.value)}
                                    className="w-full pl-10 h-9 rounded-md border bg-background px-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <Select value={rxStatus} onValueChange={(v) => setRxStatus(v as RxStatusFilter)}>
                                <SelectTrigger className="w-[160px] h-9 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All statuses</SelectItem>
                                    <SelectItem value="ACTIVE">Active{prescriptionFacets ? ` (${prescriptionFacets.active})` : ""}</SelectItem>
                                    <SelectItem value="DISCONTINUED">Discontinued{prescriptionFacets ? ` (${prescriptionFacets.discontinued})` : ""}</SelectItem>
                                    <SelectItem value="OUT_OF_SUPPLY">Out of supply</SelectItem>
                                </SelectContent>
                            </Select>
                            {/* Medicine filter — searchable typeahead over the
                                full inventory catalogue. Sentinel "__all__"
                                means no medicine filter (SearchableSelect
                                rejects empty string values). */}
                            <SearchableSelect
                                value={rxMedicineId || "__all__"}
                                onChange={(v) => setRxMedicineId(v === "__all__" ? "" : v)}
                                placeholder="All medicines"
                                searchPlaceholder="Search medicine by name, SKU, or brand…"
                                className="w-[220px] h-9"
                                items={[
                                    { value: "__all__", label: "All medicines" },
                                    ...medicineCatalog.map((m) => ({
                                        value: m.id,
                                        label: m.name,
                                        keywords: [m.sku || "", m.brand || ""],
                                    })),
                                ]}
                            />
                            <Button
                                variant={showRxFilters || activeRxFilterCount > 0 ? "default" : "outline"}
                                size="sm"
                                className="gap-2 h-9"
                                onClick={() => setShowRxFilters(v => !v)}
                            >
                                <Filter className="h-4 w-4" />
                                More filters
                                {activeRxFilterCount > 0 && (
                                    <span className="ml-1 px-1.5 rounded-full bg-background/30 text-xs font-bold">
                                        {activeRxFilterCount}
                                    </span>
                                )}
                            </Button>
                            {activeRxFilterCount > 0 && (
                                <Button variant="ghost" size="sm" onClick={clearRxFilters} className="gap-1 h-9">
                                    <X className="h-3.5 w-3.5" /> Clear
                                </Button>
                            )}
                        </div>

                        {/* Active filter chips — each removable on its own,
                            with a "Clear all" escape hatch. */}
                        {activeRxFilterCount > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="text-xs text-muted-foreground font-medium">Active filters:</span>
                                {rxQueryDebounced && (
                                    <RxFilterChip label={`Search: "${rxQueryDebounced}"`} onClear={() => setRxQuery("")} />
                                )}
                                {rxStatus !== "ALL" && (
                                    <RxFilterChip label={`Status: ${rxStatus.toLowerCase().replace(/_/g, " ")}`} onClear={() => setRxStatus("ALL")} />
                                )}
                                {rxMedicineId && (
                                    <RxFilterChip
                                        label={`Medicine: ${rxMedicineNameById.get(rxMedicineId) ?? rxMedicineId}`}
                                        onClear={() => setRxMedicineId("")}
                                    />
                                )}
                                {rxPrescriberId && (
                                    <RxFilterChip
                                        label={`Prescriber: ${prescriberNameById.get(rxPrescriberId) ?? rxPrescriberId}`}
                                        onClear={() => setRxPrescriberId("")}
                                    />
                                )}
                                {rxDateFrom && (
                                    <RxFilterChip label={`From ${rxDateFrom}`} onClear={() => setRxDateFrom("")} />
                                )}
                                {rxDateTo && (
                                    <RxFilterChip label={`To ${rxDateTo}`} onClear={() => setRxDateTo("")} />
                                )}
                                {rxHasVideo && (
                                    <RxFilterChip label="Has video" onClear={() => setRxHasVideo(false)} />
                                )}
                                <button
                                    onClick={clearRxFilters}
                                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
                                >
                                    Clear all
                                </button>
                            </div>
                        )}

                        {showRxFilters && (
                            <div className="rounded-lg border bg-muted/20 p-4 mb-4 space-y-4">
                                {/* Date section */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                        Date range
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {datePresets.map((p) => {
                                            const active = activeDatePreset === p.id;
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => applyDatePreset(p.id)}
                                                    className={cn(
                                                        "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
                                                        active
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "bg-background hover:bg-muted/60 border-border",
                                                    )}
                                                >
                                                    {p.label}
                                                </button>
                                            );
                                        })}
                                        {(rxDateFrom || rxDateTo) && (
                                            <button
                                                type="button"
                                                onClick={() => { setRxDateFrom(""); setRxDateTo(""); }}
                                                className="text-[11px] px-2 py-1 text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
                                            >
                                                Clear dates
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">From</label>
                                            <input
                                                type="date"
                                                value={rxDateFrom}
                                                onChange={(e) => setRxDateFrom(e.target.value)}
                                                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">To</label>
                                            <input
                                                type="date"
                                                value={rxDateTo}
                                                onChange={(e) => setRxDateTo(e.target.value)}
                                                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* People section — admin only */}
                                {isAdminRole && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                            <Stethoscope className="w-3.5 h-3.5" />
                                            People
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Prescriber</label>
                                                <SearchableSelect
                                                    value={rxPrescriberId || "__all__"}
                                                    onChange={(v) => setRxPrescriberId(v === "__all__" ? "" : v)}
                                                    placeholder="All prescribers"
                                                    searchPlaceholder="Search by name…"
                                                    className="w-full h-9"
                                                    items={[
                                                        { value: "__all__", label: "All prescribers" },
                                                        ...prescribers.map((p) => ({ value: p.id, label: p.name })),
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Sort + extras section */}
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sort &amp; extras</div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Sort by</label>
                                            <Select value={rxSortBy} onValueChange={(v) => setRxSortBy(v as "createdAt" | "medicationName" | "totalQuantity" | "dispensedQty")}>
                                                <SelectTrigger className="h-9 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="createdAt">Date prescribed</SelectItem>
                                                    <SelectItem value="medicationName">Medication name</SelectItem>
                                                    <SelectItem value="totalQuantity">Quantity remaining</SelectItem>
                                                    <SelectItem value="dispensedQty">Dispensed quantity</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Order</label>
                                            <Select value={rxSortOrder} onValueChange={(v) => setRxSortOrder(v as "asc" | "desc")}>
                                                <SelectTrigger className="h-9 text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="desc">Newest / Highest first</SelectItem>
                                                    <SelectItem value="asc">Oldest / Lowest first</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer h-9 px-3 rounded-md border bg-background hover:bg-muted/40 transition-colors mt-5">
                                            <input
                                                type="checkbox"
                                                checked={rxHasVideo}
                                                onChange={(e) => setRxHasVideo(e.target.checked)}
                                            />
                                            <Youtube className="w-4 h-4 text-red-600" />
                                            Only with video {prescriptionFacets ? `(${prescriptionFacets.withVideo})` : ""}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                          </>
                        )}

                        {loadingPrescriptions ? (
                            <div className="text-center py-12 text-muted-foreground flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading prescriptions…
                            </div>
                        ) : (
                            <PrescriptionList
                                prescriptions={prescriptions}
                                onChange={handlePrescriptionAdded}
                                emptyMessage={activeRxFilterCount > 0
                                    ? "No prescriptions match the current filters."
                                    : "No prescriptions available yet."
                                }
                            />
                        )}
                    </Panel>
                )}
            </div>
        </AppLayout>
    );
}

function RxFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
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

type QuickChipTone = "primary" | "emerald" | "slate" | "amber" | "red";

function QuickPresetChip({
    label, icon: Icon, tone = "primary", active, onClick,
}: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tone?: QuickChipTone;
    active: boolean;
    onClick: () => void;
}) {
    const toneClasses: Record<QuickChipTone, { activeBg: string; activeText: string; activeBorder: string; idleText: string }> = {
        primary: { activeBg: "bg-primary",         activeText: "text-primary-foreground", activeBorder: "border-primary",         idleText: "text-primary" },
        emerald: { activeBg: "bg-emerald-600",     activeText: "text-white",              activeBorder: "border-emerald-600",     idleText: "text-emerald-700" },
        slate:   { activeBg: "bg-slate-600",       activeText: "text-white",              activeBorder: "border-slate-600",       idleText: "text-slate-700" },
        amber:   { activeBg: "bg-amber-500",       activeText: "text-white",              activeBorder: "border-amber-500",       idleText: "text-amber-700" },
        red:     { activeBg: "bg-red-600",         activeText: "text-white",              activeBorder: "border-red-600",         idleText: "text-red-600" },
    };
    const t = toneClasses[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 h-8 rounded-full border text-xs font-semibold transition-all",
                active
                    ? `${t.activeBg} ${t.activeText} ${t.activeBorder} shadow-sm`
                    : `bg-background hover:bg-muted/60 border-border ${t.idleText}`,
            )}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );
}
