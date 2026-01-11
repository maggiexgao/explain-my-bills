# Pond Health — Strategy Audit Report

**Generated:** 2026-01-11  
**Purpose:** Document the full data pipeline, identify correctness issues, and prevent misinformation.

---

## 0A) What We Ingest — Dataset Inventory

| Dataset | Source/Year | Format | Supabase Table | Key Columns | Rows (Est.) | Used At Runtime |
|---------|-------------|--------|----------------|-------------|-------------|-----------------|
| **MPFS** | CMS Medicare Physician Fee Schedule 2026 | xlsx | `mpfs_benchmarks` | hcpcs, modifier, work_rvu, nonfac_pe_rvu, fac_pe_rvu, mp_rvu, nonfac_fee, fac_fee, conversion_factor, description, status | ~15,000+ | ✅ Primary pricing source for CPT/HCPCS codes |
| **GPCI** | CMS Geographic Practice Cost Index 2026 | xlsx/csv | `gpci_localities` | locality_num, state_abbr, locality_name, work_gpci, pe_gpci, mp_gpci | ~100-200 localities | ✅ Geographic fee adjustment |
| **GPCI State Avg** | Computed from GPCI | — | `gpci_state_avg_2026` | state_abbr, avg_work_gpci, avg_pe_gpci, avg_mp_gpci | 50+ states | ✅ Fallback when ZIP not matched |
| **ZIP→Locality** | CMS ZIP to Carrier Locality 2026 | xlsx | `zip_to_locality` | zip5, state_abbr, locality_num, carrier_num, county_name | ~40,000+ | ✅ Maps user ZIP to locality |
| **OPPS Addendum B** | CMS Hospital Outpatient PPS 2025 | xlsx | `opps_addendum_b` | hcpcs, apc, status_indicator, payment_rate, short_desc, long_desc | ~10,000+ | ⚠️ Used for hospital outpatient codes (reverse search) |
| **DMEPOS** | CMS DME Fee Schedule 2026 | xlsx | `dmepos_fee_schedule` | hcpcs, modifier, fee, state_abbr, short_desc | ~50,000+ | ⚠️ Used for A/E/K/L codes |
| **DMEPEN** | CMS Enteral/Parenteral Nutrition 2026 | xlsx | `dmepen_fee_schedule` | hcpcs, modifier, fee, state_abbr, short_desc | ~5,000+ | ⚠️ Used for B codes |

### Ingestion Path
- **UI Import:** Admin page (`/admin/data-import`) with `ImportCard` components
- **Server Processing:** Edge function `admin-import` handles parsing + batch inserts
- **Parsing:** Client-side XLSX parsing via `xlsx` library, then POST to edge function

### Primary Keys & Uniqueness
- MPFS: `(hcpcs, modifier, year, qp_status)`
- GPCI: `locality_num` (but also indexed by `state_abbr`)
- ZIP Crosswalk: `zip5` (should be unique per year)
- OPPS/DMEPOS/DMEPEN: `(hcpcs, year)` + modifiers/state

---

## 0B) What We Extract From Bills

### Document Ingestion Flow
1. **Upload:** User uploads image(s) or PDF on landing page
2. **Pre-Scan (Optional):** `pre-scan-location` edge function extracts ZIP/state from document
3. **Full Analysis:** `analyze-document` edge function sends to Gemini/GPT with structured prompt
4. **Response Parsing:** JSON response parsed into `AnalysisResult` type

### What's Extracted (from AI prompt)
| Field | Source | Notes |
|-------|--------|-------|
| **CPT/HCPCS Codes** | AI extraction from visible codes | Validated via `cptCodeValidator.ts` |
| **Service Descriptions** | AI extraction | Used for reverse search when codes missing |
| **Total Billed / Charges** | AI extraction from "Total Charges", "Statement Total" | ⚠️ Often fails or returns $0 |
| **Amount You May Owe** | AI extraction from "Balance Due", "Patient Responsibility" | More reliably extracted |
| **ZIP / State** | Pre-scan or user input | Critical for geo pricing |
| **Provider Name** | AI extraction | For templates |
| **Date of Service** | AI extraction | For year matching |

### Known Failure Modes
1. **Totals = $0:** AI fails to extract "Total Charges" even when visible
2. **False Code Positives:** Words like "LEVEL", "VISIT" treated as codes (now fixed in `cptCodeValidator`)
3. **Partial Table Extraction:** Multi-page bills truncated
4. **Balance vs Charges Confusion:** AI sometimes returns patient balance as "totalBilled"
5. **Revenue Codes Only:** Hospital bills with only revenue codes (no CPT) trigger no pricing

### Detection & Flagging
- `cptCodeValidator.ts`: Strict regex + stopword filtering
- `totalsExtractor.ts`: Document classification + candidate scoring
- Edge function prompt includes specific instructions for totals extraction

---

## 0C) How Pricing Is Computed

### Geo Resolution Priority (`geoResolver.ts`)
1. **ZIP provided → `zip_to_locality` crosswalk → locality_num → `gpci_localities`** (confidence: HIGH)
2. **ZIP not in crosswalk → derive state → `gpci_state_avg_2026`** (confidence: MEDIUM)
3. **Only state provided → `gpci_state_avg_2026`** (confidence: MEDIUM)
4. **Neither → National default (GPCI = 1.0, 1.0, 1.0)** (confidence: LOW)

### Code Lookup Priority (`medicareBenchmarkService.ts`)
1. **MPFS First:** Query `mpfs_benchmarks` for CPT/HCPCS
   - Match on `hcpcs`, `modifier`, `year=2026`, `qp_status='nonQP'`
   - Fallback: try without modifier
   - Fallback: try previous year (2025) if 2026 missing
2. **OPPS Fallback:** If MPFS missing, check `opps_addendum_b` (for hospital outpatient)
3. **DMEPOS Fallback:** If MPFS/OPPS missing, check `dmepos_fee_schedule` (for A/E/K/L codes)
4. **Reverse Search:** If no valid codes, infer from descriptions

### Medicare Reference Calculation (MPFS)
```
Medicare Fee = [(Work RVU × Work GPCI) + (PE RVU × PE GPCI) + (MP RVU × MP GPCI)] × CF
```
Where:
- Work/PE/MP RVU from MPFS row
- GPCI from resolved locality (or 1.0 if national)
- CF = 34.6062 (2026 Conversion Factor)

### Total Aggregation
- **Medicare Reference Total:** Sum of individual Medicare fees for MATCHED codes only
- **Billed Total:** ⚠️ Currently extracted from document (unreliable)
- **Multiple:** `billedTotal / medicareReferenceTotal`

### ⚠️ CRITICAL ISSUE: Scope Mismatch
The "billed total" from the document may include:
- Services not priced (missing from MPFS)
- Facility fees (not in MPFS)
- Bundled items
- Items we couldn't match

But we divide by Medicare reference which only includes MATCHED items → **misleading multiple!**

---

## 0D) Outputs & User-Facing Claims

| Claim | Data Source | Calculation | Confidence Check | Misinformation Risk |
|-------|-------------|-------------|------------------|---------------------|
| **"Total Billed"** | AI extraction from doc | Direct extraction | ⚠️ Often fails, shows $0 | **HIGH** if wrong number shown |
| **"Medicare Reference"** | Sum of MPFS lookups | RVU × GPCI × CF | ✅ Correct for matched items | **MEDIUM** - scope mismatch with billed |
| **"X× Medicare"** | billedTotal / medicareRef | Division | ⚠️ Invalid if billed is partial balance | **HIGH** - $118 billed / $819 Medicare = 0.14× makes no sense |
| **"Significantly Above Reference"** | multiple > 3.0 | Threshold | ⚠️ False if scope mismatch | **HIGH** - user trusts this |
| **"Potential Savings"** | billed - (1.5 × Medicare) | Estimate | ⚠️ Same scope issue | **MEDIUM** |
| **"Fair/High/Very High"** | multiple thresholds | <200% / 200-300% / >300% | ⚠️ Only valid when scope matches | **HIGH** |

### Example of Misinformation
**User sees:**
> "Total billed $118, Medicare reference $819, multiple 0.14×"

**Reality:**
- $118 = patient balance (after insurance adjustments)
- $819 = Medicare reference for ALL services on the bill
- 0.14× = mathematically correct but conceptually wrong

**User misunderstanding:** "I'm paying LESS than Medicare rate, this is a great deal!"  
**Reality:** User is seeing remaining balance, not original charges.

---

## 0E) Misinformation Risks & Guardrails

### Risk 1: Scope Mismatch (CRITICAL)
**Problem:** Comparing "patient balance" to "Medicare reference for all services"  
**Fix:** 
1. Only compute multiple when both totals have same scope
2. Add `comparisonTotalType` label ("Charges" vs "Patient Balance")
3. Show "Limited Data" when mismatch detected

### Risk 2: Partial Pricing (MEDIUM)
**Problem:** Medicare reference only includes matched items, but billed total includes everything  
**Fix:**
1. Track `matchedBilledTotal` = sum of billed amounts for matched items only
2. Show coverage % = matched items / total items
3. Warning: "Some services couldn't be priced"

### Risk 3: Reverse Search Confidence (MEDIUM)
**Problem:** Inferred codes treated as definitive  
**Fix:**
1. Label inferred codes as "Estimated match"
2. Lower confidence threshold for claims based on inferred codes
3. Show "Codes inferred from descriptions, not from bill"

### Risk 4: Zero/Missing Totals (HIGH)
**Problem:** $0 shown when extraction fails  
**Fix:**
1. Never show $0 without "Not detected" label
2. Use line-item sum as fallback
3. Show extraction confidence

### Risk 5: "Fair" Label on Bad Data (MEDIUM)
**Problem:** Showing "Fair" status based on bad inputs  
**Fix:**
1. Require minimum confidence for status labels
2. Show "Unable to determine" for low confidence
3. Don't show green checkmarks without validated data

---

## 0F) Admin Data-Gap Strategy

### What Should Be Shown to Admin
1. **Dataset Coverage Matrix:**
   - Which datasets are loaded
   - Row/code counts
   - Years available
   - Last updated

2. **Capability Matrix:**
   - What we can price (professional, outpatient, DME, nutrition)
   - What we cannot price (inpatient DRG, drugs, lab codes without CLFS)

3. **Live Gap Detection:**
   - Top missing codes from real analyses
   - Top unmatched descriptions
   - % of uploads with no totals detected
   - % using state fallback for geo

4. **Recommendations:**
   - Next datasets to add based on observed gaps

### Implementation Status
- ✅ `DatasetStatusBar.tsx` shows loaded/missing
- ✅ `CoverageMetricsCard.tsx` shows row counts
- ⚠️ NO live gap detection from actual usage
- ⚠️ NO recommendations engine

---

## Summary of Fixes Needed

1. **Implement matched-items comparison model** - Only compare same-scope totals
2. **Add `comparisonTotalType` to UI** - Label what's being compared
3. **Fix totals extraction** - Better AI prompts, fallback to line-item sum
4. **Add coverage warnings** - "X of Y items priced"
5. **Create admin gap diagnostics** - Track missing codes from real usage
6. **Label inferred codes** - Never show reverse-search results as definitive
7. **Never show $0 without warning** - Always explain extraction failures

---

## Appendix: Key Files

| Purpose | File |
|---------|------|
| Code validation | `src/lib/cptCodeValidator.ts` |
| Geo resolution | `src/lib/geoResolver.ts` |
| Medicare pricing | `src/lib/medicareBenchmarkService.ts` |
| Reverse search | `src/lib/reverseCodeSearch.ts` |
| Totals extraction | `src/lib/totalsExtractor.ts` |
| Bill analysis prompt | `supabase/functions/analyze-document/index.ts` |
| Debug panel | `src/components/analysis/DebugCalculationPanel.tsx` |
| Admin status | `src/components/admin/DatasetStatusBar.tsx` |
| Main comparison UI | `src/components/analysis/HowThisCompares.tsx` |
