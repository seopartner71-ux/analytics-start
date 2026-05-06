CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{
    "task_assigned": true,
    "task_status_changed": true,
    "task_deadline_soon": true,
    "task_overdue": true,
    "task_any_change": false,
    "task_comment": true,
    "task_mention": true,
    "project_new_task": true,
    "project_any_event": false,
    "audit_complete": true,
    "weekly_report": false,
    "new_employee": false,
    "email_notifications": false
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notification settings"
  ON public.notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notification settings"
  ON public.notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notification settings"
  ON public.notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notification settings"
  ON public.notification_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();