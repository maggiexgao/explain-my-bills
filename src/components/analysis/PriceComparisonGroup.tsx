import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PriceContext, NegotiabilityItem, NegotiabilityLevel } from '@/types';
import { CollapsibleGroup } from './CollapsibleGroup';

interface PriceComparisonGroupProps {
  priceContext: PriceContext;
  negotiability: NegotiabilityItem[];
}

const negotiabilityConfig: Record<NegotiabilityLevel, { 
  label: string; 
  color: string;
  shortLabel: string;
}> = {
  highly_negotiable: { label: 'Highly Negotiable', color: 'text-success', shortLabel: 'Negotiable' },
  sometimes_negotiable: { label: 'Sometimes Negotiable', color: 'text-warning', shortLabel: 'Sometimes' },
  rarely_negotiable: { label: 'Rarely Negotiable', color: 'text-muted-foreground', shortLabel: 'Rarely' },
  generally_fixed: { label: 'Generally Fixed', color: 'text-destructive', shortLabel: 'Fixed' },
};

function ComparisonRow({ comparison }: { comparison: PriceContext['comparisons'][0] }) {
  // Determine if billed amount seems high, normal, or low
  const getComparisonIndicator = () => {
    if (!comparison.typicalRange || !comparison.billedAmount) return null;
    
    // Parse typical range (e.g., "$500-$1,200")
    const rangeMatch = comparison.typicalRange.match(/\$?([\d,]+)\s*-\s*\$?([\d,]+)/);
    if (!rangeMatch) return null;
    
    const low = parseInt(rangeMatch[1].replace(/,/g, ''));
    const high = parseInt(rangeMatch[2].replace(/,/g, ''));
    
    if (comparison.billedAmount > high * 1.2) {
      return { icon: <TrendingUp className="h-3.5 w-3.5" />, color: 'text-destructive', label: 'Above typical' };
    } else if (comparison.billedAmount < low * 0.8) {
      return { icon: <TrendingDown className="h-3.5 w-3.5" />, color: 'text-success', label: 'Below typical' };
    }
    return { icon: <Minus className="h-3.5 w-3.5" />, color: 'text-muted-foreground', label: 'In range' };
  };

  const indicator = getComparisonIndicator();

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{comparison.service}</span>
        {comparison.notes && (
          <p className="text-xs text-muted-foreground mt-0.5">{comparison.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {comparison.billedAmount && (
          <span className="text-sm font-medium text-foreground">
            ${comparison.billedAmount.toLocaleString()}
          </span>
        )}
        {comparison.typicalRange && (
          <span className="text-xs text-muted-foreground">
            {comparison.typicalRange}
          </span>
        )}
        {indicator && (
          <span className={cn("flex items-center gap-1", indicator.color)}>
            {indicator.icon}
          </span>
        )}
      </div>
    </div>
  );
}

function NegotiabilityRow({ item }: { item: NegotiabilityItem }) {
  const config = negotiabilityConfig[item.level];
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{item.chargeOrCategory}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{item.reason}</p>
      </div>
      <span className={cn("text-xs font-medium shrink-0", config.color)}>
        {config.shortLabel}
      </span>
    </div>
  );
}

export function PriceComparisonGroup({ priceContext, negotiability }: PriceComparisonGroupProps) {
  const hasComparisons = priceContext.hasBenchmarks && priceContext.comparisons.length > 0;
  const hasNegotiability = negotiability.length > 0;
  const hasContent = hasComparisons || hasNegotiability;
  
  return (
    <CollapsibleGroup
      title="How This Compares"
      subtitle={hasComparisons ? "Price context & negotiability" : "General guidance available"}
      icon={<BarChart3 className="h-4 w-4" />}
      iconClassName="bg-info/20 text-info"
      defaultOpen={false}
      isEmpty={!hasContent && !priceContext.fallbackMessage}
      emptyMessage="Price comparison data not available for this bill."
      infoTooltip="Medicare comparisons, typical price ranges, and what's generally negotiable"
    >
      <div className="space-y-4">
        {/* Price comparisons */}
        {hasComparisons && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Price Context
            </h4>
            <div className="rounded-lg bg-muted/10 border border-border/30 p-3">
              {priceContext.comparisons.map((comparison, idx) => (
                <ComparisonRow key={idx} comparison={comparison} />
              ))}
            </div>
          </div>
        )}
        
        {/* Fallback message if no benchmarks */}
        {!hasComparisons && priceContext.fallbackMessage && (
          <div className="rounded-lg bg-info/5 border border-info/20 p-3">
            <p className="text-sm text-muted-foreground">
              {priceContext.fallbackMessage}
            </p>
          </div>
        )}
        
        {/* Negotiability */}
        {hasNegotiability && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              What's Negotiable
            </h4>
            <div className="rounded-lg bg-muted/10 border border-border/30 p-3">
              {negotiability.map((item, idx) => (
                <NegotiabilityRow key={idx} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleGroup>
  );
}
