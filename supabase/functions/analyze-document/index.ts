import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========== MEDICAL BILL ANALYSIS PROMPT ==========
const BILL_SYSTEM_PROMPT = `You are a medical bill analysis expert. Extract data and provide helpful analysis.

## ISSUER/PROVIDER EXTRACTION (CRITICAL)

You MUST extract the hospital or provider name from the bill. Look for:
- Hospital/clinic name in the header or letterhead
- "Statement from:" or "Bill from:" labels
- Provider name at the top of the document
- Examples: "Atrium Health", "Mercy Hospital", "Kaiser Permanente"
Set this in the "issuer" field. NEVER leave issuer empty.

## DATE OF SERVICE EXTRACTION

Extract the date of service from the bill. Look for:
- "Date of Service:", "Service Date:", "Visit Date:"
- Date ranges if multiple services
Set this in the "dateOfService" field.

## BILL FORMAT DETECTION

Look at column headers:
- If "Code" column has 4-digit codes (0450) AND separate "CPT/HCPCS" column has 5-digit codes (99284), USE the CPT/HCPCS column
- If only one code column with 5-digit codes, use that
- Revenue codes (0110, 0450) are facility billing codes - prefer CPT codes when available

## EXTRACTION TASK

Extract ALL line items. For each charge, prefer the CPT/HCPCS code (5 digits like 99284, or letter+4 like J2405) over the revenue code (4 digits like 0450).

## REQUIRED OUTPUT FORMAT

Return this EXACT JSON structure:

{
  "billFormat": "rev_plus_cpt",
  "issuer": "Atrium Health",
  "dateOfService": "01/15/2024",
  "charges": [
    {
      "code": "99284",
      "codeType": "cpt",
      "revenueCode": "0450",
      "description": "Emergency Room Visit Level 4",
      "amount": 2579.90,
      "units": 1
    }
  ],
  "extractedTotals": {
    "totalCharges": { "value": 3954.75, "evidence": "Total Charges: $3,954.75" },
    "lineItemsSum": 3954.75
  },
  "atAGlance": {
    "visitSummary": "Emergency room visit with lab tests and IV therapy",
    "totalBilled": 3954.75,
    "amountYouMayOwe": 2126.67,
    "status": "worth_reviewing",
    "statusExplanation": "Hospital emergency room bills often have room for negotiation."
  },
  "thingsWorthReviewing": [
    {
      "whatToReview": "Emergency Room charge of $2,579.90",
      "whyItMatters": "ER visits at Level 4 are typically $1,500-2,000 elsewhere. Worth questioning.",
      "issueType": "negotiable"
    },
    {
      "whatToReview": "Lab tests totaling $700+",
      "whyItMatters": "Hospital lab fees are often 3-5x higher than independent labs.",
      "issueType": "negotiable"
    }
  ],
  "savingsOpportunities": [
    {
      "whatMightBeReduced": "Request self-pay discount (20-50% off)",
      "whyNegotiable": "Most hospitals offer discounts if you ask. Call billing and mention you're paying out of pocket.",
      "savingsContext": "Could save $800-2000"
    },
    {
      "whatMightBeReduced": "Ask about financial assistance",
      "whyNegotiable": "Nonprofit hospitals are required to offer charity care programs.",
      "additionalInfoNeeded": "Your household income"
    },
    {
      "whatMightBeReduced": "Negotiate a payment plan",
      "whyNegotiable": "Hospitals often accept reduced lump-sum payments or 0% interest payment plans.",
      "savingsContext": "Avoid collections"
    }
  ],
  "conversationScripts": {
    "firstCallScript": "Hi, I'm calling about a bill for [patient name], account [number]. I have questions about some charges, particularly the emergency room fee. Can you help me understand the breakdown?",
    "ifTheyPushBack": "I understand these are your standard rates. Are there any self-pay discounts, financial assistance programs, or payment plans available?",
    "whoToAskFor": "Patient Financial Services or a Billing Supervisor"
  },
  "pondNextSteps": [
    { "step": "Request an itemized bill if not received", "details": "Get a detailed breakdown of all charges to verify accuracy", "isUrgent": false },
    { "step": "Call billing to ask about discounts", "details": "Many hospitals offer 20-50% off for prompt payment or self-pay", "isUrgent": false },
    { "step": "Review each charge against your records", "details": "Make sure you received all billed services", "isUrgent": false }
  ],
  "priceContext": {
    "hasBenchmarks": false,
    "comparisons": [],
    "fallbackMessage": "Medicare comparison will be calculated based on your location."
  },
  "closingReassurance": "Hospital bills are often negotiable. Many patients reduce their bills by 20-50% simply by asking. You have the right to question any charge."
}

## FIELD REQUIREMENTS - VERY IMPORTANT

1. **thingsWorthReviewing** - Array of objects with EXACTLY these field names:
   - "whatToReview": string (the specific charge or issue to look at)
   - "whyItMatters": string (why the patient should care about this)
   - "issueType": one of "error", "negotiable", "missing_info", "confirmation"

2. **savingsOpportunities** - Array of objects with EXACTLY these field names:
   - "whatMightBeReduced": string (what could be lowered)
   - "whyNegotiable": string (explanation of why it's negotiable)
   - "savingsContext": string (optional - potential dollar savings)
   - "additionalInfoNeeded": string (optional - what info patient needs)

3. **pondNextSteps** - Array of objects with EXACTLY these field names:
   - "step": string (the action to take)
   - "isUrgent": boolean

4. **charges** - Array with:
   - "code": string (prefer 5-digit CPT over 4-digit revenue code)
   - "amount": NUMBER (not a string, e.g., 2579.90 not "$2,579.90")

5. All dollar amounts must be NUMBERS without $ signs or commas.

Generate 2-4 items for thingsWorthReviewing and 2-4 items for savingsOpportunities based on the bill contents.`;

// ========== MEDICAL DOCUMENT ANALYSIS PROMPT ==========
const MEDICAL_DOC_SYSTEM_PROMPT = `You are a medical document analysis expert who explains healthcare documents in simple, plain language. Your job is to help patients understand their medical documents.

## DOCUMENT TYPE DETECTION

First, classify this document as ONE of these types:
- "test_results" - Lab results, blood tests, pathology reports, biopsy results
- "after_visit_summary" - Post-visit summaries, discharge instructions
- "clinical_note" - Doctor's notes, progress notes, consultation notes
- "prescription" - Medication prescriptions or orders
- "imaging_report" - X-ray, MRI, CT scan, ultrasound reports
- "mixed_other" - Documents that don't fit the above categories

## REQUIRED OUTPUT FORMAT

You MUST return this EXACT JSON structure with ALL sections populated. NEVER return empty arrays.

{
  "documentType": "test_results",
  "documentTypeLabel": "Pathology Report",
  
  "pondsAnalysis": {
    "keyTakeaways": [
      "**Your biopsy results are in** - this report describes what the pathologist found when examining your tissue sample.",
      "**The diagnosis is clearly stated** - papillary thyroid carcinoma (a type of thyroid cancer) was found.",
      "**Good news about the margins** - the edges of the removed tissue are cancer-free, meaning the surgeon got all the visible cancer.",
      "*Next steps* - you'll need to follow up with your endocrinologist to discuss any additional treatment."
    ],
    "contextParagraph": "This pathology report is from the laboratory analysis of tissue removed during your thyroidectomy surgery. While finding cancer in a pathology report can be alarming, papillary thyroid cancer is one of the most treatable forms of cancer with excellent outcomes when caught early. The key finding here is that your margins are negative, which means the surgeon was able to remove the entire tumor with a rim of healthy tissue around it."
  },
  
  "overview": {
    "summary": "This is a pathology report describing the analysis of thyroid tissue removed during surgery. The pathologist examined the tissue both visually and under a microscope to determine if any abnormalities or cancer cells were present.",
    "mainPurpose": "To provide a definitive diagnosis based on laboratory examination of your tissue sample",
    "overallAssessment": "The report confirms a diagnosis of papillary thyroid carcinoma. While this is a cancer diagnosis, papillary thyroid cancer has one of the highest cure rates of all cancers, especially when caught early and completely removed. Your negative margins indicate the surgery was successful in removing the visible tumor."
  },
  
  "lineByLine": [
    {
      "originalText": "TOTAL THYROIDECTOMY WITH LEFT CERVICAL NODE",
      "plainLanguage": "This describes the surgery that was performed: your entire thyroid gland was removed, along with a lymph node from the left side of your neck to check if cancer had spread."
    },
    {
      "originalText": "Papillary thyroid carcinoma, classic variant, involving isthmus",
      "plainLanguage": "This is the diagnosis - you have papillary thyroid cancer of the most common type, located in the isthmus (the narrow band connecting the two lobes of your thyroid)."
    },
    {
      "originalText": "Margins are negative",
      "plainLanguage": "Good news: the edges of the removed tissue do not contain cancer cells. This means the surgeon successfully removed all visible cancer with some healthy tissue around it."
    },
    {
      "originalText": "Lymph node, left cervical: No evidence of metastatic carcinoma (0/1)",
      "plainLanguage": "The lymph node that was removed showed no signs of cancer spread. Zero out of one lymph node examined contained cancer cells - this is a positive finding."
    }
  ],
  
  "definitions": [
    {
      "term": "Papillary carcinoma",
      "definition": "The most common type of thyroid cancer, accounting for about 80% of all thyroid cancers. It typically grows slowly and has an excellent prognosis when treated."
    },
    {
      "term": "Thyroidectomy",
      "definition": "Surgical removal of all or part of the thyroid gland. 'Total thyroidectomy' means the entire gland was removed."
    },
    {
      "term": "Negative margins",
      "definition": "The outer edges of the removed tissue are free of cancer cells. This indicates the surgeon removed the entire tumor with a buffer zone of healthy tissue."
    },
    {
      "term": "Isthmus",
      "definition": "The narrow strip of thyroid tissue that connects the left and right lobes of the thyroid gland, located at the front of the neck."
    },
    {
      "term": "Metastatic",
      "definition": "Cancer that has spread from its original location to other parts of the body. No evidence of metastatic disease is a positive finding."
    },
    {
      "term": "Cervical lymph node",
      "definition": "Small, bean-shaped organs in the neck that are part of the immune system. Cancer can sometimes spread to nearby lymph nodes."
    }
  ],
  
  "commonlyAskedQuestions": [
    {
      "question": "Is papillary thyroid cancer serious?",
      "answer": "While any cancer diagnosis is concerning, papillary thyroid cancer is one of the most treatable forms of cancer. When caught early and treated properly, the 10-year survival rate is over 98%. Most patients go on to live normal, healthy lives after treatment."
    },
    {
      "question": "What does 'negative margins' mean for my future?",
      "answer": "Negative margins mean the surgeon removed the entire visible tumor with a surrounding rim of healthy tissue. This significantly reduces the chance of the cancer returning in that location. It's one of the most important factors in predicting a good outcome."
    },
    {
      "question": "Do I need additional treatment after surgery?",
      "answer": "That depends on several factors including tumor size, staging, and your doctor's assessment. Many papillary thyroid cancer patients receive radioactive iodine treatment after surgery to destroy any remaining thyroid cells. Your endocrinologist will discuss this with you."
    },
    {
      "question": "Will I need to take medication for the rest of my life?",
      "answer": "Yes, after a total thyroidectomy you'll need to take thyroid hormone replacement medication (levothyroxine) daily for life. This replaces the hormones your thyroid would normally produce and is very manageable for most patients."
    },
    {
      "question": "How often will I need follow-up tests?",
      "answer": "You'll typically have regular blood tests and ultrasounds to monitor for any signs of recurrence. Initially these may be every 6-12 months, and may become less frequent over time if everything looks good."
    }
  ],
  
  "providerQuestions": [
    {
      "question": "Based on my pathology results, what stage is my cancer and what does that mean for my treatment plan?",
      "questionEnglish": "Based on my pathology results, what stage is my cancer and what does that mean for my treatment plan?"
    },
    {
      "question": "Do I need radioactive iodine treatment, and if so, when would that happen?",
      "questionEnglish": "Do I need radioactive iodine treatment, and if so, when would that happen?"
    },
    {
      "question": "What is my prognosis given these specific findings?",
      "questionEnglish": "What is my prognosis given these specific findings?"
    },
    {
      "question": "How will we monitor for any recurrence, and what signs should I watch for?",
      "questionEnglish": "How will we monitor for any recurrence, and what signs should I watch for?"
    },
    {
      "question": "When can I expect to start thyroid hormone replacement, and how will we know if the dose is right?",
      "questionEnglish": "When can I expect to start thyroid hormone replacement, and how will we know if the dose is right?"
    }
  ],
  
  "resources": [
    {
      "title": "American Thyroid Association - Thyroid Cancer",
      "description": "Comprehensive patient guides about thyroid cancer types, treatment options, and living after thyroidectomy",
      "url": "https://www.thyroid.org/thyroid-cancer/",
      "source": "American Thyroid Association"
    },
    {
      "title": "ThyCa: Thyroid Cancer Survivors' Association",
      "description": "Support groups, educational materials, and resources for thyroid cancer patients and their families",
      "url": "https://www.thyca.org/",
      "source": "ThyCa"
    },
    {
      "title": "National Cancer Institute - Thyroid Cancer",
      "description": "Detailed information about thyroid cancer staging, treatment, and clinical trials",
      "url": "https://www.cancer.gov/types/thyroid",
      "source": "National Cancer Institute"
    }
  ],
  
  "nextSteps": [
    {
      "step": "Schedule a follow-up with your surgeon",
      "details": "Discuss the pathology results in detail and get answers to any questions about the surgery and recovery"
    },
    {
      "step": "Connect with an endocrinologist",
      "details": "They will manage your thyroid hormone replacement and coordinate any additional treatment like radioactive iodine"
    },
    {
      "step": "Start thyroid hormone replacement as directed",
      "details": "Take your levothyroxine medication exactly as prescribed, typically first thing in the morning on an empty stomach"
    },
    {
      "step": "Keep a copy of this pathology report",
      "details": "You'll want to have this for your records and to share with any new doctors or specialists"
    },
    {
      "step": "Consider joining a support group",
      "details": "Connecting with other thyroid cancer survivors can provide emotional support and practical tips"
    }
  ]
}

## CRITICAL RULES - READ CAREFULLY

1. **EVERY section MUST have items** - Do NOT return empty arrays []. Each section needs at least 3-5 items.

2. **lineByLine**: Extract EVERY significant finding, diagnosis, measurement, or medical statement from the document. For each one, provide the exact original text and a plain language explanation. Aim for 5-15 items depending on document length.

3. **definitions**: Extract EVERY medical term, abbreviation, or technical phrase that a regular person wouldn't understand. Include anatomical terms, diagnoses, procedures, and lab test names. Aim for 5-15 terms.

4. **commonlyAskedQuestions**: Generate questions that patients commonly ask about the type of findings in this document. Base these on the actual content - not generic questions. Aim for 4-6 Q&As.

5. **providerQuestions**: Generate specific, actionable questions the patient should ask their doctor at their next appointment. These should be based on the document's findings. Aim for 4-6 questions.

6. **resources**: Provide relevant, trustworthy resources (medical associations, patient advocacy groups, government health sites). Aim for 3-5 resources.

7. **nextSteps**: Provide clear, actionable steps the patient should take. Be specific based on the document content. Aim for 3-5 steps.

8. **pondsAnalysis.keyTakeaways**: Use **bold** for emphasis on important phrases and *italics* for softer emphasis. Keep bullets concise but informative.

9. **Explain EVERYTHING in plain English** - Assume the patient has no medical background. Avoid jargon.

10. **Be thorough** - Extract every finding, every term, every detail that would help a patient understand their document.

11. **Be reassuring but honest** - Don't minimize serious findings, but do provide context and hope where appropriate.

12. **Always recommend discussing with healthcare provider** - Remind patients that only their doctor can provide personalized medical advice.

## FOR DIFFERENT DOCUMENT TYPES:

### Lab Results / Blood Tests:
- List each test, the result, and whether it's normal/abnormal
- Explain what each test measures and why it matters
- Note any values outside the reference range

### Pathology / Biopsy Reports:
- Explain the specimen type and source
- Translate the diagnosis into plain language
- Explain staging/grading if present
- Discuss what margins mean

### Imaging Reports (X-ray, MRI, CT, Ultrasound):
- Explain what the imaging was looking for
- Translate findings into plain language
- Explain any measurements or comparisons

### Clinical Notes / Visit Summaries:
- Summarize the main reason for the visit
- Explain any diagnoses or assessments
- List any action items or follow-up plans

### Prescriptions:
- Explain what each medication is for
- Note dosage and instructions in plain terms
- Mention common side effects to watch for`;

// ========== TYPE DEFINITIONS ==========

interface Charge {
  code?: string;
  codeType?: string;
  revenueCode?: string | null;
  description?: string;
  amount?: number | string | null;
  billedAmount?: number | string | null;
  billed?: number | string | null;
  total?: number | string | null;
  units?: number;
  date?: string | null;
}

interface ReviewItem {
  whatToReview?: string;
  whyItMatters?: string;
  issueType?: string;
  title?: string;
  description?: string;
  issue?: string;
  reason?: string;
  type?: string;
}

interface SavingsItem {
  whatMightBeReduced?: string;
  whyNegotiable?: string;
  savingsContext?: string;
  additionalInfoNeeded?: string;
  title?: string;
  description?: string;
  opportunity?: string;
  reason?: string;
}

interface NextStep {
  step?: string;
  details?: string;
  isUrgent?: boolean;
  action?: string;
  title?: string;
  description?: string;
}

interface BillAnalysisResult {
  billFormat?: string;
  issuer?: string;
  dateOfService?: string;
  charges?: Charge[];
  extractedTotals?: {
    totalCharges?: { value: number; evidence: string };
    lineItemsSum?: number;
  };
  atAGlance?: {
    visitSummary?: string;
    totalBilled?: number;
    amountYouMayOwe?: number | null;
    status?: string;
    statusExplanation?: string;
  };
  thingsWorthReviewing?: ReviewItem[];
  savingsOpportunities?: SavingsItem[];
  conversationScripts?: {
    firstCallScript?: string;
    ifTheyPushBack?: string;
    whoToAskFor?: string;
  };
  priceContext?: {
    hasBenchmarks?: boolean;
    comparisons?: unknown[];
    fallbackMessage?: string;
  };
  pondNextSteps?: NextStep[];
  closingReassurance?: string;
}

interface MedicalDocLineItem {
  originalText?: string;
  plainLanguage?: string;
  explanation?: string;
}

interface MedicalDocDefinition {
  term?: string;
  definition?: string;
}

interface MedicalDocQA {
  question?: string;
  answer?: string;
}

interface MedicalDocProviderQuestion {
  question?: string;
  questionEnglish?: string;
}

interface MedicalDocResource {
  title?: string;
  description?: string;
  url?: string;
  source?: string;
}

interface MedicalDocNextStep {
  step?: string;
  details?: string;
}

interface MedicalDocAnalysisResult {
  documentType?: string;
  documentTypeLabel?: string;
  pondsAnalysis?: {
    keyTakeaways?: string[];
    contextParagraph?: string;
  };
  overview?: {
    summary?: string;
    mainPurpose?: string;
    overallAssessment?: string;
  };
  lineByLine?: MedicalDocLineItem[];
  definitions?: MedicalDocDefinition[];
  commonlyAskedQuestions?: MedicalDocQA[];
  providerQuestions?: MedicalDocProviderQuestion[];
  resources?: MedicalDocResource[];
  nextSteps?: MedicalDocNextStep[];
}

// ========== HELPER FUNCTIONS ==========

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;
  return [];
}

function processBillResult(parsedResult: BillAnalysisResult): BillAnalysisResult {
  // Process charges
  if (parsedResult.charges && Array.isArray(parsedResult.charges)) {
    console.log("[analyze-document] Processing", parsedResult.charges.length, "charges");

    let cptCount = 0;
    let hcpcsCount = 0;
    let revenueCount = 0;

    parsedResult.charges = parsedResult.charges.map((charge: Charge, idx: number) => {
      let code = String(charge.code || "").trim();
      let codeType = charge.codeType || "unknown";
      let revenueCode = charge.revenueCode ? String(charge.revenueCode).trim() : null;

      if (/^\d{5}$/.test(code)) {
        codeType = "cpt";
        cptCount++;
      } else if (/^[A-Z]\d{4}$/i.test(code)) {
        codeType = "hcpcs";
        hcpcsCount++;
      } else if (/^0\d{3}$/.test(code)) {
        codeType = "revenue";
        revenueCode = code;
        revenueCount++;
      }

      let amount: number | null = null;
      const rawAmount = charge.amount ?? charge.billedAmount ?? charge.billed ?? charge.total;

      if (typeof rawAmount === "number" && !isNaN(rawAmount)) {
        amount = rawAmount;
      } else if (typeof rawAmount === "string") {
        const cleaned = rawAmount.replace(/[$,\s]/g, "");
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) {
          amount = parsed;
        }
      }

      console.log(`[analyze-document] Charge ${idx}: code=${code}, type=${codeType}, amount=${amount}`);

      return { ...charge, code, codeType, revenueCode, amount, units: charge.units || 1 };
    });

    console.log(`[analyze-document] Summary: CPT=${cptCount}, HCPCS=${hcpcsCount}, Revenue=${revenueCount}`);

    const lineItemsSum = parsedResult.charges.reduce(
      (sum: number, c: Charge) => sum + (typeof c.amount === "number" ? c.amount : 0),
      0,
    );

    if (!parsedResult.extractedTotals) {
      parsedResult.extractedTotals = {};
    }
    parsedResult.extractedTotals.lineItemsSum = lineItemsSum;
  }

  // Normalize thingsWorthReviewing
  if (parsedResult.thingsWorthReviewing && Array.isArray(parsedResult.thingsWorthReviewing)) {
    parsedResult.thingsWorthReviewing = parsedResult.thingsWorthReviewing.map((item: ReviewItem) => {
      const whatToReview = item.whatToReview || item.title || item.issue || item.description || "Review this item";
      const whyItMatters = item.whyItMatters || item.reason || item.description || "This may affect your bill";
      const issueType = item.issueType || item.type || "negotiable";

      return { whatToReview, whyItMatters, issueType };
    });
  } else {
    parsedResult.thingsWorthReviewing = [
      {
        whatToReview: "Review all charges for accuracy",
        whyItMatters: "Medical bills can contain errors. Verify each charge matches services received.",
        issueType: "confirmation",
      },
    ];
  }

  // Normalize savingsOpportunities
  if (parsedResult.savingsOpportunities && Array.isArray(parsedResult.savingsOpportunities)) {
    parsedResult.savingsOpportunities = parsedResult.savingsOpportunities.map((item: SavingsItem) => {
      const whatMightBeReduced =
        item.whatMightBeReduced || item.title || item.opportunity || item.description || "Potential savings";
      const whyNegotiable = item.whyNegotiable || item.reason || item.description || "This may be negotiable";

      return {
        whatMightBeReduced,
        whyNegotiable,
        savingsContext: item.savingsContext,
        additionalInfoNeeded: item.additionalInfoNeeded,
      };
    });
  } else {
    parsedResult.savingsOpportunities = [
      {
        whatMightBeReduced: "Ask about self-pay discounts",
        whyNegotiable: "Most providers offer 10-40% discounts for prompt payment or self-pay patients.",
        savingsContext: "Could save 10-40%",
      },
      {
        whatMightBeReduced: "Inquire about payment plans",
        whyNegotiable: "Many providers offer interest-free payment plans that make bills more manageable.",
      },
    ];
  }

  // Normalize pondNextSteps
  if (parsedResult.pondNextSteps && Array.isArray(parsedResult.pondNextSteps)) {
    parsedResult.pondNextSteps = parsedResult.pondNextSteps.map((item: NextStep) => {
      const step = item.step || item.action || item.title || item.description || "Review your bill";
      const details = item.details || item.description || "";

      return { step, details, isUrgent: item.isUrgent || false };
    });
  } else {
    parsedResult.pondNextSteps = [
      { step: "Request an itemized bill", details: "Get a detailed breakdown of all charges to verify accuracy", isUrgent: false },
      { step: "Call billing to ask about discounts", details: "Many providers offer 20-50% off for prompt payment or self-pay", isUrgent: false },
      { step: "Review each charge against your records", details: "Make sure you received all billed services", isUrgent: false },
    ];
  }

  // Ensure other defaults
  if (!parsedResult.atAGlance) {
    parsedResult.atAGlance = {
      visitSummary: "Medical services",
      totalBilled: parsedResult.extractedTotals?.lineItemsSum || 0,
      status: "worth_reviewing",
      statusExplanation: "Please review this bill carefully.",
    };
  }

  if (!parsedResult.conversationScripts) {
    parsedResult.conversationScripts = {
      firstCallScript: "Hi, I'm calling about my bill and have some questions about the charges.",
      ifTheyPushBack: "I'd like to speak with a billing supervisor or patient advocate.",
      whoToAskFor: "Patient Financial Services",
    };
  }

  if (!parsedResult.closingReassurance) {
    parsedResult.closingReassurance = "Medical bills are often negotiable. Don't hesitate to ask questions.";
  }

  return parsedResult;
}

function processMedicalDocResult(parsedResult: MedicalDocAnalysisResult): MedicalDocAnalysisResult {
  console.log("[analyze-document] Processing medical document result");

  // Ensure documentType and label
  const docType = parsedResult.documentType || "mixed_other";
  const docTypeLabels: Record<string, string> = {
    test_results: "Test Results",
    after_visit_summary: "After Visit Summary",
    clinical_note: "Clinical Note",
    prescription: "Prescription",
    imaging_report: "Imaging Report",
    mixed_other: "Medical Document",
  };
  
  parsedResult.documentType = docType;
  parsedResult.documentTypeLabel = parsedResult.documentTypeLabel || docTypeLabels[docType] || "Medical Document";

  // Ensure pondsAnalysis
  if (!parsedResult.pondsAnalysis) {
    parsedResult.pondsAnalysis = {
      keyTakeaways: ["This document contains medical information about your care."],
      contextParagraph: "Please review this document and discuss any questions with your healthcare provider.",
    };
  } else {
    parsedResult.pondsAnalysis.keyTakeaways = ensureArray(parsedResult.pondsAnalysis.keyTakeaways);
    if (parsedResult.pondsAnalysis.keyTakeaways.length === 0) {
      parsedResult.pondsAnalysis.keyTakeaways = ["This document contains medical information about your care."];
    }
  }

  // Ensure overview
  if (!parsedResult.overview) {
    parsedResult.overview = {
      summary: "This document contains medical information.",
      mainPurpose: "Provides details about your medical care.",
      overallAssessment: "Please discuss any concerns with your healthcare provider.",
    };
  }

  // Process and ensure lineByLine has content
  const lineByLine = ensureArray<MedicalDocLineItem>(parsedResult.lineByLine);
  parsedResult.lineByLine = lineByLine.map((item) => ({
    originalText: item.originalText || item.explanation || "",
    plainLanguage: item.plainLanguage || item.explanation || "",
  })).filter((item) => item.originalText || item.plainLanguage);
  
  if (parsedResult.lineByLine.length === 0) {
    console.warn("[analyze-document] No lineByLine items found - adding default");
    parsedResult.lineByLine = [{
      originalText: "Document content",
      plainLanguage: "Please review this document with your healthcare provider for a detailed explanation.",
    }];
  }
  console.log(`[analyze-document] lineByLine: ${parsedResult.lineByLine.length} items`);

  // Process definitions
  const definitions = ensureArray<MedicalDocDefinition>(parsedResult.definitions);
  parsedResult.definitions = definitions.map((def) => ({
    term: def.term || "",
    definition: def.definition || "",
  })).filter((def) => def.term && def.definition);
  
  if (parsedResult.definitions.length === 0) {
    console.warn("[analyze-document] No definitions found - adding default");
    parsedResult.definitions = [{
      term: "Medical terminology",
      definition: "Ask your healthcare provider to explain any terms you don't understand.",
    }];
  }
  console.log(`[analyze-document] definitions: ${parsedResult.definitions.length} items`);

  // Process commonlyAskedQuestions
  const qaItems = ensureArray<MedicalDocQA>(parsedResult.commonlyAskedQuestions);
  parsedResult.commonlyAskedQuestions = qaItems.map((qa) => ({
    question: qa.question || "",
    answer: qa.answer || "",
  })).filter((qa) => qa.question && qa.answer);
  
  if (parsedResult.commonlyAskedQuestions.length === 0) {
    console.warn("[analyze-document] No Q&As found - adding default");
    parsedResult.commonlyAskedQuestions = [{
      question: "What should I do with this information?",
      answer: "Review this document and bring any questions to your next healthcare appointment.",
    }];
  }
  console.log(`[analyze-document] commonlyAskedQuestions: ${parsedResult.commonlyAskedQuestions.length} items`);

  // Process providerQuestions
  const providerQs = ensureArray<MedicalDocProviderQuestion>(parsedResult.providerQuestions);
  parsedResult.providerQuestions = providerQs.map((q) => ({
    question: q.question || "",
    questionEnglish: q.questionEnglish,
  })).filter((q) => q.question);
  
  if (parsedResult.providerQuestions.length === 0) {
    console.warn("[analyze-document] No provider questions found - adding default");
    parsedResult.providerQuestions = [{
      question: "Can you explain what this document means for my health?",
      questionEnglish: "Can you explain what this document means for my health?",
    }];
  }
  console.log(`[analyze-document] providerQuestions: ${parsedResult.providerQuestions.length} items`);

  // Process resources
  const resources = ensureArray<MedicalDocResource>(parsedResult.resources);
  parsedResult.resources = resources.map((r) => ({
    title: r.title || "",
    description: r.description || "",
    url: r.url || "#",
    source: r.source || "Medical resource",
  })).filter((r) => r.title);
  
  if (parsedResult.resources.length === 0) {
    console.warn("[analyze-document] No resources found - adding defaults");
    parsedResult.resources = [
      {
        title: "MedlinePlus",
        description: "Trusted health information from the National Library of Medicine",
        url: "https://medlineplus.gov/",
        source: "National Library of Medicine",
      },
      {
        title: "CDC Health Information",
        description: "Health topics and information from the Centers for Disease Control",
        url: "https://www.cdc.gov/",
        source: "CDC",
      },
    ];
  }
  console.log(`[analyze-document] resources: ${parsedResult.resources.length} items`);

  // Process nextSteps
  const nextSteps = ensureArray<MedicalDocNextStep>(parsedResult.nextSteps);
  parsedResult.nextSteps = nextSteps.map((s) => ({
    step: s.step || "",
    details: s.details || "",
  })).filter((s) => s.step);
  
  if (parsedResult.nextSteps.length === 0) {
    console.warn("[analyze-document] No next steps found - adding defaults");
    parsedResult.nextSteps = [
      {
        step: "Review this document carefully",
        details: "Take time to read through and note any questions you have.",
      },
      {
        step: "Schedule a follow-up with your provider",
        details: "Discuss the contents of this document and any concerns at your next appointment.",
      },
      {
        step: "Keep this document for your records",
        details: "Store it with your other medical records for future reference.",
      },
    ];
  }
  console.log(`[analyze-document] nextSteps: ${parsedResult.nextSteps.length} items`);

  return parsedResult;
}

// ========== MAIN HANDLER ==========

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, documentType, analysisMode } = await req.json();

    if (!documentContent) {
      return new Response(JSON.stringify({ error: "No document content provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("[analyze-document] LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base64Data = documentContent.split(",")[1] || documentContent;
    let mimeType = "image/jpeg";
    if (documentType?.includes("pdf")) {
      mimeType = "application/pdf";
    } else if (documentType?.includes("png")) {
      mimeType = "image/png";
    }

    // Select the appropriate prompt based on analysis mode
    const isMedicalDocument = analysisMode === "medical_document";
    const systemPrompt = isMedicalDocument ? MEDICAL_DOC_SYSTEM_PROMPT : BILL_SYSTEM_PROMPT;

    console.log("[analyze-document] Starting analysis, MIME:", mimeType, "Mode:", analysisMode || "bill");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
              {
                type: "text",
                text: systemPrompt,
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 16000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[analyze-document] API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "API request failed", details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[analyze-document] No content in API response");
      return new Response(JSON.stringify({ error: "No content returned from API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[analyze-document] Received AI response, length:", content.length);

    // Parse JSON - handle markdown code blocks
    let jsonContent = content;
    if (jsonContent.includes("```json")) {
      jsonContent = jsonContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonContent.includes("```")) {
      jsonContent = jsonContent.replace(/```\n?/g, "");
    }
    jsonContent = jsonContent.trim();

    let parsedResult: BillAnalysisResult | MedicalDocAnalysisResult;
    try {
      parsedResult = JSON.parse(jsonContent);
    } catch (_parseError) {
      console.error("[analyze-document] JSON parse error. Preview:", jsonContent.substring(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response as JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process based on analysis mode
    let processedResult;
    if (isMedicalDocument) {
      processedResult = processMedicalDocResult(parsedResult as MedicalDocAnalysisResult);
    } else {
      processedResult = processBillResult(parsedResult as BillAnalysisResult);
    }

    console.log("[analyze-document] Analysis complete, returning result");

    return new Response(JSON.stringify({ analysis: processedResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[analyze-document] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err instanceof Error ? err.message : String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
