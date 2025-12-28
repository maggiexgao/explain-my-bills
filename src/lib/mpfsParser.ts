/**
 * MPFS Parser - Parse Medicare Physician Fee Schedule data from PFREV4 format
 * Based on PF25PD layout specification (CSV format with quoted fields)
 */

export type RawMpfsRow = {
  year: number;
  carrierNumber: string;
  localityCode: string;
  hcpcsCpt: string;
  modifier: string | null;
  statusCode: string;
  pcTcIndicator: string;
  nonfacilityFee: number | null;
  facilityFee: number | null;
  oppsCappedNonfacilityFee: number | null;
  oppsCappedFacilityFee: number | null;
};

/**
 * Parse a single line from PFREV4.txt (CSV format with quoted fields)
 * Format: "year","carrier","locality","hcpcs","mod","nonfac","fac","ind","pctc","status","multisurg","50therapy1","50therapy2","opps_ind","opps_nonfac","opps_fac"
 */
export function parsePfrev4Line(line: string): RawMpfsRow | null {
  if (!line || line.trim() === '' || line.startsWith('TRL')) {
    return null;
  }

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
  fields.push(current.trim());

  if (fields.length < 16) {
    return null;
  }

  const parseAmount = (val: string): number | null => {
    const cleaned = val.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) || num === 0 ? null : num;
  };

  const modifier = fields[4]?.trim();

  return {
    year: parseInt(fields[0], 10),
    carrierNumber: fields[1],
    localityCode: fields[2],
    hcpcsCpt: fields[3],
    modifier: modifier && modifier !== '' ? modifier : null,
    nonfacilityFee: parseAmount(fields[5]),
    facilityFee: parseAmount(fields[6]),
    pcTcIndicator: fields[8] || '0',
    statusCode: fields[9] || 'A',
    oppsCappedNonfacilityFee: parseAmount(fields[14]),
    oppsCappedFacilityFee: parseAmount(fields[15]),
  };
}

/**
 * Load MPFS data from PFREV4.txt file
 */
export async function loadMpfsFromPfrev4(): Promise<RawMpfsRow[]> {
  try {
    const response = await fetch('/data/PFREV4.txt');
    if (!response.ok) {
      console.warn('Could not load PFREV4.txt:', response.status);
      return [];
    }
    const text = await response.text();
    const lines = text.split('\n');
    const rows: RawMpfsRow[] = [];

    for (const line of lines) {
      const row = parsePfrev4Line(line);
      if (row) {
        rows.push(row);
      }
    }

    console.log(`Loaded ${rows.length} MPFS rows from PFREV4.txt`);
    return rows;
  } catch (error) {
    console.error('Error loading MPFS data:', error);
    return [];
  }
}
