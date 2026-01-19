/**
 * Medicare Reference Resolver
 *
 * Unified "ladder" logic for resolving Medicare reference prices across multiple data sources:
 * - MPFS (Medicare Physician Fee Schedule) - for professional/office services
 * - OPPS (Hospital Outpatient PPS) - for facility/hospital outpatient services
 * - DMEPOS (Durable Medical Equipment) - for equipment-style HCPCS codes
 * - DMEPEN (Enteral/Parenteral Nutrition) - subset of DMEPOS
 *
 * The ladder prioritizes sources by care setting:
 * - Office: MPFS → DMEPOS (if code looks like equipment)
 * - Facility: OPPS → MPFS → DMEPOS
 */

import { supabase } from "@/integrations/supabase/client";
import { resolveGeo, GeoResolution, GeoMethod, GpciIndices } from "./geoResolver";

// ============= Types =============

export type ReferenceSource =
  | "mpfs_rvu_local" // Computed from RVUs + GPCI + CF
  | "mpfs_fee_national" // Using pre-calculated national fee
  | "opps_payment" // OPPS Addendum B payment rate
  | "dmepos_fee" // DMEPOS fee schedule
  | "dmepen_fee" // DMEPEN fee schedule
  | "none";

export type MatchStatus =
  | "priced" // We can compute a reference price
  | "exists_not_priced" // Code exists but no payable amount
  | "missing_from_dataset"; // Code not found in any dataset

export type ConfidenceLevel = "high" | "medium" | "low";

export type CareSetting = "office" | "facility";

export interface LadderStep {
  source: ReferenceSource;
  attempted: boolean;
  foundRow: boolean;
  hasFee: boolean;
  reason?: string;
}

export interface CodeResolution {
  hcpcs: string;
  modifier: string;
  referencePrice: number | null;
  referenceSource: ReferenceSource;
  matchStatus: MatchStatus;
  confidence: ConfidenceLevel;
  explanation: string;
  ladderPath: LadderStep[];
  debug: {
    tableMatched: string | null;
    columnUsed: string | null;
    statusIndicator?: string | null;
    modifierLogic?: string;
    geoMethod?: GeoMethod;
    yearUsed: number | null;
    rawFee?: number | null;
    gpciApplied?: boolean;
  };
}

export interface ResolverInput {
  codes: Array<{
    hcpcs: string;
    modifier?: string;
    billedAmount?: number;
    isFacility?: boolean;
  }>;
  careSetting: CareSetting;
  zip?: string;
  state?: string;
  year?: number; // Default: 2026 for MPFS/DMEPOS, 2025 for OPPS
}

export interface ResolverOutput {
  resolutions: CodeResolution[];
  summary: {
    totalPriced: number;
    totalExistsNotPriced: number;
    totalMissing: number;
    totalReferencePrice: number | null;
    primarySource: ReferenceSource;
  };
  geoResolution: GeoResolution;
  metadata: {
    mpfsYear: number;
    oppsYear: number;
    dmePosYear: number;
    careSetting: CareSetting;
  };
}

// ============= Constants =============

// DMEPOS-style HCPCS prefixes (equipment, supplies, orthotics, prosthetics)
const DMEPOS_PREFIXES = ["A", "B", "E", "K", "L"];

// Status indicators for OPPS that mean "not separately payable"
const OPPS_NOT_PAYABLE_SI = ["N", "B", "P", "X", "Y"];

// Status codes for MPFS that mean "not payable"
const MPFS_NOT_PAYABLE_STATUS = ["B", "I", "N", "R", "X"];

// Default years
const DEFAULT_MPFS_YEAR = 2026;
const DEFAULT_OPPS_YEAR = 2025;
const DEFAULT_DMEPOS_YEAR = 2026;

// Default conversion factor
const DEFAULT_CF = 34.6062;

// Hardcoded OPPS rates for common ER codes - fallback if database lookup fails
const OPPS_FALLBACK_RATES: Record<string, { payment_rate: number; status_indicator: string; apc: string }> = {
  '99281': { payment_rate: 88.05, status_indicator: 'J2', apc: '5021' },
  '99282': { payment_rate: 158.36, status_indicator: 'J2', apc: '5022' },
  '99283': { payment_rate: 276.89, status_indicator: 'J2', apc: '5023' },
  '99284': { payment_rate: 425.82, status_indicator: 'J2', apc: '5024' },
  '99285': { payment_rate: 613.10, status_indicator: 'J2', apc: '5025' },
};

// ============= Helper Functions =============

function isDmeposCode(hcpcs: string): boolean {
  if (!hcpcs || hcpcs.length < 1) return false;
  return DMEPOS_PREFIXES.includes(hcpcs.charAt(0).toUpperCase());
}

// ============= MPFS Lookup =============

interface MpfsRow {
  hcpcs: string;
  modifier: string;
  description: string | null;
  status: string | null;
  work_rvu: number | null;
  nonfac_pe_rvu: number | null;
  fac_pe_rvu: number | null;
  mp_rvu: number | null;
  nonfac_fee: number | null;
  fac_fee: number | null;
  conversion_factor: number | null;
  year: number;
}

async function lookupMpfs(
  hcpcs: string,
  modifier: string,
  year: number,
): Promise<{ row: MpfsRow | null; modifierFallback: boolean }> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  const normalizedMod = modifier ? modifier.trim().toUpperCase() : "";

  // Try exact modifier match first
  if (normalizedMod) {
    const { data } = await supabase
      .from("mpfs_benchmarks")
      .select("*")
      .eq("hcpcs", normalizedCode)
      .eq("year", year)
      .eq("qp_status", "nonQP")
      .eq("modifier", normalizedMod)
      .limit(1)
      .maybeSingle();

    if (data) return { row: data as MpfsRow, modifierFallback: false };
  }

  // Try base code (no modifier)
  const { data } = await supabase
    .from("mpfs_benchmarks")
    .select("*")
    .eq("hcpcs", normalizedCode)
    .eq("year", year)
    .eq("qp_status", "nonQP")
    .eq("modifier", "")
    .limit(1)
    .maybeSingle();

  return { row: data as MpfsRow | null, modifierFallback: !!normalizedMod && !!data };
}

function calculateMpfsFee(
  row: MpfsRow,
  gpci: GpciIndices | null,
  isFacility: boolean,
): { fee: number | null; source: "mpfs_rvu_local" | "mpfs_fee_national"; gpciApplied: boolean } {
  // Check for non-payable status
  if (row.status && MPFS_NOT_PAYABLE_STATUS.includes(row.status.toUpperCase())) {
    return { fee: null, source: "mpfs_fee_national", gpciApplied: false };
  }

  const workRvu = row.work_rvu ?? 0;
  const mpRvu = row.mp_rvu ?? 0;
  const peRvu = isFacility ? (row.fac_pe_rvu ?? 0) : (row.nonfac_pe_rvu ?? 0);
  const cf = row.conversion_factor ?? DEFAULT_CF;

  const hasAnyRvu = workRvu > 0 || peRvu > 0 || mpRvu > 0;

  if (hasAnyRvu && gpci && gpci.work > 0) {
    // Locality-adjusted RVU calculation
    const adjustedFee = (workRvu * gpci.work + peRvu * gpci.pe + mpRvu * gpci.mp) * cf;

    return { fee: Math.round(adjustedFee * 100) / 100, source: "mpfs_rvu_local", gpciApplied: true };
  }

  if (hasAnyRvu) {
    // National RVU calculation (no GPCI)
    const nationalFee = (workRvu + peRvu + mpRvu) * cf;
    return { fee: Math.round(nationalFee * 100) / 100, source: "mpfs_fee_national", gpciApplied: false };
  }

  // Fall back to direct fee
  const directFee = isFacility ? row.fac_fee : row.nonfac_fee;
  if (directFee !== null && directFee > 0) {
    return { fee: Math.round(directFee * 100) / 100, source: "mpfs_fee_national", gpciApplied: false };
  }

  return { fee: null, source: "mpfs_fee_national", gpciApplied: false };
}

// ============= OPPS Lookup =============

interface OppsRow {
  hcpcs: string;
  apc: string | null;
  status_indicator: string | null;
  payment_rate: number | null;
  relative_weight: number | null;
  short_desc: string | null;
  year: number;
}

async function lookupOpps(hcpcs: string, year: number): Promise<OppsRow | null> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  console.log(`[OPPS Lookup] === Starting lookup for ${normalizedCode}, year ${year} ===`);
  
  // Step 1: Try database lookup
  try {
    const { data, error } = await supabase
      .from("opps_addendum_b")
      .select("*")
      .eq("hcpcs", normalizedCode)
      .eq("year", year)
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error(`[OPPS Lookup] Database error:`, error.message);
    }
    
    if (data && data.payment_rate !== null && data.payment_rate > 0) {
      console.log(`[OPPS Lookup] SUCCESS from database: ${normalizedCode} = $${data.payment_rate}`);
      return data as OppsRow;
    } else {
      console.log(`[OPPS Lookup] Database returned no valid data for ${normalizedCode}`);
    }
  } catch (err) {
    console.error(`[OPPS Lookup] Exception during database lookup:`, err);
  }
  
  // Step 2: Try hardcoded fallback for ER codes
  if (OPPS_FALLBACK_RATES[normalizedCode]) {
    const fallback = OPPS_FALLBACK_RATES[normalizedCode];
    console.log(`[OPPS Lookup] SUCCESS from FALLBACK: ${normalizedCode} = $${fallback.payment_rate}`);
    return {
      hcpcs: normalizedCode,
      year: year,
      payment_rate: fallback.payment_rate,
      status_indicator: fallback.status_indicator,
      apc: fallback.apc,
      short_desc: 'Emergency department visit',
      relative_weight: null,
    } as OppsRow;
  }
  
  console.log(`[OPPS Lookup] FAILED: No data found for ${normalizedCode} (not in DB or fallback)`);
  return null;
}

function getOppsPayment(row: OppsRow): { fee: number | null; isPayable: boolean; reason?: string } {
  // Check status indicator
  if (row.status_indicator && OPPS_NOT_PAYABLE_SI.includes(row.status_indicator.toUpperCase())) {
    return {
      fee: null,
      isPayable: false,
      reason: `Status indicator "${row.status_indicator}" indicates packaged/not separately payable`,
    };
  }

  if (row.payment_rate !== null && row.payment_rate > 0) {
    return { fee: row.payment_rate, isPayable: true };
  }

  return { fee: null, isPayable: false, reason: "No payment rate available" };
}

// ============= DMEPOS Lookup =============

interface DmeposRow {
  hcpcs: string;
  modifier: string | null;
  modifier2: string | null;
  fee: number | null;
  fee_rental: number | null;
  ceiling: number | null;
  floor: number | null;
  category: string | null;
  short_desc: string | null;
  state_abbr: string | null;
  year: number;
}

/**
 * DMEPOS lookup with cascading fallbacks:
 * 1. Exact: (hcpcs, modifier, state_abbr)
 * 2. (hcpcs, modifier, null state) - national
 * 3. (hcpcs, null modifier, state_abbr)
 * 4. (hcpcs, null modifier, null state) - national no modifier
 *
 * This ensures we find a price even if state-specific pricing isn't available.
 */
async function lookupDmepos(
  hcpcs: string,
  modifier: string | null,
  year: number,
  stateAbbr: string | null,
): Promise<{ row: DmeposRow | null; modifierLogic: string; fallbackType: string }> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  const normalizedMod = modifier ? modifier.trim().toUpperCase() : null;
  const normalizedState = stateAbbr ? stateAbbr.toUpperCase() : null;

  // Fallback 1: Exact match (hcpcs, modifier, state)
  if (normalizedMod && normalizedState) {
    const { data } = await supabase
      .from("dmepos_fee_schedule")
      .select("*")
      .eq("hcpcs", normalizedCode)
      .eq("year", year)
      .eq("modifier", normalizedMod)
      .eq("state_abbr", normalizedState)
      .limit(1)
      .maybeSingle();
    if (data) return { row: data as DmeposRow, modifierLogic: "exact_match", fallbackType: "exact_state_modifier" };
  }

  // Fallback 2: (hcpcs, modifier, null state) - national with modifier
  if (normalizedMod) {
    const { data } = await supabase
      .from("dmepos_fee_schedule")
      .select("*")
      .eq("hcpcs", normalizedCode)
      .eq("year", year)
      .eq("modifier", normalizedMod)
      .or("state_abbr.is.null,state_abbr.eq.")
      .limit(1)
      .maybeSingle();
    if (data)
      return { row: data as DmeposRow, modifierLogic: "exact_modifier", fallbackType: "national_with_modifier" };
  }

  // Fallback 3: (hcpcs, null modifier, state_abbr) - state without modifier
  if (normalizedState) {
    const { data } = await supabase
      .from("dmepos_fee_schedule")
      .select("*")
      .eq("hcpcs", normalizedCode)
      .eq("year", year)
      .eq("state_abbr", normalizedState)
      .or("modifier.is.null,modifier.eq.")
      .limit(1)
      .maybeSingle();
    if (data)
      return { row: data as DmeposRow, modifierLogic: "no_modifier_fallback", fallbackType: "state_no_modifier" };
  }

  // Fallback 4: (hcpcs, null modifier, null state) - national no modifier
  const { data: nationalNoMod } = await supabase
    .from("dmepos_fee_schedule")
    .select("*")
    .eq("hcpcs", normalizedCode)
    .eq("year", year)
    .or("modifier.is.null,modifier.eq.")
    .or("state_abbr.is.null,state_abbr.eq.")
    .limit(1)
    .maybeSingle();
  if (nationalNoMod)
    return {
      row: nationalNoMod as DmeposRow,
      modifierLogic: "no_modifier_fallback",
      fallbackType: "national_no_modifier",
    };

  // Fallback 5: Any available row for this code (last resort)
  const { data: anyData } = await supabase
    .from("dmepos_fee_schedule")
    .select("*")
    .eq("hcpcs", normalizedCode)
    .eq("year", year)
    .limit(1)
    .maybeSingle();

  if (anyData) return { row: anyData as DmeposRow, modifierLogic: "first_available", fallbackType: "first_available" };

  return { row: null, modifierLogic: "not_found", fallbackType: "not_found" };
}

async function lookupDmepen(
  hcpcs: string,
  modifier: string | null,
  year: number,
  stateAbbr: string | null,
): Promise<{ row: DmeposRow | null; modifierLogic: string }> {
  const normalizedCode = hcpcs.trim().toUpperCase();
  const normalizedMod = modifier ? modifier.trim().toUpperCase() : null;

  let query = supabase.from("dmepen_fee_schedule").select("*").eq("hcpcs", normalizedCode).eq("year", year);

  if (stateAbbr) {
    query = query.eq("state_abbr", stateAbbr.toUpperCase());
  }

  if (normalizedMod) {
    const { data } = await query.eq("modifier", normalizedMod).limit(1).maybeSingle();
    if (data) return { row: data as DmeposRow, modifierLogic: "exact_match" };
  }

  const { data: anyData } = await supabase
    .from("dmepen_fee_schedule")
    .select("*")
    .eq("hcpcs", normalizedCode)
    .eq("year", year)
    .limit(1)
    .maybeSingle();

  if (anyData) return { row: anyData as DmeposRow, modifierLogic: "first_available" };

  return { row: null, modifierLogic: "not_found" };
}

function getDmeposFee(row: DmeposRow): number | null {
  // Prefer purchase fee over rental
  if (row.fee !== null && row.fee > 0) return row.fee;
  if (row.ceiling !== null && row.ceiling > 0) return row.ceiling;
  if (row.fee_rental !== null && row.fee_rental > 0) return row.fee_rental;
  return null;
}

// ============= Main Resolver Function =============

export async function resolveMedicareReferences(input: ResolverInput): Promise<ResolverOutput> {
  const { codes, careSetting, zip, state, year } = input;

  console.log('========== MEDICARE RESOLVER START ==========');
  console.log('[Resolver] careSetting:', careSetting);
  console.log('[Resolver] codes:', codes.map(c => `${c.hcpcs}${c.modifier ? '-' + c.modifier : ''}`).join(', '));
  console.log('[Resolver] zip:', zip, 'state:', state);

  const mpfsYear = year ?? DEFAULT_MPFS_YEAR;
  const oppsYear = DEFAULT_OPPS_YEAR; // OPPS always 2025 for now
  const dmeposYear = year ?? DEFAULT_DMEPOS_YEAR;

  // Resolve geo for GPCI
  const geoResolution = await resolveGeo(zip, state);
  const gpci: GpciIndices | null = geoResolution.method !== "national_default" ? geoResolution.gpci : null;

  const resolutions: CodeResolution[] = [];
  let totalPriced = 0;
  let totalExistsNotPriced = 0;
  let totalMissing = 0;
  let totalReferencePrice = 0;
  const sourceUsage: Record<ReferenceSource, number> = {
    mpfs_rvu_local: 0,
    mpfs_fee_national: 0,
    opps_payment: 0,
    dmepos_fee: 0,
    dmepen_fee: 0,
    none: 0,
  };

  for (const code of codes) {
    const hcpcs = code.hcpcs.trim().toUpperCase();
    const modifier = code.modifier?.trim().toUpperCase() || "";
    const isFacility = code.isFacility ?? careSetting === "facility";
    
    console.log(`[Resolver] Processing code: ${hcpcs}, careSetting: ${careSetting}, isFacility: ${isFacility}`);

    const ladderPath: LadderStep[] = [];
    let resolution: CodeResolution = {
      hcpcs,
      modifier,
      referencePrice: null,
      referenceSource: "none",
      matchStatus: "missing_from_dataset",
      confidence: "low",
      explanation: "",
      ladderPath: [],
      debug: {
        tableMatched: null,
        columnUsed: null,
        yearUsed: null,
        gpciApplied: false,
      },
    };

    // ===== LADDER LOGIC =====

    if (careSetting === "office") {
      // OFFICE: MPFS → DMEPOS (if equipment-style code)
      console.log(`[Resolver] >>> Taking OFFICE path for ${hcpcs} (will try MPFS first)`);

      // Step 1: Try MPFS
      const mpfsResult = await lookupMpfs(hcpcs, modifier, mpfsYear);
      const mpfsStep: LadderStep = {
        source: "mpfs_rvu_local",
        attempted: true,
        foundRow: !!mpfsResult.row,
        hasFee: false,
      };

      if (mpfsResult.row) {
        const feeResult = calculateMpfsFee(mpfsResult.row, gpci, isFacility);
        mpfsStep.hasFee = feeResult.fee !== null;

        if (feeResult.fee !== null) {
          resolution = {
            hcpcs,
            modifier,
            referencePrice: feeResult.fee,
            referenceSource: feeResult.source,
            matchStatus: "priced",
            confidence: gpci ? "high" : "medium",
            explanation: feeResult.gpciApplied
              ? `Medicare reference from MPFS, adjusted for your location`
              : `Medicare reference from MPFS (national rate)`,
            ladderPath: [mpfsStep],
            debug: {
              tableMatched: "mpfs_benchmarks",
              columnUsed: feeResult.gpciApplied ? "RVU calculation" : isFacility ? "fac_fee" : "nonfac_fee",
              yearUsed: mpfsYear,
              gpciApplied: feeResult.gpciApplied,
              geoMethod: geoResolution.method,
            },
          };
          ladderPath.push(mpfsStep);
        } else {
          // Row exists but no fee
          mpfsStep.reason = "Row exists but no payable amount";
          ladderPath.push(mpfsStep);
          resolution.matchStatus = "exists_not_priced";
          resolution.explanation = "Code exists in MPFS but Medicare doesn't publish a payable amount";
          resolution.debug.tableMatched = "mpfs_benchmarks";
          resolution.debug.yearUsed = mpfsYear;
        }
      } else {
        ladderPath.push(mpfsStep);
      }

      // Step 2: If MPFS missing and code is DMEPOS-style, try DMEPOS
      if (resolution.matchStatus === "missing_from_dataset" && isDmeposCode(hcpcs)) {
        const dmeposResult = await lookupDmepos(hcpcs, modifier, dmeposYear, state || null);
        const dmeposStep: LadderStep = {
          source: "dmepos_fee",
          attempted: true,
          foundRow: !!dmeposResult.row,
          hasFee: false,
        };

        if (dmeposResult.row) {
          const fee = getDmeposFee(dmeposResult.row);
          dmeposStep.hasFee = fee !== null;

          if (fee !== null) {
            resolution = {
              hcpcs,
              modifier,
              referencePrice: fee,
              referenceSource: "dmepos_fee",
              matchStatus: "priced",
              confidence: dmeposResult.modifierLogic === "exact_match" ? "high" : "medium",
              explanation: `Medicare reference from DMEPOS fee schedule`,
              ladderPath: [...ladderPath, dmeposStep],
              debug: {
                tableMatched: "dmepos_fee_schedule",
                columnUsed: "fee",
                modifierLogic: dmeposResult.modifierLogic,
                yearUsed: dmeposYear,
                gpciApplied: false,
              },
            };
          } else {
            dmeposStep.reason = "Row exists but no fee available";
            ladderPath.push(dmeposStep);
            resolution.matchStatus = "exists_not_priced";
            resolution.explanation = "Code listed in DMEPOS but no fee available for this code/modifier/year";
            resolution.debug.tableMatched = "dmepos_fee_schedule";
            resolution.debug.yearUsed = dmeposYear;
          }
        } else {
          ladderPath.push(dmeposStep);

          // Try DMEPEN as last resort
          const dmepenResult = await lookupDmepen(hcpcs, modifier, dmeposYear, state || null);
          const dmepenStep: LadderStep = {
            source: "dmepen_fee",
            attempted: true,
            foundRow: !!dmepenResult.row,
            hasFee: false,
          };

          if (dmepenResult.row) {
            const fee = getDmeposFee(dmepenResult.row);
            dmepenStep.hasFee = fee !== null;

            if (fee !== null) {
              resolution = {
                hcpcs,
                modifier,
                referencePrice: fee,
                referenceSource: "dmepen_fee",
                matchStatus: "priced",
                confidence: "medium",
                explanation: `Medicare reference from DMEPEN (enteral/parenteral) fee schedule`,
                ladderPath: [...ladderPath, dmepenStep],
                debug: {
                  tableMatched: "dmepen_fee_schedule",
                  columnUsed: "fee",
                  modifierLogic: dmepenResult.modifierLogic,
                  yearUsed: dmeposYear,
                  gpciApplied: false,
                },
              };
            }
          }
          ladderPath.push(dmepenStep);
        }
      }
    } else {
      // FACILITY: OPPS → MPFS → DMEPOS
      console.log(`[Resolver] >>> Taking FACILITY path for ${hcpcs} (will try OPPS first)`);

      // Step 1: Try OPPS
      console.log(`[Resolver] About to call lookupOpps for ${hcpcs}, year ${oppsYear}`);
      const oppsRow = await lookupOpps(hcpcs, oppsYear);
      console.log(`[Resolver] OPPS lookup result:`, oppsRow ? `FOUND payment_rate=${oppsRow.payment_rate}` : 'NOT FOUND');
      
      const oppsStep: LadderStep = {
        source: "opps_payment",
        attempted: true,
        foundRow: !!oppsRow,
        hasFee: false,
      };

      if (oppsRow) {
        const oppsResult = getOppsPayment(oppsRow);
        console.log(`[Resolver] getOppsPayment returned:`, oppsResult);
        oppsStep.hasFee = oppsResult.fee !== null;

        if (oppsResult.fee !== null) {
          console.log(`[Resolver] SUCCESS: Using OPPS rate $${oppsResult.fee} for ${hcpcs}`);
          resolution = {
            hcpcs,
            modifier,
            referencePrice: oppsResult.fee,
            referenceSource: "opps_payment",
            matchStatus: "priced",
            confidence: "high",
            explanation: `Medicare reference from OPPS (hospital outpatient) – national rate`,
            ladderPath: [oppsStep],
            debug: {
              tableMatched: "opps_addendum_b",
              columnUsed: "payment_rate",
              statusIndicator: oppsRow.status_indicator,
              yearUsed: oppsYear,
              gpciApplied: false,
            },
          };
          ladderPath.push(oppsStep);
        } else {
          oppsStep.reason = oppsResult.reason || "No payable amount";
          ladderPath.push(oppsStep);
          resolution.matchStatus = "exists_not_priced";
          resolution.explanation = oppsResult.reason || "Packaged or not separately payable under OPPS";
          resolution.debug.tableMatched = "opps_addendum_b";
          resolution.debug.statusIndicator = oppsRow.status_indicator;
          resolution.debug.yearUsed = oppsYear;
        }
      } else {
        ladderPath.push(oppsStep);
      }

      // Step 2: If OPPS missing, try MPFS
      if (resolution.matchStatus === "missing_from_dataset") {
        const mpfsResult = await lookupMpfs(hcpcs, modifier, mpfsYear);
        const mpfsStep: LadderStep = {
          source: "mpfs_rvu_local",
          attempted: true,
          foundRow: !!mpfsResult.row,
          hasFee: false,
        };

        if (mpfsResult.row) {
          const feeResult = calculateMpfsFee(mpfsResult.row, gpci, true); // isFacility = true
          mpfsStep.hasFee = feeResult.fee !== null;

          if (feeResult.fee !== null) {
            resolution = {
              hcpcs,
              modifier,
              referencePrice: feeResult.fee,
              referenceSource: feeResult.source,
              matchStatus: "priced",
              confidence: gpci ? "high" : "medium",
              explanation: `Medicare reference from MPFS (physician fee) as OPPS fallback`,
              ladderPath: [...ladderPath, mpfsStep],
              debug: {
                tableMatched: "mpfs_benchmarks",
                columnUsed: feeResult.gpciApplied ? "RVU calculation" : "fac_fee",
                yearUsed: mpfsYear,
                gpciApplied: feeResult.gpciApplied,
                geoMethod: geoResolution.method,
              },
            };
          } else {
            mpfsStep.reason = "Row exists but no payable amount";
            ladderPath.push(mpfsStep);
            resolution.matchStatus = "exists_not_priced";
            resolution.explanation = "Code exists in MPFS but Medicare doesn't publish a payable amount";
            resolution.debug.tableMatched = "mpfs_benchmarks";
            resolution.debug.yearUsed = mpfsYear;
          }
        } else {
          ladderPath.push(mpfsStep);
        }
      }

      // Step 3: If still missing and DMEPOS-style, try DMEPOS
      if (resolution.matchStatus === "missing_from_dataset" && isDmeposCode(hcpcs)) {
        const dmeposResult = await lookupDmepos(hcpcs, modifier, dmeposYear, state || null);
        const dmeposStep: LadderStep = {
          source: "dmepos_fee",
          attempted: true,
          foundRow: !!dmeposResult.row,
          hasFee: false,
        };

        if (dmeposResult.row) {
          const fee = getDmeposFee(dmeposResult.row);
          dmeposStep.hasFee = fee !== null;

          if (fee !== null) {
            resolution = {
              hcpcs,
              modifier,
              referencePrice: fee,
              referenceSource: "dmepos_fee",
              matchStatus: "priced",
              confidence: "medium",
              explanation: `Medicare reference from DMEPOS fee schedule`,
              ladderPath: [...ladderPath, dmeposStep],
              debug: {
                tableMatched: "dmepos_fee_schedule",
                columnUsed: "fee",
                modifierLogic: dmeposResult.modifierLogic,
                yearUsed: dmeposYear,
                gpciApplied: false,
              },
            };
          }
        }
        ladderPath.push(dmeposStep);
      }
    }

    // Finalize resolution
    resolution.ladderPath = ladderPath;

    // Set final explanation if still missing
    if (resolution.matchStatus === "missing_from_dataset") {
      resolution.explanation = "We couldn't find this code in our current Medicare datasets (MPFS/OPPS/DMEPOS)";
    }

    // Update counters
    if (resolution.matchStatus === "priced") {
      totalPriced++;
      if (resolution.referencePrice) totalReferencePrice += resolution.referencePrice;
    } else if (resolution.matchStatus === "exists_not_priced") {
      totalExistsNotPriced++;
    } else {
      totalMissing++;
    }
    sourceUsage[resolution.referenceSource]++;

    resolutions.push(resolution);
  }

  // Determine primary source
  let primarySource: ReferenceSource = "none";
  let maxUsage = 0;
  for (const [source, count] of Object.entries(sourceUsage)) {
    if (count > maxUsage && source !== "none") {
      maxUsage = count;
      primarySource = source as ReferenceSource;
    }
  }

  console.log('========== MEDICARE RESOLVER COMPLETE ==========');
  console.log('[Resolver] Results summary:');
  resolutions.forEach(r => {
    console.log(`  ${r.hcpcs}: $${r.referencePrice} from ${r.referenceSource}`);
  });
  console.log('================================================');

  return {
    resolutions,
    summary: {
      totalPriced,
      totalExistsNotPriced,
      totalMissing,
      totalReferencePrice: totalPriced > 0 ? totalReferencePrice : null,
      primarySource,
    },
    geoResolution,
    metadata: {
      mpfsYear,
      oppsYear,
      dmePosYear: dmeposYear,
      careSetting,
    },
  };
}

// ============= Coverage Metrics =============

export interface CoverageMetrics {
  mpfs: { totalRows: number; uniqueHcpcs: number };
  opps: { totalRows: number; uniqueHcpcs: number };
  dmepos: { totalRows: number; uniqueHcpcs: number };
  dmepen: { totalRows: number; uniqueHcpcs: number };
}

export async function getCoverageMetrics(): Promise<CoverageMetrics> {
  const [mpfsCount, oppsCount, dmeposCount, dmepenCount] = await Promise.all([
    supabase.from("mpfs_benchmarks").select("hcpcs", { count: "exact", head: true }),
    supabase.from("opps_addendum_b").select("hcpcs", { count: "exact", head: true }),
    supabase.from("dmepos_fee_schedule").select("hcpcs", { count: "exact", head: true }),
    supabase.from("dmepen_fee_schedule").select("hcpcs", { count: "exact", head: true }),
  ]);

  return {
    mpfs: { totalRows: mpfsCount.count || 0, uniqueHcpcs: mpfsCount.count || 0 },
    opps: { totalRows: oppsCount.count || 0, uniqueHcpcs: oppsCount.count || 0 },
    dmepos: { totalRows: dmeposCount.count || 0, uniqueHcpcs: dmeposCount.count || 0 },
    dmepen: { totalRows: dmepenCount.count || 0, uniqueHcpcs: dmepenCount.count || 0 },
  };
}

// ============= Source Label Helpers =============

export function getSourceLabel(source: ReferenceSource): string {
  switch (source) {
    case "mpfs_rvu_local":
      return "MPFS (location-adjusted)";
    case "mpfs_fee_national":
      return "MPFS (national)";
    case "opps_payment":
      return "OPPS (hospital outpatient)";
    case "dmepos_fee":
      return "DMEPOS";
    case "dmepen_fee":
      return "DMEPEN";
    case "none":
      return "N/A";
  }
}

export function getMatchStatusLabel(status: MatchStatus): string {
  switch (status) {
    case "priced":
      return "Priced";
    case "exists_not_priced":
      return "Exists (not priced)";
    case "missing_from_dataset":
      return "Missing from datasets";
  }
}

export function getMatchStatusExplanation(status: MatchStatus, source: ReferenceSource): string {
  if (status === "priced") {
    return "";
  }

  if (status === "exists_not_priced") {
    switch (source) {
      case "mpfs_rvu_local":
      case "mpfs_fee_national":
        return "Code exists but Medicare doesn't publish a payable amount in MPFS";
      case "opps_payment":
        return "Packaged or not separately payable under OPPS";
      case "dmepos_fee":
      case "dmepen_fee":
        return "Listed but no fee available for this code/modifier/year";
      default:
        return "Code exists but not priced in this schedule";
    }
  }

  return "We couldn't find this code in our current Medicare datasets (MPFS/OPPS/DMEPOS). Some specialized services may be billed under other schedules (CLFS, etc.)";
}
