-- Fix: Restrict import_logs SELECT to admin users only
DROP POLICY IF EXISTS "Anyone can read import_logs" ON public.import_logs;

CREATE POLICY "Admins can read import_logs"
  ON public.import_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));