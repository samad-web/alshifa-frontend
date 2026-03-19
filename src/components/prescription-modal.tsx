import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUp, Loader2, Video, X } from "lucide-react";
import { toast } from "sonner";

interface PrescriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
    patientName?: string;
    onSuccess?: () => void;
}

export function PrescriptionModal({
    isOpen,
    onClose,
    patientId,
    patientName,
    onSuccess,
}: PrescriptionModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        medicationName: "",
        dosage: "",
        frequency: "",
        duration: "",
        notes: "",
        videoUrl: "",
    });
    const [file, setFile] = useState<File | null>(null);
    const [showVideoUrl, setShowVideoUrl] = useState(false);
    const [videoUrlError, setVideoUrlError] = useState<string | null>(null);

    const validateVideoUrl = (url: string): boolean => {
        if (!url) return true; // optional field
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                setVideoUrlError('URL must start with http:// or https://');
                return false;
            }
            setVideoUrlError(null);
            return true;
        } catch {
            setVideoUrlError('Please enter a valid URL (e.g., https://youtube.com/watch?v=...)');
            return false;
        }
    };

    const handleVideoUrlChange = (value: string) => {
        setFormData((prev) => ({ ...prev, videoUrl: value }));
        if (value) validateVideoUrl(value);
        else setVideoUrlError(null);
    };

    const handleRemoveVideoUrl = () => {
        setShowVideoUrl(false);
        setFormData((prev) => ({ ...prev, videoUrl: '' }));
        setVideoUrlError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Client-side URL validation before submit
        if (formData.videoUrl && !validateVideoUrl(formData.videoUrl)) {
            setLoading(false);
            return;
        }

        try {
            const formDataToSend = new FormData();
            formDataToSend.append("patientId", patientId);
            formDataToSend.append("medicationName", formData.medicationName);
            formDataToSend.append("dosage", formData.dosage);
            formDataToSend.append("frequency", formData.frequency);
            formDataToSend.append("duration", formData.duration);
            formDataToSend.append("notes", formData.notes);
            // Only append videoUrl when the field is visible and has a value
            if (showVideoUrl && formData.videoUrl.trim()) {
                formDataToSend.append("videoUrl", formData.videoUrl.trim());
            }
            if (file) {
                formDataToSend.append("file", file);
            }

            await apiClient.upload(`/api/prescriptions/add`, formDataToSend);
            toast.success("Prescription added successfully");
            setFormData({
                medicationName: "",
                dosage: "",
                frequency: "",
                duration: "",
                notes: "",
                videoUrl: "",
            });
            setFile(null);
            setShowVideoUrl(false);
            setVideoUrlError(null);
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error(error?.message || "Failed to add prescription");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Prescription</DialogTitle>
                    {patientName && (
                        <p className="text-sm text-muted-foreground">For patient: {patientName}</p>
                    )}
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="medicationName">Medication Name *</Label>
                            <Input
                                id="medicationName"
                                value={formData.medicationName}
                                onChange={(e) =>
                                    setFormData({ ...formData, medicationName: e.target.value })
                                }
                                required
                                placeholder="e.g., Amoxicillin"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dosage">Dosage *</Label>
                            <Input
                                id="dosage"
                                value={formData.dosage}
                                onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                                required
                                placeholder="e.g., 500mg"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="frequency">Frequency *</Label>
                            <Input
                                id="frequency"
                                value={formData.frequency}
                                onChange={(e) =>
                                    setFormData({ ...formData, frequency: e.target.value })
                                }
                                required
                                placeholder="e.g., 3 times a day"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="duration">Duration *</Label>
                            <Input
                                id="duration"
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                required
                                placeholder="e.g., 7 days"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional instructions or notes"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="file">Prescription File (PDF/Image)</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="file"
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="flex-1"
                            />
                            {file && (
                                <span className="text-sm text-muted-foreground">
                                    {file.name}
                                </span>
                            )}
                        </div>
                        {file && (
                            <div className="flex items-center gap-2 text-sm text-primary">
                                <FileUp className="w-4 h-4" />
                                <span>File selected: {file.name}</span>
                            </div>
                        )}
                    </div>

                    {/* Video URL — revealed on demand */}
                    {!showVideoUrl ? (
                        <div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowVideoUrl(true)}
                                className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
                            >
                                <Video className="w-4 h-4" />
                                Add Video URL
                            </Button>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Optionally attach an exercise guidance or medication explanation video.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="videoUrl" className="flex items-center gap-2">
                                    <Video className="w-4 h-4 text-primary" />
                                    Video URL
                                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                                </Label>
                                <button
                                    type="button"
                                    onClick={handleRemoveVideoUrl}
                                    className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                                    aria-label="Remove video URL"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <Input
                                id="videoUrl"
                                type="url"
                                value={formData.videoUrl}
                                onChange={(e) => handleVideoUrlChange(e.target.value)}
                                placeholder="https://youtube.com/watch?v=... or any video link"
                                className={videoUrlError ? 'border-destructive focus-visible:ring-destructive' : ''}
                                autoFocus
                            />
                            {videoUrlError && (
                                <p className="text-xs text-destructive">{videoUrlError}</p>
                            )}
                            {formData.videoUrl && !videoUrlError && (
                                <p className="text-xs text-primary/70">
                                    ✓ Valid URL — the patient will see an embedded video in their prescription.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 justify-end pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                "Add Prescription"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
