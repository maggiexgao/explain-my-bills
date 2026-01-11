-- Drop the COALESCE-based indexes
DROP INDEX IF EXISTS public.dmepen_fee_schedule_natural_key;
DROP INDEX IF EXISTS public.dmepos_fee_schedule_natural_key;

-- Create simple unique constraints without COALESCE
-- First, update any null values to empty strings for the key columns
UPDATE public.dmepen_fee_schedule SET modifier = '' WHERE modifier IS NULL;
UPDATE public.dmepen_fee_schedule SET modifier2 = '' WHERE modifier2 IS NULL;
UPDATE public.dmepen_fee_schedule SET state_abbr = '' WHERE state_abbr IS NULL;

UPDATE public.dmepos_fee_schedule SET modifier = '' WHERE modifier IS NULL;
UPDATE public.dmepos_fee_schedule SET modifier2 = '' WHERE modifier2 IS NULL;
UPDATE public.dmepos_fee_schedule SET state_abbr = '' WHERE state_abbr IS NULL;

-- Set NOT NULL defaults
ALTER TABLE public.dmepen_fee_schedule 
  ALTER COLUMN modifier SET DEFAULT '',
  ALTER COLUMN modifier2 SET DEFAULT '',
  ALTER COLUMN state_abbr SET DEFAULT '';

ALTER TABLE public.dmepos_fee_schedule 
  ALTER COLUMN modifier SET DEFAULT '',
  ALTER COLUMN modifier2 SET DEFAULT '',
  ALTER COLUMN state_abbr SET DEFAULT '';

-- Now create simple unique constraints
CREATE UNIQUE INDEX dmepen_fee_schedule_natural_key 
ON public.dmepen_fee_schedule (hcpcs, modifier, modifier2, state_abbr, year, source_file);

CREATE UNIQUE INDEX dmepos_fee_schedule_natural_key 
ON public.dmepos_fee_schedule (hcpcs, modifier, modifier2, state_abbr, year, source_file);