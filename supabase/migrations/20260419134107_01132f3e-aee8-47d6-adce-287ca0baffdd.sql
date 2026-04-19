-- company_news table
CREATE TABLE public.company_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'normal' CHECK (type IN ('important','pinned','normal')),
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone authenticated can read news"
  ON public.company_news FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins create news"
  ON public.company_news FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Admins update news"
  ON public.company_news FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete news"
  ON public.company_news FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_company_news_updated_at
  BEFORE UPDATE ON public.company_news
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_company_news_created_at ON public.company_news (created_at DESC);

-- company_news_reads table
CREATE TABLE public.company_news_reads (
  news_id uuid NOT NULL REFERENCES public.company_news(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (news_id, user_id)
);

ALTER TABLE public.company_news_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own news reads"
  ON public.company_news_reads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_news;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_news_reads;

-- Notification trigger: notify all users on new news (especially important)
CREATE OR REPLACE FUNCTION public.notify_users_on_company_news()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_title text;
BEGIN
  v_title := CASE NEW.type
    WHEN 'important' THEN '🔴 Важно: ' || NEW.title
    WHEN 'pinned' THEN '📌 ' || NEW.title
    ELSE '📢 ' || NEW.title
  END;

  FOR v_user IN
    SELECT user_id FROM public.profiles WHERE user_id IS DISTINCT FROM NEW.created_by
  LOOP
    INSERT INTO public.notifications (user_id, project_id, title, body)
    VALUES (v_user.user_id, NEW.created_by, v_title, LEFT(NEW.body, 200));
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_company_news
  AFTER INSERT ON public.company_news
  FOR EACH ROW EXECUTE FUNCTION public.notify_users_on_company_news();