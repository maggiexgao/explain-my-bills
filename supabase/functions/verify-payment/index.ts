import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe session ID format validation (cs_test_ or cs_live_ prefix)
const SESSION_ID_REGEX = /^cs_(test|live)_[a-zA-Z0-9]+$/;

// Basic rate limiting using in-memory store
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 verification requests per minute per IP

function isRateLimited(clientIP: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIP);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  record.count++;
  return false;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[VERIFY-PAYMENT] Function started");
    
    // Get client IP for rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    
    // Check rate limit
    if (isRateLimited(clientIP)) {
      console.warn("[VERIFY-PAYMENT] Rate limit exceeded", { clientIP });
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later.", verified: false }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("[VERIFY-PAYMENT] Configuration error: Payment service key missing");
      return new Response(
        JSON.stringify({ error: "Payment verification service unavailable.", verified: false }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { sessionId } = body;
    
    // Validate session ID format
    if (!sessionId || typeof sessionId !== "string") {
      console.warn("[VERIFY-PAYMENT] Missing session ID");
      return new Response(
        JSON.stringify({ error: "Session ID is required", verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate session ID format to prevent injection
    if (!SESSION_ID_REGEX.test(sessionId)) {
      console.warn("[VERIFY-PAYMENT] Invalid session ID format", { 
        sessionId: sessionId.substring(0, 20) 
      });
      return new Response(
        JSON.stringify({ error: "Invalid session ID format", verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Validate session ID length
    if (sessionId.length > 100) {
      console.warn("[VERIFY-PAYMENT] Session ID too long");
      return new Response(
        JSON.stringify({ error: "Invalid session ID", verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("[VERIFY-PAYMENT] Verifying session", { 
      sessionId: sessionId.substring(0, 20) + "..." 
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log("[VERIFY-PAYMENT] Session retrieved", { 
      status: session.payment_status,
      hasEmail: !!session.customer_email 
    });

    const isPaid = session.payment_status === "paid";
    const patientName = session.metadata?.patientName || "";

    return new Response(JSON.stringify({ 
      verified: isPaid,
      patientName,
      // Only return email confirmation, not full details
      hasEmail: !!(session.customer_email || session.customer_details?.email),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[VERIFY-PAYMENT] Error:", errorMessage);
    // Return generic error to client
    return new Response(JSON.stringify({ error: "Payment verification failed", verified: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
