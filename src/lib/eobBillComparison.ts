import { AnalysisResult, BillingIssue } from '@/types';

// ============================================
// EOB vs Bill Comparison Utility
// Centralized source of truth for all comparison logic
// ============================================

// Tolerance for comparing monetary amounts (1 cent)
export const PATIENT_TOTAL_TOLERANCE = 0.01;

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
  
  // Context flags
  hasStructuralIssues: boolean;
  hasCoverageIssues: boolean;
  hasBillHigherThanEOBLineItem: boolean;
  
  // Tiered summary flags
  overallClean: boolean;
  totalsMatchButWarnings: boolean;
  totalsMismatch: boolean;
  
  // Filtered and deduplicated callouts
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

// ============================================
// Issue Classification Helpers
// ============================================

// Categorize issue for grouping
export type IssueCategory = 'totals' | 'line_item' | 'structure' | 'coverage' | 'other';

function categorizeIssue(issue: BillingIssue): IssueCategory {
  const text = `${issue.title || ''} ${issue.description || ''}`.toLowerCase();
  
  if (text.includes('total') || text.includes('eob') || text.includes('patient responsibility')) {
    return 'totals';
  }
  if (text.includes('code') || text.includes('cpt') || text.includes('hcpcs') || text.includes('itemized') || text.includes('vague')) {
    return 'structure';
  }
  if (text.includes('coverage') || text.includes('network') || text.includes('deductible') || text.includes('coinsurance') || text.includes('copay')) {
    return 'coverage';
  }
  return 'line_item';
}

// Generate stable deduplication key
function getIssueKey(issue: BillingIssue): string {
  const typeKey = issue.type || 'unknown';
  const titleKey = (issue.title || '').toLowerCase().trim().slice(0, 50);
  const codeKey = issue.relatedCodes?.[0] || '';
  return `${typeKey}|${titleKey}|${codeKey}`;
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

// Get financial impact for sorting (higher = more important)
function getFinancialImpact(issue: BillingIssue): number {
  if (issue.relatedAmounts?.billed) return issue.relatedAmounts.billed;
  if (issue.relatedAmounts?.eob) return issue.relatedAmounts.eob;
  return 0;
}

// Get severity rank for sorting (higher = more severe)
function getSeverityRank(issue: BillingIssue): number {
  if (issue.severity === 'error') return 3;
  if (issue.severity === 'warning') return 2;
  return 1;
}

// ============================================
// Main Comparison Function
// ============================================

export function buildEobBillComparison(
  analysis: AnalysisResult, 
  hasEOB: boolean = false
): EobBillComparison {
  // Data readiness
  const hasBill = true;
  const billTotal = parseAmount(analysis.billTotal);
  const eobPatientResponsibility = parseAmount(analysis.eobData?.patientResponsibility);
  const canCompareEOB = hasEOB && billTotal !== undefined && eobPatientResponsibility !== undefined;
  
  // Patient totals match computation
  let patientTotalsMatch = false;
  let totalsDiscrepancyAmount = 0;
  
  if (canCompareEOB && billTotal !== undefined && eobPatientResponsibility !== undefined) {
    totalsDiscrepancyAmount = billTotal - eobPatientResponsibility;
    const diff = Math.abs(totalsDiscrepancyAmount);
    patientTotalsMatch = diff <= PATIENT_TOTAL_TOLERANCE;
  }
  
  const totalsMatch = patientTotalsMatch;
  
  // Get raw callouts
  const rawPotentialErrors = analysis.potentialErrors || [];
  const rawNeedsAttention = analysis.needsAttention || [];
  
  // ============================================
  // DEDUPLICATION: Combine and deduplicate issues
  // ============================================
  const allRawIssues: BillingIssue[] = [
    ...rawPotentialErrors.map(issue => ({ ...issue, severity: issue.severity || 'error' as const })),
    ...rawNeedsAttention.map(issue => ({ ...issue, severity: issue.severity || 'warning' as const })),
  ];
  
  // Deduplicate using a Map with stable keys
  const issueMap = new Map<string, BillingIssue>();
  for (const issue of allRawIssues) {
    const key = getIssueKey(issue);
    // Keep the first occurrence (typically the most severe if errors are listed first)
    if (!issueMap.has(key)) {
      issueMap.set(key, issue);
    }
  }
  
  // Filter out issues that should not be shown
  const deduplicatedIssues = Array.from(issueMap.values())
    .filter(issue => !shouldFilterIssue(issue, patientTotalsMatch));
  
  // ============================================
  // SPLIT INTO SEVERITY BUCKETS
  // ============================================
  const potentialErrors = deduplicatedIssues
    .filter(i => i.severity === 'error')
    .sort((a, b) => {
      // Sort by financial impact first, then severity rank
      const impactDiff = getFinancialImpact(b) - getFinancialImpact(a);
      if (impactDiff !== 0) return impactDiff;
      return getSeverityRank(b) - getSeverityRank(a);
    });
  
  const needsAttention = deduplicatedIssues
    .filter(i => i.severity !== 'error')
    .sort((a, b) => {
      // Sort warnings before info
      const severityDiff = getSeverityRank(b) - getSeverityRank(a);
      if (severityDiff !== 0) return severityDiff;
      return getFinancialImpact(b) - getFinancialImpact(a);
    });
  
  // Analyze for context flags
  const hasBillHigherThanEOBLineItem = deduplicatedIssues.some(isBillHigherThanEOBIssue);
  const hasStructuralIssues = deduplicatedIssues.some(isStructuralIssue);
  const hasCoverageIssues = deduplicatedIssues.some(isCoverageIssue);
  
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

  // Debug logging
  console.log('🔍 EOB/Bill comparison:', {
    billTotal,
    eobPatientResponsibility,
    patientTotalsMatch,
    overallClean,
    totalsMatchButWarnings,
    totalsMismatch,
    visibleCalloutCount,
    deduplicatedFrom: allRawIssues.length,
    hasBillHigherThanEOBLineItem,
    hasStructuralIssues,
    hasCoverageIssues,
  });
  
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
