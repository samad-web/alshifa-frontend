import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, ImageIcon, Loader2, User, ArrowRight } from "lucide-react";
import { iwisApi, type ClinicalPhoto, type ClinicalPhotoPair, type PhotoCategory, type PhotoStage } from "@/services/iwis.service";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/lib/api-client";
import { useBranchScope } from "@/hooks/useBranchScope";

// Resolve a stored ClinicalPhoto.filePath into a browser-loadable URL.
// Supabase uploads come back as full https://… URLs and pass through; the
// disk-fallback path returns a server-relative `/uploads/...` which needs the
// backend origin prepended (Vite is on a different port from the API).
const PHOTO_PLACEHOLDER = "/placeholder-image.png";
function getPhotoUrl(filePath: string | null | undefined): string {
    if (!filePath) return PHOTO_PLACEHOLDER;
    if (/^https?:\/\//i.test(filePath)) return filePath;
    const base = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:4000";
    const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
    return `${base}${path}`;
}

const CATEGORIES: PhotoCategory[] = ["SKIN_CONDITION", "SWELLING_OEDEMA", "WOUND_HEALING", "WEIGHT_CHANGE", "GENERAL_PROGRESS"];
const STAGES: PhotoStage[] = ["BEFORE", "DURING", "AFTER"];
const CAT_LABEL: Record<PhotoCategory, string> = {
    SKIN_CONDITION: "Skin condition",
    SWELLING_OEDEMA: "Swelling / oedema",
    WOUND_HEALING: "Wound healing",
    WEIGHT_CHANGE: "Weight change",
    GENERAL_PROGRESS: "General progress",
};

export default function ClinicalPhotosPage() {
    const { toast } = useToast();
    const { role, user } = useAuth();
    const isClinician = role === "DOCTOR" || role === "THERAPIST" || role === "ADMIN_DOCTOR" || role === "ADMIN";
    const { branchIdParam } = useBranchScope();

    const [patients, setPatients] = useState<Array<{ id: string; fullName: string | null }>>([]);
    const [patientId, setPatientId] = useState<string>("");
    const [photos, setPhotos] = useState<ClinicalPhoto[]>([]);
    const [pairs, setPairs] = useState<ClinicalPhotoPair[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [upload, setUpload] = useState({
        file: null as File | null,
        category: "SKIN_CONDITION" as PhotoCategory,
        stage: "BEFORE" as PhotoStage,
        bodyRegion: "",
        notes: "",
    });

    // Reload the patient roster whenever the navbar branch scope changes.
    // We pass `branchId` server-side so the dropdown only shows patients
    // assigned to the active branch — the previous client-side filter was
    // brittle (depended on a typed-out `branchId` field that wasn't in
    // the typed shape and silently fell through when the API call failed).
    useEffect(() => {
        if (isClinician) {
            const params = branchIdParam ? { branchId: branchIdParam } : undefined;
            apiClient.get<Array<{ id: string; fullName: string | null }>>("/api/user/list-patients", params)
                .then(({ data }) => {
                    setPatients(Array.isArray(data) ? data : []);
                })
                .catch((err) => {
                    setPatients([]);
                    toast({
                        title: "Couldn't load patients",
                        description: err instanceof Error ? err.message : "Try refreshing the page.",
                        variant: "destructive",
                    });
                });
        } else {
            // Patient views their own photos
            apiClient.get<{ patient?: { id: string } | null }>("/api/user/me")
                .then(({ data }) => setPatientId(data?.patient?.id || user?.id || ""))
                .catch(() => {});
        }
    }, [isClinician, user, branchIdParam, toast]);

    // Clear the picked patient when the navbar branch changes — the
    // previously selected patient may not belong to the new branch.
    useEffect(() => {
        if (isClinician && patientId && !patients.some((p) => p.id === patientId)) {
            setPatientId("");
        }
    }, [isClinician, patientId, patients]);

    const reload = useCallback(async () => {
        if (!patientId) return;
        setLoading(true);
        try {
            const [p, c] = await Promise.all([
                iwisApi.listPhotos({ patientId }),
                iwisApi.comparePhotos({ patientId }),
            ]);
            setPhotos(p);
            setPairs(c);
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => { reload(); }, [reload]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!upload.file || !patientId) return;
        try {
            const fd = new FormData();
            fd.append("file", upload.file);
            fd.append("patientId", patientId);
            fd.append("category", upload.category);
            fd.append("stage", isClinician ? upload.stage : "DURING");
            if (upload.bodyRegion) fd.append("bodyRegion", upload.bodyRegion);
            if (upload.notes) fd.append("notes", upload.notes);
            await iwisApi.uploadPhoto(fd);
            toast({ title: "Photo uploaded" });
            setUploadOpen(false);
            setUpload({ file: null, category: "SKIN_CONDITION", stage: "BEFORE", bodyRegion: "", notes: "" });
            reload();
        } catch (err: unknown) {
            toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
        }
    };

    return (
        <AppLayout>
            <div className="container max-w-7xl mx-auto px-4 py-8 space-y-8">
                <PageHeader title="Clinical Photos" subtitle="Staged photo progress with before / after comparison">
                    <Button onClick={() => setUploadOpen(true)} disabled={!patientId}>
                        <Camera className="w-4 h-4 mr-2" /> Upload Photo
                    </Button>
                </PageHeader>

                {isClinician && (
                    <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <Select value={patientId} onValueChange={setPatientId}>
                            <SelectTrigger className="w-[320px]">
                                <SelectValue placeholder={
                                    patients.length === 0
                                        ? (branchIdParam ? "No patients in this branch" : "No patients available")
                                        : "Select patient"
                                } />
                            </SelectTrigger>
                            <SelectContent>
                                {patients.length === 0 ? (
                                    <div className="px-2 py-3 text-xs text-muted-foreground">
                                        No patients found{branchIdParam ? " in the current branch" : ""}.
                                    </div>
                                ) : (
                                    patients.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.fullName || "Unnamed"}</SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {!patientId ? (
                    <div className="py-16 text-center text-muted-foreground">Select a patient to view photos.</div>
                ) : loading ? (
                    <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : (
                    <Tabs defaultValue="gallery">
                        <TabsList>
                            <TabsTrigger value="gallery">Gallery ({photos.length})</TabsTrigger>
                            <TabsTrigger value="compare">Before / After ({pairs.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="gallery" className="mt-6">
                            {photos.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border/50 rounded-[32px] bg-secondary/5">
                                    <ImageIcon className="w-12 h-12 text-muted-foreground/50 mb-4" />
                                    <p className="text-muted-foreground">No photos uploaded yet.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {photos.map((p) => (
                                        <Panel key={p.id} title={CAT_LABEL[p.category]} className="overflow-hidden">
                                            <img
                                                src={getPhotoUrl(p.filePath)}
                                                alt={p.category}
                                                onError={(e) => { e.currentTarget.src = PHOTO_PLACEHOLDER; }}
                                                className="w-full h-40 object-cover rounded-lg bg-muted"
                                            />
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                <Badge variant={p.stage === "BEFORE" ? "secondary" : p.stage === "AFTER" ? "default" : "outline"}>{p.stage}</Badge>
                                                {p.bodyRegion && <Badge variant="outline">{p.bodyRegion}</Badge>}
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-2">{new Date(p.takenAt).toLocaleDateString()}</div>
                                            {p.notes && <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{p.notes}</p>}
                                        </Panel>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="compare" className="mt-6">
                            {pairs.length === 0 ? (
                                <div className="py-16 text-center text-muted-foreground">Upload both BEFORE and AFTER photos in the same category to enable comparison.</div>
                            ) : (
                                <div className="space-y-6">
                                    {pairs.map((pair, i) => (
                                        <Panel key={i} title={`${CAT_LABEL[pair.category]}${pair.bodyRegion ? ` · ${pair.bodyRegion}` : ""}`}>
                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
                                                <div className="space-y-2">
                                                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Before</div>
                                                    {pair.before ? (
                                                        <>
                                                            <img
                                                                src={getPhotoUrl(pair.before.filePath)}
                                                                alt="before"
                                                                onError={(e) => { e.currentTarget.src = PHOTO_PLACEHOLDER; }}
                                                                className="w-full h-64 object-cover rounded-lg bg-muted"
                                                            />
                                                            <div className="text-xs text-muted-foreground">{new Date(pair.before.takenAt).toLocaleDateString()}</div>
                                                        </>
                                                    ) : <div className="h-64 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">No photo</div>}
                                                </div>
                                                <ArrowRight className="w-6 h-6 text-muted-foreground mx-auto hidden md:block" />
                                                <div className="space-y-2">
                                                    <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">After</div>
                                                    {pair.after ? (
                                                        <>
                                                            <img
                                                                src={getPhotoUrl(pair.after.filePath)}
                                                                alt="after"
                                                                onError={(e) => { e.currentTarget.src = PHOTO_PLACEHOLDER; }}
                                                                className="w-full h-64 object-cover rounded-lg bg-muted"
                                                            />
                                                            <div className="text-xs text-muted-foreground">{new Date(pair.after.takenAt).toLocaleDateString()}</div>
                                                        </>
                                                    ) : <div className="h-64 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">No photo yet</div>}
                                                </div>
                                            </div>
                                        </Panel>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}

                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Upload Clinical Photo</DialogTitle>
                            <DialogDescription>
                                {isClinician
                                    ? "Clinicians can tag any stage (Before / During / After)."
                                    : "Patient uploads are always tagged as During — your clinician will mark Before / After."}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={submit} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Photo</Label>
                                <Input type="file" accept="image/*" capture="environment" required onChange={(e) => setUpload({ ...upload, file: e.target.files?.[0] ?? null })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select value={upload.category} onValueChange={(v) => setUpload({ ...upload, category: v as PhotoCategory })}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CAT_LABEL[c]}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                {isClinician && (
                                    <div className="space-y-2">
                                        <Label>Stage</Label>
                                        <Select value={upload.stage} onValueChange={(v) => setUpload({ ...upload, stage: v as PhotoStage })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Body region (optional)</Label>
                                <Input value={upload.bodyRegion} onChange={(e) => setUpload({ ...upload, bodyRegion: e.target.value })} placeholder="e.g. left knee, lower back" />
                            </div>
                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Textarea rows={2} value={upload.notes} onChange={(e) => setUpload({ ...upload, notes: e.target.value })} />
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setUploadOpen(false)}>Cancel</Button>
                                <Button type="submit"><Camera className="w-4 h-4 mr-2" /> Upload</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
