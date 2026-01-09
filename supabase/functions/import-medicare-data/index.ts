import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dataType, records } = await req.json();

    if (dataType === "mpfs") {
      // Insert MPFS records in batches
      const batchSize = 500;
      let inserted = 0;
      
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase.from("mpfs_benchmarks").upsert(batch, {
          onConflict: "hcpcs,modifier",
          ignoreDuplicates: false,
        });
        if (error) throw error;
        inserted += batch.length;
      }

      return new Response(JSON.stringify({ success: true, inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dataType === "gpci") {
      // Insert GPCI records
      const { error } = await supabase.from("gpci_localities").upsert(records, {
        onConflict: "locality_num",
        ignoreDuplicates: false,
      });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, inserted: records.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid dataType");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
