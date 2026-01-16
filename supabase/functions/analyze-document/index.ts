import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// POND PROMPT: Direct extraction focused
const SYSTEM_PROMPT = `You are analyzing a medical bill image. Extract ALL line items with their dollar amounts.

CRITICAL: Look at the table and for EACH row, extract the dollar amount from the rightmost "AMOUNT" column.

Example row:
0300 | 10/10/22 | 036415 | VENIPUNCTURE | $89.03

Extract as:
{ "code": "036415", "description": "VENIPUNCTURE", "amount": 89.03 }

RULES:
1. Extract EVERY row from the table
2. The amount is in the rightmost column with $ signs
3. Convert amounts to numbers (remove $ and commas)
4. NEVER leave amount as null if you can see a dollar value

Return this JSON structure:

${JSON.stringify(
  {
    charges: [
      {
        code: "string",
        codeType: "revenue OR cpt OR hcpcs",
        description: "string",
        amount: "number - REQUIRED",
        amountEvidence: "string - exact text you saw",
        date: "string - if shown",
      },
    ],
    extractedTotals: {
      totalCharges: { value: "number", evidence: "string" },
      lineItemsSum: "number",
    },
    atAGlance: {
      visitSummary: "string",
      totalBilled: "number",
      amountYouMayOwe: "number or null",
      status: "looks_standard OR worth_reviewing OR likely_issues",
      statusExplanation: "string",
      documentClassification: "string",
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

    // Try Claude Sonnet 4 for better document understanding
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

    console.log("==========================================================");
    console.log("[DEBUG] PARSED RESULT SUMMARY:");
    console.log("[DEBUG] Total charges from extractedTotals:", parsedResult.extractedTotals?.totalCharges?.value);
    console.log("[DEBUG] Line items sum:", parsedResult.extractedTotals?.lineItemsSum);
    console.log("[DEBUG] Charges array length:", parsedResult.charges?.length || 0);
    console.log("==========================================================");

    // Enhanced logging for charges
    const chargesArray = parsedResult.charges as
      | Array<{
          code?: string;
          amount?: number | null;
          amountEvidence?: string;
          description?: string;
        }>
      | undefined;

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
        console.log(
          `  [${idx + 1}] Code: ${charge.code} | Amount: $${charge.amount} | Evidence: "${charge.amountEvidence}"`,
        );
      });

      console.log("\n[DEBUG] First 5 charges WITHOUT amounts:");
      chargesWithoutAmounts.slice(0, 5).forEach((charge, idx) => {
        console.log(
          `  [${idx + 1}] Code: ${charge.code} | Description: ${charge.description} | Amount: ${charge.amount} | Evidence: "${charge.amountEvidence}"`,
        );
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
