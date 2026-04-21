-- Make sensitive buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('finance-files', 'project-files', 'chat-attachments');

-- ===== finance-files: only finance users =====
DROP POLICY IF EXISTS "finance_files_read" ON storage.objects;
CREATE POLICY "finance_files_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'finance-files' AND public.has_finance_access(auth.uid()));

-- ===== project-files: only authenticated =====
DROP POLICY IF EXISTS "Public read project files" ON storage.objects;
CREATE POLICY "Authenticated read project files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');

-- ===== chat-attachments: only authenticated =====
DROP POLICY IF EXISTS "Public read chat attachments" ON storage.objects;
CREATE POLICY "Authenticated read chat attachments" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');