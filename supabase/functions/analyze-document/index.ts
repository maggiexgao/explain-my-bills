import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a medical bill analysis expert. Extract data and provide helpful analysis.

## ISSUER/PROVIDER EXTRACTION (CRITICAL)

You MUST extract the hospital or provider name from the bill. Look for:
- Hospital/clinic name in the header or letterhead
- "Statement from:" or "Bill from:" labels
- Provider name at the top of the document
- Examples: "Atrium Health", "Mercy Hospital", "Kaiser Permanente"
Set this in the "issuer" field. NEVER leave issuer empty.

## DATE OF SERVICE EXTRACTION

Extract the date of service from the bill. Look for:
- "Date of Service:", "Service Date:", "Visit Date:"
- Date ranges if multiple services
Set this in the "dateOfService" field.

## BILL FORMAT DETECTION

Look at column headers:
- If "Code" column has 4-digit codes (0450) AND separate "CPT/HCPCS" column has 5-digit codes (99284), USE the CPT/HCPCS column
- If only one code column with 5-digit codes, use that
- Revenue codes (0110, 0450) are facility billing codes - prefer CPT codes when available

## EXTRACTION TASK

Extract ALL line items. For each charge, prefer the CPT/HCPCS code (5 digits like 99284, or letter+4 like J2405) over the revenue code (4 digits like 0450).

## REQUIRED OUTPUT FORMAT

Return this EXACT JSON structure:

{
  "billFormat": "rev_plus_cpt",
  "issuer": "Atrium Health",
  "dateOfService": "01/15/2024",
  "charges": [
    {
      "code": "99284",
      "codeType": "cpt",
      "revenueCode": "0450",
      "description": "Emergency Room Visit Level 4",
      "amount": 2579.90,
      "units": 1
    }
  ],
  "extractedTotals": {
    "totalCharges": { "value": 3954.75, "evidence": "Total Charges: $3,954.75" },
    "lineItemsSum": 3954.75
  },
  "atAGlance": {
    "visitSummary": "Emergency room visit with lab tests and IV therapy",
    "totalBilled": 3954.75,
    "amountYouMayOwe": 2126.67,
    "status": "worth_reviewing",
    "statusExplanation": "Hospital emergency room bills often have room for negotiation."
  },
  "thingsWorthReviewing": [
    {
      "whatToReview": "Emergency Room charge of $2,579.90",
      "whyItMatters": "ER visits at Level 4 are typically $1,500-2,000 elsewhere. Worth questioning.",
      "issueType": "negotiable"
    },
    {
      "whatToReview": "Lab tests totaling $700+",
      "whyItMatters": "Hospital lab fees are often 3-5x higher than independent labs.",
      "issueType": "negotiable"
    }
  ],
  "savingsOpportunities": [
    {
      "whatMightBeReduced": "Request self-pay discount (20-50% off)",
      "whyNegotiable": "Most hospitals offer discounts if you ask. Call billing and mention you're paying out of pocket.",
      "savingsContext": "Could save $800-2000"
    },
    {
      "whatMightBeReduced": "Ask about financial assistance",
      "whyNegotiable": "Nonprofit hospitals are required to offer charity care programs.",
      "additionalInfoNeeded": "Your household income"
    },
    {
      "whatMightBeReduced": "Negotiate a payment plan",
      "whyNegotiable": "Hospitals often accept reduced lump-sum payments or 0% interest payment plans.",
      "savingsContext": "Avoid collections"
    }
  ],
  "conversationScripts": {
    "firstCallScript": "Hi, I'm calling about a bill for [patient name], account [number]. I have questions about some charges, particularly the emergency room fee. Can you help me understand the breakdown?",
    "ifTheyPushBack": "I understand these are your standard rates. Are there any self-pay discounts, financial assistance programs, or payment plans available?",
    "whoToAskFor": "Patient Financial Services or a Billing Supervisor"
  },
  "pondNextSteps": [
    { "step": "Request an itemized bill if not received", "details": "Get a detailed breakdown of all charges to verify accuracy", "isUrgent": false },
    { "step": "Call billing to ask about discounts", "details": "Many hospitals offer 20-50% off for prompt payment or self-pay", "isUrgent": false },
    { "step": "Review each charge against your records", "details": "Make sure you received all billed services", "isUrgent": false }
  ],
  "priceContext": {
    "hasBenchmarks": false,
    "comparisons": [],
    "fallbackMessage": "Medicare comparison will be calculated based on your location."
  },
  "closingReassurance": "Hospital bills are often negotiable. Many patients reduce their bills by 20-50% simply by asking. You have the right to question any charge."
}

## FIELD REQUIREMENTS - VERY IMPORTANT

1. **thingsWorthReviewing** - Array of objects with EXACTLY these field names:
   - "whatToReview": string (the specific charge or issue to look at)
   - "whyItMatters": string (why the patient should care about this)
   - "issueType": one of "error", "negotiable", "missing_info", "confirmation"

2. **savingsOpportunities** - Array of objects with EXACTLY these field names:
   - "whatMightBeReduced": string (what could be lowered)
   - "whyNegotiable": string (explanation of why it's negotiable)
   - "savingsContext": string (optional - potential dollar savings)
   - "additionalInfoNeeded": string (optional - what info patient needs)

3. **pondNextSteps** - Array of objects with EXACTLY these field names:
   - "step": string (the action to take)
   - "isUrgent": boolean

4. **charges** - Array with:
   - "code": string (prefer 5-digit CPT over 4-digit revenue code)
   - "amount": NUMBER (not a string, e.g., 2579.90 not "$2,579.90")

5. All dollar amounts must be NUMBERS without $ signs or commas.

Generate 2-4 items for thingsWorthReviewing and 2-4 items for savingsOpportunities based on the bill contents.`;

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

interface ReviewItem {
  whatToReview?: string;
  whyItMatters?: string;
  issueType?: string;
  // Alternative field names the AI might use
  title?: string;
  description?: string;
  issue?: string;
  reason?: string;
  type?: string;
}

interface SavingsItem {
  whatMightBeReduced?: string;
  whyNegotiable?: string;
  savingsContext?: string;
  additionalInfoNeeded?: string;
  // Alternative field names
  title?: string;
  description?: string;
  opportunity?: string;
  reason?: string;
}

interface NextStep {
  step?: string;
  details?: string;
  isUrgent?: boolean;
  // Alternative field names
  action?: string;
  title?: string;
  description?: string;
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
    amountYouMayOwe?: number | null;
    status?: string;
    statusExplanation?: string;
  };
  thingsWorthReviewing?: ReviewItem[];
  savingsOpportunities?: SavingsItem[];
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
  pondNextSteps?: NextStep[];
  closingReassurance?: string;
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
        model: "google/gemini-2.5-pro",
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

    console.log("[analyze-document] Received AI response, length:", content.length);

    // Parse JSON - handle markdown code blocks
    let jsonContent = content;
    if (jsonContent.includes("```json")) {
      jsonContent = jsonContent.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (jsonContent.includes("```")) {
      jsonContent = jsonContent.replace(/```\n?/g, "");
    }
    jsonContent = jsonContent.trim();

    let parsedResult: AnalysisResult;
    try {
      parsedResult = JSON.parse(jsonContent);
    } catch (_parseError) {
      console.error("[analyze-document] JSON parse error. Preview:", jsonContent.substring(0, 300));
      return new Response(JSON.stringify({ error: "Failed to parse AI response as JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[analyze-document] Bill format:", parsedResult.billFormat);

    // ========== POST-PROCESS CHARGES ==========
    if (parsedResult.charges && Array.isArray(parsedResult.charges)) {
      console.log("[analyze-document] Processing", parsedResult.charges.length, "charges");

      let cptCount = 0;
      let hcpcsCount = 0;
      let revenueCount = 0;

      parsedResult.charges = parsedResult.charges.map((charge: Charge, idx: number) => {
        let code = String(charge.code || "").trim();
        let codeType = charge.codeType || "unknown";
        let revenueCode = charge.revenueCode ? String(charge.revenueCode).trim() : null;

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

        return { ...charge, code, codeType, revenueCode, amount, units: charge.units || 1 };
      });

      console.log(`[analyze-document] Summary: CPT=${cptCount}, HCPCS=${hcpcsCount}, Revenue=${revenueCount}`);

      const lineItemsSum = parsedResult.charges.reduce(
        (sum: number, c: Charge) => sum + (typeof c.amount === "number" ? c.amount : 0),
        0,
      );

      if (!parsedResult.extractedTotals) {
        parsedResult.extractedTotals = {};
      }
      parsedResult.extractedTotals.lineItemsSum = lineItemsSum;
    }

    // ========== NORMALIZE thingsWorthReviewing ==========
    if (parsedResult.thingsWorthReviewing && Array.isArray(parsedResult.thingsWorthReviewing)) {
      parsedResult.thingsWorthReviewing = parsedResult.thingsWorthReviewing.map((item: ReviewItem) => {
        // Map from various possible field names to the expected ones
        const whatToReview = item.whatToReview || item.title || item.issue || item.description || "Review this item";
        const whyItMatters = item.whyItMatters || item.reason || item.description || "This may affect your bill";
        const issueType = item.issueType || item.type || "negotiable";

        console.log(`[analyze-document] ReviewItem: ${whatToReview.substring(0, 50)}...`);

        return {
          whatToReview,
          whyItMatters,
          issueType,
        };
      });
      console.log(`[analyze-document] thingsWorthReviewing: ${parsedResult.thingsWorthReviewing.length} items`);
    } else {
      // Provide defaults if empty
      parsedResult.thingsWorthReviewing = [
        {
          whatToReview: "Review all charges for accuracy",
          whyItMatters: "Medical bills can contain errors. Verify each charge matches services received.",
          issueType: "confirmation",
        },
      ];
    }

    // ========== NORMALIZE savingsOpportunities ==========
    if (parsedResult.savingsOpportunities && Array.isArray(parsedResult.savingsOpportunities)) {
      parsedResult.savingsOpportunities = parsedResult.savingsOpportunities.map((item: SavingsItem) => {
        const whatMightBeReduced =
          item.whatMightBeReduced || item.title || item.opportunity || item.description || "Potential savings";
        const whyNegotiable = item.whyNegotiable || item.reason || item.description || "This may be negotiable";

        console.log(`[analyze-document] SavingsItem: ${whatMightBeReduced.substring(0, 50)}...`);

        return {
          whatMightBeReduced,
          whyNegotiable,
          savingsContext: item.savingsContext,
          additionalInfoNeeded: item.additionalInfoNeeded,
        };
      });
      console.log(`[analyze-document] savingsOpportunities: ${parsedResult.savingsOpportunities.length} items`);
    } else {
      // Provide defaults if empty
      parsedResult.savingsOpportunities = [
        {
          whatMightBeReduced: "Ask about self-pay discounts",
          whyNegotiable: "Most providers offer 10-40% discounts for prompt payment or self-pay patients.",
          savingsContext: "Could save 10-40%",
        },
        {
          whatMightBeReduced: "Inquire about payment plans",
          whyNegotiable: "Many providers offer interest-free payment plans that make bills more manageable.",
        },
      ];
    }

    // ========== NORMALIZE pondNextSteps ==========
    if (parsedResult.pondNextSteps && Array.isArray(parsedResult.pondNextSteps)) {
      parsedResult.pondNextSteps = parsedResult.pondNextSteps.map((item: NextStep) => {
        const step = item.step || item.action || item.title || item.description || "Review your bill";
        const details = item.details || item.description || "";

        return {
          step,
          details,
          isUrgent: item.isUrgent || false,
        };
      });
      console.log(`[analyze-document] pondNextSteps: ${parsedResult.pondNextSteps.length} items`);
    } else {
      parsedResult.pondNextSteps = [
        { step: "Request an itemized bill", details: "Get a detailed breakdown of all charges to verify accuracy", isUrgent: false },
        { step: "Call billing to ask about discounts", details: "Many providers offer 20-50% off for prompt payment or self-pay", isUrgent: false },
        { step: "Review each charge against your records", details: "Make sure you received all billed services", isUrgent: false },
      ];
    }

    // ========== ENSURE OTHER DEFAULTS ==========
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
        firstCallScript: "Hi, I'm calling about my bill and have some questions about the charges.",
        ifTheyPushBack: "I'd like to speak with a billing supervisor or patient advocate.",
        whoToAskFor: "Billing department or Patient Financial Services",
      };
    }

    if (!parsedResult.priceContext) {
      parsedResult.priceContext = {
        hasBenchmarks: false,
        comparisons: [],
        fallbackMessage: "Medicare price comparison will be calculated based on your location.",
      };
    }

    if (!parsedResult.closingReassurance) {
      parsedResult.closingReassurance =
        "Medical bills are often negotiable. Many patients reduce their bills significantly by asking questions. You have every right to understand and challenge charges.";
    }

    console.log("[analyze-document] Analysis complete");
    console.log("[analyze-document] Final thingsWorthReviewing count:", parsedResult.thingsWorthReviewing?.length);
    console.log("[analyze-document] Final savingsOpportunities count:", parsedResult.savingsOpportunities?.length);

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
