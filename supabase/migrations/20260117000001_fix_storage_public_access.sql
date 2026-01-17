-- Fix storage bucket access for public images
-- Remove all existing storage policies for ticket-images
DROP POLICY IF EXISTS "Users can upload images to their tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can view images of accessible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploaded images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view images from accessible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload images to accessible tickets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete images from their tickets" ON storage.objects;
DROP POLICY IF EXISTS "Demo: anon can view ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Demo: anon can upload ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Demo: anon can delete ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload ticket images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their uploaded ticket images" ON storage.objects;

-- Ensure bucket is public
UPDATE storage.buckets
SET public = true
WHERE id = 'ticket-images';

-- Create simple policies for public bucket
-- Anyone can view images (public bucket)
CREATE POLICY "Public read access for ticket images"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-images');

-- Authenticated users can upload images
CREATE POLICY "Authenticated users can upload ticket images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-images' AND
  auth.uid() IS NOT NULL
);

-- Users can delete their own uploaded images (folder name = user id)
CREATE POLICY "Users can delete their uploaded ticket images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ticket-images' AND
  (
    has_role(auth.uid(), 'admin'::app_role) OR
    (storage.foldername(name))[1] = auth.uid()::text
  )
);
