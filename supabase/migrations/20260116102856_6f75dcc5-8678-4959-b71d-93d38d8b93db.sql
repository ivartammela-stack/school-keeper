-- Create a helper function to check if user can access a ticket (for storage policies)
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
      -- Ticket creator can access
      t.created_by = auth.uid()
      -- Admin and leadership can access all
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'leadership'::app_role)
      -- Maintenance can access assigned or open tickets
      OR (has_role(auth.uid(), 'maintenance'::app_role) AND (t.assigned_to = auth.uid() OR t.status IN ('submitted', 'in_progress')))
      -- Safety officer can access safety-related tickets
      OR (has_role(auth.uid(), 'safety_officer'::app_role) AND t.is_safety_related = true)
    )
  )
$$;

-- Drop existing permissive storage policies on ticket-images bucket if any
DROP POLICY IF EXISTS "Authenticated users can upload ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view ticket images" ON storage.objects;

-- Create secure storage policies that verify ticket access
-- Images must be stored in format: {ticket_id}/{filename}

-- Policy for viewing images - verify ticket access
CREATE POLICY "Users can view images from accessible tickets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-images' 
  AND can_access_ticket((storage.foldername(name))[1]::uuid)
);

-- Policy for uploading images - verify ticket access
CREATE POLICY "Users can upload images to accessible tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-images' 
  AND can_access_ticket((storage.foldername(name))[1]::uuid)
);

-- Policy for deleting images - only admin or ticket creator
CREATE POLICY "Users can delete images from their tickets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-images' 
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = (storage.foldername(name))[1]::uuid
      AND t.created_by = auth.uid()
    )
  )
);