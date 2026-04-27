import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/common/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2, ShoppingCart, Loader2, CheckCircle2, X, User, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { formatDate, expiryTone } from "@/lib/format-date";

export default function PharmacyDispense() {
    const [patients, setPatients] = useState([]);
    const [medicines, setMedicines] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [patientSearch, setPatientSearch] = useState("");
    const [branches, setBranches] = useState<any[]>([]);
    const [dispenseBranchFilter, setDispenseBranchFilter] = useState("all");
    const [cart, setCart] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [patientsLoading, setPatientsLoading] = useState(true);

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
                    subtitle="Record medicine sales and deduct inventory"
                />

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

                        <Panel title="Step 2: Add Medicines" subtitle="Search and add drugs to the dispense list">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {medicines.map((med: any) => {
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
            </div>
        </AppLayout>
    );
}
