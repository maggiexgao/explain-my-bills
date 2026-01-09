-- Create table for MPFS (Medicare Physician Fee Schedule) benchmarks
CREATE TABLE public.mpfs_benchmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hcpcs TEXT NOT NULL,
  modifier TEXT,
  description TEXT,
  status TEXT,
  work_rvu NUMERIC,
  nonfac_pe_rvu NUMERIC,
  fac_pe_rvu NUMERIC,
  mp_rvu NUMERIC,
  nonfac_fee NUMERIC,
  fac_fee NUMERIC,
  pctc TEXT,
  global_days TEXT,
  mult_surgery_indicator TEXT,
  conversion_factor NUMERIC DEFAULT 34.6062,
  year INTEGER DEFAULT 2026,
  qp_status TEXT,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for GPCI localities (Geographic Practice Cost Index)
CREATE TABLE public.gpci_localities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  locality_num TEXT NOT NULL UNIQUE,
  state_abbr TEXT NOT NULL,
  locality_name TEXT NOT NULL,
  zip_code TEXT,
  work_gpci NUMERIC NOT NULL,
  pe_gpci NUMERIC NOT NULL,
  mp_gpci NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX idx_mpfs_hcpcs ON public.mpfs_benchmarks(hcpcs);
CREATE INDEX idx_mpfs_hcpcs_modifier ON public.mpfs_benchmarks(hcpcs, modifier);
CREATE INDEX idx_gpci_zip ON public.gpci_localities(zip_code);
CREATE INDEX idx_gpci_state ON public.gpci_localities(state_abbr);
CREATE INDEX idx_gpci_locality ON public.gpci_localities(locality_num);

-- Create full-text search index on description for autocomplete
CREATE INDEX idx_mpfs_description_trgm ON public.mpfs_benchmarks USING gin(to_tsvector('english', description));

-- Enable RLS but allow public read access for benchmarks
ALTER TABLE public.mpfs_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gpci_localities ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (benchmark data is public)
CREATE POLICY "Anyone can read MPFS benchmarks" 
ON public.mpfs_benchmarks 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can read GPCI localities" 
ON public.gpci_localities 
FOR SELECT 
USING (true);