import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/common/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Plus, Trash2, ShoppingCart, Loader2, CheckCircle2, X, User, AlertTriangle, Stethoscope, FileText, Pill, History, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { formatDate, expiryTone } from "@/lib/format-date";
import { useDebounce } from "@/hooks/useDebounce";

export default function PharmacyDispense() {
    const [patients, setPatients] = useState([]);
    const [medicines, setMedicines] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [patientSearch, setPatientSearch] = useState("");
    const [medicineSearch, setMedicineSearch] = useState("");
    const [branches, setBranches] = useState<any[]>([]);
    const [dispenseBranchFilter, setDispenseBranchFilter] = useState("all");
    const [cart, setCart] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [patientsLoading, setPatientsLoading] = useState(true);
    // Active prescriptions for the selected patient — driven by
    // /api/prescriptions/search?patientId=…&status=ACTIVE so the pharmacist
    // sees what the doctor prescribed before they start hunting through
    // the medicine catalogue.
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);

    useEffect(() => {
        // Fetch patients
        setPatientsLoading(true);
        apiClient.get<any[]>('/api/user/list-patients')
            .then(({ data }) => setPatients(Array.isArray(data) ? data : []))
            .catch(err => toast.error(`Failed to load patients: ${err.message}`))
            .finally(() => setPatientsLoading(false));

        // Fetch medicines
        apiClient.get<any[]>('/api/pharmacy/medicines')
            .then(({ data }) => {
                if (Array.isArray(data)) setMedicines(data);
                else {
                    console.error("Medicines data is not an array:", data);
                    setMedicines([]);
                }
            })
            .catch(() => toast.error("Failed to load medicines"));

        // Fetch branches for patient classification filter
        apiClient.get<any[]>('/api/branches')
            .then(({ data }) => { if (Array.isArray(data)) setBranches(data); })
            .catch(() => {});
    }, []);

    // Pull the selected patient's active prescriptions whenever the
    // selection changes. The backend already scopes by the pharmacist's
    // branch and status=ACTIVE drops anything discontinued.
    useEffect(() => {
        if (!selectedPatientId) {
            setPrescriptions([]);
            return;
        }
        let cancelled = false;
        setPrescriptionsLoading(true);
        apiClient
            .get<any>('/api/prescriptions/search', {
                patientId: selectedPatientId,
                status: 'ACTIVE',
                limit: '50',
            })
            .then(({ data }) => {
                if (cancelled) return;
                const rows = Array.isArray(data?.prescriptions)
                    ? data.prescriptions
                    : Array.isArray(data) ? data : [];
                setPrescriptions(rows);
            })
            .catch(() => { if (!cancelled) setPrescriptions([]); })
            .finally(() => { if (!cancelled) setPrescriptionsLoading(false); });
        return () => { cancelled = true; };
    }, [selectedPatientId]);

    // Live patient-search results. Match against full name, phone,
    // patientId (the human-friendly external id), and email so the
    // pharmacist can find anyone the receptionist might key in.
    const filteredPatients = useMemo(() => patients.filter((p: any) => {
        if (!p.id) return false; // guard: Radix SelectItem crashes on empty value
        const q = patientSearch.trim().toLowerCase();
        const matchesSearch = !q
            || (p.fullName?.toLowerCase() || "").includes(q)
            || (p.phoneNumber || "").toLowerCase().includes(q)
            || (p.patientId?.toLowerCase() || "").includes(q)
            || (p.email?.toLowerCase() || "").includes(q);
        const matchesBranch = dispenseBranchFilter === "all" || p.branchId === dispenseBranchFilter;
        return matchesSearch && matchesBranch;
    }), [patients, patientSearch, dispenseBranchFilter]);

    const selectedPatient: any = patients.find((p: any) => p.id === selectedPatientId) ?? null;

    // Live medicine search — name, brand, and genericName so the pharmacist
    // can find a drug whether they remember the trade name or the molecule.
    const filteredMedicines = useMemo(() => {
        const q = medicineSearch.trim().toLowerCase();
        if (!q) return medicines;
        return medicines.filter((m: any) =>
            (m.name?.toLowerCase() || "").includes(q)
            || (m.brand?.toLowerCase() || "").includes(q)
            || (m.genericName?.toLowerCase() || "").includes(q),
        );
    }, [medicines, medicineSearch]);

    const addToCart = (medicine: any) => {
        // Basic stock check
        if (medicine.totalStock <= 0) {
            toast.error("Medicine is out of stock!");
            return;
        }

        // Pick the freshest non-expired batch first so the pharmacist
        // doesn't accidentally dispense expired stock that happens to
        // sit at index 0 in the response.
        const stocks: Array<{ id: string; expiryDate?: string; batchNumber?: string; quantity: number }>
            = Array.isArray(medicine.stocks) ? medicine.stocks : [];
        const sortedStocks = stocks
            .filter((s) => (s.quantity ?? 0) > 0)
            .sort((a, b) => {
                const ae = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
                const be = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
                return ae - be;
            });
        // Skip past-expiry batches when there's a fresher option available.
        const freshFirst = sortedStocks.find((s) => expiryTone(s.expiryDate) !== "expired") ?? sortedStocks[0];

        const existing = cart.find(item => item.medicineId === medicine.id);
        if (existing) {
            if (existing.quantity + 1 > medicine.totalStock) {
                toast.error("Insufficient stock!");
                return;
            }
            setCart(cart.map(item =>
                item.medicineId === medicine.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                medicineId: medicine.id,
                name: medicine.name,
                price: medicine.price,
                quantity: 1,
                stockId: freshFirst?.id ?? medicine.stocks?.[0]?.id,
                batchNumber: freshFirst?.batchNumber ?? medicine.stocks?.[0]?.batchNumber ?? null,
                expiryDate: freshFirst?.expiryDate ?? medicine.stocks?.[0]?.expiryDate ?? null,
            }]);
            if (freshFirst?.expiryDate && expiryTone(freshFirst.expiryDate) === "expired") {
                toast.error(`No fresh batch found for ${medicine.name} — assigned an expired batch (${formatDate(freshFirst.expiryDate)})`);
            }
        }
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.medicineId !== id));
    };

    // Try to resolve a prescription row to a stocked Medicine in the
    // current branch's catalogue. Direct medicineId match wins; otherwise
    // we fuzzy-match on medicationName so free-text prescriptions still
    // dispense when the pharmacy stocks the same drug under a different
    // FK. Returns null when no match is found — the row then renders as
    // informational only.
    const resolveMedicineForPrescription = (rx: any): any | null => {
        if (!rx) return null;
        if (rx.medicineId) {
            const direct = medicines.find((m: any) => m.id === rx.medicineId);
            if (direct) return direct;
        }
        const name = (rx.medicationName || "").trim().toLowerCase();
        if (!name) return null;
        return (
            medicines.find((m: any) => (m.name || "").toLowerCase() === name) ||
            medicines.find((m: any) => (m.name || "").toLowerCase().includes(name)) ||
            null
        );
    };

    const addPrescriptionToCart = (rx: any) => {
        const medicine = resolveMedicineForPrescription(rx);
        if (!medicine) {
            toast.error(
                `${rx.medicationName} isn't in your branch's catalogue. Search and add manually below.`,
            );
            return;
        }
        addToCart(medicine);
    };

    const handleDispense = async () => {
        if (!selectedPatientId || cart.length === 0) return;

        setSubmitting(true);
        try {
            await apiClient.post('/api/pharmacy/dispense', { patientId: selectedPatientId, items: cart });
            setSuccess(true);
            setCart([]);
            setSelectedPatientId("");
            toast.success("Medicines dispensed successfully!");
            setTimeout(() => setSuccess(false), 3000);
        } catch (error: any) {
            toast.error(error?.message || "Failed to dispense medicines");
        } finally {
            setSubmitting(false);
        }
    };

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8">
                <PageHeader
                    title="Dispense Medicines"
                    subtitle="Record medicine sales and view past dispensing"
                />

                <Tabs defaultValue="dispense">
                    <TabsList className="mb-6">
                        <TabsTrigger value="dispense" className="gap-2">
                            <Pill className="w-4 h-4" /> Dispense
                        </TabsTrigger>
                        <TabsTrigger value="history" className="gap-2">
                            <History className="w-4 h-4" /> Dispense History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="dispense">

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Patient & Medicine Selection */}
                    <div className="lg:col-span-2 space-y-6">
                        <Panel title="Step 1: Select Patient" subtitle="Identify the patient receiving medications">
                            <div className="space-y-4">
                                {/* Live patient combobox: as the pharmacist
                                    types, the matching list renders inline
                                    underneath instead of being hidden behind
                                    a Select dropdown. Each row shows full
                                    name, patient ID, branch, and phone. */}
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by name, ID, phone, or email…"
                                            className="pl-10 pr-10"
                                            value={patientSearch}
                                            onChange={(e) => setPatientSearch(e.target.value)}
                                            disabled={patientsLoading}
                                        />
                                        {patientSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setPatientSearch("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                aria-label="Clear search"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    {branches.length > 0 && (
                                        <Select value={dispenseBranchFilter} onValueChange={setDispenseBranchFilter}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Filter by branch (all)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All branches</SelectItem>
                                                {branches.map((b: any) => (
                                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    {/* Inline live results — always visible
                                        when there's a search or no patient
                                        selected yet. Capped at 30 rows with
                                        a "+N more" hint to keep the panel
                                        scannable. */}
                                    {patientsLoading ? (
                                        <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Loading patients…
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-border/60 max-h-72 overflow-y-auto bg-card">
                                            {filteredPatients.length === 0 ? (
                                                <div className="p-4 text-sm text-muted-foreground text-center">
                                                    {patientSearch
                                                        ? `No patients match "${patientSearch}"`
                                                        : "No patients available"}
                                                </div>
                                            ) : (
                                                <>
                                                    {filteredPatients.slice(0, 30).map((p: any) => {
                                                        const branchName = p.branchName
                                                            ?? branches.find((b: any) => b.id === p.branchId)?.name
                                                            ?? "—";
                                                        const isSelected = selectedPatientId === p.id;
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                onClick={() => setSelectedPatientId(p.id)}
                                                                className={cn(
                                                                    "w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 border-b border-border/40 last:border-b-0 transition-colors",
                                                                    isSelected
                                                                        ? "bg-primary/10"
                                                                        : "hover:bg-secondary/50",
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
                                                                        {branchName}
                                                                        {p.phoneNumber && <> · {p.phoneNumber}</>}
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                    {filteredPatients.length > 30 && (
                                                        <div className="px-3 py-2 text-[11px] text-muted-foreground bg-muted/30">
                                                            Showing 30 of {filteredPatients.length}. Refine the search to narrow down.
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {selectedPatient && (
                                        <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
                                            <div className="min-w-0">
                                                <div className="text-xs text-primary/80 uppercase tracking-wide font-bold">Selected</div>
                                                <div className="text-sm font-semibold truncate">
                                                    {selectedPatient.fullName || "Unnamed Patient"}
                                                    {selectedPatient.patientId && (
                                                        <span className="ml-2 text-xs font-mono text-muted-foreground">
                                                            {selectedPatient.patientId}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedPatientId("")}
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Panel>

                        {selectedPatient && (
                            <Panel
                                title="Doctor's Prescriptions"
                                subtitle="Active prescriptions written for this patient"
                            >
                                {prescriptionsLoading ? (
                                    <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Loading prescriptions…
                                    </div>
                                ) : prescriptions.length === 0 ? (
                                    <div className="p-4 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground text-center">
                                        No active prescriptions on file for this patient. Add medicines manually below.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {prescriptions.map((rx: any) => {
                                            const matched = resolveMedicineForPrescription(rx);
                                            const inCart = matched
                                                ? cart.some((i) => i.medicineId === matched.id)
                                                : false;
                                            const prescriber =
                                                rx.doctor?.fullName ||
                                                rx.therapist?.fullName ||
                                                rx.doctor?.user?.email ||
                                                rx.therapist?.user?.email ||
                                                "Clinician";
                                            const namePrefix = rx.doctor ? "Dr. " : "";
                                            return (
                                                <div
                                                    key={rx.id}
                                                    className="p-3 rounded-xl border bg-card flex items-start justify-between gap-3"
                                                >
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                                                            <span className="font-bold text-sm">
                                                                {rx.medicationName}
                                                            </span>
                                                            {!matched && (
                                                                <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                                                                    Not stocked
                                                                </span>
                                                            )}
                                                            {matched && matched.totalStock <= 0 && (
                                                                <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                                                                    Out of stock
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {[rx.dosage, rx.frequency, rx.duration]
                                                                .filter(Boolean)
                                                                .join(" · ")}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1">
                                                            <Stethoscope className="w-3 h-3" />
                                                            {namePrefix}{prescriber}
                                                            {rx.createdAt && (
                                                                <>
                                                                    <span aria-hidden className="opacity-60">·</span>
                                                                    <span>{formatDate(rx.createdAt)}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        {rx.notes && (
                                                            <div className="text-[11px] text-muted-foreground/80 italic">
                                                                {rx.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant={inCart ? "secondary" : "outline"}
                                                        onClick={() => addPrescriptionToCart(rx)}
                                                        disabled={
                                                            !matched || matched.totalStock <= 0
                                                        }
                                                        className="shrink-0"
                                                    >
                                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                                        {inCart ? "Add another" : "Add"}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </Panel>
                        )}

                        <Panel title="Step 2: Add Medicines" subtitle="Search and add drugs to the dispense list">
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search medicine by name, brand, or generic…"
                                        className="pl-10 pr-10"
                                        value={medicineSearch}
                                        onChange={(e) => setMedicineSearch(e.target.value)}
                                    />
                                    {medicineSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setMedicineSearch("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                            aria-label="Clear medicine search"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                {filteredMedicines.length === 0 ? (
                                    <div className="p-6 rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground text-center">
                                        {medicineSearch
                                            ? `No medicines match "${medicineSearch}"`
                                            : "No medicines available"}
                                    </div>
                                ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredMedicines.map((med: any) => {
                                    // Pick the earliest non-zero batch to surface its batch number
                                    // and expiry on the card. Drives the amber/red expiry chip below.
                                    const stocks: Array<{ batchNumber?: string; expiryDate?: string; quantity?: number }> = Array.isArray(med.stocks) ? med.stocks : [];
                                    const earliest = stocks
                                        .filter((s) => (s.quantity ?? 0) > 0)
                                        .sort((a, b) => {
                                            const ae = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
                                            const be = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
                                            return ae - be;
                                        })[0];
                                    const tone = expiryTone(earliest?.expiryDate);
                                    return (
                                    <div key={med.id} className="p-4 rounded-xl border bg-card hover:border-primary/50 transition-all flex justify-between items-center group">
                                        <div className="min-w-0">
                                            <div className="font-bold">{med.name}</div>
                                            <div className="text-xs text-muted-foreground">{med.brand} • ₹{med.price}</div>
                                            <div className={cn(
                                                "text-[10px] font-bold mt-1",
                                                med.totalStock <= 0 ? "text-risk" : "text-wellness"
                                            )}>
                                                Stock: {med.totalStock}
                                            </div>
                                            {earliest?.batchNumber && (
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    Batch: <span className="font-mono">{earliest.batchNumber}</span>
                                                </div>
                                            )}
                                            {earliest?.expiryDate && (
                                                <div className={cn(
                                                    "inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mt-1 border",
                                                    tone === "expired" ? "bg-red-100 text-red-700 border-red-200"
                                                        : tone === "expiring" ? "bg-amber-100 text-amber-700 border-amber-200"
                                                        : "bg-muted text-muted-foreground border-border",
                                                )}>
                                                    {tone === "expired" && <AlertTriangle className="w-3 h-3" />}
                                                    {tone === "expired" ? "Expired" : "Exp"} {formatDate(earliest.expiryDate)}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => addToCart(med)}
                                            disabled={med.totalStock <= 0}
                                            variant="outline"
                                            className="group-hover:bg-primary group-hover:text-primary-foreground flex-shrink-0"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    );
                                })}
                            </div>
                                )}
                            </div>
                        </Panel>
                    </div>

                    {/* Right: Cart & Action */}
                    <div className="space-y-6">
                        <Panel title="Dispense List" className="sticky top-24">
                            <div className="space-y-4 min-h-[300px] flex flex-col">
                                <div className="flex-grow">
                                    {cart.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground italic space-y-2">
                                            <ShoppingCart className="w-8 h-8 mx-auto opacity-20" />
                                            <p>Your dispense list is empty</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {cart.map((item) => {
                                                const tone = expiryTone(item.expiryDate);
                                                return (
                                                <div key={item.medicineId} className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold">{item.name}</div>
                                                        <div className="text-xs text-muted-foreground">{item.quantity} x ₹{item.price}</div>
                                                        {(item.batchNumber || item.expiryDate) && (
                                                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                                                                {item.batchNumber && (
                                                                    <span>Batch <span className="font-mono">{item.batchNumber}</span></span>
                                                                )}
                                                                {item.expiryDate && (
                                                                    <span className={cn(
                                                                        "inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border",
                                                                        tone === "expired" ? "bg-red-100 text-red-700 border-red-200"
                                                                            : tone === "expiring" ? "bg-amber-100 text-amber-700 border-amber-200"
                                                                            : "bg-muted text-muted-foreground border-border",
                                                                    )}>
                                                                        {tone === "expired" && <AlertTriangle className="w-3 h-3" />}
                                                                        {tone === "expired" ? "Expired" : "Exp"} {formatDate(item.expiryDate)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm">₹{item.price * item.quantity}</span>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-risk" onClick={() => removeFromCart(item.medicineId)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t space-y-4">
                                    <div className="flex justify-between items-center text-lg font-bold">
                                        <span>Total Amount</span>
                                        <span className="text-accent">₹{totalAmount}</span>
                                    </div>

                                    {success && (
                                        <div className="p-3 rounded-lg bg-wellness/10 text-wellness text-xs font-bold flex items-center gap-2 animate-fade-in">
                                            <CheckCircle2 className="w-4 h-4" />
                                            Dispensed successfully!
                                        </div>
                                    )}

                                    <Button
                                        className="w-full h-12 text-lg font-bold rounded-xl shadow-lg"
                                        disabled={!selectedPatientId || cart.length === 0 || submitting}
                                        onClick={handleDispense}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            "Confirm Dispense"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </Panel>
                    </div>
                </div>
                    </TabsContent>

                    <TabsContent value="history">
                        <DispenseHistorySection />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}

// Inline dispense history table — keeps the create form and the historical
// audit trail on the same page so pharmacists never have to switch routes
// just to confirm a recent dispense. Powered by GET /api/pharmacy/dispenses.
const HISTORY_PAGE_SIZE = 20;
function DispenseHistorySection() {
    const [searchInput, setSearchInput] = useState("");
    const debouncedSearch = useDebounce(searchInput, 300);
    const [date, setDate] = useState("");
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Reset to page 1 whenever the filters change so the user doesn't
        // get stranded on a stale page index of the previous result set.
        setPage(1);
    }, [debouncedSearch, date]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const params: Record<string, string> = {
            page: String(page),
            limit: String(HISTORY_PAGE_SIZE),
        };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
        if (date) params.date = date;
        apiClient.get<any>("/api/pharmacy/dispenses", params)
            .then(({ data }) => {
                if (cancelled) return;
                const items = Array.isArray(data) ? data
                    : Array.isArray(data?.data) ? data.data
                    : Array.isArray(data?.dispenses) ? data.dispenses
                    : Array.isArray(data?.data?.dispenses) ? data.data.dispenses
                    : [];
                const totalCount = Number(
                    data?.pagination?.total
                    ?? data?.total
                    ?? data?.data?.pagination?.total
                    ?? items.length,
                );
                setRows(items);
                setTotal(Number.isFinite(totalCount) ? totalCount : items.length);
            })
            .catch(() => { if (!cancelled) { setRows([]); setTotal(0); } })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [debouncedSearch, date, page]);

    const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
    const rangeStart = total === 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE + 1;
    const rangeEnd = Math.min(page * HISTORY_PAGE_SIZE, total);

    return (
        <Panel title="Dispense History" subtitle="Past dispensing records — searchable by patient, filterable by date">
            <div className="flex flex-wrap gap-3 items-center mb-4">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search patient name or ID…"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none transition text-sm"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Date</span>
                    <input
                        type="date"
                        className="px-3 py-2 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary outline-none transition"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                    />
                </div>
                {(searchInput || date) && (
                    <Button variant="ghost" size="sm" onClick={() => { setSearchInput(""); setDate(""); }}>
                        <X className="w-3.5 h-3.5 mr-1" /> Clear
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No dispense records found.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b">
                            <tr>
                                <th className="pb-3 pt-2 font-semibold">Patient</th>
                                <th className="pb-3 pt-2 font-semibold">Items</th>
                                <th className="pb-3 pt-2 font-semibold text-center">Total</th>
                                <th className="pb-3 pt-2 font-semibold">Dispensed By</th>
                                <th className="pb-3 pt-2 font-semibold">Date &amp; Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {rows.map((d) => (
                                <tr key={d.id} className="hover:bg-secondary/40 transition">
                                    <td className="py-3">
                                        <div className="font-medium">{d.patient?.fullName || "—"}</div>
                                        <div className="text-[11px] text-muted-foreground">{d.patient?.patientId || d.patientId?.slice(0, 8)}</div>
                                    </td>
                                    <td className="py-3 max-w-[260px]">
                                        <div className="flex flex-wrap gap-1">
                                            {(d.items || []).slice(0, 3).map((it: any, idx: number) => (
                                                <span key={idx} className="px-2 py-0.5 rounded-md bg-secondary text-[11px]">
                                                    {it.medicine?.name || it.medicineName} ×{it.quantity}
                                                </span>
                                            ))}
                                            {(d.items || []).length > 3 && (
                                                <span className="text-[11px] text-muted-foreground italic">+{d.items.length - 3} more</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 text-center font-semibold text-accent">₹{d.totalAmount ?? "—"}</td>
                                    <td className="py-3 text-xs text-muted-foreground">{d.dispenser?.email?.split("@")[0] || "—"}</td>
                                    <td className="py-3 text-xs">{d.createdAt ? formatDate(d.createdAt) : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && total > 0 && (
                <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground">
                        Showing {rangeStart}–{rangeEnd} of {total}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-xs tabular-nums px-2">Page {page} of {totalPages}</span>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            )}
        </Panel>
    );
}
