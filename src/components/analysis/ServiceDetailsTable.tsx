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
        
        {/* Medicare Reference - Fixed width */}
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            {item.medicareReferenceTotal ? formatCurrency(item.medicareReferenceTotal) : '—'}
          </p>
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
      
      {/* Expanded Content */}
      {isExpanded && hasExpandableContent && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-[92px] p-3 rounded-lg bg-muted/20 border border-border/30 space-y-3">
            {/* CPT Code Explanation */}
            {meaning && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">What this means:</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {meaning.explanation}
                </p>
              </div>
            )}
            
            {/* Notes from benchmark */}
            {item.notes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Why the price may differ:</p>
                {item.notes.map((note, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
                    {note}
                  </p>
                ))}
              </div>
            )}
            
            {/* Common billing issues */}
            {meaning?.commonBillingIssues && meaning.commonBillingIssues.length > 0 && (
              <div className="p-2 rounded bg-warning/10 border border-warning/20">
                <p className="text-xs font-medium text-warning-foreground mb-1">Things to check:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {meaning.commonBillingIssues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-warning">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Bundled/packaged explanation */}
            {item.isBundled && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                This service is typically bundled with a primary procedure
              </p>
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
