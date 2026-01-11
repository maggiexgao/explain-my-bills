/**
 * Code Explanation Service
 * 
 * Provides explanations for medical codes (CPT/HCPCS) even when
 * they're not present in Medicare pricing datasets.
 * 
 * Priority order:
 * 1. Look up in code_metadata table
 * 2. Infer code system from pattern
 * 3. Provide informational explanation with disclaimers
 */

import { supabase } from '@/integrations/supabase/client';

// ============= Types =============

export type CodeSystem = 'cpt' | 'hcpcs_level_ii' | 'revenue_code' | 'unknown';
export type ExplanationSource = 'metadata' | 'pattern_inference' | 'ai_estimate';
export type ExplanationConfidence = 'high' | 'medium' | 'low';

export interface CodeExplanation {
  code: string;
  codeSystem: CodeSystem;
  explanationText: string;
  shortDescription?: string;
  longDescription?: string;
  confidence: ExplanationConfidence;
  source: ExplanationSource;
  isPriceable: boolean;
  whyNotPriced?: string;
  disclaimers: string[];
}

interface CodeMetadataRow {
  code: string;
  code_system: string;
  short_desc: string | null;
  long_desc: string | null;
  source: string;
  source_year: number | null;
}

// ============= Code Pattern Detection =============

/**
 * Infer code system from code pattern
 */
export function inferCodeSystem(code: string): CodeSystem {
  if (!code || typeof code !== 'string') return 'unknown';
  
  const normalized = code.trim().toUpperCase();
  
  // CPT: 5 numeric digits (includes Category I, II, III)
  // Category I: 00100-99607
  // Category II: 0001F-0015F
  // Category III: 0001T-0999T
  if (/^\d{5}$/.test(normalized)) {
    return 'cpt';
  }
  
  // HCPCS Level II: Letter + 4 digits (A0000-V9999)
  // Common prefixes: A/B/C/D/E/G/H/J/K/L/M/P/Q/R/S/T/V
  if (/^[A-V]\d{4}$/.test(normalized)) {
    return 'hcpcs_level_ii';
  }
  
  // Revenue codes: 4 digits (0001-0999 typically)
  if (/^\d{4}$/.test(normalized)) {
    return 'revenue_code';
  }
  
  return 'unknown';
}

/**
 * Get HCPCS Level II category description
 */
function getHcpcsCategory(code: string): string {
  const prefix = code.charAt(0).toUpperCase();
  
  const categories: Record<string, string> = {
    'A': 'Transportation, Medical/Surgical Supplies, Miscellaneous Services',
    'B': 'Enteral and Parenteral Therapy',
    'C': 'Outpatient PPS (Temporary HCPCS)',
    'D': 'Dental Procedures',
    'E': 'Durable Medical Equipment (DME)',
    'G': 'Procedures/Professional Services (Temporary)',
    'H': 'Behavioral Health/Substance Abuse Services',
    'J': 'Drugs Administered Other Than Oral Method',
    'K': 'Temporary Codes for DME Regional Carriers',
    'L': 'Orthotics/Prosthetics Procedures',
    'M': 'Medical Services',
    'P': 'Pathology and Laboratory Services',
    'Q': 'Miscellaneous Services (Temporary)',
    'R': 'Diagnostic Radiology Services',
    'S': 'Private Payer Codes (Non-Medicare)',
    'T': 'State Medicaid Agency Codes',
    'V': 'Vision/Hearing Services'
  };
  
  return categories[prefix] || 'Unknown HCPCS Category';
}

/**
 * Get CPT category description
 */
function getCptCategory(code: string): string {
  const num = parseInt(code, 10);
  
  if (num >= 0 && num <= 1999) return 'Anesthesia';
  if (num >= 10000 && num <= 69979) return 'Surgery';
  if (num >= 70000 && num <= 79999) return 'Radiology';
  if (num >= 80000 && num <= 89999) return 'Pathology and Laboratory';
  if (num >= 90000 && num <= 99607) return 'Medicine/Evaluation & Management';
  if (code.endsWith('F')) return 'Category II (Performance Measurement)';
  if (code.endsWith('T')) return 'Category III (Emerging Technology)';
  
  return 'Unknown CPT Category';
}

// ============= Why Not Priced Explanations =============

function getWhyNotPricedExplanation(code: string, codeSystem: CodeSystem): string {
  const prefix = code.charAt(0).toUpperCase();
  const num = parseInt(code.replace(/\D/g, ''), 10);
  
  // HCPCS Level II special cases
  if (codeSystem === 'hcpcs_level_ii') {
    if (prefix === 'S') {
      return 'S-codes are private payer codes, not recognized by Medicare. They may be used by commercial insurers or state Medicaid programs.';
    }
    if (prefix === 'T') {
      return 'T-codes are state Medicaid agency codes, not covered under Medicare fee schedules.';
    }
    if (prefix === 'C') {
      return 'C-codes are temporary hospital outpatient codes that may be packaged or bundled with other services.';
    }
    if (prefix === 'J') {
      return 'J-codes for drugs are priced based on Average Sales Price (ASP), which varies. Our current data does not include drug pricing.';
    }
    if (prefix === 'D') {
      return 'D-codes are dental procedures, which are generally not covered by Medicare Part B.';
    }
  }
  
  // CPT lab codes
  if (codeSystem === 'cpt' && num >= 80000 && num <= 89999) {
    return 'Laboratory tests (80000-89999) are priced under the Clinical Laboratory Fee Schedule (CLFS), which is not yet in our datasets.';
  }
  
  // Category II/III CPT
  if (codeSystem === 'cpt') {
    if (code.endsWith('F')) {
      return 'Category II CPT codes are supplemental tracking codes and typically have no associated payment.';
    }
    if (code.endsWith('T')) {
      return 'Category III CPT codes are temporary codes for emerging technology/services and may not have established Medicare pricing.';
    }
  }
  
  // Revenue codes
  if (codeSystem === 'revenue_code') {
    return 'Revenue codes are facility billing codes that indicate where a service was performed. They are not individually priced by Medicare; instead, they group charges under facility fee methodologies.';
  }
  
  return 'This code may not be in our Medicare reference datasets. It could be a temporary code, payer-specific code, or may be priced under a different fee schedule.';
}

// ============= Main Service Functions =============

/**
 * Get explanation for a code, with fallback to pattern inference
 */
export async function getCodeExplanation(
  code: string,
  context?: { documentType?: string; isFacilityBill?: boolean }
): Promise<CodeExplanation> {
  const normalized = code.trim().toUpperCase();
  const inferredSystem = inferCodeSystem(normalized);
  
  // Default disclaimers
  const disclaimers: string[] = [
    'This information is provided for educational purposes only.',
    'Always verify codes and descriptions with your healthcare provider or official sources.'
  ];
  
  // 1. Try to look up in code_metadata table
  const { data: metadataRow } = await supabase
    .from('code_metadata')
    .select('*')
    .eq('code', normalized)
    .maybeSingle();
  
  if (metadataRow) {
    const row = metadataRow as CodeMetadataRow;
    return {
      code: normalized,
      codeSystem: (row.code_system as CodeSystem) || inferredSystem,
      explanationText: row.long_desc || row.short_desc || `${normalized}: Code found in metadata`,
      shortDescription: row.short_desc || undefined,
      longDescription: row.long_desc || undefined,
      confidence: 'high',
      source: 'metadata',
      isPriceable: false, // If it's in metadata but not in pricing tables, it's not priceable
      whyNotPriced: getWhyNotPricedExplanation(normalized, inferredSystem),
      disclaimers
    };
  }
  
  // 2. Pattern-based explanation
  let explanationText = '';
  let category = '';
  
  if (inferredSystem === 'hcpcs_level_ii') {
    category = getHcpcsCategory(normalized);
    explanationText = `HCPCS Level II code in category: ${category}. This code type is used for services, procedures, and equipment not covered by CPT codes.`;
  } else if (inferredSystem === 'cpt') {
    category = getCptCategory(normalized);
    explanationText = `CPT code in category: ${category}. This is an AMA-maintained procedure code for medical services.`;
  } else if (inferredSystem === 'revenue_code') {
    explanationText = `Revenue code ${normalized}: Used by facilities to categorize charges by department or service type (e.g., room & board, operating room, pharmacy).`;
  } else {
    explanationText = `Code ${normalized}: Unable to determine code type. This may be a facility-specific code, temporary code, or non-standard identifier.`;
  }
  
  // Add specific notes for known problematic code ranges
  const prefix = normalized.charAt(0);
  if (prefix === 'S') {
    explanationText += ' S-codes are typically private payer codes not recognized by Medicare.';
    disclaimers.push('S-codes may only be recognized by specific commercial payers.');
  } else if (prefix === 'T') {
    explanationText += ' T-codes are typically state Medicaid codes.';
  }
  
  return {
    code: normalized,
    codeSystem: inferredSystem,
    explanationText,
    confidence: inferredSystem !== 'unknown' ? 'medium' : 'low',
    source: 'pattern_inference',
    isPriceable: false,
    whyNotPriced: getWhyNotPricedExplanation(normalized, inferredSystem),
    disclaimers
  };
}

/**
 * Batch get explanations for multiple codes
 */
export async function getCodeExplanations(
  codes: string[],
  context?: { documentType?: string; isFacilityBill?: boolean }
): Promise<Map<string, CodeExplanation>> {
  const results = new Map<string, CodeExplanation>();
  const normalizedCodes = codes.map(c => c.trim().toUpperCase());
  const uniqueCodes = [...new Set(normalizedCodes)];
  
  // Batch lookup from metadata
  const { data: metadataRows } = await supabase
    .from('code_metadata')
    .select('*')
    .in('code', uniqueCodes);
  
  const metadataMap = new Map<string, CodeMetadataRow>();
  if (metadataRows) {
    for (const row of metadataRows as CodeMetadataRow[]) {
      metadataMap.set(row.code, row);
    }
  }
  
  // Process each code
  for (const code of uniqueCodes) {
    const inferredSystem = inferCodeSystem(code);
    const metaRow = metadataMap.get(code);
    
    const disclaimers = [
      'This information is provided for educational purposes only.',
      'Always verify codes and descriptions with your healthcare provider or official sources.'
    ];
    
    if (metaRow) {
      results.set(code, {
        code,
        codeSystem: (metaRow.code_system as CodeSystem) || inferredSystem,
        explanationText: metaRow.long_desc || metaRow.short_desc || `${code}: Code found in metadata`,
        shortDescription: metaRow.short_desc || undefined,
        longDescription: metaRow.long_desc || undefined,
        confidence: 'high',
        source: 'metadata',
        isPriceable: false,
        whyNotPriced: getWhyNotPricedExplanation(code, inferredSystem),
        disclaimers
      });
    } else {
      // Fallback to pattern inference
      const explanation = await getCodeExplanation(code, context);
      results.set(code, explanation);
    }
  }
  
  return results;
}

/**
 * Check if a code is likely to be in Medicare pricing datasets
 */
export function isLikelyPriceable(code: string): { likely: boolean; reason: string } {
  const normalized = code.trim().toUpperCase();
  const codeSystem = inferCodeSystem(normalized);
  const prefix = normalized.charAt(0);
  
  // S-codes: private payer
  if (prefix === 'S') {
    return { likely: false, reason: 'S-codes are private payer codes, not in Medicare fee schedules' };
  }
  
  // T-codes: Medicaid
  if (prefix === 'T') {
    return { likely: false, reason: 'T-codes are state Medicaid codes, not in Medicare fee schedules' };
  }
  
  // D-codes: Dental
  if (prefix === 'D') {
    return { likely: false, reason: 'D-codes are dental procedures, typically not covered by Medicare Part B' };
  }
  
  // Lab codes
  if (codeSystem === 'cpt') {
    const num = parseInt(normalized, 10);
    if (num >= 80000 && num <= 89999) {
      return { likely: false, reason: 'Laboratory tests require CLFS data (not yet imported)' };
    }
    
    // Category II/III
    if (normalized.endsWith('F')) {
      return { likely: false, reason: 'Category II codes are tracking codes with no payment' };
    }
    if (normalized.endsWith('T')) {
      return { likely: false, reason: 'Category III codes may not have established pricing' };
    }
  }
  
  // Revenue codes
  if (codeSystem === 'revenue_code') {
    return { likely: false, reason: 'Revenue codes are not individually priced' };
  }
  
  // Standard CPT/HCPCS that should be priceable
  if (codeSystem === 'cpt' || codeSystem === 'hcpcs_level_ii') {
    return { likely: true, reason: 'Standard CPT/HCPCS code - should be in Medicare fee schedules' };
  }
  
  return { likely: false, reason: 'Unknown code format' };
}
