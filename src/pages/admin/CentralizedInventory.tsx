import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { operationsApi } from "@/services/operations.service";
import type { CentralizedInventoryItem, StockTransferEntry, TransferStatus } from "@/types";
import {
  Loader2, Package, ArrowRightLeft, AlertTriangle, CheckCircle, PackageCheck,
  Pill, Warehouse,
} from "lucide-react";
import { useBranchScope } from "@/hooks/useBranchScope";
import { toast } from "sonner";
import { formatDate } from "@/lib/format-date";

const transferStatusBadge: Record<TransferStatus, { className: string; label: string }> = {
  PENDING: { className: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Pending" },
  APPROVED: { className: "bg-blue-100 text-blue-800 border-blue-300", label: "Approved" },
  IN_TRANSIT: { className: "bg-purple-100 text-purple-800 border-purple-300", label: "In Transit" },
  RECEIVED: { className: "bg-green-100 text-green-800 border-green-300", label: "Received" },
  REJECTED: { className: "bg-red-100 text-red-800 border-red-300", label: "Rejected" },
};

const LOW_STOCK_THRESHOLD = 10;

export default function CentralizedInventory() {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN" || role === "ADMIN_DOCTOR";
  const { branchIdParam } = useBranchScope();

  const [inventory, setInventory] = useState<CentralizedInventoryItem[]>([]);
  const [transfers, setTransfers] = useState<StockTransferEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Transfer form
  const [tfMedicine, setTfMedicine] = useState("");
  const [tfFrom, setTfFrom] = useState("");
  const [tfTo, setTfTo] = useState("");
  const [tfQty, setTfQty] = useState("");
  const [tfNotes, setTfNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setError(null);
      const [inv, txs] = await Promise.all([
        operationsApi.getCentralizedInventory(),
        operationsApi.getTransfers(),
      ]);
      setInventory(inv);
      setTransfers(txs);
    } catch {
      setError("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Apply branch scope: when a specific branch is picked, narrow each medicine's
  // branch breakdown to just that branch and recompute totalStock. When "all",
  // leave the full cross-branch view intact.
  const scopedInventory: CentralizedInventoryItem[] = branchIdParam
    ? inventory
        .map(item => {
          const branches = item.branches.filter(b => b.branchId === branchIdParam);
          const totalStock = branches.reduce((sum, b) => sum + (b.totalQty || 0), 0);
          return { ...item, branches, totalStock } as CentralizedInventoryItem;
        })
        // Drop medicines that have no presence in the selected branch
        .filter(item => item.branches.length > 0)
    : inventory;

  // Get all unique branches from the scoped inventory (drives the table columns)
  const allBranches = Array.from(
    new Map(
      scopedInventory.flatMap(item => item.branches.map(b => [b.branchId, b.branchName]))
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredInventory = search
    ? scopedInventory.filter(item =>
        (item.medicine as any).name?.toLowerCase().includes(search.toLowerCase()) ||
        (item.medicine as any).genericName?.toLowerCase().includes(search.toLowerCase())
      )
    : scopedInventory;

  const lowStockCount = scopedInventory.reduce(
    (acc, item) => acc + item.branches.filter(b => b.totalQty < LOW_STOCK_THRESHOLD && b.totalQty > 0).length,
    0
  );
  const expiringCount = scopedInventory.reduce(
    (acc, item) => acc + item.branches.filter(b => b.expiringCount > 0).length,
    0
  );

  // Transfers are branch-scoped when either end (from/to) is the selected branch
  const scopedTransfers = branchIdParam
    ? transfers.filter(tx => tx.fromBranch?.id === branchIdParam || tx.toBranch?.id === branchIdParam)
    : transfers;

  // Inline validation flag mirrored in the form so the submit button
  // and the destination dropdown both react to it.
  const sameBranchSelected = !!tfFrom && tfFrom === tfTo;

  const handleCreateTransfer = async () => {
    if (!tfMedicine || !tfFrom || !tfTo || !tfQty) return;
    if (sameBranchSelected) {
      toast.error("Source and destination branch cannot be the same");
      return;
    }
    setSubmitting(true);
    try {
      await operationsApi.createTransferRequest({
        medicineId: tfMedicine,
        fromBranchId: tfFrom,
        toBranchId: tfTo,
        quantity: parseInt(tfQty, 10),
        notes: tfNotes || undefined,
      });
      setDialogOpen(false);
      setTfMedicine("");
      setTfFrom("");
      setTfTo("");
      setTfQty("");
      setTfNotes("");
      await fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create transfer request";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await operationsApi.approveTransfer(id);
      await fetchData();
    } catch {
      toast.error("Failed to approve transfer");
    }
  };

  const handleReceive = async (id: string) => {
    try {
      await operationsApi.receiveTransfer(id);
      await fetchData();
    } catch {
      toast.error("Failed to mark as received");
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Loading Inventory...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
        <PageHeader
          title="Centralized Inventory"
          subtitle="Cross-branch medicine stock overview and transfer management."
        >
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Transfer Stock
          </Button>
        </PageHeader>

        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard title="Total Medicines" value={scopedInventory.length} icon={Pill} />
          <StatCard title="Branches" value={allBranches.length} icon={Warehouse} />
          <StatCard title="Low Stock Alerts" value={lowStockCount} icon={AlertTriangle} variant="attention" />
          <StatCard title="Expiring Items" value={expiringCount} icon={Package} variant="risk" />
        </div>

        {/* Recent Transfers — surfaced ABOVE the full stock grid so admins
            and pharmacists see the latest transfer activity without
            scrolling. Capped to the last 10 by createdAt; the full
            transfer table follows the inventory grid below. */}
        <Card className="border-none shadow-sm overflow-hidden border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              Recent Transfers
              <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                Last {Math.min(scopedTransfers.length, 10)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scopedTransfers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">
                No transfer activity yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Medicine</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...scopedTransfers]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .slice(0, 10)
                      .map((tx) => {
                        const cfg = transferStatusBadge[tx.status];
                        return (
                          <TableRow key={`recent-${tx.id}`}>
                            <TableCell>
                              <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{tx.fromBranch?.name || "--"}</TableCell>
                            <TableCell className="text-xs">{tx.toBranch?.name || "--"}</TableCell>
                            <TableCell className="font-medium text-sm">
                              {(tx.medicine as any)?.name || tx.medicineId.slice(0, 8)}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{tx.quantity}</TableCell>
                            <TableCell className="text-xs">{formatDate(tx.createdAt)}</TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search medicines..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Inventory Table */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Medicine Stock by Branch
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredInventory.length === 0 ? (
              <div className="text-center py-12">
                <Pill className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No inventory data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Medicine</TableHead>
                      <TableHead className="text-right">Total Stock</TableHead>
                      {allBranches.map(b => (
                        <TableHead key={b.id} className="text-center min-w-[120px]">{b.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map(item => {
                      const med = item.medicine as any;
                      return (
                        <TableRow key={med.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{med.name}</p>
                              {med.genericName && (
                                <p className="text-[10px] text-muted-foreground">{med.genericName}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{item.totalStock}</TableCell>
                          {allBranches.map(branch => {
                            const branchData = item.branches.find(b => b.branchId === branch.id);
                            const qty = branchData?.totalQty ?? 0;
                            const hasExpiring = (branchData?.expiringCount ?? 0) > 0;
                            const isLow = qty > 0 && qty < LOW_STOCK_THRESHOLD;
                            return (
                              <TableCell key={branch.id} className="text-center">
                                <span
                                  className={`inline-flex items-center gap-1 text-sm font-medium ${
                                    qty === 0 ? "text-red-500" : isLow ? "text-red-600 font-bold" : ""
                                  }`}
                                >
                                  {qty}
                                  {isLow && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                  {hasExpiring && (
                                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" title="Has expiring stock" />
                                  )}
                                </span>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transfer Requests */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
              Transfer Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scopedTransfers.length === 0 ? (
              <div className="text-center py-12">
                <ArrowRightLeft className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No transfer requests yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Notes</TableHead>
                      {isAdmin && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scopedTransfers.map(tx => {
                      const cfg = transferStatusBadge[tx.status];
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="font-medium">
                            {(tx.medicine as any)?.name || tx.medicineId.slice(0, 8)}
                          </TableCell>
                          <TableCell>{tx.fromBranch?.name || "--"}</TableCell>
                          <TableCell>{tx.toBranch?.name || "--"}</TableCell>
                          <TableCell className="text-right font-semibold">{tx.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(tx.createdAt)}</TableCell>
                          <TableCell className="max-w-[120px] truncate text-xs">{tx.notes || "--"}</TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {tx.status === "PENDING" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleApprove(tx.id)}
                                    title="Approve"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </Button>
                                )}
                                {(tx.status === "APPROVED" || tx.status === "IN_TRANSIT") && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => handleReceive(tx.id)}
                                    title="Mark Received"
                                  >
                                    <PackageCheck className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transfer Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Transfer Stock</DialogTitle>
              <DialogDescription>
                Move medicine stock from one branch to another.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Medicine</label>
                <Select value={tfMedicine} onValueChange={setTfMedicine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select medicine" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventory.map(item => {
                      const med = item.medicine as any;
                      return (
                        <SelectItem key={med.id} value={med.id}>
                          {med.name} (Total: {item.totalStock})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">From Branch</label>
                  <Select
                    value={tfFrom}
                    onValueChange={(v) => {
                      setTfFrom(v);
                      // Clear destination when it would create a same-branch
                      // transfer — so the user re-picks rather than submitting
                      // an obviously invalid pair.
                      if (v === tfTo) setTfTo("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {allBranches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">To Branch</label>
                  <Select value={tfTo} onValueChange={setTfTo}>
                    <SelectTrigger>
                      <SelectValue placeholder={tfFrom ? "Select" : "Pick source first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Source branch is excluded so the dropdown
                          can't even offer a same-branch transfer. */}
                      {allBranches
                        .filter((b) => b.id !== tfFrom)
                        .map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {sameBranchSelected && (
                <p className="text-xs text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Source and destination branch cannot be the same.
                </p>
              )}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Quantity</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Enter quantity"
                  value={tfQty}
                  onChange={e => setTfQty(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes (optional)</label>
                <Input
                  placeholder="e.g. Urgent stock needed"
                  value={tfNotes}
                  onChange={e => setTfNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateTransfer} disabled={submitting || sameBranchSelected}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Transfer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
