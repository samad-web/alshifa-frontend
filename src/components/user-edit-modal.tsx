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
import { Loader2, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { sanitizeName, sanitizePhone, isValidEmail, isValidPhone, stripEdgeSpaces } from "@/lib/input-validators";

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    type: "doctor" | "therapist" | "patient" | "pharmacist" | null;
    onSuccess: () => void;
}

interface FormState {
    fullName: string;
    email: string;
    branchId: string;
    phoneNumber: string;
    age: string;
    gender: string;
    patientId: string;
    specialization: string;
    qualification: string;
    yearsExperience: string;
    clinic: string;
}

const EMPTY_FORM: FormState = {
    fullName: "", email: "", branchId: "", phoneNumber: "", age: "", gender: "",
    patientId: "", specialization: "", qualification: "", yearsExperience: "", clinic: "",
};

export function UserEditModal({ isOpen, onClose, user, type, onSuccess }: UserEditModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [currentBranchName, setCurrentBranchName] = useState<string>("");
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

    useEffect(() => {
        if (!user) return;
        const initialBranchId: string = user?.user?.branchId ?? user?.branchId ?? "";
        setFormData({
            fullName: user.fullName ?? "",
            email: user.user?.email ?? user.email ?? "",
            branchId: initialBranchId,
            phoneNumber: user.phoneNumber ?? "",
            age: user.age != null ? String(user.age) : "",
            gender: user.gender ?? "",
            patientId: user.patientId ?? "",
            specialization: user.specialization ?? "",
            qualification: user.qualification ?? "",
            yearsExperience: user.yearsExperience != null ? String(user.yearsExperience) : "",
            clinic: user.clinic ?? "",
        });
        setErrors({});
    }, [user]);

    useEffect(() => {
        if (isOpen) {
            apiClient.get<{ id: string; name: string }[]>('/api/branches')
                .then(({ data }) => {
                    setBranches(Array.isArray(data) ? data : []);
                    const existing: string = user?.user?.branchId ?? user?.branchId ?? "";
                    if (existing) {
                        const branch = (Array.isArray(data) ? data : []).find((b) => b.id === existing);
                        setCurrentBranchName(branch?.name || "Unknown");
                    }
                })
                .catch(() => setBranches([]));
        }
    }, [isOpen, user]);

    const updateField = (name: keyof FormState, value: string) => {
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        updateField("fullName", sanitizeName(e.target.value));

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) =>
        updateField("phoneNumber", sanitizePhone(e.target.value));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        updateField(name as keyof FormState, value);
    };

    const validate = (): boolean => {
        const next: Partial<Record<keyof FormState, string>> = {};
        const name = stripEdgeSpaces(formData.fullName);
        const email = stripEdgeSpaces(formData.email);
        if (name.length < 2) next.fullName = "Full name is required (min 2 characters).";
        if (!isValidEmail(email)) next.email = "Enter a valid email address.";
        if (!formData.branchId) next.branchId = "Please select a branch.";
        if (type === "patient" && formData.phoneNumber && !isValidPhone(formData.phoneNumber)) {
            next.phoneNumber = "Phone must be 7–15 digits (optional leading +).";
        }
        if (type === "patient" && formData.age) {
            const n = Number(formData.age);
            if (!Number.isInteger(n) || n < 0 || n > 150) next.age = "Enter a valid age (0–150).";
        }
        if ((type === "doctor" || type === "therapist" || type === "pharmacist") && formData.yearsExperience) {
            const n = Number(formData.yearsExperience);
            if (!Number.isInteger(n) || n < 0) next.yearsExperience = "Years of experience must be a non-negative integer.";
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const buildPayload = (): Record<string, unknown> => {
        const p: Record<string, unknown> = {
            fullName: stripEdgeSpaces(formData.fullName),
            email: stripEdgeSpaces(formData.email),
            branchId: formData.branchId,
        };
        if (type === "patient") {
            p.phoneNumber = formData.phoneNumber ? stripEdgeSpaces(formData.phoneNumber) : null;
            p.age = formData.age ? Number(formData.age) : null;
            p.gender = stripEdgeSpaces(formData.gender) || null;
            p.patientId = stripEdgeSpaces(formData.patientId) || null;
        } else {
            p.specialization = stripEdgeSpaces(formData.specialization) || null;
            p.qualification = stripEdgeSpaces(formData.qualification) || null;
            p.yearsExperience = formData.yearsExperience ? Number(formData.yearsExperience) : null;
            if (type !== "pharmacist") {
                p.clinic = stripEdgeSpaces(formData.clinic) || null;
            }
        }
        return p;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!type || !user?.id) return;
        if (!validate()) return;

        setLoading(true);
        try {
            await apiClient.put(`/api/user/${type}/${user.id}`, buildPayload());
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

    const userBranchId: string = user?.user?.branchId ?? user?.branchId ?? "";
    const isBranchChanged = !!formData.branchId && formData.branchId !== userBranchId;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit {type.charAt(0).toUpperCase() + type.slice(1)}</DialogTitle>
                    <DialogDescription>
                        Update the details for {user.fullName || "this user"}.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4" noValidate>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
                            <Input
                                id="fullName"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleNameChange}
                                onBlur={() => updateField("fullName", stripEdgeSpaces(formData.fullName))}
                                autoComplete="name"
                                aria-invalid={!!errors.fullName}
                                required
                            />
                            {errors.fullName && <FieldError msg={errors.fullName} />}
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                onBlur={() => updateField("email", stripEdgeSpaces(formData.email))}
                                inputMode="email"
                                autoComplete="email"
                                spellCheck={false}
                                aria-invalid={!!errors.email}
                                required
                            />
                            {errors.email && <FieldError msg={errors.email} />}
                        </div>

                        <div className="space-y-1 md:col-span-2">
                            <Label className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Branch / Hospital <span className="text-destructive">*</span>
                            </Label>
                            {currentBranchName && !isBranchChanged && (
                                <p className="text-xs text-muted-foreground mb-1">
                                    Currently at: <span className="font-medium">{currentBranchName}</span>
                                </p>
                            )}
                            <Select
                                value={formData.branchId}
                                onValueChange={(v) => updateField("branchId", v)}
                            >
                                <SelectTrigger aria-invalid={!!errors.branchId}>
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
                            {errors.branchId && <FieldError msg={errors.branchId} />}
                            {isBranchChanged && !errors.branchId && (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                                    Branch will be changed on save
                                </Badge>
                            )}
                        </div>

                        {type === "patient" ? (
                            <>
                                <div className="space-y-1">
                                    <Label htmlFor="phoneNumber">Phone Number</Label>
                                    <Input
                                        id="phoneNumber"
                                        name="phoneNumber"
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        placeholder="+919876543210"
                                        value={formData.phoneNumber}
                                        onChange={handlePhoneChange}
                                        aria-invalid={!!errors.phoneNumber}
                                    />
                                    {errors.phoneNumber && <FieldError msg={errors.phoneNumber} />}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="age">Age</Label>
                                    <Input
                                        id="age"
                                        name="age"
                                        type="number"
                                        min={0}
                                        max={150}
                                        value={formData.age}
                                        onChange={handleChange}
                                        aria-invalid={!!errors.age}
                                    />
                                    {errors.age && <FieldError msg={errors.age} />}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="gender">Gender</Label>
                                    <Select
                                        value={formData.gender}
                                        onValueChange={(v) => updateField("gender", v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select gender" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="FEMALE">Female</SelectItem>
                                            <SelectItem value="MALE">Male</SelectItem>
                                            <SelectItem value="OTHER">Other</SelectItem>
                                            <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="patientId">Patient ID</Label>
                                    <Input
                                        id="patientId"
                                        name="patientId"
                                        value={formData.patientId}
                                        onChange={handleChange}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-1 md:col-span-2">
                                    <Label htmlFor="specialization">Specialization</Label>
                                    <Input
                                        id="specialization"
                                        name="specialization"
                                        value={formData.specialization}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="qualification">Qualification</Label>
                                    <Input
                                        id="qualification"
                                        name="qualification"
                                        value={formData.qualification}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="yearsExperience">Experience (Years)</Label>
                                    <Input
                                        id="yearsExperience"
                                        name="yearsExperience"
                                        type="number"
                                        min={0}
                                        value={formData.yearsExperience}
                                        onChange={handleChange}
                                        aria-invalid={!!errors.yearsExperience}
                                    />
                                    {errors.yearsExperience && <FieldError msg={errors.yearsExperience} />}
                                </div>
                                {type !== "pharmacist" && (
                                    <div className="space-y-1 md:col-span-2">
                                        <Label htmlFor="clinic">Clinic / Hospital</Label>
                                        <Input
                                            id="clinic"
                                            name="clinic"
                                            value={formData.clinic}
                                            onChange={handleChange}
                                        />
                                    </div>
                                )}
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

function FieldError({ msg }: { msg: string }) {
    return (
        <p className="flex items-center gap-1 text-xs text-destructive ml-1">
            <AlertCircle className="w-3 h-3" /> {msg}
        </p>
    );
}
