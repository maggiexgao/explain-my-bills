import { ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CollapsibleGroupProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconClassName?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  infoTooltip?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export function CollapsibleGroup({ 
  title, 
  subtitle,
  icon, 
  iconClassName,
  badge,
  defaultOpen = false, 
  children,
  infoTooltip,
  isEmpty = false,
  emptyMessage,
}: CollapsibleGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
          "hover:bg-muted/20",
          isOpen && "border-b border-border/30"
        )}
      >
        {/* Icon */}
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          iconClassName || "bg-muted/30 text-muted-foreground"
        )}>
          {icon}
        </div>
        
        {/* Title & Subtitle */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground text-sm">{title}</h3>
            {infoTooltip && (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px]">
                    <p className="text-xs">{infoTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        
        {/* Badge */}
        {badge}
        
        {/* Chevron */}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>
      
      {/* Collapsible content */}
      <div
        className={cn(
          "grid transition-all duration-200",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn("p-4", !isOpen && "invisible")}>
            {isEmpty ? (
              <p className="text-sm text-muted-foreground py-2">
                {emptyMessage || "No items to display."}
              </p>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
