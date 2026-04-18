CREATE OR REPLACE FUNCTION public.claim_next_crawl_job()
RETURNS TABLE(id uuid, url text, project_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  picked_id uuid;
BEGIN
  SELECT j.id INTO picked_id
  FROM public.crawl_jobs j
  WHERE j.status = 'pending'
  ORDER BY j.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF picked_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.crawl_jobs
  SET status = 'running',
      started_at = now(),
      progress = 0
  WHERE crawl_jobs.id = picked_id;

  RETURN QUERY
  SELECT j.id, j.url, j.project_id
  FROM public.crawl_jobs j
  WHERE j.id = picked_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_crawl_job() FROM PUBLIC, anon, authenticated;