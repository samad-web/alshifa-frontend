
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import {
    Package,
    PlusCircle,
    History,
    AlertTriangle,
    TrendingUp,
    Search,
    ShoppingCart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useBranchScope } from "@/hooks/useBranchScope";
import { AlertsPopup, AlertRow } from "@/components/common/AlertsPopup";

export default function PharmacyDashboard() {
    const { branchIdParam } = useBranchScope();
    const [stats, setStats] = useState({
        totalMedicines: 0,
        lowStock: 0,
        dispensedToday: 0,
        revenueToday: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            try {
                // Fetch medicines to calculate total and low stock — backend scopes stocks by branch
                const { data: medicines } = await apiClient.get<any[]>(
                    '/api/pharmacy/medicines',
                    branchIdParam ? { branchId: branchIdParam } : undefined
                );
                if (Array.isArray(medicines)) {
                    const lowStock = medicines.filter((m: any) => (m.totalStock ?? 0) <= 10).length;
                    setStats(prev => ({
                        ...prev,
                        totalMedicines: medicines.length,
                        lowStock
                    }));
                }

                // Fetch dispenses for today — same branch param applies
                const { data: dispensesRaw } = await apiClient.get<any>(
                    '/api/pharmacy/dispenses',
                    branchIdParam ? { branchId: branchIdParam } : undefined
                );
                const dispenses = Array.isArray(dispensesRaw)
                    ? dispensesRaw
                    : Array.isArray(dispensesRaw?.data) ? dispensesRaw.data : [];
                if (dispenses.length >= 0) {
                    const today = new Date().toISOString().split('T')[0];
                    const todayDispenses = dispenses.filter((d: any) => d.createdAt?.startsWith(today));
                    setStats(prev => ({
                        ...prev,
                        dispensedToday: todayDispenses.length,
                        revenueToday: todayDispenses.reduce((sum: number, d: any) => sum + (d.totalAmount || 0), 0)
                    }));
                }
            } catch (error) {
                console.error("Failed to fetch pharmacy stats:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, [branchIdParam]);

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8">
                <header className="flex items-start justify-between flex-wrap gap-3">
                    <PageHeader
                        title="Pharmacy Dashboard"
                        subtitle="Manage inventory, dispensing, and sales"
                    />
                    <AlertsPopup
                        title="Critical Stock Alerts"
                        alertLabel="Stock Alerts"
                        emptyLabel="Stock Alerts"
                        count={stats.lowStock > 0 ? 1 : 0}
                        emptyState={
                            <div className="p-8 text-center text-sm text-muted-foreground">
                                All medicines are above the minimum threshold.
                            </div>
                        }
                    >
                        <AlertRow
                            icon={<AlertTriangle className="w-4 h-4 text-risk" />}
                            title={`${stats.lowStock} item${stats.lowStock === 1 ? "" : "s"} below minimum threshold`}
                            detail="Restock to avoid dispense failures."
                            action={
                                <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                                    <Link to="/pharmacy/inventory">View Inventory</Link>
                                </Button>
                            }
                            visible={stats.lowStock > 0}
                        />
                    </AlertsPopup>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Panel title="Total Medicines" subtitle="All registered drugs">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-primary/10">
                                <Package className="w-6 h-6 text-primary" />
                            </div>
                            <div className="text-3xl font-bold text-foreground">{stats.totalMedicines}</div>
                        </div>
                    </Panel>

                    <Panel title="Low Stock" subtitle="Items needing restock">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-risk/10">
                                <AlertTriangle className="w-6 h-6 text-risk" />
                            </div>
                            <div className="text-3xl font-bold text-foreground">{stats.lowStock}</div>
                        </div>
                    </Panel>

                    <Panel title="Dispensed Today" subtitle="Completed orders">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-wellness/10">
                                <ShoppingCart className="w-6 h-6 text-wellness" />
                            </div>
                            <div className="text-3xl font-bold text-foreground">{stats.dispensedToday}</div>
                        </div>
                    </Panel>

                    <Panel title="Revenue Today" subtitle="Total pharmacy sales">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-accent/10">
                                <TrendingUp className="w-6 h-6 text-accent" />
                            </div>
                            <div className="text-3xl font-bold text-foreground">₹{stats.revenueToday}</div>
                        </div>
                    </Panel>
                </div>

                {/* Quick Actions */}
                <Panel title="Pharmacy Operations" subtitle="Quick access to pharmacy modules">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Link
                            to="/pharmacy/inventory"
                            className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg shadow hover:shadow-lg transition font-semibold"
                        >
                            <Package className="w-5 h-5" />
                            Inventory Management
                        </Link>
                        <Link
                            to="/pharmacy/dispense"
                            className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-wellness to-wellness/80 text-wellness-foreground rounded-lg shadow hover:shadow-lg transition font-semibold"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            Dispense Medicines
                        </Link>
                        <Link
                            to="/pharmacy/history"
                            className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-secondary to-secondary/80 text-foreground rounded-lg shadow hover:shadow-lg transition font-semibold border"
                        >
                            <History className="w-5 h-5" />
                            Dispensing History
                        </Link>
                        <Link
                            to="/pharmacy/orders"
                            className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg shadow hover:shadow-lg transition font-semibold"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            Manage Medicine Orders
                        </Link>
                    </div>
                </Panel>

                {/* Critical Stock Alerts moved to popup in header. */}
            </div>
        </AppLayout>
    );
}
