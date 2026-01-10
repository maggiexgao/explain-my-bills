import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// POND PROMPT: Patient-advocacy focused bill analysis
const SYSTEM_PROMPT = `You are Pond, a calm, trustworthy patient-advocacy assistant.

Your job is to help people:
- Understand what a medical bill is asking them to pay
- Identify errors or negotiable charges
- Know exactly what to say and do next to reduce or confirm the bill

You are not a doctor, lawyer, or insurer. You specialize in billing clarity, leverage, and confidence.

## STEP 0 — DOCUMENT VALIDATION
If the document does NOT contain charges, costs, or billing details, return:
{ "notABill": true, "message": "This doesn't appear to be a medical bill..." }

## STEP 1 — ASSUME SPARSE DATA
Assume most bills are low-detail. Extract maximum leverage even from minimal information.

## OUTPUT REQUIREMENTS
You MUST output ALL of the following Pond sections in your JSON response:

### atAGlance (REQUIRED)
{
  "visitSummary": "Plain English description of the visit",
  "totalBilled": number or null,
  "amountYouMayOwe": number or null,
  "status": "looks_standard" | "worth_reviewing" | "likely_issues",
  "statusExplanation": "One sentence: Based on what's shown here..."
}

### thingsWorthReviewing (REQUIRED - array, can be empty)
[{ "whatToReview": "...", "whyItMatters": "...", "issueType": "error|negotiable|missing_info|confirmation" }]

### reviewSectionNote (optional string)
Message if nothing to review or EOB would help.

### savingsOpportunities (REQUIRED - array)
[{ "whatMightBeReduced": "...", "whyNegotiable": "...", "additionalInfoNeeded": "optional", "savingsContext": "optional" }]

### conversationScripts (REQUIRED)
{ "firstCallScript": "...", "ifTheyPushBack": "...", "whoToAskFor": "..." }

### chargeMeanings (REQUIRED - array)
[{ "cptCode": "optional", "procedureName": "...", "explanation": "...", "commonBillingIssues": [], "isGeneral": true/false }]

### negotiability (REQUIRED - array)
[{ "chargeOrCategory": "...", "level": "highly_negotiable|sometimes_negotiable|rarely_negotiable|generally_fixed", "reason": "..." }]

### priceContext (REQUIRED)
{ "hasBenchmarks": true/false, "comparisons": [], "fallbackMessage": "..." }

### pondNextSteps (REQUIRED - array)
[{ "step": "...", "isUrgent": false }]

### closingReassurance (REQUIRED)
"Medical bills are often negotiable, and asking questions is normal. You're not being difficult — you're being careful."

## CRITICAL RULES FOR CONSISTENCY

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

### CRITICAL: CPT/HCPCS CODE VALIDATION
ONLY extract codes that match these EXACT formats:
- CPT codes: Exactly 5 digits (e.g., 99284, 77386, 43239)
- HCPCS Level II: One letter followed by 4 digits (e.g., A0428, J1885, G0463)

NEVER treat these words as codes: LEVEL, VISIT, TOTAL, CHARGE, AMOUNT, UNITS, UNIT, QTY, DATE, ER, OFFICE, FACILITY, SERVICE, ROOM, EMERGENCY, PATIENT, PROVIDER

A valid code MUST:
1. Match the format above (5 digits OR 1 letter + 4 digits)
2. Appear in a context suggesting it's a procedure code (near "CPT", "HCPCS", "CODE", "PROC", or on a line with a dollar amount)
3. NOT be part of a date (like 03/19/09), phone number, or account number

### cptCodes - For EACH validated code on the bill, provide ALL these fields:
- code: The exact CPT/HCPCS code (MUST be 5 digits or letter + 4 digits)
- shortLabel: 2-4 word plain English name (use standard terms: "Office visit", "Lab test", "X-ray", etc.)
- explanation: One sentence at 6th grade level explaining what this is
- category: MUST be one of: evaluation | lab | radiology | surgery | medicine | other
- whereUsed: Standard location phrase: "Doctor's office", "Hospital", "Lab", "Imaging center", etc.
- complexityLevel: MUST be one of: simple | moderate | complex
- commonQuestions: 2-4 Q&As that focus on PATIENT CONCERNS ABOUT THE TREATMENT ITSELF (see TREATMENT-FOCUSED COMMON QUESTIONS below)

### TREATMENT-FOCUSED COMMON QUESTIONS
For EACH CPT code, generate commonQuestions that help patients understand THE MEDICAL TREATMENT OR SERVICE itself - NOT billing format questions.

CRITICAL: Focus on what real patients ask about the underlying medical procedure, treatment, or test - NOT on billing mechanics like "why does this code appear multiple times."

QUESTION GENERATION APPROACH:
1. Research what the CPT code represents clinically:
   - What treatment, procedure, or service does this code describe?
   - What does the patient actually experience during this service?
   - What are typical patient concerns about this specific treatment?

2. Generate questions about THE TREATMENT, such as:
   - "What does this [treatment/procedure] do and why do I need it?"
   - "How many sessions/treatments are typical for [procedure]?"
   - "What side effects should I watch for from [treatment]?"
   - "How should I prepare for [procedure] and what will it feel like?"
   - "What happens during a [treatment name] session?"
   - "Are there any precautions I need to take after [procedure]?"
   - "How long does recovery take from [treatment]?"

3. For each question, provide:
   - question: Patient-friendly question about the treatment/procedure itself
   - answer: 2-4 sentence educational explanation that:
     * Explains what the treatment does in plain language
     * Describes what to expect (sensations, duration, recovery)
     * Mentions common side effects if applicable
     * References reputable sources like MedlinePlus, RadiologyInfo, or major medical centers
     * Ends with "Discuss any specific concerns with your healthcare provider."

4. CODE-SPECIFIC TREATMENT QUESTIONS:

For radiation therapy codes (77386 - IMRT, 77385, etc.):
- "What is IMRT radiation therapy and how does it work?"
  Answer: Explains IMRT targets tumors precisely, what a session feels like, typical 5-7 week course
- "What side effects should I expect from radiation therapy?"
  Answer: Common effects like fatigue, skin changes, and when to call the doctor
- "Will I be radioactive after treatment? Are there precautions for my family?"
  Answer: External beam doesn't make you radioactive, no special precautions needed

For radiation physics codes (77336 - Continuing medical physics):
- "What does the physics consult do for my radiation treatment?"
  Answer: Explains quality checks, calibration, safety monitoring by medical physicists
- "Why is there a separate physics charge for my radiation treatment?"
  Answer: Explains weekly QA is standard of care for treatment accuracy

For imaging codes (7xxxx):
- "How should I prepare for this imaging test?"
- "Is the radiation exposure from this scan safe?"
- "How long will this imaging procedure take?"

For surgery codes (1xxxx-6xxxx):
- "What happens during this surgical procedure?"
- "What is the typical recovery time for this surgery?"
- "What complications should I watch for after the procedure?"

For lab/pathology codes (88xxx):
- "What will the lab results tell my doctor?"
- "How long does it take to get results from this test?"
- "What does it mean if my test results are abnormal?"

5. ONLY ONE billing question allowed per CPT (if needed):
   - "Why might I receive multiple bills for this service?"
   - Place this LAST after the treatment-focused questions.

### visitWalkthrough - Generate 4-6 steps in chronological order:
- order: Step number (1, 2, 3...)
- description: Past tense, patient perspective ("You arrived...", "A sample was taken...", "The doctor examined...")
- relatedCodes: Which CPT codes relate to this step

### codeQuestions - One Q&A per major CPT code:
- cptCode: The code
- question: Patient question about THE TREATMENT or what to expect - NOT billing format questions
- answer: 2-3 sentence educational answer about the medical service, what to expect, or common patient concerns. Reference reputable sources when relevant.
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

## SECTION 4: NEXT STEPS (SAVINGS-FOCUSED)

The overarching goal of the action plan is to help the patient SAVE MONEY or avoid overpaying. Prioritize actions in this order:

### ACTION PRIORITY ORDER:
1. **Fix possible errors / overbilling** (highest priority - direct savings)
   - Dispute specific line items with errors
   - Request correction of coding/quantity mistakes
   - Challenge duplicate charges
   
2. **Reduce the amount owed via programs and policies**
   - Ask about financial assistance / charity care
   - Request self-pay discounts, prompt-pay discounts, or income-based reductions
   - Check eligibility for state or hospital programs that limit medical debt
   
3. **Escalate when necessary**
   - Appeal with insurer if coverage seems wrong
   - Contact regulators or legal aid if billing seems illegal (surprise billing, illegal collections)
   
4. **If all else fails, set up manageable payments** (lowest priority)
   - Negotiate zero-interest or low-interest payment plans
   - Ensure payment terms are documented and affordable

### ALL CLEAR SCENARIO:
If after running all checks you find:
- No Potential Errors
- No "Needs Attention" items
- Charges and coverage appear internally consistent

Then set potentialErrors and needsAttention to empty arrays [], and generate ONLY 1-2 minimal action steps focused on:
- "Save a copy of this bill and EOB for your records."
- "If you still have concerns, contact your insurer or provider for verification."

Do NOT generate a long list of tasks for all-clear cases.

### providerContactInfo - ALWAYS extract from the bill:
Extract the provider's contact information from the bill and populate this object. Look for these in the "billing questions", "customer service", "payment information", or header sections of the bill:
{
  "providerContactInfo": {
    "providerName": "Exact billing entity name from the bill (hospital/provider name)",
    "billingPhone": "Phone number in billing/customer service/questions area (format: (XXX) XXX-XXXX)",
    "billingEmail": "Email for billing questions if listed, otherwise null",
    "mailingAddress": "Address shown for payments or correspondence",
    "insurerName": "Insurance company name if visible on bill or EOB",
    "memberServicesPhone": "Insurance member services number if on EOB",
    "memberServicesEmail": "Insurance contact email if on EOB, otherwise null"
  }
}

If a field cannot be found on the documents, set it to null. Never make up contact information - only use what's actually on the documents.

### actionSteps - Generate SAVINGS-FOCUSED action items:
Each action step MUST have a clear money-saving goal. Structure:
[
  {
    "order": 1,
    "action": "[Money-focused action title]",
    "details": "[Plain language explanation of how this saves money]",
    "relatedIssue": "[Link to specific issue from Immediate Callouts if applicable]"
  }
]

PRIORITY-ORDERED EXAMPLES (use only relevant ones based on bill analysis):

**If errors found:**
{
  "order": 1,
  "action": "Dispute the [specific error/duplicate charge]",
  "details": "Call [PROVIDER] billing and ask them to review [specific CPT code or charge]. This may reduce your bill by $[AMOUNT].",
  "relatedIssue": "[Title of related error from potentialErrors]"
}

**If high balance:**
{
  "order": 2,
  "action": "Ask about financial assistance",
  "details": "Contact [PROVIDER] billing and ask: 'Do you offer charity care, income-based discounts, or financial hardship programs?' Many hospitals reduce bills by 50-100% for qualifying patients.",
  "relatedIssue": null
}

{
  "order": 3,
  "action": "Request a prompt-pay or self-pay discount",
  "details": "Ask [PROVIDER]: 'If I pay in full today, can I get a discount?' Many providers offer 10-30% off for immediate payment.",
  "relatedIssue": null
}

**If insurance issues:**
{
  "order": 4,
  "action": "Appeal the insurance denial",
  "details": "Contact your insurance at [PHONE] and file a formal appeal. Reference claim #[NUMBER] and ask for a supervisor review.",
  "relatedIssue": "[Title of related denial issue]"
}

**If out-of-network / surprise billing:**
{
  "order": 5,
  "action": "File a No Surprises Act complaint",
  "details": "This may be a surprise bill covered by federal law. Contact CMS at 1-800-985-3059 or file online at cms.gov/nosurprises.",
  "relatedIssue": "[Title of related out-of-network issue]"
}

**Last resort:**
{
  "order": 6,
  "action": "Set up a 0% interest payment plan",
  "details": "If you must pay the full amount, ask [PROVIDER] for a monthly payment plan with NO interest. Get the terms in writing before agreeing.",
  "relatedIssue": null
}

CRITICAL: 
- Each step title must clearly state the money-saving goal
- Include "relatedIssue" that ties back to specific issues from Immediate Callouts when applicable
- De-emphasize "get more information" steps unless tied to a downstream savings action
- For all-clear cases, generate only 1-2 simple record-keeping steps

### billingTemplates - Generate ONE ready-to-send email template:
Create a SINGLE professional, ready-to-send email/message template for the billing department. This template must:
1. Auto-fill ALL specific details from the bill (provider name, claim number, dates, amounts)
2. List ALL billing issues found in a numbered, organized format
3. Be professional but kind and concise
4. Be formatted as an email with Subject line

TEMPLATE FORMAT:
{
  "target": "billing",
  "purpose": "Billing Department - Bill Review Request",
  "template": "Subject: Question about bill for claim #[ACTUAL_CLAIM_NUMBER_FROM_BILL]\\n\\nHello [ACTUAL_PROVIDER_NAME] billing team,\\n\\nI am reviewing my bill for date(s) of service [ACTUAL_DATE_FROM_BILL].\\n\\nI have the following questions about my statement:\\n\\n[NUMBERED LIST OF ALL ISSUES FROM THE ANALYSIS:\\n1. [First issue with specific amounts/codes]\\n2. [Second issue with specific amounts/codes]\\netc.]\\n\\nMy bill shows a total of $[ACTUAL_BILL_AMOUNT]. [IF EOB: My Explanation of Benefits shows my responsibility as $[EOB_PATIENT_RESP].]\\n\\nCould you please:\\n- Review these items and confirm whether the charges are correct\\n- Provide an updated statement if any adjustments apply\\n- Share information about payment plans or financial assistance if available\\n\\nThank you for your assistance.\\n\\n[PATIENT_NAME]\\n[PATIENT_PHONE if known]",
  "templateEnglish": "[Same template in English if different language selected]",
  "whenToUse": "Send this email or read it when calling the billing department to address all issues at once.",
  "contactInfo": {
    "name": "[ACTUAL_PROVIDER_NAME from bill]",
    "phone": "[ACTUAL_BILLING_PHONE from bill]",
    "email": "[ACTUAL_BILLING_EMAIL if found]",
    "address": "[ACTUAL_MAILING_ADDRESS from bill]"
  },
  "filledData": {
    "claimNumber": "[ACTUAL_CLAIM_NUMBER or account number]",
    "dateOfService": "[ACTUAL_DATE]",
    "providerName": "[ACTUAL_PROVIDER_NAME]",
    "billedAmount": [ACTUAL_TOTAL_AMOUNT_NUMBER],
    "eobPatientResponsibility": [EOB_AMOUNT or null],
    "discrepancyAmount": [DIFFERENCE or null]
  }
}

### insuranceTemplates - Generate ONE ready-to-send template for insurance:
Create a SINGLE professional template for contacting the insurance company. This template must:
1. Auto-fill ALL specific details (claim number, provider, dates, amounts)
2. List ALL insurance-related issues from the analysis
3. Be formatted as a script or email

TEMPLATE FORMAT:
{
  "target": "insurance",
  "purpose": "Insurance - Claim Review Request",
  "template": "Subject: Question about claim #[ACTUAL_CLAIM_NUMBER] for [ACTUAL_DATE]\\n\\nHello,\\n\\nI am reviewing a claim for services on [ACTUAL_DATE] from [ACTUAL_PROVIDER_NAME].\\n\\nI have the following concerns about how this claim was processed:\\n\\n[NUMBERED LIST OF INSURANCE-RELATED ISSUES:\\n1. [Issue with specific amounts/codes]\\n2. [Issue with specific amounts/codes]\\netc.]\\n\\nMy bill shows $[BILL_AMOUNT], but [describe discrepancy if any].\\n\\nCould you please:\\n- Confirm the allowed amount and what was paid for this claim\\n- Explain the patient responsibility breakdown (deductible, copay, coinsurance)\\n- Advise if any denials can be appealed\\n\\nThank you for your assistance.\\n\\n[PATIENT_NAME]\\nMember ID: [MEMBER_ID if known]",
  "templateEnglish": "[Same template in English if different language selected]",
  "whenToUse": "Use when calling member services or sending a message through your insurance portal.",
  "contactInfo": {
    "name": "[INSURANCE_COMPANY_NAME]",
    "phone": "[MEMBER_SERVICES_PHONE from EOB]",
    "email": "[MEMBER_SERVICES_EMAIL if available]"
  },
  "filledData": {
    "claimNumber": "[ACTUAL_CLAIM_NUMBER]",
    "dateOfService": "[ACTUAL_DATE]",
    "providerName": "[ACTUAL_PROVIDER_NAME]",
    "billedAmount": [ACTUAL_TOTAL_AMOUNT_NUMBER],
    "eobPatientResponsibility": [EOB_AMOUNT or null],
    "discrepancyAmount": [DIFFERENCE or null]
  }
}

CRITICAL: Replace ALL bracketed placeholders with ACTUAL values from the documents. Only use [PATIENT_NAME] and [MEMBER_ID] as placeholders since those aren't on the bill.

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
  "providerContactInfo": {...},
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

// CPT/HCPCS Code Validation - STRICT
const CPT_PATTERN = /^\d{5}$/;
const HCPCS_PATTERN = /^[A-Z]\d{4}$/;

// Comprehensive list of words that should NEVER be treated as codes
const REJECTED_WORDS = new Set([
  // Common bill labels
  'LEVEL', 'VISIT', 'TOTAL', 'CHARGE', 'SERVICE', 'PRICE', 'AMOUNT',
  'CMPLX', 'COMPLEX', 'SIMPLE', 'MODERATE', 'MINOR', 'MAJOR',
  // People/places
  'PATIENT', 'PROVIDER', 'HOSPITAL', 'CLINIC', 'DOCTOR', 'NURSE',
  // Date/time
  'DATE', 'TIME', 'PAGE', 'YEAR', 'MONTH', 'DAY',
  // Bill structure
  'BILL', 'STATEMENT', 'INVOICE', 'ACCOUNT', 'CLAIM', 'NUMBER',
  'BALANCE', 'PAYMENT', 'CREDIT', 'DEBIT', 'INSURANCE', 'COPAY',
  'DEDUCTIBLE', 'COINSURANCE', 'ALLOWED', 'BILLED', 'PAID', 'DUE',
  // Code-related labels
  'DESCRIPTION', 'CODE', 'PROCEDURE', 'DIAGNOSIS', 'MODIFIER',
  'HCPCS', 'ICD', 'REV', 'REVENUE',
  // Quantities
  'UNIT', 'UNITS', 'QTY', 'QUANTITY', 'EACH', 'PER',
  // Locations
  'ROOM', 'EMERGENCY', 'FACILITY', 'OFFICE', 'OUTPATIENT', 'INPATIENT',
  'AMBULATORY', 'PHARMACY', 'LABORATORY', 'RADIOLOGY', 'SURGICAL',
  'MEDICAL', 'NAME', 'ADDRESS', 'PHONE', 'FAX', 'EMAIL',
  // Common abbreviations that aren't codes
  'ER', 'ED', 'OR', 'PT', 'OT', 'IV', 'IM', 'PO', 'BID', 'TID', 'QID',
  'PRN', 'STAT', 'ASA', 'BP', 'HR', 'RR', 'TEMP', 'HT', 'WT', 'BMI',
  // Financial
  'USD', 'DOLLAR', 'DOLLARS', 'CENTS', 'FEE', 'FEES', 'COST', 'COSTS',
  'RATE', 'RATES', 'TAX', 'TAXES', 'DISCOUNT', 'ADJUSTMENT', 'WRITE',
  // Status words
  'NEW', 'ESTABLISHED', 'INITIAL', 'SUBSEQUENT', 'FINAL', 'FOLLOW',
  // Generic descriptors that appear on bills
  'HIGH', 'LOW', 'NORMAL', 'ABNORMAL', 'POSITIVE', 'NEGATIVE',
  'PRIMARY', 'SECONDARY', 'TERTIARY', 'MAIN', 'SUB', 'CATEGORY',
  'GROUP', 'SECTION', 'PART', 'ITEM', 'LINE', 'ROW', 'ENTRY',
  'TYPE', 'CLASS', 'STATUS', 'APPROVED', 'DENIED', 'PENDING',
  // More common non-code words from bills
  'EVAL', 'MGMT', 'MGMNT', 'CONSULT', 'TREATMENT', 'THERAPY',
  'TEST', 'TESTS', 'RESULT', 'RESULTS', 'REPORT', 'REPORTS',
  'SUPPLY', 'SUPPLIES', 'EQUIPMENT', 'DEVICE', 'DRUG', 'MEDICATION',
  'INJECTION', 'INFUSION', 'IMAGING', 'SCAN', 'XRAY', 'MRI', 'CT',
]);

// Additional patterns to reject (case insensitive matching)
const REJECTED_PATTERNS = [
  /^[A-Z]+$/, // Purely alphabetic
  /^\d{1,4}$/, // 1-4 digits (not 5)
  /^\d{6,}$/, // 6+ digits
  /^[A-Z]{2,}$/, // Multiple letters only
  /^\d+[A-Z]+$/, // Digits followed by letters (like "99ER")
];

interface CodeValidationResult {
  validCodes: any[];
  rejectedTokens: { token: string; reason: string }[];
}

function validateCptCode(code: string): { valid: boolean; reason?: string } {
  if (!code || typeof code !== 'string') {
    return { valid: false, reason: 'Empty or non-string input' };
  }
  
  const cleaned = code.trim().toUpperCase();
  
  // Check if too short or too long
  if (cleaned.length < 4) {
    return { valid: false, reason: `Too short: ${cleaned}` };
  }
  if (cleaned.length > 7) {
    return { valid: false, reason: `Too long: ${cleaned}` };
  }
  
  // Check if it's a rejected word
  if (REJECTED_WORDS.has(cleaned)) {
    return { valid: false, reason: `Rejected word: ${cleaned}` };
  }
  
  // Check rejected patterns
  for (const pattern of REJECTED_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { valid: false, reason: `Matches rejected pattern: ${cleaned}` };
    }
  }
  
  // Extract core code (handle modifiers like "99284-25")
  let coreCode = cleaned;
  if (cleaned.includes('-')) {
    coreCode = cleaned.split('-')[0];
  }
  if (cleaned.includes(' ')) {
    coreCode = cleaned.split(' ')[0];
  }
  
  // Check valid formats
  if (CPT_PATTERN.test(coreCode)) {
    return { valid: true };
  }
  
  if (HCPCS_PATTERN.test(coreCode)) {
    return { valid: true };
  }
  
  return { valid: false, reason: `Invalid format: ${cleaned} (expected 5 digits or letter + 4 digits)` };
}

function validateAndFilterCptCodes(codes: any[]): CodeValidationResult {
  const validCodes: any[] = [];
  const rejectedTokens: { token: string; reason: string }[] = [];
  const seenCodes = new Set<string>();
  
  for (const codeObj of codes) {
    const code = codeObj?.code;
    const validation = validateCptCode(code);
    
    if (validation.valid && !seenCodes.has(code.toUpperCase())) {
      seenCodes.add(code.toUpperCase());
      validCodes.push(codeObj);
    } else if (!validation.valid) {
      rejectedTokens.push({ token: code || 'unknown', reason: validation.reason || 'Unknown' });
    }
  }
  
  return { validCodes, rejectedTokens };
}

function postProcessAnalysis(analysis: any): { analysis: any; debugInfo: any } {
  const debugInfo: any = {
    codeValidation: null,
    originalCodeCount: 0,
    validCodeCount: 0,
  };
  
  // Validate and filter CPT codes
  if (analysis.cptCodes && Array.isArray(analysis.cptCodes)) {
    debugInfo.originalCodeCount = analysis.cptCodes.length;
    const { validCodes, rejectedTokens } = validateAndFilterCptCodes(analysis.cptCodes);
    analysis.cptCodes = validCodes;
    debugInfo.validCodeCount = validCodes.length;
    debugInfo.codeValidation = {
      acceptedCodes: validCodes.map((c: any) => c.code),
      rejectedTokens: rejectedTokens.slice(0, 30),
    };
  }
  
  // Also validate medicalCodes for legacy support
  if (analysis.medicalCodes && Array.isArray(analysis.medicalCodes)) {
    const { validCodes } = validateAndFilterCptCodes(
      analysis.medicalCodes.map((c: any) => ({ code: c.code }))
    );
    analysis.medicalCodes = analysis.medicalCodes.filter((c: any) => 
      validCodes.some((v: any) => v.code === c.code)
    );
  }
  
  return { analysis, debugInfo };
}

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

// Medical document analysis prompt
const MEDICAL_DOC_PROMPT = `You are a friendly medical document explainer. Your job is to help patients understand their medical documents (visit summaries, test results, clinical notes, prescriptions, imaging reports) in plain language.

## CRITICAL RULES
1. Be educational only - never diagnose or give medical advice
2. Use 6th-8th grade reading level
3. Be reassuring and calm
4. Always suggest discussing with their healthcare provider

## OUTPUT FORMAT
Return valid JSON with this EXACT structure:
{
  "documentType": "after_visit_summary" | "test_results" | "clinical_note" | "prescription" | "imaging_report" | "mixed_other",
  "documentTypeLabel": "Human-readable label for the document type",
  "pondsAnalysis": {
    "keyTakeaways": [
      "**Main diagnosis:** [Finding in plain language with key terms **bolded**]",
      "**Extent/severity:** [How advanced or serious, if applicable]",
      "**Next steps:** [Treatment or follow-up implications]"
    ],
    "contextParagraph": "2-3 sentence paragraph explaining what kind of document this is and how the results will be used (staging, treatment planning, monitoring, etc.)"
  },
  "overview": {
    "summary": "3-6 sentence summary of what this document is about",
    "mainPurpose": "The main purpose of this document",
    "overallAssessment": "General assessment using cautious language like 'appears normal' or 'may need follow-up'"
  },
  "lineByLine": [
    {
      "originalText": "Exact phrase or sentence from the document (clinical finding, diagnosis, test result, etc.)",
      "plainLanguage": "1-3 sentence explanation of what this means in clear language and why it matters"
    }
  ],
  "definitions": [
    {
      "term": "Medical term or abbreviation",
      "definition": "1-2 sentence consumer-friendly definition"
    }
  ],
  "commonlyAskedQuestions": [
    {
      "question": "Common patient question about findings in this document",
      "answer": "Educational answer ending with suggestion to discuss with provider"
    }
  ],
  "providerQuestions": [
    {
      "question": "Suggested question to ask healthcare provider",
      "questionEnglish": "English version if output is in another language"
    }
  ],
  "resources": [
    {
      "title": "Resource title",
      "description": "Brief description",
      "url": "URL to reputable patient resource",
      "source": "Source name (e.g., MedlinePlus, Mayo Clinic)"
    }
  ],
  "nextSteps": [
    {
      "step": "Action step title",
      "details": "Details about this step"
    }
  ]
}

## POND'S ANALYSIS SECTION (TOP PRIORITY)
At the very top, create a "pondsAnalysis" section with:

### keyTakeaways (2-4 bullet points)
Each bullet should highlight ONE important concept:
- **Main diagnosis:** The primary finding or condition identified
- **Extent of disease/severity:** How advanced, widespread, or serious it is (staging, spread, margins, abnormal ranges)
- **Next steps:** Treatment implications, follow-up needs, or monitoring requirements

FORMAT RULES:
- Use **bold** for the most important findings (e.g., the main diagnosis, evidence of spread)
- Use *italics* sparingly for clarifying medical terms
- Keep each bullet to 1-2 sentences maximum
- Do NOT bold entire paragraphs

### contextParagraph (1 short paragraph)
2-3 sentences that:
- Explain what kind of document this is (e.g., "This is a pathology report from your recent surgery")
- Describe how the results will be used (staging, treatment planning, monitoring)
- Provide context without giving medical advice

## LINE-BY-LINE EXPLANATIONS (SELECTIVE & MEANINGFUL)

### WHAT TO INCLUDE (prioritize these)
Select ONLY items that are clinically meaningful or potentially confusing:
- Diagnoses or conditions (e.g., "Papillary thyroid carcinoma")
- Test names with abnormal results (e.g., "Hgb 10.2 (L)")
- Pathology or imaging impressions (e.g., "No evidence of acute fracture")
- Procedure descriptions and findings
- Staging information, margins, spread, or risk features
- Important instructions or warnings
- Lab values outside normal range

### WHAT TO EXCLUDE
Do NOT create explanations for simple or obvious items:
- Patient name, date of birth, medical record numbers
- Plain labels like "Physician:", "Department:", "Date of Service:"
- Generic headings ("Page 1 of 6", "Report ID", etc.)
- Repeated section titles without new clinical meaning
- Administrative information (account numbers, page headers)

### SELECTION RULES
1. If many possible lines exist, choose the 10-20 MOST IMPORTANT or potentially confusing items
2. Focus on findings that affect diagnosis, staging, treatment, or follow-up
3. Combine closely related sentences into one explanation when it improves clarity
4. Do NOT create separate explanations for every sub-phrase of the same idea

### EXPLANATION FORMAT
For each selected item:
- "originalText": The exact phrase or sentence from the document (can be shortened if very long)
- "plainLanguage": 1-3 sentences explaining what it means AND why it matters

EXAMPLES:
- "Impression: no evidence of acute fracture" → "The imaging did not show any broken bones. This is reassuring and suggests the pain may be from soft tissue or another cause."
- "Hgb 10.2 (L)" → "Your hemoglobin (the oxygen-carrying part of your blood) is 10.2, which is lower than the typical range. This may indicate mild anemia."
- "Margins negative for carcinoma" → "The edges of the tissue removed during surgery do not contain cancer cells. This suggests the surgeon was able to remove all visible cancer."
- "3 of 12 lymph nodes positive" → "Cancer was found in 3 out of the 12 lymph nodes examined. This information helps your care team determine the stage of disease and plan treatment."

## CONTENT REQUIREMENTS
- pondsAnalysis: REQUIRED - 2-4 key takeaways + context paragraph (see POND'S ANALYSIS SECTION above)
- lineByLine: Extract 10-20 key findings, prioritized by clinical importance (see LINE-BY-LINE EXPLANATIONS above)
- definitions: Include 5-10 medical terms found in the document
- commonlyAskedQuestions: Generate 3-5 Q&As based on what real patients ask about these types of findings
- providerQuestions: Generate 5-8 personalized questions for the patient to ask their doctor
- resources: Include 2-4 reputable health education links (MedlinePlus, Mayo Clinic, CDC, etc.)
- nextSteps: Include 3-5 practical next steps

If the document has minimal clinical content, still provide helpful general information about the document type.`;

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
    
    const { documentContent, documentType, eobContent, state, language, analysisMode } = body;
    const isMedicalDoc = analysisMode === 'medical_document';
    
    console.log('Analyzing document:', { documentType, state, language, analysisMode, contentLength: documentContent?.length, hasEOB: !!eobContent });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Choose prompt based on analysis mode
    const hasEOB = !!eobContent && !isMedicalDoc;
    const systemPrompt = isMedicalDoc ? MEDICAL_DOC_PROMPT : (hasEOB ? SYSTEM_PROMPT + EOB_PROMPT_ADDITION : SYSTEM_PROMPT);

    // Map language codes to full names
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
1. Identify the document type (after_visit_summary, test_results, clinical_note, prescription, imaging_report, or mixed_other)
2. Extract ALL key findings, terms, diagnoses, test results, and instructions
3. Explain each medical term in plain language
4. Generate realistic patient questions based on what people actually ask about these findings
5. Create personalized questions for the patient to bring to their next appointment
6. Include relevant educational resources

${language !== 'en' ? `ALL text content MUST be written in ${outputLanguage}. EXCEPTION: Do NOT translate medical terms, test names, medication names, or URLs. For providerQuestions, also include an English version in questionEnglish field.` : 'Write all content in English.'}

Output ONLY valid JSON matching the structure in the system prompt. No markdown, no explanation.`;
    } else {
      const eobInstructions = hasEOB 
        ? `\nIMPORTANT: An EOB (Explanation of Benefits) is provided. You MUST cross-reference EVERY line item between bill and EOB.`
        : `\nNOTE: No EOB was provided. Suggest the patient request and compare with their EOB.`;

      userPromptText = `Analyze this medical document for a patient in ${state || 'an unspecified U.S. state'}. 
Document type: ${documentType || 'medical bill'}
Output language: ${outputLanguage}
${eobInstructions}

${language !== 'en' ? `ALL text content MUST be written in ${outputLanguage}. EXCEPTION: Do NOT translate CPT codes, dollar amounts, dates, claim numbers, provider names, or URLs.` : 'Write all content in English.'}

Output ONLY valid JSON matching the exact structure in the system prompt. No markdown, no explanation.`;
    }

    // Build content array for the message
    const contentParts: any[] = [{ type: 'text', text: userPromptText }];
    
    // Add document
    if (documentContent.startsWith('data:')) {
      const base64Data = documentContent.split(',')[1];
      const mimeType = documentContent.split(';')[0].split(':')[1] || 'image/jpeg';
      console.log('Processing bill with MIME type:', mimeType);
      contentParts.push({ 
        type: 'image_url', 
        image_url: { url: `data:${mimeType};base64,${base64Data}` } 
      });
    } else {
      contentParts[0].text += `\n\nDocument content:\n${documentContent}`;
    }

    // Add EOB document if present (bill mode only)
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

    console.log('Sending request to AI gateway with temperature: 0...');

    // Retry logic with exponential backoff for transient errors (503, 502, etc.)
    const maxRetries = 3;
    let lastError: Error | null = null;
    let response: Response | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

        if (response.ok) {
          break; // Success, exit retry loop
        }

        const errorText = await response.text();
        console.error(`AI gateway error (attempt ${attempt}/${maxRetries}):`, response.status, errorText);

        // Handle non-retryable errors immediately
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
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          // Client errors - don't retry
          throw new Error(`AI gateway error: ${response.status}`);
        }

        // Retryable errors: 502, 503, 504, 500
        if (attempt < maxRetries && [500, 502, 503, 504].includes(response.status)) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s (max 8s)
          console.log(`Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }

        lastError = new Error(`AI gateway error: ${response.status}`);
      } catch (fetchError) {
        console.error(`Fetch error (attempt ${attempt}/${maxRetries}):`, fetchError);
        lastError = fetchError instanceof Error ? fetchError : new Error('Network error');
        
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.log(`Retrying after fetch error in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    if (!response || !response.ok) {
      throw lastError || new Error('AI gateway unavailable after retries');
    }

    const data = await response.json();
    console.log('AI response received, parsing...');
    
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content in AI response:', JSON.stringify(data, null, 2));
      throw new Error('No content in AI response');
    }

    // Extract JSON from the response
    let analysisJson = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      analysisJson = jsonMatch[1].trim();
    }

    let analysis;
    let debugInfo = null;
    try {
      analysis = JSON.parse(analysisJson);
      console.log('Analysis parsed successfully');
      
      // Post-process to validate CPT codes and add debug info (bill mode only)
      if (!isMedicalDoc) {
        const processed = postProcessAnalysis(analysis);
        analysis = processed.analysis;
        debugInfo = processed.debugInfo;
        console.log('Code validation:', debugInfo.codeValidation);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content.substring(0, 500));
      analysis = isMedicalDoc ? createFallbackMedicalDocAnalysis(state || 'US') : createFallbackAnalysis(state || 'US', hasEOB);
    }

    return new Response(JSON.stringify({ analysis, debugInfo }), {
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
    documentType: 'mixed_other',
    documentTypeLabel: 'Medical Document',
    overview: {
      summary: 'This document contains medical information. Please review with your healthcare provider.',
      mainPurpose: 'Provides medical details about your care.',
      overallAssessment: 'Please discuss any questions or concerns with your healthcare provider.'
    },
    lineByLine: [
      { originalText: 'Document content', plainLanguage: 'This document contains medical information that your healthcare team has prepared for you.' }
    ],
    definitions: [
      { term: 'Medical Record', definition: 'A document that contains information about your health and medical care.' }
    ],
    commonlyAskedQuestions: [
      { question: 'What should I do with this document?', answer: 'Keep this document for your records and bring it to your next appointment to discuss with your doctor.' }
    ],
    providerQuestions: [
      { question: 'Can you explain what this document means for my health?', questionEnglish: 'Can you explain what this document means for my health?' },
      { question: 'Are there any follow-up steps I should take?', questionEnglish: 'Are there any follow-up steps I should take?' }
    ],
    resources: [
      { title: 'MedlinePlus', description: 'Trusted health information from the National Library of Medicine', url: 'https://medlineplus.gov/', source: 'NIH' }
    ],
    nextSteps: [
      { step: 'Review this document', details: 'Read through the document and note any questions you have.' },
      { step: 'Contact your provider', details: 'Reach out to your healthcare provider if you have questions about the content.' }
    ]
  };
}

function createFallbackAnalysis(state: string, hasEOB: boolean) {
  return {
    documentType: 'bill',
    issuer: 'Healthcare Provider',
    dateOfService: 'See document',
    documentPurpose: 'This document contains medical billing information.',
    
    // === POND SECTIONS ===
    atAGlance: {
      visitSummary: 'Medical services from healthcare provider',
      totalBilled: null,
      amountYouMayOwe: null,
      status: 'worth_reviewing',
      statusExplanation: 'We couldn\'t fully analyze this document. Request an itemized bill for a more complete review.',
    },
    thingsWorthReviewing: [],
    reviewSectionNote: 'Request an itemized bill with CPT codes for a more detailed analysis.',
    savingsOpportunities: [
      {
        whatMightBeReduced: 'Financial assistance programs',
        whyNegotiable: 'Many providers offer charity care or sliding scale discounts based on income.',
        savingsContext: 'Ask about income-based programs when you call.',
      },
      {
        whatMightBeReduced: 'Prompt-pay discount',
        whyNegotiable: 'Some providers offer 10-30% off for paying the full balance immediately.',
        savingsContext: 'Ask: "Do you offer a discount if I pay today?"',
      },
    ],
    conversationScripts: {
      firstCallScript: 'Hi, I\'m calling about my bill. I\'d like to request an itemized statement showing all charges with CPT codes, and also ask about any financial assistance programs.',
      ifTheyPushBack: 'I understand. I\'d like to review the charges before making payment. Can you send me an itemized bill or transfer me to someone who can help?',
      whoToAskFor: 'Ask for the billing department. If you need help with financial assistance, ask for the financial counselor.',
    },
    chargeMeanings: [],
    negotiability: [
      {
        chargeOrCategory: 'Hospital Financial Assistance',
        level: 'highly_negotiable',
        reason: 'Nonprofit hospitals are required to offer charity care to qualifying patients',
      },
    ],
    priceContext: {
      hasBenchmarks: false,
      comparisons: [],
      fallbackMessage: 'Price comparison data isn\'t available for this bill. Request an itemized bill for more details.',
    },
    pondNextSteps: [
      { step: 'Request an itemized bill with CPT codes', isUrgent: false },
      { step: 'Wait for your Explanation of Benefits (EOB) if you have insurance', isUrgent: false },
      { step: 'Ask about financial assistance programs', isUrgent: false },
    ],
    closingReassurance: 'Medical bills are often negotiable, and asking questions is normal. You\'re not being difficult — you\'re being careful.',
    
    // === LEGACY FIELDS ===
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
