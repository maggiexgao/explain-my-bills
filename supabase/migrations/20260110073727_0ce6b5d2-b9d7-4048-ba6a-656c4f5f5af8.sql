-- ============================================
-- OPPS Addendum B Table (Hospital Outpatient PPS)
-- ============================================

CREATE TABLE IF NOT EXISTS public.opps_addendum_b (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  hcpcs TEXT NOT NULL,
  apc TEXT,
  status_indicator TEXT,
  payment_rate NUMERIC,
  relative_weight NUMERIC,
  short_desc TEXT,
  long_desc TEXT,
  national_unadjusted_copayment NUMERIC,
  minimum_unadjusted_copayment NUMERIC,
  source_file TEXT NOT NULL DEFAULT 'opps_addendum_b',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint on (year, hcpcs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_opps_addendum_b_year_hcpcs ON public.opps_addendum_b (year, hcpcs);

-- Index for quick HCPCS lookup
CREATE INDEX IF NOT EXISTS idx_opps_addendum_b_hcpcs ON public.opps_addendum_b (hcpcs);

-- Enable RLS
ALTER TABLE public.opps_addendum_b ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read OPPS Addendum B" ON public.opps_addendum_b FOR SELECT USING (true);
CREATE POLICY "Allow insert for opps_addendum_b" ON public.opps_addendum_b FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for opps_addendum_b" ON public.opps_addendum_b FOR UPDATE USING (true);


-- ============================================
-- DMEPOS Fee Schedule Table
-- ============================================

CREATE TABLE IF NOT EXISTS public.dmepos_fee_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL DEFAULT 2026,
  hcpcs TEXT NOT NULL,
  modifier TEXT,
  modifier2 TEXT,
  jurisdiction TEXT,
  category TEXT,
  ceiling NUMERIC,
  floor NUMERIC,
  fee NUMERIC,
  fee_rental NUMERIC,
  state_abbr TEXT,
  short_desc TEXT,
  source_file TEXT NOT NULL DEFAULT 'DMEPOS',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for HCPCS lookup
CREATE INDEX IF NOT EXISTS idx_dmepos_fee_schedule_hcpcs ON public.dmepos_fee_schedule (hcpcs);

-- Composite index for year + hcpcs + modifier lookup
CREATE INDEX IF NOT EXISTS idx_dmepos_fee_schedule_lookup ON public.dmepos_fee_schedule (year, hcpcs, modifier);

-- Enable RLS
ALTER TABLE public.dmepos_fee_schedule ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read DMEPOS fee schedule" ON public.dmepos_fee_schedule FOR SELECT USING (true);
CREATE POLICY "Allow insert for dmepos_fee_schedule" ON public.dmepos_fee_schedule FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for dmepos_fee_schedule" ON public.dmepos_fee_schedule FOR UPDATE USING (true);


-- ============================================
-- DMEPEN Fee Schedule Table (Enteral/Parenteral Nutrition)
-- ============================================

CREATE TABLE IF NOT EXISTS public.dmepen_fee_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL DEFAULT 2026,
  hcpcs TEXT NOT NULL,
  modifier TEXT,
  modifier2 TEXT,
  jurisdiction TEXT,
  category TEXT,
  ceiling NUMERIC,
  floor NUMERIC,
  fee NUMERIC,
  fee_rental NUMERIC,
  state_abbr TEXT,
  short_desc TEXT,
  source_file TEXT NOT NULL DEFAULT 'DMEPEN',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for HCPCS lookup
CREATE INDEX IF NOT EXISTS idx_dmepen_fee_schedule_hcpcs ON public.dmepen_fee_schedule (hcpcs);

-- Composite index for year + hcpcs + modifier lookup
CREATE INDEX IF NOT EXISTS idx_dmepen_fee_schedule_lookup ON public.dmepen_fee_schedule (year, hcpcs, modifier);

-- Enable RLS
ALTER TABLE public.dmepen_fee_schedule ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read DMEPEN fee schedule" ON public.dmepen_fee_schedule FOR SELECT USING (true);
CREATE POLICY "Allow insert for dmepen_fee_schedule" ON public.dmepen_fee_schedule FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for dmepen_fee_schedule" ON public.dmepen_fee_schedule FOR UPDATE USING (true);