
-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  error_id UUID REFERENCES public.site_errors(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: create notifications on new site_errors
CREATE OR REPLACE FUNCTION public.notify_on_site_error()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  proj RECORD;
  member RECORD;
  notif_title TEXT;
BEGIN
  IF NEW.status <> 'Новая' THEN
    RETURN NEW;
  END IF;

  SELECT p.name, p.seo_specialist_id, p.account_manager_id, p.owner_id
  INTO proj
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  notif_title := 'Ошибка: ' || NEW.error_type;

  -- Notify project owner
  INSERT INTO public.notifications (user_id, project_id, title, body, error_id)
  VALUES (proj.owner_id, NEW.project_id, notif_title, NEW.url, NEW.id);

  -- Notify SEO specialist (via team_members.owner_id)
  IF proj.seo_specialist_id IS NOT NULL THEN
    SELECT tm.owner_id INTO member FROM public.team_members tm WHERE tm.id = proj.seo_specialist_id;
    IF FOUND AND member.owner_id IS DISTINCT FROM proj.owner_id THEN
      INSERT INTO public.notifications (user_id, project_id, title, body, error_id)
      VALUES (member.owner_id, NEW.project_id, notif_title, NEW.url, NEW.id);
    END IF;
  END IF;

  -- Notify account manager (via team_members.owner_id)
  IF proj.account_manager_id IS NOT NULL THEN
    SELECT tm.owner_id INTO member FROM public.team_members tm WHERE tm.id = proj.account_manager_id;
    IF FOUND AND member.owner_id IS DISTINCT FROM proj.owner_id THEN
      INSERT INTO public.notifications (user_id, project_id, title, body, error_id)
      VALUES (member.owner_id, NEW.project_id, notif_title, NEW.url, NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_site_error
  AFTER INSERT ON public.site_errors
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_site_error();

-- Enable pg_cron and pg_net for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
