/**
 * BillTotalsGrid - Displays the key bill totals in a clear 2-row grid
 * Row 1: Total Billed | Insurance Paid | You May Owe
 * Row 2: Matched Charges | Medicare Reference | Difference
 */

import { cn } from '@/lib/utils';
import { Info, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BillTotalsGridProps {
  totalBilled: number | null;
  insurancePaid: number | null;
  youMayOwe: number | null;
  matchedCharges: number;
  medicareReference: number;
  matchedCount: number;
  totalCount: number;
  careSetting?: 'office' | 'facility';
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function TotalsBox({ 
  label, 
  value, 
  colorClass,
  subtext,
  tooltip 
}: { 
  label: string;
  value: number | null;
  colorClass: string;
  subtext?: string;
  tooltip?: string;
}) {
  const content = (
    <div className={cn(
      "p-4 rounded-xl border text-center",
      colorClass
    )}>
      <div className="flex items-center justify-center gap-1 mb-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        {tooltip && (
          <Info className="h-3 w-3 text-muted-foreground/50" />
        )}
      </div>
      <p className="text-xl font-bold text-foreground">
        {value !== null ? formatCurrency(value) : '—'}
      </p>
      {subtext && (
        <p className="text-[10px] text-muted-foreground mt-1">{subtext}</p>
      )}
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent>
            <p className="text-xs max-w-48">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

function DifferenceBox({
  matchedCharges,
  medicareReference,
}: {
  matchedCharges: number;
  medicareReference: number;
}) {
  const difference = matchedCharges - medicareReference;
  const multiple = medicareReference > 0 ? matchedCharges / medicareReference : 0;
  
  // Color coding based on multiple
  let colorClass = 'bg-success/10 border-success/30 text-success'; // <1.5x
  let statusLabel = 'Reasonable';
  
  if (multiple >= 3) {
    colorClass = 'bg-destructive/10 border-destructive/30 text-destructive';
    statusLabel = `${multiple.toFixed(1)}× Medicare`;
  } else if (multiple >= 1.5) {
    colorClass = 'bg-warning/10 border-warning/30 text-warning';
    statusLabel = `${multiple.toFixed(1)}× Medicare`;
  }

  return (
    <div className={cn(
      "p-4 rounded-xl border text-center",
      colorClass
    )}>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Difference</p>
      <p className="text-xl font-bold">
        {difference > 0 ? '+' : ''}{formatCurrency(difference)}
      </p>
      <p className="text-[10px] mt-1 font-medium">{statusLabel}</p>
    </div>
  );
}

export function BillTotalsGrid({
  totalBilled,
  insurancePaid,
  youMayOwe,
  matchedCharges,
  medicareReference,
  matchedCount,
  totalCount,
  careSetting = 'office',
}: BillTotalsGridProps) {
  const matchPercent = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0;
  const isFacility = careSetting === 'facility';
  
  return (
    <div className="space-y-4">
      {/* Rate Type Indicator */}
      <div className={cn(
        "flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs font-medium",
        isFacility 
          ? "bg-primary/10 text-primary border border-primary/20" 
          : "bg-muted/50 text-muted-foreground border border-border/30"
      )}>
        <Badge variant={isFacility ? "default" : "secondary"} className="text-[10px] px-2 py-0">
          {isFacility ? 'OPPS' : 'MPFS'}
        </Badge>
        <span>
          {isFacility 
            ? 'Using OPPS Hospital Rates' 
            : 'Using MPFS Physician Rates'}
        </span>
      </div>

      {/* Row 1: Bill Overview */}
      <div className="grid grid-cols-3 gap-3">
        <TotalsBox
          label="Total Billed"
          value={totalBilled}
          colorClass="bg-primary/5 border-primary/20"
          tooltip="The full amount charged before any insurance payments or adjustments"
        />
        <TotalsBox
          label="Insurance Paid"
          value={insurancePaid}
          colorClass="bg-success/5 border-success/20"
          tooltip="Amount your insurance has paid toward this bill"
        />
        <TotalsBox
          label="You May Owe"
          value={youMayOwe}
          colorClass="bg-warning/5 border-warning/20"
          tooltip="Your estimated remaining balance after insurance"
        />
      </div>

      {/* Row 2: Medicare Comparison */}
      <div className="grid grid-cols-3 gap-3">
        <TotalsBox
          label="Matched Charges"
          value={matchedCharges}
          colorClass="bg-muted/30 border-border/30"
          subtext={`${matchedCount} of ${totalCount} items`}
          tooltip="Sum of only the line items we could match to Medicare rates"
        />
        <TotalsBox
          label="Medicare Reference"
          value={medicareReference}
          colorClass="bg-primary/5 border-primary/20"
          subtext="CMS 2026 rates"
          tooltip="What Medicare would pay for these same services"
        />
        <DifferenceBox
          matchedCharges={matchedCharges}
          medicareReference={medicareReference}
        />
      </div>

      {/* Match Coverage Notice */}
      {matchPercent < 100 && totalCount > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Only {matchedCount} of {totalCount} items ({matchPercent}%)</strong> could be matched to Medicare rates. 
              The comparison above reflects only those matched items. Unmatched items may include drugs, supplies, 
              or services with special pricing.
            </p>
          </div>
        </div>
      )}

      {/* Medicare Context Note */}
      <div className="p-3 rounded-lg bg-info/5 border border-info/20">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isFacility ? (
              <>
                <strong>Note:</strong> Using OPPS (Outpatient Prospective Payment System) hospital facility rates. 
                These are the Medicare rates paid to hospital outpatient departments. 
                Commercial insurance typically pays 150–300% of Medicare facility rates.
              </>
            ) : (
              <>
                <strong>Note:</strong> Medicare <em>physician fees</em> (MPFS) are shown above. Hospital <em>facility fees</em> are typically higher. 
                Commercial insurance usually pays 150–300% of Medicare rates. A high multiple doesn't necessarily mean you're being overcharged—hospital pricing differs from Medicare physician rates.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
