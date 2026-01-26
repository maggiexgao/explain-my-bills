-- Add missing unique constraints with conditional logic
-- OPPS unique constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'opps_addendum_b_hcpcs_year_key'
  ) THEN
    ALTER TABLE public.opps_addendum_b
    ADD CONSTRAINT opps_addendum_b_hcpcs_year_key
    UNIQUE (hcpcs, year);
  END IF;
END $$;

-- DMEPOS unique constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dmepos_fee_schedule_composite_key'
  ) THEN
    ALTER TABLE public.dmepos_fee_schedule
    ADD CONSTRAINT dmepos_fee_schedule_composite_key
    UNIQUE (hcpcs, modifier, modifier2, state_abbr, year, source_file);
  END IF;
END $$;

-- DMEPEN unique constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'dmepen_fee_schedule_composite_key'
  ) THEN
    ALTER TABLE public.dmepen_fee_schedule
    ADD CONSTRAINT dmepen_fee_schedule_composite_key
    UNIQUE (hcpcs, modifier, modifier2, state_abbr, year, source_file);
  END IF;
END $$;