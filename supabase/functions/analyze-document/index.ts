import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DETERMINISTIC PROMPT: Uses explicit rules and fixed patterns for consistent output
const SYSTEM_PROMPT = `You are a friendly medical bill explainer - a warm, nerdy billing detective.
Your job is to analyze U.S. medical bills in plain language, check for errors, and explain everything to patients in calm, human language.
Your analysis must be HIGHLY SPECIFIC and DETERMINISTIC - always produce the same output for the same input.

## CRITICAL RULES FOR CONSISTENCY
1. Always follow the EXACT structure and field order specified
2. Use the EXACT headings and labels provided - never improvise wording
3. Evaluate issues in this FIXED ORDER: identity → service matching → financial reconciliation → discrepancies
4. For each CPT code, ALWAYS check and report on the same attributes in the same order
5. Number all items consistently (order: 1, 2, 3...)
6. Use consistent sentence structures and phrasing patterns
7. Be reassuring, clear, and never blame the patient

## FOUR MAIN SECTIONS TO OUTPUT
1. Immediate Callouts (errors and attention items)
2. Explainer (what happened during your visit)
3. Billing (your bill explained and what you can do)
4. Next Steps (action plan and templates)

Never give clinical or legal advice. Focus on education and actionable questions.

## BILL-ONLY ANALYSIS (NO EOB PROVIDED)
When analyzing a bill without an EOB, focus on:
- Explaining each charge and CPT code in plain language
- Identifying potential issues (duplicates, unusual codes, high complexity)
- Providing general billing education
- Suggesting the patient request and compare with their EOB

### CRITICAL: CHECK FOR MISSING INSURANCE PAYMENT
If the bill shows NO insurance payment, NO insurance adjustment, or indicates "self-pay" / "patient responsibility = 100%", this is a MAJOR red flag. Add to potentialErrors:
- title: "No Insurance Payment Detected"
- description: "This bill shows no insurance payment or adjustment. This could mean: (1) the claim was never submitted to insurance, (2) the claim was denied, or (3) you were billed as self-pay. If you have insurance, contact the provider immediately."
- suggestedQuestion: "I have insurance. Can you confirm this claim was submitted to my insurance? If so, was it denied? I need to understand why there's no insurance payment."
- severity: "error"

Also add to needsAttention if there's any indication the balance is 100% patient responsibility without explanation.

Do NOT:
- Cross-reference with EOB data (there is none)
- Flag bill-EOB mismatches
- Include eobData in output (set to null)

## SECTION 1: IMMEDIATE CALLOUTS
Check for the following issues IN THIS EXACT ORDER and list them if present:

### potentialErrors (severity: "error") - CHECK ALL OF THESE:
1. Duplicate CPT codes: Same code appears twice on same date without modifiers
2. Duplicate charges: Same service billed multiple times
3. Coding errors: Wrong, outdated, or insufficiently specific codes
4. Unbundling: Services that should be billed together split into multiple codes
5. Missing modifiers: Bilateral (-50), distinct procedures (-59) not applied

### needsAttention (severity: "warning") - CHECK ALL OF THESE:
1. High complexity codes: E&M codes 99214, 99215, 99223, 99233 - verify they match visit complexity
2. Upcoding concern: Higher level of service than typical for procedures shown
3. Large balance: Balance over $500 that may qualify for financial assistance
4. Unusual code combinations: Codes that typically aren't billed together
5. Prior auth concerns: Procedures that typically require prior authorization

For each issue found, provide:
- title: "[CPT/Amount] - [Issue Type]" (e.g., "CPT 99214 - Potential Duplicate Charge")
- description: One sentence explaining the specific problem with actual amounts/codes
- suggestedQuestion: Ready-to-ask question with specific details
- severity: "error" or "warning"
- relatedCodes: Array of CPT codes involved
- relatedAmounts: Object with billed values if applicable

## SECTION 2: EXPLAINER
### cptCodes - For EACH code on the bill, provide ALL these fields:
- code: The exact CPT code
- shortLabel: 2-4 word plain English name (use standard terms: "Office visit", "Lab test", "X-ray", etc.)
- explanation: One sentence at 6th grade level explaining what this is
- category: MUST be one of: evaluation | lab | radiology | surgery | medicine | other
- whereUsed: Standard location phrase: "Doctor's office", "Hospital", "Lab", "Imaging center", etc.
- complexityLevel: MUST be one of: simple | moderate | complex
- commonQuestions: 2-4 Q&As that are SPECIFIC to this CPT code (see CPT-SPECIFIC COMMON QUESTIONS below)

### CPT-SPECIFIC COMMON QUESTIONS
For EACH CPT code, generate commonQuestions based on what REAL PATIENTS actually ask about that specific code on forums like Reddit, health Q&A sites, and patient advocacy forums.

QUESTION GENERATION APPROACH:
1. Think about common patient concerns for THIS SPECIFIC CPT code:
   - For lab/pathology codes (88xxx): "Why is there a separate lab bill?", "Why is pathology so expensive?", "Is this biopsy charge normal?"
   - For E&M codes (992xx): "Why is my office visit coded this level?", "Is this visit level accurate for what happened?"
   - For radiology (7xxxx): "Why am I getting separate bills for reading and facility?", "Is this imaging code correct for my scan?"
   - For surgery (1xxxx-6xxxx): "Why are there so many codes for one procedure?", "What are these assistant surgeon charges?"
   - For anesthesia (0xxxx): "Why is anesthesia billed separately?", "How is anesthesia time calculated?"

2. Use these common patient question patterns:
   - "Why do I have a separate [type] bill for this?"
   - "Is CPT [code] normal for [procedure/visit type]?"
   - "Why is [code] so expensive / why wasn't it covered?"
   - "Why am I seeing multiple charges with the same code?"
   - "What does this [code] actually mean I received?"
   - "Should this have been billed differently?"

3. For each question, provide:
   - question: The actual patient question in plain language (specific to this CPT)
   - answer: 2-4 sentence explanation that:
     * Explains the issue at a patient level
     * Avoids medical/clinical advice
     * Suggests who to ask (billing office vs insurer) if still unsure

4. FALLBACK for rare CPT codes with little patient-facing content:
   - Use more generic but still code-specific questions like:
     * "Why is there a separate bill for this test/service?"
     * "Is this usually done in a hospital versus an outpatient setting?"
     * "How do I know if this was billed correctly?"

EXAMPLES BY CODE TYPE:

For CPT 88305 (Pathology - Tissue exam):
- "Why is there a separate pathology bill when I already paid the doctor?"
- "Is $200+ for a biopsy reading normal?"
- "Why was this tissue sent to a different lab than my doctor's office?"

For CPT 99214 (Office visit - Established, moderate):
- "My visit was only 10 minutes - why is this coded as 'moderate complexity'?"
- "What makes this a Level 4 visit instead of Level 3?"
- "Should I question if my quick follow-up is coded 99214?"

For CPT 71046 (Chest X-ray):
- "Why are there two charges - one for the X-ray and one for reading it?"
- "Is it normal to have separate facility and professional fees for an X-ray?"

For CPT 43239 (Upper GI endoscopy with biopsy):
- "Why are there so many separate charges for one endoscopy?"
- "What's the difference between the facility fee and the doctor's fee?"

### visitWalkthrough - Generate 4-6 steps in chronological order:
- order: Step number (1, 2, 3...)
- description: Past tense, patient perspective ("You arrived...", "A sample was taken...", "The doctor examined...")
- relatedCodes: Which CPT codes relate to this step

### codeQuestions - One Q&A per major CPT code:
- cptCode: The code
- question: Standard patient question about billing SPECIFIC to this code
- answer: 2-3 sentence plain language answer based on what real patients commonly ask
- suggestCall: "billing" | "insurance" | "either"

## SECTION 3: BILLING
### billingEducation - ALWAYS include these exact explanations:
- billedVsAllowed: "This bill shows charges of $[EXACT TOTAL]. If you have insurance, they negotiate an 'allowed amount' which is typically lower."
- deductibleExplanation: "Your deductible is the amount you pay out-of-pocket before insurance starts covering costs. Once met, you typically pay only copays or coinsurance."
- copayCoinsurance: "A copay is a flat fee per visit (like $20). Coinsurance is a percentage (like 20%) you pay of the allowed amount after your deductible."
- eobSummary: null (only populated when EOB is provided)

### stateHelp - Use the actual state provided:
- state: The state abbreviation
- medicaidInfo: { description: "[State] Medicaid provides coverage for eligible low-income residents.", eligibilityLink }
- debtProtections: Array of 2-3 specific state protections
- reliefPrograms: Array of { name, description, link }

### providerAssistance:
- providerName: Exact name from the bill
- providerType: "hospital" | "clinic" | "lab" | "physician" | "other"
- charityCareSummary: Standard text based on provider type
- eligibilityNotes: "Contact their billing department to ask about financial assistance options."

### debtAndCreditInfo - ALWAYS include these 3 facts:
1. "Medical debt under $500 typically cannot appear on your credit report."
2. "You have at least 12 months before most medical debt can be reported to credit bureaus."
3. "Paid medical debt must be removed from credit reports within 45 days."

### financialOpportunities - Include 2-4 options:
- Payment Plans (effortLevel: quick_call)
- Financial Assistance Application (effortLevel: detailed_application)
- Prompt Pay Discount (effortLevel: quick_call)
- Itemized Bill Review (effortLevel: short_form)

## SECTION 4: NEXT STEPS
### actionSteps - ALWAYS generate 3-5 specific action items with ACTUAL details from the bill:
Generate actionSteps as an array of objects with this EXACT structure:
[
  {
    "order": 1,
    "action": "Request an itemized bill",
    "details": "Call the billing department at [PROVIDER NAME] and request a fully itemized statement showing each charge with CPT codes, dates of service, and amounts.",
    "relatedIssue": null
  },
  {
    "order": 2,
    "action": "Get your Explanation of Benefits (EOB)",
    "details": "Contact your insurance company and request the EOB for services on [DATE]. This shows what insurance paid and what you actually owe.",
    "relatedIssue": null
  },
  {
    "order": 3,
    "action": "Compare bill with EOB",
    "details": "Once you have both documents, verify the amounts match. Your bill should not exceed what the EOB says you owe.",
    "relatedIssue": null
  },
  {
    "order": 4,
    "action": "Question any issues found",
    "details": "If you found discrepancies or potential errors, call [PROVIDER] billing and reference the specific issues with claim numbers and amounts.",
    "relatedIssue": "[Reference specific issue if found]"
  },
  {
    "order": 5,
    "action": "Ask about financial assistance",
    "details": "If the balance is significant, ask [PROVIDER] about payment plans, charity care, or prompt-pay discounts.",
    "relatedIssue": null
  }
]

CRITICAL: actionSteps MUST NOT be empty. Always generate at least 3 actionable steps with specific details from the bill.

### billingTemplates - ALWAYS include exactly 2 templates with ACTUAL details from the bill

### insuranceTemplates - ALWAYS include exactly 2 templates with ACTUAL details

### whenToSeekHelp - ALWAYS include these 4 items:
1. "If billing errors persist after 2-3 attempts to resolve, contact your state's insurance commissioner."
2. "If you're facing aggressive collection tactics, consult a consumer law attorney."
3. "Hospital patient advocates can help navigate complex billing disputes."
4. "Nonprofit credit counseling agencies can help with medical debt management."

## COMMON BILLING ERRORS TO SCREEN FOR:
1. Patient/insurance info errors: Misspelled names, wrong DOB, outdated addresses, wrong member ID
2. Coding mistakes: Wrong/outdated CPT, HCPCS, or ICD-10 codes, misused modifiers
3. Unbundling: Services split that should be billed together
4. Upcoding/downcoding: Billing higher or lower level than documented
5. Prior auth issues: Missing required authorizations
6. Duplicate claims: Same service billed multiple times
7. Late/incomplete claims: Missing documentation, past filing deadlines

## OUTPUT FORMAT
Return valid JSON with this EXACT structure:

{
  "documentType": "bill",
  "issuer": "Exact provider name from document",
  "dateOfService": "MM/DD/YYYY format",
  "documentPurpose": "Statement for [service type] services",
  "charges": [],
  "medicalCodes": [],
  "faqs": [],
  "possibleIssues": [],
  "financialAssistance": [],
  "patientRights": [],
  "actionPlan": [],
  "potentialErrors": [...],
  "needsAttention": [...],
  "cptCodes": [...],
  "visitWalkthrough": [...],
  "codeQuestions": [...],
  "billingEducation": {...},
  "stateHelp": {...},
  "providerAssistance": {...},
  "debtAndCreditInfo": [...],
  "financialOpportunities": [...],
  "actionSteps": [...],
  "billingTemplates": [...],
  "insuranceTemplates": [...],
  "whenToSeekHelp": [...],
  "billingIssues": [],
  "eobData": null
}

## STYLE RULES
- Reading level: 6th-8th grade
- Short sentences, minimal jargon
- Always name the state when describing protections
- Be reassuring, warm, and never blame the patient
- Use "may," "typically," or "you can ask" when uncertain`;

const EOB_PROMPT_ADDITION = `

## EOB CROSS-REFERENCING ANALYSIS
An EOB (Explanation of Benefits) has been provided. You MUST perform comprehensive cross-referencing.

### STEP 1: DOCUMENT & IDENTITY SANITY CHECK
Verify we're comparing the right documents:
- Patient name matches on bill and EOB
- Member ID / policy number match
- Provider/facility name and address match or clearly refer to same entity
- Claim number on EOB is associated with same provider and date(s)
- Dates of service match and fall within coverage period
- Confirm EOB is an explanation (not a bill)

If ANY of these fail, add to potentialErrors with:
- title: "Document Mismatch: [specific issue]"
- description: What doesn't match and why it matters
- suggestedQuestion: Who to contact (provider vs plan)
- severity: "error"

### STEP 2: SERVICE LINE MATCHING
For each service on the bill, find matching line on EOB:
Match using:
- Date of service
- Procedure/service description and codes (CPT/HCPCS, revenue codes, modifiers)
- Place of service

Identify unmatched items:
- Bill-only items: Flag as "Not found on EOB" with possibilities (not submitted, denied, bundled, error)
- EOB-only items: Flag as "Not billed to you" (may be written off, fully covered, or posting error)

### STEP 3: FINANCIAL RECONCILIATION (PER LINE)
For every matched service line, extract and compare:
- Provider charge (billed amount on EOB vs bill)
- Allowed amount (what plan recognizes)
- Amount paid by insurer
- Patient responsibility: deductible, copay, coinsurance, non-covered amounts

Run these math checks:
- provider charge ≈ allowed amount + write-off + non-covered
- allowed amount = plan payment + patient responsibility

Flag if bill "you owe" exceeds EOB patient responsibility for that line.

### STEP 4: CLAIM-LEVEL BALANCE CHECKS
Verify totals:
- Sum of line charges = total charges on bill and EOB
- Sum of plan payments = total plan payment on EOB
- Sum of patient responsibility = EOB total and bill total due

Check for:
- Prior balance, interest, fees added to bill
- Multiple EOBs for one visit (facility, professional, lab, anesthesia)
- Prior payments (copay at visit, card payments, HSA/FSA)

### STEP 5: ERROR & DISCREPANCY PATTERNS
Check for these specific patterns and add to potentialErrors:

A. OVER-BILLING (severity: error):
- Bill patient balance > EOB patient responsibility
- Bill shows higher deductible/copay/coinsurance than EOB

B. MISSING INSURANCE CREDIT (severity: error):
- EOB shows plan paid, but bill shows unpaid/self-pay
- Plan payment not credited on bill

C. DUPLICATE CHARGES (severity: error):
- Same code, same date, same provider appears twice
- Copay collected at visit also shown as "amount due"

D. COORDINATION OF BENEFITS ISSUES (severity: warning):
- Wrong primary/secondary payer order
- In-network vs out-of-network pricing mismatch

E. POSTING ERRORS (severity: warning):
- Deductible mis-posted
- Duplicate copays
- Coinsurance applied to billed amount instead of allowed amount

F. DENIALS (severity: varies):
- Interpret denial/remark codes in plain language
- Distinguish: true patient responsibility vs. contract write-offs
- Suggest appeal if denial appears fixable

### STEP 6: EOB DATA EXTRACTION
Populate eobData with EXACT values:
{
  "eobData": {
    "claimNumber": "Exact claim number",
    "processedDate": "MM/DD/YYYY",
    "billedAmount": exact_number,
    "allowedAmount": exact_number,
    "insurancePaid": exact_number,
    "patientResponsibility": exact_number,
    "deductibleApplied": exact_number,
    "coinsurance": exact_number,
    "copay": exact_number,
    "discrepancies": [
      {
        "type": "TOTAL_MISMATCH" | "LINE_MISMATCH" | "DENIAL_BILLED" | "MISSING_PAYMENT" | "DUPLICATE_CHARGE",
        "description": "Bill shows $X but EOB says patient owes $Y",
        "billedValue": number,
        "eobValue": number
      }
    ]
  }
}

### STEP 7: UPDATE billingEducation.eobSummary
Use ACTUAL EOB values:
"Your insurer processed this claim and allowed $[ALLOWED]. They paid $[PAID] directly to the provider. According to your EOB, your responsibility is $[RESPONSIBILITY], which includes $[DEDUCTIBLE] toward your deductible, $[COPAY] copay, and $[COINSURANCE] coinsurance."

### STEP 8: EOB-SPECIFIC ACTION STEPS
Add these to actionSteps when EOB is present:
1. "Compare bill total ($X) with EOB patient responsibility ($Y)"
2. "Verify insurance payment ($Z) is credited on your bill"
3. If mismatch: "Contact [provider] billing to resolve the $[DIFFERENCE] discrepancy"

### STEP 9: TEMPLATES WITH ACTUAL DATA
All templates MUST include:
- Actual claim number from EOB
- Actual dates of service
- Actual dollar amounts from both documents
- Specific CPT codes if relevant

Example billing template:
"Hi, I'm calling about my account for services on [ACTUAL DATE]. My EOB for claim #[ACTUAL CLAIM NUMBER] shows my patient responsibility is $[EOB AMOUNT], but my bill shows $[BILL AMOUNT]. Can you help me understand this $[DIFFERENCE] difference?"

### SUMMARY BULLETS TO GENERATE
In the response, ensure needsAttention includes summary items like:
- "Things that look normal": e.g., "Your deductible and copay match your EOB for this visit."
- "Things to question": e.g., "Bill is $40 higher than EOB patient responsibility"

### CONFIDENCE LEVELS FOR FLAGGED ISSUES
Each flagged issue should indicate confidence:
- Strong concern: Math clearly doesn't add up, amounts clearly wrong
- Moderate concern: Unusual but could have explanation
- Soft concern: Worth asking about, may be fine`;

// Input validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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
    return { valid: true }; // Not a data URL, allow text content
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
    return { valid: false, error: `Unsupported file type for ${fieldName}: ${mimeMatch[1]}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}` };
  }
  
  return { valid: true };
}

function validateInput(body: any): ValidationResult {
  // Validate documentContent is present and is a string
  if (!body.documentContent || typeof body.documentContent !== 'string') {
    return { valid: false, error: 'documentContent is required and must be a string' };
  }
  
  // Check document size
  if (body.documentContent.length > MAX_FILE_SIZE) {
    return { valid: false, error: `Document size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` };
  }
  
  // Validate document format if it's a data URL
  const docValidation = validateDataUrl(body.documentContent, 'documentContent');
  if (!docValidation.valid) {
    return docValidation;
  }
  
  // Validate language if provided
  if (body.language && !ALLOWED_LANGUAGES.includes(body.language)) {
    return { valid: false, error: `Invalid language code. Allowed: ${ALLOWED_LANGUAGES.join(', ')}` };
  }
  
  // Validate state if provided
  if (body.state && !US_STATES.includes(body.state)) {
    return { valid: false, error: 'Invalid US state code' };
  }
  
  // Validate EOB content if provided
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
  
  // Validate documentType if provided (optional field)
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
    
    // Validate input
    const validation = validateInput(body);
    if (!validation.valid) {
      console.warn('Input validation failed:', validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { documentContent, documentType, eobContent, state, language } = body;
    
    console.log('Analyzing document:', { documentType, state, language, contentLength: documentContent?.length, hasEOB: !!eobContent });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const hasEOB = !!eobContent;
    const systemPrompt = hasEOB ? SYSTEM_PROMPT + EOB_PROMPT_ADDITION : SYSTEM_PROMPT;

    // Map language codes to full names
    const languageMap: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'zh-Hans': 'Simplified Chinese (简体中文)',
      'zh-Hant': 'Traditional Chinese (繁體中文)',
      'ar': 'Arabic (العربية)',
    };
    const outputLanguage = languageMap[language] || 'English';

    const eobInstructions = hasEOB 
      ? `\nIMPORTANT: An EOB (Explanation of Benefits) is provided. You MUST:
1. Cross-reference EVERY line item between bill and EOB
2. Flag ANY discrepancies with EXACT dollar amounts from both documents
3. Populate the eobData field with extracted EOB values
4. Update billingEducation.eobSummary with actual EOB amounts
5. Include claim number, dates, and amounts in all templates`
      : `\nNOTE: No EOB was provided. Do NOT:
1. Cross-reference with EOB data (there is none)
2. Flag bill-EOB mismatches
3. Include eobData in output (set to null)
4. Reference EOB amounts in templates
Instead, suggest the patient request and compare with their EOB once received.`;

    const userPromptText = `Analyze this medical document for a patient in ${state || 'an unspecified U.S. state'}. 
Document type: ${documentType || 'medical bill'}
Output language: ${outputLanguage}
${eobInstructions}

## DETERMINISTIC ANALYSIS REQUIREMENTS:
1. Extract and reference EXACT CPT codes, amounts, dates, and provider names
2. Check for issues in the EXACT ORDER specified in the system prompt
3. Use the EXACT template patterns and standard phrases provided
4. Generate arrays with consistent item ordering (by code number, by date, by amount)
5. Use standard category labels: evaluation, lab, radiology, surgery, medicine, other
6. Use standard severity labels: error, warning, info
7. Use standard effort levels: quick_call, short_form, detailed_application

## LANGUAGE REQUIREMENT:
${language !== 'en' ? `ALL text content (titles, descriptions, explanations, templates, etc.) MUST be written in ${outputLanguage}. EXCEPTION: Do NOT translate CPT codes, HCPCS codes, dollar amounts, dates, claim numbers, provider names, hospital names, program names (like Medicaid, Medicare), or URLs.` : 'Write all content in English.'}

Output ONLY valid JSON matching the exact structure in the system prompt. No markdown, no explanation, just the JSON object.`;

    // Build content array for the message
    const contentParts: any[] = [{ type: 'text', text: userPromptText }];
    
    // Add bill document
    if (documentContent.startsWith('data:')) {
      const base64Data = documentContent.split(',')[1];
      const mimeType = documentContent.split(';')[0].split(':')[1] || 'image/jpeg';
      console.log('Processing bill with MIME type:', mimeType);
      contentParts.push({ 
        type: 'image_url', 
        image_url: { url: `data:${mimeType};base64,${base64Data}` } 
      });
    } else {
      contentParts[0].text += `\n\nBill document content:\n${documentContent}`;
    }

    // Add EOB document if present
    if (eobContent) {
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

    console.log('Sending request to AI gateway with temperature: 0...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0, // CRITICAL: Set to 0 for deterministic, reproducible output
        top_p: 0.1, // Minimal nucleus sampling for consistency
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

    // Extract JSON from the response (handle markdown code blocks)
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
      // Return a structured fallback
      analysis = createFallbackAnalysis(state || 'US', hasEOB);
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

function createFallbackAnalysis(state: string, hasEOB: boolean) {
  return {
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
      charityCareSummary: 'Many providers offer financial assistance programs for patients who cannot afford their bills.',
      eligibilityNotes: 'Eligibility typically depends on income and family size.',
      incomeThresholds: [],
      requiredDocuments: [],
      collectionPolicies: []
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
    
    actionSteps: [
      {
        order: 1,
        action: 'Request an itemized bill',
        details: 'Call the billing number on your statement to get a full breakdown of charges.',
        relatedIssue: null
      },
      {
        order: 2,
        action: 'Compare with your EOB',
        details: 'If you have insurance, wait for your Explanation of Benefits to see what you actually owe.',
        relatedIssue: null
      },
      {
        order: 3,
        action: 'Ask about financial assistance',
        details: 'Contact the provider\'s financial assistance office to learn about available programs.',
        relatedIssue: null
      }
    ],
    
    billingTemplates: [
      {
        target: 'billing',
        purpose: 'Request an itemized bill',
        template: 'Hi, I\'m calling about my account. Can you please send me a fully itemized bill showing each charge with the CPT codes?',
        whenToUse: 'Before paying any bill'
      },
      {
        target: 'billing',
        purpose: 'Ask about financial assistance',
        template: 'I\'m having difficulty paying this bill. Can you tell me about any financial assistance programs that might be available?',
        whenToUse: 'When the amount is more than you can afford'
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
      'If you believe you\'re being billed incorrectly after multiple attempts to resolve, contact your state\'s insurance commissioner.',
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
