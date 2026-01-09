
-- Step 1: Normalize modifier column - set NOT NULL with default ''
-- First update any existing NULLs to empty string
UPDATE public.mpfs_benchmarks SET modifier = '' WHERE modifier IS NULL;

-- Alter the column to NOT NULL with default ''
ALTER TABLE public.mpfs_benchmarks 
  ALTER COLUMN modifier SET DEFAULT '',
  ALTER COLUMN modifier SET NOT NULL;

-- Step 2: Set defaults for year, qp_status, and source to ensure consistency
ALTER TABLE public.mpfs_benchmarks 
  ALTER COLUMN year SET DEFAULT 2026,
  ALTER COLUMN year SET NOT NULL;

UPDATE public.mpfs_benchmarks SET qp_status = 'nonQP' WHERE qp_status IS NULL;
ALTER TABLE public.mpfs_benchmarks 
  ALTER COLUMN qp_status SET DEFAULT 'nonQP',
  ALTER COLUMN qp_status SET NOT NULL;

UPDATE public.mpfs_benchmarks SET source = 'CMS MPFS' WHERE source IS NULL;
ALTER TABLE public.mpfs_benchmarks 
  ALTER COLUMN source SET DEFAULT 'CMS MPFS',
  ALTER COLUMN source SET NOT NULL;

-- Step 3: Create unique constraint on the natural key (hcpcs, modifier, year, qp_status, source)
ALTER TABLE public.mpfs_benchmarks
  ADD CONSTRAINT mpfs_benchmarks_natural_key_unique 
  UNIQUE (hcpcs, modifier, year, qp_status, source);

-- Step 4: Add an index for faster lookups by hcpcs
CREATE INDEX IF NOT EXISTS idx_mpfs_benchmarks_hcpcs ON public.mpfs_benchmarks(hcpcs);
