import { ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useZoom } from '@/contexts/ZoomContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ZoomControl() {
  const { zoomLevel, cycleZoom } = useZoom();

  const label = zoomLevel === 'normal' ? 'A' : zoomLevel === 'large' ? 'A+' : 'A++';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={cycleZoom}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-background/50"
            aria-label="Change text size"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Text size: {label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
