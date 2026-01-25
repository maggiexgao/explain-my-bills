/**
 * FairPriceEstimateSection - Shows what users might actually pay
 * based on typical negotiated rates in the US healthcare system
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingDown, Info, HelpCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FairPriceEstimateProps {
  benchmarkTotal: number;
  billedTotal: number;
  matchedItemsOnly?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRange(low: number, high: number): string {
  return `${formatCurrency(low)} – ${formatCurrency(high)}`;
}

interface PriceEstimate {
  label: string;
  description: string;
  low: number;
  high: number;
  icon: React.ElementType;
  highlight?: boolean;
}

export function FairPriceEstimateSection({ 
  benchmarkTotal, 
  billedTotal,
  matchedItemsOnly = true 
}: FairPriceEstimateProps) {
  // Don't render if we don't have benchmark data
  if (!benchmarkTotal || benchmarkTotal <= 0) {
    return null;
  }

  const estimates: PriceEstimate[] = [
    {
      label: "What insurance typically pays",
      description: "Most insurers negotiate 150-300% of benchmark rates",
      low: Math.round(benchmarkTotal * 1.5),
      high: Math.round(benchmarkTotal * 3.0),
      icon: CheckCircle,
    },
    {
      label: "Reasonable self-pay target",
      description: "Many hospitals offer 40-60% off for upfront payment",
      low: Math.round(benchmarkTotal * 1.5),
      high: Math.round(benchmarkTotal * 2.5),
      icon: TrendingDown,
      highlight: true,
    },
    {
      label: "With financial assistance",
      description: "If you qualify, hospitals may reduce to near-benchmark rates",
      low: Math.round(benchmarkTotal * 1.0),
      high: Math.round(benchmarkTotal * 1.5),
      icon: HelpCircle,
    },
  ];

  const yourBillMultiple = billedTotal > 0 ? billedTotal / benchmarkTotal : 0;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4 text-primary" />
          What You Might Actually Pay
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Based on typical negotiated rates in the US healthcare system
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Your Bill Context */}
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Your bill (chargemaster)</span>
            <span className="text-lg font-bold text-destructive">
              {formatCurrency(billedTotal)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {yourBillMultiple.toFixed(1)}× the benchmark rate — this is the "list price" before any negotiation
          </p>
        </div>

        {/* Price Ranges */}
        <div className="space-y-3">
          {estimates.map((estimate) => {
            const Icon = estimate.icon;
            return (
              <div 
                key={estimate.label}
                className={cn(
                  "p-3 rounded-xl border transition-colors",
                  estimate.highlight 
                    ? "bg-success/10 border-success/30" 
                    : "bg-muted/20 border-border/30"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Icon className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      estimate.highlight ? "text-success" : "text-muted-foreground"
                    )} />
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        estimate.highlight ? "text-success" : "text-foreground"
                      )}>
                        {estimate.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {estimate.description}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-semibold shrink-0",
                      estimate.highlight 
                        ? "bg-success/20 text-success border-success/30" 
                        : "bg-muted/50 text-foreground"
                    )}
                  >
                    {formatRange(estimate.low, estimate.high)}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Benchmark Reference */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">CMS Benchmark Total</span>
            <span className="text-lg font-bold text-primary">
              {formatCurrency(benchmarkTotal)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            This is what the government has determined these services actually cost to provide
          </p>
        </div>

        {/* Disclaimer */}
        {matchedItemsOnly && (
          <p className="text-[10px] text-muted-foreground text-center">
            * Estimates based on matched items only. Actual amounts may vary by location, facility, and insurance.
          </p>
        )}

        {/* Context Note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            These ranges are based on national averages. Your actual negotiated price will depend 
            on your insurance plan, the specific provider, and how you approach the conversation. 
            Use these as a starting point for discussions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
