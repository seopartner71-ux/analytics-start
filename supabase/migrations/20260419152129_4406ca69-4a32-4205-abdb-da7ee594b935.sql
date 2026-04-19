-- Knowledge base articles
CREATE TABLE public.knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'tech_seo',
  tags text[] NOT NULL DEFAULT '{}',
  content text NOT NULL DEFAULT '',
  author_id uuid NOT NULL,
  updated_by uuid,
  views_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_knowledge_articles_category ON public.knowledge_articles(category);
CREATE INDEX idx_knowledge_articles_tags ON public.knowledge_articles USING GIN(tags);
CREATE INDEX idx_knowledge_articles_search ON public.knowledge_articles USING GIN(to_tsvector('russian', title || ' ' || content));

ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read knowledge_articles"
ON public.knowledge_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage knowledge_articles"
ON public.knowledge_articles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers create knowledge_articles"
ON public.knowledge_articles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'manager') AND auth.uid() = author_id);

CREATE POLICY "Managers update own knowledge_articles"
ON public.knowledge_articles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'manager') AND auth.uid() = author_id);

CREATE TRIGGER trg_knowledge_articles_updated
BEFORE UPDATE ON public.knowledge_articles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link articles to onboarding tasks (per-project)
CREATE TABLE public.onboarding_task_articles (
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, article_id)
);

ALTER TABLE public.onboarding_task_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read onboarding_task_articles"
ON public.onboarding_task_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage onboarding_task_articles"
ON public.onboarding_task_articles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Project owners manage onboarding_task_articles"
ON public.onboarding_task_articles FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.onboarding_tasks ot
  JOIN public.projects p ON p.id = ot.project_id
  WHERE ot.id = task_id AND p.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.onboarding_tasks ot
  JOIN public.projects p ON p.id = ot.project_id
  WHERE ot.id = task_id AND p.owner_id = auth.uid()
));

-- Link articles to templates (applied on project creation)
CREATE TABLE public.onboarding_template_articles (
  template_id uuid NOT NULL REFERENCES public.onboarding_task_templates(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES public.knowledge_articles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, article_id)
);

ALTER TABLE public.onboarding_template_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read onboarding_template_articles"
ON public.onboarding_template_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage onboarding_template_articles"
ON public.onboarding_template_articles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Increment views helper
CREATE OR REPLACE FUNCTION public.increment_article_views(p_article_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.knowledge_articles SET views_count = views_count + 1 WHERE id = p_article_id;
$$;