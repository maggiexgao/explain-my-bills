import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SubcategoryCardProps {
  icon: React.ReactNode;
  title: string;
  teaser?: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'info';
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const badgeStyles = {
  default: 'bg-muted text-muted-foreground border-border/50',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning-foreground border-warning/20',
  info: 'bg-info/10 text-info border-info/20',
};

export function SubcategoryCard({
  icon,
  title,
  teaser,
  badge,
  badgeVariant = 'default',
  children,
  defaultOpen = false,
}: SubcategoryCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="group">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card transition-all duration-200",
          "hover:border-border hover:shadow-soft hover:bg-card/80",
          isOpen && "rounded-b-none border-b-transparent bg-card/80"
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
          {icon}
        </div>
        <div className="flex-1 text-left">
          <h4 className="font-medium text-foreground">{title}</h4>
          {teaser && !isOpen && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{teaser}</p>
          )}
        </div>
        {badge !== undefined && (
          <Badge variant="outline" className={cn("shrink-0", badgeStyles[badgeVariant])}>
            {badge}
          </Badge>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      
      <div
        className={cn(
          "grid transition-all duration-200",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className={cn(
            "p-4 pt-2 border border-t-0 border-border/40 rounded-b-xl bg-card/50",
            !isOpen && "invisible"
          )}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
