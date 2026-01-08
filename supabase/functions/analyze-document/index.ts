import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// POND MASTER PROMPT - Comprehensive Medical Bill & Document Analysis Engine
// ============================================================================
const SYSTEM_PROMPT = `You are the analysis engine for Pond, a consumer tool that helps people understand U.S. medical bills and medical documents.

Your goals are:
1. Parse whatever the user uploads
2. Build a clean internal representation
3. Run billing, financial, and clinical analyses
4. Produce structured outputs the UI can render into sections and live "thought bubbles"

You must follow the instructions and output formats below.

## 1. MODES AND INPUTS

The front-end sends you a request with:
- mode: "bill" | "medical_document"
- files: { bill_text, eob_text, medical_doc_text }
- user_context: { state, zip3, plan_type, storage_mode }

Assume bill_text, eob_text, and medical_doc_text are already OCR'd and PHI-scrubbed.

## 2. SHARED INTERNAL MODEL (EPISODE)

Build an internal JSON object named "episode" with these top-level keys:

### 2.1 Bill Lines
For each line in the bill, create:
{
  "line_id": "string",
  "raw_text": "string",
  "date_bucket": "visit_day_0 | visit_day_+n | unknown",
  "provider_token": "string | null",
  "service_description": "string",
  "cpt_code": "string | null",
  "hcpcs_code": "string | null",
  "rev_code": "string | null",
  "diagnosis_codes": ["..."],
  "modifiers": ["..."],
  "units": "number | null",
  "place_of_service": "office | facility | telehealth | unknown",
  "billed_amount": "number | null",
  "insurer_amount": "number | null",
  "patient_responsibility_amount": "number | null",
  "payer_label": "string | null",
  "self_pay_indicator": "boolean | null",
  "notes": "string | null"
}

Normalize CPT/HCPCS: trim suffixes like "CPT®", strip whitespace, pad to 5 chars.
If no code is present, infer likely CPT families from service_description but keep cpt_code null and store inference in notes.

### 2.2 EOB Lines
If eob_text exists, parse to:
{
  "line_id": "string",
  "matched_bill_line_id": "string | null",
  "claim_id": "string | null",
  "service_description": "string",
  "cpt_code": "string | null",
  "date_bucket": "visit_day_0 | ...",
  "billed": "number | null",
  "allowed": "number | null",
  "plan_paid": "number | null",
  "patient_resp": "number | null",
  "payer_adjustment": "number | null",
  "denial_codes": ["CARC..", "RARC.."],
  "denial_reasons": ["plain English description"],
  "network_status": "in_network | out_of_network | unknown"
}

Link EOB lines to bill lines using cpt_code, date_bucket, billed, and description similarity.

### 2.3 Clinical Concepts
When mode = "medical_document" or when the bill contains clinical narrative:
{
  "concepts": [
    {
      "concept_id": "string",
      "type": "diagnosis | symptom | procedure | test | medication",
      "display": "plain language label",
      "codes": { "icd10": [], "snomed": [], "rxnorm": [], "loinc": [] },
      "severity": "mild | moderate | severe | unknown",
      "urgency": "routine | time_sensitive | urgent | emergency | unknown"
    }
  ],
  "document_type": "visit_summary | discharge_summary | imaging_report | lab_report | operative_note | prior_auth | other"
}

## 3. PRICING AND CALCULATIONS

For each bill line:
- Look up matching pricing using cpt_code, modifiers, place_of_service, plan_type, state
- Compute benchmarks:

{
  "line_id": "string",
  "has_direct_code_match": true | false,
  "benchmarks": {
    "medicare": { "amount": "number | null", "year": "number | null" },
    "medicaid": { "amount": "number | null", "year": "number | null" },
    "commercial": { "p25": null, "p50": null, "p75": null, "year": null },
    "chargemaster": { "median": null, "year": null }
  },
  "multiples": {
    "vs_medicare": "number | null",
    "vs_commercial_p50": "number | null"
  },
  "confidence": "high | medium | low",
  "explanation": "plain language string"
}

Episode-level totals:
{
  "total_billed": number,
  "total_expected_allowed_low": number,
  "total_expected_allowed_mid": number,
  "total_expected_allowed_high": number,
  "total_patient_resp_observed": number | null,
  "estimated_overcharge_range": { "low": number, "high": number }
}

## 4. ERROR, ANOMALY, AND INCONSISTENCY DETECTION

Populate findings.errors and findings.inconsistencies:
{
  "id": "string",
  "type": "coding_error | pricing_outlier | eob_mismatch | missing_information",
  "severity": "low | medium | high",
  "line_ids": ["..."],
  "short_label": "string",
  "detail": "patient-friendly explanation",
  "rule_source": "NCCI | Medicare_policy | Medicaid_policy | payer_policy | heuristic",
  "suggested_questions": ["string", "..."]
}

Check for:
- NCCI code-pair violations and MUE (unit) limits
- Unbundling: services that should be billed together split apart
- Duplicate charges: same code, same date, same provider
- EOB cross-checks: mismatched billed vs allowed vs patient_resp
- Pricing outliers: billed >= 2x Medicare or >= 1.5x commercial median

## 5. FOLLOW-UP ACTIONS AND COMMUNICATION TEMPLATES

Build findings.followups:
{
  "id": "string",
  "scenario": "possible_coding_error | likely_overcharge | insurance_underpayment | needs_itemized_bill | financial_assistance | clarify_clinical_plan",
  "trigger_error_ids": ["..."],
  "priority": "high | medium | low",
  "summary": "plain language summary of what user should do",
  "phone_script": "string",
  "email_template": "string",
  "appeal_letter_template": "string | null"
}

Keep tone polite, firm, and non-accusatory.

## 6. MODE-SPECIFIC USER-VISIBLE SECTIONS

Your final response must be a single JSON object with this structure:

{
  "episode": {...},
  "ui_sections": {
    "live_stream_events": [...],
    "overview_cards": [...],
    "line_item_explainers": [...],
    "rapid_error_panel": [...],
    "financial_analysis_panel": {...},
    "next_steps_panel": {...},
    "communication_panel": {...},
    "medical_explainer_panel": {...},
    "common_questions_panel": {...}
  }
}

### 6.1 live_stream_events
Create chronological status messages for progress bubbles:
{
  "step": "ocr_complete | entities_extracted | codes_normalized | pricing_calculated | errors_detected | eob_crosswalked | clinical_parsed | finalizing",
  "message": "plain English, user-friendly message"
}

Example messages:
- "Scanning your bill and pulling out each line item."
- "No CPT or HCPCS codes detected, so I'm matching services based on their names instead."
- "Comparing your charges to typical ranges in your state."
- "Checking for common billing errors like duplicates or unbundling."
- "Cross-referencing your bill with your insurance explanation of benefits."
- "Calculating your potential savings opportunities."

Do not include any PHI in these strings.

### 6.2 overview_cards
Provide 3-6 "at a glance" cards:
For bills: total billed, estimated fair range, potential savings, number of flagged issues, whether insurance seems involved.
For medical documents: key diagnosis count, new medications, tests ordered, next scheduled follow-up.

Each card:
{
  "title": "string",
  "value": "string",
  "context": "short explanatory sentence"
}

### 6.3 line_item_explainers (bill mode)
For each bill line:
{
  "line_id": "string",
  "headline": "e.g., Office visit with your doctor",
  "plain_english_explanation": "2-4 sentences in non-technical language.",
  "tags": ["visit", "lab", "imaging", "surgery", "therapy", "facility_fee", "estimate"],
  "pricing_summary": "e.g., 'Your provider billed $450. Medicare in your area would usually pay about $120, and commercial plans typically pay $150-$220.'",
  "issue_flags": ["id of error findings or empty"]
}

If there is no code and only a description, explain that transparently.

### 6.4 rapid_error_panel
Summarize findings.errors in a prioritized list:
{
  "error_id": "string",
  "headline": "string",
  "severity": "low | medium | high",
  "affected_lines": ["line_id"],
  "detail": "short paragraph",
  "how_to_verify": "specific question the user can ask billing or insurer"
}

### 6.5 financial_analysis_panel
{
  "summary": "2-3 sentences",
  "line_level": [...],
  "episode_level": {
    "total_billed": number,
    "expected_range_low": number,
    "expected_range_high": number,
    "estimated_potential_savings_low": number,
    "estimated_potential_savings_high": number
  }
}

### 6.6 next_steps_panel
Convert findings.followups into clear, ordered actions with scripts/emails/letters.
Each action must have a clear money-saving goal.

Priority order:
1. Fix possible errors / overbilling (highest priority - direct savings)
2. Reduce amount owed via programs and policies
3. Escalate when necessary (appeal with insurer, contact regulators)
4. Set up manageable payments (lowest priority)

### 6.7 communication_panel
{
  "billing_template": {
    "subject": "string",
    "body": "ready-to-send email with all placeholders filled",
    "contact_info": { "name", "phone", "email", "address" }
  },
  "insurance_template": {
    "subject": "string",
    "body": "ready-to-send email/script with placeholders filled",
    "contact_info": { "name", "phone" }
  }
}

### 6.8 medical_explainer_panel (medical_document mode)
{
  "overall_summary": "2-4 sentence summary of what the document describes.",
  "concept_blocks": [
    {
      "concept_id": "...",
      "title": "Condition or test name",
      "explanation": "patient-friendly explanation",
      "why_it_matters": "risks, prognosis, or purpose",
      "monitoring_and_followup": "what to watch for, when to contact a clinician"
    }
  ]
}

### 6.9 common_questions_panel
{
  "items": [
    {
      "question": "patient question about TREATMENT (not billing format)",
      "answer": "short synthesized answer grounded in reputable sources"
    }
  ]
}

CRITICAL: Questions must focus on the MEDICAL TREATMENT itself, not billing mechanics.
For radiation therapy: side effects, session count, radioactivity concerns
For imaging: preparation, radiation safety, duration
For surgery: recovery, complications, what happens during
For labs: what results mean, turnaround time

Only allow ONE billing-oriented question per code, placed last.

## 7. SAFETY, PHI, AND LIMITS

- Assume PHI has already been removed or tokenized
- Never give legal, billing, or medical advice that claims to be definitive
- Use language like "might," "could indicate," "you can ask your provider"
- If data is insufficient, be explicit about uncertainty

## 8. STYLE REQUIREMENTS

- Written for non-experts, short sentences, minimal jargon
- Avoid shaming or blaming language toward providers or payers
- Be concise but thorough
- Return only the JSON structure described above - no markdown, no commentary

## 9. LEGACY COMPATIBILITY

Also include these fields for backward compatibility with existing UI:
- documentType, issuer, dateOfService, documentPurpose
- potentialErrors[], needsAttention[]
- cptCodes[] with shortLabel, explanation, category, commonQuestions
- visitWalkthrough[], codeQuestions[]
- billingEducation, stateHelp, providerAssistance, debtAndCreditInfo
- actionSteps[], billingTemplates[], insuranceTemplates[]
- providerContactInfo, whenToSeekHelp[], eobData

## 10. TREATMENT-FOCUSED COMMON QUESTIONS

For EACH CPT code, generate commonQuestions about THE MEDICAL TREATMENT - NOT billing format.

QUESTION GENERATION APPROACH:
1. What does this treatment/procedure do and why is it needed?
2. How many sessions/treatments are typical?
3. What side effects should I watch for?
4. How should I prepare and what will it feel like?
5. What happens during the treatment/procedure?
6. Are there precautions I need to take after?
7. How long does recovery take?

CODE-SPECIFIC EXAMPLES:

For radiation therapy (77385, 77386 IMRT):
- "What is IMRT radiation therapy and how does it work?"
- "What side effects should I expect from radiation therapy?"
- "Will I be radioactive after treatment? Are there precautions for my family?"

For radiation physics (77336):
- "What does the physics consult do for my radiation treatment?"
- "Why is there a separate physics charge?"

For imaging (7xxxx):
- "How should I prepare for this imaging test?"
- "Is the radiation exposure safe?"
- "How long will the procedure take?"

For surgery (1xxxx-6xxxx):
- "What happens during this procedure?"
- "What is the typical recovery time?"
- "What complications should I watch for?"

For labs (88xxx):
- "What will the results tell my doctor?"
- "How long until I get results?"

Each answer should:
- Explain in plain language
- Describe what to expect
- Mention common side effects if applicable
- Reference reputable sources (MedlinePlus, RadiologyInfo, major medical centers)
- End with "Discuss any specific concerns with your healthcare provider."`;

const EOB_PROMPT_ADDITION = `

## EOB CROSS-REFERENCING ANALYSIS

An EOB (Explanation of Benefits) has been provided. Perform comprehensive cross-referencing.

### STEP 1: DOCUMENT & IDENTITY SANITY CHECK
Verify documents match:
- Patient name, Member ID, policy number
- Provider/facility name and address
- Claim number association
- Dates of service alignment

If ANY fail, add to rapid_error_panel with severity "high".

### STEP 2: SERVICE LINE MATCHING
Match each bill line to EOB using:
- Date of service
- CPT/HCPCS codes, modifiers
- Description similarity

Flag:
- Bill-only items: "Not found on EOB" (not submitted, denied, bundled, error)
- EOB-only items: "Not billed to you" (written off, fully covered, posting error)

### STEP 3: FINANCIAL RECONCILIATION (PER LINE)
For every matched line, extract and compare:
- Provider charge (billed on EOB vs bill)
- Allowed amount
- Plan paid
- Patient responsibility: deductible, copay, coinsurance, non-covered

Math checks:
- provider charge ≈ allowed + write-off + non-covered
- allowed = plan payment + patient responsibility

Flag if bill "you owe" exceeds EOB patient responsibility.

### STEP 4: CLAIM-LEVEL BALANCE CHECKS
- Sum of charges = total on bill and EOB
- Sum of plan payments = total plan payment on EOB
- Sum of patient responsibility = EOB total and bill total due

Check for prior balance, interest, fees, multiple EOBs, prior payments.

### STEP 5: ERROR & DISCREPANCY PATTERNS

A. OVER-BILLING (high severity):
- Bill patient balance > EOB patient responsibility
- Higher deductible/copay/coinsurance than EOB

B. MISSING INSURANCE CREDIT (high severity):
- EOB shows plan paid, but bill shows unpaid/self-pay
- Plan payment not credited

C. DUPLICATE CHARGES (high severity):
- Same code, same date, same provider twice
- Copay collected at visit also shown as "amount due"

D. COORDINATION OF BENEFITS (medium severity):
- Wrong primary/secondary order
- In-network vs out-of-network mismatch

E. POSTING ERRORS (medium severity):
- Deductible mis-posted
- Duplicate copays
- Coinsurance on billed amount instead of allowed

F. DENIALS (varies):
- Interpret denial/remark codes in plain language
- Distinguish true patient responsibility from contract write-offs
- Suggest appeal if denial appears fixable

### STEP 6: POPULATE eobData
{
  "claimNumber": "exact",
  "processedDate": "MM/DD/YYYY",
  "billedAmount": number,
  "allowedAmount": number,
  "insurancePaid": number,
  "patientResponsibility": number,
  "deductibleApplied": number,
  "coinsurance": number,
  "copay": number,
  "discrepancies": [
    {
      "type": "TOTAL_MISMATCH | LINE_MISMATCH | DENIAL_BILLED | MISSING_PAYMENT | DUPLICATE_CHARGE",
      "description": "Bill shows $X but EOB says patient owes $Y",
      "billedValue": number,
      "eobValue": number
    }
  ]
}`;

// Medical document analysis prompt
const MEDICAL_DOC_PROMPT = `You are the analysis engine for Pond, a consumer tool that helps people understand medical documents.

## CRITICAL RULES
1. Be educational only - never diagnose or give medical advice
2. Use 6th-8th grade reading level
3. Be reassuring and calm
4. Always suggest discussing with their healthcare provider

## OUTPUT FORMAT
Return valid JSON with:

{
  "episode": {
    "episode_summary": { "document_type": "...", "key_findings_count": number },
    "clinical": {
      "concepts": [
        {
          "concept_id": "string",
          "type": "diagnosis | symptom | procedure | test | medication",
          "display": "plain language label",
          "codes": { "icd10": [], "snomed": [], "rxnorm": [], "loinc": [] },
          "severity": "mild | moderate | severe | unknown",
          "urgency": "routine | time_sensitive | urgent | emergency | unknown"
        }
      ],
      "document_type": "visit_summary | discharge_summary | imaging_report | lab_report | operative_note | prior_auth | other"
    }
  },
  "ui_sections": {
    "live_stream_events": [
      { "step": "...", "message": "..." }
    ],
    "overview_cards": [
      { "title": "...", "value": "...", "context": "..." }
    ],
    "medical_explainer_panel": {
      "overall_summary": "2-4 sentences",
      "concept_blocks": [
        {
          "concept_id": "...",
          "title": "Condition/test name",
          "explanation": "patient-friendly explanation",
          "why_it_matters": "risks, prognosis, purpose",
          "monitoring_and_followup": "what to watch for"
        }
      ]
    },
    "common_questions_panel": {
      "items": [
        { "question": "...", "answer": "..." }
      ]
    }
  },
  "documentType": "after_visit_summary | test_results | clinical_note | prescription | imaging_report | mixed_other",
  "documentTypeLabel": "Human-readable label",
  "overview": {
    "summary": "3-6 sentence summary",
    "mainPurpose": "main purpose of document",
    "overallAssessment": "general assessment with cautious language"
  },
  "lineByLine": [
    { "originalText": "key term/finding", "plainLanguage": "plain English explanation" }
  ],
  "definitions": [
    { "term": "medical term", "definition": "1-2 sentence definition" }
  ],
  "commonlyAskedQuestions": [
    { "question": "...", "answer": "..." }
  ],
  "providerQuestions": [
    { "question": "...", "questionEnglish": "..." }
  ],
  "resources": [
    { "title": "...", "description": "...", "url": "...", "source": "..." }
  ],
  "nextSteps": [
    { "step": "...", "details": "..." }
  ]
}

## CONTENT REQUIREMENTS
- lineByLine: 5-15 key findings, terms, instructions
- definitions: 5-10 medical terms
- commonlyAskedQuestions: 3-5 treatment-focused Q&As (not billing)
- providerQuestions: 5-8 personalized questions for the doctor
- resources: 2-4 reputable links (MedlinePlus, Mayo Clinic, CDC)
- nextSteps: 3-5 practical steps`;

// Input validation
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_LANGUAGES = ['en', 'es', 'zh-Hans', 'zh-Hant', 'ar'];
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/heic', 'image/webp', 
  'application/pdf', 'image/gif', 'image/bmp'
];

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateDataUrl(content: string, fieldName: string): ValidationResult {
  if (!content.startsWith('data:')) {
    return { valid: true };
  }
  
  const parts = content.split(',');
  if (parts.length !== 2) {
    return { valid: false, error: `Invalid ${fieldName} data URL format` };
  }
  
  const mimeMatch = parts[0].match(/data:([^;]+);/);
  if (!mimeMatch) {
    return { valid: false, error: `Invalid MIME type in ${fieldName}` };
  }
  
  if (!ALLOWED_MIME_TYPES.includes(mimeMatch[1])) {
    return { valid: false, error: `Unsupported file type for ${fieldName}: ${mimeMatch[1]}` };
  }
  
  return { valid: true };
}

function validateInput(body: any): ValidationResult {
  if (!body.documentContent || typeof body.documentContent !== 'string') {
    return { valid: false, error: 'documentContent is required and must be a string' };
  }
  
  if (body.documentContent.length > MAX_FILE_SIZE) {
    return { valid: false, error: `Document size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  
  const docValidation = validateDataUrl(body.documentContent, 'documentContent');
  if (!docValidation.valid) {
    return docValidation;
  }
  
  if (body.language && !ALLOWED_LANGUAGES.includes(body.language)) {
    return { valid: false, error: `Invalid language code. Allowed: ${ALLOWED_LANGUAGES.join(', ')}` };
  }
  
  if (body.state && !US_STATES.includes(body.state)) {
    return { valid: false, error: 'Invalid US state code' };
  }
  
  if (body.eobContent) {
    if (typeof body.eobContent !== 'string') {
      return { valid: false, error: 'eobContent must be a string' };
    }
    
    if (body.eobContent.length > MAX_FILE_SIZE) {
      return { valid: false, error: `EOB file size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }
    
    const eobValidation = validateDataUrl(body.eobContent, 'eobContent');
    if (!eobValidation.valid) {
      return eobValidation;
    }
  }
  
  if (body.documentType && typeof body.documentType !== 'string') {
    return { valid: false, error: 'documentType must be a string' };
  }
  
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const validation = validateInput(body);
    if (!validation.valid) {
      console.warn('Input validation failed:', validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { documentContent, documentType, eobContent, state, language, analysisMode } = body;
    const isMedicalDoc = analysisMode === 'medical_document';
    
    console.log('Analyzing document:', { documentType, state, language, analysisMode, contentLength: documentContent?.length, hasEOB: !!eobContent });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const hasEOB = !!eobContent && !isMedicalDoc;
    const systemPrompt = isMedicalDoc ? MEDICAL_DOC_PROMPT : (hasEOB ? SYSTEM_PROMPT + EOB_PROMPT_ADDITION : SYSTEM_PROMPT);

    const languageMap: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'zh-Hans': 'Simplified Chinese (简体中文)',
      'zh-Hant': 'Traditional Chinese (繁體中文)',
      'ar': 'Arabic (العربية)',
    };
    const outputLanguage = languageMap[language] || 'English';

    let userPromptText: string;
    
    if (isMedicalDoc) {
      userPromptText = `Analyze this medical document for a patient in ${state || 'an unspecified U.S. state'}.
Output language: ${outputLanguage}

## REQUIREMENTS:
1. Identify the document type
2. Extract ALL key findings, terms, diagnoses, test results, and instructions
3. Explain each medical term in plain language
4. Generate TREATMENT-FOCUSED questions (not billing questions)
5. Create personalized questions for the patient to bring to their appointment
6. Include relevant educational resources
7. Generate live_stream_events showing analysis progress

${language !== 'en' ? `ALL text content MUST be written in ${outputLanguage}. EXCEPTION: Do NOT translate medical terms, test names, medication names, or URLs.` : 'Write all content in English.'}

Output ONLY valid JSON. No markdown, no explanation.`;
    } else {
      const eobInstructions = hasEOB 
        ? `\nIMPORTANT: An EOB (Explanation of Benefits) is provided. Cross-reference EVERY line item.`
        : `\nNOTE: No EOB provided. Suggest the patient request and compare with their EOB.`;

      userPromptText = `Analyze this medical document for a patient in ${state || 'an unspecified U.S. state'}. 
Document type: ${documentType || 'medical bill'}
Output language: ${outputLanguage}
${eobInstructions}

## REQUIREMENTS:
1. Build the episode internal model with all bill lines
2. Calculate pricing benchmarks where possible
3. Detect errors, anomalies, and inconsistencies
4. Generate live_stream_events showing analysis progress
5. Create treatment-focused commonQuestions (NOT billing format questions)
6. Populate all ui_sections for rendering
7. Include legacy fields for backward compatibility

${language !== 'en' ? `ALL text content MUST be written in ${outputLanguage}. EXCEPTION: Do NOT translate CPT codes, dollar amounts, dates, claim numbers, provider names, or URLs.` : 'Write all content in English.'}

Output ONLY valid JSON. No markdown, no explanation.`;
    }

    const contentParts: any[] = [{ type: 'text', text: userPromptText }];
    
    if (documentContent.startsWith('data:')) {
      const base64Data = documentContent.split(',')[1];
      const mimeType = documentContent.split(';')[0].split(':')[1] || 'image/jpeg';
      console.log('Processing document with MIME type:', mimeType);
      contentParts.push({ 
        type: 'image_url', 
        image_url: { url: `data:${mimeType};base64,${base64Data}` } 
      });
    } else {
      contentParts[0].text += `\n\nDocument content:\n${documentContent}`;
    }

    if (eobContent && !isMedicalDoc) {
      if (eobContent.startsWith('data:')) {
        const base64Data = eobContent.split(',')[1];
        const mimeType = eobContent.split(';')[0].split(':')[1] || 'image/jpeg';
        console.log('Processing EOB with MIME type:', mimeType);
        contentParts.push({ 
          type: 'image_url', 
          image_url: { url: `data:${mimeType};base64,${base64Data}` } 
        });
      } else {
        contentParts[0].text += `\n\nEOB document content:\n${eobContent}`;
      }
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: contentParts }
    ];

    console.log('Sending request to AI gateway...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0,
        top_p: 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Service temporarily unavailable. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received, parsing...');
    
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in AI response:', JSON.stringify(data, null, 2));
      throw new Error('No content in AI response');
    }

    let analysisJson = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      analysisJson = jsonMatch[1].trim();
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisJson);
      console.log('Analysis parsed successfully');
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content.substring(0, 500));
      analysis = isMedicalDoc ? createFallbackMedicalDocAnalysis(state || 'US') : createFallbackAnalysis(state || 'US', hasEOB);
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-document function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'An error occurred while analyzing the document' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createFallbackMedicalDocAnalysis(state: string) {
  return {
    episode: {
      episode_summary: { document_type: 'mixed_other', key_findings_count: 0 },
      clinical: { concepts: [], document_type: 'other' }
    },
    ui_sections: {
      live_stream_events: [
        { step: 'ocr_complete', message: 'Document scanned successfully.' },
        { step: 'finalizing', message: 'Analysis complete.' }
      ],
      overview_cards: [
        { title: 'Document Type', value: 'Medical Document', context: 'Please review with your healthcare provider.' }
      ],
      medical_explainer_panel: {
        overall_summary: 'This document contains medical information. Please review with your healthcare provider.',
        concept_blocks: []
      },
      common_questions_panel: { items: [] }
    },
    documentType: 'mixed_other',
    documentTypeLabel: 'Medical Document',
    overview: {
      summary: 'This document contains medical information. Please review with your healthcare provider.',
      mainPurpose: 'Provides medical details about your care.',
      overallAssessment: 'Please discuss any questions or concerns with your healthcare provider.'
    },
    lineByLine: [],
    definitions: [],
    commonlyAskedQuestions: [],
    providerQuestions: [
      { question: 'Can you explain what this document means for my health?', questionEnglish: 'Can you explain what this document means for my health?' }
    ],
    resources: [
      { title: 'MedlinePlus', description: 'Trusted health information', url: 'https://medlineplus.gov/', source: 'NIH' }
    ],
    nextSteps: [
      { step: 'Review this document', details: 'Read through and note any questions.' },
      { step: 'Contact your provider', details: 'Reach out if you have questions about the content.' }
    ]
  };
}

function createFallbackAnalysis(state: string, hasEOB: boolean) {
  return {
    episode: {
      episode_summary: { document_type: 'bill', line_count: 0 },
      bill: { lines: [], totals: { total_billed: 0 } },
      eob: hasEOB ? { lines: [], totals: {} } : null,
      findings: { pricing: [], errors: [], inconsistencies: [], followups: [] }
    },
    ui_sections: {
      live_stream_events: [
        { step: 'ocr_complete', message: 'Scanning your bill and pulling out each line item.' },
        { step: 'entities_extracted', message: 'Identifying charges and service descriptions.' },
        { step: 'finalizing', message: 'Analysis complete.' }
      ],
      overview_cards: [
        { title: 'Document Type', value: 'Medical Bill', context: 'This document contains medical billing information.' }
      ],
      line_item_explainers: [],
      rapid_error_panel: [],
      financial_analysis_panel: {
        summary: 'Unable to fully analyze this bill. Please review manually.',
        line_level: [],
        episode_level: { total_billed: 0, expected_range_low: 0, expected_range_high: 0 }
      },
      next_steps_panel: { actions: [] },
      communication_panel: { billing_template: null, insurance_template: null },
      common_questions_panel: { items: [] }
    },
    documentType: 'bill',
    issuer: 'Healthcare Provider',
    dateOfService: 'See document',
    documentPurpose: 'This document contains medical billing information.',
    charges: [],
    medicalCodes: [],
    faqs: [],
    possibleIssues: [],
    financialAssistance: [],
    patientRights: [],
    actionPlan: [],
    potentialErrors: [],
    needsAttention: [],
    cptCodes: [],
    visitWalkthrough: [
      { order: 1, description: 'You received medical services from the provider.', relatedCodes: [] },
      { order: 2, description: 'The provider documented the services and assigned billing codes.', relatedCodes: [] },
      { order: 3, description: 'This bill was generated based on those services.', relatedCodes: [] }
    ],
    codeQuestions: [],
    billingEducation: {
      billedVsAllowed: 'The billed amount is what the provider charges. If you have insurance, they negotiate an "allowed amount" - often lower than the billed amount.',
      deductibleExplanation: 'Your deductible is the amount you pay out-of-pocket before insurance starts covering costs.',
      copayCoinsurance: 'A copay is a fixed amount per visit. Coinsurance is a percentage of the allowed amount you pay after meeting your deductible.',
      eobSummary: hasEOB ? 'Unable to parse EOB details. Please compare amounts manually.' : null
    },
    stateHelp: {
      state: state,
      medicaidInfo: {
        description: 'Medicaid provides health coverage for eligible low-income individuals.',
        eligibilityLink: 'https://www.medicaid.gov/about-us/beneficiary-resources/index.html'
      },
      debtProtections: [
        'Medical debt under $500 typically cannot appear on your credit report.',
        'You have at least 12 months before most medical debt can be reported to credit bureaus.'
      ],
      reliefPrograms: []
    },
    providerAssistance: {
      providerName: 'Your Healthcare Provider',
      providerType: 'hospital',
      charityCareSummary: 'Many providers offer financial assistance programs.',
      eligibilityNotes: 'Eligibility typically depends on income and family size.'
    },
    debtAndCreditInfo: [
      'Medical debt under $500 typically cannot appear on your credit report.',
      'You have at least 12 months before most medical debt can be reported to credit bureaus.',
      'Paid medical debt must be removed from credit reports within 45 days.'
    ],
    financialOpportunities: [
      {
        title: 'Ask About Financial Assistance',
        description: 'Many providers offer charity care or sliding scale discounts.',
        eligibilityHint: 'Based on income and family size.',
        effortLevel: 'quick_call'
      }
    ],
    providerContactInfo: null,
    actionSteps: [
      { order: 1, action: 'Request an itemized bill', details: 'Call the billing number to get a full breakdown of charges.', relatedIssue: null },
      { order: 2, action: 'Compare with your EOB', details: 'Wait for your Explanation of Benefits to see what you actually owe.', relatedIssue: null },
      { order: 3, action: 'Ask about financial assistance', details: 'Contact the provider\'s financial assistance office.', relatedIssue: null }
    ],
    billingTemplates: [
      {
        target: 'billing',
        purpose: 'Request an itemized bill',
        template: 'Hi, I\'m calling about my account. Can you please send me a fully itemized bill showing each charge with the CPT codes?',
        whenToUse: 'Before paying any bill'
      }
    ],
    insuranceTemplates: [
      {
        target: 'insurance',
        purpose: 'Verify what you owe',
        template: 'I received a bill for a recent visit. Can you confirm what my actual patient responsibility is after insurance?',
        whenToUse: 'To confirm the bill matches what insurance says you owe'
      }
    ],
    whenToSeekHelp: [
      'If billing errors persist after 2-3 attempts, contact your state\'s insurance commissioner.',
      'Hospital patient advocates can help navigate complex billing disputes.',
      'Nonprofit credit counseling agencies can help with medical debt.'
    ],
    billingIssues: [],
    eobData: hasEOB ? {
      claimNumber: 'Unable to parse',
      processedDate: null,
      billedAmount: 0,
      allowedAmount: 0,
      insurancePaid: 0,
      patientResponsibility: 0,
      deductibleApplied: 0,
      coinsurance: 0,
      copay: 0,
      discrepancies: []
    } : null
  };
}
