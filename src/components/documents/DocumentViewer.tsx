import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, Image, ZoomIn, ZoomOut, RotateCw, ExternalLink } from "lucide-react";

interface DocumentViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fileUrl: string;
    fileName: string;
    fileType?: string;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
const PDF_EXTENSIONS = ['pdf'];

function getFileExtension(url: string, fileType?: string): string {
    if (fileType) return fileType.toLowerCase();
    const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
    return ext || '';
}

export function DocumentViewer({ open, onOpenChange, fileUrl, fileName, fileType }: DocumentViewerProps) {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [imageError, setImageError] = useState(false);

    const ext = getFileExtension(fileUrl, fileType);
    const isImage = IMAGE_EXTENSIONS.includes(ext);
    const isPdf = PDF_EXTENSIONS.includes(ext);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetView = () => {
        setZoom(1);
        setRotation(0);
        setImageError(false);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetView(); onOpenChange(v); }}>
            <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
                {/* Header */}
                <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        {isImage ? <Image className="w-4 h-4 text-primary shrink-0" /> : <FileText className="w-4 h-4 text-primary shrink-0" />}
                        <DialogTitle className="text-sm font-bold truncate">{fileName}</DialogTitle>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {isImage && (
                            <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom out">
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <span className="text-xs font-mono text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom in">
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRotate} title="Rotate">
                                    <RotateCw className="h-4 w-4" />
                                </Button>
                                <div className="w-px h-5 bg-border mx-1" />
                            </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Download">
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(fileUrl, '_blank')} title="Open in new tab">
                            <ExternalLink className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-secondary/10 flex items-center justify-center">
                    {isImage && !imageError ? (
                        <div className="overflow-auto w-full h-full flex items-center justify-center p-4">
                            <img
                                src={fileUrl}
                                alt={fileName}
                                className="max-w-none transition-transform duration-200"
                                style={{
                                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                }}
                                onError={() => setImageError(true)}
                                draggable={false}
                            />
                        </div>
                    ) : isPdf ? (
                        <iframe
                            src={`${fileUrl}#toolbar=1&navpanes=0`}
                            className="w-full h-full border-0"
                            title={fileName}
                        />
                    ) : (
                        /* Unsupported file type - show download prompt */
                        <div className="flex flex-col items-center gap-4 p-8 text-center">
                            <div className="p-4 rounded-full bg-secondary/30">
                                <FileText className="w-12 h-12 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-bold text-foreground">{fileName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {imageError
                                        ? "Failed to load image preview."
                                        : `Preview is not available for .${ext || 'unknown'} files.`}
                                </p>
                            </div>
                            <Button onClick={handleDownload} className="gap-2">
                                <Download className="w-4 h-4" />
                                Download File
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
