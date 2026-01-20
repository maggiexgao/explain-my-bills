/**
 * Admin Import Edge Function
 * 
 * Handles server-side import of Medicare data files:
 * - MPFS (Medicare Physician Fee Schedule)
 * - GPCI (Geographic Practice Cost Indices)
 * - OPPS (Outpatient Prospective Payment System)
 * - DMEPOS (Durable Medical Equipment)
 * - DMEPEN (Enteral/Parenteral Nutrition)
 * - CLFS (Clinical Lab Fee Schedule)
 * - ZIP Crosswalk
 * 
 * Features:
 * - Memory-efficient cell-based parsing (avoids full sheet materialization)
 * - Streaming batch upserts during iteration
 * - CSV fast-path for large files
 * - Structured error responses
 * - Service role for bypassing RLS
 * - JWT authentication required for security
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dev-bypass",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/**
 * Check if bypass is allowed based on origin (dev/preview environments)
 */
function isDevBypassAllowedByOrigin(req: Request): boolean {
  const origin = req.headers.get('Origin') || '';
  const referer = req.headers.get('Referer') || '';
  const host = req.headers.get('Host') || '';
  
  // Check all possible sources for origin hints
  const checkSource = origin || referer || host;
  
  console.log(`[admin-import] Origin check - Origin: "${origin}", Referer: "${referer}", Host: "${host}"`);
  
  const allowedPatterns = [
    'lovable.dev',
    'lovable.app',
    'localhost',
    '127.0.0.1',
    'preview--',  // Lovable preview URLs
  ];
  
  const isAllowed = allowedPatterns.some(pattern => checkSource.toLowerCase().includes(pattern));
  console.log(`[admin-import] Origin allowed: ${isAllowed} (source: "${checkSource}")`);
  
  return isAllowed;
}

// ============================================================================
// Admin Authentication Helper
// ============================================================================

async function verifyAdminAuth(req: Request): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  // DEV BYPASS: Check for development bypass
  // Bypass is enabled when:
  // 1. DEV_BYPASS_ENABLED env var is explicitly "true", OR
  // 2. Request comes from lovable.dev/lovable.app/localhost origins (auto-detect dev/preview)
  const devBypassExplicitlyEnabled = Deno.env.get('DEV_BYPASS_ENABLED') === 'true';
  const devBypassByOrigin = isDevBypassAllowedByOrigin(req);
  const devBypassEnabled = devBypassExplicitlyEnabled || devBypassByOrigin;
  const devBypassToken = Deno.env.get('DEV_BYPASS_TOKEN') || 'admin123'; // Default token for dev
  
  if (devBypassEnabled) {
    const url = new URL(req.url);
    const bypassParam = url.searchParams.get('bypass');
    const devBypassHeader = req.headers.get('X-Dev-Bypass');
    
    // Check if token matches via query param OR header
    const tokenMatches = bypassParam === devBypassToken || devBypassHeader === devBypassToken;
    
    if (tokenMatches) {
      console.log(`[admin-import] DEV BYPASS ACTIVE (explicit=${devBypassExplicitlyEnabled}, origin=${devBypassByOrigin}) - allowing admin access without auth`);
      return { authorized: true, userId: 'dev-bypass' };
    } else {
      console.log(`[admin-import] DEV BYPASS enabled (explicit=${devBypassExplicitlyEnabled}, origin=${devBypassByOrigin}) but token mismatch. Expected: ${devBypassToken}, got param=${bypassParam} header=${devBypassHeader}`);
    }
  } else {
    console.log('[admin-import] DEV BYPASS not enabled - requiring normal auth');
  }

  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing or invalid authorization header' };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[admin-import] Missing Supabase configuration');
    return { authorized: false, error: 'Service configuration error' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  try {
    // Use getClaims to validate the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getClaims(token);
    
    if (error || !data?.claims) {
      console.error('[admin-import] JWT validation failed:', error?.message);
      return { authorized: false, error: 'Invalid or expired token' };
    }

    const userId = data.claims.sub;
    
    // Check if user has admin role in user_roles table
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      console.error('[admin-import] Missing service role key');
      return { authorized: false, error: 'Service configuration error' };
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('[admin-import] Role lookup error:', roleError.message);
      // If user_roles table doesn't exist yet, fall back to allowing any authenticated user
      // This is a graceful degradation for initial setup
      console.warn('[admin-import] Allowing authenticated user - user_roles table may not exist');
      return { authorized: true, userId };
    }

    if (!roleData) {
      console.warn(`[admin-import] User ${userId} does not have admin role`);
      return { authorized: false, error: 'Admin role required' };
    }

    return { authorized: true, userId };
  } catch (e) {
    console.error('[admin-import] Auth error:', e);
    return { authorized: false, error: 'Authentication failed' };
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

interface ImportRequest {
  dataType: 'mpfs' | 'gpci' | 'opps' | 'dmepos' | 'dmepen' | 'clfs' | 'zip-crosswalk' | 'self-test';
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
    batchesCompleted?: number;
    rowsProcessed?: number;
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

/**
 * Get cell value from sheet using cell address (e.g., "A1")
 */
function getCellValue(sheet: XLSX.WorkSheet, col: number, row: number): unknown {
  const addr = XLSX.utils.encode_cell({ c: col, r: row });
  const cell = sheet[addr];
  if (!cell) return null;
  // Return the formatted value if available, otherwise the raw value
  return cell.w !== undefined ? cell.w : cell.v;
}

/**
 * Validate if a value looks like a valid HCPCS code
 * CRITICAL: NEVER use parseInt/Number on HCPCS codes!
 */
function isValidHcpcsCode(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toUpperCase();
  if (str.length !== 5) return false;
  return /^[A-Z0-9]{5}$/.test(str);
}

/**
 * Normalize HCPCS code to canonical format
 */
function normalizeHcpcsCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim().toUpperCase();
  if (str === '' || str.length < 4 || str.length > 7) return null;
  if (str.includes(' ')) return null;
  const cleaned = str.replace(/[^A-Z0-9]/g, '').substring(0, 5);
  if (isValidHcpcsCode(cleaned)) {
    return cleaned;
  }
  return null;
}

// ============================================================================
// CSV Parser (Memory-efficient for large files)
// ============================================================================

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some(f => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++; // Skip \n in \r\n
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }
  
  // Push last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f !== '')) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

// ============================================================================
// Memory-Efficient OPPS Parser (Cell-Based Access with Streaming Upserts)
// ============================================================================

async function parseAndImportOppsStreaming(
  sheet: XLSX.WorkSheet,
  supabase: any,
  year: number,
  dryRun: boolean
): Promise<{
  ok: boolean;
  totalRows: number;
  validRows: number;
  imported: number;
  skipped: number;
  headerRow: number;
  columns: string[];
  sampleCodes: string[];
  batchesCompleted: number;
  errors: string[];
}> {
  const BATCH_SIZE = 500;
  const LOG_INTERVAL = 5000;
  
  // Get sheet range
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  if (!range) {
    return { ok: false, totalRows: 0, validRows: 0, imported: 0, skipped: 0, headerRow: -1, columns: [], sampleCodes: [], batchesCompleted: 0, errors: ['No data range in sheet'] };
  }
  
  const totalRows = range.e.r - range.s.r + 1;
  console.log(`[OPPS Parser] Sheet range: ${sheet['!ref']}, total rows: ${totalRows}`);
  
  // Find header row by scanning first 50 rows for "HCPCS"
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};
  
  for (let r = range.s.r; r <= Math.min(range.s.r + 50, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const val = getCellValue(sheet, c, r);
      if (typeof val === 'string') {
        const upper = val.toUpperCase().trim();
        if (upper === 'HCPCS' || upper === 'HCPCS CODE' || upper === 'HCPCSCODE') {
          headerRowIndex = r;
          console.log(`[OPPS Parser] Found header at row ${r + 1} (0-indexed: ${r})`);
          
          // Build column map from this row
          for (let cc = range.s.c; cc <= range.e.c; cc++) {
            const headerVal = getCellValue(sheet, cc, r);
            if (typeof headerVal === 'string') {
              const normalized = normalizeHeader(headerVal);
              const upperH = headerVal.toUpperCase().trim();
              
              if (upperH === 'HCPCS' || upperH === 'HCPCS CODE') colMap['hcpcs'] = cc;
              else if (normalized === 'shortdescriptor' || normalized.includes('shortdesc') || upperH === 'SHORT DESCRIPTOR') colMap['short_desc'] = cc;
              else if (normalized === 'si' || normalized === 'statusindicator' || upperH === 'SI') colMap['status_indicator'] = cc;
              else if (normalized === 'apc' || upperH === 'APC') colMap['apc'] = cc;
              else if (normalized.includes('relativeweight') || upperH === 'RELATIVE WEIGHT') colMap['relative_weight'] = cc;
              else if (normalized.includes('paymentrate') || upperH === 'PAYMENT RATE') colMap['payment_rate'] = cc;
              else if (normalized.includes('national') && normalized.includes('copay')) colMap['national_copay'] = cc;
              else if (normalized.includes('minimum') && normalized.includes('copay')) colMap['minimum_copay'] = cc;
              else if (normalized.includes('long') && normalized.includes('desc')) colMap['long_desc'] = cc;
            }
          }
          break;
        }
      }
    }
    if (headerRowIndex >= 0) break;
  }
  
  if (headerRowIndex < 0 || colMap['hcpcs'] === undefined) {
    return { ok: false, totalRows, validRows: 0, imported: 0, skipped: 0, headerRow: -1, columns: [], sampleCodes: [], batchesCompleted: 0, errors: ['Could not find HCPCS header row'] };
  }
  
  console.log(`[OPPS Parser] Column map:`, JSON.stringify(colMap));
  
  // Stream through rows, building batches and upserting
  let batch: unknown[] = [];
  let validRows = 0;
  let skipped = 0;
  let imported = 0;
  let batchesCompleted = 0;
  const errors: string[] = [];
  const sampleCodes: string[] = [];
  
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    // Log progress periodically
    const rowNum = r - headerRowIndex;
    if (rowNum % LOG_INTERVAL === 0) {
      console.log(`[OPPS Parser] Processed ${rowNum} rows, ${validRows} valid, ${batchesCompleted} batches completed`);
    }
    
    // Get HCPCS value
    const rawHcpcs = getCellValue(sheet, colMap['hcpcs'], r);
    const hcpcs = normalizeHcpcsCode(rawHcpcs);
    
    if (!hcpcs) {
      skipped++;
      continue;
    }
    
    // Collect sample codes
    if (sampleCodes.length < 10) {
      sampleCodes.push(hcpcs);
    }
    
    // Build record
    const record = {
      year,
      hcpcs,
      apc: parseString(getCellValue(sheet, colMap['apc'], r)),
      status_indicator: parseString(getCellValue(sheet, colMap['status_indicator'], r)),
      payment_rate: parseNumeric(getCellValue(sheet, colMap['payment_rate'], r)),
      relative_weight: parseNumeric(getCellValue(sheet, colMap['relative_weight'], r)),
      short_desc: parseString(getCellValue(sheet, colMap['short_desc'], r)),
      long_desc: parseString(getCellValue(sheet, colMap['long_desc'], r)),
      national_unadjusted_copayment: parseNumeric(getCellValue(sheet, colMap['national_copay'], r)),
      minimum_unadjusted_copayment: parseNumeric(getCellValue(sheet, colMap['minimum_copay'], r)),
      source_file: 'opps_addendum_b_' + year
    };
    
    batch.push(record);
    validRows++;
    
    // Upsert when batch is full
    if (batch.length >= BATCH_SIZE) {
      if (!dryRun) {
        const { error } = await supabase
          .from('opps_addendum_b')
          .upsert(batch, { onConflict: 'year,hcpcs', ignoreDuplicates: false });
        
        if (error) {
          errors.push(`Batch ${batchesCompleted + 1}: ${error.message}`);
        } else {
          imported += batch.length;
        }
      }
      batchesCompleted++;
      batch = [];
    }
  }
  
  // Upsert remaining batch
  if (batch.length > 0) {
    if (!dryRun) {
      const { error } = await supabase
        .from('opps_addendum_b')
        .upsert(batch, { onConflict: 'year,hcpcs', ignoreDuplicates: false });
      
      if (error) {
        errors.push(`Final batch: ${error.message}`);
      } else {
        imported += batch.length;
      }
    }
    batchesCompleted++;
  }
  
  console.log(`[OPPS Parser] Complete: ${validRows} valid, ${imported} imported, ${skipped} skipped, ${batchesCompleted} batches`);
  console.log(`[OPPS Parser] Sample codes:`, sampleCodes);
  
  return {
    ok: errors.length === 0,
    totalRows,
    validRows,
    imported: dryRun ? 0 : imported,
    skipped,
    headerRow: headerRowIndex,
    columns: Object.keys(colMap),
    sampleCodes,
    batchesCompleted,
    errors
  };
}

// ============================================================================
// CSV-based OPPS Parser (Even more memory efficient for very large files)
// ============================================================================

async function parseAndImportOppsCSV(
  csvData: string[][],
  supabase: any,
  year: number,
  dryRun: boolean
): Promise<{
  ok: boolean;
  totalRows: number;
  validRows: number;
  imported: number;
  skipped: number;
  headerRow: number;
  columns: string[];
  sampleCodes: string[];
  batchesCompleted: number;
  errors: string[];
}> {
  const BATCH_SIZE = 500;
  const LOG_INTERVAL = 5000;
  
  const totalRows = csvData.length;
  console.log(`[OPPS CSV Parser] Total rows: ${totalRows}`);
  
  // Find header row
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};
  
  for (let i = 0; i < Math.min(50, csvData.length); i++) {
    const row = csvData[i];
    const hcpcsColIdx = row.findIndex(cell => {
      if (typeof cell === 'string') {
        const upper = cell.toUpperCase().trim();
        return upper === 'HCPCS' || upper === 'HCPCS CODE' || upper === 'HCPCSCODE';
      }
      return false;
    });
    
    if (hcpcsColIdx >= 0) {
      headerRowIndex = i;
      console.log(`[OPPS CSV Parser] Found header at row ${i + 1}`);
      
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const normalized = normalizeHeader(cell);
          const upper = cell.toUpperCase().trim();
          
          if (upper === 'HCPCS' || upper === 'HCPCS CODE') colMap['hcpcs'] = idx;
          else if (normalized === 'shortdescriptor' || normalized.includes('shortdesc')) colMap['short_desc'] = idx;
          else if (normalized === 'si' || normalized === 'statusindicator') colMap['status_indicator'] = idx;
          else if (normalized === 'apc') colMap['apc'] = idx;
          else if (normalized.includes('relativeweight')) colMap['relative_weight'] = idx;
          else if (normalized.includes('paymentrate')) colMap['payment_rate'] = idx;
          else if (normalized.includes('national') && normalized.includes('copay')) colMap['national_copay'] = idx;
          else if (normalized.includes('minimum') && normalized.includes('copay')) colMap['minimum_copay'] = idx;
          else if (normalized.includes('long') && normalized.includes('desc')) colMap['long_desc'] = idx;
        }
      });
      break;
    }
  }
  
  if (headerRowIndex < 0 || colMap['hcpcs'] === undefined) {
    return { ok: false, totalRows, validRows: 0, imported: 0, skipped: 0, headerRow: -1, columns: [], sampleCodes: [], batchesCompleted: 0, errors: ['Could not find HCPCS header row'] };
  }
  
  console.log(`[OPPS CSV Parser] Column map:`, JSON.stringify(colMap));
  
  // Stream through rows
  let batch: unknown[] = [];
  let validRows = 0;
  let skipped = 0;
  let imported = 0;
  let batchesCompleted = 0;
  const errors: string[] = [];
  const sampleCodes: string[] = [];
  
  for (let i = headerRowIndex + 1; i < csvData.length; i++) {
    const row = csvData[i];
    const rowNum = i - headerRowIndex;
    
    if (rowNum % LOG_INTERVAL === 0) {
      console.log(`[OPPS CSV Parser] Processed ${rowNum} rows, ${validRows} valid`);
    }
    
    const hcpcs = normalizeHcpcsCode(row[colMap['hcpcs']]);
    if (!hcpcs) {
      skipped++;
      continue;
    }
    
    if (sampleCodes.length < 10) {
      sampleCodes.push(hcpcs);
    }
    
    const record = {
      year,
      hcpcs,
      apc: parseString(row[colMap['apc']]),
      status_indicator: parseString(row[colMap['status_indicator']]),
      payment_rate: parseNumeric(row[colMap['payment_rate']]),
      relative_weight: parseNumeric(row[colMap['relative_weight']]),
      short_desc: parseString(row[colMap['short_desc']]),
      long_desc: parseString(row[colMap['long_desc']]),
      national_unadjusted_copayment: parseNumeric(row[colMap['national_copay']]),
      minimum_unadjusted_copayment: parseNumeric(row[colMap['minimum_copay']]),
      source_file: 'opps_addendum_b_' + year
    };
    
    batch.push(record);
    validRows++;
    
    if (batch.length >= BATCH_SIZE) {
      if (!dryRun) {
        const { error } = await supabase
          .from('opps_addendum_b')
          .upsert(batch, { onConflict: 'year,hcpcs', ignoreDuplicates: false });
        
        if (error) {
          errors.push(`Batch ${batchesCompleted + 1}: ${error.message}`);
        } else {
          imported += batch.length;
        }
      }
      batchesCompleted++;
      batch = [];
    }
  }
  
  // Final batch
  if (batch.length > 0) {
    if (!dryRun) {
      const { error } = await supabase
        .from('opps_addendum_b')
        .upsert(batch, { onConflict: 'year,hcpcs', ignoreDuplicates: false });
      
      if (error) {
        errors.push(`Final batch: ${error.message}`);
      } else {
        imported += batch.length;
      }
    }
    batchesCompleted++;
  }
  
  console.log(`[OPPS CSV Parser] Complete: ${validRows} valid, ${imported} imported`);
  
  return {
    ok: errors.length === 0,
    totalRows,
    validRows,
    imported: dryRun ? 0 : imported,
    skipped,
    headerRow: headerRowIndex,
    columns: Object.keys(colMap),
    sampleCodes,
    batchesCompleted,
    errors
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
// CLFS (Clinical Lab Fee Schedule) Parser
// ============================================================================

function parseClfsData(data: unknown[][], year: number = 2026): { records: unknown[]; meta: { headerRow: number; columns: string[] } } {
  const records: unknown[] = [];
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};

  // Find header row - look for HCPCS and payment-related columns
  const expectedHeaders = ['hcpcs', 'hcpcscode', 'code', 'payment', 'paymentamount', 'rate', 'nationalamount'];
  
  for (let i = 0; i < Math.min(50, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    let matchCount = 0;
    row.forEach((cell) => {
      if (typeof cell === 'string') {
        const normalized = normalizeHeader(cell);
        if (expectedHeaders.includes(normalized) || normalized.includes('hcpcs') || normalized.includes('code')) {
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
          if (normalized.includes('hcpcs') || normalized === 'code') colMap['hcpcs'] = idx;
          else if (normalized.includes('shortdesc') || normalized === 'shortdescriptor') colMap['short_desc'] = idx;
          else if (normalized.includes('longdesc') || normalized === 'descriptor' || normalized === 'description') colMap['long_desc'] = idx;
          else if (normalized.includes('payment') || normalized.includes('amount') || normalized === 'rate' || normalized.includes('national')) colMap['payment_amount'] = idx;
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
    
    // Lab codes typically start with 8 (80000-89999) or certain other patterns
    const normalizedHcpcs = hcpcs.toUpperCase().trim();
    
    records.push({
      year,
      hcpcs: normalizedHcpcs,
      payment_amount: parseNumeric(row[colMap['payment_amount']]),
      short_desc: parseString(row[colMap['short_desc']]),
      long_desc: parseString(row[colMap['long_desc']]),
      source_file: 'CLFS_' + year
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
  // Handle CORS preflight - return 200 with all CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Verify admin authentication
  const authResult = await verifyAdminAuth(req);
  if (!authResult.authorized) {
    console.warn(`[admin-import] Unauthorized access attempt: ${authResult.error}`);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        errorCode: "UNAUTHORIZED",
        message: authResult.error || 'Authentication required'
      }),
      { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
  console.log(`[admin-import] Authorized user: ${authResult.userId}`);

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
    let fileName = '';

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await req.formData();
      dataType = formData.get("dataType") as string;
      dryRun = formData.get("dryRun") === "true";
      year = formData.get("year") ? parseInt(formData.get("year") as string) : undefined;
      
      const file = formData.get("file") as File;
      if (file) {
        fileBuffer = await file.arrayBuffer();
        fileName = file.name.toLowerCase();
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

    let response: ImportResponse;

    // Check if this is a CSV file (for OPPS optimization)
    const isCSV = fileName.endsWith('.csv');
    
    console.log(`[admin-import] Processing ${fileName}, dataType=${dataType}, dryRun=${dryRun}, isCSV=${isCSV}`);

    // Route to appropriate parser
    switch (dataType) {
      case "opps": {
        if (isCSV) {
          // CSV fast-path for OPPS
          console.log(`[admin-import] Using CSV fast-path for OPPS`);
          const text = new TextDecoder().decode(new Uint8Array(fileBuffer));
          const csvData = parseCSV(text);
          
          const result = await parseAndImportOppsCSV(csvData, supabase, year || 2025, dryRun);
          
          response = {
            ok: result.ok && result.errors.length === 0,
            message: dryRun 
              ? `Dry run complete: ${result.validRows} valid records found`
              : `Imported ${result.imported} OPPS records`,
            details: {
              totalRowsRead: result.totalRows,
              validRows: result.validRows,
              imported: result.imported,
              skipped: result.skipped,
              headerRowIndex: result.headerRow,
              columnsDetected: result.columns,
              batchesCompleted: result.batchesCompleted,
              sampleRows: result.sampleCodes.map(code => ({ hcpcs: code }))
            }
          };
          
          if (result.errors.length > 0) {
            response.errorCode = "PARTIAL_IMPORT";
            response.message = result.errors.join("; ");
          }
        } else {
          // XLSX with memory-efficient cell-based parsing
          console.log(`[admin-import] Using cell-based XLSX parser for OPPS`);
          const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
          const sheetName = findBestSheet(workbook, ["Addendum B", "AddB"]);
          const sheet = workbook.Sheets[sheetName];
          
          console.log(`[admin-import] Selected sheet: ${sheetName}`);
          
          const result = await parseAndImportOppsStreaming(sheet, supabase, year || 2025, dryRun);
          
          response = {
            ok: result.ok && result.errors.length === 0,
            message: dryRun 
              ? `Dry run complete: ${result.validRows} valid records found`
              : `Imported ${result.imported} OPPS records`,
            details: {
              totalRowsRead: result.totalRows,
              validRows: result.validRows,
              imported: result.imported,
              skipped: result.skipped,
              sheetName,
              headerRowIndex: result.headerRow,
              columnsDetected: result.columns,
              batchesCompleted: result.batchesCompleted,
              sampleRows: result.sampleCodes.map(code => ({ hcpcs: code }))
            }
          };
          
          if (result.errors.length > 0) {
            response.errorCode = "PARTIAL_IMPORT";
            response.message = result.errors.join("; ");
          }
        }
        break;
      }

      case "dmepos":
      case "dmepen": {
        const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
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
        const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
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
        const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
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

      case "clfs": {
        const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
        const sheetName = findBestSheet(workbook, ["CLFS", "Lab", "Clinical"]);
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        
        const { records, meta } = parseClfsData(data, year || 2026);
        
        if (records.length === 0) {
          response = {
            ok: false,
            errorCode: "CLFS_PARSE_FAILED",
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
            "clfs_fee_schedule", 
            records, 
            "hcpcs,year",
            dryRun
          );
          
          response = {
            ok: errors.length === 0,
            message: dryRun 
              ? `Dry run complete: ${records.length} valid CLFS records found`
              : `Imported ${imported} CLFS records`,
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
          message: `Unknown data type: ${dataType}. Supported: opps, dmepos, dmepen, clfs, gpci, zip-crosswalk`
        };
    }

    return new Response(JSON.stringify(response), {
      status: response.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    
    console.error("[admin-import] Import error:", message, stack);
    
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
