CREATE POLICY "Admins and directors view all team_members"
ON public.team_members FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Admins manage all team_members"
ON public.team_members FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));