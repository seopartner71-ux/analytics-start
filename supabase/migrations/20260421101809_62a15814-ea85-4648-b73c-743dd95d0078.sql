CREATE POLICY "Directors view all time logs"
ON public.user_time_logs FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'director'::app_role));