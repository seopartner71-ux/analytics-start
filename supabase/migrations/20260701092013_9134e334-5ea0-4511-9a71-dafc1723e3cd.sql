CREATE OR REPLACE FUNCTION public.notify_users_on_company_news()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    VALUES (v_user.user_id, NULL, v_title, LEFT(NEW.body, 200));
  END LOOP;

  RETURN NEW;
END;
$function$;