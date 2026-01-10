/**
 * DMEPOS Fee Schedule Importer
 * 
 * Parses the CMS DMEPOS fee schedule Excel/CSV files and imports to Supabase.
 * Handles both DMEPOS (main equipment) and DMEPEN (enteral/parenteral nutrition).
 * 
 * The DMEPOS file format has state-specific fee columns like "CA (NR)", "CA (R)" etc.
 */

import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

export interface DmeposRecord {
  year: number;
  hcpcs: string;
  modifier: string | null;
  modifier2: string | null;
  jurisdiction: string | null;
  category: string | null;
  ceiling: number | null;
  floor: number | null;
  fee: number | null;
  fee_rental: number | null;
  state_abbr: string | null;
  short_desc: string | null;
  source_file: string;
}

export interface DmeposImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  sampleRows: DmeposRecord[];
}

// Parse numeric value, stripping $ and commas
function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  
  if (typeof value === 'number') {
    return isNaN(value) || value === 0 ? null : value;
  }
  
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,]/g, '').trim();
    if (cleaned === '' || cleaned === '-' || cleaned === '0.00' || cleaned === '0') return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) || parsed === 0 ? null : parsed;
  }
  
  return null;
}

function parseString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

// US State abbreviations
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX',
  'UT', 'VT', 'VA', 'VI', 'WA', 'WV', 'WI', 'WY'
];

/**
 * Parse state column header like "CA (NR)" or "CA (R)"
 * Returns { state: 'CA', isRental: false } or null
 */
function parseStateColumn(header: string): { state: string; isRental: boolean } | null {
  const match = header.match(/^([A-Z]{2})\s*\((NR|R)\)$/i);
  if (match) {
    const state = match[1].toUpperCase();
    if (US_STATES.includes(state)) {
      return { state, isRental: match[2].toUpperCase() === 'R' };
    }
  }
  return null;
}

/**
 * Parse DMEPOS Excel file
 * 
 * The file has headers in row 12 (0-indexed):
 * HCPCS | Mod | Mod2 | JURIS | CATG | Ceiling | Floor | AL (NR) | AL (R) | ... | Description
 */
export function parseDmeposData(data: unknown[][], year: number = 2026, sourceFile: string = 'DMEPOS'): DmeposRecord[] {
  const records: DmeposRecord[] = [];
  
  // Find header row
  let headerRowIndex = -1;
  let colMap: Record<string, number> = {};
  let stateColumns: Array<{ colIndex: number; state: string; isRental: boolean }> = [];
  
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    // Look for HCPCS header
    const hcpcsColIndex = row.findIndex(cell => 
      typeof cell === 'string' && cell.toUpperCase().trim() === 'HCPCS'
    );
    
    if (hcpcsColIndex >= 0) {
      headerRowIndex = i;
      
      // Build column map
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const upper = cell.toUpperCase().trim();
          if (upper === 'HCPCS') colMap['hcpcs'] = idx;
          else if (upper === 'MOD' || upper === 'MODIFIER') colMap['modifier'] = idx;
          else if (upper === 'MOD2') colMap['modifier2'] = idx;
          else if (upper === 'JURIS' || upper === 'JURISDICTION') colMap['jurisdiction'] = idx;
          else if (upper === 'CATG' || upper === 'CATEGORY') colMap['category'] = idx;
          else if (upper === 'CEILING') colMap['ceiling'] = idx;
          else if (upper === 'FLOOR') colMap['floor'] = idx;
          else if (upper === 'DESCRIPTION' || upper === 'DESC') colMap['description'] = idx;
          
          // Check for state column
          const stateInfo = parseStateColumn(cell.trim());
          if (stateInfo) {
            stateColumns.push({ colIndex: idx, ...stateInfo });
          }
        }
      });
      break;
    }
  }
  
  if (headerRowIndex < 0 || colMap['hcpcs'] === undefined) {
    console.error('Could not find HCPCS header in DMEPOS file');
    return records;
  }
  
  console.log('DMEPOS header found at row', headerRowIndex);
  console.log('Column map:', colMap);
  console.log('State columns found:', stateColumns.length);
  
  // Parse data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    const hcpcs = parseString(row[colMap['hcpcs']]);
    if (!hcpcs || hcpcs.length < 4) continue;
    
    const normalizedHcpcs = hcpcs.toUpperCase().trim();
    const modifier = parseString(row[colMap['modifier']]);
    const modifier2 = parseString(row[colMap['modifier2']]);
    const jurisdiction = parseString(row[colMap['jurisdiction']]);
    const category = parseString(row[colMap['category']]);
    const ceiling = parseNumeric(row[colMap['ceiling']]);
    const floor = parseNumeric(row[colMap['floor']]);
    const shortDesc = parseString(row[colMap['description']]);
    
    // If we have state columns, create one record per state with a fee
    if (stateColumns.length > 0) {
      // Group state columns by state
      const stateData: Record<string, { fee: number | null; rental: number | null }> = {};
      
      for (const sc of stateColumns) {
        const val = parseNumeric(row[sc.colIndex]);
        if (!stateData[sc.state]) {
          stateData[sc.state] = { fee: null, rental: null };
        }
        if (sc.isRental) {
          stateData[sc.state].rental = val;
        } else {
          stateData[sc.state].fee = val;
        }
      }
      
      // Create records for states with fees
      for (const [state, fees] of Object.entries(stateData)) {
        if (fees.fee !== null || fees.rental !== null) {
          records.push({
            year,
            hcpcs: normalizedHcpcs,
            modifier,
            modifier2,
            jurisdiction,
            category,
            ceiling,
            floor,
            fee: fees.fee,
            fee_rental: fees.rental,
            state_abbr: state,
            short_desc: shortDesc,
            source_file: sourceFile
          });
        }
      }
    } else {
      // No state columns - create single record with ceiling/floor as fee
      records.push({
        year,
        hcpcs: normalizedHcpcs,
        modifier,
        modifier2,
        jurisdiction,
        category,
        ceiling,
        floor,
        fee: ceiling || floor,
        fee_rental: null,
        state_abbr: null,
        short_desc: shortDesc,
        source_file: sourceFile
      });
    }
  }
  
  return records;
}

/**
 * Fetch and parse DMEPOS Excel file from URL
 */
export async function fetchAndParseDmepos(url: string, year: number = 2026, sourceFile: string = 'DMEPOS'): Promise<DmeposRecord[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch DMEPOS file: ${response.statusText}`);
  
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Get first sheet
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to 2D array
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  
  return parseDmeposData(data, year, sourceFile);
}

/**
 * Import DMEPOS records to database
 */
export async function importDmeposToDatabase(
  records: DmeposRecord[],
  tableName: 'dmepos_fee_schedule' | 'dmepen_fee_schedule' = 'dmepos_fee_schedule',
  onProgress?: (imported: number, total: number) => void
): Promise<DmeposImportResult> {
  const BATCH_SIZE = 500;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const sampleRows = records.slice(0, 10);
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from(tableName)
      .upsert(batch, {
        onConflict: 'year,hcpcs,modifier,state_abbr',
        ignoreDuplicates: false
      });
    
    if (error) {
      // If conflict on unique constraint, try inserting without upsert
      console.warn(`Batch upsert error: ${error.message}, trying insert`);
      
      const { error: insertError } = await supabase
        .from(tableName)
        .insert(batch);
      
      if (insertError) {
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`);
        skipped += batch.length;
      } else {
        imported += batch.length;
      }
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
