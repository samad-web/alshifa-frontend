import { useRef, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Upload, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type PreviewRow = {
    row: number;
    data: Record<string, string>;
    resolvedBranchId: string | null;
    errors: string[];
    warnings: string[];
};

type PreviewResult = {
    total: number;
    valid: number;
    invalid: number;
    rows: PreviewRow[];
    meta?: {
        separator: string;
        detectedHeaders: string[];
        sampleRow: Record<string, string> | null;
        unmappedHeaders: string[];
    };
};

type ImportSummary = {
    created: number;
    updated: number;
    stockCreated: number;
    stockUpdated: number;
    failed: Array<{ row: number; error: string }>;
};

interface MedicineImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function MedicineImportModal({ isOpen, onClose, onSuccess }: MedicineImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [uploading, setUploading] = useState(false);
    const [importing, setImporting] = useState(false);

    const reset = () => {
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleClose = () => {
        if (uploading || importing) return;
        reset();
        onClose();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setPreview(null);

        const fd = new FormData();
        fd.append("file", f);
        setUploading(true);
        try {
            const { data } = await apiClient.upload<{ success: boolean } & PreviewResult>(
                "/api/pharmacy/medicines/bulk-upload",
                fd
            );
            setPreview({
                total: data.total,
                valid: data.valid,
                invalid: data.invalid,
                rows: data.rows,
                meta: (data as any).meta,
            });
        } catch (err: any) {
            toast.error(err?.message || "Failed to parse CSV");
            reset();
        } finally {
            setUploading(false);
        }
    };

    const handleImport = async () => {
        if (!preview || preview.valid === 0) return;
        setImporting(true);
        try {
            const rows = preview.rows.filter((r) => r.errors.length === 0).map((r) => r.data);
            const { data } = await apiClient.post<{ success: boolean; summary: ImportSummary }>(
                "/api/pharmacy/medicines/bulk-import",
                { rows }
            );
            const s = data.summary;
            toast.success(
                `Imported — ${s.created} new, ${s.updated} updated, ${s.stockCreated + s.stockUpdated} stock rows`
            );
            if (s.failed.length > 0) {
                toast.warning(`${s.failed.length} row(s) failed during import`);
            }
            onSuccess();
            reset();
            onClose();
        } catch (err: any) {
            toast.error(err?.message || "Import failed");
        } finally {
            setImporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Medicines from CSV</DialogTitle>
                </DialogHeader>

                {!preview && (
                    <div className="flex flex-col gap-4 py-6">
                        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
                            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Upload a CSV with columns: <strong>S.No, Store, PCode, Hsn, Name,
                                    Pharmacological Name, Mfr, Category, Risk Level, Batch, Tray, Expiry,
                                    Purchase Price, MRP, Max Sales Dis(%), Tax, Qty, PUnit, Qty / Pur Unit</strong>.
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                            <Button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="gap-2"
                            >
                                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {uploading ? "Parsing..." : "Choose CSV file"}
                            </Button>
                            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Rows with matching SKU or Name + Manufacturer will update the existing medicine;
                            others are created. Stock is keyed on Batch + Store — re-uploading the same batch
                            overwrites its quantity.
                        </p>
                    </div>
                )}

                {preview && (
                    <>
                        {preview.meta && preview.invalid === preview.total && preview.total > 0 && (
                            <div className="rounded-lg border border-risk/40 bg-risk/5 p-3 text-xs space-y-2 mt-2">
                                <p className="font-semibold text-risk">All rows failed — parser diagnostic:</p>
                                <p>Separator detected: <code className="bg-background px-1 rounded">{JSON.stringify(preview.meta.separator)}</code></p>
                                <p>Headers detected ({preview.meta.detectedHeaders.length}):</p>
                                <code className="block bg-background p-2 rounded break-all">
                                    {preview.meta.detectedHeaders.map(h => JSON.stringify(h)).join(' · ')}
                                </code>
                                {preview.meta.unmappedHeaders.length > 0 && (
                                    <p className="text-yellow-700">
                                        Unmapped columns: {preview.meta.unmappedHeaders.join(', ')}
                                    </p>
                                )}
                                {preview.meta.sampleRow && (
                                    <>
                                        <p>First raw row:</p>
                                        <code className="block bg-background p-2 rounded break-all">
                                            {JSON.stringify(preview.meta.sampleRow)}
                                        </code>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 pt-2">
                            <div className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground">Total rows</p>
                                <p className="text-2xl font-bold">{preview.total}</p>
                            </div>
                            <div className="rounded-lg border p-3 border-green-500/30">
                                <p className="text-xs text-green-700 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Ready
                                </p>
                                <p className="text-2xl font-bold text-green-700">{preview.valid}</p>
                            </div>
                            <div className="rounded-lg border p-3 border-risk/30">
                                <p className="text-xs text-risk flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Invalid
                                </p>
                                <p className="text-2xl font-bold text-risk">{preview.invalid}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto border rounded-lg mt-4">
                            <table className="w-full text-xs">
                                <thead className="bg-muted sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left">#</th>
                                        <th className="p-2 text-left">Name</th>
                                        <th className="p-2 text-left">SKU</th>
                                        <th className="p-2 text-left">Batch</th>
                                        <th className="p-2 text-right">Qty</th>
                                        <th className="p-2 text-right">MRP</th>
                                        <th className="p-2 text-left">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.rows.map((r) => (
                                        <tr
                                            key={r.row}
                                            className={
                                                r.errors.length > 0
                                                    ? "bg-risk/5 border-b"
                                                    : r.warnings.length > 0
                                                        ? "bg-yellow-50 border-b"
                                                        : "border-b"
                                            }
                                        >
                                            <td className="p-2">{r.row}</td>
                                            <td className="p-2">{r.data.name || "—"}</td>
                                            <td className="p-2 font-mono">{r.data.pcode || "—"}</td>
                                            <td className="p-2 font-mono">{r.data.batch || "—"}</td>
                                            <td className="p-2 text-right">{r.data.qty || "—"}</td>
                                            <td className="p-2 text-right">{r.data.mrp || "—"}</td>
                                            <td className="p-2">
                                                {r.errors.length > 0 && (
                                                    <span className="text-risk text-[10px]">
                                                        {r.errors.join(", ")}
                                                    </span>
                                                )}
                                                {r.errors.length === 0 && r.warnings.length > 0 && (
                                                    <span className="text-yellow-700 text-[10px]">
                                                        {r.warnings.join(", ")}
                                                    </span>
                                                )}
                                                {r.errors.length === 0 && r.warnings.length === 0 && (
                                                    <span className="text-green-600 text-[10px]">OK</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={uploading || importing}>
                        Cancel
                    </Button>
                    {preview && (
                        <>
                            <Button type="button" variant="outline" onClick={reset} disabled={importing}>
                                Choose different file
                            </Button>
                            <Button
                                type="button"
                                onClick={handleImport}
                                disabled={importing || preview.valid === 0}
                            >
                                {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Import {preview.valid} row{preview.valid === 1 ? "" : "s"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
