-- ============================================================================
-- STEP 3: Code Metadata table for missing code explanations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.code_metadata (
  code TEXT PRIMARY KEY,
  code_system TEXT NOT NULL DEFAULT 'unknown', -- hcpcs_level_ii, cpt, revenue_code, unknown
  short_desc TEXT,
  long_desc TEXT,
  source TEXT NOT NULL DEFAULT 'import', -- CMS_HCPCS, import, manual, ai_generated
  source_year INTEGER,
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lookup
CREATE INDEX IF NOT EXISTS idx_code_metadata_code_system ON public.code_metadata(code_system);
CREATE INDEX IF NOT EXISTS idx_code_metadata_source ON public.code_metadata(source);

-- Enable RLS
ALTER TABLE public.code_metadata ENABLE ROW LEVEL SECURITY;

-- RLS policies: anyone can read, service role can write
CREATE POLICY "Anyone can read code_metadata" ON public.code_metadata
  FOR SELECT USING (true);

CREATE POLICY "Service role can insert code_metadata" ON public.code_metadata
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update code_metadata" ON public.code_metadata
  FOR UPDATE TO service_role USING (true);

CREATE POLICY "Service role can delete code_metadata" ON public.code_metadata
  FOR DELETE TO service_role USING (true);

-- ============================================================================
-- STEP 5: Gap Telemetry Tables for admin diagnostics
-- ============================================================================

-- Analysis gap events (one per analysis run)
CREATE TABLE IF NOT EXISTS public.analysis_gap_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bill_hash TEXT, -- hash only, no PHI
  geo_confidence TEXT, -- high/medium/low
  zip_present BOOLEAN DEFAULT FALSE,
  used_state_fallback BOOLEAN DEFAULT FALSE,
  totals_detected_type TEXT, -- totalCharges/patientBalance/amountDue/none
  totals_confidence TEXT, -- high/medium/low
  priced_item_count INTEGER DEFAULT 0,
  extracted_code_count INTEGER DEFAULT 0,
  missing_code_count INTEGER DEFAULT 0
);

-- Index for recent queries
CREATE INDEX IF NOT EXISTS idx_analysis_gap_events_created ON public.analysis_gap_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.analysis_gap_events ENABLE ROW LEVEL SECURITY;

-- Only service role can insert, admin can read
CREATE POLICY "Service role can insert analysis_gap_events" ON public.analysis_gap_events
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Anyone can read analysis_gap_events" ON public.analysis_gap_events
  FOR SELECT USING (true);

-- Missing codes tracking (aggregated by code)
CREATE TABLE IF NOT EXISTS public.analysis_missing_codes (
  code TEXT NOT NULL,
  code_system_guess TEXT DEFAULT 'unknown',
  context_type TEXT DEFAULT 'unknown', -- professional, facility, unknown
  count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, context_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_missing_codes_count ON public.analysis_missing_codes(count DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_missing_codes_last_seen ON public.analysis_missing_codes(last_seen_at DESC);

-- Enable RLS
ALTER TABLE public.analysis_missing_codes ENABLE ROW LEVEL SECURITY;

-- Service role can insert/update, admin can read
CREATE POLICY "Service role can insert analysis_missing_codes" ON public.analysis_missing_codes
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update analysis_missing_codes" ON public.analysis_missing_codes
  FOR UPDATE TO service_role USING (true);

CREATE POLICY "Anyone can read analysis_missing_codes" ON public.analysis_missing_codes
  FOR SELECT USING (true);

-- Totals extraction failures (aggregated)
CREATE TABLE IF NOT EXISTS public.analysis_totals_failures (
  doc_type TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_type, failure_reason)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_totals_failures_count ON public.analysis_totals_failures(count DESC);

-- Enable RLS
ALTER TABLE public.analysis_totals_failures ENABLE ROW LEVEL SECURITY;

-- Service role can insert/update, admin can read
CREATE POLICY "Service role can insert analysis_totals_failures" ON public.analysis_totals_failures
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update analysis_totals_failures" ON public.analysis_totals_failures
  FOR UPDATE TO service_role USING (true);

CREATE POLICY "Anyone can read analysis_totals_failures" ON public.analysis_totals_failures
  FOR SELECT USING (true);