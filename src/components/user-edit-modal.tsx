import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    type: "doctor" | "therapist" | "patient" | "pharmacist" | null;
    onSuccess: () => void;
}

export function UserEditModal({ isOpen, onClose, user, type, onSuccess }: UserEditModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [currentBranchName, setCurrentBranchName] = useState<string>("");

    useEffect(() => {
        if (user) {
            setFormData({ ...user });
        }
    }, [user]);

    useEffect(() => {
        if (isOpen) {
            apiClient.get<{ id: string; name: string }[]>('/api/branches')
                .then(({ data }) => {
                    setBranches(Array.isArray(data) ? data : []);
                    // Resolve current branch name
                    if (user?.user?.branchId) {
                        const branch = (Array.isArray(data) ? data : []).find((b: any) => b.id === user.user.branchId);
                        setCurrentBranchName(branch?.name || "Unknown");
                    }
                })
                .catch(() => setBranches([]));
        }
    }, [isOpen, user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({
            ...prev,
            [name]: name === "yearsExperience" || name === "age" ? Number(value) : value,
        }));
    };

    const handleBranchChange = (branchId: string) => {
        setFormData((prev: any) => ({ ...prev, branchId }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!type || !user?.id) return;

        setLoading(true);
        try {
            await apiClient.put(`/api/user/${type}/${user.id}`, formData);
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully`);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error?.message || "An error occurred while updating");
            console.error("Update error:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!user || !type) return null;

    const userBranchId = user?.user?.branchId || formData.branchId;
    const selectedBranchId = formData.branchId || userBranchId;
    const isBranchChanged = formData.branchId && formData.branchId !== userBranchId;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit {type.charAt(0).toUpperCase() + type.slice(1)}</DialogTitle>
                    <DialogDescription>
                        Update the details for {user.fullName || "this user"}.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input
                                id="fullName"
                                name="fullName"
                                value={formData.fullName || ""}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email || ""}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        {/* Branch Assignment — available for all staff types */}
                        <div className="space-y-2 md:col-span-2">
                            <Label className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Branch / Hospital
                            </Label>
                            {currentBranchName && !isBranchChanged && (
                                <p className="text-xs text-muted-foreground mb-1">
                                    Currently at: <span className="font-medium">{currentBranchName}</span>
                                </p>
                            )}
                            <Select
                                value={selectedBranchId || ""}
                                onValueChange={handleBranchChange}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select branch..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map((b) => (
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {isBranchChanged && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                                    Branch will be changed on save
                                </Badge>
                            )}
                        </div>

                        {type === "patient" ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="phoneNumber">Phone Number</Label>
                                    <Input
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        value={formData.phoneNumber || ""}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="age">Age</Label>
                                    <Input
                                        id="age"
                                        name="age"
                                        type="number"
                                        value={formData.age || ""}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gender">Gender</Label>
                                    <Input
                                        id="gender"
                                        name="gender"
                                        value={formData.gender || ""}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="patientId">Patient ID</Label>
                                    <Input
                                        id="patientId"
                                        name="patientId"
                                        value={formData.patientId || ""}
                                        onChange={handleChange}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="specialization">Specialization</Label>
                                    <Input
                                        id="specialization"
                                        name="specialization"
                                        value={formData.specialization || ""}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="qualification">Qualification</Label>
                                    <Input
                                        id="qualification"
                                        name="qualification"
                                        value={formData.qualification || ""}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="yearsExperience">Experience (Years)</Label>
                                    <Input
                                        id="yearsExperience"
                                        name="yearsExperience"
                                        type="number"
                                        value={formData.yearsExperience || ""}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="clinic">Clinic / Hospital</Label>
                                    <Input
                                        id="clinic"
                                        name="clinic"
                                        value={formData.clinic || ""}
                                        onChange={handleChange}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="gap-2">
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
