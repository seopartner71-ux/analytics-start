
-- Backfill: добавить Владимира и Алису во все существующие проекты как SEO специалист
INSERT INTO public.project_members (project_id, team_member_id, role, user_id)
SELECT p.id, tm.id, 'SEO специалист', tm.owner_id
FROM public.projects p
CROSS JOIN public.team_members tm
WHERE tm.email IN ('sinitsin3@yandex.ru', 'sinitsina9991@yandex.ru')
ON CONFLICT (project_id, team_member_id) DO NOTHING;

-- Триггерная функция для авто-добавления при создании нового проекта
CREATE OR REPLACE FUNCTION public.auto_add_default_seo_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, team_member_id, role, user_id)
  SELECT NEW.id, tm.id, 'SEO специалист', tm.owner_id
  FROM public.team_members tm
  WHERE tm.email IN ('sinitsin3@yandex.ru', 'sinitsina9991@yandex.ru')
  ON CONFLICT (project_id, team_member_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_default_seo_members ON public.projects;
CREATE TRIGGER trg_auto_add_default_seo_members
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_default_seo_members();
