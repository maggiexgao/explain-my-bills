import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// POND PROMPT: Patient-advocacy focused bill analysis
const SYSTEM_PROMPT = `You are Pond, a patient-advocacy assistant that extracts billing data from medical bills.

#######################################################################
#                                                                     #
#  CRITICAL: EXTRACTING LINE ITEM AMOUNTS IS YOUR #1 JOB             #
#                                                                     #
#######################################################################

## THE MOST IMPORTANT THING YOU MUST DO:

For EVERY row in the billing table, you MUST extract the DOLLAR AMOUNT that was BILLED/CHARGED.

### WHAT IS THE BILLED AMOUNT?

The BILLED amount is what the PROVIDER ORIGINALLY CHARGED before any insurance payments or adjustments.

Look at this example from a REAL hospital bill:

| REV CODE | DATE | HCPCS | DESCRIPTION | AMOUNT |
|----------|------|-------|-------------|---------|
| 0110 | 1/1/2022 | - | ROOM AND CARE | $1,546.83 |
| 0300 | 1/1/2022 | 036419 | ARTERIAL PUNCTURE | $89.29 |
| 0301 | 1/2/2022 | 080053 | COMP METABOLIC PANEL | $434.60 |

For this table, you MUST extract:
- Row 1: amount = 1546.83
- Row 2: amount = 89.29  
- Row 3: amount = 434.60

The amount is ALWAYS in the rightmost column labeled "AMOUNT" or "CHARGES" or similar.

## STEP-BY-STEP EXTRACTION:

1. **Find the table** - Look for rows with revenue codes (0110, 0300, etc.) or CPT codes (99285, etc.)

2. **Identify the AMOUNT column** - It's usually the RIGHTMOST column with $ signs

3. **For EACH row, extract:**
   - code: The revenue/CPT code
   - description: Service description
   - **amount: THE DOLLAR VALUE AS A NUMBER** (remove $, remove commas)
   - amountEvidence: Quote what you saw

4. **Validate:** Count rows in table. Count items in your charges array. Must match!

## REAL EXAMPLE FROM YOUR DOCUMENT:

If you see:
```
0110 - ROOM AND CARE          Room Care     $1,546.83
                              Subtotal:     $ 1,546.83

0300 - LABORATORY             
1/1/2022  036419  1  ARTERIAL PUNCTURE      $    89.29
1/1/2022  036415  1  VENIPUNCTURE           $    69.03
                              Subtotal:     $   618.34
```

You MUST extract:
```json
{
  "charges": [
    {
      "code": "0110",
      "description": "ROOM AND CARE",
      "amount": 1546.83,
      "amountEvidence": "$1,546.83 from AMOUNT column"
    },
    {
      "code": "036419", 
      "description": "ARTERIAL PUNCTURE",
      "amount": 89.29,
      "amountEvidence": "$89.29"
    },
    {
      "code": "036415",
      "description": "VENIPUNCTURE", 
      "amount": 69.03,
      "amountEvidence": "$69.03"
    }
  ]
}
```

## CRITICAL RULES:

❌ NEVER set amount to null if you can see a $ amount
❌ NEVER skip rows - extract ALL rows  
❌ NEVER return amount as a string like "$1,546.83" - must be number 1546.83
✅ ALWAYS extract the number from the RIGHTMOST column with $ signs
✅ ALWAYS validate: does your charges array have the same number of items as rows in the table?

## OUTPUT FORMAT:

{
  "charges": [
    {
      "code": "string",
      "codeType": "revenue" | "cpt" | "hcpcs",
      "description": "string",
      "amount": number (REQUIRED - never null if visible),
      "amountEvidence": "exact text you saw",
      "units": number,
      "date": "string"
    }
  ],
  "extractedTotals": {
    "totalCharges": {
      "value": number,
      "evidence": "exact text"
    },
    "lineItemsSum": number (sum of all charge amounts)
  },
  "atAGlance": {
    "visitSummary": "string",
    "totalBilled": number,
    "amountYouMayOwe": number or null,
    "status": "looks_standard" | "worth_reviewing" | "likely_issues",
    "statusExplanation": "string",
    "documentClassification": "itemized_statement" | "summary_statement" | "eob" | "hospital_summary_bill" | "portal_summary" | "payment_receipt" | "revenue_code_only" | "unknown"
  },
  "thingsWorthReviewing": [],
  "savingsOpportunities": [],
  "conversationScripts": {
    "firstCallScript": "string",
    "ifTheyPushBack": "string", 
    "whoToAskFor": "string"
  },
  "priceContext": {
    "hasBenchmarks": false,
    "comparisons": [],
    "fallbackMessage": "string"
  },
  "pondNextSteps": [],
  "closingReassurance": "string"
}`;

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

    // Call Lovable AI gateway with a stronger model for better extraction
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

    console.log("==========================================================");
    console.log("[DEBUG] PARSED RESULT SUMMARY:");
    console.log("[DEBUG] Total charges from extractedTotals:", parsedResult.extractedTotals?.totalCharges?.value);
    console.log("[DEBUG] Line items sum:", parsedResult.extractedTotals?.lineItemsSum);
    console.log("[DEBUG] Charges array length:", parsedResult.charges?.length || 0);
    console.log("==========================================================");

    // Enhanced logging for charges
    const chargesArray = parsedResult.charges as Array<{ 
      code?: string; 
      amount?: number | null; 
      amountEvidence?: string;
      description?: string;
    }> | undefined;

    if (chargesArray && chargesArray.length > 0) {
      console.log("==========================================================");
      console.log("[DEBUG] DETAILED CHARGES BREAKDOWN:");
      console.log("[DEBUG] Total charges in array:", chargesArray.length);
      
      const chargesWithAmounts = chargesArray.filter((charge) => charge.amount != null && charge.amount > 0);
      const chargesWithoutAmounts = chargesArray.filter((charge) => charge.amount == null || charge.amount === 0);
      
      console.log("[DEBUG] Charges WITH amounts:", chargesWithAmounts.length);
      console.log("[DEBUG] Charges WITHOUT amounts:", chargesWithoutAmounts.length);
      
      console.log("\n[DEBUG] First 5 charges WITH amounts:");
      chargesWithAmounts.slice(0, 5).forEach((charge, idx) => {
        console.log(`  [${idx + 1}] Code: ${charge.code} | Amount: $${charge.amount} | Evidence: "${charge.amountEvidence}"`);
      });
      
      console.log("\n[DEBUG] First 5 charges WITHOUT amounts:");
      chargesWithoutAmounts.slice(0, 5).forEach((charge, idx) => {
        console.log(`  [${idx + 1}] Code: ${charge.code} | Description: ${charge.description} | Amount: ${charge.amount} | Evidence: "${charge.amountEvidence}"`);
      });
      
      const totalSum = chargesWithAmounts.reduce((sum, charge) => sum + (charge.amount || 0), 0);
      console.log("\n[DEBUG] Sum of extracted amounts: $" + totalSum.toFixed(2));
      console.log("==========================================================");
    } else {
      console.log("==========================================================");
      console.log("[DEBUG] ⚠️ NO CHARGES EXTRACTED AT ALL!");
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