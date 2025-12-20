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

CPT CODE CATEGORIES (use these to classify codes):
- Evaluation & Management (E/M): 99201-99499 - Office/hospital visits
- Anesthesia: 00100-01999 - Anesthesia services  
- Surgery: 10000-69999 - Surgical procedures
- Radiology: 70000-79999 - X-rays, CT, MRI, ultrasound
- Pathology/Lab: 80000-89999 - Lab tests and pathology
- Medicine: 90000-99199 - Vaccines, therapy, other medical services
- Physical/Occupational Therapy: 97000-97799 - PT/OT services

COMMON CPT CODE PREFIXES:
- 99xxx = E/M codes (office visits, hospital visits, consultations)
- 80xxx-89xxx = Lab tests
- 70xxx-79xxx = Radiology/imaging
- 96xxx-97xxx = Therapy services
- 90xxx = Vaccines, injections, psychiatry

MODIFIER EXPLANATIONS:
- -25: Significant, separately identifiable E/M service
- -26: Professional component only
- -TC: Technical component only
- -50: Bilateral procedure (both sides of body)
- -51: Multiple procedures
- -59: Distinct procedural service
- -76: Repeat procedure by same physician
- -77: Repeat procedure by different physician
- -LT/-RT: Left side/Right side

RED FLAGS TO CHECK FOR:
1. Duplicate charges: Same CPT code appearing multiple times without clear justification
2. Unbundling: Services that should be billed together being billed separately
3. Upcoding: Higher-complexity E/M codes (99214, 99215) for what seemed like a simple visit
4. Missing modifiers: When bilateral or repeat procedures lack proper modifiers
5. Code/treatment mismatch: CPT codes that don't align with what the patient remembers happening

For each document, analyze and provide this JSON structure:

{
  "documentType": "Bill, EOB, chart, denial letter, etc.",
  "issuer": "Who issued the document",
  "dateOfService": "Date(s) of service",
  "documentPurpose": "Brief explanation of what this document is for",
  
  "visitSummary": "A 2-3 sentence narrative in plain English of what likely happened during this visit based on the codes",
  
  "lineItems": [
    {
      "id": "unique-id",
      "description": "Service description",
      "amount": 0.00,
      "explanation": "Plain English explanation of what this charge is for",
      "category": "E/M Visit, Lab Test, Imaging, Procedure, Therapy, Supply, Other",
      "whyTypicallyDone": "Brief explanation of why this service is typically performed"
    }
  ],
  
  "medicalCodes": [
    {
      "code": "CPT/HCPCS code",
      "type": "CPT, HCPCS, or ICD",
      "description": "Official short description",
      "plainEnglish": "Simple one-sentence explanation for a non-medical person",
      "category": "E/M, Lab, Imaging, Surgery, Therapy, Medicine, etc.",
      "typicalPurpose": "Why this code is commonly billed",
      "commonQuestions": ["Questions patients often ask about this code"]
    }
  ],
  
  "redFlags": [
    {
      "type": "duplicate, unbundling, upcoding, mismatch, or other",
      "issue": "Brief description of the potential issue",
      "question": "Suggested question to ask the billing department"
    }
  ],
  
  "thingsToAsk": [
    "Question to ask the billing office or insurer"
  ],
  
  "faqs": [
    {
      "question": "Common question about this type of bill",
      "answer": "Simple answer"
    }
  ],
  
  "potentialIssues": [
    {
      "title": "Issue title",
      "description": "Worth asking about because..."
    }
  ],
  
  "financialAssistance": [
    "Information about charity care, sliding scale, prompt-pay discounts, payment plans"
  ],
  
  "patientProtections": [
    "Relevant state and federal protections that may apply"
  ],
  
  "actionPlan": [
    {
      "step": 1,
      "action": "First step to take",
      "details": "More specific guidance"
    }
  ],
  
  "glossary": {
    "term": "Simple definition"
  },
  
  "learnForNextTime": [
    "Tips for understanding future medical bills"
  ]
}

VISIT SUMMARY GUIDELINES:
Generate a narrative like: "Based on the codes on this bill, here's what likely happened during this visit: You had a [visit type] with your doctor. They ordered [X] lab tests. You received [Y] procedure(s). [Additional context based on codes]."

GLOSSARY TERMS TO INCLUDE (when relevant):
- CPT: Current Procedural Terminology - codes that describe medical services
- E/M: Evaluation and Management - codes for doctor visits
- Modifier: An add-on to a code that provides more detail
- Copay: Your fixed amount to pay at the visit
- Deductible: Amount you pay before insurance kicks in
- Coinsurance: Your percentage share of costs
- Allowed Amount: What insurance agrees to pay for a service
- EOB: Explanation of Benefits - summary of what insurance paid

Output ONLY valid JSON matching this structure.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, documentType, state, language } = await req.json();
    
    console.log('Analyzing document:', { documentType, state, language, contentLength: documentContent?.length });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const userPromptText = `Analyze this medical document for a patient in ${state}. 
Document type: ${documentType || 'unknown'}
Output language: ${language === 'en' ? 'English' : language === 'es' ? 'Spanish' : language === 'zh' ? 'Simplified Chinese' : language === 'ar' ? 'Arabic' : language === 'hi' ? 'Hindi' : 'English'}

CRITICAL INSTRUCTIONS:
1. Extract ALL CPT/HCPCS codes visible in the document
2. For each code, provide plain-English explanations of what the service is
3. Check for potential billing errors or red flags:
   - Duplicate charges (same code billed twice)
   - Unusually high visit complexity codes for what might be a simple visit
   - Codes that might not match typical treatment patterns
4. Group services into categories (Visit, Labs, Imaging, Procedures, etc.)
5. Create a simple narrative of "what happened" based on the codes
6. Generate questions the patient should ask their billing department
7. Include relevant state-specific patient protections for ${state}

Remember: Write simply, avoid medical jargon, be reassuring but help identify potential issues worth asking about.

Output ONLY valid JSON matching the required structure.`;

    // Build messages based on content type
    let messages: any[];
    
    // Check if documentContent is a data URL (image or PDF)
    if (documentContent.startsWith('data:image/')) {
      // For images (including HEIC converted to base64), use vision capabilities
      const base64Data = documentContent.split(',')[1];
      const mimeType = documentContent.split(';')[0].split(':')[1];
      
      console.log('Processing image with MIME type:', mimeType);
      
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: userPromptText },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:${mimeType};base64,${base64Data}` 
              } 
            }
          ]
        }
      ];
    } else if (documentContent.startsWith('data:application/pdf')) {
      // For PDFs, Gemini can handle PDF base64 data
      const base64Data = documentContent.split(',')[1];
      
      console.log('Processing PDF document');
      
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: userPromptText + '\n\n[Note: This is a PDF document being provided for analysis. Please read all text, tables, and CPT codes visible in the document.]' },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:application/pdf;base64,${base64Data}` 
              } 
            }
          ]
        }
      ];
    } else if (documentContent.startsWith('data:')) {
      // For other binary formats (HEIC, TIFF, etc.), try as image
      const base64Data = documentContent.split(',')[1];
      const mimeType = documentContent.split(';')[0].split(':')[1] || 'image/jpeg';
      
      console.log('Processing binary file with MIME type:', mimeType);
      
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: userPromptText },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:${mimeType};base64,${base64Data}` 
              } 
            }
          ]
        }
      ];
    } else {
      // For plain text content
      console.log('Processing text content');
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${userPromptText}\n\nDocument content:\n${documentContent}` }
      ];
    }

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
      // Return a structured fallback with the raw content for debugging
      analysis = {
        documentType: 'Medical Document',
        issuer: 'Unknown Provider',
        dateOfService: 'Not specified',
        documentPurpose: 'This document contains medical billing information.',
        visitSummary: 'Unable to fully parse the document. Please review the charges carefully.',
        lineItems: [],
        medicalCodes: [],
        redFlags: [],
        thingsToAsk: [
          'Can you provide an itemized statement with all CPT codes and descriptions?',
          'Are there any discounts available for prompt payment?'
        ],
        faqs: [
          { question: 'What should I do if I have questions?', answer: 'Call the billing department using the phone number on your statement.' }
        ],
        potentialIssues: [],
        financialAssistance: ['Contact your healthcare provider to ask about financial assistance programs, payment plans, or charity care options.'],
        patientProtections: ['You have the right to request an itemized bill and dispute any charges you believe are incorrect.'],
        actionPlan: [
          { step: 1, action: 'Review the document carefully', details: 'Look for any charges or codes that seem unclear or unfamiliar.' },
          { step: 2, action: 'Contact the billing department', details: 'Ask for a detailed explanation of each charge and CPT code.' }
        ],
        glossary: {
          'CPT': 'Current Procedural Terminology - standard codes for medical services',
          'EOB': 'Explanation of Benefits - document showing what insurance paid'
        },
        learnForNextTime: [
          'Always ask for an itemized bill after any medical visit',
          'Keep records of what services you received for comparison'
        ]
      };
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
