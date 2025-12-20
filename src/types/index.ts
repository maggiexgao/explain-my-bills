export type Language = 'en' | 'es' | 'zh' | 'ar' | 'hi';

export type DocumentType = 'bill' | 'eob' | 'chart' | 'denial' | 'unknown';

export interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  type: 'pdf' | 'image';
}

export interface AnalysisSection {
  id: string;
  title: string;
  content: string;
  highlights?: BoundingBox[];
}

export interface BoundingBox {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  referenceId: string;
}

// CPT Code with enhanced structure
export interface CPTCode {
  code: string;
  shortLabel: string;
  explanation: string;
  category: 'evaluation' | 'lab' | 'radiology' | 'surgery' | 'medicine' | 'other';
  whereUsed: string;
  complexityLevel: 'simple' | 'moderate' | 'complex';
  commonQuestions: {
    question: string;
    answer: string;
    callWho: 'billing' | 'insurance' | 'either';
  }[];
}

export interface MedicalCode {
  code: string;
  type: 'CPT' | 'ICD' | 'HCPCS';
  description: string;
  typicalPurpose: string;
  commonQuestions: string[];
}

export interface ChargeItem {
  id: string;
  description: string;
  amount: number;
  explanation: string;
  boundingBox?: BoundingBox;
}

// Visit walkthrough step
export interface VisitStep {
  order: number;
  description: string;
  relatedCodes?: string[];
}

// Common questions about codes
export interface CodeQuestion {
  cptCode: string;
  question: string;
  answer: string;
  suggestCall: 'billing' | 'insurance' | 'either';
}

// EOB-specific data
export interface EOBData {
  claimNumber?: string;
  processedDate?: string;
  billedAmount: number;
  allowedAmount: number;
  insurancePaid: number;
  patientResponsibility: number;
  deductibleApplied: number;
  coinsurance: number;
  copay: number;
  discrepancies: {
    type: 'overbilled' | 'underpaid' | 'mismatch' | 'duplicate';
    description: string;
    billedValue?: number;
    eobValue?: number;
  }[];
}

// Billing education content
export interface BillingEducation {
  billedVsAllowed: string;
  deductibleExplanation: string;
  copayCoinsurance: string;
  eobSummary?: string; // Enhanced when EOB present
}

// State-specific financial help
export interface StateFinancialHelp {
  state: string;
  medicaidInfo: {
    description: string;
    eligibilityLink: string;
  };
  chipInfo?: {
    description: string;
    eligibilityLink: string;
  };
  debtProtections: string[];
  reliefPrograms: {
    name: string;
    description: string;
    link?: string;
  }[];
}

// Hospital/provider assistance
export interface ProviderAssistance {
  providerName: string;
  providerType: 'hospital' | 'clinic' | 'lab' | 'other';
  charityCareSummary: string;
  financialAssistanceLink?: string;
  eligibilityNotes: string;
}

// Red flags / issues to review
export interface BillingIssue {
  type: 'duplicate' | 'upcoding' | 'mismatch' | 'missing_modifier' | 'eob_discrepancy';
  title: string;
  description: string;
  suggestedQuestion: string;
  severity: 'info' | 'warning' | 'important';
  relatedCodes?: string[];
}

// Financial assistance opportunity
export interface FinancialOpportunity {
  title: string;
  description: string;
  eligibilityHint: string;
  effortLevel: 'quick_call' | 'short_form' | 'detailed_application';
  link?: string;
}

// Call/email templates
export interface ContactTemplate {
  target: 'billing' | 'insurance';
  purpose: string;
  template: string;
  whenToUse: string;
}

// Main analysis result - restructured
export interface AnalysisResult {
  // Document basics
  documentType: DocumentType;
  issuer: string;
  dateOfService: string;
  documentPurpose: string;
  
  // Legacy fields for backward compatibility
  charges: ChargeItem[];
  medicalCodes: MedicalCode[];
  faqs: { question: string; answer: string }[];
  possibleIssues: { issue: string; explanation: string }[];
  financialAssistance: string[];
  patientRights: string[];
  actionPlan: { step: number; action: string; description: string }[];

  // === SECTION 1: EXPLAINER ===
  cptCodes: CPTCode[];
  visitWalkthrough: VisitStep[];
  codeQuestions: CodeQuestion[];

  // === SECTION 2: BILLING & NEXT STEPS ===
  // A. Things to know
  billingEducation: BillingEducation;
  stateHelp: StateFinancialHelp;
  providerAssistance: ProviderAssistance;
  debtAndCreditInfo: string[];

  // B. Next steps
  billingIssues: BillingIssue[];
  financialOpportunities: FinancialOpportunity[];
  billingTemplates: ContactTemplate[];
  insuranceTemplates: ContactTemplate[];

  // EOB data (optional - present when EOB uploaded)
  eobData?: EOBData;
}

export interface AppState {
  currentStep: 'upload' | 'analysis';
  uploadedFile: UploadedFile | null;
  eobFile: UploadedFile | null; // Optional EOB
  selectedState: string;
  selectedLanguage: Language;
  analysisResult: AnalysisResult | null;
  isAnalyzing: boolean;
  activeHighlight: string | null;
}

export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
];

export const LANGUAGES: { value: Language; label: string; nativeLabel: string }[] = [
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'es', label: 'Spanish', nativeLabel: 'Español' },
  { value: 'zh', label: 'Chinese', nativeLabel: '中文' },
  { value: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
  { value: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
];
