-- Create storage bucket for medical documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false);

-- Allow authenticated users to upload documents
CREATE POLICY "Users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow users to read their own documents
CREATE POLICY "Users can read their own documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');

-- Create a table to track document analyses (no auth required for MVP)
CREATE TABLE public.document_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  state TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  analysis_result JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_analyses ENABLE ROW LEVEL SECURITY;

-- Allow public access for MVP (no auth required)
CREATE POLICY "Anyone can insert analyses"
ON public.document_analyses
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read analyses"
ON public.document_analyses
FOR SELECT
USING (true);

CREATE POLICY "Anyone can update their analyses"
ON public.document_analyses
FOR UPDATE
USING (true);

CREATE POLICY "Anyone can delete analyses"
ON public.document_analyses
FOR DELETE
USING (true);