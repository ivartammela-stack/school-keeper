import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

export async function setupStorage() {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      logger.error('Failed to list buckets', listError);
      return false;
    }

    const bucketExists = buckets?.some(b => b.id === 'ticket-images');
    
    if (!bucketExists) {
      // Create bucket as public
      const { error: createError } = await supabase.storage.createBucket('ticket-images', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
      });
      
      if (createError) {
        logger.error('Failed to create bucket', createError);
        return false;
      }
      
      logger.info('Storage bucket created successfully');
    } else {
      // Update existing bucket to be public
      const { error: updateError } = await supabase.storage.updateBucket('ticket-images', {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
      });
      
      if (updateError) {
        logger.error('Failed to update bucket', updateError);
        // Continue anyway, might not have permissions
      } else {
        logger.info('Storage bucket updated to public');
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Storage setup failed', error);
    return false;
  }
}
