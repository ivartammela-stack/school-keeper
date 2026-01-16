-- Make ticket-images bucket public for easier access from mobile apps
UPDATE storage.buckets SET public = true WHERE id = 'ticket-images';