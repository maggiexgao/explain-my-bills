/**
 * MPFS Table - Build and query Medicare Physician Fee Schedule data
 */

import { RawMpfsRow, loadMpfsFromPfrev4 } from './mpfsParser';
import { getGeoForCarrierLocality, getStateForCarrier } from './mpfsGeo';

export type MpfsRow = {
  year: number;
  state: string;
  stateName: string;
  locality: string;
  localityName: string;
  carrierNumber: string;
  cpt: string;
  modifier: string | null;
  statusCode: string;
  pcTcIndicator: string;
  nonfacilityFee: number | null;
  facilityFee: number | null;
};

// Singleton cache for MPFS data
let mpfsCache: MpfsRow[] | null = null;
let mpfsCachePromise: Promise<MpfsRow[]> | null = null;

// Status codes for payable CPT codes
const PAYABLE_STATUS_CODES = ['A', 'R', 'T'];

/**
 * Build the MPFS table from raw data
 */
export async function buildMpfsTable(): Promise<MpfsRow[]> {
  if (mpfsCache) {
    return mpfsCache;
  }

  if (mpfsCachePromise) {
    return mpfsCachePromise;
  }

  mpfsCachePromise = (async () => {
    const rawRows = await loadMpfsFromPfrev4();
    const result: MpfsRow[] = [];

    for (const raw of rawRows) {
      // Filter to payable status codes only
      if (!PAYABLE_STATUS_CODES.includes(raw.statusCode)) {
        continue;
      }

      // Get geographic info
      const geo = getGeoForCarrierLocality(raw.carrierNumber, raw.localityCode);
      const state = geo?.stateAbbrev ?? getStateForCarrier(raw.carrierNumber);
      
      if (!state) {
        continue;
      }

      result.push({
        year: raw.year,
        state,
        stateName: geo?.stateName ?? state,
        locality: raw.localityCode,
        localityName: geo?.localityName ?? `Locality ${raw.localityCode}`,
        carrierNumber: raw.carrierNumber,
        cpt: raw.hcpcsCpt,
        modifier: raw.modifier,
        statusCode: raw.statusCode,
        pcTcIndicator: raw.pcTcIndicator,
        nonfacilityFee: raw.nonfacilityFee,
        facilityFee: raw.facilityFee,
      });
    }

    mpfsCache = result;
    console.log(`Built MPFS table with ${result.length} payable rows`);
    return result;
  })();

  return mpfsCachePromise;
}

/**
 * Get MPFS rows for a specific CPT code, year, and state
 */
export async function getMpfsRowsForCpt(
  year: number,
  state: string,
  cpt: string,
  modifier?: string | null
): Promise<MpfsRow[]> {
  const table = await buildMpfsTable();
  
  return table.filter(row => {
    const yearMatch = row.year === year;
    const stateMatch = row.state.toUpperCase() === state.toUpperCase();
    const cptMatch = row.cpt === cpt;
    
    // If modifier specified, match it; otherwise get all
    const modMatch = modifier === undefined || modifier === null || row.modifier === modifier;
    
    return yearMatch && stateMatch && cptMatch && modMatch;
  });
}

/**
 * Get state median allowed amounts for a CPT code
 */
export async function getStateMedianAllowed(
  year: number,
  state: string,
  cpt: string,
  modifier?: string | null
): Promise<{ nonfacilityMedian: number | null; facilityMedian: number | null }> {
  const rows = await getMpfsRowsForCpt(year, state, cpt, modifier);

  const calculateMedian = (values: number[]): number | null => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  };

  const nonfacilityFees = rows
    .map(r => r.nonfacilityFee)
    .filter((v): v is number => v != null && v > 0);

  const facilityFees = rows
    .map(r => r.facilityFee)
    .filter((v): v is number => v != null && v > 0);

  return {
    nonfacilityMedian: calculateMedian(nonfacilityFees),
    facilityMedian: calculateMedian(facilityFees),
  };
}

/**
 * Get a quick lookup for a CPT code's Medicare allowed amount in a state
 */
export async function getMedicareAllowedForCpt(
  cpt: string,
  state: string,
  siteOfService: 'facility' | 'nonfacility' = 'nonfacility',
  year: number = 2025
): Promise<number | null> {
  const median = await getStateMedianAllowed(year, state, cpt);
  return siteOfService === 'facility' ? median.facilityMedian : median.nonfacilityMedian;
}
