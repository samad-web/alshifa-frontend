import { useState } from "react";
import { FileText, Image, File, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentViewer } from "./DocumentViewer";
import { cn } from "@/lib/utils";

interface DocumentCardProps {
    fileUrl: string;
    fileName: string;
    fileType?: string;
    uploadedAt?: string;
    category?: string;
    className?: string;
}

const PREVIEW_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'svg'];

function getIcon(ext: string) {
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return Image;
    if (ext === 'pdf') return FileText;
    return File;
}

export function DocumentCard({ fileUrl, fileName, fileType, uploadedAt, category, className }: DocumentCardProps) {
    const [viewerOpen, setViewerOpen] = useState(false);

    const ext = (fileType || fileName.split('.').pop() || '').toLowerCase();
    const Icon = getIcon(ext);
    const canPreview = PREVIEW_EXTENSIONS.includes(ext);

    return (
        <>
            <div className={cn(
                "group flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-secondary/10 transition-colors",
                className
            )}>
                <div className="p-2 rounded-lg bg-primary/5 shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate text-foreground">{fileName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        {category && <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">{category}</span>}
                        {uploadedAt && <span className="text-[9px] text-muted-foreground">{new Date(uploadedAt).toLocaleDateString()}</span>}
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canPreview && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewerOpen(true)} title="Preview">
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer" title="Download">
                            <Download className="h-3.5 w-3.5" />
                        </a>
                    </Button>
                </div>
            </div>

            <DocumentViewer
                open={viewerOpen}
                onOpenChange={setViewerOpen}
                fileUrl={fileUrl}
                fileName={fileName}
                fileType={ext}
            />
        </>
    );
}
