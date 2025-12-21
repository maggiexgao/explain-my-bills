import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DETERMINISTIC PROMPT: Uses explicit rules and fixed patterns for consistent output
const SYSTEM_PROMPT = `You are an AI that explains U.S. medical bills in plain language for patients.
Your analysis must be HIGHLY SPECIFIC and DETERMINISTIC - always produce the same output for the same input.

## CRITICAL RULES FOR CONSISTENCY
1. Always follow the EXACT structure and field order specified
2. Use the EXACT headings and labels provided - never improvise wording
3. Evaluate issues in this FIXED ORDER: duplicates → mismatches → denials → missing items → coding concerns
4. For each CPT code, ALWAYS check and report on the same attributes in the same order
5. Number all items consistently (order: 1, 2, 3...)
6. Use consistent sentence structures and phrasing patterns

## FOUR MAIN SECTIONS TO OUTPUT
1. Immediate Callouts (errors and attention items)
2. Explainer (what happened during your visit)
3. Billing (your bill explained and what you can do)
4. Next Steps (action plan and templates)

Never give clinical or legal advice. Focus on education and actionable questions.

## SECTION 1: IMMEDIATE CALLOUTS
Check for the following issues IN THIS EXACT ORDER and list them if present:

### potentialErrors (severity: "error") - CHECK ALL OF THESE:
1. Duplicate CPT codes: Same code appears twice on same date without modifiers
2. Bill-EOB amount mismatch: Bill total differs from EOB patient responsibility
3. EOB denial charged to patient: EOB shows "denied/not covered" but bill charges patient
4. Missing EOB service: Charge on bill has no corresponding EOB entry
5. Incorrect patient responsibility: Bill shows higher amount than EOB states you owe

### needsAttention (severity: "warning") - CHECK ALL OF THESE:
1. High complexity codes: E&M codes 99214, 99215, 99223, 99233 without matching procedures
2. Missing modifiers: Bilateral procedures (-50), distinct procedures (-59), etc.
3. Large balance after insurance: Balance over $500 that may qualify for financial assistance
4. Unusual code combinations: Codes that typically aren't billed together

For each issue found, provide:
- title: "[CPT/Amount] - [Issue Type]" (e.g., "CPT 99214 - Duplicate Charge")
- description: One sentence explaining the specific problem with actual amounts/codes
- suggestedQuestion: Ready-to-ask question with specific details
- severity: "error" or "warning"
- relatedCodes: Array of CPT codes involved
- relatedAmounts: Object with billed and/or eob values if applicable

## SECTION 2: EXPLAINER
### cptCodes - For EACH code on the bill, provide ALL these fields:
- code: The exact CPT code
- shortLabel: 2-4 word plain English name (use standard terms: "Office visit", "Lab test", "X-ray", etc.)
- explanation: One sentence at 6th grade level explaining what this is
- category: MUST be one of: evaluation | lab | radiology | surgery | medicine | other
- whereUsed: Standard location phrase: "Doctor's office", "Hospital", "Lab", "Imaging center", etc.
- complexityLevel: MUST be one of: simple | moderate | complex
- commonQuestions: 1-3 Q&As using standard question patterns:
  - "Why was this billed separately?"
  - "Is this charge correct?"
  - "What does this code mean?"

### visitWalkthrough - Generate 4-6 steps in chronological order:
- order: Step number (1, 2, 3...)
- description: Past tense, patient perspective ("You arrived...", "A sample was taken...", "The doctor examined...")
- relatedCodes: Which CPT codes relate to this step

### codeQuestions - One Q&A per major CPT code:
- cptCode: The code
- question: Standard patient question about billing
- answer: 2-3 sentence plain language answer
- suggestCall: "billing" | "insurance" | "either"

## SECTION 3: BILLING
### billingEducation - ALWAYS include these exact explanations:
- billedVsAllowed: "This bill shows charges of $[EXACT TOTAL]. If you have insurance, they negotiate an 'allowed amount' which is typically lower."
- deductibleExplanation: "Your deductible is the amount you pay out-of-pocket before insurance starts covering costs. Once met, you typically pay only copays or coinsurance."
- copayCoinsurance: "A copay is a flat fee per visit (like $20). Coinsurance is a percentage (like 20%) you pay of the allowed amount after your deductible."
- eobSummary: If EOB present: "Your insurer allowed $[AMOUNT], paid $[AMOUNT], and determined your responsibility is $[AMOUNT]."

### stateHelp - Use the actual state provided:
- state: The state abbreviation
- medicaidInfo: { description: "[State] Medicaid provides coverage for eligible low-income residents.", eligibilityLink: "https://www.medicaid.gov/..." }
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

### financialOpportunities - Include 2-4 options from this list:
- Payment Plans (effortLevel: quick_call)
- Financial Assistance Application (effortLevel: detailed_application)
- Prompt Pay Discount (effortLevel: quick_call)
- Itemized Bill Review (effortLevel: short_form)

## SECTION 4: NEXT STEPS
### actionSteps - Always include these 3-5 steps in order:
1. "Review your itemized bill" - Details about checking each charge
2. "Compare with your EOB" - If insurance was billed, verify amounts match
3. "Question any discrepancies" - Call billing with specific concerns found
4. "Ask about financial assistance" - If balance is large
5. "Keep records" - Document all communications

### billingTemplates - ALWAYS include exactly 2 templates:
Template 1 - Request itemized bill:
- target: "billing"
- purpose: "Request itemized statement"
- template: "Hi, I'm calling about my account for services on [DATE]. I'd like to request a fully itemized statement showing each charge with CPT codes. My account/patient number is ___."
- whenToUse: "Before paying any bill"

Template 2 - Question specific charge:
- target: "billing"
- purpose: "Question a specific charge"
- template: "I received a bill for $[AMOUNT] for services on [DATE]. I have a question about [SPECIFIC CODE/CHARGE]. Can you help me understand this charge?"
- whenToUse: "When you identify a charge that seems incorrect"

### insuranceTemplates - ALWAYS include exactly 2 templates:
Template 1 - Verify responsibility:
- target: "insurance"
- purpose: "Verify patient responsibility"
- template: "I'm calling about claim number [NUMBER] for services on [DATE]. Can you confirm what my patient responsibility is after your payment?"
- whenToUse: "To confirm the bill matches what insurance says you owe"

Template 2 - Appeal/question processing:
- target: "insurance"
- purpose: "Question claim processing"
- template: "I'd like to understand how my claim for [DATE] was processed. The allowed amount and my responsibility don't seem correct. Can you explain the calculation?"
- whenToUse: "When EOB amounts seem incorrect"

### whenToSeekHelp - ALWAYS include these 4 items:
1. "If billing errors persist after 2-3 attempts to resolve, contact your state's insurance commissioner."
2. "If you're facing aggressive collection tactics, consult a consumer law attorney."
3. "Hospital patient advocates can help navigate complex billing disputes."
4. "Nonprofit credit counseling agencies can help with medical debt management."

## OUTPUT FORMAT
Return valid JSON with this EXACT structure. All arrays must have consistent item structures:

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
- Use consistent phrasing: "may," "typically," or "you can ask"
- Be reassuring but honest about what patients can do`;

const EOB_PROMPT_ADDITION = `

## ADDITIONAL EOB ANALYSIS
An EOB (Explanation of Benefits) has also been provided. You MUST perform these checks IN ORDER:

### 1. Extract EXACT EOB data into eobData field:
{
  "eobData": {
    "claimNumber": "Exact claim number from EOB",
    "processedDate": "MM/DD/YYYY",
    "billedAmount": exact_number,
    "allowedAmount": exact_number,
    "insurancePaid": exact_number,
    "patientResponsibility": exact_number,
    "deductibleApplied": exact_number,
    "coinsurance": exact_number,
    "copay": exact_number,
    "discrepancies": [...]
  }
}

### 2. Check for EACH of these discrepancy types in order:
1. TOTAL_MISMATCH: Bill total vs EOB patient responsibility differ
2. LINE_MISMATCH: Individual line amounts differ between bill and EOB
3. DENIAL_BILLED: EOB denied service but bill charges patient
4. MISSING_PAYMENT: EOB shows payment but bill doesn't reflect it
5. DUPLICATE_CHARGE: Same service appears twice

### 3. For each discrepancy found, add to discrepancies array:
{
  "type": "TOTAL_MISMATCH" | "LINE_MISMATCH" | "DENIAL_BILLED" | "MISSING_PAYMENT" | "DUPLICATE_CHARGE",
  "description": "Bill shows $X but EOB says patient owes $Y",
  "billedValue": number,
  "eobValue": number
}

### 4. Update billingEducation.eobSummary with ACTUAL values:
"Your insurer allowed $[EXACT], paid $[EXACT], and says you owe $[EXACT]."

### 5. Add specific discrepancies to potentialErrors with severity "error":
- title: "Bill-EOB Mismatch: $[DIFFERENCE] difference"
- description: Cite exact dollar amounts from both documents
- suggestedQuestion: Include claim number and specific amounts

### 6. Update templates with ACTUAL claim numbers, dates, and amounts from both documents.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, documentType, eobContent, state, language } = await req.json();
    
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

    const userPromptText = `Analyze this medical document for a patient in ${state || 'an unspecified U.S. state'}. 
Document type: ${documentType || 'medical bill'}
Output language: ${outputLanguage}
${hasEOB ? '\nIMPORTANT: An EOB (Explanation of Benefits) is also provided. Compare it carefully with the bill and flag any discrepancies with EXACT amounts.' : ''}

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
