import { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, FileText, Download, AlertCircle, Image as ImageIcon, Loader2 } from 'lucide-react';
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
  const [pdfError, setPdfError] = useState(false);

  // Reset states when file changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
    setPdfError(false);
    setZoom(100);
    setRotation(0);
  }, [file.id]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = file.originalUrl || file.preview;
    link.download = file.file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get the best available preview URL
  const getPreviewUrl = (): string | null => {
    // First try the converted/displayable preview URL
    if (file.previewUrl) return file.previewUrl;
    // Fallback to legacy preview field
    if (file.preview) return file.preview;
    return null;
  };

  const previewUrl = getPreviewUrl();
  const hasValidPreview = !!previewUrl && !imageError && !pdfError;

  const renderUnavailableMessage = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-warning/10 mb-4">
        <AlertCircle className="h-8 w-8 text-warning" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">Preview Unavailable</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        {file.conversionError || 'Your file is still uploaded and will be analyzed.'}
      </p>
      <Button variant="outline" size="sm" onClick={handleDownload}>
        <Download className="h-4 w-4 mr-2" />
        Download Original File
      </Button>
    </div>
  );

  const renderPreview = () => {
    // No preview URL available
    if (!previewUrl) {
      return renderUnavailableMessage();
    }

    // PDF files
    if (file.type === 'pdf') {
      if (pdfError) {
        return renderUnavailableMessage();
      }

      return (
        <div className="w-full h-full min-h-[500px] rounded-lg overflow-hidden shadow-card border border-border/50">
          <iframe
            src={`${previewUrl}#view=FitH`}
            title="PDF Preview"
            className="w-full h-full min-h-[500px]"
            style={{
              minHeight: 'calc(100vh - 200px)',
            }}
            onError={() => setPdfError(true)}
          />
        </div>
      );
    }

    // Image files
    if (file.type === 'image') {
      // Show loading state while image is loading
      if (!imageLoaded && !imageError) {
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Loading preview...</p>
            {/* Hidden image to trigger load/error events */}
            <img
              src={previewUrl}
              alt=""
              className="hidden"
              onLoad={() => {
                setImageLoaded(true);
              }}
              onError={(e) => {
                console.error('Image failed to load:', file.file.name, e);
                setImageError(true);
              }}
            />
          </div>
        );
      }

      // Image failed to load
      if (imageError) {
        return renderUnavailableMessage();
      }

      // Image loaded successfully - display it
      return (
        <img
          src={previewUrl}
          alt={`Preview of ${file.file.name}`}
          className="max-w-full h-auto rounded-lg shadow-card object-contain border border-border/20"
          style={{
            maxHeight: 'calc(100vh - 200px)',
          }}
        />
      );
    }

    return renderUnavailableMessage();
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
          {file.isConverted && (
            <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
              Converted
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-2" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRotate} title="Rotate">
            <RotateCw className="h-4 w-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-2" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="Download Original">
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
