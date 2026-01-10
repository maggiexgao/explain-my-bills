-- Create ZIP to Locality crosswalk table
-- This maps ZIP codes to Medicare carrier/localities for GPCI adjustment
CREATE TABLE public.zip_to_locality (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zip5 TEXT NOT NULL,
  state_abbr TEXT NULL,
  locality_num TEXT NOT NULL,
  carrier_num TEXT NULL,
  county_name TEXT NULL,
  effective_year INTEGER NULL,
  source TEXT NOT NULL DEFAULT 'CMS ZIP-to-locality',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint on zip5 (one mapping per ZIP)
  CONSTRAINT zip_to_locality_zip5_key UNIQUE (zip5)
);

-- Enable RLS
ALTER TABLE public.zip_to_locality ENABLE ROW LEVEL SECURITY;

-- Anyone can read zip_to_locality
CREATE POLICY "Anyone can read zip_to_locality"
  ON public.zip_to_locality
  FOR SELECT
  USING (true);

-- Allow insert for zip_to_locality (for admin import)
CREATE POLICY "Allow insert for zip_to_locality"
  ON public.zip_to_locality
  FOR INSERT
  WITH CHECK (true);

-- Allow update for zip_to_locality (for admin import)
CREATE POLICY "Allow update for zip_to_locality"
  ON public.zip_to_locality
  FOR UPDATE
  USING (true);

-- Create index for fast ZIP lookups
CREATE INDEX idx_zip_to_locality_zip5 ON public.zip_to_locality (zip5);
CREATE INDEX idx_zip_to_locality_state ON public.zip_to_locality (state_abbr);
CREATE INDEX idx_zip_to_locality_locality ON public.zip_to_locality (locality_num);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_zip_locality_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_zip_to_locality_updated_at
  BEFORE UPDATE ON public.zip_to_locality
  FOR EACH ROW
  EXECUTE FUNCTION public.update_zip_locality_updated_at();

-- Seed with some sample data for testing (California localities)
INSERT INTO public.zip_to_locality (zip5, state_abbr, locality_num, county_name, effective_year, source)
VALUES 
  -- San Francisco Bay Area
  ('94102', 'CA', '05', 'SAN FRANCISCO', 2026, 'CMS ZIP-to-locality'),
  ('94103', 'CA', '05', 'SAN FRANCISCO', 2026, 'CMS ZIP-to-locality'),
  ('94110', 'CA', '05', 'SAN FRANCISCO', 2026, 'CMS ZIP-to-locality'),
  ('94501', 'CA', '06', 'ALAMEDA', 2026, 'CMS ZIP-to-locality'),
  ('94502', 'CA', '06', 'ALAMEDA', 2026, 'CMS ZIP-to-locality'),
  ('94536', 'CA', '06', 'ALAMEDA', 2026, 'CMS ZIP-to-locality'),
  -- Los Angeles
  ('90001', 'CA', '18', 'LOS ANGELES', 2026, 'CMS ZIP-to-locality'),
  ('90002', 'CA', '18', 'LOS ANGELES', 2026, 'CMS ZIP-to-locality'),
  ('90210', 'CA', '18', 'LOS ANGELES', 2026, 'CMS ZIP-to-locality'),
  -- New York
  ('10001', 'NY', '01', 'MANHATTAN', 2026, 'CMS ZIP-to-locality'),
  ('10002', 'NY', '01', 'MANHATTAN', 2026, 'CMS ZIP-to-locality'),
  ('10003', 'NY', '01', 'MANHATTAN', 2026, 'CMS ZIP-to-locality'),
  -- Texas
  ('77001', 'TX', '31', 'HARRIS', 2026, 'CMS ZIP-to-locality'),
  ('77002', 'TX', '31', 'HARRIS', 2026, 'CMS ZIP-to-locality'),
  -- Florida
  ('33101', 'FL', '04', 'MIAMI-DADE', 2026, 'CMS ZIP-to-locality'),
  ('33102', 'FL', '04', 'MIAMI-DADE', 2026, 'CMS ZIP-to-locality')
ON CONFLICT (zip5) DO NOTHING;