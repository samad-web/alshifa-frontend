import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, Clock, CheckCircle, AlertCircle, XCircle, FileText, IndianRupee } from "lucide-react";
import { billingApi } from "@/services/billing.service";
import { toast } from "sonner";
import type { Invoice } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
    DRAFT: { label: "Draft", variant: "secondary", icon: FileText },
    SENT: { label: "Sent", variant: "outline", icon: Clock },
    PAID: { label: "Paid", variant: "default", icon: CheckCircle },
    OVERDUE: { label: "Overdue", variant: "destructive", icon: AlertCircle },
    CANCELLED: { label: "Cancelled", variant: "secondary", icon: XCircle },
};

export default function Billing() {
    const { role } = useAuth();
    const isClinic = role === "ADMIN" || role === "ADMIN_DOCTOR" || role === "DOCTOR";
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("all");

    useEffect(() => {
        loadInvoices();
    }, []);

    const loadInvoices = async () => {
        try {
            setLoading(true);
            if (role === "PATIENT") {
                const data = await billingApi.getPatientInvoices();
                setInvoices(data);
            } else {
                const result = await billingApi.getInvoices({ limit: 100 });
                setInvoices(result.data || []);
            }
        } catch (err: any) {
            toast.error(err?.message || "Failed to load invoices");
        } finally {
            setLoading(false);
        }
    };

    const filteredInvoices = invoices.filter(inv => {
        if (activeTab === "all") return true;
        if (activeTab === "paid") return inv.status === "PAID";
        if (activeTab === "pending") return ["DRAFT", "SENT"].includes(inv.status);
        if (activeTab === "overdue") return inv.status === "OVERDUE";
        return true;
    });

    const totalRevenue = invoices.filter(i => i.status === "PAID").reduce((sum, i) => sum + i.total, 0);
    const totalPending = invoices.filter(i => ["DRAFT", "SENT"].includes(i.status)).reduce((sum, i) => sum + i.total, 0);
    const totalOverdue = invoices.filter(i => i.status === "OVERDUE").reduce((sum, i) => sum + i.total, 0);

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-10 space-y-8">
                <PageHeader title="Billing & Invoices" subtitle="Manage invoices, payments, and financial records" />

                {/* Revenue Summary (admin/doctor only) */}
                {isClinic && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="border-none shadow-sm bg-wellness/5">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Revenue Collected</p>
                                        <p className="text-2xl font-black text-wellness mt-1">
                                            <IndianRupee className="w-5 h-5 inline -mt-0.5" />{totalRevenue.toLocaleString()}
                                        </p>
                                    </div>
                                    <CheckCircle className="w-8 h-8 text-wellness/30" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-attention/5">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pending</p>
                                        <p className="text-2xl font-black text-attention mt-1">
                                            <IndianRupee className="w-5 h-5 inline -mt-0.5" />{totalPending.toLocaleString()}
                                        </p>
                                    </div>
                                    <Clock className="w-8 h-8 text-attention/30" />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-risk/5">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Overdue</p>
                                        <p className="text-2xl font-black text-risk mt-1">
                                            <IndianRupee className="w-5 h-5 inline -mt-0.5" />{totalOverdue.toLocaleString()}
                                        </p>
                                    </div>
                                    <AlertCircle className="w-8 h-8 text-risk/30" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Invoice List */}
                <Card className="border-none shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <Tabs value={activeTab} onValueChange={setActiveTab}>
                                <TabsList className="bg-secondary/30">
                                    <TabsTrigger value="all" className="text-xs">All ({invoices.length})</TabsTrigger>
                                    <TabsTrigger value="paid" className="text-xs">Paid</TabsTrigger>
                                    <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
                                    <TabsTrigger value="overdue" className="text-xs">Overdue</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Receipt className="w-6 h-6 text-primary animate-pulse" />
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <Receipt className="w-10 h-10 text-muted-foreground/20 mb-3" />
                                <p className="text-sm text-muted-foreground">No invoices found</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {filteredInvoices.map((invoice) => {
                                    const config = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.DRAFT;
                                    const StatusIcon = config.icon;
                                    return (
                                        <div
                                            key={invoice.id}
                                            className="flex items-center justify-between py-3 px-2 hover:bg-secondary/10 rounded-lg transition-colors cursor-pointer group"
                                            onClick={() => { setSelectedInvoice(invoice); setDetailOpen(true); }}
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className="p-2 rounded-lg bg-primary/5 shrink-0">
                                                    <Receipt className="w-4 h-4 text-primary" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                                        {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8).toUpperCase()}`}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        {invoice.patient?.fullName && (
                                                            <span className="text-[10px] text-muted-foreground">{invoice.patient.fullName}</span>
                                                        )}
                                                        <span className="text-[10px] text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <Badge variant={config.variant} className="text-[9px] gap-1">
                                                    <StatusIcon className="w-3 h-3" />
                                                    {config.label}
                                                </Badge>
                                                <span className="text-sm font-black text-foreground min-w-[80px] text-right">
                                                    <IndianRupee className="w-3.5 h-3.5 inline -mt-0.5" />{invoice.total.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Invoice Detail Modal */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-primary" />
                            {selectedInvoice?.invoiceNumber || `INV-${selectedInvoice?.id?.slice(0, 8).toUpperCase()}`}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedInvoice && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Patient</p>
                                    <p className="font-bold text-sm">{selectedInvoice.patient?.fullName || "\u2014"}</p>
                                </div>
                                <Badge variant={STATUS_CONFIG[selectedInvoice.status]?.variant || "secondary"}>
                                    {STATUS_CONFIG[selectedInvoice.status]?.label || selectedInvoice.status}
                                </Badge>
                            </div>

                            {selectedInvoice.items?.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-secondary/20">
                                            <tr>
                                                <th className="text-left p-2 font-bold">Item</th>
                                                <th className="text-center p-2 font-bold">Qty</th>
                                                <th className="text-right p-2 font-bold">Price</th>
                                                <th className="text-right p-2 font-bold">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/50">
                                            {selectedInvoice.items.map((item, i) => (
                                                <tr key={i}>
                                                    <td className="p-2">{item.description}</td>
                                                    <td className="p-2 text-center">{item.quantity}</td>
                                                    <td className="p-2 text-right"><IndianRupee className="w-3 h-3 inline" />{item.unitPrice}</td>
                                                    <td className="p-2 text-right font-bold"><IndianRupee className="w-3 h-3 inline" />{item.total}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="space-y-1 text-xs border-t pt-3">
                                {selectedInvoice.discount > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Discount</span>
                                        <span>-<IndianRupee className="w-3 h-3 inline" />{selectedInvoice.discount}</span>
                                    </div>
                                )}
                                {selectedInvoice.tax > 0 && (
                                    <div className="flex justify-between text-muted-foreground">
                                        <span>Tax</span>
                                        <span><IndianRupee className="w-3 h-3 inline" />{selectedInvoice.tax}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-black text-sm pt-1 border-t">
                                    <span>Total</span>
                                    <span><IndianRupee className="w-4 h-4 inline -mt-0.5" />{selectedInvoice.total.toLocaleString()}</span>
                                </div>
                            </div>

                            {selectedInvoice.notes && (
                                <p className="text-xs text-muted-foreground italic bg-secondary/10 p-3 rounded-lg">{selectedInvoice.notes}</p>
                            )}

                            {selectedInvoice.dueDate && (
                                <p className="text-[10px] text-muted-foreground">
                                    Due: {new Date(selectedInvoice.dueDate).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
