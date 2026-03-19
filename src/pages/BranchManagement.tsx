import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { MapPin, Phone, Mail, Plus, Trash2, Edit2, Building2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DeleteBranchModal } from "@/components/delete-branch-modal";
import { apiClient } from "@/lib/api-client";

export default function BranchManagement() {
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);
    const [formData, setFormData] = useState({ name: "", address: "", phone: "", email: "" });

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [branchToDelete, setBranchToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const { toast } = useToast();

    const fetchBranches = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiClient.get<any[]>('/api/branches');
            if (!Array.isArray(data)) throw new Error("Invalid data format");
            setBranches(data);
        } catch (error: any) {
            setError(error.message);
            toast({ title: "Fetch failed", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchBranches();
    }, [fetchBranches]);

    const handleOpenDialog = (branch = null) => {
        if (branch) {
            setEditingBranch(branch);
            setFormData({
                name: branch.name,
                address: branch.address || "",
                phone: branch.phone || "",
                email: branch.email || ""
            });
        } else {
            setEditingBranch(null);
            setFormData({ name: "", address: "", phone: "", email: "" });
        }
        setIsDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingBranch(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Strip empty strings so optional-field validators never see blank values
            const payload: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(formData)) {
                if (value !== "") payload[key] = value;
            }

            if (editingBranch) {
                await apiClient.put(`/api/branches/${editingBranch.id}`, payload);
            } else {
                await apiClient.post('/api/branches', payload);
            }
            handleCloseDialog();
            setShowSuccess(true);
            fetchBranches();
        } catch (error: any) {
            // Surface Zod field-level detail messages when available, otherwise the top-level error
            const message = error?.details?.map((d: any) => `${d.path}: ${d.message}`).join('; ')
                ?? error?.message
                ?? 'Operation failed';
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    };

    const handleDelete = (branch) => {
        setBranchToDelete(branch);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!branchToDelete) return;

        setDeleting(true);
        try {
            await apiClient.delete(`/api/branches/${branchToDelete.id}`);
            toast({ title: "Deleted", description: "Branch removed" });
            setIsDeleteModalOpen(false);
            fetchBranches();
        } catch (error: any) {
            toast({ title: "Error", description: error?.message || "Delete failed", variant: "destructive" });
        } finally {
            setDeleting(false);
            setBranchToDelete(null);
        }
    };

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
                <PageHeader
                    title="Branch Management"
                    subtitle="Manage clinical locations and staff assignments"
                >
                    <Button onClick={() => handleOpenDialog()} className="shadow-lg hover:shadow-xl transition-all">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Branch
                    </Button>
                </PageHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                        <p className="text-muted-foreground font-medium italic">Synchronizing clinic data...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                        <div className="p-4 rounded-full bg-attention/10 mb-4">
                            <AlertCircle className="w-10 h-10 text-attention" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Sync Interrupted</h3>
                        <p className="text-muted-foreground max-w-md mb-6">{error}</p>
                        <Button variant="outline" onClick={() => fetchBranches()}>Try Again</Button>
                    </div>
                ) : branches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500 border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                        <div className="p-4 rounded-full bg-background shadow-sm mb-4">
                            <Building2 className="w-12 h-12 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">No Branches Found</h3>
                        <p className="text-muted-foreground max-w-sm mb-6">Start by adding your first clinical location to manage staff and patients across branches.</p>
                        <Button onClick={() => handleOpenDialog()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Provision First Branch
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4 fade-in duration-700">
                        {branches.map((branch) => (
                            <Panel key={branch.id} title={branch.name} className="relative group hover:shadow-elevated transition-all duration-300 border-border/60">
                                <div className="space-y-4">
                                    <div className="space-y-2.5">
                                        <div className="flex items-start gap-3 text-sm text-muted-foreground">
                                            <MapPin className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" />
                                            <span className="line-clamp-2 leading-relaxed">{branch.address || "No address registration"}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <Phone className="w-4 h-4 text-primary/70 shrink-0" />
                                            {branch.phone || "No phone listed"}
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <Mail className="w-4 h-4 text-primary/70 shrink-0" />
                                            <span className="truncate">{branch.email || "No clinical email"}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 py-4 border-y border-border/40 bg-secondary/5 -mx-5 px-5">
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-foreground">{branch._count?.patients || 0}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Patients</div>
                                        </div>
                                        <div className="text-center border-x border-border/40">
                                            <div className="text-xl font-bold text-foreground">{branch._count?.users || 0}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Staff</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-foreground">{branch._count?.appointments || 0}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Bookings</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                                        <Button variant="secondary" size="sm" className="h-9 px-4 rounded-lg font-medium" onClick={() => handleOpenDialog(branch)}>
                                            <Edit2 className="w-3.5 h-3.5 mr-2" />
                                            Edit
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-9 px-4 rounded-lg font-medium text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(branch)}>
                                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            </Panel>
                        ))}
                    </div>
                )}

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>{editingBranch ? "Edit Clinical Location" : "Provision New Branch"}</DialogTitle>
                            <DialogDescription>
                                {editingBranch ? "Update the details for this clinical branch." : "Enter the details to register a new clinical location."}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-6 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Branch Identity</Label>
                                <Input
                                    id="name"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Al-Shifa Downtown"
                                    className="h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Physical Address</Label>
                                <Input
                                    id="address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Full clinic address"
                                    className="h-11"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="Clinic phone"
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="Branch email"
                                        className="h-11"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={handleCloseDialog}>
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    {editingBranch ? "Save Changes" : "Create Branch"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Success Dialog */}
                <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-wellness">
                                <CheckCircle2 className="w-6 h-6" />
                                Success
                            </DialogTitle>
                            <DialogDescription className="text-foreground/90 pt-2">
                                The clinical branch created successfully.
                            </DialogDescription>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>

                <DeleteBranchModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => {
                        setIsDeleteModalOpen(false);
                        setBranchToDelete(null);
                    }}
                    onConfirm={confirmDelete}
                    branchName={branchToDelete?.name || ""}
                    loading={deleting}
                />
            </div>
        </AppLayout>
    );
}
