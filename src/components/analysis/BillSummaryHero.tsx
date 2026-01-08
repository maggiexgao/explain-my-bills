import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, AlertCircle, HelpCircle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AtAGlance, PondStatus, ReviewItem, SavingsOpportunity } from '@/types';

interface BillSummaryHeroProps {
  atAGlance: AtAGlance;
  reviewItems: ReviewItem[];
  savingsOpportunities: SavingsOpportunity[];
}

// Extended status to include "not_enough_info"
type ExtendedStatus = PondStatus | 'not_enough_info';

const statusConfig: Record<ExtendedStatus, { 
  icon: React.ReactNode; 
  bg: string; 
  border: string; 
  badge: string; 
  label: string;
  emoji: string;
}> = {
  looks_standard: {
    icon: <CheckCircle2 className="h-6 w-6" />,
    bg: 'bg-success/15',
    border: 'border-success/40',
    badge: 'bg-success text-success-foreground',
    label: 'Typical',
    emoji: '🟢',
  },
  worth_reviewing: {
    icon: <AlertTriangle className="h-6 w-6" />,
    bg: 'bg-warning/15',
    border: 'border-warning/40',
    badge: 'bg-warning text-warning-foreground',
    label: 'Worth Reviewing',
    emoji: '🟡',
  },
  likely_issues: {
    icon: <AlertCircle className="h-6 w-6" />,
    bg: 'bg-destructive/15',
    border: 'border-destructive/40',
    badge: 'bg-destructive text-destructive-foreground',
    label: 'Likely Overpriced',
    emoji: '🔴',
  },
  not_enough_info: {
    icon: <HelpCircle className="h-6 w-6" />,
    bg: 'bg-muted/30',
    border: 'border-border/50',
    badge: 'bg-muted text-muted-foreground',
    label: 'Not Enough Info',
    emoji: '⚪',
  },
};

function calculatePotentialSavings(savingsOpportunities: SavingsOpportunity[]): string | null {
  // If we have savings opportunities, return a general statement
  if (savingsOpportunities.length > 0) {
    return `${savingsOpportunities.length} potential area${savingsOpportunities.length > 1 ? 's' : ''} to reduce costs`;
  }
  return null;
}

function getActionStatement(status: ExtendedStatus, reviewItems: ReviewItem[], savingsOpportunities: SavingsOpportunity[]): string {
  if (status === 'looks_standard' && reviewItems.length === 0) {
    return 'No action likely needed';
  }
  
  if (savingsOpportunities.length > 0) {
    return 'Opportunities to lower this bill may exist';
  }
  
  if (reviewItems.length > 0) {
    return `${reviewItems.length} item${reviewItems.length > 1 ? 's' : ''} worth confirming`;
  }
  
  return 'Review details below';
}

export function BillSummaryHero({ atAGlance, reviewItems, savingsOpportunities }: BillSummaryHeroProps) {
  const config = statusConfig[atAGlance.status] || statusConfig.worth_reviewing;
  const actionStatement = getActionStatement(atAGlance.status, reviewItems, savingsOpportunities);
  const savingsNote = calculatePotentialSavings(savingsOpportunities);

  return (
    <div className={cn(
      'p-6 rounded-2xl border-2 transition-all',
      config.bg,
      config.border
    )}>
      {/* Main content row */}
      <div className="flex items-start gap-5">
        {/* Icon */}
        <div className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
          config.bg.replace('/15', '/20')
        )}>
          {config.icon}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title & Badge */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-foreground leading-tight mb-1">
                {atAGlance.visitSummary}
              </h2>
              
              {/* Amounts row */}
              <div className="flex flex-wrap gap-4 text-sm mt-2">
                {atAGlance.totalBilled !== undefined && atAGlance.totalBilled !== null && (
                  <div>
                    <span className="text-muted-foreground">Total billed: </span>
                    <span className="font-semibold text-foreground">
                      ${atAGlance.totalBilled.toLocaleString()}
                    </span>
                  </div>
                )}
                {atAGlance.amountYouMayOwe !== undefined && atAGlance.amountYouMayOwe !== null && (
                  <div>
                    <span className="text-muted-foreground">You may owe: </span>
                    <span className="font-semibold text-foreground">
                      ${atAGlance.amountYouMayOwe.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Verdict Badge */}
            <Badge className={cn('shrink-0 text-sm px-3 py-1 font-medium', config.badge)}>
              {config.emoji} {config.label}
            </Badge>
          </div>
          
          {/* Divider */}
          <div className="h-px bg-border/50 my-4" />
          
          {/* Action Statement */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {savingsOpportunities.length > 0 ? (
                <TrendingDown className="h-4 w-4 text-success shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className={cn(
                "text-sm font-medium",
                savingsOpportunities.length > 0 ? "text-success" : "text-foreground"
              )}>
                {actionStatement}
              </span>
            </div>
            
            {savingsNote && (
              <span className="text-xs text-muted-foreground">
                {savingsNote}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
