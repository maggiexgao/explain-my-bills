import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a medical bill data extraction expert. Extract billing codes and amounts from medical bills.

## STEP 1: IDENTIFY THE BILL FORMAT

Look at column headers to determine the format:

**FORMAT A - CPT Code First**: "CPT CODE | CLAIM # | DESCRIPTION | AMOUNT"
→ First column IS the CPT code (5 digits like 99284)

**FORMAT B - Revenue Code + Separate CPT Column**: "Code | Description | CPT/HCPCS | Amount"
→ First code column has 4-digit REVENUE codes (0450, 0301)
→ There's a SEPARATE column for CPT/HCPCS codes (99284, 80053, J2405)
→ USE THE CPT/HCPCS COLUMN, NOT THE REVENUE CODE!

**FORMAT C - Svc Code Format**: "Date | Rev. # | Svc Code | Service | Charges"
→ "Svc Code" column contains the CPT/HCPCS codes

**FORMAT D - No Codes**: "Products | Quantity | Price | Amount"
→ No CPT codes present, only service descriptions

## STEP 2: CODE TYPES

- CPT Code: 5 digits (99284, 80053, 85025)
- HCPCS Code: Letter + 4 digits (J2405, G0378)
- Revenue Code: 4 digits starting with 0 (0110, 0450, 0301)

## STEP 3: EXTRACTION

For EACH line item:
1. code: The CPT or HCPCS code (prefer this over revenue code)
2. codeType: "cpt", "hcpcs", or "revenue"
3. revenueCode: The 4-digit revenue code if present
4. description: Service description
5. amount: Dollar amount as NUMBER

## CRITICAL EXAMPLE

Table:
| Code | Description | CPT/HCPCS | Amount |
| 0450 | ED VISIT    | 99284     | $2,579 |
| 0301 | METABOLIC   | 80053     | $400   |
| 0260 | IV INFUSION |           | $157   |

Extract:
[
  { "code": "99284", "codeType": "cpt", "revenueCode": "0450", "amount": 2579 },
  { "code": "80053", "codeType": "cpt", "revenueCode": "0301", "amount": 400 },
  { "code": "0260", "codeType": "revenue", "revenueCode": "0260", "amount": 157 }
]

Row 3 has no CPT, so use revenue code.

## OUTPUT FORMAT

{
  "billFormat": "cpt_first | rev_plus_cpt | svc_code | no_codes | summary_only",
  "charges": [
    {
      "code": "string",
      "codeType": "cpt | hcpcs | revenue | none",
      "revenueCode": "string or null",
      "description": "string",
      "amount": number,
      "units": number,
      "date": "string or null"
    }
  ],
  "extractedTotals": {
    "totalCharges": { "value": number, "evidence": "string" },
    "lineItemsSum": number
  },
  "atAGlance": {
    "visitSummary": "string",
    "totalBilled": number,
    "amountYouMayOwe": null,
    "status": "looks_standard | worth_reviewing | likely_issues",
    "statusExplanation": "string"
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

// Define types for the charge object
interface Charge {
  code?: string;
  codeType?: string;
  revenueCode?: string | null;
  description?: string;
  amount?: number | string | null;
  billedAmount?: number | string | null;
  billed?: number | string | null;
  total?: number | string | null;
  units?: number;
  date?: string | null;
}

interface AnalysisResult {
  billFormat?: string;
  charges?: Charge[];
  extractedTotals?: {
    totalCharges?: { value: number; evidence: string };
    lineItemsSum?: number;
  };
  atAGlance?: {
    visitSummary?: string;
    totalBilled?: number;
    status?: string;
    statusExplanation?: string;
  };
  conversationScripts?: {
    firstCallScript?: string;
    ifTheyPushBack?: string;
    whoToAskFor?: string;
  };
  priceContext?: {
    hasBenchmarks?: boolean;
    comparisons?: unknown[];
    fallbackMessage?: string;
  };
  closingReassurance?: string;
  thingsWorthReviewing?: unknown[];
  savingsOpportunities?: unknown[];
  pondNextSteps?: unknown[];
}

serve(async (req: Request): Promise<Response> => {
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

    console.log("[analyze-document] Starting analysis, MIME:", mimeType);

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

    let parsedResult: AnalysisResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (_parseError) {
      console.error("[analyze-document] JSON parse error");
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[analyze-document] Bill format:", parsedResult.billFormat);

    // Post-process charges
    if (parsedResult.charges && Array.isArray(parsedResult.charges)) {
      console.log("[analyze-document] Processing", parsedResult.charges.length, "charges");

      let cptCount = 0;
      let hcpcsCount = 0;
      let revenueCount = 0;

      parsedResult.charges = parsedResult.charges.map((charge: Charge, idx: number) => {
        let code = String(charge.code || "").trim();
        let codeType = charge.codeType || "unknown";
        let revenueCode = charge.revenueCode ? String(charge.revenueCode).trim() : null;

        // Validate code type
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
        }

        // Normalize amount
        let amount: number | null = null;
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

      console.log(`[analyze-document] Summary: CPT=${cptCount}, HCPCS=${hcpcsCount}, Revenue=${revenueCount}`);

      // Calculate line items sum
      const lineItemsSum = parsedResult.charges.reduce(
        (sum: number, c: Charge) => sum + (typeof c.amount === "number" ? c.amount : 0),
        0,
      );
      console.log(`[analyze-document] Line items sum: $${lineItemsSum.toFixed(2)}`);

      if (!parsedResult.extractedTotals) {
        parsedResult.extractedTotals = {};
      }
      parsedResult.extractedTotals.lineItemsSum = lineItemsSum;

      if (revenueCount > 0 && cptCount === 0 && hcpcsCount === 0) {
        console.log("[analyze-document] WARNING: Only revenue codes found");
      }
    }

    // Ensure defaults
    if (!parsedResult.atAGlance) {
      parsedResult.atAGlance = {
        visitSummary: "Medical services",
        totalBilled: parsedResult.extractedTotals?.lineItemsSum || 0,
        status: "worth_reviewing",
        statusExplanation: "Please review this bill.",
      };
    }

    if (!parsedResult.conversationScripts) {
      parsedResult.conversationScripts = {
        firstCallScript: "Hi, I'm calling about my bill.",
        ifTheyPushBack: "I'd like to speak with a supervisor.",
        whoToAskFor: "Billing department",
      };
    }

    if (!parsedResult.priceContext) {
      parsedResult.priceContext = {
        hasBenchmarks: false,
        comparisons: [],
        fallbackMessage: "Price comparison will be calculated.",
      };
    }

    if (!parsedResult.closingReassurance) {
      parsedResult.closingReassurance = "Medical bills are often negotiable.";
    }

    console.log("[analyze-document] Analysis complete");

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
