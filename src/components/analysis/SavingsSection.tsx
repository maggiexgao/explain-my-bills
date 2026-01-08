import { Badge } from '@/components/ui/badge';
import { TrendingDown, Lightbulb, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SavingsOpportunity } from '@/types';

interface SavingsSectionProps {
  opportunities: SavingsOpportunity[];
}

function OpportunityCard({ opportunity, index }: { opportunity: SavingsOpportunity; index: number }) {
  return (
    <div className="p-4 rounded-xl bg-success/5 border border-success/20">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/20 text-success text-sm font-semibold">
          {index + 1}
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-medium text-foreground">{opportunity.whatMightBeReduced}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{opportunity.whyNegotiable}</p>
          
          {(opportunity.additionalInfoNeeded || opportunity.savingsContext) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {opportunity.savingsContext && (
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <Lightbulb className="h-3 w-3" />
                  {opportunity.savingsContext}
                </div>
              )}
              {opportunity.additionalInfoNeeded && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  Helpful: {opportunity.additionalInfoNeeded}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SavingsSection({ opportunities }: SavingsSectionProps) {
  if (opportunities.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
        <div className="flex items-start gap-3">
          <TrendingDown className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            No specific savings opportunities identified, but you can always ask about prompt-pay discounts or financial assistance programs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-success/5 border border-success/20 mb-4">
        <div className="flex items-start gap-2">
          <TrendingDown className="h-4 w-4 text-success mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            These opportunities are commonly available. Results depend on your specific situation.
          </p>
        </div>
      </div>
      
      {opportunities.map((opportunity, idx) => (
        <OpportunityCard key={idx} opportunity={opportunity} index={idx} />
      ))}
    </div>
  );
}
