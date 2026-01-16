/**
 * CPT/HCPCS Code Validator
 * 
 * Strict validation to prevent words like "LEVEL" or "VISIT" from being treated as codes.
 * Only accepts valid CPT (5 digits) or HCPCS Level II (1 letter + 4 digits) codes.
 */

export interface ValidatedCode {
  code: string | null;
  modifier: string | null;
  kind: 'cpt' | 'hcpcs' | 'invalid';
  reason?: string;
}

export interface RejectedToken {
  token: string;
  reason: string;
}

// CPT: exactly 5 digits (00100-99999)
const CPT_PATTERN = /^[0-9]{5}$/;

// HCPCS Level II: 1 letter + 4 digits (A0000-Z9999)
const HCPCS_PATTERN = /^[A-Z][0-9]{4}$/;

// Modifier pattern: 2 alphanumeric characters
const MODIFIER_PATTERN = /^[A-Z0-9]{2}$/;

// Common words that should NEVER be treated as codes
const REJECTED_WORDS = new Set([
  'LEVEL', 'VISIT', 'TOTAL', 'CHARGE', 'SERVICE', 'PRICE', 'AMOUNT',
  'PATIENT', 'PROVIDER', 'HOSPITAL', 'CLINIC', 'DOCTOR', 'NURSE',
  'DATE', 'TIME', 'PAGE', 'BILL', 'STATEMENT', 'INVOICE', 'ACCOUNT',
  'BALANCE', 'PAYMENT', 'CREDIT', 'DEBIT', 'INSURANCE', 'COPAY',
  'DEDUCTIBLE', 'COINSURANCE', 'ALLOWED', 'BILLED', 'PAID', 'DUE',
  'DESCRIPTION', 'CODE', 'PROCEDURE', 'DIAGNOSIS', 'MODIFIER',
  'UNIT', 'UNITS', 'QTY', 'QUANTITY', 'EACH', 'ROOM', 'EMERGENCY',
  'FACILITY', 'OFFICE', 'OUTPATIENT', 'INPATIENT', 'AMBULATORY',
  'PHARMACY', 'LABORATORY', 'RADIOLOGY', 'SURGICAL', 'MEDICAL',
  'HEALTH', 'CARE', 'NAME', 'ADDRESS', 'PHONE', 'FAX', 'EMAIL',
  'NOTES', 'COMMENTS', 'REMARKS', 'TYPE', 'CLASS', 'STATUS',
  'APPROVED', 'DENIED', 'PENDING', 'PROCESSED', 'CLAIM', 'NUMBER',
  'REF', 'REFERENCE', 'AUTH', 'AUTHORIZATION', 'PRIOR', 'PRE',
  'POST', 'FOLLOW', 'FOLLOWUP', 'CONSULT', 'CONSULTATION',
  'EVAL', 'EVALUATION', 'EXAM', 'EXAMINATION', 'TEST', 'TESTING',
  'RESULT', 'RESULTS', 'REPORT', 'REPORTS', 'SPECIMEN', 'SAMPLE',
  'BLOOD', 'URINE', 'TISSUE', 'FLUID', 'SCAN', 'IMAGING',
  'XRAY', 'MRI', 'CT', 'PET', 'ULTRASOUND', 'ECHO', 'EKG', 'ECG',
  'SURGERY', 'OPERATION', 'ANESTHESIA', 'RECOVERY', 'ICU',
  'SUPPLY', 'SUPPLIES', 'EQUIPMENT', 'DEVICE', 'DRUG', 'MEDICATION',
  'RX', 'PRESCRIPTION', 'INJECTION', 'INFUSION', 'THERAPY',
  'TREATMENT', 'MANAGEMENT', 'MONITORING', 'SCREENING', 'PREVENTION',
  'INITIAL', 'SUBSEQUENT', 'FINAL', 'COMPLETE', 'PARTIAL', 'LIMITED',
  'SIMPLE', 'COMPLEX', 'MODERATE', 'MINOR', 'MAJOR', 'ROUTINE',
  'STANDARD', 'SPECIAL', 'ADDITIONAL', 'EXTRA', 'OTHER', 'MISC',
  'MISCELLANEOUS', 'GENERAL', 'SPECIFIC', 'DETAILED', 'COMPREHENSIVE',
  'HIGH', 'LOW', 'NORMAL', 'ABNORMAL', 'POSITIVE', 'NEGATIVE',
  'PRIMARY', 'SECONDARY', 'TERTIARY', 'MAIN', 'SUB', 'CATEGORY',
  'GROUP', 'SECTION', 'PART', 'ITEM', 'LINE', 'ROW', 'ENTRY',
  'TRUE', 'FALSE', 'YES', 'NO', 'NA', 'N/A', 'NONE', 'NULL',
  'FROM', 'TO', 'FOR', 'WITH', 'WITHOUT', 'AND', 'OR', 'THE', 'A', 'AN',
  // Common short abbreviations
  'ER', 'ED', 'OR', 'PT', 'OT', 'IV', 'IM', 'PO', 'BID', 'TID', 'QID',
  'PRN', 'STAT', 'ASA', 'BP', 'HR', 'RR', 'TEMP', 'HT', 'WT', 'BMI',
  // Financial terms
  'USD', 'DOLLAR', 'DOLLARS', 'CENTS', 'FEE', 'FEES', 'COST', 'COSTS',
  'RATE', 'RATES', 'TAX', 'TAXES', 'DISCOUNT', 'ADJUSTMENT', 'WRITE',
  'WRITEOFF', 'REFUND', 'REBATE', 'CREDIT', 'COLLECTION', 'DUE',
  // Additional stopwords for better false positive prevention
  'CMPLX', 'EMERG', 'MGMT', 'MGMNT', 'HCPCS', 'ICD', 'REV', 'REVENUE', 'CPT', 'NDC'
]);

// Stopwords for reverse search (too generic to match)
export const REVERSE_SEARCH_STOPWORDS = new Set([
  'visit', 'level', 'service', 'procedure', 'charge', 'hospital', 'facility',
  'patient', 'room', 'emergency', 'total', 'department', 'care', 'medical',
  'health', 'billing', 'office', 'clinic', 'treatment', 'therapy', 'management',
  'evaluation', 'exam', 'examination', 'consultation', 'consult', 'initial',
  'subsequent', 'follow', 'followup', 'new', 'established', 'the', 'a', 'an',
  'and', 'or', 'for', 'with', 'without', 'of', 'in', 'on', 'at', 'to', 'from',
  'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'must', 'shall', 'can', 'need', 'not', 'no', 'yes', 'all', 'each', 'every',
  'any', 'some', 'one', 'two', 'three', 'four', 'five', 'other', 'another',
  'same', 'different', 'such', 'only', 'own', 'just', 'also', 'very', 'even',
  'more', 'most', 'less', 'least', 'than', 'then', 'now', 'here', 'there',
  'when', 'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose',
  'this', 'that', 'these', 'those', 'it', 'its', 'they', 'their', 'them',
  'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'hers',
]);

/**
 * Normalize and validate a raw token as a CPT/HCPCS code
 * 
 * @param rawToken - The raw token extracted from a document
 * @returns ValidatedCode object with code, kind, and reason
 */
export function normalizeAndValidateCode(rawToken: string): ValidatedCode {
  if (!rawToken || typeof rawToken !== 'string') {
    return { code: null, modifier: null, kind: 'invalid', reason: 'Empty or non-string input' };
  }
  
  // Step 1: Basic cleanup
  let cleaned = rawToken.trim().toUpperCase();
  
  // Remove common prefixes
  cleaned = cleaned
    .replace(/^CPT[\s:.\-]*/i, '')
    .replace(/^HCPCS[\s:.\-]*/i, '')
    .replace(/^CODE[\s:.\-]*/i, '')
    .replace(/^PROCEDURE[\s:.\-]*/i, '')
    .replace(/^#/, '');
  
  // Remove surrounding punctuation
  cleaned = cleaned.replace(/^[.,;:()[\]{}"']+/, '').replace(/[.,;:()[\]{}"']+$/, '');
  
  // Trim again
  cleaned = cleaned.trim();
  
  // Step 2: Reject if empty or too short/long
  if (cleaned.length < 4) {
    return { code: null, modifier: null, kind: 'invalid', reason: 'Token too short (< 4 chars)' };
  }
  
  if (cleaned.length > 10) {
    return { code: null, modifier: null, kind: 'invalid', reason: 'Token too long (> 10 chars)' };
  }
  
  // Step 3: Reject if purely alphabetic (words like "LEVEL", "VISIT")
  if (/^[A-Z]+$/.test(cleaned)) {
    return { code: null, modifier: null, kind: 'invalid', reason: 'Purely alphabetic token (likely a word, not a code)' };
  }
  
  // Step 4: Reject known words
  if (REJECTED_WORDS.has(cleaned)) {
    return { code: null, modifier: null, kind: 'invalid', reason: `Known non-code word: ${cleaned}` };
  }
  
  // Step 5: Check for modifier separation (e.g., "99284-25" or "99284 25")
  let code = cleaned;
  let modifier: string | null = null;
  
  // Check for hyphen-separated modifier
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-').map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length >= 2) {
      code = parts[0];
      // Second part is modifier if it's 2 chars alphanumeric
      if (MODIFIER_PATTERN.test(parts[1])) {
        modifier = parts[1];
      }
    }
  }
  // Check for space-separated modifier
  else if (cleaned.includes(' ')) {
    const parts = cleaned.split(/\s+/).filter(p => p.length > 0);
    if (parts.length >= 2) {
      code = parts[0];
      if (MODIFIER_PATTERN.test(parts[1])) {
        modifier = parts[1];
      }
    }
  }
  // ✅ NEW: Check for INLINE modifier (e.g., "93976TC" = code "93976" + modifier "TC")
  // Pattern: 5 digits followed by 2 letters (common modifiers: TC, 26, LT, RT, 59, etc.)
  else if (/^\d{5}[A-Z]{2}$/.test(cleaned)) {
    code = cleaned.substring(0, 5);
    modifier = cleaned.substring(5, 7);
    console.log(`[cptCodeValidator] Extracted inline modifier: ${cleaned} → code=${code}, modifier=${modifier}`);
  }
  // ✅ NEW: Check for INLINE modifier with HCPCS (e.g., "A4570TC")
  else if (/^[A-Z]\d{4}[A-Z0-9]{2}$/.test(cleaned)) {
    code = cleaned.substring(0, 5);
    modifier = cleaned.substring(5, 7);
    console.log(`[cptCodeValidator] Extracted HCPCS inline modifier: ${cleaned} → code=${code}, modifier=${modifier}`);
  }
  
  // Step 6: Validate code format
  // CPT: exactly 5 digits
  if (CPT_PATTERN.test(code)) {
    return { code, modifier, kind: 'cpt', reason: undefined };
  }
  
  // HCPCS Level II: 1 letter + 4 digits
  if (HCPCS_PATTERN.test(code)) {
    return { code, modifier, kind: 'hcpcs', reason: undefined };
  }
  
  // Step 7: Try to extract a valid code from the token
  // Look for 5-digit pattern
  const fiveDigitMatch = cleaned.match(/\b(\d{5})\b/);
  if (fiveDigitMatch && CPT_PATTERN.test(fiveDigitMatch[1])) {
    return { code: fiveDigitMatch[1], modifier, kind: 'cpt', reason: undefined };
  }
  
  // Look for HCPCS pattern
  const hcpcsMatch = cleaned.match(/\b([A-Z]\d{4})\b/);
  if (hcpcsMatch && HCPCS_PATTERN.test(hcpcsMatch[1])) {
    return { code: hcpcsMatch[1], modifier, kind: 'hcpcs', reason: undefined };
  }
  
  // ✅ NEW: Try extracting 5 digits from start even without word boundary
  if (/^\d{5}/.test(cleaned)) {
    const extractedCode = cleaned.substring(0, 5);
    const remainingChars = cleaned.substring(5);
    // Check if remaining chars could be a modifier
    if (remainingChars.length === 0) {
      return { code: extractedCode, modifier: null, kind: 'cpt', reason: undefined };
    } else if (remainingChars.length === 2 && MODIFIER_PATTERN.test(remainingChars)) {
      return { code: extractedCode, modifier: remainingChars, kind: 'cpt', reason: undefined };
    }
  }
  
  // Step 8: Final rejection
  return { 
    code: null, 
    modifier: null, 
    kind: 'invalid', 
    reason: `Does not match CPT (5 digits) or HCPCS (letter + 4 digits) format: "${cleaned}"` 
  };
}

/**
 * Batch validate multiple tokens
 * 
 * @param tokens - Array of raw tokens
 * @returns Object with valid codes and rejected tokens
 */
export function validateCodeTokens(tokens: string[]): {
  validCodes: ValidatedCode[];
  rejectedTokens: RejectedToken[];
} {
  const validCodes: ValidatedCode[] = [];
  const rejectedTokens: RejectedToken[] = [];
  const seenCodes = new Set<string>();
  
  for (const token of tokens) {
    const result = normalizeAndValidateCode(token);
    
    if (result.kind !== 'invalid' && result.code) {
      // Deduplicate
      if (!seenCodes.has(result.code)) {
        seenCodes.add(result.code);
        validCodes.push(result);
      }
    } else {
      rejectedTokens.push({
        token,
        reason: result.reason || 'Unknown validation failure'
      });
    }
  }
  
  return { validCodes, rejectedTokens };
}

/**
 * Check if a query string has enough meaningful tokens for reverse search
 * (after removing stopwords)
 * 
 * @param query - The query string
 * @param minTokens - Minimum number of meaningful tokens required
 * @returns Whether the query is valid for reverse search
 */
export function isValidReverseSearchQuery(query: string, minTokens: number = 2): {
  isValid: boolean;
  meaningfulTokens: string[];
  reason?: string;
} {
  if (!query || typeof query !== 'string') {
    return { isValid: false, meaningfulTokens: [], reason: 'Empty or invalid query' };
  }
  
  // Tokenize and lowercase
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3); // Minimum 3 chars
  
  // Remove stopwords
  const meaningfulTokens = tokens.filter(t => !REVERSE_SEARCH_STOPWORDS.has(t));
  
  if (meaningfulTokens.length < minTokens) {
    return { 
      isValid: false, 
      meaningfulTokens, 
      reason: `Only ${meaningfulTokens.length} meaningful tokens after removing stopwords (need ${minTokens})` 
    };
  }
  
  return { isValid: true, meaningfulTokens };
}

/**
 * Extract all potential code tokens from a text string
 * 
 * @param text - The text to scan
 * @returns Array of potential code tokens
 */
export function extractPotentialCodes(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  const tokens: string[] = [];
  
  // Look for 5-digit patterns
  const fiveDigitMatches = text.match(/\b\d{5}\b/g) || [];
  tokens.push(...fiveDigitMatches);
  
  // Look for HCPCS patterns (letter + 4 digits)
  const hcpcsMatches = text.match(/\b[A-Za-z]\d{4}\b/g) || [];
  tokens.push(...hcpcsMatches.map(m => m.toUpperCase()));
  
  // Look for code-with-modifier patterns (5 digits or HCPCS + hyphen + 2 chars)
  const codeModifierMatches = text.match(/\b(\d{5}|[A-Za-z]\d{4})-[A-Za-z0-9]{2}\b/g) || [];
  tokens.push(...codeModifierMatches.map(m => m.toUpperCase()));
  
  return [...new Set(tokens)]; // Deduplicate
}
