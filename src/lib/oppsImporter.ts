/**
 * OPPS Addendum B Importer
 * 
 * Parses the CMS OPPS Addendum B Excel file and imports to Supabase.
 * Handles the specific format of the January 2025 file.
 */

import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

export interface OppsRecord {
  year: number;
  hcpcs: string;
  apc: string | null;
  status_indicator: string | null;
  payment_rate: number | null;
  relative_weight: number | null;
  short_desc: string | null;
  long_desc: string | null;
  national_unadjusted_copayment: number | null;
  minimum_unadjusted_copayment: number | null;
  source_file: string;
}

export interface OppsImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  sampleRows: OppsRecord[];
}

// Parse numeric value, stripping $ and commas
function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  if (typeof value === 'string') {
    // Remove $ and commas
    const cleaned = value.replace(/[$,]/g, '').trim();
    if (cleaned === '' || cleaned === '-') return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  
  return null;
}

// Parse string value
function parseString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

/**
 * Parse OPPS Addendum B Excel file
 * 
 * Expected columns (row 10 is header in the actual file):
 * HCPCS Code | Short Descriptor | SI | APC | Relative Weight | Payment Rate | 
 * National Unadjusted Copayment | Minimum Unadjusted Copayment | ...
 */
export function parseOppsData(data: unknown[][], year: number = 2025): OppsRecord[] {
  const records: OppsRecord[] = [];
  
  // Find header row (look for "HCPCS Code" or similar)
  let headerRowIndex = -1;
  let colMap: Record<string, number> = {};
  
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    // Look for HCPCS header
    const hcpcsColIndex = row.findIndex(cell => 
      typeof cell === 'string' && 
      (cell.toUpperCase().includes('HCPCS') || cell.toUpperCase() === 'HCPCS CODE')
    );
    
    if (hcpcsColIndex >= 0) {
      headerRowIndex = i;
      
      // Build column map
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const upper = cell.toUpperCase().trim();
          if (upper.includes('HCPCS')) colMap['hcpcs'] = idx;
          else if (upper === 'SHORT DESCRIPTOR' || upper.includes('SHORT DESC')) colMap['short_desc'] = idx;
          else if (upper === 'SI' || upper === 'STATUS INDICATOR') colMap['status_indicator'] = idx;
          else if (upper === 'APC') colMap['apc'] = idx;
          else if (upper === 'RELATIVE WEIGHT') colMap['relative_weight'] = idx;
          else if (upper === 'PAYMENT RATE') colMap['payment_rate'] = idx;
          else if (upper.includes('NATIONAL') && upper.includes('COPAY')) colMap['national_copay'] = idx;
          else if (upper.includes('MINIMUM') && upper.includes('COPAY')) colMap['minimum_copay'] = idx;
        }
      });
      break;
    }
  }
  
  if (headerRowIndex < 0 || colMap['hcpcs'] === undefined) {
    console.error('Could not find HCPCS header in OPPS file');
    return records;
  }
  
  console.log('OPPS header found at row', headerRowIndex, 'columns:', colMap);
  
  // Parse data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    const hcpcs = parseString(row[colMap['hcpcs']]);
    if (!hcpcs || hcpcs.length < 4) continue;
    
    // Normalize HCPCS code
    const normalizedHcpcs = hcpcs.toUpperCase().trim();
    
    records.push({
      year,
      hcpcs: normalizedHcpcs,
      apc: parseString(row[colMap['apc']]),
      status_indicator: parseString(row[colMap['status_indicator']]),
      payment_rate: parseNumeric(row[colMap['payment_rate']]),
      relative_weight: parseNumeric(row[colMap['relative_weight']]),
      short_desc: parseString(row[colMap['short_desc']]),
      long_desc: null, // Not typically in Addendum B
      national_unadjusted_copayment: parseNumeric(row[colMap['national_copay']]),
      minimum_unadjusted_copayment: parseNumeric(row[colMap['minimum_copay']]),
      source_file: 'opps_addendum_b_2025'
    });
  }
  
  return records;
}

/**
 * Fetch and parse OPPS Excel file from URL
 */
export async function fetchAndParseOpps(url: string, year: number = 2025): Promise<OppsRecord[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch OPPS file: ${response.statusText}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to 2D array
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  
  return parseOppsData(data, year);
}

/**
 * Import OPPS records to database
 */
export async function importOppsToDatabase(
  records: OppsRecord[],
  onProgress?: (imported: number, total: number) => void
): Promise<OppsImportResult> {
  const BATCH_SIZE = 500;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const sampleRows = records.slice(0, 10);
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from('opps_addendum_b')
      .upsert(batch, {
        onConflict: 'year,hcpcs',
        ignoreDuplicates: false
      });
    
    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      skipped += batch.length;
    } else {
      imported += batch.length;
    }
    
    onProgress?.(imported, records.length);
  }
  
  return {
    success: errors.length === 0,
    imported,
    skipped,
    errors,
    sampleRows
  };
}
