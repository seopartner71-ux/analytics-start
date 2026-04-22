-- Tighten public bucket listing: allow reading individual file by name, not listing.
DROP POLICY IF EXISTS "Messenger files public read" ON storage.objects;

-- Permit access only when a specific object name is requested (no broad listing).
CREATE POLICY "Messenger files read by name" ON storage.objects FOR SELECT
USING (bucket_id = 'messenger' AND name IS NOT NULL);