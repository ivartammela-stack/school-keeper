import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

export async function initializePushNotifications(userId: string) {
  if (!Capacitor.isNativePlatform()) {
    logger.info('Push notifications only available on native platforms');
    return;
  }

  try {
    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    
    if (permResult.receive === 'granted') {
      // Register with FCM/APNs
      await PushNotifications.register();
      
      logger.info('Push notifications registered');
    } else {
      logger.warn('Push notification permission denied');
    }

    // On registration success, save token
    await PushNotifications.addListener('registration', async (token) => {
      logger.info('Push registration success, token:', token.value);
      
      // Save token to database
      await supabase
        .from('profiles')
        .update({ push_token: token.value })
        .eq('id', userId);
    });

    // On registration error
    await PushNotifications.addListener('registrationError', (error) => {
      logger.error('Push registration error:', error);
    });

    // On notification received (app in foreground)
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      logger.info('Push notification received:', notification);
      // Show in-app notification if needed
    });

    // On notification tapped (opens app)
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      logger.info('Push notification action performed:', notification);
      // Navigate to relevant screen based on notification data
      const data = notification.notification.data;
      if (data?.ticket_id) {
        // Navigate to ticket detail
        window.location.href = `/my-tickets?ticket=${data.ticket_id}`;
      }
    });

  } catch (error) {
    logger.error('Failed to initialize push notifications', error);
  }
}

export async function unregisterPushNotifications(userId: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Clear token from database
    await supabase
      .from('profiles')
      .update({ push_token: null })
      .eq('id', userId);

    // Unregister from FCM/APNs
    await PushNotifications.removeAllListeners();
    
    logger.info('Push notifications unregistered');
  } catch (error) {
    logger.error('Failed to unregister push notifications', error);
  }
}
