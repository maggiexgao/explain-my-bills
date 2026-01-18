import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, HelpCircle, CheckCircle, ChevronDown, ChevronUp, TrendingDown, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReviewItem, SavingsOpportunity, ChargeItem } from '@/types';
import { CollapsibleGroup } from './CollapsibleGroup';
import { useState } from 'react';

interface CostDriversGroupProps {
  reviewItems: ReviewItem[];
  savingsOpportunities: SavingsOpportunity[];
  reviewSectionNote?: string;
  charges?: ChargeItem[]; // Optional charges for amount display
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Try to extract an amount from the review text or find a matching charge
function extractAmount(text: string, charges?: ChargeItem[]): number | null {
  // Try to extract from text like "$2,580" or "($2,580)"
  const amountMatch = text.match(/\$[\d,]+(?:\.\d{2})?/);
  if (amountMatch) {
    const cleaned = amountMatch[0].replace(/[$,]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0) return num;
  }
  
  // Try to find a matching charge by description keywords
  if (charges && charges.length > 0) {
    const lowerText = text.toLowerCase();
    for (const charge of charges) {
      const desc = charge.description?.toLowerCase() || '';
      // Check for common keywords
      if (
        (lowerText.includes('emergency') && desc.includes('emergency')) ||
        (lowerText.includes('lab') && desc.includes('lab')) ||
        (lowerText.includes('iv') && (desc.includes('iv') || desc.includes('infusion'))) ||
        (lowerText.includes('x-ray') && desc.includes('x-ray')) ||
        (lowerText.includes('ct') && desc.includes('ct'))
      ) {
        return charge.amount || charge.billed || charge.billedAmount || null;
      }
    }
  }
  
  return null;
}

// Enhance the header to be more specific
function enhanceHeader(whatToReview: string, charges?: ChargeItem[]): { header: string; amount: number | null } {
  const amount = extractAmount(whatToReview, charges);
  
  // If whatToReview is generic like "Review this item", try to make it more specific
  const lowerText = whatToReview.toLowerCase();
  
  // Already has good specificity if it contains a dollar amount or specific service name
  if (whatToReview.match(/\$[\d,]+/) || 
      lowerText.includes('emergency') || 
      lowerText.includes('lab') ||
      lowerText.includes('level')) {
    return { header: whatToReview, amount };
  }
  
  return { header: whatToReview, amount };
}

function ReviewItemRow({ item, charges }: { item: ReviewItem; charges?: ChargeItem[] }) {
  const [showDetails, setShowDetails] = useState(false);
  const verdict = issueTypeToVerdict[item.issueType] ?? 'info';
  const config = verdictConfig[verdict] ?? verdictConfig.info;
  
  const { header, amount } = enhanceHeader(item.whatToReview, charges);

  return (
    <div className={cn(
      "rounded-lg border mb-2 overflow-hidden",
      verdict === 'error' && "border-destructive/30 bg-destructive/5",
      verdict === 'warning' && "border-warning/30 bg-warning/5",
      verdict === 'info' && "border-border/30 bg-muted/10"
    )}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-muted/10 transition-colors"
      >
        <div className={cn('mt-0.5 shrink-0 rounded-full p-1.5', config.bg, config.color)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-foreground leading-snug">
              {header}
            </span>
            {amount && (
              <Badge variant="outline" className="shrink-0 text-xs font-semibold">
                {formatCurrency(amount)}
              </Badge>
            )}
          </div>
          {!showDetails && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {item.whyItMatters}
            </p>
          )}
        </div>
        {showDetails ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>
      
      {showDetails && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-9 p-3 rounded-lg bg-background/60 border border-border/30">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.whyItMatters}
            </p>
            {item.issueType === 'error' && (
              <div className="mt-2 pt-2 border-t border-border/30">
                <p className="text-xs text-destructive font-medium">
                  💡 Consider asking the billing department about this charge
                </p>
              </div>
            )}
            {item.issueType === 'negotiable' && (
              <div className="mt-2 pt-2 border-t border-border/30">
                <p className="text-xs text-warning-foreground font-medium">
                  💡 This type of charge is often negotiable
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SavingsRow({ opportunity }: { opportunity: SavingsOpportunity }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="rounded-lg border border-success/30 bg-success/5 mb-2 overflow-hidden">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full p-3 flex items-start gap-3 text-left hover:bg-muted/10 transition-colors"
      >
        <div className="mt-0.5 shrink-0 rounded-full p-1.5 bg-success/10 text-success">
          <TrendingDown className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-foreground leading-snug">
              {opportunity.whatMightBeReduced}
            </span>
            {opportunity.savingsContext && (
              <Badge className="bg-success/10 text-success text-xs shrink-0">
                {opportunity.savingsContext}
              </Badge>
            )}
          </div>
          {!showDetails && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
              {opportunity.whyNegotiable}
            </p>
          )}
        </div>
        {showDetails ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>
      
      {showDetails && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-9 p-3 rounded-lg bg-background/60 border border-border/30 space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {opportunity.whyNegotiable}
            </p>
            {opportunity.additionalInfoNeeded && (
              <div className="pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground">
                  <strong>Helpful info to gather:</strong> {opportunity.additionalInfoNeeded}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Filter out action items - keep only actual cost drivers
function filterToActualCostDrivers(reviewItems: ReviewItem[]): ReviewItem[] {
  const actionKeywords = [
    'question the',
    'negotiate',
    'ask for',
    'request',
    'call',
    'contact',
    'discount',
    'self-pay',
    'prompt-pay',
    'payment plan',
    'appeal',
    'dispute',
  ];
  
  return reviewItems.filter(item => {
    const text = (item.whatToReview || '').toLowerCase();
    // Keep if it doesn't start with action keywords
    return !actionKeywords.some(keyword => text.startsWith(keyword));
  });
}

export function CostDriversGroup({ reviewItems, savingsOpportunities, reviewSectionNote, charges }: CostDriversGroupProps) {
  // Filter to only show actual cost drivers, not action items
  const costDriverItems = filterToActualCostDrivers(reviewItems);
  
  // Don't show savings opportunities here - they're action items too
  const totalItems = costDriverItems.length;
  const hasItems = totalItems > 0;
  
  // Determine what verdict badges to show
  const errorCount = costDriverItems.filter(i => i.issueType === 'error').length;
  
  return (
    <CollapsibleGroup
      title="What's Driving the Cost"
      subtitle={hasItems ? `${totalItems} high-cost item${totalItems > 1 ? 's' : ''} identified` : "No unusual charges found"}
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
          </div>
        ) : (
          <Badge className="bg-success/10 text-success text-[10px] px-1.5 py-0">
            ✓ Clear
          </Badge>
        )
      }
      defaultOpen={hasItems && errorCount > 0}
      isEmpty={!hasItems && !reviewSectionNote}
      emptyMessage="No unusually high charges detected. The costs appear consistent with typical hospital pricing."
      infoTooltip="High-cost line items and charges that stand out"
    >
      <div className="space-y-1">
        {/* Review items with issues - only cost drivers, not actions */}
        {costDriverItems.map((item, idx) => (
          <ReviewItemRow key={`review-${idx}`} item={item} charges={charges} />
        ))}
        
        {/* Note if nothing found */}
        {!hasItems && reviewSectionNote && (
          <div className="p-3 rounded-lg bg-success/5 border border-success/20 flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">{reviewSectionNote}</p>
          </div>
        )}
      </div>
    </CollapsibleGroup>
  );
}
