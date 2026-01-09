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
