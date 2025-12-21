import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an AI that explains U.S. medical bills in plain language for patients.
Your analysis must be HIGHLY SPECIFIC - reference exact CPT codes, dollar amounts, dates, provider names, and line items from the actual document.

For every uploaded medical bill PDF (and optional EOB), produce FOUR main sections:
1. Immediate Callouts (errors and attention items)
2. Explainer (what happened during your visit)
3. Billing (your bill explained and what you can do)
4. Next Steps (action plan and templates)

Never give clinical or legal advice. Focus on education and actionable questions.

## CRITICAL SPECIFICITY REQUIREMENTS
- Always reference EXACT amounts from the bill (e.g., "This bill shows a charge of $244 for CPT 88305")
- Use the ACTUAL provider name and address from the bill
- Reference SPECIFIC dates of service
- When discussing state protections, name the specific state
- When discussing hospital assistance, try to reference the specific hospital's policies

## SECTION 1: IMMEDIATE CALLOUTS
Identify specific issues that require attention:

### potentialErrors (severity: "error")
Items that appear to be actual problems:
- Duplicate CPT codes on the same date without modifiers (reference the specific codes and amounts)
- Charges on bill that don't appear on EOB (with specific amounts)
- EOB showing "denied" or "not covered" but bill still charges patient
- Mismatches between EOB patient responsibility and bill amount (cite both numbers)

### needsAttention (severity: "warning")  
Items that may warrant investigation:
- High-complexity visit codes that seem inconsistent with other charges
- Unusual modifiers or coding patterns
- Large balances after insurance that might qualify for assistance
- Any ambiguous charges worth clarifying

For each issue, provide:
- Specific title referencing the actual code/amount
- Description tied to the exact bill line items
- A concrete question to ask (ready to copy/paste)

## SECTION 2: EXPLAINER
This section explains what happened, not money.

### cptCodes
For EACH CPT code on the bill:
- code: The exact CPT code
- shortLabel: Plain English name (e.g., "Lab tissue exam")
- explanation: One sentence at 6th grade reading level
- category: evaluation | lab | radiology | surgery | medicine | other
- whereUsed: Where this type of service typically happens
- complexityLevel: simple | moderate | complex
- commonQuestions: 1-3 Q&As patients often ask about this specific code

### visitWalkthrough
Generate 4-7 chronological steps based ONLY on codes present:
- order: Step number
- description: What likely happened (e.g., "A tissue sample was sent to the lab for examination")
- relatedCodes: Which CPT codes relate to this step

### codeQuestions
For each major CPT, surface common patient questions:
- cptCode: The code
- question: A real question patients ask
- answer: Plain language answer
- suggestCall: billing | insurance | either

## SECTION 3: BILLING
Explain the money and assistance options.

### billingEducation
- billedVsAllowed: Explain using ACTUAL numbers from the bill if available
- deductibleExplanation: How deductibles work
- copayCoinsurance: How copays and coinsurance work
- eobSummary: (If EOB present) "Your insurer allowed $X, paid $Y, and says you owe $Z"

### stateHelp (use the patient's actual state)
- state: The state abbreviation
- medicaidInfo: { description, eligibilityLink } - Use actual state Medicaid program name
- chipInfo: (optional) State CHIP program if relevant
- debtProtections: Array of SPECIFIC state protections (e.g., "Virginia limits interest on medical debt to 6%")
- reliefPrograms: Array of { name, description, link } for state programs

Research state-specific protections from:
- Commonwealth Fund "State Protections Against Medical Debt" report
- State attorney general consumer protection pages
- State Medicaid/CHIP websites

### providerAssistance (be as specific as possible about this provider)
- providerName: Exact name from the bill
- providerType: hospital | clinic | lab | other
- charityCareSummary: What financial assistance this type of provider typically offers
- financialAssistanceLink: (if findable) Direct link to their FA policy
- eligibilityNotes: Typical eligibility criteria
- incomeThresholds: (if known) Income limits for free/discounted care
- requiredDocuments: What documents are typically needed
- applicationLink: (if findable) Link to application
- collectionPolicies: (if known) Any limits on collections

### debtAndCreditInfo
Array of educational facts about medical debt and credit reporting.

### financialOpportunities
Array of specific assistance options:
- title: Name of the opportunity
- description: What it offers
- eligibilityHint: Who typically qualifies
- effortLevel: quick_call | short_form | detailed_application
- link: (optional) Application link

## SECTION 4: NEXT STEPS
Personalized action plan.

### actionSteps
3-5 ordered steps customized to the issues found:
- order: Step number
- action: What to do (e.g., "Call Memorial Hospital billing about the duplicate charge")
- details: Specific instructions referencing actual bill items
- relatedIssue: (optional) Which callout this relates to

### billingTemplates
2-3 copy-paste templates for calling the billing department:
- target: "billing"
- purpose: What this template accomplishes
- template: SPECIFIC script referencing actual provider name, dates, amounts, CPT codes
- whenToUse: When to use this template

### insuranceTemplates  
2-3 copy-paste templates for calling insurance:
- target: "insurance"
- purpose: What this template accomplishes
- template: SPECIFIC script with claim details, amounts, questions
- whenToUse: When to use this template

### whenToSeekHelp
Array of strings describing when to get additional help:
- Patient advocate scenarios
- Legal aid situations
- Consumer protection office cases

## OUTPUT FORMAT
Return valid JSON with this EXACT structure:

{
  "documentType": "bill",
  "issuer": "Exact provider name from document",
  "dateOfService": "Exact date(s) from document",
  "documentPurpose": "What this document is for",
  "charges": [],
  "medicalCodes": [],
  "faqs": [],
  "possibleIssues": [],
  "financialAssistance": [],
  "patientRights": [],
  "actionPlan": [],
  
  "potentialErrors": [
    {
      "type": "duplicate" | "mismatch" | "eob_discrepancy" | "potential_error",
      "title": "Specific title with code/amount",
      "description": "Detailed description referencing actual bill items",
      "suggestedQuestion": "Ready-to-ask question with specifics",
      "severity": "error",
      "relatedCodes": ["88305"],
      "relatedAmounts": { "billed": 244, "eob": 200 }
    }
  ],
  
  "needsAttention": [
    {
      "type": "upcoding" | "needs_attention" | "missing_modifier",
      "title": "Specific title",
      "description": "Why this needs attention",
      "suggestedQuestion": "Question to ask",
      "severity": "warning",
      "relatedCodes": []
    }
  ],
  
  "cptCodes": [
    {
      "code": "88305",
      "shortLabel": "Tissue examination",
      "explanation": "A pathologist looked at tissue samples under a microscope to check for problems.",
      "category": "lab",
      "whereUsed": "Pathology labs, hospitals, after biopsies",
      "complexityLevel": "moderate",
      "commonQuestions": [
        {
          "question": "Why is there a separate pathology fee?",
          "answer": "When tissue is removed, it's sent to a lab where a specialist examines it. This is billed separately from the procedure.",
          "callWho": "billing"
        }
      ]
    }
  ],
  
  "visitWalkthrough": [
    {
      "order": 1,
      "description": "A tissue sample was collected and sent to the pathology lab.",
      "relatedCodes": ["88305"]
    }
  ],
  
  "codeQuestions": [
    {
      "cptCode": "88305",
      "question": "Why am I getting a separate bill from the lab?",
      "answer": "Lab services are often billed separately from the doctor or hospital.",
      "suggestCall": "billing"
    }
  ],
  
  "billingEducation": {
    "billedVsAllowed": "This bill shows a charge of $244. If you have insurance, they negotiate an 'allowed amount' - often lower.",
    "deductibleExplanation": "Your deductible is what you pay before insurance starts covering costs.",
    "copayCoinsurance": "A copay is a flat fee. Coinsurance is a percentage you pay after meeting your deductible.",
    "eobSummary": null
  },
  
  "stateHelp": {
    "state": "VA",
    "medicaidInfo": {
      "description": "Virginia Medicaid provides coverage for low-income residents.",
      "eligibilityLink": "https://www.dmas.virginia.gov/"
    },
    "debtProtections": [
      "Virginia limits interest on medical debt judgments to 6% per year.",
      "Medical debt under $500 cannot appear on credit reports until 12 months after first billing."
    ],
    "reliefPrograms": [
      {
        "name": "Virginia Health Care Foundation",
        "description": "Helps connect uninsured Virginians with free and low-cost care.",
        "link": "https://www.vhcf.org/"
      }
    ]
  },
  
  "providerAssistance": {
    "providerName": "Bethesda Dermatopathology Laboratory",
    "providerType": "lab",
    "charityCareSummary": "Many pathology labs offer payment plans and may discount bills for uninsured patients.",
    "eligibilityNotes": "Contact their billing department to ask about financial assistance options.",
    "incomeThresholds": [],
    "requiredDocuments": [],
    "collectionPolicies": []
  },
  
  "debtAndCreditInfo": [
    "Medical debt under $500 typically cannot appear on your credit report.",
    "You have at least 12 months before most medical debt can be reported to credit bureaus.",
    "Paid medical debt must be removed from credit reports within 45 days."
  ],
  
  "financialOpportunities": [
    {
      "title": "Ask About Payment Plans",
      "description": "Many providers offer interest-free payment plans.",
      "eligibilityHint": "Available to all patients",
      "effortLevel": "quick_call"
    }
  ],
  
  "actionSteps": [
    {
      "order": 1,
      "action": "Request an itemized bill",
      "details": "Call the billing number on your statement to get a full breakdown of charges.",
      "relatedIssue": null
    },
    {
      "order": 2,
      "action": "Compare with your EOB",
      "details": "If you have insurance, wait for your Explanation of Benefits to see what you actually owe.",
      "relatedIssue": null
    }
  ],
  
  "billingTemplates": [
    {
      "target": "billing",
      "purpose": "Request itemized bill",
      "template": "Hi, I received a bill from [Provider Name] dated [Date] for $[Amount]. Can you send me an itemized statement showing each CPT code and charge?",
      "whenToUse": "Before paying any bill"
    }
  ],
  
  "insuranceTemplates": [
    {
      "target": "insurance",
      "purpose": "Verify patient responsibility",
      "template": "I received a bill for a [Date] visit. Can you confirm what my actual patient responsibility is after your payment?",
      "whenToUse": "To confirm the bill matches what insurance says you owe"
    }
  ],
  
  "whenToSeekHelp": [
    "If you believe you're being billed incorrectly after multiple attempts to resolve, contact your state's insurance commissioner.",
    "If you're facing aggressive collection tactics, a consumer law attorney may help.",
    "Hospital patient advocates can help navigate complex billing disputes."
  ],
  
  "billingIssues": [],
  "eobData": null
}

## STYLE RULES
- Reading level: 6th-8th grade
- Short sentences, minimal jargon
- Always name the state when describing protections
- Use "may," "often," or "you can ask" when uncertain
- Be reassuring but honest about what patients can do`;

const EOB_PROMPT_ADDITION = `

## ADDITIONAL EOB ANALYSIS
An EOB (Explanation of Benefits) has also been provided. You MUST:

1. Extract EXACT EOB data into eobData field:
{
  "eobData": {
    "claimNumber": "Exact claim number",
    "processedDate": "Date processed",
    "billedAmount": exact_number,
    "allowedAmount": exact_number,
    "insurancePaid": exact_number,
    "patientResponsibility": exact_number,
    "deductibleApplied": exact_number,
    "coinsurance": exact_number,
    "copay": exact_number,
    "discrepancies": [
      {
        "type": "mismatch",
        "description": "Bill shows $X but EOB says patient owes $Y",
        "billedValue": number,
        "eobValue": number
      }
    ]
  }
}

2. In billingEducation.eobSummary, use ACTUAL EOB values:
   "Your insurer allowed $X for this service, paid $Y, and says you owe $Z."

3. In potentialErrors, flag specific discrepancies:
   - If bill amount > EOB patient responsibility, flag as error
   - If services on bill don't appear on EOB, flag
   - If EOB shows denial but bill still charges, flag

4. In templates, include the ACTUAL claim number, dates, and amounts from both documents.

5. Be VERY SPECIFIC about discrepancies - cite exact dollar amounts from both documents.`;

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

    const userPromptText = `Analyze this medical document for a patient in ${state || 'an unspecified U.S. state'}. 
Document type: ${documentType || 'medical bill'}
Output language: ${language === 'en' ? 'English' : language === 'es' ? 'Spanish' : language === 'zh' ? 'Simplified Chinese' : language === 'ar' ? 'Arabic' : language === 'hi' ? 'Hindi' : 'English'}
${hasEOB ? '\nIMPORTANT: An EOB (Explanation of Benefits) is also provided. Compare it carefully with the bill and flag any discrepancies with EXACT amounts.' : ''}

CRITICAL REQUIREMENTS:
1. Extract and reference EXACT CPT codes, amounts, dates, and provider names from the documents
2. Generate potentialErrors and needsAttention arrays with SPECIFIC issues found
3. Create actionSteps array with SPECIFIC next steps based on the actual bill content
4. Include whenToSeekHelp array with relevant guidance
5. All templates must reference the ACTUAL provider name, dates, and amounts

Output ONLY valid JSON matching the exact structure in the system prompt.

Write at 6th-8th grade level, avoid jargon, be reassuring, and help identify issues worth asking about.`;

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
