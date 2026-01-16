import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are analyzing a medical bill. Extract ALL line items with their dollar amounts.

IMPORTANT: Hospital bills have TWO code columns:
1. Revenue Code column (4 digits like 0450, 0301) - labeled "Code" or "Rev Code"
2. CPT/HCPCS column (5 digits like 99284, 80053) - labeled "CPT", "CPT/HCPCS", "HCPCS"

USE THE CPT/HCPCS CODE (5 digits), NOT the revenue code (4 digits)!

Example:
| Code | Description | CPT/HCPCS | Amount |
| 0450 | ED VISIT | 99284 | $2,579 |

Extract as: { "code": "99284", "amount": 2579 }
NOT as: { "code": "0450" } 

Return JSON:
{
  "charges": [
    {
      "code": "USE THE 5-DIGIT CPT CODE",
      "codeType": "cpt",
      "description": "string",
      "amount": 0,
      "revenueCode": "the 4-digit revenue code if present"
    }
  ],
  "extractedTotals": {
    "totalCharges": { "value": 0, "evidence": "" },
    "lineItemsSum": 0
  },
  "atAGlance": {
    "visitSummary": "",
    "totalBilled": 0,
    "amountYouMayOwe": null,
    "status": "worth_reviewing",
    "statusExplanation": "",
    "documentClassification": ""
  },
  "thingsWorthReviewing": [],
  "savingsOpportunities": [],
  "conversationScripts": {
    "firstCallScript": "",
    "ifTheyPushBack": "",
    "whoToAskFor": ""
  },
  "priceContext": {
    "hasBenchmarks": false,
    "comparisons": [],
    "fallbackMessage": ""
  },
  "pondNextSteps": [],
  "closingReassurance": ""
}`;

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

    console.log("[analyze-document] Starting analysis, mimeType:", mimeType);

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
      console.error("[analyze-document] No content in response");
      return new Response(JSON.stringify({ error: "No content returned from API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[analyze-document] Raw AI response received");

    // Parse the JSON response
    let parsedResult;
    try {
      parsedResult = JSON.parse(content);
    } catch (parseError) {
      console.error("[analyze-document] JSON parse error:", parseError);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize charges - ensure amount field exists
    if (parsedResult.charges && Array.isArray(parsedResult.charges)) {
      parsedResult.charges = parsedResult.charges.map((charge: any) => {
        // Get amount from various possible field names
        let amount = null;
        if (typeof charge.amount === "number" && charge.amount > 0) {
          amount = charge.amount;
        } else if (typeof charge.billedAmount === "number" && charge.billedAmount > 0) {
          amount = charge.billedAmount;
        } else if (typeof charge.billed === "number" && charge.billed > 0) {
          amount = charge.billed;
        } else if (typeof charge.amount === "string") {
          amount = parseFloat(charge.amount.replace(/[$,]/g, "")) || null;
        } else if (typeof charge.billedAmount === "string") {
          amount = parseFloat(charge.billedAmount.replace(/[$,]/g, "")) || null;
        }

        return {
          ...charge,
          amount: amount,
        };
      });

      console.log("[analyze-document] Processed", parsedResult.charges.length, "charges");
    }

    return new Response(JSON.stringify({ analysis: parsedResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    console.error("[analyze-document] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
