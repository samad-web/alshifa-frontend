import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/ui/panel";
import { Plus, Trash2, Search, Loader2, CheckCircle2, PlaySquare, ChevronsUpDown, Check, Video, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface Medicine {
    id: string;
    name: string;
    brand: string;
    category: string;
    price: number;
    totalStock: number;
    videoUrl?: string;
    sku?: string;
}

interface PrescriptionItem {
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    notes: string;
    timing: string;
    vehicle: string;
    medicineId?: string;
    videoUrl: string;
    sku?: string;
}

interface ExternalVideo {
    id: string;
    title: string;
    videoUrl: string;
    category: string;
}

interface MultiplePrescriptionFormProps {
    patientId: string;
    patientName?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

/**
 * Extract YouTube video ID from various URL formats and return an embed URL.
 * Returns null if not a YouTube URL.
 */
function getYouTubeEmbedUrl(url: string): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        let videoId: string | null = null;

        if (parsed.hostname.includes('youtube.com')) {
            if (parsed.pathname === '/watch') {
                videoId = parsed.searchParams.get('v');
            } else if (parsed.pathname.startsWith('/embed/')) {
                videoId = parsed.pathname.split('/embed/')[1]?.split(/[?&/]/)[0];
            } else if (parsed.pathname.startsWith('/shorts/')) {
                videoId = parsed.pathname.split('/shorts/')[1]?.split(/[?&/]/)[0];
            }
        } else if (parsed.hostname === 'youtu.be') {
            videoId = parsed.pathname.slice(1).split(/[?&/]/)[0];
        }

        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    } catch { /* not a valid URL */ }
    return null;
}

function isValidUrl(url: string): boolean {
    if (!url) return true;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

const TIMING_OPTIONS = [
    { value: "BEFORE_FOOD", label: "Before Food (Prapchaat)" },
    { value: "AFTER_FOOD", label: "After Food (Paschat)" },
    { value: "EMPTY_STOMACH", label: "Empty Stomach (Akala)" },
    { value: "BEDTIME", label: "At Bedtime (Nishi)" },
    { value: "WITH_FOOD", label: "With Food (Sabhakta)" },
];

const VEHICLE_OPTIONS = [
    { value: "WARM_WATER", label: "Warm Water" },
    { value: "HONEY", label: "Honey" },
    { value: "MILK", label: "Milk" },
    { value: "GHEE", label: "Ghee" },
    { value: "BUTTERMILK", label: "Buttermilk" },
];

export function MultiplePrescriptionForm({
    patientId,
    patientName,
    onSuccess,
    onCancel,
}: MultiplePrescriptionFormProps) {
    const [loading, setLoading] = useState(false);
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [videos, setVideos] = useState<ExternalVideo[]>([]);
    const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([
        {
            medicationName: "",
            dosage: "",
            frequency: "",
            duration: "",
            notes: "",
            timing: "AFTER_FOOD",
            vehicle: "WARM_WATER",
            videoUrl: "",
        },
    ]);

    useEffect(() => {
        fetchMedicines();
        fetchVideos();
    }, []);

    const fetchVideos = async () => {
        try {
            const { data } = await apiClient.get<ExternalVideo[]>('/api/wellness/videos');
            setVideos(data);
        } catch (error) {
            console.error("Failed to fetch videos:", error);
        }
    };

    const fetchMedicines = async () => {
        try {
            const { data } = await apiClient.get<Medicine[]>('/api/pharmacy/medicines');
            setMedicines(data);
        } catch (error) {
            console.error("Failed to fetch medicines:", error);
        }
    };

    const addItem = () => {
        setPrescriptionItems([
            ...prescriptionItems,
            {
                medicationName: "",
                dosage: "",
                frequency: "",
                duration: "",
                notes: "",
                timing: "AFTER_FOOD",
                vehicle: "WARM_WATER",
                videoUrl: "",
            },
        ]);
    };

    const removeItem = (index: number) => {
        if (prescriptionItems.length === 1) return;
        const newItems = [...prescriptionItems];
        newItems.splice(index, 1);
        setPrescriptionItems(newItems);
    };

    const updateItem = (index: number, field: keyof PrescriptionItem, value: string) => {
        const newItems = [...prescriptionItems];
        newItems[index] = { ...newItems[index], [field]: value };

        // If updating medicationName (manual or via combobox), try to find medicineId, videoUrl and SKU
        if (field === "medicationName") {
            const med = medicines.find(m => m.name.toLowerCase() === value.toLowerCase());
            if (med) {
                newItems[index].medicineId = med.id;
                newItems[index].sku = med.sku;
                // @ts-ignore
                if (med.videoUrl) {
                    newItems[index].videoUrl = med.videoUrl;
                }
            }
        }

        setPrescriptionItems(newItems);
    };

    const handleSelectMedicine = (index: number, med: Medicine) => {
        const newItems = [...prescriptionItems];
        newItems[index] = {
            ...newItems[index],
            medicationName: med.name,
            medicineId: med.id,
            sku: med.sku,
            videoUrl: med.videoUrl || newItems[index].videoUrl
        };
        setPrescriptionItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate
        const invalid = prescriptionItems.some(item => !item.medicationName || !item.dosage || !item.frequency || !item.duration);
        if (invalid) {
            toast.error("Please fill in all required fields for each medication");
            return;
        }

        setLoading(true);

        try {
            await apiClient.post('/api/prescriptions/batch-add', {
                patientId,
                medicines: prescriptionItems,
            });
            toast.success("Prescriptions added successfully");
            onSuccess?.();
        } catch (error: any) {
            toast.error(error?.message || "Failed to add prescriptions");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground">Write Prescription</h2>
                    {patientName && (
                        <p className="text-sm text-muted-foreground">For: {patientName}</p>
                    )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Medication
                </Button>
            </div>

            <div className="space-y-4">
                {prescriptionItems.map((item, index) => (
                    <div key={index} className="p-4 bg-secondary/20 rounded-xl relative border border-border/50 group">
                        {prescriptionItems.length > 1 && (
                            <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-risk text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-2 space-y-2">
                                <Label>Medication Name (Search by Name or SKU) *</Label>
                                <div className="relative">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between font-normal",
                                                    !item.medicationName && "text-muted-foreground"
                                                )}
                                            >
                                                {item.medicationName
                                                    ? (item.sku ? `${item.medicationName} (${item.sku})` : item.medicationName)
                                                    : "Select medicine..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[calc(100vw-2rem)] md:w-[400px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search medicine or SKU..." />
                                                <CommandEmpty>No medicine found.</CommandEmpty>
                                                <CommandList>
                                                    <CommandGroup>
                                                        {medicines.map((med) => (
                                                            <CommandItem
                                                                key={med.id}
                                                                value={`${med.name} ${med.sku || ""}`}
                                                                onSelect={() => {
                                                                    handleSelectMedicine(index, med);
                                                                }}
                                                            >
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                item.medicineId === med.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <span className="font-bold">{med.name}</span>
                                                                        {med.sku && (
                                                                            <Badge variant="secondary" className="text-[9px] font-black uppercase py-0 px-1">
                                                                                {med.sku}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <div className="ml-6 flex items-center gap-3 text-[10px] text-muted-foreground">
                                                                        <span>{med.brand || "Generics"}</span>
                                                                        <span className={med.totalStock < 10 ? "text-attention font-bold" : ""}>
                                                                            {med.totalStock} in stock
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    {item.medicationName && (
                                        <div className="mt-1">
                                            {item.medicineId ? (
                                                <span className="text-[10px] text-wellness flex items-center gap-1 font-bold">
                                                    <CheckCircle2 className="w-3 h-3" /> Selected from Inventory {item.sku ? `(${item.sku})` : ""}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-attention font-bold italic">Unlinked Medication</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Dosage *</Label>
                                <Input
                                    value={item.dosage}
                                    onChange={(e) => updateItem(index, "dosage", e.target.value)}
                                    placeholder="e.g., 500mg or 2 tablets"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Duration *</Label>
                                <Input
                                    value={item.duration}
                                    onChange={(e) => updateItem(index, "duration", e.target.value)}
                                    placeholder="e.g., 7 days"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Frequency *</Label>
                                <Input
                                    value={item.frequency}
                                    onChange={(e) => updateItem(index, "frequency", e.target.value)}
                                    placeholder="e.g., TDS (3 times/day)"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Timing</Label>
                                <Select
                                    value={item.timing}
                                    onValueChange={(val) => updateItem(index, "timing", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {TIMING_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Vehicle (Anupana)</Label>
                                <Select
                                    value={item.vehicle}
                                    onValueChange={(val) => updateItem(index, "vehicle", val)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VEHICLE_OPTIONS.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label>Special Notes / Pathya (Lifestyle)</Label>
                                <Input
                                    value={item.notes}
                                    onChange={(e) => updateItem(index, "notes", e.target.value)}
                                    placeholder="Additional instructions..."
                                />
                            </div>

                            {/* Video URL Section */}
                            <div className="md:col-span-4 border-t border-border/30 pt-3">
                                {!item.videoUrl ? (
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => updateItem(index, "videoUrl", " ")}
                                            className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
                                        >
                                            <Video className="w-4 h-4" />
                                            Add YouTube Video
                                        </Button>
                                        <span className="text-[10px] text-muted-foreground">
                                            Attach an exercise or medication guidance video for the patient
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="flex items-center gap-2 text-sm font-medium">
                                                <Video className="w-4 h-4 text-primary" />
                                                Video URL
                                                <span className="text-xs font-normal text-muted-foreground">(paste YouTube link)</span>
                                            </Label>
                                            <button
                                                type="button"
                                                onClick={() => updateItem(index, "videoUrl", "")}
                                                className="text-muted-foreground hover:text-destructive p-1 rounded"
                                                aria-label="Remove video"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <Input
                                            value={item.videoUrl.trim()}
                                            onChange={(e) => updateItem(index, "videoUrl", e.target.value)}
                                            onPaste={(e) => {
                                                // Auto-trim pasted content
                                                const pasted = e.clipboardData.getData('text').trim();
                                                if (pasted) {
                                                    e.preventDefault();
                                                    updateItem(index, "videoUrl", pasted);
                                                }
                                            }}
                                            placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                                            className={!isValidUrl(item.videoUrl.trim()) && item.videoUrl.trim() ? 'border-destructive' : ''}
                                            autoFocus
                                        />

                                        {/* Validation feedback */}
                                        {item.videoUrl.trim() && !isValidUrl(item.videoUrl.trim()) && (
                                            <p className="text-xs text-destructive">Please enter a valid URL starting with https://</p>
                                        )}

                                        {item.videoUrl.trim() && isValidUrl(item.videoUrl.trim()) && (
                                            <p className="text-xs text-primary/70 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Valid URL — patient will see an embedded video in their prescription
                                            </p>
                                        )}

                                        {/* YouTube preview thumbnail */}
                                        {(() => {
                                            const embedUrl = getYouTubeEmbedUrl(item.videoUrl.trim());
                                            if (!embedUrl) return null;
                                            const videoId = embedUrl.split('/embed/')[1];
                                            return (
                                                <div className="flex items-center gap-3 p-2 bg-background rounded-lg border">
                                                    <img
                                                        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                                                        alt="Video thumbnail"
                                                        className="w-24 h-14 object-cover rounded"
                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-medium truncate">YouTube Video</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">{item.videoUrl.trim()}</p>
                                                    </div>
                                                    <a
                                                        href={item.videoUrl.trim()}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-primary hover:text-primary/80 p-1"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            );
                                        })()}

                                        {/* Quick select from video library */}
                                        {videos.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Or select from library</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {videos.slice(0, 6).map(v => (
                                                        <Button
                                                            key={v.id}
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-auto py-1 px-2 text-[10px] border border-border/50"
                                                            onClick={() => updateItem(index, "videoUrl", v.videoUrl)}
                                                        >
                                                            <PlaySquare className="w-3 h-3 mr-1" />
                                                            {v.title}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={loading} className="min-w-[120px]">
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        "Issue Prescription"
                    )}
                </Button>
            </div>
        </form>
    );
}
