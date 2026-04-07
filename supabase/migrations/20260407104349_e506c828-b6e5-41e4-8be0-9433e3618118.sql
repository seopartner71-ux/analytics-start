
-- Project files table
CREATE TABLE public.project_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Project comments table (project-level, not task-level)
CREATE TABLE public.project_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.team_members(id),
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

-- RLS: project owners manage files
CREATE POLICY "Project owners manage files"
ON public.project_files FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.projects WHERE projects.id = project_files.project_id AND projects.owner_id = auth.uid()
));

-- RLS: project owners manage comments
CREATE POLICY "Project owners manage comments"
ON public.project_comments FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.projects WHERE projects.id = project_comments.project_id AND projects.owner_id = auth.uid()
));

-- Storage bucket for project files
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated upload project files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'project-files');

-- Storage RLS: public read
CREATE POLICY "Public read project files"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-files');

-- Storage RLS: owners can delete
CREATE POLICY "Owners delete project files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-files');

-- Enable realtime for project comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_comments;
