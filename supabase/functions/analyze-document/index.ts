import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an AI that explains U.S. medical bills in plain language for patients.
For every uploaded medical bill PDF (and optional EOB), you must produce two main accordion sections only:
1. Explainer
2. Billing & Next Steps

Never give clinical advice or legal/financial advice; focus on education and actionable questions the patient can ask.

## SECTION 1: "Explainer"
This section is only about what happened in the visit, not money.

### 1A. CPT Codes Explained
For each CPT (and major HCPCS if present):
- Show compact rows: Code – Friendly label – One-sentence explanation
- Rewrite description at 6th–8th grade reading level
- If there is a modifier, add a short phrase explaining it
- Include where the code is commonly used and typical complexity

### 1B. "What your visit likely looked like"
Generate a short, ordered walkthrough (4–7 bullets) of what the visit probably involved:
- Group codes into logical sequence: Check-in/visit (E/M), Labs/tests, Imaging, Procedures/treatments, Other services
- Keep language generic and conservative. Do not infer diagnoses or outcomes.

### 1C. Common questions about these codes
For each main CPT, include 1–3 Q&As reflecting what patients often ask:
- "Why am I being charged for both a visit code and a test code?"
- "Is this code normal for a routine check-up?"
- "Why is there a separate bill from the lab?"
Answers should stay high-level, neutral, and suggest when to ask billing vs insurer.

## SECTION 2: "Billing & Next Steps"
This section explains how billing works, identifies possible issues, and suggests next steps.

### 2A. Things to Know About Your Bill

#### 2A-1. How the bill and insurance work
Explain in simple terms:
- Billed charge vs "allowed amount" vs insurance payment vs patient responsibility
- How deductibles, copays, and coinsurance typically apply
- If EOB provided, use actual values and point out any mismatches

#### 2A-2. State-specific protections and medical-debt rules
Using the patient's state, summarize key protections based on:
- Commonwealth Fund "State Protections Against Medical Debt" report and map
- Limits on interest, wage garnishment, home liens, or credit reporting
- Collection practices and billing transparency rules
- Special protections for low-income or uninsured patients

#### 2A-3. Medicaid/CHIP and state coverage options
Surface the correct state program name and website:
- Who may qualify (low income, children, pregnant, disability)
- Link to "Apply / Learn more" page

#### 2A-4. Hospital and provider financial-assistance programs
- Explain what "financial assistance" or "charity care" is
- If hospital identifiable, link to their financial-assistance policy
- Include what patients can ask for: discounts, charity care, payment plans

### 2B. Next Steps (personalized and action-oriented)

#### 2B-1. Possible errors or inconsistencies to review
Flag as a checklist:
- Potential duplicates (same CPT, same date, no clear modifier)
- Unusually high visit levels (frame as "worth asking about")
- Mismatches between bill and EOB amounts

#### 2B-2. Financial assistance you might qualify for
Based on state, provider type, and bill hints:
- State Medicaid/CHIP program (name + link)
- State medical-debt protections
- Hospital charity-care expectations

#### 2B-3. Templates: questions to ask
Provide two sets of copy-and-paste templates for billing department and insurance company.

## OUTPUT FORMAT
You must return valid JSON with this EXACT structure (field names must match exactly):
{
  "documentType": "bill",
  "issuer": "Provider name",
  "dateOfService": "Date",
  "documentPurpose": "Brief explanation of what this document is for",
  "charges": [],
  "medicalCodes": [],
  "faqs": [],
  "possibleIssues": [],
  "financialAssistance": [],
  "patientRights": [],
  "actionPlan": [],
  
  "cptCodes": [
    {
      "code": "99213",
      "shortLabel": "Follow-up doctor visit",
      "explanation": "A short visit to check on an existing issue and adjust treatment if needed.",
      "category": "evaluation",
      "whereUsed": "Primary care, specialty follow-ups",
      "complexityLevel": "moderate",
      "commonQuestions": [
        {
          "question": "Why was my visit this level?",
          "answer": "Levels are based on complexity of the visit.",
          "callWho": "billing"
        }
      ]
    }
  ],
  
  "visitWalkthrough": [
    {
      "order": 1,
      "description": "You checked in and had a follow-up visit with your doctor.",
      "relatedCodes": ["99213"]
    }
  ],
  
  "codeQuestions": [
    {
      "cptCode": "99213",
      "question": "Why am I being charged for both a visit and a test?",
      "answer": "These are separate services.",
      "suggestCall": "billing"
    }
  ],
  
  "billingEducation": {
    "billedVsAllowed": "The billed amount is what the provider charges. The allowed amount is the maximum your insurance will pay - often lower than billed.",
    "deductibleExplanation": "Your deductible is what you pay before insurance kicks in.",
    "copayCoinsurance": "A copay is a flat fee per visit. Coinsurance is a percentage you pay after meeting your deductible.",
    "eobSummary": "If EOB present, add summary here"
  },
  
  "stateHelp": {
    "state": "CA",
    "medicaidInfo": {
      "description": "California Medicaid program for low-income residents.",
      "eligibilityLink": "https://www.dhcs.ca.gov/services/medi-cal"
    },
    "chipInfo": {
      "description": "CHIP for children.",
      "eligibilityLink": "https://..."
    },
    "debtProtections": [
      "California limits interest on medical debt to 10% per year."
    ],
    "reliefPrograms": [
      {
        "name": "Hospital Charity Care",
        "description": "California nonprofit hospitals must offer financial assistance.",
        "link": "https://..."
      }
    ]
  },
  
  "providerAssistance": {
    "providerName": "Memorial Hospital",
    "providerType": "hospital",
    "charityCareSummary": "Many hospitals offer financial assistance programs that can reduce or eliminate your bill based on income.",
    "financialAssistanceLink": "https://...",
    "eligibilityNotes": "Patients earning up to 400% of federal poverty level may qualify."
  },
  
  "debtAndCreditInfo": [
    "Medical debt under $500 cannot appear on credit reports.",
    "You have at least 12 months before medical debt can be reported to credit bureaus."
  ],
  
  "billingIssues": [
    {
      "type": "duplicate",
      "title": "Possible duplicate charge",
      "description": "Code 99213 appears twice on the same date.",
      "suggestedQuestion": "Can you explain why this code was billed twice?",
      "severity": "warning",
      "relatedCodes": ["99213"]
    }
  ],
  
  "financialOpportunities": [
    {
      "title": "Hospital Financial Assistance",
      "description": "You may qualify for reduced costs.",
      "eligibilityHint": "Based on income and family size",
      "effortLevel": "short_form",
      "link": "https://..."
    }
  ],
  
  "billingTemplates": [
    {
      "target": "billing",
      "purpose": "Request itemized bill",
      "template": "Hello, I received a bill and would like an itemized statement with all CPT codes. Thank you.",
      "whenToUse": "Before paying any bill"
    }
  ],
  
  "insuranceTemplates": [
    {
      "target": "insurance",
      "purpose": "Clarify allowed amount",
      "template": "Hello, can you explain how the allowed amount was calculated for my recent claim?",
      "whenToUse": "When EOB seems unclear"
    }
  ],
  
  "eobData": null
}

IMPORTANT FIELD NAMES - USE EXACTLY THESE:
- cptCodes array: use "shortLabel" (not "label"), "whereUsed" (not "commonlyUsedIn"), "complexityLevel" (not "complexity")
- cptCodes.commonQuestions: use "callWho" (not "askWho")
- cptCodes.category must be one of: "evaluation", "lab", "radiology", "surgery", "medicine", "other"
- cptCodes.complexityLevel must be one of: "simple", "moderate", "complex"
- visitWalkthrough: use "order" (not "step")
- codeQuestions: use "cptCode" and "suggestCall" (not "code" and "askWho")
- billingEducation: use "billedVsAllowed", "deductibleExplanation", "copayCoinsurance"
- stateHelp: use "medicaidInfo" (not "medicaidProgram"), include "debtProtections" array and "reliefPrograms" array
- providerAssistance: use "charityCareSummary" (not "charityCareExplanation"), include "eligibilityNotes"
- debtAndCreditInfo: must be an array of strings
- billingTemplates/insuranceTemplates: use "target", "purpose", "template", "whenToUse"
- financialOpportunities: use "eligibilityHint" and "effortLevel"
- effortLevel must be one of: "quick_call", "short_form", "detailed_application"

## STYLE RULES
- Reading level: 6th–8th grade, short sentences, minimal jargon
- Clearly distinguish between what codes mean (explainer) vs how billing works (billing & next steps)
- Always name the state when describing protections or programs
- When uncertain, say "may," "often," or "you can ask"`;

const EOB_PROMPT_ADDITION = `

## ADDITIONAL EOB ANALYSIS
An EOB (Explanation of Benefits) has also been provided. You must:

1. Extract EOB data into the eobData field:
{
  "eobData": {
    "claimNumber": "Claim number",
    "processedDate": "Date",
    "billedAmount": number,
    "allowedAmount": number,
    "insurancePaid": number,
    "patientResponsibility": number,
    "deductibleApplied": number,
    "coinsurance": number,
    "copay": number,
    "discrepancies": [
      {
        "type": "mismatch",
        "description": "Bill shows $X but EOB says you owe $Y",
        "billedValue": number,
        "eobValue": number
      }
    ]
  }
}

2. In billingEducation.eobSummary, use actual EOB values:
   "Your insurer allowed $X, paid $Y, and says you owe $Z."

3. In billingIssues, flag any discrepancies between bill and EOB.

4. In templates, include specific references to claim number and amounts.`;

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
${hasEOB ? '\nIMPORTANT: An EOB (Explanation of Benefits) is also provided. Use it to enhance the analysis with actual insurance payment details and flag any discrepancies.' : ''}

CRITICAL: Output ONLY valid JSON matching the EXACT field names specified in the system prompt.

Remember: Write simply at 6th-8th grade level, avoid jargon, be reassuring but help identify potential issues worth asking about.`;

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
    
    cptCodes: [],
    
    visitWalkthrough: [
      { order: 1, description: 'You received medical services from the provider.', relatedCodes: [] },
      { order: 2, description: 'The provider documented the services and assigned billing codes.', relatedCodes: [] },
      { order: 3, description: 'This bill was generated based on those services.', relatedCodes: [] }
    ],
    
    codeQuestions: [],
    
    billingEducation: {
      billedVsAllowed: 'The billed amount is what the provider charges. If you have insurance, they negotiate an "allowed amount" - often lower than the billed amount. Your insurance pays their share, and you pay the rest.',
      deductibleExplanation: 'Your deductible is the amount you pay out-of-pocket before insurance starts covering costs.',
      copayCoinsurance: 'A copay is a fixed amount per visit (like $30). Coinsurance is a percentage of the allowed amount you pay (like 20%) after meeting your deductible.',
      eobSummary: hasEOB ? 'Unable to parse EOB details. Please compare amounts manually.' : undefined
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
      charityCareSummary: 'Many providers offer financial assistance programs for patients who cannot afford their bills. Contact the billing department to ask about options.',
      eligibilityNotes: 'Eligibility typically depends on income and family size.'
    },
    
    debtAndCreditInfo: [
      'Medical debt under $500 typically cannot appear on your credit report.',
      'You have at least 12 months before most medical debt can be reported to credit bureaus.',
      'Paid medical debt must be removed from credit reports within 45 days.'
    ],
    
    billingIssues: [],
    
    financialOpportunities: [
      {
        title: 'Ask About Financial Assistance',
        description: 'Many providers offer charity care or sliding scale discounts.',
        eligibilityHint: 'Based on income and family size.',
        effortLevel: 'quick_call'
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
