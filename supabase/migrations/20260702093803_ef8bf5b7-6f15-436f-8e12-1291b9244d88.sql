
CREATE OR REPLACE FUNCTION public.notify_chat_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  proj_name TEXT;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO proj_name FROM public.projects WHERE id = NEW.project_id;

  FOREACH uid IN ARRAY NEW.mentions LOOP
    IF uid IS NOT NULL AND uid <> COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, project_id, title, body)
      VALUES (
        uid,
        NEW.project_id,
        'Вас упомянули в чате: ' || COALESCE(proj_name, ''),
        LEFT(COALESCE(NEW.body, ''), 200)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_mentions ON public.project_messages;
CREATE TRIGGER trg_notify_chat_mentions
  AFTER INSERT ON public.project_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_mentions();
