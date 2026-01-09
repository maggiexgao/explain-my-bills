/**
 * How This Compares Section
 * 
 * Displays Medicare benchmark comparison in a user-friendly,
 * trust-building format following approved language guidelines.
 * 
 * Key principles:
 * - Medicare is a REFERENCE ANCHOR, not "what you should pay"
 * - Calm, non-judgmental, educational tone
 * - No raw jargon (RVUs, GPCI) exposed to users
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  calculateMedicareBenchmarks,
  generateBenchmarkStatement,
  generateComparisonSentence,
  generateConfidenceQualifier,
  generateOverallStatus,
  MedicareBenchmarkOutput,
  BenchmarkLineItem,
  BenchmarkLineResult
} from '@/lib/medicareBenchmarkService';
import { AnalysisResult, CareSetting } from '@/types';

// ============= Props =============

interface HowThisComparesProps {
  analysis: AnalysisResult;
  state: string;
  zipCode?: string;
  careSetting?: CareSetting;
}

// ============= Status Configuration =============

const statusConfig = {
  fair: {
    icon: CheckCircle,
    label: 'Within Typical Range',
    color: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    description: 'Your charges fall within the range commonly seen with commercial insurance.'
  },
  high: {
    icon: TrendingUp,
    label: 'Higher Than Typical',
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    description: 'Some charges are above typical rates. You may want to ask questions.'
  },
  very_high: {
    icon: AlertTriangle,
    label: 'Significantly Above Reference',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    description: 'These charges are notably higher than reference prices.'
  },
  mixed: {
    icon: Minus,
    label: 'Mixed Results',
    color: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    description: 'Some charges are fair, others may warrant discussion.'
  },
  unknown: {
    icon: HelpCircle,
    label: 'Limited Data',
    color: 'text-muted-foreground',
    bg: 'bg-muted/10',
    border: 'border-border/40',
    description: 'Not enough data available for a full comparison.'
  }
};

const lineStatusConfig = {
  fair: {
    icon: CheckCircle,
    label: 'Fair',
    color: 'text-success',
    bg: 'bg-success/10'
  },
  high: {
    icon: AlertTriangle,
    label: 'High',
    color: 'text-warning',
    bg: 'bg-warning/10'
  },
  very_high: {
    icon: AlertCircle,
    label: 'Very High',
    color: 'text-destructive',
    bg: 'bg-destructive/10'
  },
  unknown: {
    icon: HelpCircle,
    label: 'N/A',
    color: 'text-muted-foreground',
    bg: 'bg-muted/10'
  }
};

// ============= Helper Functions =============

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

function extractLineItems(analysis: AnalysisResult): BenchmarkLineItem[] {
  const items: BenchmarkLineItem[] = [];
  
  // Extract from cptCodes
  if (analysis.cptCodes && analysis.cptCodes.length > 0) {
    for (const cpt of analysis.cptCodes) {
      // Try to find matching charge
      const matchingCharge = analysis.charges?.find(c => 
        c.description?.includes(cpt.code) || 
        cpt.shortLabel?.toLowerCase().includes(c.description?.toLowerCase() || '')
      );
      
      if (matchingCharge && matchingCharge.amount > 0) {
        items.push({
          hcpcs: cpt.code,
          description: cpt.shortLabel || cpt.explanation,
          billedAmount: matchingCharge.amount,
          units: 1,
          isFacility: cpt.category === 'surgery'
        });
      }
    }
  }
  
  // Also extract from chargeMeanings
  if (items.length === 0 && analysis.chargeMeanings) {
    for (const cm of analysis.chargeMeanings) {
      if (cm.cptCode) {
        const matchingCharge = analysis.charges?.find(c => 
          c.description?.toLowerCase().includes(cm.procedureName?.toLowerCase() || '')
        );
        
        if (matchingCharge && matchingCharge.amount > 0) {
          items.push({
            hcpcs: cm.cptCode,
            description: cm.procedureName,
            billedAmount: matchingCharge.amount,
            units: 1
          });
        }
      }
    }
  }
  
  return items;
}

// ============= Sub-Components =============

function LineItemCard({ item }: { item: BenchmarkLineResult }) {
  const [expanded, setExpanded] = useState(false);
  const config = lineStatusConfig[item.status];
  const StatusIcon = config.icon;
  
  return (
    <div className={cn(
      'border rounded-lg transition-all',
      item.status === 'very_high' && 'border-destructive/30 bg-destructive/5',
      item.status === 'high' && 'border-warning/30 bg-warning/5',
      item.status === 'fair' && 'border-border/30',
      item.status === 'unknown' && 'border-border/20 bg-muted/5'
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-4 text-left hover:bg-muted/10 transition-colors"
      >
        {/* CPT Code */}
        <div className="w-20 shrink-0">
          <code className="text-sm font-mono bg-muted/40 px-2 py-1 rounded">
            {item.hcpcs}
          </code>
        </div>
        
        {/* Description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {item.description || 'Medical service'}
          </p>
        </div>
        
        {/* Billed */}
        <div className="w-24 text-right shrink-0">
          <p className="text-sm font-semibold text-foreground">
            {formatCurrency(item.billedAmount)}
          </p>
          <p className="text-xs text-muted-foreground">billed</p>
        </div>
        
        {/* Medicare Reference */}
        <div className="w-24 text-right shrink-0">
          <p className="text-sm text-muted-foreground">
            {item.medicareReferenceTotal 
              ? formatCurrency(item.medicareReferenceTotal)
              : '—'
            }
          </p>
          <p className="text-xs text-muted-foreground">reference</p>
        </div>
        
        {/* Multiple */}
        <div className="w-16 text-right shrink-0">
          <p className={cn('text-sm font-semibold', config.color)}>
            {item.multiple ? `${item.multiple}×` : '—'}
          </p>
        </div>
        
        {/* Status Badge */}
        <Badge className={cn('shrink-0', config.bg, config.color)}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
        
        {/* Expand Icon */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      
      {/* Expanded Details */}
      {expanded && item.notes.length > 0 && (
        <div className="px-4 pb-4 pt-0">
          <div className={cn('p-3 rounded-lg text-sm', config.bg)}>
            {item.notes.map((note, idx) => (
              <p key={idx} className="text-muted-foreground">
                {note}
              </p>
            ))}
            {item.isBundled && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Info className="h-3 w-3" />
                This code may include related follow-up services
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ output }: { output: MedicareBenchmarkOutput }) {
  const { status, message } = generateOverallStatus(output);
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  
  const benchmarkStatement = generateBenchmarkStatement(output);
  const comparisonSentence = generateComparisonSentence(output);
  const confidenceQualifier = generateConfidenceQualifier(output);
  
  const flaggedCount = output.lineItems.filter(
    i => i.status === 'high' || i.status === 'very_high'
  ).length;
  
  return (
    <Card className={cn('p-6 border-2', config.border, config.bg)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className={cn('p-3 rounded-xl', config.bg, config.color)}>
            <StatusIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              How This Compares
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {message}
            </p>
          </div>
        </div>
        <Badge className={cn('shrink-0 text-sm px-3 py-1', config.bg, config.color)}>
          {config.label}
        </Badge>
      </div>
      
      {/* Benchmark Statements */}
      <div className="space-y-3 mb-6 p-4 rounded-lg bg-background/60 border border-border/30">
        <p className="text-base text-foreground">
          {benchmarkStatement}
        </p>
        {comparisonSentence && (
          <p className="text-base font-medium text-foreground">
            {comparisonSentence}
          </p>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{confidenceQualifier}</span>
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 rounded-xl bg-background/60 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Total Billed</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(output.totalBilled)}
          </p>
        </div>
        <div className="text-center p-4 rounded-xl bg-background/60 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Medicare Reference</p>
          <p className="text-2xl font-bold text-foreground">
            {output.totalMedicareReference 
              ? formatCurrency(output.totalMedicareReference)
              : 'N/A'
            }
          </p>
        </div>
        <div className="text-center p-4 rounded-xl bg-background/60 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Multiple</p>
          <p className={cn('text-2xl font-bold', config.color)}>
            {output.multipleOfMedicare 
              ? `${output.multipleOfMedicare}×`
              : 'N/A'
            }
          </p>
        </div>
      </div>
      
      {/* Flagged Items & Potential Savings */}
      <div className="flex items-center justify-between pt-4 border-t border-border/30">
        {output.multipleOfMedicare && output.multipleOfMedicare > 1.5 && output.totalMedicareReference ? (
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-success" />
            <span className="text-sm">
              <span className="font-semibold text-success">
                Potential savings: {formatCurrency(output.totalBilled - (output.totalMedicareReference * 1.5))}
              </span>
              <span className="text-muted-foreground ml-1">
                if negotiated to 150% of reference
              </span>
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            Charges appear reasonable relative to Medicare reference
          </span>
        )}
        
        {flaggedCount > 0 && (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            {flaggedCount} item{flaggedCount > 1 ? 's' : ''} to review
          </Badge>
        )}
      </div>
    </Card>
  );
}

function CodesNotFoundSection({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;
  
  return (
    <div className="p-4 rounded-lg bg-muted/20 border border-border/30">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            Some codes not in Medicare dataset
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            These specialized codes are excluded from the comparison. 
            They may be newer codes, DME, or services not covered under the physician fee schedule.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {codes.map(code => (
              <Badge key={code} variant="outline" className="text-xs">
                {code}
              </Badge>
            ))}
          </div>
          <a 
            href="https://www.cms.gov/medicare/payment/fee-schedules/physician"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Look up on CMS.gov
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function EducationalFooter() {
  return (
    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
      <p className="text-sm text-muted-foreground leading-relaxed">
        <strong className="text-foreground">About these comparisons:</strong>{' '}
        Medicare reference prices are set by the federal government and are often used 
        by insurers, employers, and courts as benchmarks. Commercial insurance typically 
        pays 100-300% of Medicare rates. These comparisons help you understand your 
        charges in context — not what you "should" pay, but how they relate to a 
        widely-used reference point.
      </p>
    </div>
  );
}

// ============= Main Component =============

export function HowThisCompares({ 
  analysis, 
  state, 
  zipCode,
  careSetting = 'office'
}: HowThisComparesProps) {
  const [output, setOutput] = useState<MedicareBenchmarkOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllItems, setShowAllItems] = useState(false);
  
  useEffect(() => {
    let cancelled = false;
    
    async function fetchBenchmarks() {
      setLoading(true);
      setError(null);
      
      try {
        const lineItems = extractLineItems(analysis);
        
        if (lineItems.length === 0) {
          setError('No billable CPT codes found to compare');
          setLoading(false);
          return;
        }
        
        // Apply facility setting
        const adjustedItems = lineItems.map(item => ({
          ...item,
          isFacility: careSetting === 'facility' ? true : item.isFacility
        }));
        
        const result = await calculateMedicareBenchmarks(
          adjustedItems,
          state,
          zipCode
        );
        
        if (!cancelled) {
          setOutput(result);
        }
      } catch (err) {
        console.error('Medicare benchmark error:', err);
        if (!cancelled) {
          setError('Unable to load Medicare comparison data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    
    if (state) {
      fetchBenchmarks();
    } else {
      setLoading(false);
      setError('Select a state to see Medicare comparisons');
    }
    
    return () => {
      cancelled = true;
    };
  }, [analysis, state, zipCode, careSetting]);
  
  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    );
  }
  
  // Error state
  if (error || !output) {
    return (
      <div className="p-6 rounded-xl bg-muted/20 border border-border/30 text-center">
        <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {error || 'Medicare comparison not available'}
        </p>
      </div>
    );
  }
  
  // No data with benchmarks
  const hasAnyBenchmark = output.lineItems.some(i => i.medicareReferenceTotal !== null);
  if (!hasAnyBenchmark) {
    return (
      <div className="p-6 rounded-xl bg-muted/20 border border-border/30">
        <div className="flex items-start gap-4">
          <Info className="h-6 w-6 text-muted-foreground shrink-0" />
          <div>
            <p className="text-base font-medium text-foreground mb-2">
              Medicare reference data not available
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              The codes on this bill ({output.codesNotFound.join(', ')}) are not included 
              in the Medicare Physician Fee Schedule. This is common for specialized 
              services, certain drugs, or codes specific to commercial insurance.
            </p>
            <a 
              href="https://www.cms.gov/medicare/payment/fee-schedules/physician"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Search CMS.gov for these codes
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }
  
  // Determine how many items to show
  const displayItems = showAllItems 
    ? output.lineItems 
    : output.lineItems.slice(0, 5);
  
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <SummaryCard output={output} />
      
      {/* Line Item Details */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">
            Service-by-Service Breakdown ({output.lineItems.length} items)
          </h4>
          {output.lineItems.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllItems(!showAllItems)}
              className="text-xs"
            >
              {showAllItems ? 'Show Less' : `Show All ${output.lineItems.length}`}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {displayItems.map((item, idx) => (
            <LineItemCard key={`${item.hcpcs}-${idx}`} item={item} />
          ))}
        </div>
      </div>
      
      {/* Codes Not Found */}
      <CodesNotFoundSection codes={output.codesNotFound} />
      
      {/* Educational Footer */}
      <EducationalFooter />
    </div>
  );
}
