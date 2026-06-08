CREATE POLICY "Authenticated users view active team_members"
ON public.team_members
FOR SELECT
TO authenticated
USING (archived_at IS NULL);