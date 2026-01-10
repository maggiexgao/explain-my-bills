import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid US state abbreviations
const US_STATE_ABBRS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

// Address-related keywords for context scoring
const ADDRESS_KEYWORDS = [
  'address', 'zip', 'billing', 'statement', 'patient', 'provider',
  'hospital', 'clinic', 'medical', 'service', 'po box', 'street', 
  'ave', 'blvd', 'rd', 'drive', 'suite', 'floor', 'city', 'state'
];

interface PreScanResult {
  zip5?: string;
  stateAbbr?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence?: string;
  stateSource?: 'text_pattern' | 'zip_lookup' | 'zip_prefix';
  ran: boolean;
  extractedText?: string;
  error?: string;
  candidatesConsidered?: number;
}

// Derive state from ZIP prefix (fallback method)
function deriveStateFromZipPrefix(zip5: string): string | null {
  const prefix = parseInt(zip5.substring(0, 3), 10);
  
  const prefixRanges: [number, number, string][] = [
    [0, 4, 'PR'], [5, 5, 'NY'], [6, 9, 'PR'],
    [10, 14, 'MA'], [15, 19, 'MA'], [20, 20, 'DC'],
    [21, 21, 'MD'], [22, 24, 'VA'], [25, 26, 'WV'],
    [27, 28, 'NC'], [29, 29, 'SC'], [30, 31, 'GA'],
    [32, 34, 'FL'], [35, 36, 'AL'], [37, 38, 'TN'],
    [39, 39, 'MS'], [40, 42, 'KY'], [43, 45, 'OH'],
    [46, 47, 'IN'], [48, 49, 'MI'], [50, 52, 'IA'],
    [53, 54, 'WI'], [55, 56, 'MN'], [57, 57, 'SD'],
    [58, 58, 'ND'], [59, 59, 'MT'], [60, 62, 'IL'],
    [63, 65, 'MO'], [66, 67, 'KS'], [68, 69, 'NE'],
    [70, 71, 'LA'], [72, 72, 'AR'], [73, 74, 'OK'],
    [75, 79, 'TX'], [80, 81, 'CO'], [82, 83, 'WY'],
    [84, 84, 'UT'], [85, 86, 'AZ'], [87, 88, 'NM'],
    [89, 89, 'NV'], [90, 96, 'CA'], [97, 97, 'OR'],
    [98, 99, 'WA'],
  ];
  
  for (const [min, max, state] of prefixRanges) {
    if (prefix >= min && prefix <= max) {
      return state;
    }
  }
  
  return null;
}

// Extract location from extracted text using regex patterns
function extractLocationFromText(text: string): { 
  zip5?: string; 
  stateAbbr?: string; 
  evidence: string[];
  stateSource?: 'text_pattern' | 'zip_prefix' | 'zip_lookup';
  candidatesConsidered: number;
} {
  const evidence: string[] = [];
  let bestZip: string | undefined;
  let bestState: string | undefined;
  let stateSource: 'text_pattern' | 'zip_prefix' | undefined;
  let candidatesConsidered = 0;
  
  // PATTERN 1: City, ST ZIP pattern (highest confidence)
  const cityStateZipPattern = /([A-Za-z\s]+),?\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?/g;
  let match;
  
  while ((match = cityStateZipPattern.exec(text)) !== null) {
    candidatesConsidered++;
    const stateAbbr = match[2].toUpperCase();
    if (US_STATE_ABBRS.includes(stateAbbr)) {
      bestZip = match[3];
      bestState = stateAbbr;
      stateSource = 'text_pattern';
      evidence.push(match[0].trim().substring(0, 100));
      break;
    }
  }
  
  // PATTERN 2: Look for standalone ZIPs with context scoring
  if (!bestZip) {
    const zipPattern = /\b(\d{5})(?:-\d{4})?\b/g;
    const zipCandidates: { zip: string; context: string; score: number }[] = [];
    
    while ((match = zipPattern.exec(text)) !== null) {
      const zip = match[1];
      const zipNum = parseInt(zip, 10);
      candidatesConsidered++;
      
      // Basic validation: US ZIPs range from 00501 to 99950
      if (zipNum < 501 || zipNum > 99950) continue;
      
      // Skip if looks like a date (e.g., 03192024)
      const beforeChar = text[match.index - 1] || '';
      const afterChar = text[match.index + match[0].length] || '';
      if (beforeChar === '/' || afterChar === '/' || beforeChar === '-' || afterChar === '-') continue;
      
      // Get context around the ZIP (120 chars before, 20 after)
      const start = Math.max(0, match.index - 120);
      const end = Math.min(text.length, match.index + 30);
      const context = text.slice(start, end).toLowerCase();
      
      // Score based on nearby keywords
      let score = 0;
      for (const kw of ADDRESS_KEYWORDS) {
        if (context.includes(kw)) {
          score += 3;
        }
      }
      
      // Check for state abbreviation nearby
      for (const st of US_STATE_ABBRS) {
        if (context.toUpperCase().includes(st)) {
          score += 2;
          break;
        }
      }
      
      // Reduce score if in phone/fax context
      if (context.includes('phone') || context.includes('fax') || context.includes('tel') || context.includes('call')) {
        score -= 4;
      }
      
      // Reduce score if appears to be account/claim number
      if (context.includes('account') || context.includes('claim') || context.includes('id:') || context.includes('#')) {
        score -= 3;
      }
      
      zipCandidates.push({ zip, context: match[0], score });
    }
    
    // Sort by score and take best
    zipCandidates.sort((a, b) => b.score - a.score);
    if (zipCandidates.length > 0 && zipCandidates[0].score > 0) {
      bestZip = zipCandidates[0].zip;
      evidence.push(`ZIP: ${bestZip} (score: ${zipCandidates[0].score})`);
    }
  }
  
  // If no state yet but have ZIP, derive from prefix
  if (!bestState && bestZip) {
    bestState = deriveStateFromZipPrefix(bestZip) || undefined;
    if (bestState) {
      stateSource = 'zip_prefix';
    }
  }
  
  return { zip5: bestZip, stateAbbr: bestState, evidence, stateSource, candidatesConsidered };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, documentType } = await req.json();
    
    if (!documentContent) {
      return new Response(
        JSON.stringify({ error: 'No document content provided', ran: true, confidence: 'low' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('[pre-scan-location] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured', ran: true, confidence: 'low' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare the image content for the API
    const base64Data = documentContent.split(',')[1] || documentContent;
    let mimeType = 'image/jpeg';
    if (documentType?.includes('pdf')) {
      mimeType = 'application/pdf';
    } else if (documentType?.includes('png')) {
      mimeType = 'image/png';
    } else if (documentType?.includes('webp')) {
      mimeType = 'image/webp';
    }
    
    console.log('[pre-scan-location] Calling AI gateway for text extraction, mimeType:', mimeType);
    
    // Call Lovable AI Gateway using proper endpoint
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              },
              {
                type: 'text',
                text: `Extract ONLY address information from this medical document. 

PRIORITY ORDER - look for these in order:
1. Patient address (billing address, statement address)
2. Service location address
3. Provider/hospital address

For each address found, output it in this format:
ADDRESS: [Full street address, City, ST ZIP]

Focus on finding:
- Street addresses with city, state, and ZIP
- ZIP codes (5 digits or ZIP+4 format)
- State abbreviations (2 letters)

Keep response under 400 characters. Only output addresses found, nothing else.`
              }
            ]
          }
        ],
        temperature: 0,
        max_tokens: 400,
      }),
    });
    
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[pre-scan-location] AI gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', ran: true, confidence: 'low' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Service temporarily unavailable', ran: true, confidence: 'low' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to extract text from document', ran: true, confidence: 'low' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content || '';
    
    console.log('[pre-scan-location] Extracted text:', extractedText.substring(0, 200));
    
    // Parse the extracted text for ZIP and state
    const { zip5, stateAbbr, evidence, stateSource, candidatesConsidered } = extractLocationFromText(extractedText);
    
    // If we found a ZIP but no state, try to look it up in the database
    let confirmedState = stateAbbr;
    let finalStateSource = stateSource;
    
    if (zip5 && !confirmedState) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
        
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { data } = await supabase
            .from('zip_to_locality')
            .select('state_abbr')
            .eq('zip5', zip5)
            .limit(1)
            .maybeSingle();
          
          if (data?.state_abbr) {
            confirmedState = data.state_abbr;
            finalStateSource = 'zip_lookup';
            console.log('[pre-scan-location] State from ZIP lookup:', confirmedState);
          }
        }
      } catch (err) {
        console.warn('[pre-scan-location] DB lookup failed:', err);
      }
    }
    
    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (zip5 && confirmedState && stateSource === 'text_pattern') {
      confidence = 'high';
    } else if (zip5 && confirmedState) {
      confidence = 'medium';
    } else if (zip5 || confirmedState) {
      confidence = 'low';
    }
    
    const result: PreScanResult = {
      zip5,
      stateAbbr: confirmedState,
      confidence,
      evidence: evidence.slice(0, 3).join(' | '),
      stateSource: finalStateSource,
      ran: true,
      extractedText: extractedText.substring(0, 300),
      candidatesConsidered,
    };
    
    console.log('[pre-scan-location] Result:', JSON.stringify(result));
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err) {
    console.error('[pre-scan-location] Error:', err);
    return new Response(
      JSON.stringify({ 
        error: err instanceof Error ? err.message : 'Unknown error',
        ran: true,
        confidence: 'low'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
