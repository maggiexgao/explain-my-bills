export type Language =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "pt-BR"
  | "pt-PT"
  | "zh-Hans"
  | "zh-Hant"
  | "ja"
  | "ko"
  | "hi"
  | "bn"
  | "ur"
  | "ar"
  | "tr"
  | "ru"
  | "uk"
  | "pl"
  | "nl"
  | "sv"
  | "no"
  | "da"
  | "fi"
  | "el"
  | "cs"
  | "hu"
  | "ro"
  | "th"
  | "vi"
  | "id"
  | "tl"
  | "he"
  | "sw"
  | "am"
  | "fa"
  | "ms"
  | "ta"
  | "pa"
  | "mr";

export type DocumentType = "bill" | "eob" | "chart" | "denial" | "unknown";

export type AnalysisMode = "bill" | "medical_document";

// ============= Phase 1: Structured Totals & Comparison Guardrails =============

export type TotalsConfidence = "high" | "medium" | "low";
export type TotalsSource = "ai" | "derived_line_items" | "user_input" | "document_label";

/**
 * A detected total with evidence and confidence.
 * Used for totalCharges, patientResponsibility, amountDue, etc.
 */
export interface DetectedTotal {
  value: number;
  confidence: TotalsConfidence;
  evidence: string; // Short excerpt from doc around the number
  label: string; // e.g., "Total Charges", "Balance Due"
  source: TotalsSource;
}

/**
 * Structured totals extracted from a document.
 * Separates pre-insurance charges from patient balance/amount due.
 */
export interface Totals {
  totalCharges?: DetectedTotal | null; // Pre-insurance "Total Charges", "Total Billed Charges"
  totalPaymentsAndAdjustments?: DetectedTotal | null; // Total payments + contractual adjustments if present
  patientResponsibility?: DetectedTotal | null; // "Patient Responsibility" specifically
  amountDue?: DetectedTotal | null; // "Amount Due", "Balance Due", "You May Owe"
  insurancePaid?: DetectedTotal | null; // Insurance payment amount
  lineItemsSum?: number | null; // Sum of extracted line item billed amounts
  notes: string[]; // Extraction notes and caveats
}

// Legacy alias for backward compatibility
export type ExtractedTotalValue = DetectedTotal;
export type ExtractedTotals = Totals;

/**
 * Line item with enhanced billing information.
 */
export interface LineItem {
  code?: string | null; // CPT/HCPCS/revenue code
  codeType?: "cpt" | "hcpcs" | "revenue" | "unknown";
  description?: string | null;
  billedAmount?: number | null;
  billedAmountConfidence?: TotalsConfidence;
  billedEvidence?: string; // Excerpt containing the billed amount for this line
  units?: number | null;
  date?: string | null;
}

export type ComparisonTotalType = "totalCharges" | "patientResponsibility" | "amountDue" | "matchedLineItemsOnly";

export interface ComparisonGuardrails {
  canComputeMultiple: boolean;
  comparisonTotalType?: ComparisonTotalType;
  comparisonTotalValue?: number;
  comparisonTotalLabel?: string;
  comparisonTotalExplanation?: string;
  coverage: {
    extractedLineItems: number;
    matchedLineItems: number;
    matchedCoveragePct: number;
  };
  scopeWarnings: string[];
  multipleIsReliable: boolean;
  limitedComparability: boolean; // True when comparing patient balance (not charges)
}

export type MedicalDocumentType =
  | "after_visit_summary"
  | "test_results"
  | "clinical_note"
  | "prescription"
  | "imaging_report"
  | "mixed_other";

// Medical document analysis result
export interface MedicalDocumentResult {
  documentType: MedicalDocumentType;
  documentTypeLabel: string;

  // Pond's Analysis - top-level summary
  pondsAnalysis?: {
    keyTakeaways: string[];
    contextParagraph: string;
  };

  // Document Overview
  overview: {
    summary: string;
    mainPurpose: string;
    overallAssessment: string;
  };

  // Line-by-Line Plain Language
  lineByLine: {
    originalText: string;
    plainLanguage: string;
  }[];

  // Definitions to Know
  definitions: {
    term: string;
    definition: string;
  }[];

  // Commonly Asked Questions (Reddit-informed)
  commonlyAskedQuestions: {
    question: string;
    answer: string;
  }[];

  // Questions to Ask Your Provider
  providerQuestions: {
    question: string;
    questionEnglish?: string;
  }[];

  // Links to Relevant Resources
  resources: {
    title: string;
    description: string;
    url: string;
    source: string;
  }[];

  // Next Steps & Tracking
  nextSteps: {
    step: string;
    details: string;
  }[];
}

export interface UploadedFile {
  id: string;
  file: File;
  preview: string; // Original file preview (blob URL)
  previewUrl: string; // Converted/displayable preview URL (for HEIC->JPEG conversion)
  originalUrl: string; // Original file URL for download
  type: "pdf" | "image";
  isConverted?: boolean; // True if file was converted (e.g., HEIC to JPEG)
  conversionError?: string; // Error message if conversion failed
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
  category: "evaluation" | "lab" | "radiology" | "surgery" | "medicine" | "other";
  whereUsed: string;
  complexityLevel: "simple" | "moderate" | "complex";
  commonQuestions: {
    question: string;
    answer: string;
    callWho: "billing" | "insurance" | "either";
  }[];
}

export interface MedicalCode {
  code: string;
  type: "CPT" | "ICD" | "HCPCS";
  description: string;
  typicalPurpose: string;
  commonQuestions: string[];
}

export interface ChargeItem {
  id: string;
  code?: string; // ✅ CPT/HCPCS/Revenue code from backend
  description: string;
  amount: number;
  billed?: number; // ✅ AI sometimes returns this instead of amount
  billedAmount?: number; // ✅ Alternative field name
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
  suggestCall: "billing" | "insurance" | "either";
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
    type: "overbilled" | "underpaid" | "mismatch" | "duplicate";
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
  eobSummary?: string;
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
  providerType: "hospital" | "clinic" | "lab" | "other";
  charityCareSummary: string;
  financialAssistanceLink?: string;
  eligibilityNotes: string;
  // New specific fields
  incomeThresholds?: string[];
  requiredDocuments?: string[];
  applicationLink?: string;
  collectionPolicies?: string[];
}

// Red flags / issues to review - now with severity levels for callouts
export interface BillingIssue {
  type:
    | "duplicate"
    | "upcoding"
    | "mismatch"
    | "missing_modifier"
    | "eob_discrepancy"
    | "potential_error"
    | "needs_attention";
  title: string;
  description: string;
  suggestedQuestion: string;
  severity: "error" | "warning" | "info";
  relatedCodes?: string[];
  relatedAmounts?: { billed?: number; eob?: number };
}

// Financial assistance opportunity
export interface FinancialOpportunity {
  title: string;
  description: string;
  eligibilityHint: string;
  effortLevel: "quick_call" | "short_form" | "detailed_application";
  link?: string;
}

// Provider contact information extracted from bill
export interface ProviderContactInfo {
  providerName: string;
  billingPhone?: string;
  billingEmail?: string;
  mailingAddress?: string;
  memberServicesPhone?: string; // For insurance
  memberServicesEmail?: string; // For insurance
  insurerName?: string;
}

// Call/email templates
export interface ContactTemplate {
  target: "billing" | "insurance";
  purpose: string;
  template: string;
  templateEnglish?: string; // English version for bilingual display
  whenToUse: string;
  contactInfo?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  // Auto-filled data from the bill/EOB
  filledData?: {
    claimNumber?: string;
    dateOfService?: string;
    providerName?: string;
    billedAmount?: number;
    eobPatientResponsibility?: number;
    discrepancyAmount?: number;
  };
}

// Action step for Next Steps section
export interface ActionStep {
  order: number;
  action: string;
  details: string;
  relatedIssue?: string;
}

// Guided Dispute Package - paid add-on
export interface DisputePackageEligibility {
  eligible: boolean;
  reasons: string[];
  estimatedBalance: number;
  hasErrors: boolean;
  hasDenials: boolean;
  hasNoSurprisesActScenario: boolean;
}

export interface DisputePackage {
  billingLetter: string;
  insurerLetter: string;
  noSurprisesLetter?: string;
  attachmentsChecklist: string[];
  timeline: {
    step: number;
    action: string;
    deadline: string;
    followUp: string;
  }[];
  sendingInstructions: {
    method: "portal" | "email" | "fax" | "mail";
    details: string;
  }[];
  portalCopyPasteText?: string;
}

// Referral/Affiliate services
export type ReferralServiceType = "nonprofit_advocate" | "legal_aid" | "negotiation_firm" | "telehealth" | "rx_savings";

export interface ReferralService {
  id: string;
  type: ReferralServiceType;
  name: string;
  description: string;
  url: string;
  isPaid: boolean;
  isAffiliate: boolean;
  disclaimer: string;
  showWhen: {
    highBalance?: boolean;
    complexDispute?: boolean;
    denialPresent?: boolean;
    noSurprisesAct?: boolean;
  };
}

export interface ReferralContext {
  showReferrals: boolean;
  balanceAmount: number;
  isHighBalance: boolean;
  hasComplexDispute: boolean;
  hasDenial: boolean;
  hasNoSurprisesActScenario: boolean;
  recommendedServices: ReferralService[];
}

// Suggested CPT code from reverse search
export interface SuggestedCptCandidate {
  cpt: string;
  shortLabel: string;
  explanation: string;
  category: string;
  score: number;
  relevance: "high" | "medium" | "low";
}

export interface SuggestedCpt {
  sourceDescription: string;
  candidates: SuggestedCptCandidate[];
}

// Pond At a Glance status
export type PondStatus = "looks_standard" | "worth_reviewing" | "likely_issues";

// Pond "At a Glance" section
export interface AtAGlance {
  visitSummary: string;
  totalBilled?: number;
  amountYouMayOwe?: number;
  benchmarkTotal?: number; // CMS benchmark reference total for comparison
  status: PondStatus;
  statusExplanation: string;
}

// Pond "Things Worth Reviewing" item
export interface ReviewItem {
  whatToReview: string;
  whyItMatters: string;
  issueType: "error" | "negotiable" | "missing_info" | "confirmation";
}

// Pond "How This Bill Could Be Lowered" opportunity
export interface SavingsOpportunity {
  whatMightBeReduced: string;
  whyNegotiable: string;
  additionalInfoNeeded?: string;
  savingsContext?: string;
}

// Pond "What to Say Next" scripts
export interface ConversationScripts {
  firstCallScript: string;
  ifTheyPushBack: string;
  whoToAskFor: string;
}

// Pond "What These Charges Mean" item
export interface ChargeMeaning {
  cptCode?: string;
  procedureName: string;
  explanation: string;
  commonBillingIssues?: string[];
  isGeneral: boolean;
}

// Pond "Is This Negotiable?" rating
export type NegotiabilityLevel = "highly_negotiable" | "sometimes_negotiable" | "rarely_negotiable" | "generally_fixed";

export interface NegotiabilityItem {
  chargeOrCategory: string;
  level: NegotiabilityLevel;
  reason: string;
}

// Pond "Price Context" section
export interface PriceContext {
  hasBenchmarks: boolean;
  comparisons: {
    service: string;
    billedAmount?: number;
    typicalRange?: string;
    notes?: string;
  }[];
  fallbackMessage?: string;
}

// Pond "Next Steps" item
export interface PondNextStep {
  step: string;
  isUrgent?: boolean;
}

// Main analysis result - restructured for Pond 9-section format
export interface AnalysisResult {
  // Document basics
  documentType: DocumentType;
  issuer: string;
  dateOfService: string;
  documentPurpose: string;

  // === POND SECTIONS ===

  // Section 1: At a Glance
  atAGlance: AtAGlance;

  // Section 2: Things Worth Reviewing
  thingsWorthReviewing: ReviewItem[];
  reviewSectionNote?: string; // "Nothing stands out" message or EOB suggestion

  // Section 3: How This Bill Could Be Lowered
  savingsOpportunities: SavingsOpportunity[];

  // Section 4: What to Say Next
  conversationScripts: ConversationScripts;

  // Section 5: What These Charges Mean
  chargeMeanings: ChargeMeaning[];

  // Section 6: Is This Negotiable?
  negotiability: NegotiabilityItem[];

  // Section 7: Price Context
  priceContext: PriceContext;

  // Section 8: Next Steps
  pondNextSteps: PondNextStep[];

  // Section 9: Closing Reassurance
  closingReassurance: string;

  // === LEGACY FIELDS (kept for backward compatibility) ===
  charges: ChargeItem[];
  medicalCodes: MedicalCode[];
  faqs: { question: string; answer: string }[];
  possibleIssues: { issue: string; explanation: string }[];
  financialAssistance: string[];
  patientRights: string[];
  actionPlan: { step: number; action: string; description: string }[];
  potentialErrors: BillingIssue[];
  needsAttention: BillingIssue[];
  cptCodes: CPTCode[];
  suggestedCpts?: SuggestedCpt[];
  visitWalkthrough: VisitStep[];
  codeQuestions: CodeQuestion[];
  billingEducation: BillingEducation;
  stateHelp: StateFinancialHelp;
  providerAssistance: ProviderAssistance;
  debtAndCreditInfo: string[];
  financialOpportunities: FinancialOpportunity[];
  providerContactInfo: ProviderContactInfo;
  actionSteps: ActionStep[];
  billingTemplates: ContactTemplate[];
  insuranceTemplates: ContactTemplate[];
  whenToSeekHelp: string[];
  billingIssues: BillingIssue[];
  eobData?: EOBData;
  billTotal?: number;
  disputePackageEligibility?: DisputePackageEligibility;
  referralContext?: ReferralContext;
}

export type CareSetting = "office" | "facility";

export interface AppState {
  currentStep: "upload" | "analysis";
  analysisMode: AnalysisMode;
  uploadedFile: UploadedFile | null;
  eobFile: UploadedFile | null;
  selectedState: string;
  selectedLanguage: Language;
  zipCode: string;
  careSetting: CareSetting;
  analysisResult: AnalysisResult | null;
  medicalDocResult: MedicalDocumentResult | null;
  isAnalyzing: boolean;
  activeHighlight: string | null;
}

export const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
];

export const LANGUAGES: { value: Language; label: string; nativeLabel: string }[] = [
  { value: "en", label: "English", nativeLabel: "English" },
  { value: "es", label: "Spanish", nativeLabel: "Español" },
  { value: "fr", label: "French", nativeLabel: "Français" },
  { value: "de", label: "German", nativeLabel: "Deutsch" },
  { value: "it", label: "Italian", nativeLabel: "Italiano" },
  { value: "pt-BR", label: "Portuguese (Brazil)", nativeLabel: "Português (Brasil)" },
  { value: "pt-PT", label: "Portuguese (Portugal)", nativeLabel: "Português (Portugal)" },
  { value: "zh-Hans", label: "Chinese (Simplified)", nativeLabel: "简体中文" },
  { value: "zh-Hant", label: "Chinese (Traditional)", nativeLabel: "繁體中文" },
  { value: "ja", label: "Japanese", nativeLabel: "日本語" },
  { value: "ko", label: "Korean", nativeLabel: "한국어" },
  { value: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
  { value: "bn", label: "Bengali", nativeLabel: "বাংলা" },
  { value: "ur", label: "Urdu", nativeLabel: "اردو" },
  { value: "ar", label: "Arabic", nativeLabel: "العربية" },
  { value: "tr", label: "Turkish", nativeLabel: "Türkçe" },
  { value: "ru", label: "Russian", nativeLabel: "Русский" },
  { value: "uk", label: "Ukrainian", nativeLabel: "Українська" },
  { value: "pl", label: "Polish", nativeLabel: "Polski" },
  { value: "nl", label: "Dutch", nativeLabel: "Nederlands" },
  { value: "sv", label: "Swedish", nativeLabel: "Svenska" },
  { value: "no", label: "Norwegian", nativeLabel: "Norsk" },
  { value: "da", label: "Danish", nativeLabel: "Dansk" },
  { value: "fi", label: "Finnish", nativeLabel: "Suomi" },
  { value: "el", label: "Greek", nativeLabel: "Ελληνικά" },
  { value: "cs", label: "Czech", nativeLabel: "Čeština" },
  { value: "hu", label: "Hungarian", nativeLabel: "Magyar" },
  { value: "ro", label: "Romanian", nativeLabel: "Română" },
  { value: "th", label: "Thai", nativeLabel: "ไทย" },
  { value: "vi", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  { value: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  { value: "tl", label: "Filipino / Tagalog", nativeLabel: "Filipino" },
  { value: "he", label: "Hebrew", nativeLabel: "עברית" },
  { value: "sw", label: "Swahili", nativeLabel: "Kiswahili" },
  { value: "am", label: "Amharic", nativeLabel: "አማርኛ" },
  { value: "fa", label: "Persian / Farsi", nativeLabel: "فارسی" },
  { value: "ms", label: "Malay", nativeLabel: "Bahasa Melayu" },
  { value: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { value: "pa", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
  { value: "mr", label: "Marathi", nativeLabel: "मराठी" },
];
