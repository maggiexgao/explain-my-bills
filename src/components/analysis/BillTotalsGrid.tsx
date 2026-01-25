/**
 * BillTotalsGrid - Displays the key bill totals in a clear 2-row grid
 * Row 1: Total Billed | Insurance Paid | You May Owe
 * Row 2: Matched Charges | Benchmark Reference | Difference
 * 
 * REBRANDED: "Medicare" → "Benchmark" throughout for clarity with insured users
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Info, AlertTriangle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { BenchmarkEducationModal } from './BenchmarkEducationModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BillTotalsGridProps {
  totalBilled: number | null;
  insurancePaid: number | null;
  youMayOwe: number | null;
  matchedCharges: number;
  medicareReference: number;
  matchedCount: number;
  totalCount: number;
  careSetting?: 'office' | 'facility';
  billTypeMessage?: string;
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
  benchmarkReference,
}: {
  matchedCharges: number;
  benchmarkReference: number;
}) {
  const difference = matchedCharges - benchmarkReference;
  const multiple = benchmarkReference > 0 ? matchedCharges / benchmarkReference : 0;
  
  // Color coding based on multiple
  let colorClass = 'bg-success/10 border-success/30 text-success'; // <1.5x
  let statusLabel = 'Reasonable';
  
  if (multiple >= 3) {
    colorClass = 'bg-destructive/10 border-destructive/30 text-destructive';
    statusLabel = `${multiple.toFixed(1)}× benchmark`;
  } else if (multiple >= 1.5) {
    colorClass = 'bg-warning/10 border-warning/30 text-warning';
    statusLabel = `${multiple.toFixed(1)}× benchmark`;
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
  billTypeMessage,
}: BillTotalsGridProps) {
  const [showEducationModal, setShowEducationModal] = useState(false);
  const [showBenchmarkExplainer, setShowBenchmarkExplainer] = useState(false);
  
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
          {billTypeMessage || (isFacility 
            ? 'Using Hospital Outpatient Benchmark Rates' 
            : 'Using Physician Fee Benchmark Rates')}
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

      {/* Row 2: Benchmark Comparison */}
      <div className="grid grid-cols-3 gap-3">
        <TotalsBox
          label="Matched Charges"
          value={matchedCharges}
          colorClass="bg-muted/30 border-border/30"
          subtext={`${matchedCount} of ${totalCount} items`}
          tooltip="Sum of only the line items we could match to benchmark rates"
        />
        <TotalsBox
          label="Benchmark Reference"
          value={medicareReference}
          colorClass="bg-primary/5 border-primary/20"
          subtext="National benchmark (CMS 2026)"
          tooltip="What the government benchmark says these services should cost"
        />
        <DifferenceBox
          matchedCharges={matchedCharges}
          benchmarkReference={medicareReference}
        />
      </div>

      {/* Match Coverage Notice */}
      {matchPercent < 100 && totalCount > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>Only {matchedCount} of {totalCount} items ({matchPercent}%)</strong> could be matched to benchmark rates. 
              The comparison above reflects only those matched items. Unmatched items may include drugs, supplies, 
              or services with special pricing.
            </p>
          </div>
        </div>
      )}

      {/* Benchmark Explainer - Collapsible */}
      <Collapsible open={showBenchmarkExplainer} onOpenChange={setShowBenchmarkExplainer}>
        <div className="p-4 rounded-lg bg-info/5 border border-info/20">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between text-left">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-info shrink-0" />
                <span className="text-sm font-medium text-foreground">What is Benchmark Pricing?</span>
              </div>
              {showBenchmarkExplainer ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              We compare your bill to <strong>CMS benchmark rates</strong> — the standardized pricing 
              system used across US healthcare. These aren't just "Medicare prices" — they're the 
              foundation for how <strong>ALL healthcare is priced</strong>:
            </p>
            
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-success">•</span>
                <span><strong>Insurance companies</strong> typically negotiate 150-300% of benchmark</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning">•</span>
                <span><strong>Self-pay discounts</strong> often target 150-200% of benchmark</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                <span><strong>Hospital list prices</strong> (chargemaster) are often 500-1000%+ of benchmark</span>
              </li>
            </ul>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              This comparison helps you understand if your charges are reasonable and gives you 
              leverage to negotiate.
            </p>
            
            <Button 
              variant="link" 
              size="sm" 
              className="text-primary p-0 h-auto"
              onClick={() => setShowEducationModal(true)}
            >
              Learn more about how benchmark rates are calculated →
            </Button>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Education Modal */}
      <BenchmarkEducationModal 
        isOpen={showEducationModal} 
        onClose={() => setShowEducationModal(false)} 
      />
    </div>
  );
}