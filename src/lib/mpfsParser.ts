/**
 * MPFS (Medicare Physician Fee Schedule) Parser
 * Parses PFREV4.txt data using PF25PD field layout specification
 * 
 * File format: CSV with quoted fields
 * Field positions (1-indexed) from PF25PD documentation:
 * - Year: 2-5
 * - Carrier Number: 9-13
 * - Locality: 17-18
 * - HCPCS Code: 22-26
 * - Modifier: 30-31
 * - Non-Facility Fee: 35-44 (9(7).99 format)
 * - Facility Fee: 48-57 (9(7).99 format)
 * - PC/TC Indicator: 65
 * - Status Code: 69
 * - Multiple Surgery Indicator: 73
 * - 50% Therapy Non-Facility: 77-86
 * - 50% Therapy Facility: 90-99
 * - OPPS Indicator: 103
 * - OPPS Non-Facility Fee: 107-116
 * - OPPS Facility Fee: 120-129
 */

export interface RawMpfsRow {
  year: string;
  carrierNumber: string;
  localityCode: string;
  hcpcsCpt: string;
  modifier: string;
  nonfacilityFee: number | null;
  facilityFee: number | null;
  pcTcIndicator: string;
  statusCode: string;
  multipleSurgeryIndicator: string;
  fiftyPercentTherapyNonfacility: number | null;
  fiftyPercentTherapyFacility: number | null;
  oppsIndicator: string;
  oppsCappedNonfacilityFee: number | null;
  oppsCappedFacilityFee: number | null;
}

/**
 * Parse a monetary field in 9(7).99 format (e.g., "0000077.78")
 * Returns null for blank, zero, or invalid values
 */
function parseMonetaryField(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/['"]/g, '').trim();
  if (cleaned === '' || cleaned === '0000000.00') return null;
  const num = parseFloat(cleaned);
  return isNaN(num) || num === 0 ? null : num;
}

/**
 * Parse a single PFREV4 CSV line
 * Format: "val1","val2","val3",...
 */
export function parsePfrev4Line(line: string): RawMpfsRow | null {
  if (!line || line.trim() === '') return null;
  
  // Skip trailer records
  if (line.includes('TRL') || line.includes('Copyright')) return null;
  
  // Parse CSV with quoted fields
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim()); // Last field
  
  // Validate minimum number of fields
  // Expected: year, carrier, locality, hcpcs, modifier, nonfacFee, facFee, filler, pcTc, status, multSurg, 50%nf, 50%f, oppsInd, oppsNf, oppsFac
  if (fields.length < 16) return null;
  
  const year = fields[0];
  const carrierNumber = fields[1];
  const localityCode = fields[2];
  const hcpcsCpt = fields[3];
  const modifier = fields[4]?.trim() || '';
  const nonfacilityFee = parseMonetaryField(fields[5]);
  const facilityFee = parseMonetaryField(fields[6]);
  // fields[7] is filler
  const pcTcIndicator = fields[8] || '';
  const statusCode = fields[9] || '';
  const multipleSurgeryIndicator = fields[10] || '';
  const fiftyPercentTherapyNonfacility = parseMonetaryField(fields[11]);
  const fiftyPercentTherapyFacility = parseMonetaryField(fields[12]);
  const oppsIndicator = fields[13] || '';
  const oppsCappedNonfacilityFee = parseMonetaryField(fields[14]);
  const oppsCappedFacilityFee = parseMonetaryField(fields[15]);
  
  // Validate required fields
  if (!year || !carrierNumber || !localityCode || !hcpcsCpt) return null;
  
  return {
    year,
    carrierNumber,
    localityCode,
    hcpcsCpt,
    modifier,
    nonfacilityFee,
    facilityFee,
    pcTcIndicator,
    statusCode,
    multipleSurgeryIndicator,
    fiftyPercentTherapyNonfacility,
    fiftyPercentTherapyFacility,
    oppsIndicator,
    oppsCappedNonfacilityFee,
    oppsCappedFacilityFee,
  };
}

/**
 * Load and parse the entire PFREV4 file
 * For edge function use - pass the file content directly
 */
export function parsePfrev4Content(content: string): RawMpfsRow[] {
  const lines = content.split('\n');
  const rows: RawMpfsRow[] = [];
  
  for (const line of lines) {
    const row = parsePfrev4Line(line);
    if (row) {
      rows.push(row);
    }
  }
  
  return rows;
}

/**
 * Status codes that indicate payable services
 * A = Active (paid separately)
 * R = Restricted coverage (special instructions)
 * T = Injections (conditionally paid)
 */
export const PAYABLE_STATUS_CODES = ['A', 'R', 'T'];

/**
 * Status codes for non-payable/bundled services
 */
export const NON_PAYABLE_STATUS_CODES = ['B', 'N', 'P', 'E', 'X', 'D', 'F', 'G', 'H', 'I', 'J', 'M', 'C'];

/**
 * Filter rows to only payable codes
 */
export function filterPayableRows(rows: RawMpfsRow[]): RawMpfsRow[] {
  return rows.filter(row => PAYABLE_STATUS_CODES.includes(row.statusCode));
}
