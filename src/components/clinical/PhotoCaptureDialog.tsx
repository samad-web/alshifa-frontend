import { useCallback, useEffect, useRef, useState } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCcw, UploadCloud, X, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoCaptureDialogProps {
    open: boolean;
    onOpenChange: (next: boolean) => void;
    /**
     * Called once the patient confirms a photo (either captured from the
     * camera or chosen from disk). The component closes automatically — the
     * parent handles the actual upload and any toast.
     */
    onConfirm: (file: File) => void | Promise<void>;
    title?: string;
    description?: string;
    /**
     * Whether to prefer the rear camera ("environment") or the front camera
     * ("user"). Tongue / mouth shots want the front; physical observation
     * (posture, knees) wants the rear. Defaults to "environment".
     */
    facingMode?: "user" | "environment";
}

type Mode = "menu" | "camera" | "preview";

/**
 * Modal that asks the patient to either turn on the camera and snap a photo,
 * or pick an existing image from disk. Designed for self-exam observations
 * where a candid camera capture is preferable to digging through Files but
 * must remain available on devices without a working camera (desktop, kiosk).
 *
 * The camera path uses `navigator.mediaDevices.getUserMedia` and renders a
 * live <video> preview. Capture writes a frame to <canvas>, converts to a
 * JPEG File, and surfaces a Retake / Use Photo confirmation step. The stream
 * is torn down on every state change so we never leave the camera light on.
 */
export function PhotoCaptureDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Add photo",
    description = "Take a fresh picture or upload one from your device.",
    facingMode = "environment",
}: PhotoCaptureDialogProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const [mode, setMode] = useState<Mode>("menu");
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    const reset = useCallback(() => {
        stopStream();
        setMode("menu");
        setError(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPreviewFile(null);
        setBusy(false);
    }, [previewUrl, stopStream]);

    // When the dialog is closed (via the X, ESC, or backdrop), make sure we
    // tear down the stream and reset state. Otherwise reopening would still
    // hold the camera or still show the previous preview.
    useEffect(() => {
        if (!open) reset();
        return () => stopStream();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const startCamera = useCallback(async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setError(
                "Your browser doesn't support live camera capture. Please upload a photo from your device instead.",
            );
            return;
        }
        setError(null);
        setBusy(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: facingMode } },
                audio: false,
            });
            streamRef.current = stream;
            setMode("camera");
            // Wait for the next tick so the <video> element is mounted.
            queueMicrotask(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().catch(() => { /* autoplay block — user can tap */ });
                }
            });
        } catch (err) {
            const name = (err as { name?: string })?.name;
            if (name === "NotAllowedError" || name === "PermissionDeniedError") {
                setError("Camera permission denied. Allow camera access in your browser to take a photo.");
            } else if (name === "NotFoundError" || name === "OverconstrainedError") {
                setError("No camera found on this device. Please upload a photo instead.");
            } else if (name === "NotReadableError") {
                setError("Your camera is being used by another app. Close it and try again.");
            } else {
                setError("Couldn't access the camera. Please upload a photo instead.");
            }
        } finally {
            setBusy(false);
        }
    }, [facingMode]);

    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    setError("Couldn't capture the frame. Please try again.");
                    return;
                }
                const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                const url = URL.createObjectURL(blob);
                setPreviewFile(file);
                setPreviewUrl(url);
                stopStream();
                setMode("preview");
            },
            "image/jpeg",
            0.9,
        );
    }, [previewUrl, stopStream]);

    const onFilePicked = (file: File) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(file);
        setPreviewFile(file);
        setPreviewUrl(url);
        setMode("preview");
    };

    const handleConfirm = async () => {
        if (!previewFile) return;
        setBusy(true);
        try {
            await onConfirm(previewFile);
            onOpenChange(false);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {mode === "menu" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
                        <Button
                            type="button"
                            variant="default"
                            className="h-24 flex-col gap-2"
                            onClick={startCamera}
                            disabled={busy}
                        >
                            {busy
                                ? <Loader2 className="h-6 w-6 animate-spin" />
                                : <Camera className="h-6 w-6" />}
                            <span className="text-sm font-semibold">Use camera</span>
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-24 flex-col gap-2"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={busy}
                        >
                            <UploadCloud className="h-6 w-6" />
                            <span className="text-sm font-semibold">Upload photo</span>
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                // Reset the input so picking the same file twice still fires onChange.
                                e.target.value = "";
                                if (f) onFilePicked(f);
                            }}
                        />
                    </div>
                )}

                {mode === "camera" && (
                    <div className="space-y-3">
                        <div className="relative rounded-xl overflow-hidden border bg-black aspect-[4/3]">
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className={cn(
                                    "w-full h-full object-cover",
                                    // Mirror the front camera so the preview feels natural — rear
                                    // camera shouldn't be mirrored.
                                    facingMode === "user" && "scale-x-[-1]",
                                )}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={() => { stopStream(); setMode("menu"); }}>
                                <X className="h-4 w-4 mr-1" /> Back
                            </Button>
                            <Button type="button" onClick={captureFrame}>
                                <Camera className="h-4 w-4 mr-1" /> Capture
                            </Button>
                        </div>
                    </div>
                )}

                {mode === "preview" && previewUrl && (
                    <div className="space-y-3">
                        <div className="rounded-xl overflow-hidden border bg-muted/40 aspect-[4/3] flex items-center justify-center">
                            { /* eslint-disable-next-line @next/next/no-img-element */ }
                            <img src={previewUrl} alt="Captured photo preview" className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                                    setPreviewUrl(null);
                                    setPreviewFile(null);
                                    setMode("menu");
                                }}
                                disabled={busy}
                            >
                                <RefreshCcw className="h-4 w-4 mr-1" /> Retake
                            </Button>
                            <Button type="button" onClick={handleConfirm} disabled={busy}>
                                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                                Use this photo
                            </Button>
                        </div>
                    </div>
                )}

                <DialogFooter className="hidden sm:hidden" />
            </DialogContent>
        </Dialog>
    );
}
