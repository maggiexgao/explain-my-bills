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
Using the patient's state, summarize key protections (2-5 bullets) based on:
- Commonwealth Fund "State Protections Against Medical Debt" report and map
- Limits on interest, wage garnishment, home liens, or credit reporting
- Collection practices and billing transparency rules
- Special protections for low-income or uninsured patients
- Include reference links for that state

#### 2A-3. Medicaid/CHIP and state coverage options
Surface the correct state program name and website (2-3 bullets):
- Who may qualify (low income, children, pregnant, disability)
- Link to "Apply / Learn more" page
- Mark as informational, not eligibility determination

#### 2A-4. Hospital and provider financial-assistance programs
Based on Hilltop Institute hospital community-benefit resources:
- Explain what "financial assistance" or "charity care" is
- If hospital identifiable, link to their financial-assistance policy
- Include 2-4 bullets on what patients can ask for: discounts, charity care, payment plans

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
- Make clear this is not a guarantee of eligibility

#### 2B-3. Templates: questions to ask
Provide two sets of copy-and-paste templates:

**To billing department:**
- Ask for itemized bill with codes
- Ask about duplicate or high-complexity codes
- Ask about payment plans and financial assistance

**To insurance company:**
- Ask how allowed amount was calculated
- Ask about deductible and out-of-pocket calculations
- Ask to reconcile EOB vs provider bill differences

Keep templates 2-5 sentences, polite, plain language.

## OUTPUT FORMAT
You must return valid JSON with this exact structure:
{
  "documentType": "bill",
  "issuer": "Provider name",
  "dateOfService": "Date",
  "totalAmount": number,
  "summary": "Brief overview of what this bill is for",
  "state": "Two-letter state code",
  
  "cptCodes": [
    {
      "code": "99213",
      "label": "Follow-up doctor visit",
      "explanation": "A short visit to check on an existing issue and adjust treatment if needed.",
      "category": "E/M",
      "commonlyUsedIn": "Primary care, specialty follow-ups",
      "complexity": "Low to moderate complexity"
    }
  ],
  
  "visitWalkthrough": [
    {
      "step": 1,
      "description": "You checked in and had a follow-up visit with your doctor."
    }
  ],
  
  "codeQuestions": [
    {
      "code": "99213",
      "question": "Why am I being charged for both a visit and a test?",
      "answer": "These are separate services. The visit covers time with your doctor; the test is the actual lab work. Ask billing if unclear.",
      "askWho": "billing"
    }
  ],
  
  "billingEducation": {
    "howBillingWorks": "Simple explanation of billed charge vs allowed amount vs patient responsibility...",
    "deductibleExplanation": "How deductibles, copays, and coinsurance factor in..."
  },
  
  "stateHelp": {
    "state": "CA",
    "stateName": "California",
    "protections": [
      {
        "title": "Medical Debt Credit Reporting",
        "description": "California limits when medical debt can be reported to credit bureaus.",
        "link": "https://..."
      }
    ],
    "medicaidProgram": {
      "name": "Medi-Cal",
      "description": "California's Medicaid program for low-income residents.",
      "eligibility": "Low income, children, pregnant, disability",
      "applyLink": "https://www.dhcs.ca.gov/services/medi-cal"
    }
  },
  
  "providerAssistance": {
    "providerType": "hospital",
    "providerName": "Memorial Hospital",
    "charityCareExplanation": "Many hospitals offer financial assistance or 'charity care' programs...",
    "financialAssistanceLink": "https://...",
    "whatToAskFor": ["Itemized bill", "Financial assistance application", "Payment plan options", "Charity care eligibility"]
  },
  
  "debtAndCreditInfo": {
    "stateRules": "In [state], medical debt cannot be reported to credit bureaus until...",
    "federalRules": "Under federal law, medical debt under $500 cannot appear on credit reports.",
    "consumerGuideLink": "https://..."
  },
  
  "billingIssues": [
    {
      "type": "duplicate",
      "title": "Possible duplicate charge",
      "description": "Code 99213 appears twice on the same date.",
      "suggestedQuestion": "Can you explain why this code was billed twice on the same day?",
      "severity": "warning"
    }
  ],
  
  "financialOpportunities": [
    {
      "title": "Hospital Financial Assistance",
      "description": "You may qualify for the hospital's financial assistance program.",
      "eligibility": "Based on income and family size",
      "effort": "Short online form",
      "link": "https://..."
    }
  ],
  
  "billingTemplates": [
    {
      "purpose": "Request itemized bill",
      "template": "Hello, I received a bill dated [DATE] for $[AMOUNT]. Could you please send me an itemized statement showing all CPT codes, descriptions, and individual charges? Thank you.",
      "context": "Use this first to understand what you're being charged for."
    }
  ],
  
  "insuranceTemplates": [
    {
      "purpose": "Clarify allowed amount",
      "template": "Hello, I'm calling about claim [NUMBER] from [DATE]. Can you explain how the allowed amount was calculated and break down my patient responsibility? Thank you.",
      "context": "Use when EOB seems unclear or amounts don't match your bill."
    }
  ],
  
  "eobData": null
}

## STYLE RULES
- Reading level: 6th–8th grade, short sentences, minimal jargon
- Clearly distinguish between what codes mean (explainer) vs how billing works (billing & next steps)
- Always name the state when describing protections or programs (e.g., "In Virginia, …")
- When uncertain, say "may," "often," or "you can ask"
- Always provide concrete, respectful questions users can ask

## STATE RESOURCES TO REFERENCE
Base state-specific content on:
- Commonwealth Fund "State Protections Against Medical Debt" report and map
- Hilltop Institute hospital community-benefit resources and state law profiles
- Official state Medicaid/CHIP websites
- Reputable sources on state medical-debt protections`;

const EOB_PROMPT_ADDITION = `

## ADDITIONAL EOB ANALYSIS
An EOB (Explanation of Benefits) has also been provided. You must:

1. Extract EOB data into the eobData field:
   - allowedAmount: What the insurance allowed
   - planPaid: What insurance paid
   - patientResponsibility: What patient owes per EOB
   - claimNumber: The claim reference number
   - processedDate: When the claim was processed

2. In billingEducation, use actual EOB values:
   "Your insurer allowed $X, paid $Y, and says you owe $Z."

3. In billingIssues, flag any discrepancies:
   - If billed amount differs significantly from allowed amount
   - If provider bill doesn't match EOB patient responsibility
   - Any services that were denied or adjusted

4. In templates, include specific references:
   - Claim number
   - EOB date
   - Specific dollar amounts for discrepancies

5. Update eobData in your response:
{
  "eobData": {
    "claimNumber": "Claim number",
    "processedDate": "Date",
    "billedAmount": number,
    "allowedAmount": number,
    "planPaid": number,
    "patientResponsibility": number,
    "deductibleApplied": number,
    "coinsurance": number,
    "copay": number,
    "discrepancies": [
      {
        "type": "mismatch",
        "description": "Bill shows $X but EOB says you owe $Y",
        "billValue": number,
        "eobValue": number
      }
    ]
  }
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

    const userPromptText = `Analyze this medical document for a patient in ${state || 'an unspecified U.S. state'}. 
Document type: ${documentType || 'medical bill'}
Output language: ${language === 'en' ? 'English' : language === 'es' ? 'Spanish' : language === 'zh' ? 'Simplified Chinese' : language === 'ar' ? 'Arabic' : language === 'hi' ? 'Hindi' : 'English'}
${hasEOB ? '\nIMPORTANT: An EOB (Explanation of Benefits) is also provided. Use it to enhance the analysis with actual insurance payment details and flag any discrepancies.' : ''}

CRITICAL INSTRUCTIONS:
1. Extract ALL CPT/HCPCS codes visible in the document
2. For each code, provide plain-English explanations in the cptCodes array
3. Generate a visitWalkthrough of 4-7 steps describing what happened
4. Generate codeQuestions for the major codes
5. Check for potential billing errors and add to billingIssues
6. Provide billingEducation explaining how this bill works
7. Include state-specific help for ${state || 'the patient\'s state'} in stateHelp
8. Generate 2-3 billingTemplates and 2-3 insuranceTemplates specific to this bill
9. Identify financialOpportunities based on the bill size and provider
${hasEOB ? '10. Extract EOB data and flag any discrepancies between bill and EOB' : ''}

Remember: Write simply at 6th-8th grade level, avoid jargon, be reassuring but help identify potential issues worth asking about.

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
    totalAmount: 0,
    summary: 'This document contains medical billing information. We were unable to fully parse it - please try uploading a clearer image.',
    state: state,
    
    cptCodes: [],
    
    visitWalkthrough: [
      { step: 1, description: 'You received medical services from the provider.' },
      { step: 2, description: 'The provider documented the services and assigned billing codes.' },
      { step: 3, description: 'This bill was generated based on those services.' }
    ],
    
    codeQuestions: [],
    
    billingEducation: {
      howBillingWorks: 'The billed amount is what the provider charges. If you have insurance, they negotiate an "allowed amount" - often lower than the billed amount. Your insurance pays their share, and you pay the rest (your "patient responsibility").',
      deductibleExplanation: 'Your deductible is the amount you pay out-of-pocket before insurance starts covering costs. A copay is a fixed amount per visit. Coinsurance is a percentage of the allowed amount you pay after meeting your deductible.'
    },
    
    stateHelp: {
      state: state,
      stateName: state,
      protections: [],
      medicaidProgram: {
        name: 'Medicaid',
        description: 'Government health coverage for low-income individuals and families.',
        eligibility: 'Varies by state - typically based on income, family size, disability, and other factors.',
        applyLink: 'https://www.healthcare.gov/medicaid-chip/'
      }
    },
    
    providerAssistance: {
      providerType: 'unknown',
      providerName: 'Your Healthcare Provider',
      charityCareExplanation: 'Many hospitals and clinics offer financial assistance programs (sometimes called "charity care") for patients who cannot afford their bills. These programs may reduce or eliminate your bill based on your income.',
      financialAssistanceLink: null,
      whatToAskFor: ['Itemized bill with CPT codes', 'Financial assistance application', 'Payment plan options', 'Charity care eligibility information']
    },
    
    debtAndCreditInfo: {
      stateRules: 'Medical debt protections vary by state. Contact your state attorney general\'s office for specific rules.',
      federalRules: 'Under federal law, medical debt under $500 cannot appear on credit reports, and paid medical debt must be removed.',
      consumerGuideLink: 'https://www.consumerfinance.gov/consumer-tools/debt-collection/'
    },
    
    billingIssues: [],
    
    financialOpportunities: [
      {
        title: 'Ask About Financial Assistance',
        description: 'Many providers offer charity care or sliding scale discounts for patients with financial need.',
        eligibility: 'Based on income and family size',
        effort: 'Quick phone call',
        link: null
      }
    ],
    
    billingTemplates: [
      {
        purpose: 'Request an itemized bill',
        template: 'Hello, I\'m calling about my account. Can you please send me a fully itemized bill showing each charge with the CPT codes and descriptions?',
        context: 'Use this first to understand what you\'re being charged for.'
      },
      {
        purpose: 'Ask about financial assistance',
        template: 'I\'m having difficulty paying this bill. Can you tell me about any financial assistance programs or payment plans that might be available?',
        context: 'Use when the amount is more than you can afford.'
      }
    ],
    
    insuranceTemplates: [
      {
        purpose: 'Verify what you owe',
        template: 'I received a bill for a recent visit. Can you confirm what my actual patient responsibility is after insurance?',
        context: 'Use to confirm the bill matches what insurance says you owe.'
      }
    ],
    
    eobData: hasEOB ? {
      claimNumber: 'Unable to parse',
      processedDate: null,
      billedAmount: 0,
      allowedAmount: 0,
      planPaid: 0,
      patientResponsibility: 0,
      deductibleApplied: 0,
      coinsurance: 0,
      copay: 0,
      discrepancies: []
    } : null
  };
}
