/**
 * CPT Service Type Classification
 * Classifies CPT codes into service buckets for analysis
 */

export type ServiceType = 
  | 'E&M'
  | 'Anesthesia'
  | 'Surgery'
  | 'Imaging'
  | 'LabPath'
  | 'MedicineOther'
  | 'Other';

export interface ServiceTypeInfo {
  type: ServiceType;
  label: string;
  description: string;
}

export const SERVICE_TYPE_INFO: Record<ServiceType, ServiceTypeInfo> = {
  'E&M': {
    type: 'E&M',
    label: 'Evaluation & Management',
    description: 'Office visits, consultations, hospital visits',
  },
  'Anesthesia': {
    type: 'Anesthesia',
    label: 'Anesthesia',
    description: 'Anesthesia services for procedures',
  },
  'Surgery': {
    type: 'Surgery',
    label: 'Surgery',
    description: 'Surgical procedures',
  },
  'Imaging': {
    type: 'Imaging',
    label: 'Radiology/Imaging',
    description: 'X-rays, CT scans, MRIs, ultrasounds',
  },
  'LabPath': {
    type: 'LabPath',
    label: 'Lab & Pathology',
    description: 'Laboratory tests and pathology services',
  },
  'MedicineOther': {
    type: 'MedicineOther',
    label: 'Medicine/Other Services',
    description: 'Other medical services (therapy, injections, etc.)',
  },
  'Other': {
    type: 'Other',
    label: 'Other',
    description: 'Other services not classified elsewhere',
  },
};

/**
 * Classify a CPT code into a service type
 * Uses AMA CPT code ranges as primary classification
 */
export function classifyServiceType(cpt: string): ServiceType {
  // Normalize CPT code - extract numeric portion
  const numericMatch = cpt.match(/^(\d+)/);
  if (!numericMatch) {
    // Handle HCPCS codes (start with letters)
    if (cpt.startsWith('G') || cpt.startsWith('Q')) {
      // Many G codes are E&M related, some are imaging
      if (cpt.startsWith('G0463') || cpt.startsWith('G0402') || cpt.startsWith('G0438') || cpt.startsWith('G0439')) {
        return 'E&M';
      }
      return 'MedicineOther';
    }
    return 'Other';
  }
  
  const code = parseInt(numericMatch[1], 10);
  
  // Anesthesia: 00100-01999
  if (code >= 100 && code <= 1999) {
    return 'Anesthesia';
  }
  
  // Surgery: 10004-69990
  if (code >= 10004 && code <= 69990) {
    return 'Surgery';
  }
  
  // Radiology/Imaging: 70010-79999
  if (code >= 70010 && code <= 79999) {
    return 'Imaging';
  }
  
  // Pathology & Laboratory: 80047-89398
  if (code >= 80047 && code <= 89398) {
    return 'LabPath';
  }
  
  // Medicine (excluding E&M): 90281-99199, 99500-99607
  if ((code >= 90281 && code <= 99199) || (code >= 99500 && code <= 99607)) {
    return 'MedicineOther';
  }
  
  // Evaluation & Management: 99202-99499
  if (code >= 99202 && code <= 99499) {
    return 'E&M';
  }
  
  // Category I codes 0001U-0999U (lab tests)
  if (cpt.endsWith('U') || cpt.endsWith('T') || cpt.endsWith('M')) {
    return 'LabPath';
  }
  
  return 'Other';
}

/**
 * Get user-friendly label for service type
 */
export function getServiceTypeLabel(serviceType: ServiceType): string {
  return SERVICE_TYPE_INFO[serviceType]?.label || serviceType;
}
