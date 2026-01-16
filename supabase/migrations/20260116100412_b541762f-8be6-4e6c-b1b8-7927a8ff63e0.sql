-- Add DELETE policy for tickets table to allow only admins to delete tickets
CREATE POLICY "Admin can delete tickets"
ON public.tickets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));