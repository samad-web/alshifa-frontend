import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Plus, Search, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MedicineModal } from "@/components/pharmacy/MedicineModal";
import { apiClient } from "@/lib/api-client";

export default function MedicineInventory() {
    const [medicines, setMedicines] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMedicine, setSelectedMedicine] = useState<any>(null);

    const fetchMedicines = async () => {
        try {
            const { data } = await apiClient.get<any[]>('/api/pharmacy/medicines');
            if (Array.isArray(data)) {
                setMedicines(data);
            } else {
                console.error("Medicines data is not an array:", data);
                setMedicines([]);
            }
        } catch (error) {
            toast.error("Failed to fetch medicines");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedicines();
    }, []);

    const handleAdd = () => {
        setSelectedMedicine(null);
        setIsModalOpen(true);
    };

    const handleEdit = (med: any) => {
        setSelectedMedicine(med);
        setIsModalOpen(true);
    };

    const filteredMedicines = medicines.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8">
                <PageHeader
                    title="Medicine Inventory"
                    subtitle="Manage stock levels and drug details"
                />

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by name, brand, or SKU..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none transition"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button className="gap-2 w-full md:w-auto" onClick={handleAdd}>
                        <Plus className="h-4 w-4" />
                        Add Medicine
                    </Button>
                </div>

                <Panel title="Medicine List" subtitle="Comprehensive list of all drugs in stock">
                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {loading ? (
                            <div className="py-12 text-center text-muted-foreground">Loading inventory...</div>
                        ) : filteredMedicines.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">No medicines found</div>
                        ) : (
                            filteredMedicines.map((med) => (
                                <div key={med.id} className="p-4 rounded-xl border border-border/50 bg-card space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-bold text-foreground">{med.name}</h4>
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
                                            <p className={cn(
                                                "text-sm font-bold",
                                                (med.totalStock || 0) <= 10 ? "text-risk" : "text-foreground"
                                            )}>{med.totalStock || 0}</p>
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
                                        <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => handleEdit(med)}>
                                            <Edit2 className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b">
                                    <th className="pb-4 pt-2 font-semibold">Medicine Name</th>
                                    <th className="pb-4 pt-2 font-semibold text-center">SKU</th>
                                    <th className="pb-4 pt-2 font-semibold">Category / Type</th>
                                    <th className="pb-4 pt-2 font-semibold text-center">Current Stock</th>
                                    <th className="pb-4 pt-2 font-semibold">Price</th>
                                    <th className="pb-4 pt-2 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-muted-foreground">Loading inventory...</td>
                                    </tr>
                                ) : filteredMedicines.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-muted-foreground">No medicines found</td>
                                    </tr>
                                ) : (
                                    filteredMedicines.map((med) => (
                                        <tr key={med.id} className="group hover:bg-secondary/50 transition">
                                            <td className="py-4">
                                                <div className="font-medium">{med.name}</div>
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
                                                <span className={cn(
                                                    "font-bold",
                                                    (med.totalStock || 0) <= 10 ? "text-risk" : "text-foreground"
                                                )}>
                                                    {med.totalStock || 0}
                                                </span>
                                            </td>
                                            <td className="py-4 text-accent font-medium">₹{med.price}</td>
                                            <td className="py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="Add Stock">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" title="Edit Medicine" onClick={() => handleEdit(med)}>
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Panel>
            </div>

            <MedicineModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchMedicines}
                medicine={selectedMedicine}
            />
        </AppLayout>
    );
}
