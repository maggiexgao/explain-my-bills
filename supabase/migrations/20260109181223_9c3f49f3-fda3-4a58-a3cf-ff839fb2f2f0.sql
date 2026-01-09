-- Add INSERT policies for mpfs_benchmarks
CREATE POLICY "Allow insert for mpfs_benchmarks" 
ON public.mpfs_benchmarks 
FOR INSERT 
WITH CHECK (true);

-- Add UPDATE policies for mpfs_benchmarks
CREATE POLICY "Allow update for mpfs_benchmarks" 
ON public.mpfs_benchmarks 
FOR UPDATE 
USING (true);

-- Add INSERT policies for gpci_localities
CREATE POLICY "Allow insert for gpci_localities" 
ON public.gpci_localities 
FOR INSERT 
WITH CHECK (true);

-- Add UPDATE policies for gpci_localities
CREATE POLICY "Allow update for gpci_localities" 
ON public.gpci_localities 
FOR UPDATE 
USING (true);