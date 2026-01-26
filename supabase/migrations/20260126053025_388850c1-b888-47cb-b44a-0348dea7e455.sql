-- Fix analytics tables: restrict to admin-only access
-- Drop existing public policies and create admin-only policies

-- 1. analysis_missing_codes - currently has "Anyone can read"
DROP POLICY IF EXISTS "Anyone can read analysis_missing_codes" ON public.analysis_missing_codes;
CREATE POLICY "Admins can read analysis_missing_codes" 
  ON public.analysis_missing_codes
  FOR SELECT 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. analysis_totals_failures - currently has "Anyone can read"
DROP POLICY IF EXISTS "Anyone can read analysis_totals_failures" ON public.analysis_totals_failures;
CREATE POLICY "Admins can read analysis_totals_failures" 
  ON public.analysis_totals_failures
  FOR SELECT 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));