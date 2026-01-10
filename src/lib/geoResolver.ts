/**
 * Geographic Location Resolver for Medicare Benchmarking
 * 
 * Resolves ZIP codes and states to GPCI localities with proper fallback chain:
 * 1. ZIP → Locality (via zip_to_locality crosswalk)
 * 2. ZIP → State → State Average GPCI
 * 3. State → State Average GPCI
 * 4. National Default (GPCI = 1.0, 1.0, 1.0)
 * 
 * CRITICAL: Never show "no location" when user provided a ZIP
 */

import { supabase } from '@/integrations/supabase/client';

// ============= Types =============

export type GeoMethod = 
  | 'zip_exact'           // ZIP found in crosswalk, matched to locality
  | 'zip_to_state_avg'    // ZIP provided, resolved to state, using state average
  | 'state_avg'           // Only state provided, using state average
  | 'national_default';   // No location info, using national defaults

export type GeoConfidence = 'high' | 'medium' | 'low';

export interface GpciIndices {
  work: number;
  pe: number;
  mp: number;
}

export interface GeoResolution {
  inputZip: string | null;
  inputState: string | null;
  resolvedZip: string | null;
  resolvedState: string | null;
  resolvedLocality: string | null;
  localityNum: string | null;
  localityName: string | null;
  method: GeoMethod;
  confidence: GeoConfidence;
  gpci: GpciIndices;
  notes: string[];
  userMessage: string;
}

interface ZipToLocalityRow {
  zip5: string;
  state_abbr: string | null;
  locality_num: string;
  carrier_num: string | null;
  county_name: string | null;
  effective_year: number | null;
}

interface GpciLocalityRow {
  locality_num: string;
  state_abbr: string;
  locality_name: string;
  zip_code: string | null;
  work_gpci: number;
  pe_gpci: number;
  mp_gpci: number;
}

interface GpciStateAvgRow {
  state_abbr: string;
  avg_work_gpci: number;
  avg_pe_gpci: number;
  avg_mp_gpci: number;
  n_rows: number;
}

// ============= Constants =============

// National default GPCI indices (no geographic adjustment)
const NATIONAL_DEFAULT_GPCI: GpciIndices = {
  work: 1.0,
  pe: 1.0,
  mp: 1.0
};

// All valid US state abbreviations
const VALID_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'PR',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'VI', 'WA',
  'WV', 'WI', 'WY'
]);

// ============= Normalization =============

/**
 * Normalize ZIP code to 5 digits
 */
export function normalizeZip(zipInput: string | undefined | null): string | null {
  if (!zipInput) return null;
  
  const cleaned = zipInput.trim().replace(/[^\d]/g, '');
  
  // Handle ZIP+4 format
  const zip5 = cleaned.substring(0, 5);
  
  // Validate it's exactly 5 digits
  if (!/^\d{5}$/.test(zip5)) return null;
  
  return zip5;
}

/**
 * Normalize state abbreviation to uppercase 2-letter code
 */
export function normalizeState(stateInput: string | undefined | null): string | null {
  if (!stateInput) return null;
  
  const cleaned = stateInput.trim().toUpperCase();
  
  // Must be exactly 2 letters
  if (!/^[A-Z]{2}$/.test(cleaned)) return null;
  
  // Must be a valid US state
  if (!VALID_STATES.has(cleaned)) return null;
  
  return cleaned;
}

// ============= Database Lookups =============

/**
 * Look up locality from ZIP using the crosswalk table
 */
async function lookupZipToLocality(zip5: string): Promise<ZipToLocalityRow | null> {
  const { data, error } = await supabase
    .from('zip_to_locality')
    .select('*')
    .eq('zip5', zip5)
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('[GeoResolver] ZIP crosswalk lookup error:', error);
    return null;
  }
  
  return data as ZipToLocalityRow | null;
}

/**
 * Fetch GPCI data by locality number
 */
async function fetchGpciByLocality(localityNum: string): Promise<GpciLocalityRow | null> {
  const { data, error } = await supabase
    .from('gpci_localities')
    .select('*')
    .eq('locality_num', localityNum)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[GeoResolver] GPCI locality lookup error:', error);
    return null;
  }
  
  return data as GpciLocalityRow | null;
}

/**
 * Fetch GPCI locality data by ZIP code (direct match on gpci_localities.zip_code)
 */
async function fetchGpciByZip(zip5: string): Promise<GpciLocalityRow | null> {
  const { data, error } = await supabase
    .from('gpci_localities')
    .select('*')
    .eq('zip_code', zip5)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[GeoResolver] GPCI ZIP lookup error:', error);
    return null;
  }
  
  return data as GpciLocalityRow | null;
}

/**
 * Fetch state average GPCI from precomputed table
 */
async function fetchStateAverageGpci(stateAbbr: string): Promise<GpciStateAvgRow | null> {
  // First try the precomputed state avg table
  const { data, error } = await supabase
    .from('gpci_state_avg_2026')
    .select('*')
    .eq('state_abbr', stateAbbr)
    .limit(1)
    .maybeSingle();

  if (data && !error) {
    return data as GpciStateAvgRow;
  }
  
  // Fallback: compute on the fly from gpci_localities
  const { data: localityData, error: localityError } = await supabase
    .from('gpci_localities')
    .select('work_gpci, pe_gpci, mp_gpci')
    .eq('state_abbr', stateAbbr);
  
  if (localityError || !localityData || localityData.length === 0) {
    console.warn('[GeoResolver] No GPCI data for state:', stateAbbr);
    return null;
  }
  
  // Compute averages
  const n = localityData.length;
  const avgWork = localityData.reduce((sum, r) => sum + (r.work_gpci || 0), 0) / n;
  const avgPe = localityData.reduce((sum, r) => sum + (r.pe_gpci || 0), 0) / n;
  const avgMp = localityData.reduce((sum, r) => sum + (r.mp_gpci || 0), 0) / n;
  
  return {
    state_abbr: stateAbbr,
    avg_work_gpci: avgWork,
    avg_pe_gpci: avgPe,
    avg_mp_gpci: avgMp,
    n_rows: n
  };
}

/**
 * Fetch first locality for a state (fallback for state-only)
 */
async function fetchFirstLocalityByState(stateAbbr: string): Promise<GpciLocalityRow | null> {
  const { data, error } = await supabase
    .from('gpci_localities')
    .select('*')
    .eq('state_abbr', stateAbbr)
    .order('locality_num')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[GeoResolver] State locality lookup error:', error);
    return null;
  }
  
  return data as GpciLocalityRow | null;
}

/**
 * Look up state from ZIP using zip_to_locality table
 */
async function lookupStateByZip(zip5: string): Promise<string | null> {
  // First try zip_to_locality
  const crosswalk = await lookupZipToLocality(zip5);
  if (crosswalk?.state_abbr) {
    return crosswalk.state_abbr;
  }
  
  // Fallback: check gpci_localities for ZIP
  const gpci = await fetchGpciByZip(zip5);
  if (gpci?.state_abbr) {
    return gpci.state_abbr;
  }
  
  return null;
}

// ============= Main Resolver =============

/**
 * Resolve geographic location to GPCI indices
 * 
 * Resolution order (strict):
 * 1. If ZIP is valid:
 *    a. Try zip_to_locality crosswalk -> get locality -> get GPCI
 *    b. Try direct ZIP match in gpci_localities
 *    c. Derive state from ZIP -> use state average GPCI
 * 2. If state is known (from input or derived):
 *    a. Try state average GPCI
 *    b. Try first locality for state
 * 3. Else: national default (GPCI = 1,1,1)
 * 
 * CRITICAL: If user typed a ZIP, we NEVER say "no location"
 */
export async function resolveGeo(
  zipInput?: string,
  stateInput?: string
): Promise<GeoResolution> {
  const notes: string[] = [];
  
  // Normalize inputs
  const zip5 = normalizeZip(zipInput);
  const stateAbbr = normalizeState(stateInput);
  
  // Track what we have
  const hasZip = zip5 !== null;
  const hasState = stateAbbr !== null;
  
  if (zip5) notes.push(`ZIP normalized: ${zip5}`);
  if (stateAbbr) notes.push(`State normalized: ${stateAbbr}`);
  
  // ===== PATH 1: ZIP provided =====
  if (hasZip) {
    // 1a. Try ZIP crosswalk -> locality -> GPCI
    const crosswalk = await lookupZipToLocality(zip5);
    if (crosswalk) {
      notes.push(`Found in crosswalk: locality ${crosswalk.locality_num}`);
      
      const gpci = await fetchGpciByLocality(crosswalk.locality_num);
      if (gpci) {
        return {
          inputZip: zipInput || null,
          inputState: stateInput || null,
          resolvedZip: zip5,
          resolvedState: crosswalk.state_abbr || gpci.state_abbr,
          resolvedLocality: gpci.locality_name,
          localityNum: gpci.locality_num,
          localityName: gpci.locality_name,
          method: 'zip_exact',
          confidence: 'high',
          gpci: {
            work: gpci.work_gpci,
            pe: gpci.pe_gpci,
            mp: gpci.mp_gpci
          },
          notes,
          userMessage: `Adjusted for your area (${gpci.locality_name || crosswalk.county_name || gpci.state_abbr})`
        };
      }
    }
    
    // 1b. Try direct ZIP match in gpci_localities
    const directGpci = await fetchGpciByZip(zip5);
    if (directGpci) {
      notes.push(`Direct ZIP match in GPCI table`);
      return {
        inputZip: zipInput || null,
        inputState: stateInput || null,
        resolvedZip: zip5,
        resolvedState: directGpci.state_abbr,
        resolvedLocality: directGpci.locality_name,
        localityNum: directGpci.locality_num,
        localityName: directGpci.locality_name,
        method: 'zip_exact',
        confidence: 'high',
        gpci: {
          work: directGpci.work_gpci,
          pe: directGpci.pe_gpci,
          mp: directGpci.mp_gpci
        },
        notes,
        userMessage: `Adjusted for your area (${directGpci.locality_name || directGpci.state_abbr})`
      };
    }
    
    // 1c. Derive state from ZIP and use state average
    notes.push(`ZIP ${zip5} not in crosswalk, deriving state`);
    const derivedState = await lookupStateByZip(zip5) || stateAbbr;
    
    if (derivedState) {
      const stateAvg = await fetchStateAverageGpci(derivedState);
      if (stateAvg) {
        notes.push(`Using ${derivedState} state average GPCI`);
        return {
          inputZip: zipInput || null,
          inputState: stateInput || null,
          resolvedZip: zip5,
          resolvedState: derivedState,
          resolvedLocality: null,
          localityNum: null,
          localityName: `${derivedState} state average`,
          method: 'zip_to_state_avg',
          confidence: 'medium',
          gpci: {
            work: stateAvg.avg_work_gpci,
            pe: stateAvg.avg_pe_gpci,
            mp: stateAvg.avg_mp_gpci
          },
          notes,
          userMessage: `ZIP ${zip5} provided — using ${derivedState} state average (exact locality not yet mapped)`
        };
      }
      
      // Fall back to first locality for state
      const firstLocality = await fetchFirstLocalityByState(derivedState);
      if (firstLocality) {
        notes.push(`Using first locality for ${derivedState}`);
        return {
          inputZip: zipInput || null,
          inputState: stateInput || null,
          resolvedZip: zip5,
          resolvedState: derivedState,
          resolvedLocality: firstLocality.locality_name,
          localityNum: firstLocality.locality_num,
          localityName: firstLocality.locality_name,
          method: 'zip_to_state_avg',
          confidence: 'medium',
          gpci: {
            work: firstLocality.work_gpci,
            pe: firstLocality.pe_gpci,
            mp: firstLocality.mp_gpci
          },
          notes,
          userMessage: `ZIP ${zip5} provided — using ${derivedState} estimate (exact locality not yet mapped)`
        };
      }
    }
    
    // ZIP provided but we couldn't resolve anything - still use ZIP-provided messaging
    notes.push(`Could not resolve ZIP ${zip5} to any state or locality`);
    return {
      inputZip: zipInput || null,
      inputState: stateInput || null,
      resolvedZip: zip5,
      resolvedState: stateAbbr,
      resolvedLocality: null,
      localityNum: null,
      localityName: null,
      method: 'national_default',
      confidence: 'low',
      gpci: NATIONAL_DEFAULT_GPCI,
      notes,
      userMessage: `ZIP ${zip5} provided — using national average (locality mapping coming soon)`
    };
  }
  
  // ===== PATH 2: State only (no ZIP) =====
  if (hasState) {
    const stateAvg = await fetchStateAverageGpci(stateAbbr);
    if (stateAvg) {
      notes.push(`Using ${stateAbbr} state average GPCI`);
      return {
        inputZip: null,
        inputState: stateInput || null,
        resolvedZip: null,
        resolvedState: stateAbbr,
        resolvedLocality: null,
        localityNum: null,
        localityName: `${stateAbbr} state average`,
        method: 'state_avg',
        confidence: 'medium',
        gpci: {
          work: stateAvg.avg_work_gpci,
          pe: stateAvg.avg_pe_gpci,
          mp: stateAvg.avg_mp_gpci
        },
        notes,
        userMessage: `Using ${stateAbbr} state-level estimate (no ZIP provided)`
      };
    }
    
    // Fall back to first locality for state
    const firstLocality = await fetchFirstLocalityByState(stateAbbr);
    if (firstLocality) {
      notes.push(`Using first locality for ${stateAbbr}`);
      return {
        inputZip: null,
        inputState: stateInput || null,
        resolvedZip: null,
        resolvedState: stateAbbr,
        resolvedLocality: firstLocality.locality_name,
        localityNum: firstLocality.locality_num,
        localityName: firstLocality.locality_name,
        method: 'state_avg',
        confidence: 'medium',
        gpci: {
          work: firstLocality.work_gpci,
          pe: firstLocality.pe_gpci,
          mp: firstLocality.mp_gpci
        },
        notes,
        userMessage: `Using ${stateAbbr} estimate (no ZIP provided)`
      };
    }
    
    // State provided but no GPCI data found
    notes.push(`No GPCI data found for state ${stateAbbr}`);
  }
  
  // ===== PATH 3: National default =====
  notes.push('Using national default GPCI (no location info)');
  return {
    inputZip: zipInput || null,
    inputState: stateInput || null,
    resolvedZip: null,
    resolvedState: null,
    resolvedLocality: null,
    localityNum: null,
    localityName: null,
    method: 'national_default',
    confidence: 'low',
    gpci: NATIONAL_DEFAULT_GPCI,
    notes,
    userMessage: 'Using national average rates (no location provided)'
  };
}

/**
 * Helper to generate user-friendly confidence badge text
 */
export function getConfidenceBadge(resolution: GeoResolution): {
  label: string;
  variant: 'success' | 'warning' | 'default';
} {
  switch (resolution.method) {
    case 'zip_exact':
      return { label: 'Adjusted by ZIP', variant: 'success' };
    case 'zip_to_state_avg':
      return { label: 'ZIP provided, state estimate', variant: 'warning' };
    case 'state_avg':
      return { label: 'State estimate', variant: 'warning' };
    case 'national_default':
      return { label: 'National average', variant: 'default' };
  }
}
