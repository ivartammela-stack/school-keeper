-- Allow any authenticated user with a role to view their own tickets
DROP POLICY IF EXISTS "Teachers can view their own tickets" ON public.tickets;
CREATE POLICY "Users can view their own tickets"
ON public.tickets FOR SELECT
USING (
  public.has_any_role(auth.uid())
  AND created_by = auth.uid()
);
