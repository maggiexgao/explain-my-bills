-- Drop old constraint and create correct one for MPFS upserts
ALTER TABLE public.mpfs_benchmarks DROP CONSTRAINT IF EXISTS mpfs_benchmarks_natural_key_unique;

-- Create the correct unique constraint on (hcpcs, modifier, year) for upserts
ALTER TABLE public.mpfs_benchmarks
ADD CONSTRAINT mpfs_benchmarks_hcpcs_modifier_year_key
UNIQUE (hcpcs, modifier, year);