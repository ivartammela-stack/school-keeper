-- Make ticket-images bucket private and enforce RLS-based access
UPDATE storage.buckets
SET public = false
WHERE id = 'ticket-images';

DROP POLICY IF EXISTS "Public read access for ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their uploaded ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view images from accessible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload images to accessible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete images from their tickets" ON storage.objects;

CREATE POLICY "Users can view images from accessible tickets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-images'
  AND can_access_ticket((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Users can upload images to accessible tickets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-images'
  AND can_access_ticket((storage.foldername(name))[1]::uuid)
);

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
