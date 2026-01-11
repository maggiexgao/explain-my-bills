-- Add unique constraint for DMEPEN fee schedule
-- Natural key: hcpcs + modifier + modifier2 + state_abbr + year + source_file
CREATE UNIQUE INDEX IF NOT EXISTS dmepen_fee_schedule_natural_key 
ON public.dmepen_fee_schedule (
  hcpcs, 
  COALESCE(modifier, ''), 
  COALESCE(modifier2, ''), 
  COALESCE(state_abbr, ''), 
  year, 
  source_file
);

-- Add unique constraint for DMEPOS fee schedule (same structure)
CREATE UNIQUE INDEX IF NOT EXISTS dmepos_fee_schedule_natural_key 
ON public.dmepos_fee_schedule (
  hcpcs, 
  COALESCE(modifier, ''), 
  COALESCE(modifier2, ''), 
  COALESCE(state_abbr, ''), 
  year, 
  source_file
);