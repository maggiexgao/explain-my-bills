/**
 * MPFS Table Builder
 * Combines parser and geo data to create a cleaned MPFS lookup table
 */

import { RawMpfsRow, parsePfrev4Content, filterPayableRows } from './mpfsParser';
import { getGeoForCarrierLocality, GeoInfo } from './mpfsGeo';

export interface MpfsRow {
  year: string;
  state: string;
  stateName: string;
  locality: string;
  localityName: string;
  carrierNumber: string;
  cpt: string;
  modifier: string;
  statusCode: string;
  pcTcIndicator: string;
  nonfacilityFee: number | null;
  facilityFee: number | null;
}

/**
 * Build MpfsRow from raw data
 */
function buildMpfsRow(raw: RawMpfsRow, geo: GeoInfo): MpfsRow {
  return {
    year: raw.year,
    state: geo.stateAbbrev,
    stateName: geo.stateName,
    locality: raw.localityCode,
    localityName: geo.localityName,
    carrierNumber: raw.carrierNumber,
    cpt: raw.hcpcsCpt,
    modifier: raw.modifier,
    statusCode: raw.statusCode,
    pcTcIndicator: raw.pcTcIndicator,
    nonfacilityFee: raw.nonfacilityFee,
    facilityFee: raw.facilityFee,
  };
}

/**
 * Build cleaned MPFS table from raw content
 */
export function buildMpfsTable(pfrev4Content: string): MpfsRow[] {
  const rawRows = parsePfrev4Content(pfrev4Content);
  const payableRows = filterPayableRows(rawRows);
  
  const mpfsRows: MpfsRow[] = [];
  
  for (const raw of payableRows) {
    const geo = getGeoForCarrierLocality(raw.carrierNumber, raw.localityCode);
    if (geo) {
      mpfsRows.push(buildMpfsRow(raw, geo));
    }
  }
  
  return mpfsRows;
}

/**
 * Create an index for fast CPT lookup
 */
export interface MpfsIndex {
  // year -> state -> cpt -> modifier -> MpfsRow[]
  byCpt: Map<string, Map<string, Map<string, Map<string, MpfsRow[]>>>>;
}

export function buildMpfsIndex(rows: MpfsRow[]): MpfsIndex {
  const byCpt = new Map<string, Map<string, Map<string, Map<string, MpfsRow[]>>>>();
  
  for (const row of rows) {
    // Year level
    if (!byCpt.has(row.year)) {
      byCpt.set(row.year, new Map());
    }
    const yearMap = byCpt.get(row.year)!;
    
    // State level
    if (!yearMap.has(row.state)) {
      yearMap.set(row.state, new Map());
    }
    const stateMap = yearMap.get(row.state)!;
    
    // CPT level
    if (!stateMap.has(row.cpt)) {
      stateMap.set(row.cpt, new Map());
    }
    const cptMap = stateMap.get(row.cpt)!;
    
    // Modifier level
    const modKey = row.modifier || '';
    if (!cptMap.has(modKey)) {
      cptMap.set(modKey, []);
    }
    cptMap.get(modKey)!.push(row);
  }
  
  return { byCpt };
}

/**
 * Get MPFS rows for a specific CPT code
 */
export function getMpfsRowsForCpt(
  index: MpfsIndex,
  year: string,
  state: string,
  cpt: string,
  modifier?: string
): MpfsRow[] {
  // Normalize CPT code - trim whitespace, remove common suffixes
  const normCpt = cpt.trim().replace(/ CPT®?$/i, '').padStart(5, '0');
  const modKey = (modifier || '').trim();
  
  const yearMap = index.byCpt.get(year);
  if (!yearMap) {
    console.log('[MPFS] lookup miss: year not found', { year, state, cpt: normCpt, modifier: modKey });
    return [];
  }
  
  const stateMap = yearMap.get(state);
  if (!stateMap) {
    console.log('[MPFS] lookup miss: state not found', { year, state, cpt: normCpt, modifier: modKey });
    return [];
  }
  
  const cptMap = stateMap.get(normCpt);
  if (!cptMap) {
    console.log('[MPFS] lookup miss: CPT not found in state data', { year, state, cpt: normCpt, modifier: modKey });
    return [];
  }
  
  // Try exact modifier match first
  if (cptMap.has(modKey)) {
    const rows = cptMap.get(modKey)!;
    console.log('[MPFS] lookup hit', { year, state, cpt: normCpt, modifier: modKey, rowsFound: rows.length });
    return rows;
  }
  
  // If no modifier specified, try to get global (no modifier)
  if (!modKey && cptMap.has('')) {
    const rows = cptMap.get('')!;
    console.log('[MPFS] lookup hit (no modifier)', { year, state, cpt: normCpt, rowsFound: rows.length });
    return rows;
  }
  
  // Return all modifier variants if no exact match
  const allRows: MpfsRow[] = [];
  for (const rows of cptMap.values()) {
    allRows.push(...rows);
  }
  console.log('[MPFS] lookup fallback (all modifiers)', { year, state, cpt: normCpt, rowsFound: allRows.length });
  return allRows;
}

/**
 * Calculate median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 
    ? sorted[mid] 
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface StateMedianAllowed {
  nonfacilityMedian: number | null;
  facilityMedian: number | null;
  count: number;
}

/**
 * Get state median allowed amounts for a CPT code
 * Calculates the median across all localities within the state
 */
export function getStateMedianAllowed(
  index: MpfsIndex,
  year: string,
  state: string,
  cpt: string,
  modifier?: string
): StateMedianAllowed {
  const rows = getMpfsRowsForCpt(index, year, state, cpt, modifier);
  
  if (rows.length === 0) {
    console.log('[MPFS] getStateMedianAllowed: no rows found', { year, state, cpt, modifier });
    return { nonfacilityMedian: null, facilityMedian: null, count: 0 };
  }
  
  const nonfacilityFees = rows
    .map(r => r.nonfacilityFee)
    .filter((f): f is number => f !== null);
  
  const facilityFees = rows
    .map(r => r.facilityFee)
    .filter((f): f is number => f !== null);
  
  const result = {
    nonfacilityMedian: nonfacilityFees.length > 0 ? median(nonfacilityFees) : null,
    facilityMedian: facilityFees.length > 0 ? median(facilityFees) : null,
    count: rows.length,
  };
  
  console.log('[MPFS] getStateMedianAllowed result', { year, state, cpt, modifier, ...result });
  return result;
}

/**
 * Get a specific locality fee if available, otherwise fall back to state median
 */
export function getLocalityOrMedianFee(
  index: MpfsIndex,
  year: string,
  state: string,
  locality: string | null,
  cpt: string,
  modifier?: string,
  isFacility: boolean = false
): { fee: number | null; isMedian: boolean; localityName?: string } {
  const rows = getMpfsRowsForCpt(index, year, state, cpt, modifier);
  
  // Try to find specific locality
  if (locality) {
    const localityRow = rows.find(r => r.locality === locality);
    if (localityRow) {
      const fee = isFacility ? localityRow.facilityFee : localityRow.nonfacilityFee;
      if (fee !== null) {
        return { fee, isMedian: false, localityName: localityRow.localityName };
      }
    }
  }
  
  // Fall back to state median
  const stateMedian = getStateMedianAllowed(index, year, state, cpt, modifier);
  const fee = isFacility ? stateMedian.facilityMedian : stateMedian.nonfacilityMedian;
  
  return { fee, isMedian: true };
}
