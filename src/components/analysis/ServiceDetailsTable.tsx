/**
 * ServiceDetailsTable - Unified table showing ALL services with consistent layout
 * - Fixed-width columns for proper alignment
 * - Status column showing multiples, "Bundled", "No ref", etc.
 * - Expandable rows with CPT explanations
 * - Default collapsed state
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, HelpCircle, Package, Pill, FileQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BenchmarkLineResult } from '@/lib/medicareBenchmarkService';
import { ChargeMeaning } from '@/types';

interface ServiceDetailsTableProps {
  lineItems: BenchmarkLineResult[];
  chargeMeanings?: ChargeMeaning[];
  defaultExpanded?: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Helper: Generate "what it typically involves" based on code type
function getTypicalInvolvement(hcpcs: string, description: string): string | null {
  const code = hcpcs?.toUpperCase() || '';
  const desc = description?.toLowerCase() || '';
  
  // ER visits
  if (code.startsWith('9928') || desc.includes('emergency')) {
    if (code.includes('4') || desc.includes('level 4')) {
      return 'A Level 4 ER visit typically involves a detailed history, examination of multiple body systems, and moderate complexity medical decision-making. This is one of the higher ER levels.';
    }
    if (code.includes('5') || desc.includes('level 5')) {
      return 'A Level 5 ER visit is the highest complexity level, involving comprehensive evaluation and high-complexity decision-making, often for life-threatening conditions.';
    }
    if (code.includes('3') || desc.includes('level 3')) {
      return 'A Level 3 ER visit involves an expanded problem-focused history and examination with low complexity medical decision-making.';
    }
    return 'Emergency department visits are categorized by complexity. Higher levels indicate more evaluation time and medical decision-making.';
  }
  
  // Lab tests
  if (code.startsWith('8') || desc.includes('lab') || desc.includes('panel') || desc.includes('blood')) {
    if (desc.includes('comprehensive') || desc.includes('cmp')) {
      return 'A comprehensive metabolic panel is a blood test that measures 14 different substances including glucose, calcium, and kidney/liver function markers.';
    }
    if (desc.includes('cbc') || desc.includes('complete blood count')) {
      return 'A complete blood count measures red blood cells, white blood cells, and platelets to assess overall health and detect disorders like anemia or infection.';
    }
    return 'Laboratory tests involve collecting samples (blood, urine, etc.) and analyzing them to check for diseases or monitor health conditions.';
  }
  
  // IV therapy
  if (desc.includes('iv') || desc.includes('infusion') || desc.includes('hydration')) {
    return 'IV (intravenous) therapy involves administering fluids, medications, or nutrients directly into the bloodstream through a vein.';
  }
  
  // Imaging
  if (desc.includes('x-ray') || desc.includes('xray')) {
    return 'X-rays use radiation to create images of structures inside the body, commonly used to check for fractures, infections, or abnormalities.';
  }
  if (desc.includes('ct') || desc.includes('computed tomography')) {
    return 'CT scans combine X-rays from multiple angles to create detailed cross-sectional images, providing more detail than standard X-rays.';
  }
  if (desc.includes('mri') || desc.includes('magnetic resonance')) {
    return 'MRI uses magnetic fields and radio waves to create detailed images of organs and tissues, particularly useful for soft tissue imaging.';
  }
  
  // Drugs (J-codes)
  if (code.startsWith('J')) {
    return 'This is a medication administered during your visit. J-codes are used to bill for drugs that are injected or infused.';
  }
  
  // S-codes (private payer)
  if (code.startsWith('S')) {
    return 'This is a private payer code used for services not covered by standard Medicare codes. Pricing varies by insurance.';
  }
  
  return null;
}

// Helper: Generate "why this appears on your bill"
function getWhyOnBill(hcpcs: string, description: string): string {
  const code = hcpcs?.toUpperCase() || '';
  const desc = description?.toLowerCase() || '';
  
  // ER visits
  if (code.startsWith('9928') || desc.includes('emergency')) {
    return 'Emergency room visits include a facility fee for using the ER space and resources, plus a separate physician fee. The level is determined by the complexity of your case as documented by the provider.';
  }
  
  // Lab tests
  if (code.startsWith('8') || desc.includes('lab') || desc.includes('panel') || desc.includes('blood')) {
    return 'Each lab test is typically billed separately, even if multiple tests are run from a single blood draw. Hospitals often charge more than independent labs for the same tests.';
  }
  
  // IV therapy
  if (desc.includes('iv') || desc.includes('infusion') || desc.includes('hydration')) {
    return 'IV therapy charges include the supplies, pharmacy preparation, and nursing time to administer fluids or medications.';
  }
  
  // Imaging
  if (desc.includes('x-ray') || desc.includes('xray') || desc.includes('ct') || desc.includes('mri')) {
    return 'Imaging studies include a technical fee (for the equipment and technician) and often a professional fee (for the radiologist who reads the images).';
  }
  
  // Drugs
  if (code.startsWith('J')) {
    return 'Injectable medications are billed separately from the administration fee. Hospital drug prices are often significantly higher than retail pharmacy prices.';
  }
  
  // Supplies
  if (desc.includes('supply') || desc.includes('kit') || desc.includes('dressing')) {
    return 'Medical supplies are commonly itemized separately. Some supplies have significant markups compared to retail prices.';
  }
  
  // Default
  return 'This service was documented during your visit. Each billable service is assigned a code that determines how it gets charged.';
}

// Component: Show typical involvement info
function ServiceTypicalInfo({ hcpcs, description }: { hcpcs: string; description: string }) {
  const info = getTypicalInvolvement(hcpcs, description);
  
  if (!info) return null;
  
  return (
    <div>
      <p className="text-xs font-medium text-foreground mb-1">What it typically involves:</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{info}</p>
    </div>
  );
}

// Status configuration
type StatusType = 'very_high' | 'high' | 'fair' | 'bundled' | 'no_ref' | 'drug' | 's_code' | 'unknown';

const statusConfig: Record<StatusType, { 
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
}> = {
  very_high: { icon: AlertTriangle, label: '⚠️', color: 'text-destructive', bg: 'bg-destructive/10' },
  high: { icon: AlertTriangle, label: '⚠️', color: 'text-warning', bg: 'bg-warning/10' },
  fair: { icon: CheckCircle, label: '✓', color: 'text-success', bg: 'bg-success/10' },
  bundled: { icon: Package, label: 'Bundled', color: 'text-muted-foreground', bg: 'bg-muted/30' },
  no_ref: { icon: HelpCircle, label: 'No ref', color: 'text-muted-foreground', bg: 'bg-muted/30' },
  drug: { icon: Pill, label: 'Drug', color: 'text-purple-600', bg: 'bg-purple/10' },
  s_code: { icon: FileQuestion, label: 'S-code', color: 'text-muted-foreground', bg: 'bg-muted/30' },
  unknown: { icon: HelpCircle, label: '—', color: 'text-muted-foreground', bg: 'bg-muted/10' },
};

function getStatusType(item: BenchmarkLineResult): StatusType {
  // Check for S-codes (private payer codes)
  if (item.hcpcs?.toUpperCase().startsWith('S')) {
    return 's_code';
  }
  
  // Check for J-codes (drugs)
  if (item.hcpcs?.toUpperCase().startsWith('J')) {
    return 'drug';
  }
  
  // Check match status
  if (item.matchStatus === 'exists_not_priced') {
    const reason = item.notPricedReason as string;
    if (reason === 'packaged' || reason === 'status_indicator_nonpayable') {
      return 'bundled';
    }
    return 'no_ref';
  }
  
  if (item.matchStatus === 'missing') {
    return 'no_ref';
  }
  
  // Has Medicare pricing - check multiple
  if (item.status === 'very_high') return 'very_high';
  if (item.status === 'high') return 'high';
  if (item.status === 'fair') return 'fair';
  
  return 'unknown';
}

function getStatusDisplay(item: BenchmarkLineResult): { label: string; color: string; bg: string } {
  const statusType = getStatusType(item);
  const config = statusConfig[statusType];
  
  // For priced items with multiples, show the multiple
  if (item.multiple && item.multiple > 0 && (statusType === 'very_high' || statusType === 'high' || statusType === 'fair')) {
    return {
      label: `${item.multiple}× ${statusType === 'fair' ? '' : '⚠️'}`,
      color: config.color,
      bg: config.bg,
    };
  }
  
  return {
    label: config.label,
    color: config.color,
    bg: config.bg,
  };
}

function ServiceRow({ 
  item, 
  meaning,
  isExpanded,
  onToggle 
}: { 
  item: BenchmarkLineResult;
  meaning?: ChargeMeaning;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusDisplay = getStatusDisplay(item);
  const hasExpandableContent = item.notes.length > 0 || meaning;
  
  return (
    <div className={cn(
      "border-b border-border/20 last:border-0",
      item.status === 'very_high' && 'bg-destructive/5',
      item.status === 'high' && 'bg-warning/5',
    )}>
      {/* Main Row */}
      <button
        onClick={hasExpandableContent ? onToggle : undefined}
        disabled={!hasExpandableContent}
        className={cn(
          "w-full px-3 py-3 grid grid-cols-[80px_1fr_100px_100px_80px_24px] gap-3 items-center text-left",
          hasExpandableContent && "hover:bg-muted/10 cursor-pointer",
          !hasExpandableContent && "cursor-default"
        )}
      >
        {/* Code Column - Fixed width */}
        <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded text-center truncate">
          {item.hcpcs}
          {item.modifier && <span className="text-muted-foreground">-{item.modifier}</span>}
        </code>
        
        {/* Description Column - Flexible, NO truncation */}
        <div className="min-w-0">
          <p className="text-sm text-foreground leading-snug">
            {item.description || 'Medical service'}
          </p>
        </div>
        
        {/* Billed Amount - Fixed width */}
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">
            {item.billedAmount > 0 ? formatCurrency(item.billedAmount) : '—'}
          </p>
        </div>
        
        {/* Medicare Reference - Fixed width with source badge */}
        <div className="text-right space-y-0.5">
          <p className="text-sm text-muted-foreground">
            {item.medicareReferenceTotal ? formatCurrency(item.medicareReferenceTotal) : '—'}
          </p>
          {/* Show data source badge based on feeSource */}
          {item.feeSource && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-medium",
              item.feeSource === 'opps_rate' || item.feeSource === 'opps_fallback' 
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : item.feeSource === 'clfs_rate'
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            )}>
              {item.feeSource === 'opps_rate' ? 'OPPS' :
               item.feeSource === 'opps_fallback' ? 'OPPS' :
               item.feeSource === 'clfs_rate' ? 'CLFS' :
               item.feeSource === 'rvu_calc_local' ? 'MPFS (Local)' : 
               item.feeSource === 'rvu_calc_national' ? 'MPFS' :
               item.feeSource === 'direct_fee' ? 'MPFS' : ''}
            </span>
          )}
        </div>
        
        {/* Status Column - Fixed width */}
        <div className="text-center">
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs font-medium whitespace-nowrap",
              statusDisplay.bg,
              statusDisplay.color
            )}
          >
            {statusDisplay.label}
          </Badge>
        </div>
        
        {/* Expand Icon - Fixed width */}
        <div className="flex justify-center">
          {hasExpandableContent ? (
            isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <div className="h-4 w-4" />
          )}
        </div>
      </button>
      
      {/* Expanded Content - Educational info about the SERVICE, not pricing */}
      {isExpanded && hasExpandableContent && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-[92px] p-3 rounded-lg bg-muted/20 border border-border/30 space-y-3">
            {/* What this service is */}
            {meaning && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">What this service is:</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {meaning.explanation}
                </p>
              </div>
            )}
            
            {/* What it typically involves - generated from code type */}
            <ServiceTypicalInfo hcpcs={item.hcpcs} description={item.description} />
            
            {/* Common reasons this appears on bills */}
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Why this might appear on your bill:</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {getWhyOnBill(item.hcpcs, item.description)}
              </p>
            </div>
            
            {/* Bundled/packaged explanation */}
            {item.isBundled && (
              <div className="p-2 rounded bg-info/10 border border-info/20">
                <p className="text-xs text-info-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  This service is typically bundled with another procedure, meaning it may already be included in another charge.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ServiceDetailsTable({ 
  lineItems, 
  chargeMeanings = [],
  defaultExpanded = false 
}: ServiceDetailsTableProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Create a map of code -> meaning for quick lookup
  const meaningByCode = new Map<string, ChargeMeaning>();
  for (const meaning of chargeMeanings) {
    if (meaning.cptCode) {
      meaningByCode.set(meaning.cptCode, meaning);
    }
  }
  
  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (lineItems.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-muted/20 border border-border/30 text-center">
        <p className="text-sm text-muted-foreground">No service details available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-muted/30 border-b border-border/30 flex items-center justify-between hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Service Details
          </span>
          <Badge variant="outline" className="text-xs">
            {lineItems.length} items
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isExpanded ? 'Click to collapse' : 'Click to expand'}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <>
          {/* Column Headers */}
          <div className="px-3 py-2 bg-muted/20 border-b border-border/30 grid grid-cols-[80px_1fr_100px_100px_80px_24px] gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="text-center">Code</span>
            <span>Service Description</span>
            <span className="text-right">Billed</span>
            <span className="text-right">Medicare</span>
            <span className="text-center">Status</span>
            <span></span>
          </div>
          
          {/* Rows */}
          <div className="divide-y divide-border/20">
            {lineItems.map((item, idx) => {
              const key = `${item.hcpcs}-${idx}`;
              return (
                <ServiceRow
                  key={key}
                  item={item}
                  meaning={meaningByCode.get(item.hcpcs)}
                  isExpanded={expandedRows.has(key)}
                  onToggle={() => toggleRow(key)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
