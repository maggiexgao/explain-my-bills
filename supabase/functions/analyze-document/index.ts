import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// POND PROMPT: Updated to prioritize CPT codes over Revenue codes
const SYSTEM_PROMPT = `You are analyzing a medical bill. Extract ALL line items with their dollar amounts.

## CRITICAL: CPT CODES vs REVENUE CODES

Hospital bills often have TWO different code columns:

1. **Revenue Code column** (labeled "Code", "Rev Code", "Revenue")
   - These are 4-digit codes like: 0110, 0250, 0301, 0450, 0636
   - These are for hospital billing categories, NOT procedures

2. **CPT/HCPCS Code column** (labeled "CPT", "CPT/HCPCS", "HCPCS", "Procedure Code")  
   - These are 5-digit codes like: 99284, 80053, 85025, 36415, 71046
   - These are the actual procedure codes used for Medicare pricing

**⚠️ ALWAYS USE THE CPT/HCPCS CODE, NOT THE REVENUE CODE!**

### Example Hospital Bill Table:

| Svc Dt | Code | Description | CPT/HCPCS | Qty | Amount |
|--------|------|-------------|-----------|-----|--------|
| 10/10/21 | 0450 | ED VISIT LEVEL 4 | 99284 | 1 | $2,579.90 |
| 10/10/21 | 0301 | COMP METABOLIC PANEL | 80053 | 1 | $400.39 |
| 10/10/21 | 0305 | CBC AUTO WDIFF | 85025 | 1 | $221.95 |
| 10/10/21 | 0307 | URINALYSIS | 81003 | 1 | $84.65 |
| 10/10/21 | 0636 | HC ONDANSETRON | J2405 | 1 | $43.00 |

### CORRECT Extraction:
{ "code": "99284", "codeType": "cpt", "revenueCode": "0450", "description": "ED VISIT LEVEL 4", "amount": 2579.90 }
{ "code": "80053", "codeType": "cpt", "revenueCode": "0301", "description": "COMP METABOLIC PANEL", "amount": 400.39 }
{ "code": "85025", "codeType": "cpt", "revenueCode": "0305", "description": "CBC AUTO WDIFF", "amount": 221.95 }
{ "code": "81003", "codeType": "cpt", "revenueCode": "0307", "description": "URINALYSIS", "amount": 84.65 }
{ "code": "J2405", "codeType": "hcpcs", "revenueCode": "0636", "description": "HC ONDANSETRON", "amount": 43.00 }

### WRONG Extraction (DO NOT DO THIS):
{ "code": "0450", ... }  ← WRONG! 0450 is the revenue code, not the CPT
{ "code": "0301", ... }  ← WRONG! 0301 is the revenue code, not the CPT

## EXTRACTION RULES:

1. **Find the CPT/HCPCS column** - Look for columns labeled "CPT", "CPT/HCPCS", "HCPCS", "Procedure", "Proc Code"
2. **Use CPT/HCPCS code as the primary "code" field** - 5-digit codes like 99284, 80053, or J-codes like J2405
3. **Store the revenue code separately** in the "revenueCode" field
4. **Only use revenue code as primary** if NO CPT/HCPCS code exists for that row
5. **Amount** is in the rightmost dollar column - extract as a number (no $ or commas)
6. **Extract EVERY row** - don't skip any line items

## CODE TYPE IDENTIFICATION:
- CPT codes: 5 digits, all numbers (99284, 80053, 36415)
- HCPCS codes: Letter + 4 digits (J2405, G0378, A4253)
- Revenue codes: 4 digits starting with 0 (0450, 0301, 0110) - only use if no CPT available

Return this JSON structure:

${JSON.stringify(
  {
    charges: [
      {
        code: "string - THE CPT/HCPCS CODE (5 digits), not the revenue code",
        codeType: "cpt OR hcpcs OR revenue",
        revenueCode: "string - the 4-digit revenue code if present (optional)",
        description: "string - service description",
        amount: "number - REQUIRED - the dollar amount",
        amountEvidence: "string - exact text you saw for the amount",
        date: "string - service date if shown",
        units: "number - quantity if shown, default 1",
      },
    ],
    extractedTotals: {
      totalCharges: { value: "number", evidence: "string" },
      lineItemsSum: "number - sum of all line item amounts",
    },
    atAGlance: {
      visitSummary: "string - brief description of services",
      totalBilled: "number - total charges",
      amountYouMayOwe: "number or null - patient responsibility if shown",
      status: "looks_standard OR worth_reviewing OR likely_issues",
      statusExplanation: "string",
      documentClassification: "hospital_bill OR physician_bill OR lab_bill OR other",
    },
    thingsWorthReviewing: [],
    savingsOpportunities: [],
    conversationScripts: {
      firstCallScript: "string",
      ifTheyPushBack: "string",
      whoToAskFor: "string",
    },
    priceContext: {
      hasBenchmarks: false,
      comparisons: [],
      fallbackMessage: "string",
    },
    pondNextSteps: [],
    closingReassurance: "string",
  },
  null,
  2,
)}`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentContent, documentType } = await req.json();

    if (!documentContent) {
      return new Response(JSON.stringify({ error: "No document content provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("[analyze-document] LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare the image content for the API
    const base64Data = documentContent.split(",")[1] || documentContent;
    let mimeType = "image/jpeg";
    if (documentType?.includes("pdf")) {
      mimeType = "application/pdf";
    } else if (documentType?.includes("png")) {
      mimeType = "image/png";
    }

    console.log("==========================================================");
    console.log("[DEBUG] Starting document analysis");
    console.log("[DEBUG] Document type:", documentType);
    console.log("[DEBUG] MIME type:", mimeType);
    console.log("[DEBUG] Base64 data length:", base64Data.length);
    console.log("==========================================================");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`,
                },
              },
              {
                type: "text",
                text: SYSTEM_PROMPT,
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 16000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[analyze-document] API error:", errorText);
      return new Response(JSON.stringify({ error: "API request failed", details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[analyze-document] No content in response:", data);
      return new Response(JSON.stringify({ error: "No content returned from API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("==========================================================");
    console.log("[DEBUG] RAW AI RESPONSE:");
    console.log(content);
    console.log("==========================================================");

    // Parse the JSON response
    const parsedResult = JSON.parse(content);

    // ✅ NORMALIZE: Ensure all charges have proper amount field
    if (parsedResult.charges && Array.isArray(parsedResult.charges)) {
      console.log("==========================================================");
      console.log("[DEBUG] === NORMALIZING CHARGES ===");

      parsedResult.charges = parsedResult.charges.map((charge: any, idx: number) => {
        // Log what AI returned BEFORE normalization
        console.log(
          `[DEBUG] Charge ${idx} RAW: code=${charge.code}, codeType=${charge.codeType}, revenueCode=${charge.revenueCode}, amount=${charge.amount}, billedAmount=${charge.billedAmount}`,
        );

        // Extract amount from any field name
        let amount: number | null = null;
        const candidates = [
          charge.amount,
          charge.billedAmount,
          charge.billed,
          charge.totalAmount,
          charge.charge,
          charge.total,
        ];

        for (const candidate of candidates) {
          if (typeof candidate === "number" && !isNaN(candidate) && candidate > 0) {
            amount = candidate;
            break;
          }
          if (typeof candidate === "string" && candidate.trim()) {
            const parsed = parseFloat(candidate.replace(/[$,]/g, "").trim());
            if (!isNaN(parsed) && parsed > 0) {
              amount = parsed;
              break;
            }
          }
        }

        // Determine code type if not provided
        let codeType = charge.codeType || "unknown";
        const code = (charge.code || "").toString().trim();

        if (codeType === "unknown" && code) {
          if (/^[A-Z]\d{4}$/i.test(code)) {
            codeType = "hcpcs"; // J2405, G0378, etc.
          } else if (/^\d{5}$/.test(code)) {
            codeType = "cpt"; // 99284, 80053, etc.
          } else if (/^0\d{3}$/.test(code)) {
            codeType = "revenue"; // 0450, 0301, etc.
          }
        }

        console.log(`[DEBUG] Charge ${idx} NORMALIZED: code=${code}, codeType=${codeType}, amount=${amount}`);

        return {
          ...charge,
          code: code,
          codeType: codeType,
          amount: amount,
        };
      });

      console.log("==========================================================");

      // Log summary statistics
      const chargesWithAmounts = parsedResult.charges.filter((c: any) => c.amount != null && c.amount > 0);
      const cptCodes = parsedResult.charges.filter((c: any) => c.codeType === "cpt");
      const hcpcsCodes = parsedResult.charges.filter((c: any) => c.codeType === "hcpcs");
      const revenueCodes = parsedResult.charges.filter((c: any) => c.codeType === "revenue");

      console.log("[DEBUG] === EXTRACTION SUMMARY ===");
      console.log(`[DEBUG] Total charges: ${parsedResult.charges.length}`);
      console.log(`[DEBUG] Charges WITH amounts: ${chargesWithAmounts.length}`);
      console.log(`[DEBUG] CPT codes: ${cptCodes.length}`);
      console.log(`[DEBUG] HCPCS codes: ${hcpcsCodes.length}`);
      console.log(`[DEBUG] Revenue codes (fallback): ${revenueCodes.length}`);

      if (chargesWithAmounts.length > 0) {
        console.log("[DEBUG] Extracted line items:");
        chargesWithAmounts.slice(0, 10).forEach((c: any, i: number) => {
          console.log(`  [${i}] ${c.codeType}: ${c.code} | $${c.amount} | ${c.description?.substring(0, 30)}`);
        });
      }

      const totalSum = chargesWithAmounts.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
      console.log(`[DEBUG] Sum of extracted amounts: $${totalSum.toFixed(2)}`);
      console.log("==========================================================");
    }

    return new Response(JSON.stringify({ analysis: parsedResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[analyze-document] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
