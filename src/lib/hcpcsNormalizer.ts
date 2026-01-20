/**
 * HCPCS Code Normalizer
 * 
 * Centralized utility for normalizing HCPCS/CPT codes.
 * CRITICAL: Never use parseInt(), Number(), or +value on HCPCS codes!
 * 
 * Valid HCPCS formats:
 * - 5 digits: 99284, 80053, 00100
 * - Letter + 4 digits: E0114, J1885, A0428, G0378
 * - 4 digits + letter: 0001U (PLA codes)
 */

/**
 * Normalize an HCPCS code value to canonical format
 * 
 * ALWAYS use this function when handling HCPCS codes.
 * NEVER use parseInt/Number on HCPCS codes!
 * 
 * @param value - Any input value (string, number, null, undefined)
 * @returns Normalized uppercase HCPCS code string
 */
export function normalizeHcpcs(value: unknown): string {
  if (value === null || value === undefined) return '';
  
  // CRITICAL: Always convert to string first - NEVER use Number() or parseInt()!
  const str = String(value).trim().toUpperCase();
  
  // Remove common prefixes and artifacts
  return str
    .replace(/^CPT[\s:.\-]*/i, '')
    .replace(/^HCPCS[\s:.\-]*/i, '')
    .replace(/^CODE[\s:.\-]*/i, '')
    .replace(/^PROCEDURE[\s:.\-]*/i, '')
    .replace(/^#/, '')
    .replace(/[^\w]/g, '') // Remove non-word characters
    .trim();
}

/**
 * Check if a value looks like a valid HCPCS code format
 * Uses string pattern matching only - no numeric conversion
 * 
 * @param code - Code string to validate
 * @returns true if matches valid HCPCS patterns
 */
export function isValidHcpcsFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  
  const normalized = normalizeHcpcs(code);
  
  // Valid patterns:
  // - 5 digits (CPT): 99284, 80053, 00100
  // - 1 letter + 4 digits (HCPCS Level II): E0114, J1885, A0428, G0378
  // - 4 digits + 1 letter (PLA codes): 0001U
  return /^[A-Z0-9]{5}$/i.test(normalized);
}

/**
 * Parse HCPCS code from a cell value for import
 * Returns null if the value is clearly not a valid code
 * 
 * @param value - Cell value from spreadsheet
 * @returns Normalized code or null
 */
export function parseHcpcsFromCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  
  // Convert to string - NEVER parse as number!
  const str = String(value).trim();
  
  // Skip if empty or too long (descriptions, not codes)
  if (str === '' || str.length > 10) return null;
  
  // Skip if it looks like a description (contains spaces or too many characters)
  if (str.includes(' ') && str.length > 7) return null;
  
  const normalized = normalizeHcpcs(str);
  
  // Validate format
  if (normalized.length >= 4 && normalized.length <= 5 && isValidHcpcsFormat(normalized)) {
    return normalized;
  }
  
  return null;
}

/**
 * Extract code and modifier from a combined string
 * Handles formats like "99284-25" or "9997626"
 * 
 * @param value - Combined code+modifier string
 * @returns Object with code and optional modifier
 */
export function extractCodeAndModifier(value: unknown): { code: string | null; modifier: string | null } {
  if (value === null || value === undefined) {
    return { code: null, modifier: null };
  }
  
  const str = String(value).trim().toUpperCase();
  
  // Check for hyphen-separated modifier (e.g., "99284-25")
  if (str.includes('-')) {
    const parts = str.split('-').map(p => p.trim()).filter(p => p.length > 0);
    if (parts.length >= 2) {
      const code = normalizeHcpcs(parts[0]);
      const modifier = parts[1].length === 2 && /^[A-Z0-9]{2}$/.test(parts[1]) ? parts[1] : null;
      return { code: isValidHcpcsFormat(code) ? code : null, modifier };
    }
  }
  
  // Check for inline modifier (e.g., "9997626" = 99976 + modifier 26)
  // Pattern: 5 digits followed by 2 alphanumeric chars
  if (/^\d{5}[A-Z0-9]{2}$/.test(str)) {
    const code = str.substring(0, 5);
    const modifier = str.substring(5, 7);
    return { code, modifier };
  }
  
  // Check for HCPCS with inline modifier (e.g., "A4570TC")
  if (/^[A-Z]\d{4}[A-Z0-9]{2}$/.test(str)) {
    const code = str.substring(0, 5);
    const modifier = str.substring(5, 7);
    return { code, modifier };
  }
  
  // Standard code without modifier
  const code = normalizeHcpcs(str);
  return { code: isValidHcpcsFormat(code) ? code : null, modifier: null };
}
