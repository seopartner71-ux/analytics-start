-- Trigger: crawl_jobs lifecycle → chat
CREATE OR REPLACE FUNCTION public.notify_crawl_lifecycle_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('running', 'pending') THEN
      INSERT INTO public.project_messages (project_id, user_name, body, is_system)
      VALUES (NEW.project_id, 'Система', '🔍 Запущен технический аудит сайта', true);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'pending' AND NEW.status = 'running' THEN
      INSERT INTO public.project_messages (project_id, user_name, body, is_system)
      VALUES (NEW.project_id, 'Система', '🔍 Запущен технический аудит сайта', true);
    ELSIF NEW.status = 'completed' THEN
      INSERT INTO public.project_messages (project_id, user_name, body, is_system)
      VALUES (NEW.project_id, 'Система', '✅ Технический аудит завершён', true);
    ELSIF NEW.status = 'failed' THEN
      INSERT INTO public.project_messages (project_id, user_name, body, is_system)
      VALUES (NEW.project_id, 'Система', '❌ Технический аудит завершился с ошибкой' || COALESCE(': ' || NEW.error_message, ''), true);
    ELSIF NEW.status = 'stopped' THEN
      INSERT INTO public.project_messages (project_id, user_name, body, is_system)
      VALUES (NEW.project_id, 'Система', '⏹ Технический аудит остановлен', true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crawl_lifecycle_chat ON public.crawl_jobs;
CREATE TRIGGER trg_crawl_lifecycle_chat
AFTER INSERT OR UPDATE OF status ON public.crawl_jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_crawl_lifecycle_to_chat();

-- Trigger: project_files insert → chat
CREATE OR REPLACE FUNCTION public.notify_project_file_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.project_messages (project_id, user_name, body, is_system)
  VALUES (NEW.project_id, 'Система', '📎 Загружен новый файл: ' || NEW.name, true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_file_chat ON public.project_files;
CREATE TRIGGER trg_project_file_chat
AFTER INSERT ON public.project_files
FOR EACH ROW EXECUTE FUNCTION public.notify_project_file_to_chat();