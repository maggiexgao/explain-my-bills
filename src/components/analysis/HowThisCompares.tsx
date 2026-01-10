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
  NormalizedCode,
  GeoDebugInfo
} from '@/lib/medicareBenchmarkService';
import { 
  normalizeAndValidateCode, 
  validateCodeTokens,
  ValidatedCode,
  RejectedToken
} from '@/lib/cptCodeValidator';
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
function extractLineItems(analysis: AnalysisResult): { 
  items: BenchmarkLineItem[]; 
  rawCodes: string[];
  rejectedTokens: RejectedToken[];
} {
  const items: BenchmarkLineItem[] = [];
  const rawCodes: string[] = [];
  const rejectedTokens: RejectedToken[] = [];
  const seenCodes = new Set<string>();
  
  // 1. Extract from cptCodes array (most structured source)
  if (analysis.cptCodes && analysis.cptCodes.length > 0) {
    for (const cpt of analysis.cptCodes) {
      if (!cpt.code) continue;
      
      rawCodes.push(cpt.code);
      
      // Use strict validation
      const validated = normalizeAndValidateCode(cpt.code);
      
      if (validated.kind === 'invalid' || !validated.code) {
        rejectedTokens.push({ token: cpt.code, reason: validated.reason || 'Invalid format' });
        continue;
      }
      
      if (seenCodes.has(validated.code)) continue;
      seenCodes.add(validated.code);
      
      // Try to find matching charge by code in description
      const matchingCharge = analysis.charges?.find(c => 
        c.description?.includes(cpt.code) || 
        c.description?.includes(validated.code!)
      );
      
      // Also try matching by procedure name
      const matchByName = !matchingCharge && analysis.charges?.find(c =>
        cpt.shortLabel && c.description?.toLowerCase().includes(cpt.shortLabel.toLowerCase())
      );
      
      const charge = matchingCharge || matchByName;
      
      items.push({
        hcpcs: validated.code,
        rawCode: cpt.code,
        description: cpt.shortLabel || cpt.explanation,
        billedAmount: charge?.amount ?? 0,
        units: 1,
        modifier: validated.modifier || undefined,
        isFacility: cpt.category === 'surgery'
      });
    }
  }
  
  // 2. Extract from chargeMeanings (may have additional codes)
  if (analysis.chargeMeanings) {
    for (const cm of analysis.chargeMeanings) {
      if (!cm.cptCode) continue;
      
      rawCodes.push(cm.cptCode);
      
      // Use strict validation
      const validated = normalizeAndValidateCode(cm.cptCode);
      
      if (validated.kind === 'invalid' || !validated.code) {
        rejectedTokens.push({ token: cm.cptCode, reason: validated.reason || 'Invalid format' });
        continue;
      }
      
      if (seenCodes.has(validated.code)) continue;
      seenCodes.add(validated.code);
      
      // Try to find matching charge
      const matchingCharge = analysis.charges?.find(c => 
        c.description?.toLowerCase().includes(cm.procedureName?.toLowerCase() || '') ||
        c.description?.includes(cm.cptCode || '')
      );
      
      items.push({
        hcpcs: validated.code,
        rawCode: cm.cptCode,
        description: cm.procedureName || cm.explanation,
        billedAmount: matchingCharge?.amount ?? 0,
        units: 1,
        modifier: validated.modifier || undefined
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
        
        // Use strict validation
        const validated = normalizeAndValidateCode(match);
        
        if (validated.kind === 'invalid' || !validated.code) {
          rejectedTokens.push({ token: match, reason: validated.reason || 'Invalid format' });
          continue;
        }
        
        if (seenCodes.has(validated.code)) continue;
        seenCodes.add(validated.code);
        
        items.push({
          hcpcs: validated.code,
          rawCode: match,
          description: charge.description,
          billedAmount: charge.amount ?? 0,
          units: 1,
          modifier: validated.modifier || undefined
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
        
        // Use strict validation
        const validated = normalizeAndValidateCode(candidate.cpt);
        
        if (validated.kind === 'invalid' || !validated.code) {
          rejectedTokens.push({ token: candidate.cpt, reason: validated.reason || 'Invalid format' });
          continue;
        }
        
        if (seenCodes.has(validated.code)) continue;
        seenCodes.add(validated.code);
        
        items.push({
          hcpcs: validated.code,
          rawCode: candidate.cpt,
          description: candidate.shortLabel || candidate.explanation,
          billedAmount: 0, // Suggested codes don't have matched charges
          units: 1,
          modifier: validated.modifier || undefined
        });
      }
    }
  }
  
  return { items, rawCodes, rejectedTokens };
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
  serviceDate,
  state,
  zipCode 
}: { 
  output: MedicareBenchmarkOutput; 
  rawCodes: string[];
  serviceDate: string | null;
  state?: string;
  zipCode?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLineDetails, setShowLineDetails] = useState(false);
  
  // Count codes by match status
  const matchedCount = output.lineItems.filter(i => i.matchStatus === 'matched').length;
  const missingCount = output.lineItems.filter(i => i.matchStatus === 'missing').length;
  const existsNotPricedCount = output.lineItems.filter(i => i.matchStatus === 'exists_not_priced').length;
  
  // Conversion factor for display
  const CF = 34.6062;
  
  return (
    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50 text-xs font-mono">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left text-muted-foreground hover:text-foreground"
      >
        <Bug className="h-3 w-3" />
        <span>Benchmark Debug Info</span>
        <div className="ml-auto flex items-center gap-2">
          {matchedCount > 0 && <Badge variant="outline" className="text-success border-success/30 text-[10px]">{matchedCount} priced</Badge>}
          {existsNotPricedCount > 0 && <Badge variant="outline" className="text-warning border-warning/30 text-[10px]">{existsNotPricedCount} exists/not priced</Badge>}
          {missingCount > 0 && <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">{missingCount} missing</Badge>}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </button>
      
      {expanded && (
        <div className="mt-3 space-y-2 text-muted-foreground">
          {/* Status summary */}
          <div className="grid grid-cols-2 gap-2 p-2 rounded bg-background/50">
            <div><strong>Status:</strong> <span className={output.status === 'ok' ? 'text-success' : output.status === 'no_codes' ? 'text-destructive' : 'text-warning'}>{output.status}</span></div>
            <div><strong>Service Date:</strong> {serviceDate || 'Not detected'}</div>
            <div><strong>State:</strong> {state || 'Not selected'}</div>
            <div><strong>ZIP:</strong> {zipCode || 'Not provided'}</div>
          </div>
          
          {/* Year info */}
          <div className="p-2 rounded bg-background/50">
            <div className="grid grid-cols-2 gap-2">
              <div><strong>Requested Years:</strong> {output.metadata.requestedYears.join(', ') || 'None'}</div>
              <div><strong>Benchmark Year Used:</strong> <span className="text-primary">{output.metadata.benchmarkYearUsed}</span></div>
              <div><strong>Latest MPFS Year:</strong> {output.debug.latestMpfsYear}</div>
              <div><strong>Year Fallback:</strong> {output.metadata.usedYearFallback ? <span className="text-warning">Yes</span> : 'No'}</div>
            </div>
            {output.metadata.fallbackReason && (
              <div className="mt-1 text-warning"><strong>Fallback Reason:</strong> {output.metadata.fallbackReason}</div>
            )}
          </div>
          
          {/* Locality/GPCI info */}
          <div className="p-2 rounded bg-background/50">
            <div className="mb-1"><strong>Geo Resolution:</strong></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><strong>Confidence:</strong> <span className={
                output.metadata.localityUsed === 'local_adjusted' ? 'text-success' :
                output.metadata.localityUsed === 'state_estimate' ? 'text-warning' : 'text-muted-foreground'
              }>{output.metadata.localityUsed}</span></div>
              <div><strong>Lookup Method:</strong> {output.debug.gpciLookup?.method || 'N/A'}</div>
              <div><strong>Locality Name:</strong> {output.metadata.localityName || 'National (no locality)'}</div>
              <div><strong>Locality Code:</strong> {output.debug.gpciLookup?.localityCode || 'N/A'}</div>
            </div>
            {output.debug.gpciLookup?.localityFound && (
              <div className="mt-2 p-2 rounded bg-success/5 border border-success/20">
                <strong className="text-success">GPCI Indices Applied:</strong>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div>Work: <span className="text-foreground font-semibold">{output.debug.gpciLookup.workGpci?.toFixed(4) || 'N/A'}</span></div>
                  <div>PE: <span className="text-foreground font-semibold">{output.debug.gpciLookup.peGpci?.toFixed(4) || 'N/A'}</span></div>
                  <div>MP: <span className="text-foreground font-semibold">{output.debug.gpciLookup.mpGpci?.toFixed(4) || 'N/A'}</span></div>
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Formula: Fee = [(Work RVU × Work GPCI) + (PE RVU × PE GPCI) + (MP RVU × MP GPCI)] × {CF}
                </div>
              </div>
            )}
            {!output.debug.gpciLookup?.localityFound && (
              <div className="mt-2 p-2 rounded bg-muted/20 border border-border/30">
                <strong>National Calculation:</strong>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Formula: Fee = (Work RVU + PE RVU + MP RVU) × {CF}
                </div>
              </div>
            )}
          </div>
          
          {/* Code extraction */}
          <div className="pt-2 border-t border-border/30">
            <strong>Raw Codes Extracted ({rawCodes.length}):</strong>
            <div className="mt-1 flex flex-wrap gap-1">
              {rawCodes.length > 0 ? rawCodes.slice(0, 20).map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
              )) : <span className="text-destructive">None found in bill</span>}
              {rawCodes.length > 20 && <span className="text-muted-foreground">+{rawCodes.length - 20} more</span>}
            </div>
          </div>
          
          {/* Match results with classification */}
          <div className="pt-2 border-t border-border/30">
            <div className="mb-2"><strong>Classification Results:</strong></div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-success/5 border border-success/20">
                <strong className="text-success">✓ Priced ({matchedCount})</strong>
                <div className="text-[10px] mt-1">{output.debug.codesMatched.slice(0, 5).join(', ') || 'None'}</div>
              </div>
              <div className="p-2 rounded bg-warning/5 border border-warning/20">
                <strong className="text-warning">⚠ Exists, Not Priced ({existsNotPricedCount})</strong>
                <div className="text-[10px] mt-1">{output.debug.codesExistsNotPriced.slice(0, 5).join(', ') || 'None'}</div>
              </div>
              <div className="p-2 rounded bg-destructive/5 border border-destructive/20">
                <strong className="text-destructive">✗ Missing ({missingCount})</strong>
                <div className="text-[10px] mt-1">{output.debug.codesMissing.slice(0, 5).join(', ') || 'None'}</div>
              </div>
            </div>
          </div>
          
          {/* Totals */}
          <div className="p-2 rounded bg-background/50">
            <div className="grid grid-cols-3 gap-2">
              <div><strong>Billed Total:</strong> ${output.totals.billedTotal?.toFixed(2) || '—'}</div>
              <div><strong>Medicare Ref:</strong> ${output.totals.medicareReferenceTotal?.toFixed(2) || 'N/A'}</div>
              <div><strong>Multiple:</strong> {output.totals.multipleOfMedicare ? `${output.totals.multipleOfMedicare}×` : 'N/A'}</div>
            </div>
          </div>
          
          {/* Per-line item details toggle */}
          <div className="pt-2 border-t border-border/30">
            <button
              onClick={() => setShowLineDetails(!showLineDetails)}
              className="flex items-center gap-2 text-primary hover:underline"
            >
              {showLineDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>Per-Line Item Debug ({output.lineItems.length} items)</span>
            </button>
            
            {showLineDetails && (
              <div className="mt-2 max-h-80 overflow-y-auto space-y-2">
                {output.lineItems.map((item, i) => (
                  <div key={i} className={cn(
                    "p-2 rounded text-[10px] border",
                    item.matchStatus === 'matched' ? 'bg-success/5 border-success/20' :
                    item.matchStatus === 'exists_not_priced' ? 'bg-warning/5 border-warning/20' :
                    'bg-destructive/5 border-destructive/20'
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <code className="font-semibold text-foreground">{item.hcpcs}</code>
                      {item.modifier && <span className="text-muted-foreground">-{item.modifier}</span>}
                      <Badge variant="outline" className={cn(
                        "text-[8px]",
                        item.matchStatus === 'matched' ? 'text-success border-success/30' :
                        item.matchStatus === 'exists_not_priced' ? 'text-warning border-warning/30' :
                        'text-destructive border-destructive/30'
                      )}>
                        {item.matchStatus === 'matched' ? 'PRICED' :
                         item.matchStatus === 'exists_not_priced' ? 'EXISTS/NOT PRICED' :
                         'MISSING'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1">
                      <div><strong>Billed:</strong> ${item.billedAmount?.toFixed(2) || '—'}</div>
                      <div><strong>Medicare Ref:</strong> ${item.medicareReferencePerUnit?.toFixed(2) || 'N/A'}</div>
                      <div><strong>Fee Source:</strong> {item.feeSource || 'N/A'}</div>
                      <div><strong>GPCI Applied:</strong> {item.gpciAdjusted ? 'Yes' : 'No'}</div>
                      {item.notPricedReason && (
                        <div className="col-span-2"><strong>Not Priced Reason:</strong> <span className="text-warning">{item.notPricedReason}</span></div>
                      )}
                      <div className="col-span-2"><strong>Year:</strong> {item.benchmarkYearUsed || 'N/A'}</div>
                    </div>
                    
                    {item.notes.length > 0 && (
                      <div className="mt-1 text-muted-foreground">
                        <strong>Notes:</strong> {item.notes.join(' | ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Query details */}
          <div className="pt-2 border-t border-border/30">
            <strong>MPFS Queries Attempted ({output.debug.queriesAttempted.length}):</strong>
            <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
              {output.debug.queriesAttempted.map((q, i) => (
                <div key={i} className={cn(
                  "text-xs p-1 rounded",
                  q.row_exists ? (q.has_fee || q.has_rvu ? 'bg-success/10' : 'bg-warning/10') : 'bg-destructive/10'
                )}>
                  <span className="font-semibold">{q.hcpcs}</span>
                  {q.modifier && <span className="text-muted-foreground">-{q.modifier}</span>}
                  {' '}(year: {q.year}, qp: {q.qp_status}) → 
                  {q.row_exists ? (
                    <span className={q.has_fee || q.has_rvu ? 'text-success' : 'text-warning'}>
                      {' '}✓ Row found {q.has_fee ? '(has fee)' : q.has_rvu ? '(has RVU)' : '(no fee/RVU)'}
                      {q.status_code && <span className="text-muted-foreground"> [status: {q.status_code}]</span>}
                    </span>
                  ) : (
                    <span className="text-destructive"> ✗ Not in MPFS</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Example query for manual verification */}
          {output.debug.queriesAttempted.length > 0 && (
            <div className="pt-2 border-t border-border/30">
              <strong>Example SQL Query:</strong>
              <pre className="mt-1 p-2 rounded bg-background/80 text-[10px] overflow-x-auto">
{`SELECT hcpcs, modifier, status, nonfac_fee, fac_fee, 
       work_rvu, nonfac_pe_rvu, fac_pe_rvu, mp_rvu, conversion_factor
FROM mpfs_benchmarks 
WHERE hcpcs = '${output.debug.queriesAttempted[0]?.hcpcs || '99213'}' 
  AND year = ${output.metadata.benchmarkYearUsed}
  AND qp_status = 'nonQP'
  AND source = 'CMS MPFS';`}
              </pre>
            </div>
          )}
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
              {item.benchmarkYearUsed} Medicare {item.feeSource === 'rvu_calc_local' ? '(MPFS, location-adjusted)' : 
                item.feeSource === 'rvu_calc_national' ? '(MPFS, national)' : 
                item.feeSource === 'direct_fee' ? '(MPFS)' : 'reference'}
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
          {output.metadata.localityUsed === 'local_adjusted' && (
            <Badge variant="outline" className="text-[10px] bg-success/10 border-success/30 text-success">
              Location-adjusted
            </Badge>
          )}
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

/**
 * Section for codes that exist in MPFS but have no payable Medicare amount
 */
function CodesExistsNotPricedSection({ items }: { items: BenchmarkLineResult[] }) {
  const existsNotPricedItems = items.filter(i => i.matchStatus === 'exists_not_priced');
  if (existsNotPricedItems.length === 0) return null;
  
  // Group by reason for better messaging
  const mpfsItems = existsNotPricedItems.filter(i => 
    i.notPricedReason === 'rvus_zero_or_missing' || 
    i.notPricedReason === 'fees_missing' ||
    i.notPricedReason === 'status_indicator_nonpayable'
  );
  
  const getReasonLabel = (reason: string | null): string => {
    switch (reason) {
      case 'rvus_zero_or_missing': return 'no RVUs';
      case 'fees_missing': return 'no fee';
      case 'status_indicator_nonpayable': return 'not payable';
      case 'packaged': return 'packaged (OPPS)';
      default: return 'no reference';
    }
  };
  
  return (
    <div className="p-4 rounded-lg bg-warning/5 border border-warning/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            Codes found in Medicare data, but no reference price available
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            These services exist in Medicare's fee schedules but do not have a 
            separately payable amount. They may be bundled into other services, 
            packaged under OPPS, or used for reporting purposes only.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {existsNotPricedItems.slice(0, 8).map(item => (
              <Badge key={item.hcpcs} variant="outline" className="text-xs bg-warning/10 border-warning/30 text-warning-foreground">
                {item.hcpcs}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({getReasonLabel(item.notPricedReason)})
                </span>
              </Badge>
            ))}
            {existsNotPricedItems.length > 8 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{existsNotPricedItems.length - 8} more
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> These are NOT missing from Medicare's data — they simply 
            don't have a separately payable Medicare rate. This is common for add-on codes, 
            packaged services under OPPS, carrier-priced services, or informational codes.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Section for codes that do NOT exist in any Medicare dataset
 */
function CodesMissingSection({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;
  
  return (
    <div className="p-4 rounded-lg bg-muted/20 border border-border/30">
      <div className="flex items-start gap-3">
        <FileQuestion className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground mb-1">
            Codes not found in our current Medicare datasets
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            We couldn't find these codes in our Medicare datasets (MPFS, OPPS, or DMEPOS). 
            They may be newer codes, clinical lab codes (CLFS), or services covered under other schedules.
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
          <p className="text-xs text-muted-foreground mb-2">
            <strong>Note:</strong> Some specialized services may be billed under other fee schedules 
            (Clinical Lab Fee Schedule, ASC Fee Schedule, etc.) that we don't currently cover.
          </p>
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
        
        // Extract line items with improved logic and strict validation
        const { items: lineItems, rawCodes: extractedRawCodes, rejectedTokens } = extractLineItems(analysis);
        setRawCodes(extractedRawCodes);
        
        console.log('[HowThisCompares] Extracted line items:', lineItems.length);
        console.log('[HowThisCompares] Raw codes found:', extractedRawCodes);
        console.log('[HowThisCompares] Rejected tokens:', rejectedTokens);
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
          <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} state={state} zipCode={zipCode} />
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
          <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} state={state} zipCode={zipCode} />
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
      
      {/* Codes that exist but have no Medicare price */}
      <CodesExistsNotPricedSection items={output.lineItems} />
      
      {/* Codes not found in MPFS at all */}
      <CodesMissingSection codes={output.codesNotFound} />
      
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
        <DebugPanel output={output} rawCodes={rawCodes} serviceDate={serviceDate} state={state} zipCode={zipCode} />
      )}
    </div>
  );
}
