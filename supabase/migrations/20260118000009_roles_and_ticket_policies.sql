-- Map ticket priority to required role
CREATE OR REPLACE FUNCTION public.required_role_for_priority(_priority integer)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _priority = 1 THEN 'teacher'::public.app_role
    WHEN _priority = 2 THEN 'safety_officer'::public.app_role
    WHEN _priority = 3 THEN 'director'::public.app_role
    WHEN _priority = 4 THEN 'worker'::public.app_role
    WHEN _priority = 5 THEN 'facility_manager'::public.app_role
    ELSE 'teacher'::public.app_role
  END;
$$;

CREATE INDEX IF NOT EXISTS tickets_priority_idx ON public.tickets (priority);
CREATE INDEX IF NOT EXISTS user_roles_user_id_role_idx ON public.user_roles (user_id, role);

-- Update ticket access helper to new roles (used by storage policies)
CREATE OR REPLACE FUNCTION public.can_access_ticket(_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = _ticket_id
    AND (
      t.created_by = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'director'::app_role)
      OR ((has_role(auth.uid(), 'worker'::app_role) OR has_role(auth.uid(), 'facility_manager'::app_role)) AND (t.assigned_to = auth.uid() OR t.status IN ('submitted', 'in_progress')))
      OR (has_role(auth.uid(), 'safety_officer'::app_role) AND t.is_safety_related = true)
    )
  )
$$;

-- Replace legacy ticket select policies tied to old roles
DROP POLICY IF EXISTS "Admin and leadership can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Maintenance can view assigned or open tickets" ON public.tickets;
DROP POLICY IF EXISTS "Safety officer can view safety tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.tickets;

-- Replace legacy ticket update policies
DROP POLICY IF EXISTS "Maintenance can update own or claim tickets" ON public.tickets;
DROP POLICY IF EXISTS "Safety officer can update safety tickets" ON public.tickets;

CREATE POLICY "Roles can claim or update tickets by priority"
ON public.tickets FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
  OR (
    assigned_to IS NULL
    AND status = 'submitted'
    AND public.has_role(auth.uid(), public.required_role_for_priority(priority))
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR assigned_to = auth.uid()
);

-- Replace legacy ticket_comments policies tied to old roles
DROP POLICY IF EXISTS "Users can view comments on accessible tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "Users can add comments to accessible tickets" ON public.ticket_comments;

CREATE POLICY "Users can view comments on accessible tickets"
ON public.ticket_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND (
      t.created_by = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'director') OR
      ((public.has_role(auth.uid(), 'worker') OR public.has_role(auth.uid(), 'facility_manager')) AND (t.assigned_to = auth.uid() OR t.status IN ('submitted', 'in_progress'))) OR
      (public.has_role(auth.uid(), 'safety_officer') AND t.is_safety_related = true)
    )
  )
);

CREATE POLICY "Users can add comments to accessible tickets"
ON public.ticket_comments FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND (
      t.created_by = auth.uid() OR
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'director') OR
      ((public.has_role(auth.uid(), 'worker') OR public.has_role(auth.uid(), 'facility_manager')) AND (t.assigned_to = auth.uid() OR t.status IN ('submitted', 'in_progress'))) OR
      (public.has_role(auth.uid(), 'safety_officer') AND t.is_safety_related = true)
    )
  )
);

-- Replace legacy audit_log policies tied to old roles
DROP POLICY IF EXISTS "Admin and leadership can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Admin and leadership can view audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Maintenance can view audit logs for their tickets" ON public.audit_log;

CREATE POLICY "Admin and director can view all audit logs"
ON public.audit_log FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'director')
);

CREATE POLICY "Workers can view audit logs for their tickets"
ON public.audit_log FOR SELECT
USING (
  (public.has_role(auth.uid(), 'worker') OR public.has_role(auth.uid(), 'facility_manager')) AND
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND t.assigned_to = auth.uid()
  )
);

-- Replace legacy statistics policies tied to old roles
DROP POLICY IF EXISTS "Admin and leadership can view statistics" ON public.ticket_statistics_daily;

CREATE POLICY "Admin and director can view statistics"
ON public.ticket_statistics_daily FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'director')
);
