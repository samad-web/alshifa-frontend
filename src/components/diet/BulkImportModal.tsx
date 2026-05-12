import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, FileSpreadsheet, Loader2, Upload, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { BulkImportResult } from "@/types/ayurvedicFood";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ACCEPTED_TYPES = ".csv,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const SAMPLE_CSV =
  "name,nameInTamil,category,doshaEffectVata,doshaEffectPitta,doshaEffectKapha,rasa,guna,virya,seasons,calories,commonAllergies\n" +
  "Ashwagandha,அமுக்கரா,HERB,PACIFYING,NEUTRAL,PACIFYING,\"BITTER,ASTRINGENT\",\"HEAVY,OILY\",HOT,\"WINTER,AUTUMN\",350,\n" +
  "Ghee,நெய்,DAIRY,PACIFYING,PACIFYING,AGGRAVATING,SWEET,\"OILY,HEAVY\",NEUTRAL,\"WINTER,AUTUMN\",900,DAIRY\n";

/**
 * Drag-and-drop bulk-import modal for the AyurvedicFood catalogue. Accepts
 * .csv and .xlsx, uploads to POST /api/ayurvedic-foods/bulk-import, then
 * shows the row-level results returned by the backend.
 *
 * The sample template button serves an inline CSV via Blob — no extra
 * round-trip to the server, no separate static asset to deploy.
 */
export function BulkImportModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const importMutation = useMutation({
    mutationFn: async (picked: File) => {
      const fd = new FormData();
      fd.append("file", picked);
      const { data } = await apiClient.upload<BulkImportResult>("/api/ayurvedic-foods/bulk-import", fd);
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["ayurvedic-foods"] });
      qc.invalidateQueries({ queryKey: ["food-db-stats"] });
      if (data.imported > 0) {
        toast.success(
          `Imported ${data.imported} food${data.imported === 1 ? "" : "s"}` +
          (data.skipped > 0 ? `, ${data.skipped} skipped` : ""),
        );
      } else {
        toast.warning("No rows imported — review the errors below.");
      }
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    },
  });

  function pickFile(picked: File | undefined) {
    if (!picked) return;
    const okExt = /\.(csv|xlsx)$/i.test(picked.name);
    if (!okExt) {
      toast.error("Only .csv and .xlsx files are accepted");
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error("File too large. Max 10 MB.");
      return;
    }
    setFile(picked);
    setResult(null);
  }

  function handleClose() {
    if (importMutation.isPending) return;
    setFile(null);
    setResult(null);
    onClose();
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ayurvedic-foods-sample.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Bulk import foods
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or XLSX of Ayurvedic foods. Each row is validated independently — invalid rows are skipped and reported back.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Drop zone */}
          {!result && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border bg-secondary/5 hover:bg-secondary/10",
              )}
              role="button"
              aria-label="Drop a CSV or XLSX file here"
            >
              <Upload className="w-8 h-8 mx-auto text-primary/70" />
              <p className="text-sm font-medium mt-2">
                {file ? file.name : "Drop file here, or click to choose"}
              </p>
              <p className="text-[11px] text-muted-foreground">CSV or XLSX · max 10 MB</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? undefined)}
              />
            </div>
          )}

          {/* Selected-file row */}
          {file && !result && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                disabled={importMutation.isPending}
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Sample template + column hint */}
          {!result && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Need a template?</p>
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={downloadSample}>
                  Download sample CSV
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Required columns: <span className="font-mono">name</span>, <span className="font-mono">category</span>.
                Optional: <span className="font-mono">nameInTamil</span>, <span className="font-mono">doshaEffectVata|Pitta|Kapha</span>,
                <span className="font-mono"> rasa</span>, <span className="font-mono">guna</span>, <span className="font-mono">virya</span>,
                <span className="font-mono"> seasons</span>, <span className="font-mono">calories</span>,
                <span className="font-mono"> protein|carbs|fat|fiber</span>, <span className="font-mono">commonAllergies</span>.
                Multi-value cells use comma or semicolon.
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <Alert className="border-emerald-300 bg-emerald-50/50">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <AlertTitle>Import complete</AlertTitle>
                <AlertDescription className="text-sm">
                  <span className="font-semibold">{result.imported}</span> imported
                  {" · "}
                  <span className="font-semibold">{result.skipped}</span> skipped
                </AlertDescription>
              </Alert>

              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="font-semibold">Skipped rows ({result.errors.length})</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto rounded-lg border bg-card">
                    <ul className="divide-y text-xs">
                      {result.errors.map((e, i) => (
                        <li key={i} className="px-3 py-1.5 flex items-baseline gap-2">
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            row {e.row}
                          </Badge>
                          <span className="text-rose-700 truncate">{e.error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={importMutation.isPending}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              onClick={() => file && importMutation.mutate(file)}
              disabled={!file || importMutation.isPending}
            >
              {importMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import
            </Button>
          )}
          {result && result.errors.length > 0 && (
            <Button
              variant="outline"
              onClick={() => { setFile(null); setResult(null); if (inputRef.current) inputRef.current.value = ""; }}
            >
              Import another file
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
