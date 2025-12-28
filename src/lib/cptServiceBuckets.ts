/**
 * CPT Service Type Classification
 */

import { getCptMasterEntry } from './cptMaster';

export type ServiceType =
  | 'E&M'
  | 'Anesthesia'
  | 'Surgery'
  | 'Imaging'
  | 'LabPath'
  | 'MedicineOther'
  | 'Other';

/**
 * Classify a CPT code into a service type bucket
 */
export async function classifyServiceType(cpt: string): Promise<ServiceType> {
  // First try to get from master
  const master = await getCptMasterEntry(cpt);
  
  if (master?.category) {
    const cat = master.category.toLowerCase();
    if (cat.includes('e&m') || cat.includes('evaluation')) return 'E&M';
    if (cat.includes('anesthesia')) return 'Anesthesia';
    if (cat.includes('surgery')) return 'Surgery';
    if (cat.includes('imaging') || cat.includes('radiology')) return 'Imaging';
    if (cat.includes('lab') || cat.includes('pathology')) return 'LabPath';
    if (cat.includes('medicine')) return 'MedicineOther';
  }

  // Fallback to numeric range classification
  const numeric = parseInt(cpt.replace(/[^0-9]/g, ''), 10);
  
  if (!Number.isFinite(numeric)) return 'Other';
  
  // Standard CPT code ranges
  if (numeric >= 99202 && numeric <= 99499) return 'E&M';
  if (numeric >= 10021 && numeric <= 69990) return 'Surgery';
  if (numeric >= 70010 && numeric <= 79999) return 'Imaging';
  if (numeric >= 80047 && numeric <= 89398) return 'LabPath';
  if ((numeric >= 1 && numeric <= 1999) || (numeric >= 99100 && numeric <= 99140)) return 'Anesthesia';
  if ((numeric >= 90281 && numeric <= 99199) || (numeric >= 99500 && numeric <= 99607)) return 'MedicineOther';
  
  return 'Other';
}

/**
 * Get a user-friendly label for a service type
 */
export function getServiceTypeLabel(serviceType: ServiceType): string {
  switch (serviceType) {
    case 'E&M': return 'Office/Hospital Visits';
    case 'Anesthesia': return 'Anesthesia Services';
    case 'Surgery': return 'Surgical Procedures';
    case 'Imaging': return 'Imaging & Radiology';
    case 'LabPath': return 'Lab & Pathology';
    case 'MedicineOther': return 'Medicine & Other Services';
    case 'Other': return 'Other Services';
    default: return 'Other';
  }
}
