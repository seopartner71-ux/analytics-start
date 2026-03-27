
-- Add team and logo fields to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS seo_specialist TEXT;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS account_manager TEXT;

-- Create storage bucket for project logos
INSERT INTO storage.buckets (id, name, public) VALUES ('project-logos', 'project-logos', true);

-- Public read access for logos
CREATE POLICY "Logos are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'project-logos');

-- Authenticated users can upload logos
CREATE POLICY "Users can upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-logos' AND auth.role() = 'authenticated');

-- Users can update their logos
CREATE POLICY "Users can update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'project-logos' AND auth.role() = 'authenticated');

-- Users can delete their logos
CREATE POLICY "Users can delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'project-logos' AND auth.role() = 'authenticated');
