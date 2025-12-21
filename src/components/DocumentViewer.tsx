import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, FileText, Download, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UploadedFile } from '@/types';

interface DocumentViewerProps {
  file: UploadedFile;
  activeHighlight: string | null;
}

export function DocumentViewer({ file, activeHighlight }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.preview;
    link.download = file.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isHeicFile = () => {
    const fileName = file.file.name.toLowerCase();
    return fileName.endsWith('.heic') || fileName.endsWith('.heif');
  };

  const renderPreview = () => {
    // For images
    if (file.type === 'image') {
      // If HEIC file and we haven't loaded it yet, show conversion message
      if (isHeicFile() && !imageLoaded && !imageError) {
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-light mb-4">
              <ImageIcon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">HEIC Image</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Preview may not display in some browsers, but your file is uploaded and will be analyzed.
            </p>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download Original
            </Button>
            {/* Still try to load the image */}
            <img
              src={file.preview}
              alt="Uploaded document"
              className="hidden"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </div>
        );
      }

      // If there was an error loading the image
      if (imageError) {
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-warning/10 mb-4">
              <AlertCircle className="h-8 w-8 text-warning" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Preview Unavailable</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Your file is still uploaded and will be analyzed.
            </p>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download Original File
            </Button>
          </div>
        );
      }

      // Normal image display
      return (
        <img
          src={file.preview}
          alt="Uploaded document"
          className="max-w-full h-auto rounded-lg shadow-card object-contain"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          style={{
            maxHeight: 'calc(100vh - 200px)',
          }}
        />
      );
    }

    // For PDFs - use embed/iframe
    if (file.type === 'pdf') {
      return (
        <div className="w-full h-full min-h-[500px] rounded-lg overflow-hidden shadow-card border border-border/50">
          <embed
            src={file.preview}
            type="application/pdf"
            className="w-full h-full min-h-[500px]"
            style={{
              minHeight: 'calc(100vh - 200px)',
            }}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50">
        <div className="flex items-center gap-2">
          {file.type === 'pdf' ? (
            <FileText className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
            {file.file.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-2" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-2" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document Display */}
      <div className="flex-1 overflow-auto p-4">
        <div 
          className="flex items-center justify-center min-h-full"
          style={{ 
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-out',
          }}
        >
          {renderPreview()}
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 border-t border-border/50 bg-card/30">
        <p className="text-xs text-muted-foreground text-center">
          Hover over explanations on the right to highlight corresponding areas
        </p>
      </div>
    </div>
  );
}
