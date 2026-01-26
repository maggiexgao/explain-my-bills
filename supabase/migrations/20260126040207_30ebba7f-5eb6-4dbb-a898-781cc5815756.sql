-- Create import_logs table to track import history
CREATE TABLE IF NOT EXISTS public.import_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_name text NOT NULL,
  file_name text,
  rows_imported integer DEFAULT 0,
  rows_skipped integer DEFAULT 0,
  rows_before_dedup integer,
  status text NOT NULL DEFAULT 'pending', -- 'success', 'partial', 'failed', 'pending'
  error_message text,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  imported_by text
);

-- Enable RLS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can read import logs (admin page only)
CREATE POLICY "Anyone can read import_logs"
  ON public.import_logs FOR SELECT
  USING (true);

-- Service role can insert/update/delete
CREATE POLICY "Service role can insert import_logs"
  ON public.import_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update import_logs"
  ON public.import_logs FOR UPDATE
  USING (true);

CREATE POLICY "Service role can delete import_logs"
  ON public.import_logs FOR DELETE
  USING (true);

-- Index for faster queries
CREATE INDEX idx_import_logs_dataset ON public.import_logs(dataset_name);
CREATE INDEX idx_import_logs_imported_at ON public.import_logs(imported_at DESC);