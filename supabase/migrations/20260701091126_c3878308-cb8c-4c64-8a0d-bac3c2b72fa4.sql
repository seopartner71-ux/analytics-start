GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_news TO authenticated;
GRANT ALL ON public.company_news TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_news_reads TO authenticated;
GRANT ALL ON public.company_news_reads TO service_role;