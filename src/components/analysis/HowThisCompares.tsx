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
 * - Three distinct empty states for clarity
 * - Debug panel for troubleshooting
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  ExternalLink,
  Bug,
  FileQuestion,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  calculateMedicareBenchmarks,
  generateBenchmarkStatement,
  generateComparisonSentence,
  generateConfidenceQualifier,
  generateYearFallbackDisclosure,
  generateOverallStatus,
  MedicareBenchmarkOutput,
  BenchmarkLineItem,
  BenchmarkLineResult,
  normalizeCode,
  isValidBillableCode,
  NormalizedCode
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

/**
 * Extract line items from analysis with improved code detection
 * 
 * This function:
 * 1. Extracts ALL codes found in the analysis (cptCodes, chargeMeanings, charges)
 * 2. Normalizes them using the same logic as the benchmark service
 * 3. Creates line items even if we can't match to a specific charge (uses $0 as placeholder)
 */
function extractLineItems(analysis: AnalysisResult): { items: BenchmarkLineItem[]; rawCodes: string[] } {
  const items: BenchmarkLineItem[] = [];
  const rawCodes: string[] = [];
  const seenCodes = new Set<string>();
  
  // 1. Extract from cptCodes array (most structured source)
  if (analysis.cptCodes && analysis.cptCodes.length > 0) {
    for (const cpt of analysis.cptCodes) {
      if (!cpt.code) continue;
      
      rawCodes.push(cpt.code);
      const normalized = normalizeCode(cpt.code);
      
      if (!isValidBillableCode(normalized)) continue;
      if (seenCodes.has(normalized.hcpcs)) continue;
      seenCodes.add(normalized.hcpcs);
      
      // Try to find matching charge by code in description
      const matchingCharge = analysis.charges?.find(c => 
        c.description?.includes(cpt.code) || 
        c.description?.includes(normalized.hcpcs)
      );
      
      // Also try matching by procedure name
      const matchByName = !matchingCharge && analysis.charges?.find(c =>
        cpt.shortLabel && c.description?.toLowerCase().includes(cpt.shortLabel.toLowerCase())
      );
      
      const charge = matchingCharge || matchByName;
      
      items.push({
        hcpcs: normalized.hcpcs,
        rawCode: cpt.code,
        description: cpt.shortLabel || cpt.explanation,
        billedAmount: charge?.amount ?? 0,
        units: 1,
        modifier: normalized.modifier,
        isFacility: cpt.category === 'surgery'
      });
    }
  }
  
  // 2. Extract from chargeMeanings (may have additional codes)
  if (analysis.chargeMeanings) {
    for (const cm of analysis.chargeMeanings) {
      if (!cm.cptCode) continue;
      
      rawCodes.push(cm.cptCode);
      const normalized = normalizeCode(cm.cptCode);
      
      if (!isValidBillableCode(normalized)) continue;
      if (seenCodes.has(normalized.hcpcs)) continue;
      seenCodes.add(normalized.hcpcs);
      
      // Try to find matching charge
      const matchingCharge = analysis.charges?.find(c => 
        c.description?.toLowerCase().includes(cm.procedureName?.toLowerCase() || '') ||
        c.description?.includes(cm.cptCode || '')
      );
      
      items.push({
        hcpcs: normalized.hcpcs,
        rawCode: cm.cptCode,
        description: cm.procedureName || cm.explanation,
        billedAmount: matchingCharge?.amount ?? 0,
        units: 1,
        modifier: normalized.modifier
      });
    }
  }
  
  // 3. Scan charges for codes that might be in descriptions (fallback)
  if (analysis.charges) {
    for (const charge of analysis.charges) {
      if (!charge.description) continue;
      
      // Look for CPT/HCPCS patterns in description
      const codeMatches = charge.description.match(/\b([A-Z0-9]{5})\b/gi) || [];
      
      for (const match of codeMatches) {
        rawCodes.push(match);
        const normalized = normalizeCode(match);
        
        if (!isValidBillableCode(normalized)) continue;
        if (seenCodes.has(normalized.hcpcs)) continue;
        seenCodes.add(normalized.hcpcs);
        
        items.push({
          hcpcs: normalized.hcpcs,
          rawCode: match,
          description: charge.description,
          billedAmount: charge.amount ?? 0,
          units: 1,
          modifier: normalized.modifier
        });
      }
    }
  }
  
  // 4. Check suggestedCpts if nothing found yet
  if (items.length === 0 && analysis.suggestedCpts) {
    for (const suggested of analysis.suggestedCpts) {
      if (!suggested.candidates) continue;
      
      for (const candidate of suggested.candidates) {
        if (!candidate.cpt) continue;
        
        rawCodes.push(candidate.cpt);
        const normalized = normalizeCode(candidate.cpt);
        
        if (!isValidBillableCode(normalized)) continue;
        if (seenCodes.has(normalized.hcpcs)) continue;
        seenCodes.add(normalized.hcpcs);
        
        items.push({
          hcpcs: normalized.hcpcs,
          rawCode: candidate.cpt,
          description: candidate.shortLabel || candidate.explanation,
          billedAmount: 0, // Suggested codes don't have matched charges
          units: 1,
          modifier: normalized.modifier
        });
      }
    }
  }
  
  return { items, rawCodes };
}

/**
 * Extract service date from analysis
 */
function extractServiceDate(analysis: AnalysisResult): string | null {
  if (analysis.dateOfService) {
    return analysis.dateOfService;
  }
  return null;
}

// ============= Sub-Components =============

function DebugPanel({ 
  output, 
  rawCodes, 
  serviceDate 
}: { 
  output: MedicareBenchmarkOutput; 
  rawCodes: string[];
  serviceDate: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs font-mono">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-muted-foreground hover:text-foreground"
      >
        <Bug className="h-3 w-3" />
        <span>Benchmark Debug Info</span>
        {expanded ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>
      
      {expanded && (
        <div className="mt-3 space-y-2 text-muted-foreground">
          <div><strong>Status:</strong> {output.status}</div>
          <div><strong>Service Date Found:</strong> {serviceDate || 'None'}</div>
          <div><strong>Requested Years:</strong> {output.metadata.requestedYears.join(', ') || 'None'}</div>
          <div><strong>Benchmark Year Used:</strong> {output.metadata.benchmarkYearUsed}</div>
          <div><strong>Latest MPFS Year:</strong> {output.debug.latestMpfsYear}</div>
          <div><strong>Used Year Fallback:</strong> {output.metadata.usedYearFallback ? 'Yes' : 'No'}</div>
          {output.metadata.fallbackReason && (
            <div><strong>Fallback Reason:</strong> {output.metadata.fallbackReason}</div>
          )}
          <div><strong>Locality:</strong> {output.metadata.localityName || 'National'} ({output.metadata.localityUsed})</div>
          
          <div className="pt-2 border-t border-border/30">
            <strong>Raw Codes Extracted ({rawCodes.length}):</strong>
            <div className="mt-1 flex flex-wrap gap-1">
              {rawCodes.length > 0 ? rawCodes.slice(0, 20).map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
              )) : <span className="text-destructive">None</span>}
              {rawCodes.length > 20 && <span>+{rawCodes.length - 20} more</span>}
            </div>
          </div>
          
          <div>
            <strong>Normalized Codes ({output.debug.normalizedCodes.length}):</strong>
            <div className="mt-1 flex flex-wrap gap-1">
              {output.debug.normalizedCodes.length > 0 ? output.debug.normalizedCodes.slice(0, 20).map((c, i) => (
                <Badge key={i} variant="outline" className={cn("text-xs", isValidBillableCode(c) ? "" : "border-destructive text-destructive")}>
                  {c.hcpcs || '(empty)'}{c.modifier && `-${c.modifier}`}
                </Badge>
              )) : <span className="text-destructive">None</span>}
            </div>
          </div>
          
          <div>
            <strong>Matched ({output.debug.codesMatched.length}):</strong>{' '}
            {output.debug.codesMatched.join(', ') || 'None'}
          </div>
          
          <div>
            <strong>Missing ({output.debug.codesMissing.length}):</strong>{' '}
            {output.debug.codesMissing.slice(0, 10).join(', ') || 'None'}
            {output.debug.codesMissing.length > 10 && ` +${output.debug.codesMissing.length - 10} more`}
          </div>
          
          <div className="pt-2 border-t border-border/30">
            <strong>Queries Attempted:</strong>
            <div className="mt-1 max-h-32 overflow-y-auto">
              {output.debug.queriesAttempted.map((q, i) => (
                <div key={i} className={q.row_exists ? 'text-success' : 'text-destructive'}>
                  {q.hcpcs} (year: {q.year}) → {q.row_exists ? `✓ Found (fee: ${q.has_fee}, rvu: ${q.has_rvu})` : '✗ Not found'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
          {item.modifier && (
            <code className="text-xs font-mono text-muted-foreground ml-1">
              -{item.modifier}
            </code>
          )}
        </div>
        
        {/* Description */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {item.description || 'Medical service'}
          </p>
          {item.benchmarkYearUsed && item.matchStatus === 'matched' && (
            <p className="text-xs text-muted-foreground">
              {item.benchmarkYearUsed} Medicare rate
            </p>
          )}
        </div>
        
        {/* Billed */}
        <div className="w-24 text-right shrink-0">
          <p className="text-sm font-semibold text-foreground">
            {item.billedAmount > 0 ? formatCurrency(item.billedAmount) : '—'}
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
  const yearFallbackDisclosure = generateYearFallbackDisclosure(output);
  
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
        
        {/* Year Fallback Disclosure */}
        {yearFallbackDisclosure && (
          <div className="mt-3 p-3 rounded bg-warning/10 border border-warning/20">
            <p className="text-sm text-warning-foreground flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              {yearFallbackDisclosure}
            </p>
          </div>
        )}
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-4 rounded-xl bg-background/60 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Total Billed</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(output.totals.billedTotal)}
          </p>
        </div>
        <div className="text-center p-4 rounded-xl bg-background/60 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">
            Medicare Reference ({output.metadata.benchmarkYearUsed})
          </p>
          <p className="text-2xl font-bold text-foreground">
            {output.totals.medicareReferenceTotal 
              ? formatCurrency(output.totals.medicareReferenceTotal)
              : 'N/A'
            }
          </p>
        </div>
        <div className="text-center p-4 rounded-xl bg-background/60 border border-border/30">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wide">Multiple</p>
          <p className={cn('text-2xl font-bold', config.color)}>
            {output.totals.multipleOfMedicare 
              ? `${output.totals.multipleOfMedicare}×`
              : 'N/A'
            }
          </p>
        </div>
      </div>
      
      {/* Flagged Items & Potential Savings */}
      <div className="flex items-center justify-between pt-4 border-t border-border/30">
        {output.totals.multipleOfMedicare && output.totals.multipleOfMedicare > 1.5 && output.totals.medicareReferenceTotal ? (
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-success" />
            <span className="text-sm">
              <span className="font-semibold text-success">
                Potential savings: {formatCurrency(output.totals.billedTotal - (output.totals.medicareReferenceTotal * 1.5))}
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
            {codes.slice(0, 8).map(code => (
              <Badge key={code} variant="outline" className="text-xs">
                {code}
              </Badge>
            ))}
            {codes.length > 8 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{codes.length - 8} more
              </Badge>
            )}
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

// ============= Empty State Components =============

function NoCodesEmptyState() {
  return (
    <div className="p-6 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-muted/30">
          <FileQuestion className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-base font-medium text-foreground mb-2">
            No CPT/HCPCS codes detected
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            We couldn't detect any CPT or HCPCS codes in this bill, so we can't compute 
            Medicare benchmarks yet. This might happen if:
          </p>
          <ul className="text-sm text-muted-foreground list-disc ml-4 mb-4 space-y-1">
            <li>The bill image is blurry or partially cut off</li>
            <li>This is a summary bill without itemized procedure codes</li>
            <li>The codes are in a format we don't recognize yet</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            <strong>Try:</strong> Uploading a clearer image or a more detailed itemized statement.
          </p>
        </div>
      </div>
    </div>
  );
}

function NoMatchesEmptyState({ 
  output, 
  rawCodes 
}: { 
  output: MedicareBenchmarkOutput; 
  rawCodes: string[];
}) {
  const sampleCodes = output.debug.normalizedCodes
    .filter(c => isValidBillableCode(c))
    .slice(0, 8)
    .map(c => c.hcpcs);
  
  return (
    <div className="p-6 rounded-xl bg-muted/20 border border-border/30">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-warning/10">
          <Search className="h-6 w-6 text-warning" />
        </div>
        <div>
          <p className="text-base font-medium text-foreground mb-2">
            Codes detected, but no Medicare matches found
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            CPT/HCPCS codes were detected, but we couldn't find Medicare reference pricing 
            for them in our current dataset.
          </p>
          
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Codes found:</strong>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sampleCodes.map(code => (
                <Badge key={code} variant="outline" className="text-xs">
                  {code}
                </Badge>
              ))}
              {output.debug.normalizedCodes.length > 8 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{output.debug.normalizedCodes.length - 8} more
                </Badge>
              )}
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground space-y-1 mb-4">
            <p><strong>Year requested:</strong> {output.metadata.requestedYears.join(', ') || 'Unknown'}</p>
            <p><strong>Year searched:</strong> {output.metadata.benchmarkYearUsed}</p>
          </div>
          
          <p className="text-sm text-muted-foreground">
            <strong>Possible reasons:</strong> These may be newer codes, DME codes, 
            or services outside the Medicare Physician Fee Schedule. You can still 
            use other sections of this analysis to understand your bill.
          </p>
        </div>
      </div>
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
  const [showDebug, setShowDebug] = useState(false);
  const [rawCodes, setRawCodes] = useState<string[]>([]);
  const [serviceDate, setServiceDate] = useState<string | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    
    async function fetchBenchmarks() {
      setLoading(true);
      setError(null);
      
      try {
        // Extract service date
        const extractedDate = extractServiceDate(analysis);
        setServiceDate(extractedDate);
        
        // Extract line items with improved logic
        const { items: lineItems, rawCodes: extractedRawCodes } = extractLineItems(analysis);
        setRawCodes(extractedRawCodes);
        
        console.log('[HowThisCompares] Extracted line items:', lineItems.length);
        console.log('[HowThisCompares] Raw codes found:', extractedRawCodes);
        console.log('[HowThisCompares] Service date:', extractedDate);
        
        // Apply service date to all items if not already set
        const itemsWithDate = lineItems.map(item => ({
          ...item,
          dateOfService: item.dateOfService || extractedDate || undefined,
          isFacility: careSetting === 'facility' ? true : item.isFacility
        }));
        
        const result = await calculateMedicareBenchmarks(
          itemsWithDate,
          state,
          zipCode
        );
        
        console.log('[HowThisCompares] Benchmark result:', result.status);
        console.log('[HowThisCompares] Debug info:', result.debug);
        
        if (!cancelled) {
          setOutput(result);
        }
      } catch (err) {
        console.error('[HowThisCompares] Medicare benchmark error:', err);
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
  if (error && !output) {
    return (
      <div className="p-6 rounded-xl bg-muted/20 border border-border/30 text-center">
        <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {error}
        </p>
      </div>
    );
  }
  
  // No output at all
  if (!output) {
    return (
      <div className="p-6 rounded-xl bg-muted/20 border border-border/30 text-center">
        <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Medicare comparison not available
        </p>
      </div>
    );
  }
  
  // === DISTINCT EMPTY STATES ===
  
  // State 1: NO codes extracted at all
  if (output.status === 'no_codes') {
    return (
      <div className="space-y-4">
        <NoCodesEmptyState />
        
        {/* Debug toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="debug-mode"
            checked={showDebug}
            onCheckedChange={setShowDebug}
          />
          <Label htmlFor="debug-mode" className="text-xs text-muted-foreground">
            Show debug info
          </Label>
        </div>
        
        {showDebug && (
          <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} />
        )}
      </div>
    );
  }
  
  // State 2: Codes extracted but NO MPFS matches
  if (output.status === 'no_matches') {
    return (
      <div className="space-y-4">
        <NoMatchesEmptyState output={output} rawCodes={rawCodes} />
        <EducationalFooter />
        
        {/* Debug toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="debug-mode"
            checked={showDebug}
            onCheckedChange={setShowDebug}
          />
          <Label htmlFor="debug-mode" className="text-xs text-muted-foreground">
            Show debug info
          </Label>
        </div>
        
        {showDebug && (
          <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} />
        )}
      </div>
    );
  }
  
  // State 3 & 4: We have SOME or ALL matches - show the comparison
  
  // Determine how many items to show
  const displayItems = showAllItems 
    ? output.lineItems 
    : output.lineItems.slice(0, 5);
  
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <SummaryCard output={output} />
      
      {/* Partial match notice */}
      {output.status === 'partial' && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-sm text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
            Some services on this bill could not be matched to Medicare reference prices. 
            The comparison above covers only the matched items.
          </p>
        </div>
      )}
      
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
      
      {/* Debug toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="debug-mode"
          checked={showDebug}
          onCheckedChange={setShowDebug}
        />
        <Label htmlFor="debug-mode" className="text-xs text-muted-foreground">
          Show benchmark debug info
        </Label>
      </div>
      
      {showDebug && (
        <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} />
      )}
    </div>
  );
}
