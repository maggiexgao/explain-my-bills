import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * COMPREHENSIVE MEDICAL BILL EXTRACTION PROMPT
 *
 * This prompt handles 7 different bill formats:
 * 1. Clean CPT-First (CPT in first column)
 * 2. Hospital Rev Code + HCPS (Rev code first, HCPS separate)
 * 3. Hospital Code + CPT/HCPCS separate column
 * 4. Rev Code + Svc Code format
 * 5. Goodbill style (explicit Rev Code + CPT columns)
 * 6. Simple Invoice (no codes, just descriptions)
 * 7. Summary Bill (totals only, no line items)
 */
const SYSTEM_PROMPT = `You are a medical bill data extraction expert. Your job is to extract billing codes and amounts from medical bills.

## STEP 1: IDENTIFY THE BILL FORMAT

First, look at the column headers to determine the bill format:

**FORMAT A - CPT Code First**: Column headers like "CPT CODE | CLAIM # | DESCRIPTION | AMOUNT"
→ The first column IS the CPT code (5 digits like 99284)

**FORMAT B - Revenue Code + Separate CPT Column**: Headers like "Code | Description | CPT/HCPCS | Amount" or "Rev Code | Date | HCPS | Description | Amount"
→ First code column has 4-digit REVENUE codes (0450, 0301)
→ There's a SEPARATE column for CPT/HCPCS codes (99284, 80053, J2405)
→ USE THE CPT/HCPCS COLUMN, NOT THE REVENUE CODE COLUMN!

**FORMAT C - Svc Code Format**: Headers like "Date | Rev. # | Svc Code | Service | Charges"
→ "Svc Code" column contains the CPT/HCPCS codes
→ "Rev. #" is an internal reference number (8+ digits), NOT a billable code

**FORMAT D - No Codes**: Headers like "Products | Quantity | Price | Amount"
→ No CPT codes present, only service descriptions
→ Extract descriptions and amounts, mark as "no_code"

**FORMAT E - Summary Only**: Shows only totals like "Total Charges: $5,181"
→ No itemized line items
→ Extract totals only

## STEP 2: CODE TYPE IDENTIFICATION

When you see a code, identify its type:

- **CPT Code**: Exactly 5 digits (99284, 80053, 85025, 36415)
- **HCPCS Code**: Letter + 4 digits (J2405, G0378, A4253, S0028)
- **Revenue Code**: 4 digits starting with 0 (0110, 0450, 0301, 0636)
- **Internal Reference**: 8+ digits (62700101) - NOT a billable code, ignore

## STEP 3: EXTRACTION RULES

For each line item, extract:
1. **code**: The CPT or HCPCS code (5 digits or letter+4)
   - If the bill has BOTH revenue code AND CPT columns, USE THE CPT COLUMN
   - Only use revenue code if NO CPT code exists for that row
2. **codeType**: "cpt", "hcpcs", or "revenue"
3. **revenueCode**: The 4-digit revenue code if present (store separately)
4. **description**: Service description
5. **amount**: Dollar amount as a NUMBER (remove $ and commas)
6. **units**: Quantity if shown

## CRITICAL EXAMPLE

If you see this table:
| Svc Dt | Code | Description | CPT/HCPCS | Qty | Amount |
|--------|------|-------------|-----------|-----|--------|
| 10/10  | 0450 | ED VISIT    | 99284     | 1   | $2,579 |
| 10/10  | 0301 | METABOLIC   | 80053     | 1   | $400   |
| 10/10  | 0260 | IV INFUSION |           | 1   | $157   |

Extract as:
[
  { "code": "99284", "codeType": "cpt", "revenueCode": "0450", "description": "ED VISIT", "amount": 2579 },
  { "code": "80053", "codeType": "cpt", "revenueCode": "0301", "description": "METABOLIC", "amount": 400 },
  { "code": "0260", "codeType": "revenue", "revenueCode": "0260", "description": "IV INFUSION", "amount": 157 }
]

Note: Row 3 has no CPT code, so we use the revenue code.

## OUTPUT FORMAT

Return this exact JSON structure:
{
  "billFormat": "cpt_first | rev_plus_cpt | svc_code | no_codes | summary_only",
  "charges": [
    {
      "code": "string - CPT/HCPCS preferred, revenue code as fallback",
      "codeType": "cpt | hcpcs | revenue | none",
      "revenueCode": "string or null - the 4-digit revenue code if present",
      "description": "string",
      "amount": number,
      "units": number,
      "date": "string or null"
    }
  ],
  "extractedTotals": {
    "totalCharges": { "value": number, "evidence": "string" },
    "totalAdjustments": { "value": number or null, "evidence": "string" },
    "patientBalance": { "value": number or null, "evidence": "string" },
    "lineItemsSum": number
  },
  "atAGlance": {
    "visitSummary": "string - brief description",
    "totalBilled": number,
    "amountYouMayOwe": number or null,
    "status": "looks_standard | worth_reviewing | likely_issues",
    "statusExplanation": "string"
  },
  "provider": {
    "name": "string or null",
    "address": "string or null", 
    "phone": "string or null"
  },
  "patient": {
    "name": "string or null",
    "accountNumber": "string or null"
  },
  "serviceDate": "string or null",
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
}

## IMPORTANT REMINDERS

1. ALWAYS check if there's a separate CPT/HCPCS column before using the first code column
2. Revenue codes (0450, 0301, etc.) are NOT useful for Medicare pricing - prefer CPT codes
3. Extract ALL line items, not just the first few
4. Amount must be a NUMBER, not a string
5. If you can't find codes, set billFormat to "no_codes" and extract what you can`;

serve(async (req) => {
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

    const base64Data = documentContent.split(",")[1] || documentContent;
    let mimeType = "image/jpeg";
    if (documentType?.includes("pdf")) {
      mimeType = "application/pdf";
    } else if (documentType?.includes("png")) {
      mimeType = "image/png";
    }

    console.log("[analyze-document] Starting analysis");
    console.log("[analyze-document] MIME type:", mimeType);
    console.log("[analyze-document] Base64 length:", base64Data.length);

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
      console.error("[analyze-document] API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "API request failed", details: errorText }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("[analyze-document] No content in API response");
      return new Response(JSON.stringify({ error: "No content returned from API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[analyze-document] Received AI response");

    // Parse the JSON response
    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (parseError) {
      console.error("[analyze-document] JSON parse error:", parseError);
      console.error("[analyze-document] Raw content:", content.substring(0, 500));
      return new Response(JSON.stringify({ error: "Failed to parse AI response as JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the bill format detected
    console.log("[analyze-document] Bill format detected:", parsedResult.billFormat);

    // Post-process charges to ensure data quality
    if (parsedResult.charges && Array.isArray(parsedResult.charges)) {
      console.log("[analyze-document] Processing", parsedResult.charges.length, "charges");

      let cptCount = 0;
      let hcpcsCount = 0;
      let revenueCount = 0;
      let noCodeCount = 0;

      parsedResult.charges = parsedResult.charges.map((charge, idx) => {
        // Ensure code is a string
        let code = String(charge.code || "").trim();
        let codeType = charge.codeType || "unknown";
        let revenueCode = charge.revenueCode ? String(charge.revenueCode).trim() : null;

        // Validate and fix code type
        if (/^\d{5}$/.test(code)) {
          codeType = "cpt";
          cptCount++;
        } else if (/^[A-Z]\d{4}$/i.test(code)) {
          codeType = "hcpcs";
          hcpcsCount++;
        } else if (/^0\d{3}$/.test(code)) {
          codeType = "revenue";
          revenueCode = code;
          revenueCount++;
        } else if (!code || code === "null" || code === "undefined") {
          codeType = "none";
          code = "";
          noCodeCount++;
        }

        // Normalize amount to number
        let amount = null;
        const rawAmount = charge.amount ?? charge.billedAmount ?? charge.billed ?? charge.total;

        if (typeof rawAmount === "number" && !isNaN(rawAmount)) {
          amount = rawAmount;
        } else if (typeof rawAmount === "string") {
          const cleaned = rawAmount.replace(/[$,\s]/g, "");
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) {
            amount = parsed;
          }
        }

        // Log each charge for debugging
        console.log(`[analyze-document] Charge ${idx}: code=${code}, type=${codeType}, amount=${amount}`);

        return {
          ...charge,
          code,
          codeType,
          revenueCode,
          amount,
          units: charge.units || 1,
        };
      });

      // Log summary
      console.log("[analyze-document] === EXTRACTION SUMMARY ===");
      console.log(`[analyze-document] CPT codes: ${cptCount}`);
      console.log(`[analyze-document] HCPCS codes: ${hcpcsCount}`);
      console.log(`[analyze-document] Revenue codes only: ${revenueCount}`);
      console.log(`[analyze-document] No code: ${noCodeCount}`);

      // Calculate line items sum
      const lineItemsSum = parsedResult.charges.reduce((sum, c) => sum + (c.amount || 0), 0);
      console.log(`[analyze-document] Line items sum: $${lineItemsSum.toFixed(2)}`);

      // Update extractedTotals with calculated sum
      if (!parsedResult.extractedTotals) {
        parsedResult.extractedTotals = {};
      }
      parsedResult.extractedTotals.lineItemsSum = lineItemsSum;

      // Warn if all codes are revenue codes (potential extraction issue)
      if (revenueCount > 0 && cptCount === 0 && hcpcsCount === 0) {
        console.log(
          "[analyze-document] ⚠️ WARNING: Only revenue codes extracted. Bill may have CPT codes that were missed.",
        );
      }
    }

    // Ensure required fields exist with defaults
    if (!parsedResult.atAGlance) {
      parsedResult.atAGlance = {
        visitSummary: "Medical services",
        totalBilled: parsedResult.extractedTotals?.lineItemsSum || 0,
        status: "worth_reviewing",
        statusExplanation: "Please review this bill carefully.",
      };
    }

    if (!parsedResult.conversationScripts) {
      parsedResult.conversationScripts = {
        firstCallScript: "Hi, I'm calling about my bill and would like to understand the charges.",
        ifTheyPushBack: "I'd like to speak with a billing supervisor or patient advocate.",
        whoToAskFor: "Billing department or patient financial services",
      };
    }

    if (!parsedResult.priceContext) {
      parsedResult.priceContext = {
        hasBenchmarks: false,
        comparisons: [],
        fallbackMessage: "Price comparison data will be calculated after extraction.",
      };
    }

    if (!parsedResult.closingReassurance) {
      parsedResult.closingReassurance =
        "Medical bills are often negotiable. You have the right to question charges and request itemized statements.";
    }

    console.log("[analyze-document] Analysis complete");

    return new Response(JSON.stringify({ analysis: parsedResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    const errorStack = error instanceof Error ? error.stack : "";
    console.error("[analyze-document] Unhandled error:", errorMessage);
    console.error("[analyze-document] Stack:", errorStack);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
