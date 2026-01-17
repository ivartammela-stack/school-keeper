-- Users can view their own tickets (no role required)
CREATE POLICY "Users can view their own tickets"
ON public.tickets FOR SELECT
USING (created_by = auth.uid());

-- Admin and director can view all tickets
CREATE POLICY "Admin and director can view all tickets"
ON public.tickets FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'director')
);

-- Workers can view assigned or open tickets (non-safety)
CREATE POLICY "Workers can view assigned or open tickets"
ON public.tickets FOR SELECT
USING (
  (public.has_role(auth.uid(), 'worker') OR public.has_role(auth.uid(), 'facility_manager'))
  AND is_safety_related = false
  AND (assigned_to = auth.uid() OR status IN ('submitted', 'in_progress'))
);

-- Safety officer can view safety tickets
CREATE POLICY "Safety officer can view safety tickets"
ON public.tickets FOR SELECT
USING (
  public.has_role(auth.uid(), 'safety_officer')
  AND is_safety_related = true
);
