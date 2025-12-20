import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a medical bill analysis assistant that explains medical bills in simple, friendly language for non-experts.

Your main job: take CPT codes from a user's bill and turn them into clear explanations, basic checks, and actionable next steps.

CORE GOALS:
1. Help users understand what actually happened during their visit
2. Help users spot obvious red flags or possible billing errors
3. Provide CPT "decoder + glossary" explanations
4. Teach users how to use this understanding for future visits

IMPORTANT RULES:
- Write at a 6th-8th grade reading level. Avoid jargon.
- Never assume a diagnosis or clinical details beyond what the code description supports
- Never promise exact insurance payments, allowed amounts, or what the physician "earns"
- Do not criticize specific doctors or insurers; give the user language to ask questions
- Be concise but clear: users are stressed and want quick understanding
- You provide educational information ONLY, not medical or legal advice
- Frame red flags as questions, not accusations

CPT CODE CATEGORIES:
- evaluation: 99201-99499 - Office/hospital visits (E/M)
- lab: 80000-89999 - Lab tests and pathology
- radiology: 70000-79999 - X-rays, CT, MRI, ultrasound
- surgery: 10000-69999 - Surgical procedures
- medicine: 90000-99199 - Vaccines, therapy, other medical services
- other: Anything else

For each document, analyze and provide this JSON structure:

{
  "documentType": "bill | eob | chart | denial | unknown",
  "issuer": "Who issued the document (hospital/clinic name)",
  "dateOfService": "Date(s) of service",
  "documentPurpose": "Brief explanation of what this document is for",

  "cptCodes": [
    {
      "code": "CPT code (e.g., 99213)",
      "shortLabel": "Short 2-5 word label (e.g., 'Follow-up doctor visit')",
      "explanation": "One sentence explanation in plain English",
      "category": "evaluation | lab | radiology | surgery | medicine | other",
      "whereUsed": "Where this code is commonly used (e.g., 'Primary care, urgent care visits')",
      "complexityLevel": "simple | moderate | complex",
      "commonQuestions": [
        {
          "question": "Common patient question about this code",
          "answer": "Simple answer",
          "callWho": "billing | insurance | either"
        }
      ]
    }
  ],

  "visitWalkthrough": [
    {
      "order": 1,
      "description": "You checked in and saw your doctor.",
      "relatedCodes": ["99213"]
    }
  ],

  "codeQuestions": [
    {
      "cptCode": "99213",
      "question": "Common question about this specific code",
      "answer": "Simple answer",
      "suggestCall": "billing | insurance | either"
    }
  ],

  "billingEducation": {
    "billedVsAllowed": "Explanation of billed amount vs allowed amount in context of this bill",
    "deductibleExplanation": "Explanation of how deductibles work",
    "copayCoinsurance": "Explanation of copay vs coinsurance",
    "eobSummary": "If EOB is present, summarize what it shows (optional)"
  },

  "stateHelp": {
    "state": "State abbreviation",
    "medicaidInfo": {
      "description": "Brief description of Medicaid/CHIP in this state",
      "eligibilityLink": "URL to check eligibility"
    },
    "chipInfo": {
      "description": "CHIP info if applicable",
      "eligibilityLink": "URL"
    },
    "debtProtections": ["State-specific medical debt protections"],
    "reliefPrograms": [
      {
        "name": "Program name",
        "description": "What it offers",
        "link": "URL if available"
      }
    ]
  },

  "providerAssistance": {
    "providerName": "Hospital/clinic name from bill",
    "providerType": "hospital | clinic | lab | other",
    "charityCareSummary": "Explanation of charity care and when it applies",
    "financialAssistanceLink": "URL to provider's financial assistance page if identifiable",
    "eligibilityNotes": "Who typically qualifies"
  },

  "debtAndCreditInfo": [
    "Key fact about medical debt and credit in this state"
  ],

  "billingIssues": [
    {
      "type": "duplicate | upcoding | mismatch | missing_modifier | eob_discrepancy",
      "title": "Short title of the issue",
      "description": "Why this might be worth asking about",
      "suggestedQuestion": "Exact question to ask billing/insurance",
      "severity": "info | warning | important",
      "relatedCodes": ["CPT codes involved"]
    }
  ],

  "financialOpportunities": [
    {
      "title": "Name of opportunity",
      "description": "What it offers",
      "eligibilityHint": "Who might qualify",
      "effortLevel": "quick_call | short_form | detailed_application",
      "link": "URL if available"
    }
  ],

  "billingTemplates": [
    {
      "purpose": "What this template is for",
      "template": "Exact words to say when calling the billing department",
      "whenToUse": "When to use this template"
    }
  ],

  "insuranceTemplates": [
    {
      "purpose": "What this template is for",
      "template": "Exact words to say when calling insurance",
      "whenToUse": "When to use this template"
    }
  ],

  "lineItems": [
    {
      "id": "item-1",
      "description": "Service description",
      "amount": 0.00,
      "explanation": "Plain English explanation"
    }
  ],

  "medicalCodes": [
    {
      "code": "CPT code",
      "type": "CPT | HCPCS | ICD",
      "description": "Description",
      "typicalPurpose": "Why typically billed",
      "commonQuestions": ["Question 1", "Question 2"]
    }
  ],

  "faqs": [
    {
      "question": "Common question",
      "answer": "Answer"
    }
  ],

  "potentialIssues": [
    {
      "title": "Issue title",
      "description": "Description"
    }
  ],

  "financialAssistance": ["Assistance option 1", "Assistance option 2"],

  "patientProtections": ["Protection 1", "Protection 2"],

  "actionPlan": [
    {
      "step": 1,
      "action": "Action title",
      "details": "Action details"
    }
  ]
}

VISIT WALKTHROUGH GUIDELINES:
- Generate 4-7 ordered steps describing what likely happened
- Keep it conservative and generic - no diagnoses, just actions
- Base it on the CPT codes present
- Example: "You checked in and saw your doctor for a follow-up visit." "They drew blood for lab tests." "You had a chest X-ray taken."

BILLING ISSUES TO FLAG:
1. Duplicate charges: Same code appearing multiple times
2. Upcoding: High-complexity E/M codes (99214, 99215) for what might be a simple visit
3. Mismatch: Codes that don't match typical treatment patterns
4. EOB discrepancy: If EOB provided, flag mismatches between bill and EOB amounts

TEMPLATES GUIDELINES:
- Write in everyday, respectful language
- Be specific to the codes/amounts on this bill
- Give 2-3 billing templates and 2-3 insurance templates

Output ONLY valid JSON matching this structure.`;

const EOB_PROMPT_ADDITION = `

IMPORTANT: An Explanation of Benefits (EOB) document has also been provided.

When analyzing with EOB present:
1. Extract the claim number, processed date, billed amount, allowed amount, insurance paid, and patient responsibility
2. Compare EOB amounts to the bill amounts and flag any discrepancies
3. In billingEducation.eobSummary, provide a specific breakdown like: "Your plan allowed $X, paid $Y, and says you owe $Z"
4. In billingIssues, add any eob_discrepancy items where the bill and EOB don't match
5. In templates, reference specific claim numbers and amounts from the EOB

Add this to your response:
"eobData": {
  "claimNumber": "Claim number from EOB",
  "processedDate": "Date EOB was processed",
  "billedAmount": 0.00,
  "allowedAmount": 0.00,
  "insurancePaid": 0.00,
  "patientResponsibility": 0.00,
  "deductibleApplied": 0.00,
  "coinsurance": 0.00,
  "copay": 0.00,
  "discrepancies": [
    {
      "type": "overbilled | underpaid | mismatch | duplicate",
      "description": "Description of the discrepancy",
      "billedValue": 0.00,
      "eobValue": 0.00
    }
  ]
}`;

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

    const userPromptText = `Analyze this medical document for a patient in ${state}. 
Document type: ${documentType || 'unknown'}
Output language: ${language === 'en' ? 'English' : language === 'es' ? 'Spanish' : language === 'zh' ? 'Simplified Chinese' : language === 'ar' ? 'Arabic' : language === 'hi' ? 'Hindi' : 'English'}
${hasEOB ? '\nIMPORTANT: An EOB (Explanation of Benefits) is also provided. Use it to enhance the analysis with actual insurance payment details.' : ''}

CRITICAL INSTRUCTIONS:
1. Extract ALL CPT/HCPCS codes visible in the document
2. For each code, provide plain-English explanations structured in cptCodes array
3. Generate a visitWalkthrough of 4-7 steps describing what happened
4. Generate codeQuestions for the major codes
5. Check for potential billing errors and add to billingIssues
6. Provide billingEducation with context for this specific bill
7. Include state-specific help for ${state} in stateHelp
8. Generate 2-3 billingTemplates and 2-3 insuranceTemplates specific to this bill
9. Identify financialOpportunities based on the bill size and provider
${hasEOB ? '10. Extract EOB data and flag any discrepancies between bill and EOB' : ''}

Remember: Write simply, avoid medical jargon, be reassuring but help identify potential issues worth asking about.

Output ONLY valid JSON matching the required structure.`;

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
      analysis = createFallbackAnalysis(state, hasEOB);
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
    
    cptCodes: [],
    visitWalkthrough: [
      { order: 1, description: 'You received medical services from the provider.', relatedCodes: [] },
      { order: 2, description: 'The provider documented the services and assigned billing codes.', relatedCodes: [] },
      { order: 3, description: 'This bill was generated based on those services.', relatedCodes: [] }
    ],
    codeQuestions: [],
    
    billingEducation: {
      billedVsAllowed: 'The billed amount is what the provider charges. The allowed amount is the maximum your insurance will pay for that service - often lower than the billed amount.',
      deductibleExplanation: 'Your deductible is the amount you pay out-of-pocket before insurance starts covering costs. If you haven\'t met it yet, you may owe more.',
      copayCoinsurance: 'A copay is a fixed amount per visit. Coinsurance is a percentage of the allowed amount you pay after meeting your deductible.',
      eobSummary: hasEOB ? 'Unable to parse EOB details. Please compare amounts manually.' : undefined
    },
    
    stateHelp: {
      state: state,
      medicaidInfo: {
        description: 'Medicaid provides health coverage for eligible low-income individuals.',
        eligibilityLink: 'https://www.medicaid.gov/about-us/beneficiary-resources/index.html'
      },
      debtProtections: [],
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
      'You have at least 12 months before most medical debt can be reported to credit bureaus.'
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
        purpose: 'Request an itemized bill',
        template: 'Hi, I\'m calling about my account. Can you please send me a fully itemized bill showing each charge with the CPT codes?',
        whenToUse: 'Before paying any bill'
      },
      {
        purpose: 'Ask about financial assistance',
        template: 'I\'m having difficulty paying this bill. Can you tell me about any financial assistance programs that might be available?',
        whenToUse: 'When the amount is more than you can afford'
      }
    ],
    
    insuranceTemplates: [
      {
        purpose: 'Verify what you owe',
        template: 'I received a bill for a recent visit. Can you confirm what my actual patient responsibility is after insurance?',
        whenToUse: 'To confirm the bill matches what insurance says you owe'
      }
    ],
    
    lineItems: [],
    medicalCodes: [],
    faqs: [
      { question: 'What should I do if I have questions?', answer: 'Call the billing department using the phone number on your statement.' }
    ],
    potentialIssues: [],
    financialAssistance: ['Contact your healthcare provider to ask about financial assistance programs, payment plans, or charity care options.'],
    patientProtections: ['You have the right to request an itemized bill and dispute any charges you believe are incorrect.'],
    actionPlan: [
      { step: 1, action: 'Review the document', details: 'Look for any charges or codes that seem unclear.' },
      { step: 2, action: 'Request an itemized bill', details: 'Call billing to get a detailed breakdown.' },
      { step: 3, action: 'Ask about assistance', details: 'Inquire about payment plans or financial assistance if needed.' }
    ]
  };
}
