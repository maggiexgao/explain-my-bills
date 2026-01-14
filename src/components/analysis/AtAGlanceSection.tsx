import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, AlertCircle, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AtAGlance, PondStatus } from '@/types';

interface AtAGlanceSectionProps {
  atAGlance: AtAGlance;
}

const statusConfig: Record<PondStatus, { icon: React.ReactNode; bg: string; border: string; badge: string; label: string }> = {
  looks_standard: {
    icon: <CheckCircle2 className="h-5 w-5 text-success" />,
    bg: 'bg-success/10',
    border: 'border-success/30',
    badge: 'bg-success/10 text-success',
    label: 'Looks Standard',
  },
  worth_reviewing: {
    icon: <Eye className="h-5 w-5 text-warning" />,
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    badge: 'bg-warning/10 text-warning-foreground',
    label: 'Worth Reviewing',
  },
  likely_issues: {
    icon: <AlertCircle className="h-5 w-5 text-destructive" />,
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    badge: 'bg-destructive/10 text-destructive',
    label: 'Likely Issues',
  },
};

export function AtAGlanceSection({ atAGlance }: AtAGlanceSectionProps) {
  const config = statusConfig[atAGlance.status] || statusConfig.worth_reviewing;

  return (
    <div className={cn('p-5 rounded-2xl border', config.bg, config.border)}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-background/50">
          {config.icon}
        </div>
        
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">
                {atAGlance.visitSummary}
              </h2>
              <div className="flex flex-wrap gap-3 text-sm">
                {atAGlance.totalBilled !== undefined && atAGlance.totalBilled !== null && (
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">Total billed:</span> ${atAGlance.totalBilled.toLocaleString()}
                  </span>
                )}
                {atAGlance.amountYouMayOwe !== undefined && atAGlance.amountYouMayOwe !== null && (
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">You may owe:</span> ${atAGlance.amountYouMayOwe.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <Badge className={cn('shrink-0', config.badge)}>
              {config.label}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            {atAGlance.statusExplanation}
          </p>
        </div>
      </div>
    </div>
  );
}
