import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

export type TicketNotificationType = 'created' | 'updated' | 'assigned' | 'resolved' | 'verified' | 'closed';

export async function sendTicketNotification(ticketId: string, type: TicketNotificationType) {
  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { ticketId, notificationType: type },
    });

    if (error) {
      logger.warn('Failed to send ticket push notification', error);
    }
  } catch (error) {
    logger.warn('Failed to send ticket push notification', error);
  }
}

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
      logger.info(`Push registration success, token: ${token.value}`);
      
      // Save token to push_tokens table
      const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
      await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token: token.value,
          platform: platform,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,token' });
    });

    // On registration error
    await PushNotifications.addListener('registrationError', (error) => {
      logger.error(`Push registration error: ${JSON.stringify(error)}`);
    });

    // On notification received (app in foreground)
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      logger.info(`Push notification received: ${JSON.stringify(notification)}`);
      // Show in-app notification if needed
    });

    // On notification tapped (opens app)
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      logger.info(`Push notification action performed: ${JSON.stringify(notification)}`);
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
    // Clear tokens from database
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId);

    // Unregister from FCM/APNs
    await PushNotifications.removeAllListeners();
    
    logger.info('Push notifications unregistered');
  } catch (error) {
    logger.error('Failed to unregister push notifications', error);
  }
}
