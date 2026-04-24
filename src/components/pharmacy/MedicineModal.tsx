
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Youtube, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

// Mirror of the backend's `extractYouTubeId` so we can preview the
// thumbnail + show inline validation without a round-trip.
function extractYouTubeId(raw: string | null | undefined): string | null {
    if (!raw || !raw.trim()) return null;
    try {
        const u = new URL(raw.trim());
        const host = u.hostname.replace(/^www\./, '');
        let id: string | null = null;
        if (host === 'youtu.be') {
            id = u.pathname.slice(1).split(/[/?&]/)[0] ?? null;
        } else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
            if (u.pathname === '/watch') id = u.searchParams.get('v');
            else if (u.pathname.startsWith('/embed/'))  id = u.pathname.split('/embed/')[1]?.split(/[/?&]/)[0] ?? null;
            else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/shorts/')[1]?.split(/[/?&]/)[0] ?? null;
            else if (u.pathname.startsWith('/v/'))      id = u.pathname.split('/v/')[1]?.split(/[/?&]/)[0] ?? null;
        }
        return id && /^[\w-]{11}$/.test(id) ? id : null;
    } catch { return null; }
}

const medicineSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    sku: z.string().min(1, 'SKU is required'),
    category: z.string().min(1, 'Category is required'),
    type: z.string().min(1, 'Type is required'),
    brand: z.string().optional(),
    stock: z.string().transform(v => parseInt(v) || 0).or(z.number()),
    price: z.string().transform(v => parseFloat(v) || 0).or(z.number()),
    // Server-side validates the URL is YouTube; here we just allow empty
    // or any URL string and surface a soft warning in the UI.
    videoUrl: z.string().optional().refine(
        (v) => !v || extractYouTubeId(v) !== null,
        { message: 'Must be a YouTube URL (youtube.com/watch?v=…, youtu.be/…)' },
    ),
});

interface MedicineModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    medicine?: any;
}

export function MedicineModal({ isOpen, onClose, onSuccess, medicine }: MedicineModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof medicineSchema>>({
        resolver: zodResolver(medicineSchema),
        defaultValues: {
            name: "", sku: "", category: "", type: "", brand: "", stock: 0, price: 0, videoUrl: "",
        },
    });

    useEffect(() => {
        if (!isOpen) return;
        form.reset({
            name: medicine?.name ?? "",
            sku: medicine?.sku ?? "",
            category: medicine?.category ?? "",
            type: medicine?.type ?? "",
            brand: medicine?.brand ?? "",
            stock: medicine?.totalStock ?? 0,
            price: medicine?.price ?? 0,
            videoUrl: medicine?.videoUrl ?? "",
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, medicine?.id]);

    const watchedVideoUrl = form.watch("videoUrl");
    const previewYoutubeId = extractYouTubeId(watchedVideoUrl);

    const onSubmit = async (values: z.infer<typeof medicineSchema>) => {
        setIsSubmitting(true);
        try {
            if (medicine) {
                await apiClient.put(`/api/pharmacy/medicines/${medicine.id}`, values);
            } else {
                await apiClient.post('/api/pharmacy/medicines', values);
            }
            toast.success(`Medicine ${medicine ? "updated" : "added"} successfully`);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error?.message || `Failed to ${medicine ? "update" : "add"} medicine`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{medicine ? "Edit Medicine" : "Add New Medicine"}</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Medicine Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Ashwagandha" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="sku"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>SKU</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. AYU-001" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Ayurvedic" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Type</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Tablet" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="brand"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Brand (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Al-Shifa" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="stock"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Initial Stock</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Price (INR)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* YouTube instructional video — optional. Doctors and
                            pharmacists can attach a YouTube link explaining how
                            to take the medicine, side-effect warnings, etc.
                            Patients see this on their prescription card. */}
                        <FormField
                            control={form.control}
                            name="videoUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-1.5">
                                        <Youtube className="w-4 h-4 text-red-600" />
                                        YouTube Instructional Video <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="https://youtu.be/… or https://www.youtube.com/watch?v=…"
                                            {...field}
                                            value={field.value ?? ""}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    {previewYoutubeId && (
                                        <a
                                            href={`https://youtu.be/${previewYoutubeId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-2 flex items-center gap-3 p-2 rounded-md border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                                        >
                                            <img
                                                src={`https://img.youtube.com/vi/${previewYoutubeId}/mqdefault.jpg`}
                                                alt="YouTube preview"
                                                className="w-24 h-14 rounded object-cover"
                                                loading="lazy"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium">Preview</p>
                                                <p className="text-[10px] text-muted-foreground truncate">{previewYoutubeId}</p>
                                            </div>
                                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                        </a>
                                    )}
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {medicine ? "Update Medicine" : "Register Medicine"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
