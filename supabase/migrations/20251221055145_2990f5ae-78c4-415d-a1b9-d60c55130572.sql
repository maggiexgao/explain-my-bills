-- Drop the unused document_analyses table
-- This table is not used by any application code and has insecure RLS policies
DROP TABLE IF EXISTS public.document_analyses;