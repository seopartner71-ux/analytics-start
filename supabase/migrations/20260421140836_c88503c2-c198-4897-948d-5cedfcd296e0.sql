-- Speed up frequent dashboard queries
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assignee ON public.crm_tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_project ON public.crm_tasks(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_owner ON public.crm_tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_integrations_project ON public.integrations(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date_paid ON public.invoices(date_paid) WHERE date_paid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON public.bank_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_checks_project ON public.audit_checks(project_id);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_stats_project_date ON public.gsc_daily_stats(project_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_metrika_stats_project ON public.metrika_stats(project_id, date_to DESC);