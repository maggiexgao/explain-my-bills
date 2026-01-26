-- Fix RLS policies: Restrict service-role INSERT/UPDATE/DELETE policies to actually check for service_role
-- This prevents any potential bypass from anon/authenticated roles

-- 1. analysis_gap_events
DROP POLICY IF EXISTS "Service role can insert analysis_gap_events" ON public.analysis_gap_events;
CREATE POLICY "Service role can insert analysis_gap_events" 
  ON public.analysis_gap_events
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

-- 2. analysis_missing_codes
DROP POLICY IF EXISTS "Service role can insert analysis_missing_codes" ON public.analysis_missing_codes;
CREATE POLICY "Service role can insert analysis_missing_codes" 
  ON public.analysis_missing_codes
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update analysis_missing_codes" ON public.analysis_missing_codes;
CREATE POLICY "Service role can update analysis_missing_codes" 
  ON public.analysis_missing_codes
  FOR UPDATE 
  USING (auth.role() = 'service_role');

-- 3. analysis_totals_failures
DROP POLICY IF EXISTS "Service role can insert analysis_totals_failures" ON public.analysis_totals_failures;
CREATE POLICY "Service role can insert analysis_totals_failures" 
  ON public.analysis_totals_failures
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update analysis_totals_failures" ON public.analysis_totals_failures;
CREATE POLICY "Service role can update analysis_totals_failures" 
  ON public.analysis_totals_failures
  FOR UPDATE 
  USING (auth.role() = 'service_role');

-- 4. strategy_audit_runs
DROP POLICY IF EXISTS "Service role can insert strategy_audit_runs" ON public.strategy_audit_runs;
CREATE POLICY "Service role can insert strategy_audit_runs" 
  ON public.strategy_audit_runs
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update strategy_audit_runs" ON public.strategy_audit_runs;
CREATE POLICY "Service role can update strategy_audit_runs" 
  ON public.strategy_audit_runs
  FOR UPDATE 
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete strategy_audit_runs" ON public.strategy_audit_runs;
CREATE POLICY "Service role can delete strategy_audit_runs" 
  ON public.strategy_audit_runs
  FOR DELETE 
  USING (auth.role() = 'service_role');

-- 5. code_metadata
DROP POLICY IF EXISTS "Service role can insert code_metadata" ON public.code_metadata;
CREATE POLICY "Service role can insert code_metadata" 
  ON public.code_metadata
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update code_metadata" ON public.code_metadata;
CREATE POLICY "Service role can update code_metadata" 
  ON public.code_metadata
  FOR UPDATE 
  USING (auth.role() = 'service_role');

-- 6. clfs_fee_schedule
DROP POLICY IF EXISTS "Service role can insert clfs_fee_schedule" ON public.clfs_fee_schedule;
CREATE POLICY "Service role can insert clfs_fee_schedule" 
  ON public.clfs_fee_schedule
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update clfs_fee_schedule" ON public.clfs_fee_schedule;
CREATE POLICY "Service role can update clfs_fee_schedule" 
  ON public.clfs_fee_schedule
  FOR UPDATE 
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete clfs_fee_schedule" ON public.clfs_fee_schedule;
CREATE POLICY "Service role can delete clfs_fee_schedule" 
  ON public.clfs_fee_schedule
  FOR DELETE 
  USING (auth.role() = 'service_role');

-- 7. import_logs
DROP POLICY IF EXISTS "Service role can insert import_logs" ON public.import_logs;
CREATE POLICY "Service role can insert import_logs" 
  ON public.import_logs
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update import_logs" ON public.import_logs;
CREATE POLICY "Service role can update import_logs" 
  ON public.import_logs
  FOR UPDATE 
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete import_logs" ON public.import_logs;
CREATE POLICY "Service role can delete import_logs" 
  ON public.import_logs
  FOR DELETE 
  USING (auth.role() = 'service_role');