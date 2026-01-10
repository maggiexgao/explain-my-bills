import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface MpfsRecord {
  hcpcs: string;
  modifier: string | null;
  description: string | null;
  status: string | null;
  work_rvu: number | null;
  nonfac_pe_rvu: number | null;
  fac_pe_rvu: number | null;
  mp_rvu: number | null;
  nonfac_fee: number | null;
  fac_fee: number | null;
  pctc: string | null;
  global_days: string | null;
  mult_surgery_indicator: string | null;
  conversion_factor: number | null;
  year: number | null;
  qp_status: string | null;
  source: string | null;
}

interface GpciRecord {
  locality_num: string;
  state_abbr: string;
  locality_name: string;
  zip_code: string | null;
  work_gpci: number;
  pe_gpci: number;
  mp_gpci: number;
}

export interface ZipToLocalityRecord {
  zip5: string;
  state_abbr: string | null;
  locality_num: string;
  carrier_num: string | null;
  effective_year: number | null;
  city_name: string | null;
  county_name: string | null;
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '' || value === 'not found') {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function parseString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value).trim();
}

export async function fetchAndParseExcel(url: string): Promise<unknown[][]> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  return data;
}

export function parseMpfsData(data: unknown[][]): MpfsRecord[] {
  // Skip header row
  const records: MpfsRecord[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    
    const hcpcs = parseString(row[0]);
    if (!hcpcs) continue;
    
    records.push({
      hcpcs,
      modifier: parseString(row[1]),
      description: parseString(row[2]),
      status: parseString(row[3]),
      work_rvu: parseNumber(row[4]),
      nonfac_pe_rvu: parseNumber(row[5]),
      fac_pe_rvu: parseNumber(row[6]),
      mp_rvu: parseNumber(row[7]),
      nonfac_fee: parseNumber(row[8]),
      fac_fee: parseNumber(row[9]),
      pctc: parseString(row[10]),
      global_days: parseString(row[11]),
      mult_surgery_indicator: parseString(row[12]),
      conversion_factor: parseNumber(row[13]) ?? 34.6062,
      year: parseNumber(row[14]) ?? 2026,
      qp_status: parseString(row[15]),
      source: parseString(row[16]),
    });
  }
  
  return records;
}

export function parseGpciData(data: unknown[][]): GpciRecord[] {
  // Skip header row
  const records: GpciRecord[] = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;
    
    const locality_num = parseString(row[0]);
    const state_abbr = parseString(row[1]);
    const locality_name = parseString(row[2]);
    
    if (!locality_num || !state_abbr || !locality_name) continue;
    
    const work_gpci = parseNumber(row[4]);
    const pe_gpci = parseNumber(row[5]);
    const mp_gpci = parseNumber(row[6]);
    
    if (work_gpci === null || pe_gpci === null || mp_gpci === null) continue;
    
    records.push({
      locality_num,
      state_abbr,
      locality_name,
      zip_code: parseString(row[3]),
      work_gpci,
      pe_gpci,
      mp_gpci,
    });
  }
  
  return records;
}

export async function importMpfsToDatabase(
  records: MpfsRecord[],
  onProgress?: (imported: number, total: number) => void
): Promise<{ success: boolean; imported: number; error?: string }> {
  const batchSize = 500;
  let imported = 0;
  
  try {
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error } = await supabase.from('mpfs_benchmarks').upsert(
        batch.map(r => ({
          hcpcs: r.hcpcs,
          modifier: r.modifier,
          description: r.description,
          status: r.status,
          work_rvu: r.work_rvu,
          nonfac_pe_rvu: r.nonfac_pe_rvu,
          fac_pe_rvu: r.fac_pe_rvu,
          mp_rvu: r.mp_rvu,
          nonfac_fee: r.nonfac_fee,
          fac_fee: r.fac_fee,
          pctc: r.pctc,
          global_days: r.global_days,
          mult_surgery_indicator: r.mult_surgery_indicator,
          conversion_factor: r.conversion_factor,
          year: r.year,
          qp_status: r.qp_status,
          source: r.source,
        })),
        { onConflict: 'hcpcs,modifier', ignoreDuplicates: false }
      );
      
      if (error) throw error;
      
      imported += batch.length;
      onProgress?.(imported, records.length);
    }
    
    return { success: true, imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, imported, error: message };
  }
}

export async function importGpciToDatabase(
  records: GpciRecord[],
  onProgress?: (imported: number, total: number) => void
): Promise<{ success: boolean; imported: number; error?: string }> {
  const batchSize = 500;
  let imported = 0;
  
  try {
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { error } = await supabase.from('gpci_localities').upsert(
        batch.map(r => ({
          locality_num: r.locality_num,
          state_abbr: r.state_abbr,
          locality_name: r.locality_name,
          zip_code: r.zip_code,
          work_gpci: r.work_gpci,
          pe_gpci: r.pe_gpci,
          mp_gpci: r.mp_gpci,
        })),
        { onConflict: 'locality_num', ignoreDuplicates: false }
      );
      
      if (error) throw error;
      
      imported += batch.length;
      onProgress?.(imported, records.length);
    }
    
    return { success: true, imported };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, imported, error: message };
  }
}

/**
 * Parse ZIP→Locality crosswalk from CMS ZIP5 Excel file
 * Expected columns: STATE, ZIP CODE, CARRIER, LOCALITY, YEAR/QTR
 */
export function parseZipToLocalityData(data: unknown[][]): ZipToLocalityRecord[] {
  const records: ZipToLocalityRecord[] = [];
  
  // Find header row (should be first row)
  const headerRow = data[0] as string[];
  if (!headerRow) return records;
  
  // Map column indices
  const stateIdx = headerRow.findIndex(h => String(h).toUpperCase().includes('STATE'));
  const zipIdx = headerRow.findIndex(h => String(h).toUpperCase().includes('ZIP'));
  const carrierIdx = headerRow.findIndex(h => String(h).toUpperCase().includes('CARRIER'));
  const localityIdx = headerRow.findIndex(h => String(h).toUpperCase() === 'LOCALITY');
  const yearQtrIdx = headerRow.findIndex(h => String(h).toUpperCase().includes('YEAR'));

  if (zipIdx === -1 || localityIdx === -1) {
    console.error('Required columns (ZIP, LOCALITY) not found in header:', headerRow);
    return records;
  }
  
  // Process data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    // Get ZIP code - normalize to 5 digits
    const rawZip = parseString(row[zipIdx]);
    if (!rawZip) continue;
    
    // Normalize ZIP: pad with leading zeros if needed, take first 5 chars
    const zip5 = rawZip.replace(/\D/g, '').padStart(5, '0').slice(0, 5);
    if (zip5.length !== 5) continue;
    
    // Get locality number - keep as string (may have leading zeros)
    const locality_num = parseString(row[localityIdx]);
    if (!locality_num) continue;
    
    // Get state abbreviation
    const state_abbr = stateIdx >= 0 ? parseString(row[stateIdx]) : null;
    
    // Get carrier number
    const carrier_num = carrierIdx >= 0 ? parseString(row[carrierIdx]) : null;
    
    // Parse YEAR/QTR (e.g., "20261" -> 2026)
    let effective_year: number | null = null;
    if (yearQtrIdx >= 0) {
      const yearQtr = parseString(row[yearQtrIdx]);
      if (yearQtr && yearQtr.length >= 4) {
        const yearPart = parseInt(yearQtr.slice(0, 4), 10);
        if (!isNaN(yearPart)) {
          effective_year = yearPart;
        }
      }
    }
    
    records.push({
      zip5,
      state_abbr,
      locality_num,
      carrier_num,
      effective_year,
      city_name: null, // Not in CMS ZIP5 file
      county_name: null, // Not in CMS ZIP5 file
    });
  }
  
  return records;
}

/**
 * Import ZIP→Locality crosswalk data to database
 */
export async function importZipToLocalityDatabase(
  records: ZipToLocalityRecord[],
  onProgress?: (imported: number, total: number) => void
): Promise<{ success: boolean; imported: number; duplicatesSkipped: number; error?: string }> {
  const batchSize = 1000; // Larger batch for high-volume ZIP data
  let imported = 0;
  let duplicatesSkipped = 0;
  
  // Deduplicate by zip5 (keep first occurrence / latest year if available)
  const zipMap = new Map<string, ZipToLocalityRecord>();
  for (const record of records) {
    const existing = zipMap.get(record.zip5);
    if (!existing) {
      zipMap.set(record.zip5, record);
    } else {
      // Keep the one with higher effective year, or first if both null/equal
      if (record.effective_year && (!existing.effective_year || record.effective_year > existing.effective_year)) {
        zipMap.set(record.zip5, record);
      }
      duplicatesSkipped++;
    }
  }

  const uniqueRecords = Array.from(zipMap.values());

  try {
    for (let i = 0; i < uniqueRecords.length; i += batchSize) {
      const batch = uniqueRecords.slice(i, i + batchSize);
      
      const { error } = await supabase.from('zip_to_locality').upsert(
        batch.map(r => ({
          zip5: r.zip5,
          state_abbr: r.state_abbr,
          locality_num: r.locality_num,
          carrier_num: r.carrier_num,
          effective_year: r.effective_year,
          city_name: r.city_name,
          county_name: r.county_name,
          source: 'CMS ZIP-to-locality',
        })),
        { onConflict: 'zip5', ignoreDuplicates: false }
      );
      
      if (error) throw error;
      
      imported += batch.length;
      onProgress?.(imported, uniqueRecords.length);
    }
    
    return { success: true, imported, duplicatesSkipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('ZIP crosswalk import error:', message);
    return { success: false, imported, duplicatesSkipped, error: message };
  }
}
