import { AnalysisResult, BillingIssue } from '@/types';

// ============================================
// EOB vs Bill Comparison Utility
// Centralized source of truth for all comparison logic
// ============================================

// Tolerance for comparing monetary amounts (1 cent)
export const PATIENT_TOTAL_TOLERANCE = 0.01;

// Issue categories for grouping
export type IssueCategory = 'totals' | 'line_item' | 'structure' | 'coverage' | 'duplicate_charge' | 'missing_payment' | 'coding_issue' | 'other';

export interface EnhancedBillingIssue extends BillingIssue {
  category: IssueCategory;
  dedupeKey: string;
  financialImpact?: number;
}

export interface EobBillComparison {
  // Data readiness
  hasBill: boolean;
  hasEOB: boolean;
  billTotal: number | undefined;
  eobPatientResponsibility: number | undefined;
  
  // Patient totals comparison - ALWAYS computed independently
  patientTotalsMatch: boolean;
  
  // Legacy alias for patientTotalsMatch (backward compatibility)
  totalsMatch: boolean;
  totalsDiscrepancyAmount: number;
  canCompareEOB: boolean;
  
  // Line-level comparison
  lineItemsMatch: boolean;
  lineDiscrepancies: LineDiscrepancy[];
  
  // Context flags (these are line-level issues, NOT totals-level)
  hasStructuralIssues: boolean;
  hasCoverageIssues: boolean;
  hasBillHigherThanEOBLineItem: boolean;
  
  // Tiered summary flags
  overallClean: boolean;
  totalsMatchButWarnings: boolean;
  totalsMismatch: boolean;
  
  // Filtered and deduplicated callouts
  potentialErrors: EnhancedBillingIssue[];
  needsAttention: EnhancedBillingIssue[];
  visibleCalloutCount: number;
}

export interface LineDiscrepancy {
  type: 'missing_on_eob' | 'higher_billed' | 'higher_responsibility' | 'code_mismatch';
  serviceDescription: string;
  billValue?: number;
  eobValue?: number;
  explanation: string;
}

// Helper to parse currency strings like "$151.77" to numbers
export function parseAmount(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

// Generate a stable dedupe key for an issue
function generateDedupeKey(issue: BillingIssue): string {
  const type = issue.type || 'unknown';
  const title = (issue.title || '').toLowerCase().trim();
  const firstCode = issue.relatedCodes?.[0] || '';
  const amount = issue.relatedAmounts?.billed || issue.relatedAmounts?.eob || '';
  return `${type}|${title}|${firstCode}|${amount}`;
}

// Categorize an issue based on its content
function categorizeIssue(issue: BillingIssue): IssueCategory {
  const text = `${issue.title || ''} ${issue.description || ''} ${issue.type || ''}`.toLowerCase();
  
  if (text.includes('duplicate') || text.includes('billed twice')) return 'duplicate_charge';
  if (text.includes('missing payment') || text.includes('payment not applied')) return 'missing_payment';
  if (text.includes('upcod') || text.includes('wrong code') || text.includes('code mismatch')) return 'coding_issue';
  if (text.includes('total') || text.includes('eob') || text.includes('patient responsibility')) return 'totals';
  if (text.includes('code') || text.includes('cpt') || text.includes('hcpcs') || text.includes('itemized') || text.includes('missing') || text.includes('vague')) return 'structure';
  if (text.includes('coverage') || text.includes('network') || text.includes('deductible') || text.includes('coinsurance') || text.includes('copay') || text.includes('allowed amount')) return 'coverage';
  return 'line_item';
}

// Estimate financial impact for sorting
function estimateFinancialImpact(issue: BillingIssue): number {
  if (issue.relatedAmounts?.billed) return issue.relatedAmounts.billed;
  if (issue.relatedAmounts?.eob) return issue.relatedAmounts.eob;
  
  // Parse amounts from description
  const desc = issue.description || '';
  const amountMatch = desc.match(/\$[\d,]+\.?\d*/);
  if (amountMatch) {
    return parseAmount(amountMatch[0]) || 0;
  }
  return 0;
}

// Check if an issue is about EOB/bill total mismatch
function isEOBMismatchIssue(issue: BillingIssue): boolean {
  const title = issue.title?.toLowerCase() || '';
  const description = issue.description?.toLowerCase() || '';
  return (
    title.includes('eob') || 
    title.includes('mismatch') ||
    title.includes('bill total') ||
    title.includes('patient responsibility') ||
    description.includes('eob') ||
    description.includes('patient responsibility') ||
    description.includes('bill total')
  );
}

// GUARDRAIL: Check if issue description/title indicates amounts actually match
function descriptionIndicatesMatch(issue: BillingIssue): boolean {
  const text = `${issue.title || ''} ${issue.description || ''}`.toLowerCase();
  return (
    text.includes('perfect match') ||
    text.includes('which is great') ||
    text.includes('matches your eob') ||
    text.includes('amounts match') ||
    text.includes('good sign') ||
    text.includes('this is a match') ||
    text.includes('bill matches') ||
    text.includes('totals match') ||
    text.includes('are the same') ||
    text.includes('are equal') ||
    text.includes('correctly matches') ||
    text.includes('appears correct')
  );
}

// Check if issue indicates bill is higher than EOB
function isBillHigherThanEOBIssue(issue: BillingIssue): boolean {
  const text = `${issue.title || ''} ${issue.description || ''}`.toLowerCase();
  return (
    text.includes('bill shows higher') ||
    text.includes('higher patient responsibility') ||
    text.includes('bill higher than eob') ||
    text.includes('overbill') ||
    text.includes('over-bill') ||
    text.includes('charged more than')
  );
}

// Check if issue is structural
function isStructuralIssue(issue: BillingIssue): boolean {
  const text = `${issue.title || ''} ${issue.description || ''}`.toLowerCase();
  return (
    text.includes('missing cpt') ||
    text.includes('missing hcpcs') ||
    text.includes('missing code') ||
    text.includes('vague description') ||
    text.includes('non-itemized') ||
    text.includes('not itemized') ||
    text.includes('request itemized') ||
    text.includes('no detail')
  );
}

// Check if issue is coverage-related
function isCoverageIssue(issue: BillingIssue): boolean {
  const text = `${issue.title || ''} ${issue.description || ''}`.toLowerCase();
  return (
    text.includes('out-of-network') ||
    text.includes('out of network') ||
    text.includes('not covered') ||
    text.includes('non-covered') ||
    text.includes('balance billing') ||
    text.includes('allowed amount') ||
    text.includes('deductible') ||
    text.includes('coinsurance') ||
    text.includes('copay')
  );
}

// Determine if an issue should be filtered out
function shouldFilterIssue(issue: BillingIssue, totalsMatch: boolean): boolean {
  if (descriptionIndicatesMatch(issue)) return true;
  if (totalsMatch && isEOBMismatchIssue(issue)) return true;
  return false;
}

// Deduplicate issues using stable keys
function deduplicateIssues(issues: BillingIssue[]): EnhancedBillingIssue[] {
  const seen = new Map<string, EnhancedBillingIssue>();
  
  for (const issue of issues) {
    const dedupeKey = generateDedupeKey(issue);
    
    // If we haven't seen this issue, add it
    if (!seen.has(dedupeKey)) {
      const enhanced: EnhancedBillingIssue = {
        ...issue,
        category: categorizeIssue(issue),
        dedupeKey,
        financialImpact: estimateFinancialImpact(issue),
      };
      seen.set(dedupeKey, enhanced);
    }
  }
  
  return Array.from(seen.values());
}

// Sort issues by severity and financial impact
function sortIssues(issues: EnhancedBillingIssue[], isErrors: boolean): EnhancedBillingIssue[] {
  return [...issues].sort((a, b) => {
    if (isErrors) {
      // For errors: sort by financial impact (highest first)
      const impactA = a.financialImpact || 0;
      const impactB = b.financialImpact || 0;
      if (impactB !== impactA) return impactB - impactA;
      
      // Then by category priority (overbilling first)
      const categoryPriority: Record<IssueCategory, number> = {
        totals: 1,
        duplicate_charge: 2,
        line_item: 3,
        coding_issue: 4,
        missing_payment: 5,
        coverage: 6,
        structure: 7,
        other: 8,
      };
      return (categoryPriority[a.category] || 99) - (categoryPriority[b.category] || 99);
    } else {
      // For warnings/info: sort by educational value (structure first)
      const categoryPriority: Record<IssueCategory, number> = {
        structure: 1,
        coverage: 2,
        coding_issue: 3,
        line_item: 4,
        other: 5,
        totals: 6,
        duplicate_charge: 7,
        missing_payment: 8,
      };
      return (categoryPriority[a.category] || 99) - (categoryPriority[b.category] || 99);
    }
  });
}

// Main comparison function - single source of truth
export function buildEobBillComparison(
  analysis: AnalysisResult, 
  hasEOB: boolean = false
): EobBillComparison {
  const hasBill = true;
  const billTotal = parseAmount(analysis.billTotal);
  const eobPatientResponsibility = parseAmount(analysis.eobData?.patientResponsibility);
  const canCompareEOB = hasEOB && billTotal !== undefined && eobPatientResponsibility !== undefined;
  
  // Patient totals match - computed independently
  let patientTotalsMatch = false;
  let totalsDiscrepancyAmount = 0;
  
  if (canCompareEOB && billTotal !== undefined && eobPatientResponsibility !== undefined) {
    totalsDiscrepancyAmount = billTotal - eobPatientResponsibility;
    const diff = Math.abs(totalsDiscrepancyAmount);
    patientTotalsMatch = diff <= PATIENT_TOTAL_TOLERANCE;
  }
  
  const totalsMatch = patientTotalsMatch;
  
  // Get raw callouts and combine them
  const rawPotentialErrors = analysis.potentialErrors || [];
  const rawNeedsAttention = analysis.needsAttention || [];
  
  // Combine all issues for deduplication
  const allRawIssues = [...rawPotentialErrors, ...rawNeedsAttention];
  
  // Deduplicate using stable keys
  const deduped = deduplicateIssues(allRawIssues);
  
  // Filter based on match state
  const filtered = deduped.filter(issue => !shouldFilterIssue(issue, patientTotalsMatch));
  
  // Split by severity
  const potentialErrors = sortIssues(
    filtered.filter(i => i.severity === 'error'),
    true
  );
  const needsAttention = sortIssues(
    filtered.filter(i => i.severity !== 'error'),
    false
  );
  
  // Analyze for context flags
  const hasBillHigherThanEOBLineItem = filtered.some(isBillHigherThanEOBIssue);
  const hasStructuralIssues = filtered.some(isStructuralIssue);
  const hasCoverageIssues = filtered.some(isCoverageIssue);
  
  // Line-level comparison
  const lineDiscrepancies: LineDiscrepancy[] = [];
  if (analysis.eobData?.discrepancies) {
    for (const disc of analysis.eobData.discrepancies) {
      lineDiscrepancies.push({
        type: disc.type === 'overbilled' ? 'higher_billed' : 
              disc.type === 'mismatch' ? 'code_mismatch' : 'higher_responsibility',
        serviceDescription: disc.description,
        billValue: disc.billedValue,
        eobValue: disc.eobValue,
        explanation: disc.description,
      });
    }
  }
  
  const lineItemsMatch = lineDiscrepancies.length === 0;
  const visibleCalloutCount = potentialErrors.length + needsAttention.length;
  
  // Tiered summary flags
  const overallClean = patientTotalsMatch && visibleCalloutCount === 0 && lineItemsMatch;
  const totalsMatchButWarnings = patientTotalsMatch && !overallClean;
  const totalsMismatch = canCompareEOB ? !patientTotalsMatch : !hasEOB;

  return {
    hasBill,
    hasEOB,
    billTotal,
    eobPatientResponsibility,
    patientTotalsMatch,
    totalsMatch,
    totalsDiscrepancyAmount,
    canCompareEOB,
    lineItemsMatch,
    lineDiscrepancies,
    hasStructuralIssues,
    hasCoverageIssues,
    hasBillHigherThanEOBLineItem,
    overallClean,
    totalsMatchButWarnings,
    totalsMismatch,
    potentialErrors,
    needsAttention,
    visibleCalloutCount,
  };
}

// Hook-style wrapper for React components
export function useEobBillComparison(analysis: AnalysisResult, hasEOB: boolean = false): EobBillComparison {
  return buildEobBillComparison(analysis, hasEOB);
}
