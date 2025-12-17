import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, FileText } from 'lucide-react';
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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="flex flex-col h-full bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card/50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
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
          {file.type === 'pdf' ? (
            <div className="bg-card rounded-lg shadow-card border border-border/50 p-8 max-w-lg w-full">
              {/* Mock PDF Preview */}
              <div className="space-y-4">
                <div className="h-8 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted/60 rounded w-full" />
                <div className="h-4 bg-muted/60 rounded w-5/6" />
                <div className="h-4 bg-muted/60 rounded w-4/5" />
                <div className="h-px bg-border my-6" />
                
                {/* Mock charge lines with highlights */}
                {['charge-1', 'charge-2', 'charge-3', 'charge-4', 'charge-5'].map((chargeId, idx) => (
                  <div 
                    key={chargeId}
                    className={cn(
                      "p-3 rounded-lg transition-all duration-200",
                      activeHighlight === chargeId 
                        ? "bg-primary/20 ring-2 ring-primary/50" 
                        : "bg-muted/30 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex justify-between items-center">
                      <div className="h-3 bg-muted-foreground/20 rounded w-48" />
                      <div className="h-3 bg-muted-foreground/20 rounded w-16" />
                    </div>
                    <div className="h-2 bg-muted-foreground/10 rounded w-32 mt-2" />
                  </div>
                ))}
                
                <div className="h-px bg-border my-6" />
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-20" />
                  <div className="h-4 bg-primary/30 rounded w-24" />
                </div>
              </div>
            </div>
          ) : (
            <img
              src={file.preview}
              alt="Uploaded document"
              className="max-w-full h-auto rounded-lg shadow-card"
            />
          )}
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
