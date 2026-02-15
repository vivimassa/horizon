-- Add logo_url column to operators table
ALTER TABLE operators ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create storage bucket for operator logos (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('operator-logos', 'operator-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload
CREATE POLICY "Authenticated users can upload operator logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'operator-logos');

-- Storage policies: authenticated users can update their uploads
CREATE POLICY "Authenticated users can update operator logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'operator-logos');

-- Storage policies: authenticated users can delete
CREATE POLICY "Authenticated users can delete operator logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'operator-logos');

-- Storage policies: public read access
CREATE POLICY "Public read access for operator logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'operator-logos');
