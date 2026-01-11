-- Fix security: Restrict public read access on sensitive analytics tables
-- analysis_gap_events - contains business intelligence data
-- strategy_audit_runs - contains internal audit reports

-- Drop the overly permissive "Anyone can read" policies
DROP POLICY IF EXISTS "Anyone can read analysis_gap_events" ON public.analysis_gap_events;
DROP POLICY IF EXISTS "Anyone can read strategy_audit_runs" ON public.strategy_audit_runs;

-- Create restrictive policies that only allow admin users to read
CREATE POLICY "Admins can read analysis_gap_events"
ON public.analysis_gap_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read strategy_audit_runs"
ON public.strategy_audit_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Also add UPDATE policy for strategy_audit_runs (currently missing)
CREATE POLICY "Service role can update strategy_audit_runs"
ON public.strategy_audit_runs
FOR UPDATE
USING (true);