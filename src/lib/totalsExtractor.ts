/**
 * Totals Extraction and Reconciliation
 *
 * This module handles:
 * 1. Document type classification
 * 2. Totals candidate extraction with label anchoring
 * 3. Line item extraction and sum calculation
 * 4. Reconciliation and comparison total selection
 * 5. Integration with normalizeTotals for structured totals
 *
 * Goal:
 * - Reliably extract pre-insurance total charges (when available)
 * - Never confuse "Amount Due / Balance Due" with total charges
 * - Provide transparent reasoning for the comparison total used
 */

import {
  StructuredTotals,
  DetectedTotal,
  LineItemForTotals,
  normalizeAndDeriveTotals,
  selectComparisonTotal as selectStructuredComparisonTotal,
  ComparisonTotalSelection,
  TotalsConfidence
} from './totals/normalizeTotals';

export type { StructuredTotals, DetectedTotal, LineItemForTotals, ComparisonTotalSelection, TotalsConfidence };

// ============= Type Definitions =============

export type DocumentClassification =
  | 'itemized_statement'
  | 'summary_statement'
  | 'hospital_summary_bill'
  | 'revenue_code_only'
  | 'eob'
  | 'portal_summary'
  | 'payment_receipt'
  | 'unknown';

export type TotalType =
  | 'charges'
  | 'allowed'
  | 'patient_responsibility'
  | 'insurance_paid'
  | 'unknown';

export interface TotalCandidate {
  type: TotalType;
  amount: number;
  label: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
  nearbyContext?: string;
}

export interface LineItemExtraction {
  description: string;
  chargeAmount?: number;
  chargeAmountConfidence?: TotalsConfidence;
  chargeAmountEvidence?: string;

  allowedAmount?: number;
  patientAmount?: number;

  code?: string;
  codeType?: 'cpt' | 'hcpcs' | 'revenue' | 'unknown';
  units?: number;
}

export interface TotalsReconciliation {
  lineItems: LineItemExtraction[];
  sumLineCharges: number;
  sumLineAllowed: number | null;
  sumLinePatient: number | null;

  chargesCandidates: TotalCandidate[];
  allowedCandidates: TotalCandidate[];
  patientCandidates: TotalCandidate[];

  structuredTotals?: StructuredTotals;

  comparisonTotal: {
    value: number;
    type: TotalType;
    confidence: 'high' | 'medium' | 'low';
    explanation: string;
    limitedComparability: boolean;
    scopeWarnings?: string[];
  } | null;

  documentType: DocumentClassification;

  reconciliationStatus: 'matched' | 'mismatch' | 'insufficient_data';
  reconciliationNote?: string;

  derivationNotes?: string[];
}

// ============= Helper Functions =============

export function parseCurrency(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;

  const raw = String(value).trim();
  if (!raw) return null;

  // Handle parentheses negatives: ($123.45) -> -123.45
  const isParenNegative = raw.startsWith('(') && raw.endsWith(')');
  const cleaned = raw
    .replace(/[()]/g, '')
    .replace(/[$,\s]/g, '')
    .trim();

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return isParenNegative ? -num : num;
}

function isLikelyBalanceLabel(label: string): boolean {
  const l = (label || '').toLowerCase();
  return (
    l.includes('balance') ||
    l.includes('amount due') ||
    l.includes('payment due') ||
    l.includes('current balance') ||
    l.includes('you owe') ||
    l.includes('patient responsibility') ||
    l.includes('your responsibility')
  );
}

function roughlyEqual(a: number, b: number, tolerancePct = 0.02): boolean {
  if (!isFinite(a) || !isFinite(b) || a <= 0 || b <= 0) return false;
  const diff = Math.abs(a - b);
  return diff / Math.max(a, b) <= tolerancePct;
}

// ============= Document Classification =============

const EOB_INDICATORS = [
  'explanation of benefits', 'eob', 'allowed amount', 'plan paid',
  'member responsibility', 'claim number', 'processed date',
  'coinsurance', 'copay', 'deductible applied'
];

const PORTAL_INDICATORS = [
  'mychart', 'patient portal', 'online balance', 'your balance',
  'quick pay', 'make a payment', 'payment options'
];

const STATEMENT_INDICATORS = [
  'statement', 'itemized bill', 'service date', 'procedure',
  'charges', 'billing statement', 'date of service', 'quantity', 'cpt'
];

const HOSPITAL_SUMMARY_INDICATORS = [
  'hospital', 'facility', 'emergency room', 'er visit', 'inpatient',
  'outpatient', 'revenue code', 'room and board', 'pharmacy', 'laboratory'
];

const REVENUE_CODE_INDICATORS = [
  'rev code', 'revenue code', '0100', '0110', '0120', '0250', '0260',
  '0270', '0300', '0320', '0450', '0636', '0730', '0760'
];

export function classifyDocument(content: string): DocumentClassification {
  const lower = content.toLowerCase();

  const eobScore = EOB_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const portalScore = PORTAL_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const statementScore = STATEMENT_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const hospitalScore = HOSPITAL_SUMMARY_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 2 : 0), 0);
  const revenueCodeScore = REVENUE_CODE_INDICATORS.reduce((acc, ind) => acc + (lower.includes(ind) ? 3 : 0), 0);

  const isReceipt =
    lower.includes('receipt') ||
    lower.includes('payment received') ||
    (lower.includes('paid') && lower.includes('thank you'));

  if (isReceipt && !lower.includes('charges')) return 'payment_receipt';

  if (eobScore >= 6 && eobScore > statementScore) return 'eob';

  const hasCpt = /\b\d{5}\b/.test(content) || /\b[A-Z]\d{4}\b/.t
