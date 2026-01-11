/**
 * Admin Import Edge Function
 * 
 * Handles server-side import of Medicare data files:
 * - MPFS (Medicare Physician Fee Schedule)
 * - GPCI (Geographic Practice Cost Indices)
 * - OPPS (Outpatient Prospective Payment System)
 * - DMEPOS (Durable Medical Equipment)
 * - DMEPEN (Enteral/Parenteral Nutrition)
 * - ZIP Crosswalk
 * 
 * Features:
 * - Robust column detection with flexible header matching
 * - Batched upserts (500 rows)
 * - Dry run mode for validation
 * - Structured error responses
 * - Service role for bypassing RLS
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Type Definitions
// ============================================================================

interface ImportRequest {
  dataType: 'mpfs' | 'gpci' | 'opps' | 'dmepos' | 'dmepen' | 'zip-crosswalk' | 'self-test';
  dryRun?: boolean;
  year?: number;
}

interface ImportResponse {
  ok: boolean;
  errorCode?: string;
  message: string;
  details?: {
    totalRowsRead: number;
    validRows: number;
    imported: number;
    skipped: number;
    skippedReasons?: Record<string, number>;
    sampleRows?: unknown[];
    columnsDetected?: string[];
    headerRowIndex?: number;
    sheetName?: string;
  };
}

interface ColumnMap {
  [key: string]: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    // Remove $, commas, parentheses
    const cleaned = value.replace(/[$,()]/g, '').trim();
    if (cleaned === '' || cleaned === '-' || cleaned.toLowerCase() === 'n/a' || 
        cleaned.toLowerCase() === 'not found') return null;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  // Remove unicode whitespace and normalize
  const normalized = str.replace(/[\u00A0\u2007\u202F\uFEFF]/g, ' ').trim();
  return normalized === '' ? null : normalized;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ============================================================================
// OPPS Parser
// ============================================================================

function parseOppsData(data: unknown[][], year: number = 2025): { records: unknown[]; meta: { headerRow: number; columns: string[] } } {
  const records: unknown[] = [];
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};

  // Find header row - look for row with HCPCS and at least one other expected column
  const expectedHeaders = ['hcpcs', 'hcpcscode', 'si', 'statusindicator', 'apc', 'paymentrate', 'payment'];
  
  for (let i = 0; i < Math.min(50, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    let matchCount = 0;
    row.forEach((cell, idx) => {
      if (typeof cell === 'string') {
        const normalized = normalizeHeader(cell);
        if (expectedHeaders.includes(normalized) || normalized.includes('hcpcs')) {
          matchCount++;
        }
      }
    });
    
    if (matchCount >= 2) {
      headerRowIndex = i;
      
      // Build column map with flexible matching
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const normalized = normalizeHeader(cell);
          if (normalized.includes('hcpcs')) colMap['hcpcs'] = idx;
          else if (normalized === 'shortdescriptor' || normalized.includes('shortdesc')) colMap['short_desc'] = idx;
          else if (normalized === 'si' || normalized === 'statusindicator') colMap['status_indicator'] = idx;
          else if (normalized === 'apc') colMap['apc'] = idx;
          else if (normalized === 'relativeweight') colMap['relative_weight'] = idx;
          else if (normalized === 'paymentrate' || normalized === 'payment') colMap['payment_rate'] = idx;
          else if (normalized.includes('national') && normalized.includes('copay')) colMap['national_copay'] = idx;
          else if (normalized.includes('minimum') && normalized.includes('copay')) colMap['minimum_copay'] = idx;
          else if (normalized.includes('long') && normalized.includes('desc')) colMap['long_desc'] = idx;
        }
      });
      break;
    }
  }

  if (headerRowIndex < 0 || colMap['hcpcs'] === undefined) {
    return { records: [], meta: { headerRow: -1, columns: [] } };
  }

  // Parse data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    const hcpcs = parseString(row[colMap['hcpcs']]);
    if (!hcpcs || hcpcs.length < 4) continue;
    
    records.push({
      year,
      hcpcs: hcpcs.toUpperCase().trim(),
      apc: parseString(row[colMap['apc']]),
      status_indicator: parseString(row[colMap['status_indicator']]),
      payment_rate: parseNumeric(row[colMap['payment_rate']]),
      relative_weight: parseNumeric(row[colMap['relative_weight']]),
      short_desc: parseString(row[colMap['short_desc']]),
      long_desc: parseString(row[colMap['long_desc']]),
      national_unadjusted_copayment: parseNumeric(row[colMap['national_copay']]),
      minimum_unadjusted_copayment: parseNumeric(row[colMap['minimum_copay']]),
      source_file: 'opps_addendum_b_' + year
    });
  }

  return { 
    records, 
    meta: { 
      headerRow: headerRowIndex, 
      columns: Object.keys(colMap) 
    } 
  };
}

// ============================================================================
// DMEPOS Parser
// ============================================================================

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
  'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'PR', 'RI', 'SC', 'SD', 'TN', 'TX',
  'UT', 'VT', 'VA', 'VI', 'WA', 'WV', 'WI', 'WY'
];

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

function parseDmeposData(data: unknown[][], year: number = 2026, sourceFile: string = 'DMEPOS'): { records: unknown[]; meta: { headerRow: number; columns: string[]; stateColumns: number } } {
  const records: unknown[] = [];
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};
  const stateColumns: Array<{ colIndex: number; state: string; isRental: boolean }> = [];

  // Find header row
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    const hcpcsColIndex = row.findIndex(cell => 
      typeof cell === 'string' && normalizeHeader(cell) === 'hcpcs'
    );
    
    if (hcpcsColIndex >= 0) {
      headerRowIndex = i;
      
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const upper = cell.toUpperCase().trim();
          const normalized = normalizeHeader(cell);
          
          if (normalized === 'hcpcs') colMap['hcpcs'] = idx;
          else if (normalized === 'mod' || normalized === 'modifier') colMap['modifier'] = idx;
          else if (normalized === 'mod2') colMap['modifier2'] = idx;
          else if (normalized === 'juris' || normalized === 'jurisdiction') colMap['jurisdiction'] = idx;
          else if (normalized === 'catg' || normalized === 'category') colMap['category'] = idx;
          else if (normalized === 'ceiling') colMap['ceiling'] = idx;
          else if (normalized === 'floor') colMap['floor'] = idx;
          else if (normalized === 'description' || normalized === 'desc') colMap['description'] = idx;
          
          // Check for state column like "CA (NR)"
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
    return { records: [], meta: { headerRow: -1, columns: [], stateColumns: 0 } };
  }

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
            modifier: modifier || '',
            modifier2: modifier2 || '',
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
        modifier: modifier || '',
        modifier2: modifier2 || '',
        jurisdiction,
        category,
        ceiling,
        floor,
        fee: ceiling || floor,
        fee_rental: null,
        state_abbr: '',
        short_desc: shortDesc,
        source_file: sourceFile
      });
    }
  }

  return { 
    records, 
    meta: { 
      headerRow: headerRowIndex, 
      columns: Object.keys(colMap),
      stateColumns: stateColumns.length 
    } 
  };
}

// ============================================================================
// GPCI Parser
// ============================================================================

function parseGpciData(data: unknown[][]): { records: unknown[]; meta: { headerRow: number; columns: string[] } } {
  const records: unknown[] = [];
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};

  // Find header row
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    let matchCount = 0;
    row.forEach((cell) => {
      if (typeof cell === 'string') {
        const normalized = normalizeHeader(cell);
        if (normalized.includes('locality') || normalized.includes('gpci') || normalized.includes('state')) {
          matchCount++;
        }
      }
    });
    
    if (matchCount >= 2) {
      headerRowIndex = i;
      
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const normalized = normalizeHeader(cell);
          if (normalized.includes('localitynum') || normalized === 'locality') colMap['locality_num'] = idx;
          else if (normalized.includes('localityname')) colMap['locality_name'] = idx;
          else if (normalized === 'state' || normalized.includes('stateabbr')) colMap['state_abbr'] = idx;
          else if (normalized.includes('workgpci') || normalized === 'work') colMap['work_gpci'] = idx;
          else if (normalized.includes('pegpci') || normalized === 'pe') colMap['pe_gpci'] = idx;
          else if (normalized.includes('mpgpci') || normalized === 'mp' || normalized.includes('malpractice')) colMap['mp_gpci'] = idx;
        }
      });
      break;
    }
  }

  if (headerRowIndex < 0 || colMap['locality_num'] === undefined) {
    return { records: [], meta: { headerRow: -1, columns: [] } };
  }

  // Parse data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    const localityNum = parseString(row[colMap['locality_num']]);
    if (!localityNum) continue;
    
    const stateAbbr = parseString(row[colMap['state_abbr']]);
    const localityName = parseString(row[colMap['locality_name']]);
    const workGpci = parseNumeric(row[colMap['work_gpci']]);
    const peGpci = parseNumeric(row[colMap['pe_gpci']]);
    const mpGpci = parseNumeric(row[colMap['mp_gpci']]);
    
    if (workGpci === null || peGpci === null || mpGpci === null) continue;
    
    records.push({
      locality_num: localityNum,
      locality_name: localityName || localityNum,
      state_abbr: stateAbbr || 'XX',
      work_gpci: workGpci,
      pe_gpci: peGpci,
      mp_gpci: mpGpci
    });
  }

  return { 
    records, 
    meta: { 
      headerRow: headerRowIndex, 
      columns: Object.keys(colMap) 
    } 
  };
}

// ============================================================================
// ZIP Crosswalk Parser
// ============================================================================

function parseZipCrosswalkData(data: unknown[][]): { records: unknown[]; meta: { headerRow: number; columns: string[] } } {
  const records: unknown[] = [];
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};

  // Find header row
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    let hasZip = false;
    let hasLocality = false;
    
    row.forEach((cell) => {
      if (typeof cell === 'string') {
        const normalized = normalizeHeader(cell);
        if (normalized.includes('zip') || normalized.includes('zipcode')) hasZip = true;
        if (normalized.includes('locality')) hasLocality = true;
      }
    });
    
    if (hasZip && hasLocality) {
      headerRowIndex = i;
      
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const normalized = normalizeHeader(cell);
          if (normalized.includes('zipcode') || normalized === 'zip') colMap['zip5'] = idx;
          else if (normalized === 'state') colMap['state_abbr'] = idx;
          else if (normalized === 'locality') colMap['locality_num'] = idx;
          else if (normalized === 'carrier') colMap['carrier_num'] = idx;
          else if (normalized.includes('county')) colMap['county_name'] = idx;
          else if (normalized.includes('city')) colMap['city_name'] = idx;
          else if (normalized.includes('year')) colMap['effective_year'] = idx;
        }
      });
      break;
    }
  }

  if (headerRowIndex < 0 || colMap['zip5'] === undefined || colMap['locality_num'] === undefined) {
    return { records: [], meta: { headerRow: -1, columns: [] } };
  }

  // Parse data rows - deduplicate by zip5
  const seenZips = new Set<string>();
  
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    let zipRaw = parseString(row[colMap['zip5']]);
    if (!zipRaw) continue;
    
    // Normalize ZIP - pad to 5 digits
    const zip5 = zipRaw.replace(/\D/g, '').padStart(5, '0').slice(0, 5);
    if (zip5.length !== 5) continue;
    
    // Skip duplicates
    if (seenZips.has(zip5)) continue;
    seenZips.add(zip5);
    
    const localityNum = parseString(row[colMap['locality_num']]);
    if (!localityNum) continue;
    
    records.push({
      zip5,
      locality_num: localityNum,
      state_abbr: parseString(row[colMap['state_abbr']]),
      carrier_num: parseString(row[colMap['carrier_num']]),
      county_name: parseString(row[colMap['county_name']]),
      city_name: parseString(row[colMap['city_name']]),
      effective_year: parseNumeric(row[colMap['effective_year']]) || 2026,
      source: 'CMS ZIP-to-locality'
    });
  }

  return { 
    records, 
    meta: { 
      headerRow: headerRowIndex, 
      columns: Object.keys(colMap) 
    } 
  };
}

// ============================================================================
// Batch Upsert Helper
// ============================================================================

async function batchUpsert(
  supabase: any,
  tableName: string,
  records: unknown[],
  conflictColumns: string,
  dryRun: boolean = false
): Promise<{ imported: number; errors: string[] }> {
  if (dryRun) {
    return { imported: 0, errors: [] };
  }

  const BATCH_SIZE = 500;
  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from(tableName)
      .upsert(batch as any, {
        onConflict: conflictColumns,
        ignoreDuplicates: false
      });

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      imported += batch.length;
    }
  }

  return { imported, errors };
}

// ============================================================================
// Find Best Sheet in Workbook
// ============================================================================

function findBestSheet(workbook: XLSX.WorkBook, hints: string[]): string {
  const sheetNames = workbook.SheetNames;
  
  // First try to find sheet by name hint
  for (const hint of hints) {
    const match = sheetNames.find(name => 
      name.toLowerCase().includes(hint.toLowerCase())
    );
    if (match) return match;
  }
  
  // Fall back to sheet with most rows
  let bestSheet = sheetNames[0];
  let maxRows = 0;
  
  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rowCount = range.e.r - range.s.r + 1;
    if (rowCount > maxRows) {
      maxRows = rowCount;
      bestSheet = name;
    }
  }
  
  return bestSheet;
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check content type for file upload vs JSON
    const contentType = req.headers.get("content-type") || "";
    
    let dataType: string;
    let dryRun = false;
    let year: number | undefined;
    let fileBuffer: ArrayBuffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await req.formData();
      dataType = formData.get("dataType") as string;
      dryRun = formData.get("dryRun") === "true";
      year = formData.get("year") ? parseInt(formData.get("year") as string) : undefined;
      
      const file = formData.get("file") as File;
      if (file) {
        fileBuffer = await file.arrayBuffer();
      }
    } else {
      // Handle JSON request (for self-test, etc.)
      const body: ImportRequest = await req.json();
      dataType = body.dataType;
      dryRun = body.dryRun || false;
      year = body.year;
    }

    // Self-test endpoint
    if (dataType === "self-test") {
      // Test database connectivity
      const { count, error } = await supabase
        .from("mpfs_benchmarks")
        .select("*", { count: "exact", head: true });
      
      if (error) {
        return new Response(JSON.stringify({
          ok: false,
          errorCode: "DB_CONNECTION_FAILED",
          message: "Database connection test failed",
          details: { error: error.message }
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      return new Response(JSON.stringify({
        ok: true,
        message: "Self-test passed. Database connection verified.",
        details: {
          mpfsRowCount: count,
          serviceRoleActive: true
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Require file for import operations
    if (!fileBuffer) {
      return new Response(JSON.stringify({
        ok: false,
        errorCode: "NO_FILE",
        message: "No file provided for import"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Parse Excel file
    const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
    
    let response: ImportResponse;

    // Route to appropriate parser
    switch (dataType) {
      case "opps": {
        const sheetName = findBestSheet(workbook, ["Addendum B", "AddB"]);
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        
        const { records, meta } = parseOppsData(data, year || 2025);
        
        if (records.length === 0) {
          response = {
            ok: false,
            errorCode: "OPPS_PARSE_FAILED",
            message: "Could not detect header row or no valid HCPCS codes found",
            details: {
              totalRowsRead: data.length,
              validRows: 0,
              imported: 0,
              skipped: 0,
              sheetName,
              headerRowIndex: meta.headerRow,
              columnsDetected: meta.columns,
              sampleRows: data.slice(0, 5)
            }
          };
        } else {
          const { imported, errors } = await batchUpsert(
            supabase, 
            "opps_addendum_b", 
            records, 
            "year,hcpcs",
            dryRun
          );
          
          response = {
            ok: errors.length === 0,
            message: dryRun 
              ? `Dry run complete: ${records.length} valid records found`
              : `Imported ${imported} OPPS records`,
            details: {
              totalRowsRead: data.length,
              validRows: records.length,
              imported: dryRun ? 0 : imported,
              skipped: records.length - imported,
              sheetName,
              headerRowIndex: meta.headerRow,
              columnsDetected: meta.columns,
              sampleRows: records.slice(0, 10)
            }
          };
          
          if (errors.length > 0) {
            response.errorCode = "PARTIAL_IMPORT";
            response.message = errors.join("; ");
          }
        }
        break;
      }

      case "dmepos":
      case "dmepen": {
        const sheetName = findBestSheet(workbook, [dataType === "dmepen" ? "DMEPEN" : "DMEPOS"]);
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        
        const sourceFile = dataType === "dmepen" ? "DMEPEN26_JAN" : "DMEPOS26_JAN";
        const tableName = dataType === "dmepen" ? "dmepen_fee_schedule" : "dmepos_fee_schedule";
        
        const { records, meta } = parseDmeposData(data, year || 2026, sourceFile);
        
        if (records.length === 0) {
          response = {
            ok: false,
            errorCode: `${dataType.toUpperCase()}_PARSE_FAILED`,
            message: "Could not detect header row or no valid HCPCS codes found",
            details: {
              totalRowsRead: data.length,
              validRows: 0,
              imported: 0,
              skipped: 0,
              sheetName,
              headerRowIndex: meta.headerRow,
              columnsDetected: meta.columns,
              sampleRows: data.slice(0, 5)
            }
          };
        } else {
          const { imported, errors } = await batchUpsert(
            supabase, 
            tableName, 
            records, 
            "hcpcs,modifier,modifier2,state_abbr,year,source_file",
            dryRun
          );
          
          response = {
            ok: errors.length === 0,
            message: dryRun 
              ? `Dry run complete: ${records.length} valid records found (${meta.stateColumns} state columns)`
              : `Imported ${imported} ${dataType.toUpperCase()} records`,
            details: {
              totalRowsRead: data.length,
              validRows: records.length,
              imported: dryRun ? 0 : imported,
              skipped: records.length - imported,
              sheetName,
              headerRowIndex: meta.headerRow,
              columnsDetected: meta.columns,
              sampleRows: records.slice(0, 10)
            }
          };
          
          if (errors.length > 0) {
            response.errorCode = "PARTIAL_IMPORT";
            response.message = errors.join("; ");
          }
        }
        break;
      }

      case "gpci": {
        const sheetName = findBestSheet(workbook, ["GPCI", "Locality"]);
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        
        const { records, meta } = parseGpciData(data);
        
        if (records.length === 0) {
          response = {
            ok: false,
            errorCode: "GPCI_PARSE_FAILED",
            message: "Could not detect header row or no valid localities found",
            details: {
              totalRowsRead: data.length,
              validRows: 0,
              imported: 0,
              skipped: 0,
              sheetName,
              headerRowIndex: meta.headerRow,
              columnsDetected: meta.columns,
              sampleRows: data.slice(0, 5)
            }
          };
        } else {
          const { imported, errors } = await batchUpsert(
            supabase, 
            "gpci_localities", 
            records, 
            "locality_num",
            dryRun
          );
          
          response = {
            ok: errors.length === 0,
            message: dryRun 
              ? `Dry run complete: ${records.length} valid localities found`
              : `Imported ${imported} GPCI records`,
            details: {
              totalRowsRead: data.length,
              validRows: records.length,
              imported: dryRun ? 0 : imported,
              skipped: records.length - imported,
              sheetName,
              headerRowIndex: meta.headerRow,
              columnsDetected: meta.columns,
              sampleRows: records.slice(0, 10)
            }
          };
          
          if (errors.length > 0) {
            response.errorCode = "PARTIAL_IMPORT";
            response.message = errors.join("; ");
          }
        }
        break;
      }

      case "zip-crosswalk": {
        const sheetName = findBestSheet(workbook, ["ZIP", "Crosswalk"]);
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        
        const { records, meta } = parseZipCrosswalkData(data);
        
        if (records.length === 0) {
          response = {
            ok: false,
            errorCode: "ZIP_PARSE_FAILED",
            message: "Could not detect header row or no valid ZIP codes found",
            details: {
              totalRowsRead: data.length,
              validRows: 0,
              imported: 0,
              skipped: 0,
              sheetName,
              headerRowIndex: meta.headerRow,
              columnsDetected: meta.columns,
              sampleRows: data.slice(0, 5)
            }
          };
        } else {
          const { imported, errors } = await batchUpsert(
            supabase, 
            "zip_to_locality", 
            records, 
            "zip5",
            dryRun
          );
          
          response = {
            ok: errors.length === 0,
            message: dryRun 
              ? `Dry run complete: ${records.length} unique ZIP codes found`
              : `Imported ${imported} ZIP mappings`,
            details: {
              totalRowsRead: data.length,
              validRows: records.length,
              imported: dryRun ? 0 : imported,
              skipped: records.length - imported,
              sheetName,
              headerRowIndex: meta.headerRow,
              columnsDetected: meta.columns,
              sampleRows: records.slice(0, 10)
            }
          };
          
          if (errors.length > 0) {
            response.errorCode = "PARTIAL_IMPORT";
            response.message = errors.join("; ");
          }
        }
        break;
      }

      default:
        response = {
          ok: false,
          errorCode: "INVALID_DATA_TYPE",
          message: `Unknown data type: ${dataType}. Supported: opps, dmepos, dmepen, gpci, zip-crosswalk`
        };
    }

    return new Response(JSON.stringify(response), {
      status: response.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    
    console.error("Import error:", message, stack);
    
    return new Response(JSON.stringify({
      ok: false,
      errorCode: "INTERNAL_ERROR",
      message: message,
      details: { stack: stack?.split("\n").slice(0, 5) }
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
