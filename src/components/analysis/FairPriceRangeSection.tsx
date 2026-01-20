/**
 * FairPriceRangeSection - Shows estimated fair price ranges based on Medicare reference
 * 
 * Displays where the user's bill falls relative to typical payment ranges:
 * - Medicaid: ~80% of Medicare
 * - Insurance negotiated: 150-300% of Medicare
 * - Self-pay negotiated: 200-350% of Medicare
 * - Chargemaster (sticker price): ~500% of Medicare
 */

import { cn } from '@/lib/utils';
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FairPriceRangeProps {
  medicareTotal: number | null;
  billedTotal: number | null;
  className?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

interface PriceRange {
  label: string;
  description: string;
  low: number;
  high: number;
  color: string;
  bgColor: string;
}

function estimateFairPriceRanges(medicareTotal: number): PriceRange[] {
  return [
    {
      label: 'Medicaid',
      description: 'State programs pay less than Medicare',
      low: medicareTotal * 0.75,
      high: medicareTotal * 0.85,
      color: 'text-emerald-700 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      label: 'Medicare',
      description: 'Federal reference benchmark',
      low: medicareTotal * 0.95,
      high: medicareTotal * 1.05,
      color: 'text-blue-700 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Insurance Negotiated',
      description: 'Typical insurer contract rates',
      low: medicareTotal * 1.5,
      high: medicareTotal * 3.0,
      color: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Self-Pay Negotiated',
      description: 'Cash price after negotiation',
      low: medicareTotal * 2.0,
      high: medicareTotal * 3.5,
      color: 'text-orange-700 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
    {
      label: 'Chargemaster (Sticker)',
      description: 'Full hospital list price - often negotiable',
      low: medicareTotal * 4.0,
      high: medicareTotal * 6.0,
      color: 'text-red-700 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
  ];
}

function getBillPosition(billedTotal: number, ranges: PriceRange[]): { 
  rangeIndex: number; 
  position: 'below' | 'within' | 'above';
  message: string;
  icon: React.ElementType;
  color: string;
} {
  // Check if below all ranges
  if (billedTotal < ranges[0].low) {
    return {
      rangeIndex: 0,
      position: 'below',
      message: 'Your bill is below typical Medicaid rates - unusually low.',
      icon: CheckCircle,
      color: 'text-success',
    };
  }
  
  // Find which range the bill falls into
  for (let i = 0; i < ranges.length; i++) {
    if (billedTotal >= ranges[i].low && billedTotal <= ranges[i].high) {
      return {
        rangeIndex: i,
        position: 'within',
        message: `Your bill falls within the ${ranges[i].label} range.`,
        icon: i <= 2 ? CheckCircle : AlertTriangle,
        color: i <= 2 ? 'text-success' : 'text-warning',
      };
    }
    // Check if between this range and the next
    if (i < ranges.length - 1 && billedTotal > ranges[i].high && billedTotal < ranges[i + 1].low) {
      return {
        rangeIndex: i,
        position: 'above',
        message: `Your bill is between ${ranges[i].label} and ${ranges[i + 1].label} rates.`,
        icon: i <= 1 ? CheckCircle : AlertTriangle,
        color: i <= 1 ? 'text-success' : 'text-warning',
      };
    }
  }
  
  // Above all ranges
  return {
    rangeIndex: ranges.length - 1,
    position: 'above',
    message: 'Your bill exceeds typical Chargemaster pricing - consider negotiating.',
    icon: AlertTriangle,
    color: 'text-destructive',
  };
}

export function FairPriceRangeSection({ medicareTotal, billedTotal, className }: FairPriceRangeProps) {
  // Don't render if we don't have Medicare reference
  if (!medicareTotal || medicareTotal <= 0) {
    return null;
  }
  
  const ranges = estimateFairPriceRanges(medicareTotal);
  const billPosition = billedTotal && billedTotal > 0 
    ? getBillPosition(billedTotal, ranges) 
    : null;
  
  return (
    <Card className={cn("border-border/40", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Fair Price Ranges
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Where your bill falls compared to typical healthcare payment ranges
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bill position indicator */}
        {billPosition && billedTotal && (
          <div className={cn(
            "flex items-start gap-2 p-3 rounded-lg border",
            billPosition.color === 'text-success' && "bg-success/10 border-success/30",
            billPosition.color === 'text-warning' && "bg-warning/10 border-warning/30",
            billPosition.color === 'text-destructive' && "bg-destructive/10 border-destructive/30",
          )}>
            <billPosition.icon className={cn("h-5 w-5 mt-0.5", billPosition.color)} />
            <div>
              <p className={cn("font-medium", billPosition.color)}>
                Your bill: {formatCurrency(billedTotal)}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {billPosition.message}
              </p>
            </div>
          </div>
        )}
        
        {/* Price range bars */}
        <div className="space-y-2">
          {ranges.map((range, idx) => (
            <div key={range.label} className="flex items-center gap-3">
              <div className="w-32 shrink-0">
                <p className={cn("text-xs font-medium", range.color)}>{range.label}</p>
              </div>
              <div className="flex-1 relative">
                <div className={cn(
                  "h-6 rounded-md flex items-center justify-center text-xs font-medium",
                  range.bgColor, range.color
                )}>
                  {formatCurrency(range.low)} – {formatCurrency(range.high)}
                </div>
                {/* Indicator if bill falls in this range */}
                {billPosition && billedTotal && billPosition.rangeIndex === idx && billPosition.position === 'within' && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground"
                    style={{
                      left: `${Math.min(95, Math.max(5, ((billedTotal - range.low) / (range.high - range.low)) * 100))}%`
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Context note */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            These ranges are estimates based on national averages. Actual prices vary by region, 
            facility type, and negotiation. Use this as a starting point for discussions with 
            your provider's billing department.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
