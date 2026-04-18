import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Trash2, AlertTriangle, Loader2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { UserEditModal } from "@/components/user-edit-modal";
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal";
import { apiClient } from "@/lib/api-client";

interface Doctor {
    id: string;
    fullName: string | null;
    email: string;
    specialization: string | null;
    qualification: string | null;
    yearsExperience: number | null;
}

interface Therapist {
    id: string;
    fullName: string | null;
    email: string;
    specialization: string | null;
    qualification: string | null;
    yearsExperience: number | null;
}

interface Patient {
    id: string;
    fullName: string | null;
    email: string;
    phoneNumber: string | null;
    age: number | null;
    gender: string | null;
    patientId: string | null;
}

interface Pharmacist {
    id: string;
    fullName: string | null;
    email: string;
    qualification: string | null;
    yearsExperience: number | null;
}

export default function ManageUsers() {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [therapists, setTherapists] = useState<Therapist[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [pharmacists, setPharmacists] = useState<Pharmacist[]>([]);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Branch + text search filter state per tab
    const [doctorSearch,          setDoctorSearch]          = useState("");
    const [doctorBranchFilter,    setDoctorBranchFilter]    = useState("all");
    const [therapistSearch,       setTherapistSearch]       = useState("");
    const [therapistBranchFilter, setTherapistBranchFilter] = useState("all");
    const [patientSearch,         setPatientSearch]         = useState("");
    const [patientBranchFilter,   setPatientBranchFilter]   = useState("all");

    // Guard: prevents duplicate queries on initial mount
    const searchFiltersReady = useRef(false);
    const doctorDebounce     = useRef<NodeJS.Timeout | null>(null);
    const therapistDebounce  = useRef<NodeJS.Timeout | null>(null);
    const patientDebounce    = useRef<NodeJS.Timeout | null>(null);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<any>(null);
    const [editType, setEditType] = useState<"doctor" | "therapist" | "patient" | "pharmacist" | null>(null);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteData, setDeleteData] = useState<{
        type: "doctor" | "therapist" | "patient" | "pharmacist";
        id: string;
        name: string;
    } | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    // Debounced per-tab re-fetch — only fires after initial load completes (searchFiltersReady guard)
    useEffect(() => {
        if (!searchFiltersReady.current) return;
        if (doctorDebounce.current) clearTimeout(doctorDebounce.current);
        doctorDebounce.current = setTimeout(async () => {
            try {
                const params: Record<string, string> = {};
                if (doctorSearch) params.search = doctorSearch;
                if (doctorBranchFilter && doctorBranchFilter !== "all") params.branchId = doctorBranchFilter;
                const { data } = await apiClient.get<Doctor[]>('/api/user/list-doctors', params);
                setDoctors(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to filter doctors:", err);
            }
        }, 600);
        return () => { if (doctorDebounce.current) clearTimeout(doctorDebounce.current); };
    }, [doctorSearch, doctorBranchFilter]);

    useEffect(() => {
        if (!searchFiltersReady.current) return;
        if (therapistDebounce.current) clearTimeout(therapistDebounce.current);
        therapistDebounce.current = setTimeout(async () => {
            try {
                const params: Record<string, string> = {};
                if (therapistSearch) params.search = therapistSearch;
                if (therapistBranchFilter && therapistBranchFilter !== "all") params.branchId = therapistBranchFilter;
                const { data } = await apiClient.get<Therapist[]>('/api/user/list-therapists', params);
                setTherapists(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to filter therapists:", err);
            }
        }, 600);
        return () => { if (therapistDebounce.current) clearTimeout(therapistDebounce.current); };
    }, [therapistSearch, therapistBranchFilter]);

    useEffect(() => {
        if (!searchFiltersReady.current) return;
        if (patientDebounce.current) clearTimeout(patientDebounce.current);
        patientDebounce.current = setTimeout(async () => {
            try {
                const params: Record<string, string> = {};
                if (patientSearch) params.search = patientSearch;
                if (patientBranchFilter && patientBranchFilter !== "all") params.branchId = patientBranchFilter;
                const { data } = await apiClient.get<Patient[]>('/api/user/list-patients', params);
                setPatients(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to filter patients:", err);
            }
        }, 600);
        return () => { if (patientDebounce.current) clearTimeout(patientDebounce.current); };
    }, [patientSearch, patientBranchFilter]);

    const fetchUsers = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const [{ data: doctorsData }, { data: therapistsData }, { data: patientsData }, { data: pharmacistsData }, { data: branchesData }] = await Promise.all([
                apiClient.get<Doctor[]>('/api/user/list-doctors'),
                apiClient.get<Therapist[]>('/api/user/list-therapists'),
                apiClient.get<Patient[]>('/api/user/list-patients'),
                apiClient.get<Pharmacist[]>('/api/user/list-pharmacists'),
                apiClient.get<{ id: string; name: string }[]>('/api/branches'),
            ]);

            // Guard: ensure every state setter only receives a proper array — non-array responses
            // (e.g. an error object from a 200-body or a corrupted cache payload) would otherwise
            // cause .map() to throw and crash the render, producing a blank page.
            setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
            setTherapists(Array.isArray(therapistsData) ? therapistsData : []);
            setPatients(Array.isArray(patientsData) ? patientsData : []);
            setPharmacists(Array.isArray(pharmacistsData) ? pharmacistsData : []);
            setBranches(Array.isArray(branchesData) ? branchesData : []);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to fetch users";
            setFetchError(msg);
            toast.error(msg);
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
            searchFiltersReady.current = true; // allow filter effects to fire on subsequent changes
        }
    };

    const handleDelete = (type: "doctor" | "therapist" | "patient" | "pharmacist", id: string, name: string | null) => {
        setDeleteData({ type, id, name: name || 'this user' });
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteData) return;

        const { type, id } = deleteData;
        setDeleting(id);
        try {
            await apiClient.delete(`/api/user/${type}/${id}`);
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully`);

            // Remove from local state
            if (type === "doctor") {
                setDoctors(doctors.filter((d) => d.id !== id));
            } else if (type === "therapist") {
                setTherapists(therapists.filter((t) => t.id !== id));
            } else if (type === "patient") {
                setPatients(patients.filter((p) => p.id !== id));
            } else if (type === "pharmacist") {
                setPharmacists(pharmacists.filter((ph) => ph.id !== id));
            }
            setIsDeleteModalOpen(false);
        } catch (error: any) {
            toast.error(error?.message || `Failed to delete ${type}`);
            console.error(`Error deleting ${type}:`, error);
        } finally {
            setDeleting(null);
        }
    };

    const handleEdit = (type: "doctor" | "therapist" | "patient" | "pharmacist", user: any) => {
        setEditType(type);
        setUserToEdit(user);
        setIsEditModalOpen(true);
    };

    if (loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </AppLayout>
        );
    }

    if (fetchError) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
                    <AlertTriangle className="w-12 h-12 text-risk" />
                    <p className="text-lg font-semibold text-foreground">Failed to load users</p>
                    <p className="text-sm text-muted-foreground max-w-sm">{fetchError}</p>
                    <Button onClick={fetchUsers} variant="outline" className="gap-2">
                        <Loader2 className="w-4 h-4" />
                        Retry
                    </Button>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8">
                <PageHeader
                    title="Manage Users"
                    subtitle="View and manage doctors, therapists, and patients"
                />

                <Tabs defaultValue="doctors" className="space-y-6">
                    <TabsList className="flex w-full overflow-x-auto h-auto p-1 bg-muted/50 gap-1 no-scrollbar min-w-0">
                        <TabsTrigger value="doctors" className="whitespace-nowrap px-6 py-2">
                            Doctors ({doctors.length})
                        </TabsTrigger>
                        <TabsTrigger value="therapists" className="whitespace-nowrap px-6 py-2">
                            Therapists ({therapists.length})
                        </TabsTrigger>
                        <TabsTrigger value="patients" className="whitespace-nowrap px-6 py-2">
                            Patients ({patients.length})
                        </TabsTrigger>
                        <TabsTrigger value="pharmacists" className="whitespace-nowrap px-6 py-2">
                            Pharmacists ({pharmacists.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Doctors Tab */}
                    <TabsContent value="doctors">
                        <Panel title="Doctors" subtitle="Manage medical doctors">
                            {/* Branch + Search Filter */}
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <div className="relative flex-1 min-w-[160px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        placeholder="Search by name..."
                                        className="pl-9"
                                        value={doctorSearch}
                                        onChange={(e) => setDoctorSearch(e.target.value)}
                                    />
                                </div>
                                <Select value={doctorBranchFilter} onValueChange={setDoctorBranchFilter}>
                                    <SelectTrigger className="w-[180px] shrink-0">
                                        <SelectValue placeholder="All branches" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All branches</SelectItem>
                                        {branches.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Mobile Card View */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {doctors.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground bg-secondary/5 rounded-xl border border-dashed border-border/60">
                                        <Users className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                        <p>No doctors found</p>
                                    </div>
                                ) : (
                                    doctors.map((doctor) => (
                                        <div key={doctor.id} className="p-4 rounded-xl border border-border/50 bg-card space-y-3 relative group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-foreground">{doctor.fullName || "N/A"}</h3>
                                                    <p className="text-xs text-muted-foreground">{doctor.email}</p>
                                                </div>
                                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                                    {doctor.specialization || "General"}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Qualification</p>
                                                    <p className="text-xs font-semibold">{doctor.qualification || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Experience</p>
                                                    <p className="text-xs font-semibold">{doctor.yearsExperience ? `${doctor.yearsExperience} yrs` : "N/A"}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleEdit("doctor", doctor)}
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete("doctor", doctor.id, doctor.fullName)}
                                                    disabled={deleting === doctor.id}
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 text-risk hover:text-risk hover:bg-risk/10"
                                                >
                                                    {deleting === doctor.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-border">
                                        <tr className="text-left">
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Name</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Email</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Specialization</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Qualification</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Experience</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {doctors.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center">
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                        <Users className="w-8 h-8 opacity-20" />
                                                        <p>No doctors found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            doctors.map((doctor) => (
                                                <tr key={doctor.id} className="border-b border-border/40 hover:bg-secondary/10 transition-colors group">
                                                    <td className="py-4 font-medium">{doctor.fullName || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{doctor.email}</td>
                                                    <td className="py-4 text-sm">
                                                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-medium">
                                                            {doctor.specialization || "General"}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 text-sm text-muted-foreground">{doctor.qualification || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{doctor.yearsExperience ? `${doctor.yearsExperience} yrs` : "N/A"}</td>
                                                    <td className="py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit("doctor", doctor)}
                                                                className="text-primary hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Edit Doctor"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete("doctor", doctor.id, doctor.fullName)}
                                                                disabled={deleting === doctor.id}
                                                                className="text-risk hover:text-risk hover:bg-risk/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Delete Doctor"
                                                            >
                                                                {deleting === doctor.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
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
                    </TabsContent>

                    {/* Therapists Tab */}
                    <TabsContent value="therapists">
                        <Panel title="Therapists" subtitle="Manage clinical therapists">
                            {/* Branch + Search Filter */}
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <div className="relative flex-1 min-w-[160px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        placeholder="Search by name..."
                                        className="pl-9"
                                        value={therapistSearch}
                                        onChange={(e) => setTherapistSearch(e.target.value)}
                                    />
                                </div>
                                <Select value={therapistBranchFilter} onValueChange={setTherapistBranchFilter}>
                                    <SelectTrigger className="w-[180px] shrink-0">
                                        <SelectValue placeholder="All branches" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All branches</SelectItem>
                                        {branches.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Mobile Card View */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {therapists.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground bg-secondary/5 rounded-xl border border-dashed border-border/60">
                                        <Users className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                        <p>No therapists found</p>
                                    </div>
                                ) : (
                                    therapists.map((therapist) => (
                                        <div key={therapist.id} className="p-4 rounded-xl border border-border/50 bg-card space-y-3 relative group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-foreground">{therapist.fullName || "N/A"}</h3>
                                                    <p className="text-xs text-muted-foreground">{therapist.email}</p>
                                                </div>
                                                <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                                    {therapist.specialization || "Clinical"}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Qualification</p>
                                                    <p className="text-xs font-semibold">{therapist.qualification || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Experience</p>
                                                    <p className="text-xs font-semibold">{therapist.yearsExperience ? `${therapist.yearsExperience} yrs` : "N/A"}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleEdit("therapist", therapist)}
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete("therapist", therapist.id, therapist.fullName)}
                                                    disabled={deleting === therapist.id}
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 text-risk hover:text-risk hover:bg-risk/10"
                                                >
                                                    {deleting === therapist.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-border">
                                        <tr className="text-left">
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Name</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Email</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Specialization</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Qualification</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Experience</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {therapists.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Users className="w-8 h-8 opacity-20" />
                                                        <p>No therapists found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            therapists.map((therapist) => (
                                                <tr key={therapist.id} className="border-b border-border/40 hover:bg-secondary/10 transition-colors group">
                                                    <td className="py-4 font-medium">{therapist.fullName || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{therapist.email}</td>
                                                    <td className="py-4 text-sm">
                                                        <span className="bg-accent/10 text-accent px-2 py-1 rounded-md text-xs font-medium">
                                                            {therapist.specialization || "Clinical"}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 text-sm text-muted-foreground">{therapist.qualification || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{therapist.yearsExperience ? `${therapist.yearsExperience} yrs` : "N/A"}</td>
                                                    <td className="py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit("therapist", therapist)}
                                                                className="text-primary hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Edit Therapist"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete("therapist", therapist.id, therapist.fullName)}
                                                                disabled={deleting === therapist.id}
                                                                className="text-risk hover:text-risk hover:bg-risk/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Delete Therapist"
                                                            >
                                                                {deleting === therapist.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
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
                    </TabsContent>

                    {/* Patients Tab */}
                    <TabsContent value="patients">
                        <Panel title="Patients" subtitle="Manage registered patients">
                            {/* Branch + Search Filter */}
                            <div className="flex flex-wrap items-center gap-3 mb-4">
                                <div className="relative flex-1 min-w-[160px]">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input
                                        placeholder="Search by name, phone, or patient ID..."
                                        className="pl-9"
                                        value={patientSearch}
                                        onChange={(e) => setPatientSearch(e.target.value)}
                                    />
                                </div>
                                <Select value={patientBranchFilter} onValueChange={setPatientBranchFilter}>
                                    <SelectTrigger className="w-[180px] shrink-0">
                                        <SelectValue placeholder="All branches" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All branches</SelectItem>
                                        {branches.map((b) => (
                                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Mobile Card View */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {patients.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground bg-secondary/5 rounded-xl border border-dashed border-border/60">
                                        <Users className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                        <p>No patients found</p>
                                    </div>
                                ) : (
                                    patients.map((patient) => (
                                        <div key={patient.id} className="p-4 rounded-xl border border-border/50 bg-card space-y-3 relative group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-foreground">{patient.fullName || "N/A"}</h3>
                                                    <p className="text-xs text-muted-foreground">{patient.email}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Patient ID</p>
                                                    <p className="font-mono text-[10px] font-bold">{patient.patientId || "N/A"}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Phone</p>
                                                    <p className="text-[10px] font-semibold truncate">{patient.phoneNumber || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Age</p>
                                                    <p className="text-[10px] font-semibold">{patient.age || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Gender</p>
                                                    <p className="text-[10px] font-semibold">{patient.gender || "N/A"}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleEdit("patient", patient)}
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete("patient", patient.id, patient.fullName)}
                                                    disabled={deleting === patient.id}
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 text-risk hover:text-risk hover:bg-risk/10"
                                                >
                                                    {deleting === patient.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-border">
                                        <tr className="text-left">
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Name</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Email</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Phone</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Age</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Gender</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Patient ID</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {patients.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Users className="w-8 h-8 opacity-20" />
                                                        <p>No patients found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            patients.map((patient) => (
                                                <tr key={patient.id} className="border-b border-border/40 hover:bg-secondary/10 transition-colors group">
                                                    <td className="py-4 font-medium">{patient.fullName || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{patient.email}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{patient.phoneNumber || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{patient.age || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{patient.gender || "N/A"}</td>
                                                    <td className="py-4 text-sm border-l-2 border-primary/20 pl-3">
                                                        <span className="font-mono text-xs">{patient.patientId || "N/A"}</span>
                                                    </td>
                                                    <td className="py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit("patient", patient)}
                                                                className="text-primary hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Edit Patient"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete("patient", patient.id, patient.fullName)}
                                                                disabled={deleting === patient.id}
                                                                className="text-risk hover:text-risk hover:bg-risk/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Delete Patient"
                                                            >
                                                                {deleting === patient.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
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
                    </TabsContent>

                    {/* Pharmacists Tab */}
                    <TabsContent value="pharmacists">
                        <Panel title="Pharmacists" subtitle="Manage pharmacy staff">
                            {/* Mobile Card View */}
                            <div className="grid grid-cols-1 gap-4 md:hidden">
                                {pharmacists.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground bg-secondary/5 rounded-xl border border-dashed border-border/60">
                                        <Users className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                        <p>No pharmacists found</p>
                                    </div>
                                ) : (
                                    pharmacists.map((pharma) => (
                                        <div key={pharma.id} className="p-4 rounded-xl border border-border/50 bg-card space-y-3 relative group">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-foreground">{pharma.fullName || "N/A"}</h3>
                                                    <p className="text-xs text-muted-foreground">{pharma.email}</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Qualification</p>
                                                    <p className="text-xs font-semibold">{pharma.qualification || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Experience</p>
                                                    <p className="text-xs font-semibold">{pharma.yearsExperience ? `${pharma.yearsExperience} yrs` : "N/A"}</p>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2 pt-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleEdit("pharmacist" as any, pharma)}
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" /> Edit
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete("pharmacist" as any, pharma.id, pharma.fullName)}
                                                    disabled={deleting === pharma.id}
                                                    className="h-8 text-[10px] font-bold uppercase tracking-wider gap-2 text-risk hover:text-risk hover:bg-risk/10"
                                                >
                                                    {deleting === pharma.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-border">
                                        <tr className="text-left">
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Name</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Email</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Qualification</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground">Experience</th>
                                            <th className="pb-3 font-semibold text-sm text-muted-foreground text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pharmacists.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <Users className="w-8 h-8 opacity-20" />
                                                        <p>No pharmacists found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            pharmacists.map((pharma) => (
                                                <tr key={pharma.id} className="border-b border-border/40 hover:bg-secondary/10 transition-colors group">
                                                    <td className="py-4 font-medium">{pharma.fullName || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{pharma.email}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{pharma.qualification || "N/A"}</td>
                                                    <td className="py-4 text-sm text-muted-foreground">{pharma.yearsExperience ? `${pharma.yearsExperience} yrs` : "N/A"}</td>
                                                    <td className="py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit("pharmacist" as any, pharma)} // Simplified for now
                                                                className="text-primary hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Edit Pharmacist"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete("pharmacist" as any, pharma.id, pharma.fullName)}
                                                                disabled={deleting === pharma.id}
                                                                className="text-risk hover:text-risk hover:bg-risk/10 transition-colors opacity-0 group-hover:opacity-100"
                                                                title="Delete Pharmacist"
                                                            >
                                                                {deleting === pharma.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
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
                    </TabsContent>
                </Tabs>

                {/* Warning Notice */}
                <Panel
                    variant="attention"
                    title="Caution: User Deletion"
                    subtitle="Important information regarding the deletion process"
                >
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-attention mt-0.5" />
                        <p className="text-sm text-attention-foreground/80 leading-relaxed">
                            Deleted users will be marked as inactive and hidden from all lists. Their historical data (appointments, prescriptions, documents) will be preserved for audit purposes. This ensures clinical records remain intact while removing the user's access to the system.
                        </p>
                    </div>
                </Panel>

                <UserEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setUserToEdit(null);
                        setEditType(null);
                    }}
                    user={userToEdit}
                    type={editType}
                    onSuccess={fetchUsers}
                />

                <DeleteConfirmationModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => {
                        setIsDeleteModalOpen(false);
                        setDeleteData(null);
                    }}
                    onConfirm={confirmDelete}
                    userName={deleteData?.name || ""}
                    userRole={deleteData?.type || ""}
                    loading={deleting !== null}
                />
            </div>
        </AppLayout>
    );
}
