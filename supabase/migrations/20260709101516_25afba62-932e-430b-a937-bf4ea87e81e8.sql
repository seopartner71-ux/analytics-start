
DROP TRIGGER IF EXISTS trg_task_lifecycle_chat ON public.crm_tasks;
DROP TRIGGER IF EXISTS trg_crawl_lifecycle_chat ON public.crawl_jobs;
DROP TRIGGER IF EXISTS trg_project_file_chat ON public.project_files;
DROP TRIGGER IF EXISTS trg_project_members_chat_notify ON public.project_members;

DELETE FROM public.project_messages WHERE is_system = true;
