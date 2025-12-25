import { AnalysisResult, BillingIssue } from '@/types';

// ============================================
// EOB vs Bill Comparison Utility
// Centralized source of truth for all comparison logic
// ============================================

export interface EobBillComparison {
  // Data readiness
  hasBill: boolean;
  hasEOB: boolean;
  billTotal: number | undefined;
  eobPatientResponsibility: number | undefined;
  
  // Totals comparison
  totalsMatch: boolean;
  totalsDiscrepancyAmount: number;
  canCompareEOB: boolean;
  
  // Line-level comparison
  lineItemsMatch: boolean;
  lineDiscrepancies: LineDiscrepancy[];
  
  // Context flags
  hasStructuralIssues: boolean;
  hasCoverageIssues: boolean;
  hasBillHigherThanEOB: boolean;
  
  // Tiered summary flags
  overallClean: boolean;
  totalsMatchButWarnings: boolean;
  totalsMismatch: boolean;
  
  // Filtered callouts
  potentialErrors: BillingIssue[];
  needsAttention: BillingIssue[];
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

// Check if issue indicates bill is higher than EOB (critical overbilling pattern)
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

// Check if issue is structural (missing codes, non-itemized)
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
  // GUARDRAIL 1: If the description says it's a match, ALWAYS filter it out
  if (descriptionIndicatesMatch(issue)) {
    return true;
  }
  
  // GUARDRAIL 2: If we computed that totals match, filter out EOB mismatch issues
  if (totalsMatch && isEOBMismatchIssue(issue)) {
    return true;
  }
  
  return false;
}

// Main comparison function - single source of truth
export function buildEobBillComparison(
  analysis: AnalysisResult, 
  hasEOB: boolean = false
): EobBillComparison {
  const TOLERANCE = 0.01;
  
  // Data readiness
  const hasBill = true; // If we have analysis, we have a bill
  const billTotal = parseAmount(analysis.billTotal);
  const eobPatientResponsibility = parseAmount(analysis.eobData?.patientResponsibility);
  const canCompareEOB = hasEOB && billTotal !== undefined && eobPatientResponsibility !== undefined;
  
  // Totals comparison
  let totalsMatch = false;
  let totalsDiscrepancyAmount = 0;
  
  if (canCompareEOB && billTotal !== undefined && eobPatientResponsibility !== undefined) {
    totalsDiscrepancyAmount = billTotal - eobPatientResponsibility;
    const diff = Math.abs(totalsDiscrepancyAmount);
    totalsMatch = diff <= TOLERANCE;
  }
  
  // Get raw callouts
  const rawPotentialErrors = analysis.potentialErrors || [];
  const rawNeedsAttention = analysis.needsAttention || [];
  
  // Filter callouts based on match state
  const potentialErrors = rawPotentialErrors.filter(issue => !shouldFilterIssue(issue, totalsMatch));
  const needsAttention = rawNeedsAttention.filter(issue => !shouldFilterIssue(issue, totalsMatch));
  const allFilteredIssues = [...potentialErrors, ...needsAttention];
  
  // Analyze issues for context flags
  const hasBillHigherThanEOB = allFilteredIssues.some(isBillHigherThanEOBIssue) || 
    (canCompareEOB && totalsDiscrepancyAmount > TOLERANCE);
  const hasStructuralIssues = allFilteredIssues.some(isStructuralIssue);
  const hasCoverageIssues = allFilteredIssues.some(isCoverageIssue);
  
  // Line-level comparison (placeholder - expand based on data availability)
  const lineDiscrepancies: LineDiscrepancy[] = [];
  
  // Check EOB discrepancies for line-level issues
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
  
  // Calculate visible callout count
  const visibleCalloutCount = potentialErrors.length + needsAttention.length;
  
  // Tiered summary flags
  // Bill higher than EOB always blocks "clean" state - this is a critical overbilling pattern
  const overallClean = canCompareEOB && 
    totalsMatch && 
    visibleCalloutCount === 0 && 
    !hasBillHigherThanEOB &&
    lineItemsMatch;
    
  const totalsMatchButWarnings = canCompareEOB && 
    totalsMatch && 
    !overallClean && 
    (visibleCalloutCount > 0 || hasStructuralIssues || hasCoverageIssues || !lineItemsMatch);
    
  const totalsMismatch = canCompareEOB ? !totalsMatch : !hasEOB;

  // Debug logging for development
  console.log('🔍 buildEobBillComparison:', {
    hasBill,
    hasEOB,
    billTotal,
    eobPatientResponsibility,
    canCompareEOB,
    totalsMatch,
    totalsDiscrepancyAmount,
    hasBillHigherThanEOB,
    hasStructuralIssues,
    hasCoverageIssues,
    lineItemsMatch,
    visibleCalloutCount,
    overallClean,
    totalsMatchButWarnings,
    totalsMismatch,
  });
  
  return {
    hasBill,
    hasEOB,
    billTotal,
    eobPatientResponsibility,
    totalsMatch,
    totalsDiscrepancyAmount,
    canCompareEOB,
    lineItemsMatch,
    lineDiscrepancies,
    hasStructuralIssues,
    hasCoverageIssues,
    hasBillHigherThanEOB,
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
