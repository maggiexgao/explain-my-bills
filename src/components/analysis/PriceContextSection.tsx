import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PriceContext } from '@/types';

interface PriceContextSectionProps {
  priceContext: PriceContext;
}

function ComparisonCard({ comparison }: { comparison: PriceContext['comparisons'][0] }) {
  return (
    <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="text-sm font-medium text-foreground">{comparison.service}</h4>
        {comparison.billedAmount !== undefined && (
          <span className="text-sm font-semibold text-foreground">
            ${comparison.billedAmount.toLocaleString()}
          </span>
        )}
      </div>
      
      {comparison.typicalRange && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Typical range:</span>
          <Badge variant="outline" className="text-xs">
            {comparison.typicalRange}
          </Badge>
        </div>
      )}
      
      {comparison.notes && (
        <p className="text-xs text-muted-foreground">{comparison.notes}</p>
      )}
    </div>
  );
}

export function PriceContextSection({ priceContext }: PriceContextSectionProps) {
  if (!priceContext.hasBenchmarks || priceContext.comparisons.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-info/5 border border-info/20">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground font-medium mb-1">Price Context</p>
            <p className="text-sm text-muted-foreground">
              {priceContext.fallbackMessage || "Price comparison data isn't available yet, but this category is commonly reviewed or negotiated."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-info/5 border border-info/20 mb-4">
        <div className="flex items-start gap-2">
          <DollarSign className="h-4 w-4 text-info mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            These ranges are estimates based on typical pricing in your area. Actual costs vary by provider and insurance.
          </p>
        </div>
      </div>
      
      {priceContext.comparisons.map((comparison, idx) => (
        <ComparisonCard key={idx} comparison={comparison} />
      ))}
    </div>
  );
}
