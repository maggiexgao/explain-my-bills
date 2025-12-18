import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a medical document analysis assistant. Your role is to help patients understand medical bills, EOBs (Explanation of Benefits), and other medical documents in simple, non-medical language.

IMPORTANT RULES:
- You provide educational information ONLY, not medical or legal advice
- Never diagnose, treat, or interpret medical necessity
- Use calm, neutral, respectful language
- Avoid jargon - explain everything simply
- Use soft language like "patients often ask about..." or "many patients choose to..."
- Be reassuring and non-judgmental

For each document, analyze and provide:
1. documentType: What type of document this is (bill, EOB, chart, denial letter, etc.)
2. issuer: Who issued the document
3. dateOfService: Date(s) of service mentioned
4. lineItems: Array of charges/items with id, description, amount, and explanation
5. medicalCodes: Array of codes found with code, type (CPT/ICD/HCPCS), description, and commonQuestions
6. faqs: Array of common questions patients ask about this type of document
7. potentialIssues: Array of potential billing/administrative issues (use soft language)
8. financialAssistance: Information about charity care, sliding scale, prompt-pay discounts
9. patientProtections: State and federal protections that may apply
10. actionPlan: Step-by-step guidance for patients (non-directive)

Output ONLY valid JSON matching this structure.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, documentType, state, language } = await req.json();
    
    console.log('Analyzing document:', { documentType, state, language });
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const userPromptText = `Analyze this medical document for a patient in ${state}. 
Document type: ${documentType || 'unknown'}
Output language: ${language === 'en' ? 'English' : language === 'es' ? 'Spanish' : language === 'zh' ? 'Simplified Chinese' : language === 'ar' ? 'Arabic' : language === 'hi' ? 'Hindi' : 'English'}

Provide a comprehensive analysis in the specified language. Remember to use simple, non-medical language and be reassuring.
Output ONLY valid JSON matching the required structure.`;

    // Build messages based on content type
    let messages: any[];
    
    // Check if documentContent is a data URL (image or PDF)
    if (documentContent.startsWith('data:image/')) {
      // For images, use vision capabilities
      const base64Data = documentContent.split(',')[1];
      const mimeType = documentContent.split(';')[0].split(':')[1];
      
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
      // For PDFs, we need to tell the model we have a PDF
      // Gemini can handle PDF base64 data
      const base64Data = documentContent.split(',')[1];
      
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: userPromptText + '\n\n[Note: This is a PDF document being provided for analysis]' },
            { 
              type: 'image_url', 
              image_url: { 
                url: `data:application/pdf;base64,${base64Data}` 
              } 
            }
          ]
        }
      ];
    } else {
      // For plain text content
      messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${userPromptText}\n\nDocument content:\n${documentContent}` }
      ];
    }

    console.log('Sending request with message type:', documentContent.startsWith('data:') ? 'multimodal' : 'text');

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
    console.log('AI response data:', JSON.stringify(data, null, 2));
    
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('Full AI response:', JSON.stringify(data, null, 2));
      // Try alternative response structures
      const alternativeContent = data.content || data.message || data.result;
      if (alternativeContent) {
        console.log('Using alternative content structure');
      } else {
        throw new Error('No content in AI response');
      }
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
    } catch {
      console.error('Failed to parse AI response as JSON:', content);
      // Return a structured fallback
      analysis = {
        documentType: 'Medical Document',
        issuer: 'Unknown',
        dateOfService: 'Not specified',
        lineItems: [],
        medicalCodes: [],
        faqs: [
          { question: 'What is this document?', answer: 'This appears to be a medical document. Please review it carefully.' }
        ],
        potentialIssues: [],
        financialAssistance: {
          overview: 'Contact your healthcare provider to ask about financial assistance programs.',
          options: []
        },
        patientProtections: [],
        actionPlan: [
          { step: 1, action: 'Review the document carefully', details: 'Look for any charges or information that seems unclear.' },
          { step: 2, action: 'Contact the billing department', details: 'If you have questions, call the number on the document.' }
        ]
      };
    }

    console.log('Analysis completed successfully');

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
