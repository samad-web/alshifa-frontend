import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { MultiplePrescriptionForm } from "@/components/prescription/MultiplePrescriptionForm";
import { PrescriptionList } from "@/components/prescription-list";
import { useAuth } from "@/hooks/useAuth";
import { FilePlus2, User } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";

export default function PrescriptionManagement() {
    const { role } = useAuth();
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<string>("");
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);
    const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
    const [prescriptionSearchQuery, setPrescriptionSearchQuery] = useState("");
    const [prescriptionBranchFilter, setPrescriptionBranchFilter] = useState("all");

    // Fetch patients and available branches in parallel
    useEffect(() => {
        async function fetchInitialData() {
            try {
                const [{ data: patientsData }, { data: branchesData }] = await Promise.all([
                    apiClient.get<any[]>('/api/user/list-patients'),
                    apiClient.get<any[]>('/api/branches'),
                ]);
                setPatients(patientsData);
                setBranches(branchesData);
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            }
        }
        fetchInitialData();
    }, []);

    // Fetch prescriptions when patient is selected
    useEffect(() => {
        async function fetchPrescriptions() {
            if (!selectedPatient) {
                setPrescriptions([]);
                return;
            }
            setLoadingPrescriptions(true);
            try {
                const { data } = await apiClient.get<any[]>(`/api/prescriptions/patient/${selectedPatient}`);
                // Guard: ensure we always set an array even if the API shape changes
                setPrescriptions(Array.isArray(data) ? data : []);
            } catch (error: any) {
                // Non-2xx (e.g. 403 for unassigned doctor/therapist) — clear stale data
                setPrescriptions([]);
                console.warn("Prescriptions fetch failed:", error?.message);
            } finally {
                setLoadingPrescriptions(false);
            }
        }
        fetchPrescriptions();
    }, [selectedPatient]);

    const handlePrescriptionAdded = () => {
        // Refresh prescriptions list
        if (selectedPatient) {
            apiClient.get<any[]>(`/api/prescriptions/patient/${selectedPatient}`)
                .then(({ data }) => setPrescriptions(Array.isArray(data) ? data : []))
                .catch(console.error);
        }
    };

    if (!role || !["DOCTOR", "THERAPIST", "ADMIN", "ADMIN_DOCTOR"].includes(role)) {
        return (
            <AppLayout>
                <div className="container max-w-4xl mx-auto px-4 py-8 text-center">
                    <p className="text-muted-foreground">
                        {!role ? "Loading..." : "Access denied. Only medical staff can access this page."}
                    </p>
                </div>
            </AppLayout>
        );
    }

    const selectedPatientData = patients.find((p) => p.id === selectedPatient);

    // Client-side filter: branch classification + text search applied to the already-fetched list
    const filteredPatients = patients.filter((p: any) => {
        const q = prescriptionSearchQuery.toLowerCase();
        const matchesSearch = !q ||
            (p.fullName  || "").toLowerCase().includes(q) ||
            (p.patientId || "").toLowerCase().includes(q) ||
            (p.email     || "").toLowerCase().includes(q);
        const matchesBranch = prescriptionBranchFilter === "all" || p.branchId === prescriptionBranchFilter;
        return matchesSearch && matchesBranch;
    });

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-6 md:py-8 space-y-8">
                <PageHeader
                    title="Prescription Management"
                    subtitle="Upload, view, and download patient prescriptions"
                />

                {/* Patient Selection */}
                <Panel title="Select Patient" subtitle="Choose a patient to manage their prescriptions">
                    {/* Branch + Search Filter — augments the existing patient dropdown without changing layout */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <input
                            type="text"
                            placeholder="Search by name, patient ID, or email..."
                            value={prescriptionSearchQuery}
                            onChange={(e) => setPrescriptionSearchQuery(e.target.value)}
                            className="flex-1 min-w-[160px] h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <Select value={prescriptionBranchFilter} onValueChange={setPrescriptionBranchFilter}>
                            <SelectTrigger className="w-[160px] h-9 shrink-0">
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
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a patient..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredPatients.map((patient) => (
                                        <SelectItem key={patient.id} value={patient.id}>
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4" />
                                                <span>{patient.fullName || patient.email}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedPatient && (
                            <Button onClick={() => setShowModal(true)} className="gap-2">
                                <FilePlus2 className="w-4 h-4" />
                                Add Prescription
                            </Button>
                        )}
                    </div>
                </Panel>

                {/* Add Prescription Form */}
                {selectedPatient && showModal && (
                    <Panel title="New Prescription" subtitle={`Create a structured prescription for ${selectedPatientData?.fullName}`}>
                        <MultiplePrescriptionForm
                            patientId={selectedPatient}
                            patientName={selectedPatientData?.fullName || selectedPatientData?.email}
                            onSuccess={() => {
                                setShowModal(false);
                                handlePrescriptionAdded();
                            }}
                            onCancel={() => setShowModal(false)}
                        />
                    </Panel>
                )}

                {/* Prescriptions Display */}
                {selectedPatient && !showModal && (
                    <Panel
                        title={`Prescriptions for ${selectedPatientData?.fullName || "Patient"}`}
                        subtitle="View and download prescription history"
                    >
                        {loadingPrescriptions ? (
                            <div className="text-center py-12 text-muted-foreground">
                                Loading prescriptions...
                            </div>
                        ) : (
                            <PrescriptionList prescriptions={prescriptions} />
                        )}
                    </Panel>
                )}
            </div>
        </AppLayout>
    );
}
