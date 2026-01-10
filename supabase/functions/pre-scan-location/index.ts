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

// Address-related keywords
const ADDRESS_KEYWORDS = [
  'address', 'zip', 'billing', 'statement', 'patient', 'provider',
  'hospital', 'clinic', 'medical', 'service', 'po box', 'street', 'ave', 'blvd'
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
}

// Derive state from ZIP prefix
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

// Extract location from text
function extractLocationFromText(text: string): { 
  zip5?: string; 
  stateAbbr?: string; 
  evidence: string[];
  stateSource?: 'text_pattern' | 'zip_prefix' | 'zip_lookup';
} {
  const evidence: string[] = [];
  let bestZip: string | undefined;
  let bestState: string | undefined;
  let stateSource: 'text_pattern' | 'zip_prefix' | undefined;
  
  // Look for City, ST ZIP pattern first (highest confidence)
  const cityStateZipPattern = /([A-Za-z\s]+),?\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?/g;
  let match;
  
  while ((match = cityStateZipPattern.exec(text)) !== null) {
    const stateAbbr = match[2].toUpperCase();
    if (US_STATE_ABBRS.includes(stateAbbr)) {
      bestZip = match[3];
      bestState = stateAbbr;
      stateSource = 'text_pattern';
      evidence.push(match[0].trim().substring(0, 80));
      break;
    }
  }
  
  // If no pattern match, look for standalone ZIPs
  if (!bestZip) {
    const zipPattern = /\b(\d{5})(?:-\d{4})?\b/g;
    const zipMatches: { zip: string; context: string; score: number }[] = [];
    
    while ((match = zipPattern.exec(text)) !== null) {
      const zip = match[1];
      const zipNum = parseInt(zip, 10);
      
      // Basic validation: US ZIPs range from 00501 to 99950
      if (zipNum < 501 || zipNum > 99950) continue;
      
      // Get context around the ZIP
      const start = Math.max(0, match.index - 100);
      const end = Math.min(text.length, match.index + 20);
      const context = text.slice(start, end).toLowerCase();
      
      // Score based on nearby keywords
      let score = 0;
      for (const kw of ADDRESS_KEYWORDS) {
        if (context.includes(kw)) {
          score += 3;
          break;
        }
      }
      
      // Reduce score if in phone/fax context
      if (context.includes('phone') || context.includes('fax') || context.includes('tel')) {
        score -= 2;
      }
      
      zipMatches.push({ zip, context: match[0], score });
    }
    
    // Sort by score and take best
    zipMatches.sort((a, b) => b.score - a.score);
    if (zipMatches.length > 0) {
      bestZip = zipMatches[0].zip;
      evidence.push(`ZIP: ${bestZip}`);
    }
  }
  
  // If no state yet but have ZIP, derive from prefix
  if (!bestState && bestZip) {
    bestState = deriveStateFromZipPrefix(bestZip) || undefined;
    if (bestState) {
      stateSource = 'zip_prefix';
    }
  }
  
  return { zip5: bestZip, stateAbbr: bestState, evidence, stateSource };
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
        JSON.stringify({ error: 'No document content provided', ran: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use Gemini to extract text from the document
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured', ran: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare the image content
    const base64Data = documentContent.split(',')[1] || documentContent;
    let mimeType = 'image/jpeg';
    if (documentType?.includes('pdf')) {
      mimeType = 'application/pdf';
    } else if (documentType?.includes('png')) {
      mimeType = 'image/png';
    } else if (documentType?.includes('webp')) {
      mimeType = 'image/webp';
    }
    
    // Call Gemini Flash for quick text extraction
    const geminiResponse = await fetch(
      `https://lovable.dev/api/llm/google/gemini-2.5-flash-lite`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              },
              {
                text: `Extract ONLY the address information from this document. Look for:
1. Any street addresses
2. City, State ZIP patterns
3. ZIP codes (5 digits or 9 digits with hyphen)
4. State abbreviations near addresses

Output the raw text of any addresses you find, one per line. Focus on patient address, billing address, or provider address.
Keep your response under 500 characters.`
              }
            ]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 500,
          }
        }),
      }
    );
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to extract text from document',
          ran: true,
          confidence: 'low'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const geminiData = await geminiResponse.json();
    const extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('[pre-scan-location] Extracted text:', extractedText.substring(0, 200));
    
    // Parse the extracted text for ZIP and state
    const { zip5, stateAbbr, evidence, stateSource } = extractLocationFromText(extractedText);
    
    // If we found a ZIP, try to look it up in the database for state confirmation
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
      extractedText: extractedText.substring(0, 200),
    };
    
    console.log('[pre-scan-location] Result:', result);
    
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
