-- Allow all authenticated users with roles to create tickets
DROP POLICY IF EXISTS "Teachers and admin can create tickets" ON public.tickets;
CREATE POLICY "Users with roles can create tickets"
ON public.tickets FOR INSERT
WITH CHECK (
  public.has_any_role(auth.uid())
  AND created_by = auth.uid()
);

-- Restrict maintenance updates to non-safety tickets only
DROP POLICY IF EXISTS "Maintenance can update own or claim tickets" ON public.tickets;
CREATE POLICY "Maintenance can update own or claim tickets"
ON public.tickets FOR UPDATE
USING (
  public.has_role(auth.uid(), 'maintenance')
  AND is_safety_related = false
  AND (
    assigned_to = auth.uid()
    OR (assigned_to IS NULL AND status = 'submitted')
  )
)
WITH CHECK (
  is_safety_related = false
  AND (
    assigned_to = auth.uid()
    OR (assigned_to IS NULL AND status = 'submitted')
  )
);

-- Allow safety officers to claim and update safety-related tickets
DROP POLICY IF EXISTS "Safety officer can verify safety tickets" ON public.tickets;
DROP POLICY IF EXISTS "Safety officer can update safety tickets" ON public.tickets;
CREATE POLICY "Safety officer can update safety tickets"
ON public.tickets FOR UPDATE
USING (
  public.has_role(auth.uid(), 'safety_officer')
  AND is_safety_related = true
  AND (
    assigned_to = auth.uid()
    OR (assigned_to IS NULL AND status = 'submitted')
  )
)
WITH CHECK (
  is_safety_related = true
  AND (
    assigned_to = auth.uid()
    OR (assigned_to IS NULL AND status = 'submitted')
  )
);
