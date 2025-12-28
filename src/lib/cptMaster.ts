/**
 * CPT Master - Load and query CPT code descriptions from DHS Code List
 */

export type CptMasterEntry = {
  cpt: string;
  shortLabel: string;
  longDescription: string;
  section?: string;
  category?: string;
  synonyms?: string[];
};

// Singleton cache
let cptMasterCache: Map<string, CptMasterEntry> | null = null;
let cptMasterPromise: Promise<Map<string, CptMasterEntry>> | null = null;

// Section/category mappings based on CPT code ranges
function inferSectionFromCode(cpt: string): { section: string; category: string } {
  const numeric = parseInt(cpt.replace(/[^0-9]/g, ''), 10);
  
  if (cpt.startsWith('0') && cpt.match(/^\\d{4}[A-Z]$/)) {
    return { section: 'Category III', category: 'Emerging Technology' };
  }
  
  if (cpt.match(/^\\d{4}[MU]$/)) {
    return { section: 'Proprietary Lab Analyses', category: 'Lab' };
  }
  
  if (!Number.isFinite(numeric)) {
    if (cpt.startsWith('A') || cpt.startsWith('B') || cpt.startsWith('C') || 
        cpt.startsWith('D') || cpt.startsWith('E') || cpt.startsWith('G') ||
        cpt.startsWith('H') || cpt.startsWith('J') || cpt.startsWith('K') ||
        cpt.startsWith('L') || cpt.startsWith('M') || cpt.startsWith('P') ||
        cpt.startsWith('Q') || cpt.startsWith('R') || cpt.startsWith('S') ||
        cpt.startsWith('T') || cpt.startsWith('V')) {
      return { section: 'HCPCS Level II', category: 'Supplies/Services' };
    }
    return { section: 'Other', category: 'Other' };
  }
  
  if (numeric >= 99202 && numeric <= 99499) {
    return { section: 'Evaluation and Management', category: 'E&M' };
  }
  if (numeric >= 1 && numeric <= 1999) {
    return { section: 'Anesthesia', category: 'Anesthesia' };
  }
  if (numeric >= 10021 && numeric <= 69990) {
    return { section: 'Surgery', category: 'Surgery' };
  }
  if (numeric >= 70010 && numeric <= 79999) {
    return { section: 'Radiology', category: 'Imaging' };
  }
  if (numeric >= 80047 && numeric <= 89398) {
    return { section: 'Pathology and Laboratory', category: 'Lab' };
  }
  if (numeric >= 90281 && numeric <= 99199) {
    return { section: 'Medicine', category: 'Medicine' };
  }
  
  return { section: 'Other', category: 'Other' };
}

/**
 * Parse the DHS code list format: |CODE|Description|
 */
function parseDhsCodeLine(line: string): CptMasterEntry | null {
  // Skip header and empty lines
  if (!line || line.trim() === '' || line.startsWith('|LIST OF') || 
      line.startsWith('|-') || line.startsWith('|||') ||
      line.startsWith('|This code') || line.startsWith('|INCLUDE') ||
      line.startsWith('|EXCLUDE') || line.startsWith('|CLINICAL')) {
    return null;
  }
  
  // Match format: |CODE|Description|
  const match = line.match(/^\|([A-Z0-9]{4,5}[A-Z]?)\|(.*)\|\s*$/);
  if (!match) return null;
  
  const cpt = match[1].padStart(5, '0');
  const description = match[2].trim();
  
  const { section, category } = inferSectionFromCode(cpt);
  
  // Generate short label from description
  const shortLabel = description.length > 40 
    ? description.slice(0, 37) + '...'
    : description;
  
  return {
    cpt,
    shortLabel,
    longDescription: description,
    section,
    category,
  };
}

/**
 * Load CPT master from hardcoded common codes + any fetched data
 */
async function loadFromStaticData(): Promise<Map<string, CptMasterEntry>> {
  const entries = new Map<string, CptMasterEntry>();
  
  // Common CPT codes with descriptions
  const commonCodes: Array<[string, string]> = [
    // E&M Codes
    ['99202', 'Office visit, new patient, straightforward'],
    ['99203', 'Office visit, new patient, low complexity'],
    ['99204', 'Office visit, new patient, moderate complexity'],
    ['99205', 'Office visit, new patient, high complexity'],
    ['99211', 'Office visit, established patient, minimal'],
    ['99212', 'Office visit, established patient, straightforward'],
    ['99213', 'Office visit, established patient, low complexity'],
    ['99214', 'Office visit, established patient, moderate complexity'],
    ['99215', 'Office visit, established patient, high complexity'],
    ['99221', 'Initial hospital visit, straightforward'],
    ['99222', 'Initial hospital visit, moderate complexity'],
    ['99223', 'Initial hospital visit, high complexity'],
    ['99231', 'Subsequent hospital visit, straightforward'],
    ['99232', 'Subsequent hospital visit, moderate complexity'],
    ['99233', 'Subsequent hospital visit, high complexity'],
    ['99281', 'Emergency room visit, minimal'],
    ['99282', 'Emergency room visit, low severity'],
    ['99283', 'Emergency room visit, moderate severity'],
    ['99284', 'Emergency room visit, high severity'],
    ['99285', 'Emergency room visit, high severity with threat'],
    
    // Common Lab Codes
    ['80053', 'Comprehensive metabolic panel'],
    ['80061', 'Lipid panel'],
    ['85025', 'Complete blood count with differential'],
    ['85027', 'Complete blood count automated'],
    ['84443', 'Thyroid stimulating hormone (TSH)'],
    ['84439', 'Free thyroxine (T4)'],
    ['82947', 'Blood glucose level'],
    ['82306', 'Vitamin D level'],
    ['83036', 'Hemoglobin A1c'],
    
    // Common Imaging Codes
    ['71046', 'Chest X-ray, 2 views'],
    ['71045', 'Chest X-ray, single view'],
    ['73030', 'X-ray shoulder'],
    ['72100', 'X-ray lumbar spine, 2-3 views'],
    ['70553', 'MRI brain with and without contrast'],
    ['72148', 'MRI lumbar spine without contrast'],
    ['74177', 'CT abdomen and pelvis with contrast'],
    ['76700', 'Ultrasound abdomen complete'],
    ['76856', 'Ultrasound pelvis complete'],
    ['77067', 'Screening mammography bilateral'],
    
    // Common Surgery/Procedure Codes
    ['10060', 'Incision and drainage of abscess'],
    ['11102', 'Tangential skin biopsy, single lesion'],
    ['17000', 'Destruction of premalignant lesion, first'],
    ['20610', 'Joint injection/aspiration, major joint'],
    ['43239', 'Upper GI endoscopy with biopsy'],
    ['45378', 'Colonoscopy diagnostic'],
    ['45380', 'Colonoscopy with biopsy'],
    ['45385', 'Colonoscopy with polyp removal'],
    ['50688', 'Insertion of ureteral stent'],
    
    // Pathology Codes
    ['88305', 'Surgical pathology, Level IV'],
    ['88342', 'Immunohistochemistry'],
    
    // Other Common Codes
    ['90471', 'Immunization administration, first vaccine'],
    ['90472', 'Immunization administration, additional vaccine'],
    ['96372', 'Therapeutic injection, subcutaneous or intramuscular'],
    ['99000', 'Specimen handling'],
  ];
  
  for (const [code, description] of commonCodes) {
    const { section, category } = inferSectionFromCode(code);
    entries.set(code, {
      cpt: code,
      shortLabel: description.length > 40 ? description.slice(0, 37) + '...' : description,
      longDescription: description,
      section,
      category,
    });
  }
  
  return entries;
}

/**
 * Load the CPT master table
 */
export async function loadCptMaster(): Promise<CptMasterEntry[]> {
  if (cptMasterCache) {
    return Array.from(cptMasterCache.values());
  }

  if (cptMasterPromise) {
    const map = await cptMasterPromise;
    return Array.from(map.values());
  }

  cptMasterPromise = loadFromStaticData();
  cptMasterCache = await cptMasterPromise;
  
  console.log(`Loaded ${cptMasterCache.size} CPT master entries`);
  return Array.from(cptMasterCache.values());
}

/**
 * Get a single CPT master entry by code
 */
export async function getCptMasterEntry(cpt: string): Promise<CptMasterEntry | null> {
  await loadCptMaster();
  
  if (!cptMasterCache) return null;
  
  // Normalize CPT code
  const normalizedCpt = cpt.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  
  // Try exact match first
  if (cptMasterCache.has(normalizedCpt)) {
    return cptMasterCache.get(normalizedCpt) ?? null;
  }
  
  // Try with padding
  const paddedCpt = normalizedCpt.padStart(5, '0');
  if (cptMasterCache.has(paddedCpt)) {
    return cptMasterCache.get(paddedCpt) ?? null;
  }
  
  // Generate entry on-the-fly for unknown codes
  const { section, category } = inferSectionFromCode(normalizedCpt);
  return {
    cpt: normalizedCpt,
    shortLabel: `Code ${normalizedCpt}`,
    longDescription: `Medical procedure code ${normalizedCpt}`,
    section,
    category,
  };
}
