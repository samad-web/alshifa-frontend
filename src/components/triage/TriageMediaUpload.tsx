import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface TriageMediaFile {
  file: File;
  type: "photo" | "video";
  previewUrl: string;
  caption?: string;
}

interface TriageMediaUploadProps {
  isRequired: boolean;
  onFilesChange: (files: TriageMediaFile[]) => void;
}

const MAX_FILES = 5;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;  // 100 MB
const VIDEO_DURATION_WARN_SECS = 60;

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime";

function isImage(file: File) { return file.type.startsWith("image/"); }
function isVideo(file: File) { return file.type.startsWith("video/"); }

/**
 * Patient-side media uploader for the triage wizard.
 * - Required when the patient logged Swelling — banner + parent disables submit.
 * - Up to 5 files; photos ≤10 MB, videos ≤100 MB. Videos > 60s get a warn toast
 *   but are still accepted (clinician can decide).
 *
 * State is owned here. Parent receives the live list via onFilesChange and
 * drives whatever submit-time orchestration it needs (loop + POST per file).
 */
export function TriageMediaUpload({ isRequired, onFilesChange }: TriageMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<TriageMediaFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Push the latest list up to the parent on every change.
  useEffect(() => {
    onFilesChange(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => {
      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdd(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    const next: TriageMediaFile[] = [...files];
    Array.from(picked).forEach((file) => {
      if (next.length >= MAX_FILES) return;
      if (!isImage(file) && !isVideo(file)) {
        toast.error("Only images and videos are supported");
        return;
      }
      const tooBig =
        (isImage(file) && file.size > MAX_PHOTO_BYTES) ||
        (isVideo(file) && file.size > MAX_VIDEO_BYTES);
      if (tooBig) {
        toast.error("File too large. Max 10MB for photos, 100MB for videos.");
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      const entry: TriageMediaFile = {
        file,
        type: isVideo(file) ? "video" : "photo",
        previewUrl,
        caption: "",
      };
      // Lazy duration check on videos — toast only, doesn't block.
      if (isVideo(file)) {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.onloadedmetadata = () => {
          if (probe.duration > VIDEO_DURATION_WARN_SECS) {
            toast.warning(`"${file.name}" is ${Math.round(probe.duration)}s — keep videos under ${VIDEO_DURATION_WARN_SECS}s when possible.`);
          }
          URL.revokeObjectURL(probe.src);
        };
        probe.src = previewUrl;
      }
      next.push(entry);
    });
    if (next.length === files.length) return; // nothing accepted
    setFiles(next);
    if (next.length >= MAX_FILES) {
      toast.message(`Reached the ${MAX_FILES}-file limit.`);
    }
  }

  function remove(idx: number) {
    setFiles((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function updateCaption(idx: number, caption: string) {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, caption } : f)));
  }

  return (
    <div className="space-y-3">
      {isRequired && files.length === 0 && (
        <Alert variant="destructive" className="border-rose-300 bg-rose-50 text-rose-900">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Photo or video is required because swelling was reported. Please upload at least one image or video of the affected area.
          </AlertDescription>
        </Alert>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleAdd(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "rounded-2xl border-2 border-dashed cursor-pointer transition-colors",
          "p-6 flex flex-col items-center text-center gap-1",
          dragActive ? "border-primary bg-primary/5" : "border-border/60 bg-secondary/5 hover:bg-secondary/10",
        )}
        role="button"
        aria-label="Upload photos or videos"
      >
        <Camera className="w-8 h-8 text-primary/70" />
        <p className="text-sm font-medium">Upload photos or videos</p>
        <p className="text-[11px] text-muted-foreground">
          Photos: JPG, PNG, WEBP · Videos: MP4, MOV (max 60s) · Up to {MAX_FILES} files
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          capture="environment"
          className="hidden"
          onChange={(e) => handleAdd(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {files.map((f, idx) => (
            <div key={idx} className="rounded-xl border bg-card overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-muted">
                {f.type === "photo" ? (
                  <img src={f.previewUrl} alt={f.file.name} className="w-full h-full object-cover" />
                ) : (
                  <video src={f.previewUrl} controls className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(idx); }}
                  aria-label="Remove file"
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                  {f.type.toUpperCase()}
                </span>
              </div>
              <div className="p-2 space-y-1">
                <Input
                  value={f.caption ?? ""}
                  onChange={(e) => updateCaption(idx, e.target.value)}
                  placeholder="Caption (optional)"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
