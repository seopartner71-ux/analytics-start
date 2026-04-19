-- Таблица ссылочного профиля
CREATE TABLE public.link_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  donor_url text NOT NULL,
  anchor text NOT NULL DEFAULT '',
  acceptor_url text NOT NULL,
  type text NOT NULL DEFAULT 'outreach' CHECK (type IN ('outreach', 'crowd', 'exchange')),
  cost numeric NOT NULL DEFAULT 0,
  placed_at date,
  last_checked_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'lost', 'pending')),
  last_status_code integer,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_link_profile_project ON public.link_profile(project_id);
CREATE INDEX idx_link_profile_status ON public.link_profile(status);
CREATE INDEX idx_link_profile_last_checked ON public.link_profile(last_checked_at);

ALTER TABLE public.link_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage link_profile"
  ON public.link_profile FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = link_profile.project_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = link_profile.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Admins manage link_profile"
  ON public.link_profile FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage link_profile on assigned projects"
  ON public.link_profile FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.team_members tm ON tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id
    WHERE p.id = link_profile.project_id AND tm.owner_id = auth.uid()
  ));

CREATE TRIGGER update_link_profile_updated_at
  BEFORE UPDATE ON public.link_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Триггер уведомлений при потере ссылки
CREATE OR REPLACE FUNCTION public.notify_link_lost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_project_name text;
  v_owner_id uuid;
  v_seo_owner uuid;
  v_seo_id uuid;
  v_title text;
  v_body text;
BEGIN
  IF NEW.status <> 'lost' OR (TG_OP = 'UPDATE' AND OLD.status = 'lost') THEN
    RETURN NEW;
  END IF;

  SELECT p.name, p.owner_id, p.seo_specialist_id INTO v_project_name, v_owner_id, v_seo_id
  FROM public.projects p WHERE p.id = NEW.project_id;

  v_title := '🔗 Ссылка отвалилась: ' || NEW.donor_url;
  v_body := 'Проект: ' || COALESCE(v_project_name, '—') || E'\nАкцептор: ' || NEW.acceptor_url || E'\nАнкор: ' || NEW.anchor;

  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, project_id, title, body)
    VALUES (v_owner_id, NEW.project_id, v_title, v_body);
  END IF;

  IF v_seo_id IS NOT NULL THEN
    SELECT owner_id INTO v_seo_owner FROM public.team_members WHERE id = v_seo_id;
    IF v_seo_owner IS NOT NULL AND v_seo_owner IS DISTINCT FROM v_owner_id THEN
      INSERT INTO public.notifications (user_id, project_id, title, body)
      VALUES (v_seo_owner, NEW.project_id, v_title, v_body);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_link_lost
  AFTER INSERT OR UPDATE OF status ON public.link_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_link_lost();