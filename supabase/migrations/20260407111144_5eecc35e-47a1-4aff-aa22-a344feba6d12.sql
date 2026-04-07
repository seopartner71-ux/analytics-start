
ALTER TABLE public.site_health
  ADD CONSTRAINT site_health_project_source_metric_unique
  UNIQUE (project_id, source, metric_name);
