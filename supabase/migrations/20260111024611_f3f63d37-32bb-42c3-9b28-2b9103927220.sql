-- Migration: Restrict write access to Medicare reference tables (service_role only)
-- This fixes the PUBLIC_DATA_EXPOSURE security issue

-- ============================================================================
-- 1. DROP existing permissive INSERT/UPDATE policies
-- ============================================================================

DROP POLICY IF EXISTS "Allow insert for mpfs_benchmarks" ON public.mpfs_benchmarks;
DROP POLICY IF EXISTS "Allow update for mpfs_benchmarks" ON public.mpfs_benchmarks;

DROP POLICY IF EXISTS "Allow insert for gpci_localities" ON public.gpci_localities;
DROP POLICY IF EXISTS "Allow update for gpci_localities" ON public.gpci_localities;

DROP POLICY IF EXISTS "Allow insert for gpci_state_avg_2026" ON public.gpci_state_avg_2026;
DROP POLICY IF EXISTS "Allow update for gpci_state_avg_2026" ON public.gpci_state_avg_2026;

DROP POLICY IF EXISTS "Allow insert for zip_to_locality" ON public.zip_to_locality;
DROP POLICY IF EXISTS "Allow update for zip_to_locality" ON public.zip_to_locality;

DROP POLICY IF EXISTS "Allow insert for opps_addendum_b" ON public.opps_addendum_b;
DROP POLICY IF EXISTS "Allow update for opps_addendum_b" ON public.opps_addendum_b;

DROP POLICY IF EXISTS "Allow insert for dmepos_fee_schedule" ON public.dmepos_fee_schedule;
DROP POLICY IF EXISTS "Allow update for dmepos_fee_schedule" ON public.dmepos_fee_schedule;

DROP POLICY IF EXISTS "Allow insert for dmepen_fee_schedule" ON public.dmepen_fee_schedule;
DROP POLICY IF EXISTS "Allow update for dmepen_fee_schedule" ON public.dmepen_fee_schedule;

-- ============================================================================
-- 2. CREATE service_role-only INSERT policies
-- ============================================================================

CREATE POLICY "Service role can insert mpfs_benchmarks"
ON public.mpfs_benchmarks
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert gpci_localities"
ON public.gpci_localities
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert gpci_state_avg_2026"
ON public.gpci_state_avg_2026
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert zip_to_locality"
ON public.zip_to_locality
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert opps_addendum_b"
ON public.opps_addendum_b
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert dmepos_fee_schedule"
ON public.dmepos_fee_schedule
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert dmepen_fee_schedule"
ON public.dmepen_fee_schedule
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================================
-- 3. CREATE service_role-only UPDATE policies
-- ============================================================================

CREATE POLICY "Service role can update mpfs_benchmarks"
ON public.mpfs_benchmarks
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can update gpci_localities"
ON public.gpci_localities
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can update gpci_state_avg_2026"
ON public.gpci_state_avg_2026
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can update zip_to_locality"
ON public.zip_to_locality
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can update opps_addendum_b"
ON public.opps_addendum_b
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can update dmepos_fee_schedule"
ON public.dmepos_fee_schedule
FOR UPDATE
TO service_role
USING (true);

CREATE POLICY "Service role can update dmepen_fee_schedule"
ON public.dmepen_fee_schedule
FOR UPDATE
TO service_role
USING (true);

-- ============================================================================
-- 4. CREATE service_role-only DELETE policies (currently missing)
-- ============================================================================

CREATE POLICY "Service role can delete mpfs_benchmarks"
ON public.mpfs_benchmarks
FOR DELETE
TO service_role
USING (true);

CREATE POLICY "Service role can delete gpci_localities"
ON public.gpci_localities
FOR DELETE
TO service_role
USING (true);

CREATE POLICY "Service role can delete gpci_state_avg_2026"
ON public.gpci_state_avg_2026
FOR DELETE
TO service_role
USING (true);

CREATE POLICY "Service role can delete zip_to_locality"
ON public.zip_to_locality
FOR DELETE
TO service_role
USING (true);

CREATE POLICY "Service role can delete opps_addendum_b"
ON public.opps_addendum_b
FOR DELETE
TO service_role
USING (true);

CREATE POLICY "Service role can delete dmepos_fee_schedule"
ON public.dmepos_fee_schedule
FOR DELETE
TO service_role
USING (true);

CREATE POLICY "Service role can delete dmepen_fee_schedule"
ON public.dmepen_fee_schedule
FOR DELETE
TO service_role
USING (true);