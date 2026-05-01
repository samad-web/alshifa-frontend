import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import { Plus, Trash2, Search, Loader2, CheckCircle2, PlaySquare, ChevronsUpDown, Check, Video, X, ExternalLink, Package } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { iwisApi, type TreatmentPackage } from "@/services/iwis.service";
import { useAuth } from "@/hooks/useAuth";
import { useBranchScope } from "@/hooks/useBranchScope";
import { formatDate, expiryTone } from "@/lib/format-date";
import { InlineJourneyBuilder, type JourneyDraft, type JourneyTaskDraft } from "@/components/InlineJourneyBuilder";
import {
    HomeTherapyRequestForm,
    EMPTY_HOME_THERAPY_DRAFT,
    validateHomeTherapyDraft,
    type HomeTherapyDraft,
} from "@/components/HomeTherapyRequestForm";

interface Medicine {
    id: string;
    name: string;
    brand: string;
    category: string;
    type?: string;
    price: number;
    totalStock: number;
    videoUrl?: string;
    sku?: string;
    /** Earliest expiry across the medicine's stock batches in this branch.
     *  Server-computed on `/api/pharmacy/medicines/search`. */
    nearestExpiry?: string | null;
    /** Per-batch detail used by the dispense flow. */
    stocks?: Array<{ id: string; batchNumber?: string; expiryDate: string; quantity: number }>;
}

interface PrescriptionItem {
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes: string;
    timing: string;
    vehicle: string;
    medicineId?: string;
    videoUrl: string;
    sku?: string;
    /** Captured at selection so the row can render the expiry chip even
     *  after the picker is closed. */
    nearestExpiry?: string | null;
}

interface ExternalVideo {
    id: string;
    title: string;
    videoUrl: string;
    category: string;
}

interface MultiplePrescriptionFormProps {
    patientId: string;
    patientName?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
    /** Diagnosis text from the SOAP notes — pre-fills the inline journey title. */
    diagnosisHint?: string;
}

/**
 * Extract YouTube video ID from various URL formats and return an embed URL.
 * Returns null if not a YouTube URL.
 */
function getYouTubeEmbedUrl(url: string): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        let videoId: string | null = null;

        if (parsed.hostname.includes('youtube.com')) {
            if (parsed.pathname === '/watch') {
                videoId = parsed.searchParams.get('v');
            } else if (parsed.pathname.startsWith('/embed/')) {
                videoId = parsed.pathname.split('/embed/')[1]?.split(/[?&/]/)[0];
            } else if (parsed.pathname.startsWith('/shorts/')) {
                videoId = parsed.pathname.split('/shorts/')[1]?.split(/[?&/]/)[0];
            }
        } else if (parsed.hostname === 'youtu.be') {
            videoId = parsed.pathname.slice(1).split(/[?&/]/)[0];
        }

        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    } catch { /* not a valid URL */ }
    return null;
}

function isValidUrl(url: string): boolean {
    if (!url) return true;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

const TIMING_OPTIONS = [
    { value: "BEFORE_FOOD", label: "Before Food (Prapchaat)" },
    { value: "AFTER_FOOD", label: "After Food (Paschat)" },
    { value: "EMPTY_STOMACH", label: "Empty Stomach (Akala)" },
    { value: "BEDTIME", label: "At Bedtime (Nishi)" },
    { value: "WITH_FOOD", label: "With Food (Sabhakta)" },
];

const VEHICLE_OPTIONS = [
    { value: "WARM_WATER", label: "Warm Water" },
    { value: "HONEY", label: "Honey" },
    { value: "MILK", label: "Milk" },
    { value: "GHEE", label: "Ghee" },
    { value: "BUTTERMILK", label: "Buttermilk" },
];

export function MultiplePrescriptionForm({
    patientId,
    patientName,
    onSuccess,
    onCancel,
    diagnosisHint,
}: MultiplePrescriptionFormProps) {
    const [loading, setLoading] = useState(false);
    const [videos, setVideos] = useState<ExternalVideo[]>([]);

    // Inline journey draft — null when the clinician hasn't enabled the
    // "Add Journey" panel below the medication rows.
    const [journeyDraft, setJourneyDraft] = useState<JourneyDraft | null>(null);

    // Home-therapy referral draft — only DOCTOR / ADMIN_DOCTOR can author
    // these. Therapists writing prescriptions don't see the section.
    const [homeTherapyDraft, setHomeTherapyDraft] = useState<HomeTherapyDraft>(EMPTY_HOME_THERAPY_DRAFT);

    // ── Treatment package selector ─────────────────────────────────────
    // Loads packages scoped to the active branch (navbar context first,
    // user's home branch as fallback) and lets the clinician attach one
    // to the prescription as broader plan context. The selected package's
    // id is sent up with the batch payload (Prescription.packageId).
    const { profile, role: viewerRole } = useAuth();
    const canRequestHomeTherapy = viewerRole === "DOCTOR" || viewerRole === "ADMIN_DOCTOR";
    const { branchIdParam } = useBranchScope();
    const homeBranchId =
        (profile as any)?.branchId
        ?? (profile as any)?.user?.branchId
        ?? null;
    const packageBranchId = branchIdParam ?? homeBranchId ?? null;
    const [packages, setPackages] = useState<TreatmentPackage[]>([]);
    const [packagesLoading, setPackagesLoading] = useState(false);
    const [selectedPackageId, setSelectedPackageId] = useState<string>("");
    const selectedPackage = packages.find((p) => p.id === selectedPackageId) ?? null;

    useEffect(() => {
        if (!packageBranchId) {
            setPackages([]);
            return;
        }
        setPackagesLoading(true);
        iwisApi.listPackages(packageBranchId)
            .then((list) => setPackages(Array.isArray(list) ? list.filter((p) => p.isActive) : []))
            .catch(() => setPackages([]))
            .finally(() => setPackagesLoading(false));
    }, [packageBranchId]);

    // Per-row server-side search state. Each medication line has its
    // own query + filter combination + result cache so opening a
    // picker doesn't invalidate the others. Inventory can have 1000s
    // of medicines, so we never load the full catalogue — every
    // change re-hits /api/pharmacy/medicines/search with a 50-row cap.
    type RowSearch = {
        query: string;
        results: Medicine[];
        total: number;
        loading: boolean;
        fetched: boolean;
        inStockOnly: boolean;
    };
    const defaultRowSearch: RowSearch = {
        query: "", results: [], total: 0, loading: false, fetched: false, inStockOnly: false,
    };
    const [searchByRow, setSearchByRow] = useState<Record<number, RowSearch>>({});
    const [openRowIndex, setOpenRowIndex] = useState<number | null>(null);

    const updateRowSearch = useCallback((i: number, patch: Partial<RowSearch>) => {
        setSearchByRow(prev => ({ ...prev, [i]: { ...(prev[i] ?? defaultRowSearch), ...patch } }));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, []);

    const fetchRowResults = useCallback(async (i: number) => {
        const s = searchByRow[i] ?? defaultRowSearch;
        const params: Record<string, string | number | boolean | undefined> = {
            limit: 50, sortBy: "name", sortOrder: "asc",
        };
        if (s.query.trim())  params.q = s.query.trim();
        if (s.inStockOnly)   params.availability = "IN_STOCK";

        updateRowSearch(i, { loading: true });
        try {
            const { data } = await apiClient.get<{ medicines: Medicine[]; pagination: { total: number } }>(
                '/api/pharmacy/medicines/search', params,
            );
            updateRowSearch(i, {
                results: data?.medicines || [],
                total: data?.pagination?.total || 0,
                loading: false,
                fetched: true,
            });
        } catch (err) {
            console.error("Medicine search failed:", err);
            updateRowSearch(i, { loading: false, fetched: true });
        }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [searchByRow, updateRowSearch]);

    // Debounced refetch when the OPEN row's filters change. Closed rows
    // don't refire — their last results stay cached until reopened.
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (openRowIndex === null) return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            fetchRowResults(openRowIndex);
        }, 250);
        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [
        openRowIndex,
        searchByRow[openRowIndex ?? -1]?.query,
        searchByRow[openRowIndex ?? -1]?.inStockOnly,
    ]);
    const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([
        {
            medicationName: "",
            dosage: "",
            frequency: "",
            duration: "",
            notes: "",
            timing: "AFTER_FOOD",
            vehicle: "WARM_WATER",
            videoUrl: "",
        },
    ]);

    useEffect(() => {
        fetchVideos();
    }, []);

    const fetchVideos = async () => {
        try {
            const { data } = await apiClient.get<ExternalVideo[]>('/api/wellness/videos');
            setVideos(data);
        } catch (error) {
            console.error("Failed to fetch videos:", error);
        }
    };

    const addItem = () => {
        setPrescriptionItems([
            ...prescriptionItems,
            {
                medicationName: "",
                dosage: "",
                frequency: "",
                duration: "",
                notes: "",
                timing: "AFTER_FOOD",
                vehicle: "WARM_WATER",
                videoUrl: "",
            },
        ]);
    };

    const removeItem = (index: number) => {
        if (prescriptionItems.length === 1) return;
        const newItems = [...prescriptionItems];
        newItems.splice(index, 1);
        setPrescriptionItems(newItems);
    };

    const updateItem = (index: number, field: keyof PrescriptionItem, value: string) => {
        const newItems = [...prescriptionItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // If updating medicationName via free-text typing, try to match
        // against the most recent search results for this row to
        // auto-link the medicineId / SKU / video.
        if (field === "medicationName") {
            const cached = searchByRow[index]?.results || [];
            const med = cached.find(m => m.name.toLowerCase() === value.toLowerCase());
            if (med) {
                newItems[index].medicineId = med.id;
                newItems[index].sku = med.sku;
                if (med.videoUrl) {
                    newItems[index].videoUrl = med.videoUrl;
                }
            }
        }

        setPrescriptionItems(newItems);
    };

    const handleSelectMedicine = (index: number, med: Medicine) => {
        const newItems = [...prescriptionItems];
        const incomingVideo = (med.videoUrl || "").trim();
        const previousVideo = (newItems[index].videoUrl || "").trim();

        newItems[index] = {
            ...newItems[index],
            medicationName: med.name,
            medicineId: med.id,
            sku: med.sku,
            nearestExpiry: med.nearestExpiry ?? null,
            // Catalog video always wins when the medicine has one — the
            // pharmacy team curates these on the inventory record so doctors
            // shouldn't have to type the URL during a consult. The previous
            // implementation only auto-filled when the field was empty,
            // which silently discarded curated links if a user had typed
            // anything earlier in the row (e.g. a placeholder space).
            videoUrl: incomingVideo || previousVideo,
        };
        setPrescriptionItems(newItems);

        if (incomingVideo && incomingVideo !== previousVideo) {
            toast.success("Instruction video auto-filled from inventory record", { duration: 2200 });
        }

        // Surface a heads-up when the selected medicine is already past
        // its earliest-batch expiry — this prevents the doctor from
        // silently prescribing a stockout-imminent line.
        if (med.nearestExpiry && expiryTone(med.nearestExpiry) === "expired") {
            toast.error(`Heads up: nearest batch of ${med.name} expired on ${formatDate(med.nearestExpiry)}`);
        } else if (med.nearestExpiry && expiryTone(med.nearestExpiry) === "expiring") {
            toast.success(`${med.name} — nearest batch expires ${formatDate(med.nearestExpiry)}`, { duration: 2500 });
        }

        // Suggest a MEDICATION task to the inline journey builder. The builder
        // listens for `inline-journey:add-task` on the window — only acts if
        // the journey panel is enabled and in "Create New" mode. Therapists
        // get filtered out inside the builder (no MEDICATION authority).
        const freq = newItems[index].frequency || "Daily";
        const suggestedTask: JourneyTaskDraft = {
            type: "MEDICATION",
            title: med.name,
            description: med.brand ? `Brand: ${med.brand}` : undefined,
            frequency: freq,
        };
        window.dispatchEvent(new CustomEvent("inline-journey:add-task", { detail: { task: suggestedTask } }));
    };

    /** Render the right-tone chip for an expiry date — amber within 30 days,
     *  red once past, muted otherwise. Shared across the picker rows and
     *  the selected-medicine confirmation strip. */
    const ExpiryChip = ({ date }: { date: string | null | undefined }) => {
        if (!date) return null;
        const tone = expiryTone(date);
        const cls = tone === "expired"
            ? "bg-red-100 text-red-700 border border-red-200"
            : tone === "expiring"
                ? "bg-amber-100 text-amber-700 border border-amber-200"
                : "bg-muted text-muted-foreground border border-border";
        return (
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", cls)}>
                {tone === "expired" ? "Expired" : "Exp"} {formatDate(date)}
            </span>
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        const invalid = prescriptionItems.some(item => !item.medicationName || !item.dosage || !item.frequency || !item.duration);
        if (invalid) {
            toast.error("Please fill in all required fields for each medication");
            return;
        }

        setLoading(true);

        try {
            // Build the optional journey payload. existingJourneyId is not
            // wired through the inline atomic create path on the backend — we
            // only send `journey` when the clinician is authoring a NEW one.
            // (Assigning an existing template is a separate POST that the
            // builder can do directly from its own state when needed.)
            let journeyPayload: undefined | {
                title: string; condition: string; goal: string; targetEndDate: string;
                phases: { name: string; durationDays: number;
                    tasks: { type: string; title: string; description?: string; frequency: string }[] }[];
            };
            if (journeyDraft && !journeyDraft.existingJourneyId) {
                if (!journeyDraft.title || !journeyDraft.condition || !journeyDraft.goal || !journeyDraft.targetEndDate) {
                    toast.error("Journey requires title, condition, goal, and target end date");
                    setLoading(false);
                    return;
                }
                if (!journeyDraft.phases.length || journeyDraft.phases.some((p) => !p.name || p.durationDays < 1)) {
                    toast.error("Each journey phase requires a name and duration ≥ 1 day");
                    setLoading(false);
                    return;
                }
                journeyPayload = {
                    title:         journeyDraft.title,
                    condition:     journeyDraft.condition,
                    goal:          journeyDraft.goal,
                    targetEndDate: journeyDraft.targetEndDate,
                    phases:        journeyDraft.phases.map((p) => ({
                        name:         p.name,
                        durationDays: p.durationDays,
                        tasks:        p.tasks
                            .filter((t) => t.title && t.frequency)
                            .map((t) => ({
                                type:        t.type,
                                title:       t.title,
                                description: t.description || undefined,
                                frequency:   t.frequency,
                            })),
                    })),
                };
            }

            // Home-therapy referral payload — only DOCTOR / ADMIN_DOCTOR
            // can author one. validateHomeTherapyDraft returns either a
            // ready payload (or null when the section is disabled) OR a
            // precise error message we can surface in a toast.
            let homeTherapyPayload: { totalSessions: number; sessionModes: ("HOME"|"HOSPITAL")[]; notes?: string; intervalDays?: number } | null = null;
            if (canRequestHomeTherapy) {
                const ht = validateHomeTherapyDraft(homeTherapyDraft);
                if (!ht.ok) {
                    toast.error(ht.error);
                    setLoading(false);
                    return;
                }
                homeTherapyPayload = ht.payload;
            }

            await apiClient.post('/api/prescriptions/batch-add', {
                patientId,
                medicines: prescriptionItems,
                packageId:    selectedPackageId || undefined,
                journey:      journeyPayload,
                homeTherapy:  homeTherapyPayload || undefined,
            });
            const successMsg = homeTherapyPayload
                ? "Prescription saved · home-therapy request sent for admin approval"
                : journeyPayload
                    ? "Prescriptions and treatment journey added"
                    : "Prescriptions added successfully";
            toast.success(successMsg);
            onSuccess?.();
        } catch (error: any) {
            toast.error(error?.message || "Failed to add prescriptions");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground">Write Prescription</h2>
                    {patientName && (
                        <p className="text-sm text-muted-foreground">For: {patientName}</p>
                    )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Medication
                </Button>
            </div>

            {/* ── Treatment package picker ──────────────────────────────
                Optional. Lets the clinician attach a TreatmentPackage to
                the prescription so the receiving pharmacist / patient
                sees the broader plan context. */}
            <div className="rounded-2xl border border-border/50 bg-secondary/10 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        <Label className="text-sm font-bold">Add Package</Label>
                        <Badge variant="outline" className="text-[10px]">Optional</Badge>
                    </div>
                    {selectedPackageId && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setSelectedPackageId("")}
                        >
                            <X className="w-3 h-3 mr-1" /> Clear
                        </Button>
                    )}
                </div>
                <Select
                    value={selectedPackageId || undefined}
                    onValueChange={(v) => setSelectedPackageId(v === "__none__" ? "" : v)}
                    disabled={packagesLoading || (!packageBranchId)}
                >
                    <SelectTrigger className="bg-background">
                        <SelectValue
                            placeholder={
                                !packageBranchId
                                    ? "Select a branch in the navbar to see packages"
                                    : packagesLoading
                                        ? "Loading packages…"
                                        : packages.length === 0
                                            ? "No active packages in this branch"
                                            : "Pick a treatment package"
                            }
                        />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">No package</SelectItem>
                        {packages.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                                <div className="flex flex-col">
                                    <span className="font-medium">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground">
                                        {p.durationDays} days · ₹{p.price.toLocaleString()}
                                    </span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {selectedPackage && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm">{selectedPackage.name}</div>
                            <Badge className="bg-primary/15 text-primary border border-primary/20">
                                {selectedPackage.durationDays} days
                            </Badge>
                        </div>
                        {selectedPackage.description && (
                            <p className="text-xs text-muted-foreground">{selectedPackage.description}</p>
                        )}
                        {Array.isArray(selectedPackage.components) && selectedPackage.components.length > 0 && (
                            <ul className="text-xs space-y-1">
                                {selectedPackage.components.map((c, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                                        <span className="font-medium">{c.type}:</span>
                                        <span className="text-muted-foreground">{c.description}</span>
                                        <span className="text-muted-foreground">×{c.quantity}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="text-xs text-muted-foreground italic">
                            Read-only summary. Edit the package itself from Treatment Packages.
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {prescriptionItems.map((item, index) => (
                    <div key={index} className="p-4 bg-secondary/20 rounded-xl relative border border-border/50 group">
                        {prescriptionItems.length > 1 && (
                            <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-risk text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2 space-y-2">
                                <Label>Medication Name (Search by Name or SKU) *</Label>
                                <div className="relative">
                                    <Popover
                                        onOpenChange={(open) => {
                                            if (open) {
                                                setOpenRowIndex(index);
                                                // Trigger initial fetch only if this row hasn't loaded yet
                                                if (!searchByRow[index]?.fetched) {
                                                    fetchRowResults(index);
                                                }
                                            } else if (openRowIndex === index) {
                                                setOpenRowIndex(null);
                                            }
                                        }}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between font-normal",
                                                    !item.medicationName && "text-muted-foreground"
                                                )}
                                            >
                                                {item.medicationName
                                                    ? (item.sku ? `${item.medicationName} (${item.sku})` : item.medicationName)
                                                    : "Select medicine..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[calc(100vw-2rem)] md:w-[480px] p-0" align="start">
                                            {/* shouldFilter=false because we're driving the
                                                result list from the server via /medicines/search.
                                                Letting Command also filter would cause flicker. */}
                                            <Command shouldFilter={false}>
                                                <CommandInput
                                                    placeholder="Search medicine, SKU, brand…"
                                                    value={searchByRow[index]?.query ?? ""}
                                                    onValueChange={(v) => updateRowSearch(index, { query: v })}
                                                />
                                                {/* In-stock-only toggle — narrows the search to
                                                    medicines with available stock. Kept as the
                                                    only inline filter; Type/Category were removed
                                                    per request to reduce visual noise. */}
                                                <div className="px-2 pt-2 pb-2 border-b border-border/40 flex items-center justify-between">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateRowSearch(index, { inStockOnly: !(searchByRow[index]?.inStockOnly) })}
                                                        className={cn(
                                                            "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                                                            searchByRow[index]?.inStockOnly
                                                                ? "bg-emerald-600 text-white border-emerald-600"
                                                                : "bg-background hover:bg-muted/60 border-border text-muted-foreground",
                                                        )}
                                                    >
                                                        <Package className="w-3 h-3" />
                                                        In stock only
                                                    </button>
                                                    {searchByRow[index]?.inStockOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => updateRowSearch(index, { inStockOnly: false })}
                                                            className="text-[10px] text-muted-foreground hover:text-destructive underline-offset-2 hover:underline"
                                                        >
                                                            Clear filter
                                                        </button>
                                                    )}
                                                </div>
                                                <CommandEmpty>
                                                    {searchByRow[index]?.loading ? (
                                                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground py-3">
                                                            <Loader2 className="w-3 h-3 animate-spin" /> Searching inventory…
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground py-3 inline-block">
                                                            No medicines match these filters.
                                                        </span>
                                                    )}
                                                </CommandEmpty>
                                                <CommandList className="max-h-[320px]">
                                                    <CommandGroup>
                                                        {(searchByRow[index]?.results ?? []).map((med) => (
                                                            <CommandItem
                                                                key={med.id}
                                                                value={`${med.name} ${med.sku || ""}`}
                                                                onSelect={() => handleSelectMedicine(index, med)}
                                                            >
                                                                <div className="flex flex-col w-full">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                item.medicineId === med.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <span className="font-bold">{med.name}</span>
                                                                        {med.sku && (
                                                                            <Badge variant="secondary" className="text-[9px] font-black uppercase py-0 px-1">
                                                                                {med.sku}
                                                                            </Badge>
                                                                        )}
                                                                        {med.type && (
                                                                            <Badge variant="outline" className="text-[9px] py-0 px-1">
                                                                                {med.type}
                                                                            </Badge>
                                                                        )}
                                                                        {/* Earliest-batch expiry — amber within 30d, red once past. */}
                                                                        <ExpiryChip date={med.nearestExpiry} />
                                                                    </div>
                                                                    <div className="ml-6 flex items-center gap-3 text-[10px] text-muted-foreground">
                                                                        <span>{med.brand || "Generics"}</span>
                                                                        {med.category && <span>· {med.category}</span>}
                                                                        <span className={med.totalStock < 10 ? "text-attention font-bold" : ""}>
                                                                            · {med.totalStock} in stock
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                                {/* Footer: showing X of Y. Hint to refine if truncated. */}
                                                <div className="px-3 py-2 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
                                                    {searchByRow[index]?.loading ? (
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                            Searching…
                                                        </span>
                                                    ) : (
                                                        <span>
                                                            Showing <strong>{searchByRow[index]?.results.length ?? 0}</strong>
                                                            {" of "}
                                                            <strong>{searchByRow[index]?.total ?? 0}</strong>
                                                            {" matching medicines"}
                                                        </span>
                                                    )}
                                                    {(searchByRow[index]?.total ?? 0) > (searchByRow[index]?.results.length ?? 0) && (
                                                        <span className="italic">Refine search to narrow results</span>
                                                    )}
                                                </div>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {item.medicationName && (
                                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                                            {item.medicineId ? (
                                                <span className="text-[10px] text-wellness flex items-center gap-1 font-bold">
                                                    <CheckCircle2 className="w-3 h-3" /> Selected from Inventory {item.sku ? `(${item.sku})` : ""}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-attention font-bold italic">Unlinked Medication</span>
                                            )}
                                            {/* Persist the expiry chip after the picker closes so the
                                                doctor sees the warning while filling out dosage / frequency. */}
                                            <ExpiryChip date={item.nearestExpiry} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Dosage *</Label>
                                <Input
                                    value={item.dosage}
                                    onChange={(e) => updateItem(index, "dosage", e.target.value)}
                                    placeholder="e.g., 500mg or 2 tablets"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Duration *</Label>
                                <Input
                                    value={item.duration}
                                    onChange={(e) => updateItem(index, "duration", e.target.value)}
                                    placeholder="e.g., 7 days"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Frequency *</Label>
                                <Input
                                    value={item.frequency}
                                    onChange={(e) => updateItem(index, "frequency", e.target.value)}
                                    placeholder="e.g., TDS (3 times/day)"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Timing</Label>
                                <Select
                                    value={item.timing}
                                    onValueChange={(val) => updateItem(index, "timing", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMING_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Vehicle (Anupana)</Label>
                                <Select
                                    value={item.vehicle}
                                    onValueChange={(val) => updateItem(index, "vehicle", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VEHICLE_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label>Special Notes / Pathya (Lifestyle)</Label>
                                <Input
                                    value={item.notes}
                                    onChange={(e) => updateItem(index, "notes", e.target.value)}
                                    placeholder="Additional instructions..."
                                />
                            </div>

                            {/* Video URL Section */}
                            <div className="md:col-span-4 border-t border-border/30 pt-3">
                                {!item.videoUrl ? (
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateItem(index, "videoUrl", " ")}
                                            className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
                                        >
                                            <Video className="w-4 h-4" />
                                            Add YouTube Video
                                        </Button>
                                        <span className="text-[10px] text-muted-foreground">
                                            Attach an exercise or medication guidance video for the patient
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="flex items-center gap-2 text-sm font-medium">
                                                <Video className="w-4 h-4 text-primary" />
                                                Video URL
                                                <span className="text-xs font-normal text-muted-foreground">(paste YouTube link)</span>
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={() => updateItem(index, "videoUrl", "")}
                                                className="text-muted-foreground hover:text-destructive p-1 rounded"
                                                aria-label="Remove video"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <Input
                                            value={item.videoUrl.trim()}
                                            onChange={(e) => updateItem(index, "videoUrl", e.target.value)}
                                            onPaste={(e) => {
                                                // Auto-trim pasted content
                                                const pasted = e.clipboardData.getData('text').trim();
                                                if (pasted) {
                                                    e.preventDefault();
                                                    updateItem(index, "videoUrl", pasted);
                                                }
                                            }}
                                            placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                                            className={!isValidUrl(item.videoUrl.trim()) && item.videoUrl.trim() ? 'border-destructive' : ''}
                                            autoFocus
                                        />

                                        {/* Validation feedback */}
                                        {item.videoUrl.trim() && !isValidUrl(item.videoUrl.trim()) && (
                                            <p className="text-xs text-destructive">Please enter a valid URL starting with https://</p>
                                        )}

                                        {item.videoUrl.trim() && isValidUrl(item.videoUrl.trim()) && (
                                            <p className="text-xs text-primary/70 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Valid URL — patient will see an embedded video in their prescription
                                            </p>
                                        )}

                                        {/* YouTube preview thumbnail */}
                                        {(() => {
                                            const embedUrl = getYouTubeEmbedUrl(item.videoUrl.trim());
                                            if (!embedUrl) return null;
                                            const videoId = embedUrl.split('/embed/')[1];
                                            return (
                                                <div className="flex items-center gap-3 p-2 bg-background rounded-lg border">
                                                    <img
                                                        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                                                        alt="Video thumbnail"
                                                        className="w-24 h-14 object-cover rounded"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium truncate">YouTube Video</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{item.videoUrl.trim()}</p>
                                                    </div>
                                                    <a
                                                        href={item.videoUrl.trim()}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:text-primary/80 p-1"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            );
                                        })()}

                                        {/* Quick select from video library */}
                                        {videos.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Or select from library</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {videos.slice(0, 6).map(v => (
                                                        <Button
                                                            key={v.id}
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-auto py-1 px-2 text-[10px] border border-border/50"
                                                            onClick={() => updateItem(index, "videoUrl", v.videoUrl)}
                                                        >
                                                            <PlaySquare className="w-3 h-3 mr-1" />
                                                            {v.title}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Inline Journey Builder — optional treatment plan attached to
                the prescription. Submitting the form sends the journey object
                in the same atomic call (POST /api/prescriptions/batch-add). */}
            <InlineJourneyBuilder
                patientId={patientId}
                diagnosisHint={diagnosisHint}
                onChange={setJourneyDraft}
            />

            {/* Home Therapy Request — DOCTOR / ADMIN_DOCTOR only. When
                enabled, the same atomic call also creates a
                HomeTherapyRequest in PENDING_APPROVAL status and notifies
                admins via Socket.IO. */}
            {canRequestHomeTherapy && (
                <HomeTherapyRequestForm
                    draft={homeTherapyDraft}
                    onChange={setHomeTherapyDraft}
                    branchId={packageBranchId}
                />
            )}

            <div className="flex gap-3 justify-end pt-4 border-t">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={loading} className="min-w-[120px]">
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Issue Prescription"
                    )}
                </Button>
            </div>
        </form>
    );
}
