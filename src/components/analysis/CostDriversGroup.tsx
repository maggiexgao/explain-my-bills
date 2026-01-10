import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, HelpCircle, CheckCircle, ChevronRight, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReviewItem, SavingsOpportunity } from '@/types';
import { CollapsibleGroup } from './CollapsibleGroup';
import { useState } from 'react';

interface CostDriversGroupProps {
  reviewItems: ReviewItem[];
  savingsOpportunities: SavingsOpportunity[];
  reviewSectionNote?: string;
}

type VerdictLevel = 'good' | 'warning' | 'error' | 'info';

const issueTypeToVerdict: Record<ReviewItem['issueType'], VerdictLevel> = {
  error: 'error',
  negotiable: 'warning',
  missing_info: 'info',
  confirmation: 'info',
};

const verdictConfig: Record<VerdictLevel, { icon: React.ReactNode; bg: string; color: string }> = {
  good: { icon: <CheckCircle className="h-3.5 w-3.5" />, bg: 'bg-success/10', color: 'text-success' },
  warning: { icon: <AlertTriangle className="h-3.5 w-3.5" />, bg: 'bg-warning/10', color: 'text-warning' },
  error: { icon: <AlertCircle className="h-3.5 w-3.5" />, bg: 'bg-destructive/10', color: 'text-destructive' },
  info: { icon: <HelpCircle className="h-3.5 w-3.5" />, bg: 'bg-info/10', color: 'text-info' },
};

function ReviewItemRow({ item }: { item: ReviewItem }) {
  const [showDetails, setShowDetails] = useState(false);
  const verdict = issueTypeToVerdict[item.issueType] ?? 'info';
  const config = verdictConfig[verdict] ?? verdictConfig.info;

  return (
    <div className="py-2 border-b border-border/20 last:border-0">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-start gap-2 text-left group"
      >
        <div className={cn('mt-0.5 shrink-0 rounded-full p-1', config.bg, config.color)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {item.whatToReview}
          </span>
        </div>
        <ChevronRight className={cn(
          "h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform",
          showDetails && "rotate-90"
        )} />
      </button>
      
      {showDetails && (
        <div className="mt-2 ml-8 animate-fade-in">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {item.whyItMatters}
          </p>
        </div>
      )}
    </div>
  );
}

function SavingsRow({ opportunity }: { opportunity: SavingsOpportunity }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="py-2 border-b border-border/20 last:border-0">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-start gap-2 text-left group"
      >
        <div className="mt-0.5 shrink-0 rounded-full p-1 bg-success/10 text-success">
          <TrendingDown className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {opportunity.whatMightBeReduced}
          </span>
          {opportunity.savingsContext && (
            <span className="text-xs text-success ml-2">
              {opportunity.savingsContext}
            </span>
          )}
        </div>
        <ChevronRight className={cn(
          "h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform",
          showDetails && "rotate-90"
        )} />
      </button>
      
      {showDetails && (
        <div className="mt-2 ml-8 animate-fade-in space-y-1">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {opportunity.whyNegotiable}
          </p>
          {opportunity.additionalInfoNeeded && (
            <p className="text-xs text-muted-foreground/80">
              Helpful: {opportunity.additionalInfoNeeded}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function CostDriversGroup({ reviewItems, savingsOpportunities, reviewSectionNote }: CostDriversGroupProps) {
  const totalItems = reviewItems.length + savingsOpportunities.length;
  const hasItems = totalItems > 0;
  
  // Determine what verdict badges to show
  const errorCount = reviewItems.filter(i => i.issueType === 'error').length;
  const warningCount = reviewItems.filter(i => i.issueType === 'negotiable').length;
  
  return (
    <CollapsibleGroup
      title="What's Driving the Cost"
      subtitle={hasItems ? `${totalItems} item${totalItems > 1 ? 's' : ''} identified` : "Nothing unusual found"}
      icon={<AlertTriangle className="h-4 w-4" />}
      iconClassName={hasItems ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}
      badge={
        hasItems ? (
          <div className="flex gap-1">
            {errorCount > 0 && (
              <Badge className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0">
                {errorCount} issue{errorCount > 1 ? 's' : ''}
              </Badge>
            )}
            {savingsOpportunities.length > 0 && (
              <Badge className="bg-success/10 text-success text-[10px] px-1.5 py-0">
                {savingsOpportunities.length} saving{savingsOpportunities.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        ) : (
          <Badge className="bg-success/10 text-success text-[10px] px-1.5 py-0">
            ✓ Clear
          </Badge>
        )
      }
      defaultOpen={hasItems && (errorCount > 0 || savingsOpportunities.length > 0)}
      isEmpty={!hasItems && !reviewSectionNote}
      emptyMessage="This bill looks straightforward. Request an itemized bill to confirm accuracy."
      infoTooltip="High-cost line items, duplicate charges, and areas where costs might be reduced"
    >
      <div className="space-y-1">
        {/* Review items with issues */}
        {reviewItems.map((item, idx) => (
          <ReviewItemRow key={`review-${idx}`} item={item} />
        ))}
        
        {/* Savings opportunities */}
        {savingsOpportunities.map((opp, idx) => (
          <SavingsRow key={`savings-${idx}`} opportunity={opp} />
        ))}
        
        {/* Note if nothing found */}
        {!hasItems && reviewSectionNote && (
          <div className="py-2 flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{reviewSectionNote}</p>
          </div>
        )}
      </div>
    </CollapsibleGroup>
  );
}
