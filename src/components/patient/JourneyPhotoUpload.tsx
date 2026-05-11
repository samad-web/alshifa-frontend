import { useRef, useState } from "react";
import { Camera, Loader2, Upload, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";

interface JourneyPhotoUploadProps {
  open: boolean;
  onClose: () => void;
  /** Patient.id — backend keys ClinicalPhoto on Patient.id, not User.id. */
  patientId: string;
  /** Journey/phase context. Required for journey-progress uploads (the
   *  patient flow this component was built for); optional for the
   *  Phase B1 therapy-session capture, which has no journey context. */
  journeyId?: string;
  phaseId?: string;
  phaseName?: string;
  /** Phase B1 — when provided, the upload is tagged to this in-progress
   *  TherapySession. The backend validates ownership + status before
   *  accepting the FK. */
  therapySessionId?: string;
  /** Title shown in the dialog. Defaults to the journey-progress phrasing
   *  when phaseName is provided, else a generic clinician phrasing. */
  titleOverride?: string;
  /** Hides the standard journey copy in favour of session-context copy. */
  descriptionOverride?: string;
  onUploaded?: () => void;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function JourneyPhotoUpload({
  open, onClose, patientId, journeyId, phaseId, phaseName,
  therapySessionId, titleOverride, descriptionOverride, onUploaded,
}: JourneyPhotoUploadProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  function handleFile(picked: File | undefined) {
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast({ title: "Only images are supported", variant: "destructive" });
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast({ title: "Image too large", description: "Max size is 10 MB.", variant: "destructive" });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setNotes("");
  }

  function handleClose() {
    if (uploading) return;
    reset();
    onClose();
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", patientId);
      // Journey/phase fields are only appended when provided — Phase B1's
      // session-context upload doesn't have journey/phase scope, and
      // sending empty strings would fail the backend Zod string check.
      if (journeyId) formData.append("journeyId", journeyId);
      if (phaseId) formData.append("phaseId", phaseId);
      if (therapySessionId) formData.append("therapySessionId", therapySessionId);
      // Patient uploads are forced to GENERAL_PROGRESS / DURING by the backend.
      // Sending them anyway keeps the multipart payload self-describing.
      formData.append("category", "GENERAL_PROGRESS");
      formData.append("stage", "DURING");
      if (notes.trim()) formData.append("notes", notes.trim());

      await apiClient.upload("/api/clinical-photos", formData);
      toast({
        title: "Photo uploaded",
        description: "Your doctor can now see your latest progress.",
      });
      reset();
      onClose();
      onUploaded?.();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {titleOverride ?? (phaseName
              ? `Upload Progress Photo — ${phaseName}`
              : "Capture Photo")}
          </DialogTitle>
          <DialogDescription>
            {descriptionOverride ?? "Doctor reviews these to monitor your recovery. Stays linked to your current phase."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tap-to-upload zone (drag & drop intentionally skipped on patient
              mobile-first surface — most uploads come from the camera roll). */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-2xl border-2 border-dashed border-border/60 bg-secondary/5 hover:bg-secondary/10 transition-colors p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground"
          >
            {previewUrl ? (
              <div className="relative w-full">
                <img src={previewUrl} alt="Selected progress" className="rounded-xl max-h-64 mx-auto object-contain" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); reset(); }}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                  aria-label="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Camera className="w-10 h-10 text-primary/60" />
                <p className="text-sm font-medium">Tap to choose a photo</p>
                <p className="text-[11px]">JPG, PNG, WEBP · Max 10 MB</p>
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe any changes you've noticed."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={uploading}>Cancel</Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
