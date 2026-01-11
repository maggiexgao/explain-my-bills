-- Create strategy audit runs table for persisting audit reports
CREATE TABLE public.strategy_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  report_markdown TEXT,
  report_json JSONB,
  dataset_snapshot JSONB,
  status TEXT DEFAULT 'completed',
  summary_pass INTEGER DEFAULT 0,
  summary_warn INTEGER DEFAULT 0,
  summary_fail INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.strategy_audit_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies - anyone can read, only service role can write
CREATE POLICY "Anyone can read strategy_audit_runs"
  ON public.strategy_audit_runs
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert strategy_audit_runs"
  ON public.strategy_audit_runs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can delete strategy_audit_runs"
  ON public.strategy_audit_runs
  FOR DELETE
  USING (true);

-- Add index for ordering by date
CREATE INDEX strategy_audit_runs_created_at_idx 
  ON public.strategy_audit_runs (created_at DESC);

-- Create CLFS fee schedule table for clinical lab codes
CREATE TABLE public.clfs_fee_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hcpcs TEXT NOT NULL,
  year INTEGER NOT NULL DEFAULT 2026,
  payment_amount NUMERIC,
  short_desc TEXT,
  long_desc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_file TEXT NOT NULL DEFAULT 'CLFS',
  UNIQUE (hcpcs, year)
);

-- Enable RLS
ALTER TABLE public.clfs_fee_schedule ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can read clfs_fee_schedule"
  ON public.clfs_fee_schedule
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert clfs_fee_schedule"
  ON public.clfs_fee_schedule
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update clfs_fee_schedule"
  ON public.clfs_fee_schedule
  FOR UPDATE
  USING (true);

CREATE POLICY "Service role can delete clfs_fee_schedule"
  ON public.clfs_fee_schedule
  FOR DELETE
  USING (true);

-- Add indexes for fast lookups
CREATE INDEX clfs_fee_schedule_hcpcs_idx ON public.clfs_fee_schedule (hcpcs);
CREATE INDEX clfs_fee_schedule_year_idx ON public.clfs_fee_schedule (year);