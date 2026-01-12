-- Create cache table for HCPCS code descriptions from NLM ClinicalTables
CREATE TABLE public.hcpcs_code_info_cache (
  code TEXT PRIMARY KEY,
  description TEXT,
  short_description TEXT,
  source TEXT NOT NULL DEFAULT 'NLM ClinicalTables (CMS HCPCS)',
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_version TEXT,
  raw JSONB
);

-- Create index for faster lookups
CREATE INDEX idx_hcpcs_code_info_cache_retrieved_at ON public.hcpcs_code_info_cache(retrieved_at);

-- Enable RLS
ALTER TABLE public.hcpcs_code_info_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (descriptions are public domain data)
CREATE POLICY "Allow public read access to HCPCS code info cache"
ON public.hcpcs_code_info_cache
FOR SELECT
USING (true);

-- Create policy for service role insert/update
CREATE POLICY "Allow service role to manage HCPCS code info cache"
ON public.hcpcs_code_info_cache
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Comment
COMMENT ON TABLE public.hcpcs_code_info_cache IS 'Cache for HCPCS code descriptions from NLM ClinicalTables API. TTL: 30 days.';