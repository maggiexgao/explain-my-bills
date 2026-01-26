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
 * - Dev bypass for preview environments
 * 
 * CRITICAL: HCPCS codes are ALWAYS treated as strings - never parseInt/Number!
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
  
  const checkSource = origin || referer || host;
  
  console.log(`[admin-import] Origin check - Origin: "${origin}", Referer: "${referer}", Host: "${host}"`);
  
  const allowedPatterns = [
    'lovable.dev',
    'lovable.app',
    'lovableproject.com',
    'localhost',
    '127.0.0.1',
    'preview--',
  ];
  
  const isAllowed = allowedPatterns.some(pattern => checkSource.toLowerCase().includes(pattern));
  console.log(`[admin-import] Origin allowed: ${isAllowed} (source: "${checkSource}")`);
  
  return isAllowed;
}

// ============================================================================
// Admin Authentication Helper
// ============================================================================

async function verifyAdminAuth(req: Request): Promise<{ 
  authorized: boolean; 
  userId?: string; 
  error?: string;
  reason?: string;
  debugInfo?: Record<string, unknown>;
}> {
  const url = new URL(req.url);
  const bypassParam = url.searchParams.get('bypass');
  const devBypassHeader = req.headers.get('X-Dev-Bypass');
  const authHeader = req.headers.get('Authorization');
  const origin = req.headers.get('Origin') || '';
  
  const debugInfo = {
    hasBypassParam: !!bypassParam,
    hasBypassHeader: !!devBypassHeader,
    hasAuthHeader: !!authHeader,
    origin: origin.substring(0, 100),
  };
  
  // DEV BYPASS: Check for development bypass FIRST
  const devBypassExplicitlyEnabled = Deno.env.get('DEV_BYPASS_ENABLED') === 'true';
  const devBypassByOrigin = isDevBypassAllowedByOrigin(req);
  const devBypassEnabled = devBypassExplicitlyEnabled || devBypassByOrigin;
  const devBypassToken = Deno.env.get('DEV_BYPASS_TOKEN') || 'admin123';
  
  const bypassTokenProvided = bypassParam || devBypassHeader;
  const tokenMatches = bypassTokenProvided === devBypassToken;
  
  if (bypassTokenProvided) {
    if (!devBypassEnabled) {
      console.log(`[admin-import] Bypass attempted but not allowed - origin not in allowlist`);
      return { 
        authorized: false, 
        error: 'Bypass not allowed from this origin',
        reason: 'origin_not_allowed',
        debugInfo
      };
    }
    
    if (!tokenMatches) {
      console.log(`[admin-import] Bypass token mismatch. Expected: ${devBypassToken}, got: ${bypassTokenProvided}`);
      return { 
        authorized: false, 
        error: 'Invalid bypass token',
        reason: 'bypass_invalid',
        debugInfo
      };
    }
    
    console.log(`[admin-import] DEV BYPASS ACTIVE (explicit=${devBypassExplicitlyEnabled}, origin=${devBypassByOrigin}) - allowing admin access without auth`);
    return { authorized: true, userId: 'dev-bypass', debugInfo };
  }

  // No bypass attempted - check normal auth
  if (!authHeader?.startsWith('Bearer ')) {
    console.log('[admin-import] No bypass and no auth header - unauthorized');
    return { 
      authorized: false, 
      error: 'Authentication required. Use ?bypass=token for dev mode or sign in.',
      reason: 'no_auth',
      debugInfo
    };
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
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getClaims(token);
    
    if (error || !data?.claims) {
      console.error('[admin-import] JWT validation failed:', error?.message);
      return { authorized: false, error: 'Invalid or expired token' };
    }

    const userId = data.claims.sub;
    
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
  const normalized = str.replace(/[\u00A0\u2007\u202F\uFEFF]/g, ' ').trim();
  return normalized === '' ? null : normalized;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Deduplicate an array of records by a composite key
 * Keeps the LAST occurrence (which typically has the most recent data)
 */
function deduplicateByKey<T>(records: T[], keyFn: (record: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const record of records) {
    const key = keyFn(record);
    seen.set(key, record); // Overwrites previous, keeping last
  }
  return Array.from(seen.values());
}

/**
 * Deduplicate a batch of records before upserting
 * This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" errors
 */
function deduplicateBatch<T>(batch: T[], keyFn: (record: T) => string): T[] {
  return deduplicateByKey(batch, keyFn);
}

function getCellValue(sheet: XLSX.WorkSheet, col: number, row: number): unknown {
  const addr = XLSX.utils.encode_cell({ c: col, r: row });
  const cell = sheet[addr];
  if (!cell) return null;
  return cell.w !== undefined ? cell.w : cell.v;
}

/**
 * CRITICAL: Normalize HCPCS code to string format
 * NEVER use parseInt/Number on HCPCS codes!
 * 
 * Valid patterns:
 * - 5 digits: 99284, 80053, 00100
 * - Letter + 4 digits: E0114, J1885, A0428, G0378
 * - 4 digits + letter: 0001U (PLA codes)
 */
function normalizeHcpcsCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  
  // CRITICAL: Always convert to string first!
  let str = String(value).trim().toUpperCase();
  
  // Remove common prefixes
  str = str
    .replace(/^CPT[\s:.\-]*/i, '')
    .replace(/^HCPCS[\s:.\-]*/i, '')
    .replace(/^CODE[\s:.\-]*/i, '')
    .replace(/^#/, '')
    .replace(/[^\w]/g, '')
    .trim();
  
  if (str === '' || str.length < 4 || str.length > 7) return null;
  
  // If it's purely numeric and less than 5 digits, pad with leading zeros
  if (/^\d+$/.test(str) && str.length < 5) {
    str = str.padStart(5, '0');
  }
  
  // Take first 5 characters for standard codes
  const code = str.substring(0, 5);
  
  // Validate format: must be 5 alphanumeric characters
  if (!/^[A-Z0-9]{5}$/i.test(code)) return null;
  
  return code;
}

/**
 * Validate if a value looks like a valid HCPCS code format
 */
function isValidHcpcsCode(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toUpperCase();
  if (str.length !== 5) return false;
  return /^[A-Z0-9]{5}$/.test(str);
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
        i++;
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
        if (char === '\r') i++;
      } else if (char !== '\r') {
        currentField += char;
      }
    }
  }
  
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
// NO LIMITS - processes ALL rows
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
  const LOG_INTERVAL = 2000;
  
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
  
  // Stream through ALL rows - NO LIMITS
  let batch: unknown[] = [];
  let validRows = 0;
  let skipped = 0;
  let imported = 0;
  let batchesCompleted = 0;
  const errors: string[] = [];
  const sampleCodes: string[] = [];
  
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const rowNum = r - headerRowIndex;
    if (rowNum % LOG_INTERVAL === 0) {
      console.log(`[OPPS Parser] Processing row ${rowNum}/${totalRows - headerRowIndex - 1}, ${validRows} valid, ${batchesCompleted} batches`);
    }
    
    const rawHcpcs = getCellValue(sheet, colMap['hcpcs'], r);
    const hcpcs = normalizeHcpcsCode(rawHcpcs);
    
    if (!hcpcs) {
      skipped++;
      continue;
    }
    
    if (sampleCodes.length < 20) {
      sampleCodes.push(hcpcs);
    }
    
    // Get payment rate - calculate from relative weight if not available
    let paymentRate = parseNumeric(getCellValue(sheet, colMap['payment_rate'], r));
    const relativeWeight = parseNumeric(getCellValue(sheet, colMap['relative_weight'], r));
    
    // If payment_rate is null but relative_weight exists, calculate it
    // 2025 OPPS conversion factor is approximately $89.46
    if (paymentRate === null && relativeWeight !== null) {
      paymentRate = Math.round(relativeWeight * 89.46 * 100) / 100;
    }
    
    const record = {
      year,
      hcpcs,
      apc: parseString(getCellValue(sheet, colMap['apc'], r)),
      status_indicator: parseString(getCellValue(sheet, colMap['status_indicator'], r)),
      payment_rate: paymentRate,
      relative_weight: relativeWeight,
      short_desc: parseString(getCellValue(sheet, colMap['short_desc'], r)),
      long_desc: parseString(getCellValue(sheet, colMap['long_desc'], r)),
      national_unadjusted_copayment: parseNumeric(getCellValue(sheet, colMap['national_copay'], r)),
      minimum_unadjusted_copayment: parseNumeric(getCellValue(sheet, colMap['minimum_copay'], r)),
      source_file: 'opps_addendum_b_' + year
    };
    
    batch.push(record);
    validRows++;
    
    if (batch.length >= BATCH_SIZE) {
      if (!dryRun) {
        // Deduplicate batch by year+hcpcs to prevent ON CONFLICT errors
        const dedupedBatch = deduplicateBatch(batch as any[], (r: any) => `${r.year}-${r.hcpcs}`);
        
        const { error } = await supabase
          .from('opps_addendum_b')
          .upsert(dedupedBatch, { onConflict: 'year,hcpcs', ignoreDuplicates: false });
        
        if (error) {
          errors.push(`Batch ${batchesCompleted + 1}: ${error.message}`);
        } else {
          imported += dedupedBatch.length;
        }
      }
      batchesCompleted++;
      batch = [];
    }
  }
  
  // Upsert remaining batch
  if (batch.length > 0) {
    if (!dryRun) {
      const dedupedBatch = deduplicateBatch(batch as any[], (r: any) => `${r.year}-${r.hcpcs}`);
      
      const { error } = await supabase
        .from('opps_addendum_b')
        .upsert(dedupedBatch, { onConflict: 'year,hcpcs', ignoreDuplicates: false });
      
      if (error) {
        errors.push(`Final batch: ${error.message}`);
      } else {
        imported += dedupedBatch.length;
      }
    }
    batchesCompleted++;
  }
  
  console.log(`[OPPS Parser] Complete: ${validRows} valid, ${imported} imported, ${skipped} skipped, ${batchesCompleted} batches`);
  console.log(`[OPPS Parser] Sample codes:`, sampleCodes.slice(0, 10));
  
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
  const LOG_INTERVAL = 2000;
  
  const totalRows = csvData.length;
  console.log(`[OPPS CSV Parser] Total rows: ${totalRows}`);
  
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
    
    if (sampleCodes.length < 20) {
      sampleCodes.push(hcpcs);
    }
    
    // Calculate payment rate from relative weight if needed
    let paymentRate = parseNumeric(row[colMap['payment_rate']]);
    const relativeWeight = parseNumeric(row[colMap['relative_weight']]);
    if (paymentRate === null && relativeWeight !== null) {
      paymentRate = Math.round(relativeWeight * 89.46 * 100) / 100;
    }
    
    const record = {
      year,
      hcpcs,
      apc: parseString(row[colMap['apc']]),
      status_indicator: parseString(row[colMap['status_indicator']]),
      payment_rate: paymentRate,
      relative_weight: relativeWeight,
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
        // Deduplicate batch by year+hcpcs to prevent ON CONFLICT errors
        const dedupedBatch = deduplicateBatch(batch as any[], (r: any) => `${r.year}-${r.hcpcs}`);
        
        const { error } = await supabase
          .from('opps_addendum_b')
          .upsert(dedupedBatch, { onConflict: 'year,hcpcs', ignoreDuplicates: false });
        
        if (error) {
          errors.push(`Batch ${batchesCompleted + 1}: ${error.message}`);
        } else {
          imported += dedupedBatch.length;
        }
      }
      batchesCompleted++;
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    if (!dryRun) {
      const dedupedBatch = deduplicateBatch(batch as any[], (r: any) => `${r.year}-${r.hcpcs}`);
      
      const { error } = await supabase
        .from('opps_addendum_b')
        .upsert(dedupedBatch, { onConflict: 'year,hcpcs', ignoreDuplicates: false });
      
      if (error) {
        errors.push(`Final batch: ${error.message}`);
      } else {
        imported += dedupedBatch.length;
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
// DMEPOS Parser - Fixed HCPCS string handling
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

  // Find header row - DMEPOS typically has header at row 6-7
  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    const hcpcsColIndex = row.findIndex(cell => 
      typeof cell === 'string' && normalizeHeader(cell) === 'hcpcs'
    );
    
    if (hcpcsColIndex >= 0) {
      headerRowIndex = i;
      console.log(`[DMEPOS Parser] Found header at row ${i + 1} (0-indexed: ${i})`);
      
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
    console.log(`[DMEPOS Parser] Could not find header. Checked ${Math.min(30, data.length)} rows.`);
    return { records: [], meta: { headerRow: -1, columns: [], stateColumns: 0 } };
  }
  
  console.log(`[DMEPOS Parser] Column map:`, JSON.stringify(colMap));
  console.log(`[DMEPOS Parser] State columns found: ${stateColumns.length}`);

  const sampleCodes: string[] = [];
  
  // Parse data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    // CRITICAL: Use normalizeHcpcsCode to properly handle HCPCS as strings!
    const rawHcpcs = row[colMap['hcpcs']];
    const normalizedHcpcs = normalizeHcpcsCode(rawHcpcs);
    
    if (!normalizedHcpcs) {
      continue;
    }
    
    if (sampleCodes.length < 20) {
      sampleCodes.push(normalizedHcpcs);
    }
    
    const modifier = parseString(row[colMap['modifier']]);
    const modifier2 = parseString(row[colMap['modifier2']]);
    const jurisdiction = parseString(row[colMap['jurisdiction']]);
    const category = parseString(row[colMap['category']]);
    const ceiling = parseNumeric(row[colMap['ceiling']]);
    const floor = parseNumeric(row[colMap['floor']]);
    const shortDesc = parseString(row[colMap['description']]);
    
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
  
  console.log(`[DMEPOS Parser] Parsed ${records.length} records`);
  console.log(`[DMEPOS Parser] Sample codes:`, sampleCodes);

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

  const seenZips = new Set<string>();
  
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    let zipRaw = parseString(row[colMap['zip5']]);
    if (!zipRaw) continue;
    
    const zip5 = zipRaw.replace(/\D/g, '').padStart(5, '0').slice(0, 5);
    if (zip5.length !== 5) continue;
    
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
// CLFS (Clinical Lab Fee Schedule) Parser - Fixed for header at row 4
// ============================================================================

function parseClfsData(data: unknown[][], year: number = 2026): { records: unknown[]; meta: { headerRow: number; columns: string[]; sampleCodes: string[] } } {
  const records: unknown[] = [];
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};
  const sampleCodes: string[] = [];

  console.log(`[CLFS Parser] Searching for header in ${Math.min(50, data.length)} rows`);
  
  // Find header row - look for HCPCS column
  for (let i = 0; i < Math.min(50, data.length); i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    // Check each cell for HCPCS
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (typeof cell === 'string') {
        const normalized = normalizeHeader(cell);
        const upper = cell.toUpperCase().trim();
        
        // Look for HCPCS header
        if (normalized === 'hcpcs' || upper === 'HCPCS' || upper === 'HCPCS CODE' || normalized.includes('hcpcs')) {
          headerRowIndex = i;
          console.log(`[CLFS Parser] Found header at row ${i + 1} (0-indexed: ${i})`);
          
          // Build column map from this row
          row.forEach((headerCell, idx) => {
            if (typeof headerCell === 'string') {
              const hNormalized = normalizeHeader(headerCell);
              const hUpper = headerCell.toUpperCase().trim();
              
              if (hNormalized === 'hcpcs' || hUpper === 'HCPCS') colMap['hcpcs'] = idx;
              else if (hNormalized === 'rate' || hUpper === 'RATE') colMap['payment_amount'] = idx;
              else if (hNormalized === 'shortdesc' || hUpper === 'SHORTDESC') colMap['short_desc'] = idx;
              else if (hNormalized === 'longdesc' || hUpper === 'LONGDESC') colMap['long_desc'] = idx;
              else if (hNormalized === 'mod' || hUpper === 'MOD') colMap['modifier'] = idx;
              else if (hNormalized.includes('payment') || hNormalized.includes('amount')) colMap['payment_amount'] = idx;
              else if (hNormalized.includes('shortdesc') || hNormalized === 'shortdescriptor') colMap['short_desc'] = idx;
              else if (hNormalized.includes('longdesc') || hNormalized === 'descriptor' || hNormalized === 'description') colMap['long_desc'] = idx;
            }
          });
          break;
        }
      }
    }
    if (headerRowIndex >= 0) break;
  }

  if (headerRowIndex < 0 || colMap['hcpcs'] === undefined) {
    console.log(`[CLFS Parser] Could not find header. Data sample:`, data.slice(0, 10));
    return { records: [], meta: { headerRow: -1, columns: [], sampleCodes: [] } };
  }
  
  console.log(`[CLFS Parser] Column map:`, JSON.stringify(colMap));

  // Parse data rows
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;
    
    // CRITICAL: Use normalizeHcpcsCode to handle codes as strings!
    const rawHcpcs = row[colMap['hcpcs']];
    const hcpcs = normalizeHcpcsCode(rawHcpcs);
    
    if (!hcpcs) continue;
    
    if (sampleCodes.length < 20) {
      sampleCodes.push(hcpcs);
    }
    
    records.push({
      year,
      hcpcs,
      payment_amount: parseNumeric(row[colMap['payment_amount']]),
      short_desc: parseString(row[colMap['short_desc']]),
      long_desc: parseString(row[colMap['long_desc']]),
      source_file: 'CLFS_' + year
    });
  }
  
  console.log(`[CLFS Parser] Parsed ${records.length} records`);
  console.log(`[CLFS Parser] Sample codes:`, sampleCodes);

  return { 
    records, 
    meta: { 
      headerRow: headerRowIndex, 
      columns: Object.keys(colMap),
      sampleCodes
    } 
  };
}

// ============================================================================
// MPFS Parser - STREAMING version with cell-based access for memory efficiency
// ============================================================================

async function parseAndImportMpfsStreaming(
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
  const LOG_INTERVAL = 2000;
  
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
  if (!range) {
    return { ok: false, totalRows: 0, validRows: 0, imported: 0, skipped: 0, headerRow: -1, columns: [], sampleCodes: [], batchesCompleted: 0, errors: ['No data range in sheet'] };
  }
  
  const totalRows = range.e.r - range.s.r + 1;
  console.log(`[MPFS Streaming] Sheet range: ${sheet['!ref']}, total rows: ${totalRows}`);
  
  // Find header row by scanning first 50 rows for "HCPCS"
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};
  
  for (let r = range.s.r; r <= Math.min(range.s.r + 50, range.e.r); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const val = getCellValue(sheet, c, r);
      if (typeof val === 'string') {
        const upper = val.toUpperCase().trim();
        if (upper === 'HCPCS') {
          headerRowIndex = r;
          console.log(`[MPFS Streaming] Found header at row ${r + 1} (0-indexed: ${r})`);
          
          // Build column map from this row
          for (let cc = range.s.c; cc <= range.e.c; cc++) {
            const headerVal = getCellValue(sheet, cc, r);
            if (typeof headerVal === 'string') {
              const normalized = normalizeHeader(headerVal);
              const upperH = headerVal.toUpperCase().trim();
              
              if (upperH === 'HCPCS') colMap['hcpcs'] = cc;
              else if (normalized === 'mod' || upperH === 'MOD') colMap['modifier'] = cc;
              else if (normalized === 'description' || upperH === 'DESCRIPTION') colMap['description'] = cc;
              else if (normalized === 'status' || upperH === 'STATUS') colMap['status'] = cc;
              else if (normalized.includes('workrvu') || (normalized.includes('work') && normalized.includes('rvu'))) colMap['work_rvu'] = cc;
              else if (normalized.includes('nonfacpe') || (normalized.includes('nonfac') && normalized.includes('pe'))) colMap['nonfac_pe_rvu'] = cc;
              else if ((normalized.includes('facpe') || (normalized.includes('fac') && normalized.includes('pe'))) && !normalized.includes('nonfac')) colMap['fac_pe_rvu'] = cc;
              else if (normalized.includes('mprvu') || (normalized.includes('mp') && normalized.includes('rvu'))) colMap['mp_rvu'] = cc;
              else if (normalized.includes('nonfacfee') || (normalized.includes('nonfac') && normalized.includes('fee'))) colMap['nonfac_fee'] = cc;
              else if ((normalized.includes('facfee') || (normalized.includes('fac') && normalized.includes('fee'))) && !normalized.includes('nonfac')) colMap['fac_fee'] = cc;
              else if (normalized.includes('conversion')) colMap['conversion_factor'] = cc;
              else if (normalized === 'pctc') colMap['pctc'] = cc;
              else if (normalized.includes('global')) colMap['global_days'] = cc;
              else if (normalized.includes('multsurg') || normalized.includes('multiple')) colMap['mult_surgery_indicator'] = cc;
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
  
  console.log(`[MPFS Streaming] Column map:`, JSON.stringify(colMap));
  
  // Stream through ALL rows - NO LIMITS
  let batch: unknown[] = [];
  let validRows = 0;
  let skipped = 0;
  let imported = 0;
  let batchesCompleted = 0;
  const errors: string[] = [];
  const sampleCodes: string[] = [];
  
  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const rowNum = r - headerRowIndex;
    if (rowNum % LOG_INTERVAL === 0) {
      console.log(`[MPFS Streaming] Processing row ${rowNum}/${totalRows - headerRowIndex - 1}, ${validRows} valid, ${batchesCompleted} batches`);
    }
    
    const rawHcpcs = getCellValue(sheet, colMap['hcpcs'], r);
    const hcpcs = normalizeHcpcsCode(rawHcpcs);
    
    if (!hcpcs) {
      skipped++;
      continue;
    }
    
    if (sampleCodes.length < 20) {
      sampleCodes.push(hcpcs);
    }
    
    const workRvu = parseNumeric(getCellValue(sheet, colMap['work_rvu'], r));
    const nonfacPeRvu = parseNumeric(getCellValue(sheet, colMap['nonfac_pe_rvu'], r));
    const facPeRvu = parseNumeric(getCellValue(sheet, colMap['fac_pe_rvu'], r));
    const mpRvu = parseNumeric(getCellValue(sheet, colMap['mp_rvu'], r));
    const conversionFactor = parseNumeric(getCellValue(sheet, colMap['conversion_factor'], r)) || 34.6062;
    
    // Use pre-calculated fees if available, otherwise calculate
    let nonfacFee = parseNumeric(getCellValue(sheet, colMap['nonfac_fee'], r));
    let facFee = parseNumeric(getCellValue(sheet, colMap['fac_fee'], r));
    
    // Calculate fees if not provided
    if (nonfacFee === null && workRvu !== null && nonfacPeRvu !== null && mpRvu !== null) {
      nonfacFee = Math.round((workRvu + nonfacPeRvu + mpRvu) * conversionFactor * 100) / 100;
    }
    if (facFee === null && workRvu !== null && facPeRvu !== null && mpRvu !== null) {
      facFee = Math.round((workRvu + facPeRvu + mpRvu) * conversionFactor * 100) / 100;
    }
    
    const record = {
      year,
      hcpcs,
      modifier: parseString(getCellValue(sheet, colMap['modifier'], r)) || '',
      description: parseString(getCellValue(sheet, colMap['description'], r)),
      status: parseString(getCellValue(sheet, colMap['status'], r)),
      work_rvu: workRvu,
      nonfac_pe_rvu: nonfacPeRvu,
      fac_pe_rvu: facPeRvu,
      mp_rvu: mpRvu,
      nonfac_fee: nonfacFee,
      fac_fee: facFee,
      conversion_factor: conversionFactor,
      pctc: parseString(getCellValue(sheet, colMap['pctc'], r)),
      global_days: parseString(getCellValue(sheet, colMap['global_days'], r)),
      mult_surgery_indicator: parseString(getCellValue(sheet, colMap['mult_surgery_indicator'], r)),
      qp_status: 'nonQP',
      source: 'CMS MPFS'
    };
    
    batch.push(record);
    validRows++;
    
    if (batch.length >= BATCH_SIZE) {
      if (!dryRun) {
        // Deduplicate batch by hcpcs+modifier+year to prevent ON CONFLICT errors
        const dedupedBatch = deduplicateBatch(batch as any[], (r: any) => `${r.hcpcs}-${r.modifier || ''}-${r.year}`);
        
        const { error } = await supabase
          .from('mpfs_benchmarks')
          .upsert(dedupedBatch, { onConflict: 'hcpcs,modifier,year', ignoreDuplicates: false });
        
        if (error) {
          errors.push(`Batch ${batchesCompleted + 1}: ${error.message}`);
        } else {
          imported += dedupedBatch.length;
        }
      }
      batchesCompleted++;
      batch = [];
      
      // Memory cleanup hint
      if (batchesCompleted % 10 === 0) {
        console.log(`[MPFS Streaming] Batch ${batchesCompleted} complete, ${imported} imported so far`);
      }
    }
  }
  
  // Upsert remaining batch
  if (batch.length > 0) {
    if (!dryRun) {
      const dedupedBatch = deduplicateBatch(batch as any[], (r: any) => `${r.hcpcs}-${r.modifier || ''}-${r.year}`);
      
      const { error } = await supabase
        .from('mpfs_benchmarks')
        .upsert(dedupedBatch, { onConflict: 'hcpcs,modifier,year', ignoreDuplicates: false });
      
      if (error) {
        errors.push(`Final batch: ${error.message}`);
      } else {
        imported += dedupedBatch.length;
      }
    }
    batchesCompleted++;
  }
  
  console.log(`[MPFS Streaming] Complete: ${validRows} valid, ${imported} imported, ${skipped} skipped, ${batchesCompleted} batches`);
  console.log(`[MPFS Streaming] Sample codes:`, sampleCodes.slice(0, 10));
  
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
// MPFS CSV Parser - Memory efficient for large files
// ============================================================================

async function parseAndImportMpfsCsv(
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
  const LOG_INTERVAL = 2000;
  
  const totalRows = csvData.length;
  console.log(`[MPFS CSV] Total rows: ${totalRows}`);
  
  let headerRowIndex = -1;
  const colMap: ColumnMap = {};
  
  // Find header row
  for (let i = 0; i < Math.min(50, csvData.length); i++) {
    const row = csvData[i];
    const hcpcsColIdx = row.findIndex(cell => {
      if (typeof cell === 'string') {
        const upper = cell.toUpperCase().trim();
        return upper === 'HCPCS';
      }
      return false;
    });
    
    if (hcpcsColIdx >= 0) {
      headerRowIndex = i;
      console.log(`[MPFS CSV] Found header at row ${i + 1}`);
      
      row.forEach((cell, idx) => {
        if (typeof cell === 'string') {
          const normalized = normalizeHeader(cell);
          const upper = cell.toUpperCase().trim();
          
          if (upper === 'HCPCS') colMap['hcpcs'] = idx;
          else if (normalized === 'mod' || upper === 'MOD') colMap['modifier'] = idx;
          else if (normalized === 'description' || upper === 'DESCRIPTION') colMap['description'] = idx;
          else if (normalized === 'status' || upper === 'STATUS') colMap['status'] = idx;
          else if (normalized.includes('workrvu') || normalized === 'work_rvu') colMap['work_rvu'] = idx;
          else if (normalized.includes('nonfacpervu') || normalized === 'nonfac_pe_rvu') colMap['nonfac_pe_rvu'] = idx;
          else if (normalized.includes('facpervu') || normalized === 'fac_pe_rvu') colMap['fac_pe_rvu'] = idx;
          else if (normalized.includes('mprvu') || normalized === 'mp_rvu') colMap['mp_rvu'] = idx;
          else if (normalized.includes('nonfacfee') || normalized === 'nonfac_fee') colMap['nonfac_fee'] = idx;
          else if (normalized.includes('facfee') || normalized === 'fac_fee') colMap['fac_fee'] = idx;
          else if (normalized.includes('conversion')) colMap['conversion_factor'] = idx;
          else if (normalized === 'pctc') colMap['pctc'] = idx;
          else if (normalized.includes('global')) colMap['global_days'] = idx;
        }
      });
      break;
    }
  }
  
  if (headerRowIndex < 0 || colMap['hcpcs'] === undefined) {
    return { ok: false, totalRows, validRows: 0, imported: 0, skipped: 0, headerRow: -1, columns: [], sampleCodes: [], batchesCompleted: 0, errors: ['Could not find HCPCS header row'] };
  }
  
  console.log(`[MPFS CSV] Column map:`, JSON.stringify(colMap));
  
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
      console.log(`[MPFS CSV] Processed ${rowNum} rows, ${validRows} valid`);
    }
    
    const hcpcs = normalizeHcpcsCode(row[colMap['hcpcs']]);
    if (!hcpcs) {
      skipped++;
      continue;
    }
    
    if (sampleCodes.length < 20) {
      sampleCodes.push(hcpcs);
    }
    
    const workRvu = parseNumeric(row[colMap['work_rvu']]);
    const nonfacPeRvu = parseNumeric(row[colMap['nonfac_pe_rvu']]);
    const facPeRvu = parseNumeric(row[colMap['fac_pe_rvu']]);
    const mpRvu = parseNumeric(row[colMap['mp_rvu']]);
    const conversionFactor = parseNumeric(row[colMap['conversion_factor']]) || 34.6062;
    
    let nonfacFee = parseNumeric(row[colMap['nonfac_fee']]);
    let facFee = parseNumeric(row[colMap['fac_fee']]);
    
    if (nonfacFee === null && workRvu !== null && nonfacPeRvu !== null && mpRvu !== null) {
      nonfacFee = Math.round((workRvu + nonfacPeRvu + mpRvu) * conversionFactor * 100) / 100;
    }
    if (facFee === null && workRvu !== null && facPeRvu !== null && mpRvu !== null) {
      facFee = Math.round((workRvu + facPeRvu + mpRvu) * conversionFactor * 100) / 100;
    }
    
    const record = {
      year,
      hcpcs,
      modifier: parseString(row[colMap['modifier']]) || '',
      description: parseString(row[colMap['description']]),
      status: parseString(row[colMap['status']]),
      work_rvu: workRvu,
      nonfac_pe_rvu: nonfacPeRvu,
      fac_pe_rvu: facPeRvu,
      mp_rvu: mpRvu,
      nonfac_fee: nonfacFee,
      fac_fee: facFee,
      conversion_factor: conversionFactor,
      pctc: parseString(row[colMap['pctc']]),
      global_days: parseString(row[colMap['global_days']]),
      qp_status: 'nonQP',
      source: 'CMS MPFS'
    };
    
    batch.push(record);
    validRows++;
    
    if (batch.length >= BATCH_SIZE) {
      if (!dryRun) {
        // Deduplicate batch by hcpcs+modifier+year to prevent ON CONFLICT errors
        const dedupedBatch = deduplicateBatch(batch as any[], (r: any) => `${r.hcpcs}-${r.modifier || ''}-${r.year}`);
        
        const { error } = await supabase
          .from('mpfs_benchmarks')
          .upsert(dedupedBatch, { onConflict: 'hcpcs,modifier,year', ignoreDuplicates: false });
        
        if (error) {
          errors.push(`Batch ${batchesCompleted + 1}: ${error.message}`);
        } else {
          imported += dedupedBatch.length;
        }
      }
      batchesCompleted++;
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    if (!dryRun) {
      const dedupedBatch = deduplicateBatch(batch as any[], (r: any) => `${r.hcpcs}-${r.modifier || ''}-${r.year}`);
      
      const { error } = await supabase
        .from('mpfs_benchmarks')
        .upsert(dedupedBatch, { onConflict: 'hcpcs,modifier,year', ignoreDuplicates: false });
      
      if (error) {
        errors.push(`Final batch: ${error.message}`);
      } else {
        imported += dedupedBatch.length;
      }
    }
    batchesCompleted++;
  }
  
  console.log(`[MPFS CSV] Complete: ${validRows} valid, ${imported} imported`);
  
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


async function batchUpsert(
  supabase: any,
  tableName: string,
  records: unknown[],
  conflictColumns: string,
  dryRun: boolean = false,
  keyFn?: (record: any) => string
): Promise<{ imported: number; errors: string[]; dedupedCount: number }> {
  if (dryRun) {
    return { imported: 0, errors: [], dedupedCount: records.length };
  }

  // If a key function is provided, deduplicate the entire dataset first
  let dedupedRecords = records;
  if (keyFn) {
    dedupedRecords = deduplicateByKey(records as any[], keyFn);
    console.log(`[batchUpsert] ${tableName}: Deduped ${records.length} -> ${dedupedRecords.length} unique records`);
  }

  const BATCH_SIZE = 500;
  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < dedupedRecords.length; i += BATCH_SIZE) {
    let batch = dedupedRecords.slice(i, i + BATCH_SIZE);
    
    // Double-check deduplication within batch (should be redundant but safe)
    if (keyFn) {
      batch = deduplicateBatch(batch as any[], keyFn);
    }
    
    if ((i / BATCH_SIZE) % 10 === 0) {
      console.log(`[batchUpsert] ${tableName}: Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(dedupedRecords.length / BATCH_SIZE)}`);
    }
    
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

  return { imported, errors, dedupedCount: dedupedRecords.length };
}

// ============================================================================
// Find Best Sheet in Workbook
// ============================================================================

function findBestSheet(workbook: XLSX.WorkBook, hints: string[]): string {
  const sheetNames = workbook.SheetNames;
  
  for (const hint of hints) {
    const match = sheetNames.find(name => 
      name.toLowerCase().includes(hint.toLowerCase())
    );
    if (match) return match;
  }
  
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const authResult = await verifyAdminAuth(req);
  if (!authResult.authorized) {
    console.warn(`[admin-import] Unauthorized access attempt: ${authResult.error} (reason: ${authResult.reason})`);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        errorCode: "UNAUTHORIZED",
        message: authResult.error || 'Authentication required',
        reason: authResult.reason,
        debugInfo: authResult.debugInfo
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

    const contentType = req.headers.get("content-type") || "";
    
    let dataType: string;
    let dryRun = false;
    let year: number | undefined;
    let fileBuffer: ArrayBuffer | null = null;
    let fileName = '';

    if (contentType.includes("multipart/form-data")) {
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
      const body: ImportRequest = await req.json();
      dataType = body.dataType;
      dryRun = body.dryRun || false;
      year = body.year;
    }

    // Self-test endpoint
    if (dataType === "self-test") {
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
    const isCSV = fileName.endsWith('.csv');
    
    console.log(`[admin-import] Processing ${fileName}, dataType=${dataType}, dryRun=${dryRun}, isCSV=${isCSV}`);

    switch (dataType) {
      case "opps": {
        if (isCSV) {
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

      case "mpfs": {
        // MPFS files are too large for XLSX.read() - use CSV streaming instead
        // Check if file is already CSV
        if (isCSV) {
          console.log(`[admin-import] Using CSV streaming for MPFS`);
          const text = new TextDecoder().decode(new Uint8Array(fileBuffer));
          const csvData = parseCSV(text);
          
          const result = await parseAndImportMpfsCsv(csvData, supabase, year || 2026, dryRun);
          
          response = {
            ok: result.ok && result.errors.length === 0,
            message: dryRun 
              ? `Dry run complete: ${result.validRows} valid MPFS records found`
              : `Imported ${result.imported} MPFS records`,
            details: {
              totalRowsRead: result.totalRows,
              validRows: result.validRows,
              imported: result.imported,
              skipped: result.skipped,
              headerRowIndex: result.headerRow,
              columnsDetected: result.columns,
              batchesCompleted: result.batchesCompleted,
              sampleRows: result.sampleCodes.map((code: string) => ({ hcpcs: code }))
            }
          };
          
          if (result.errors.length > 0) {
            response.errorCode = "PARTIAL_IMPORT";
            response.message = result.errors.slice(0, 5).join("; ");
          }
        } else {
          // For XLSX files larger than ~5000 rows, we hit memory limits
          // Return an error asking user to convert to CSV first
          const bufferSizeKB = Math.round(fileBuffer.byteLength / 1024);
          console.log(`[admin-import] MPFS XLSX file size: ${bufferSizeKB}KB - checking if too large`);
          
          // If file is over 500KB, it's likely too large for XLSX parsing
          if (bufferSizeKB > 500) {
            response = {
              ok: false,
              errorCode: "FILE_TOO_LARGE",
              message: `MPFS file (${bufferSizeKB}KB) is too large for XLSX parsing. Please convert to CSV format first, then re-upload. You can open the XLSX in Excel/Google Sheets and export as CSV.`,
              details: {
                totalRowsRead: 0,
                validRows: 0,
                imported: 0,
                skipped: 0,
                sampleRows: []
              }
            };
          } else {
            // Try small XLSX files
            try {
              console.log(`[admin-import] Attempting XLSX parse for small MPFS file`);
              const workbook = XLSX.read(new Uint8Array(fileBuffer), { 
                type: "array",
                cellStyles: false,
                cellFormula: false,
                cellHTML: false,
                sheetRows: 10000 // Limit rows to prevent OOM
              });
              const sheetName = findBestSheet(workbook, ["MPFS", "Fee Schedule", "RVU"]);
              const sheet = workbook.Sheets[sheetName];
              
              const result = await parseAndImportMpfsStreaming(sheet, supabase, year || 2026, dryRun);
              
              response = {
                ok: result.ok && result.errors.length === 0,
                message: dryRun 
                  ? `Dry run complete: ${result.validRows} valid MPFS records found`
                  : `Imported ${result.imported} MPFS records`,
                details: {
                  totalRowsRead: result.totalRows,
                  validRows: result.validRows,
                  imported: result.imported,
                  skipped: result.skipped,
                  sheetName,
                  headerRowIndex: result.headerRow,
                  columnsDetected: result.columns,
                  batchesCompleted: result.batchesCompleted,
                  sampleRows: result.sampleCodes.map((code: string) => ({ hcpcs: code }))
                }
              };
              
              if (result.errors.length > 0) {
                response.errorCode = "PARTIAL_IMPORT";
                response.message = result.errors.slice(0, 5).join("; ");
              }
            } catch (xlsxError: unknown) {
              const errMsg = xlsxError instanceof Error ? xlsxError.message : String(xlsxError);
              console.error(`[admin-import] XLSX parse failed:`, errMsg);
              response = {
                ok: false,
                errorCode: "XLSX_PARSE_FAILED",
                message: `XLSX parsing failed (likely memory limit). Please convert to CSV: ${errMsg.slice(0, 200)}`,
                details: {
                  totalRowsRead: 0,
                  validRows: 0,
                  imported: 0,
                  skipped: 0,
                  sampleRows: []
                }
              };
            }
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
          // DMEPOS/DMEPEN dedup key: hcpcs + modifier + modifier2 + state_abbr + year + source_file
          const { imported, errors, dedupedCount } = await batchUpsert(
            supabase, 
            tableName, 
            records, 
            "hcpcs,modifier,modifier2,state_abbr,year,source_file",
            dryRun,
            (r: any) => `${r.hcpcs}-${r.modifier || ''}-${r.modifier2 || ''}-${r.state_abbr || ''}-${r.year}-${r.source_file}`
          );
          
          console.log(`[${dataType.toUpperCase()}] Deduped ${records.length} -> ${dedupedCount} unique records`);
          
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
          // GPCI dedup key: locality_num
          const { imported, errors, dedupedCount } = await batchUpsert(
            supabase, 
            "gpci_localities", 
            records, 
            "locality_num",
            dryRun,
            (r: any) => `${r.locality_num}`
          );
          
          console.log(`[GPCI] Deduped ${records.length} -> ${dedupedCount} unique records`);
          
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
          // ZIP dedup key: zip5
          const { imported, errors, dedupedCount } = await batchUpsert(
            supabase, 
            "zip_to_locality", 
            records, 
            "zip5",
            dryRun,
            (r: any) => `${r.zip5}`
          );
          
          console.log(`[ZIP] Deduped ${records.length} -> ${dedupedCount} unique records`);
          
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
          // CLFS dedup key: hcpcs + year
          const { imported, errors, dedupedCount } = await batchUpsert(
            supabase, 
            "clfs_fee_schedule", 
            records, 
            "hcpcs,year",
            dryRun,
            (r: any) => `${r.hcpcs}-${r.year}`
          );
          
          console.log(`[CLFS] Deduped ${records.length} -> ${dedupedCount} unique records`);
          
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
              sampleRows: meta.sampleCodes.map(code => ({ hcpcs: code }))
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
          message: `Unknown data type: ${dataType}. Supported: opps, mpfs, dmepos, dmepen, clfs, gpci, zip-crosswalk`
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
