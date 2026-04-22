DROP POLICY IF EXISTS "Admins and directors view all team_members" ON public.team_members;
CREATE POLICY "Admins and directors view active team_members"
ON public.team_members
FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  AND archived_at IS NULL
);

DROP POLICY IF EXISTS "Admins manage all team_members" ON public.team_members;
CREATE POLICY "Admins manage active team_members"
ON public.team_members
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND archived_at IS NULL
)
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Owners manage team_members" ON public.team_members;
CREATE POLICY "Owners manage active team_members"
ON public.team_members
FOR ALL
USING (
  auth.uid() = owner_id
  AND archived_at IS NULL
)
WITH CHECK (auth.uid() = owner_id);