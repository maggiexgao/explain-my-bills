import { Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useZoom } from '@/contexts/ZoomContext';

export function ZoomControl() {
  const { zoomLevel, setZoomLevel } = useZoom();

  const handleZoomIn = () => {
    if (zoomLevel === 'normal') setZoomLevel('large');
    else if (zoomLevel === 'large') setZoomLevel('x-large');
  };

  const handleZoomOut = () => {
    if (zoomLevel === 'x-large') setZoomLevel('large');
    else if (zoomLevel === 'large') setZoomLevel('normal');
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleZoomOut}
        disabled={zoomLevel === 'normal'}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-background/50 disabled:opacity-40"
        aria-label="Decrease text size"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground min-w-[24px] text-center">
        {zoomLevel === 'normal' ? 'A' : zoomLevel === 'large' ? 'A+' : 'A++'}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleZoomIn}
        disabled={zoomLevel === 'x-large'}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-background/50 disabled:opacity-40"
        aria-label="Increase text size"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
