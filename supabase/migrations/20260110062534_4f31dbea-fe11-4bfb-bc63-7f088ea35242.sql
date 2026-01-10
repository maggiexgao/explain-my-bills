-- Create gpci_state_avg_2026 table for state-level GPCI averages (derived from gpci_localities)
-- This table is populated by aggregating gpci_localities by state

CREATE TABLE IF NOT EXISTS public.gpci_state_avg_2026 (
  state_abbr text PRIMARY KEY,
  avg_work_gpci numeric NOT NULL,
  avg_pe_gpci numeric NOT NULL,
  avg_mp_gpci numeric NOT NULL,
  n_rows integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add state_abbr column to zip_to_locality if not exists (for completeness)
-- Update zip_to_locality to have more robust structure
ALTER TABLE public.zip_to_locality
  ADD COLUMN IF NOT EXISTS city_name text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gpci_state_avg_state ON public.gpci_state_avg_2026 (state_abbr);
CREATE INDEX IF NOT EXISTS idx_gpci_localities_locality_num ON public.gpci_localities (locality_num);
CREATE INDEX IF NOT EXISTS idx_zip_to_locality_state ON public.zip_to_locality (state_abbr);

-- Enable RLS for gpci_state_avg_2026
ALTER TABLE public.gpci_state_avg_2026 ENABLE ROW LEVEL SECURITY;

-- Create read policy for gpci_state_avg_2026
CREATE POLICY "Anyone can read GPCI state averages" 
ON public.gpci_state_avg_2026 
FOR SELECT 
USING (true);

-- Create insert/update policies for gpci_state_avg_2026
CREATE POLICY "Allow insert for gpci_state_avg_2026" 
ON public.gpci_state_avg_2026 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update for gpci_state_avg_2026" 
ON public.gpci_state_avg_2026 
FOR UPDATE 
USING (true);

-- Create function to compute and update state GPCI averages
CREATE OR REPLACE FUNCTION public.compute_gpci_state_averages()
RETURNS TABLE (
  state_abbr text,
  avg_work_gpci numeric,
  avg_pe_gpci numeric,
  avg_mp_gpci numeric,
  n_rows integer
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.state_abbr::text,
    AVG(g.work_gpci)::numeric as avg_work_gpci,
    AVG(g.pe_gpci)::numeric as avg_pe_gpci,
    AVG(g.mp_gpci)::numeric as avg_mp_gpci,
    COUNT(*)::integer as n_rows
  FROM gpci_localities g
  WHERE g.work_gpci > 0 AND g.pe_gpci > 0 AND g.mp_gpci > 0
  GROUP BY g.state_abbr
  ORDER BY g.state_abbr;
END;
$$;

-- Create trigger for updated_at on gpci_state_avg_2026
CREATE OR REPLACE FUNCTION public.update_gpci_state_avg_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_gpci_state_avg_updated_at ON public.gpci_state_avg_2026;
CREATE TRIGGER update_gpci_state_avg_updated_at
  BEFORE UPDATE ON public.gpci_state_avg_2026
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gpci_state_avg_updated_at();