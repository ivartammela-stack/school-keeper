import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { savePushToken, deletePushToken } from './firestore';
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
      logger.info(`Push registration success, token: ${token.value?.substring(0, 20)}...`);

      if (!token.value) {
        logger.error('Push token is empty!');
        return;
      }

      // Save token to Firestore
      const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
      try {
        await savePushToken({
          user_id: userId,
          token: token.value,
          platform,
          browser: null,
        });
        logger.info('Push token saved successfully');
      } catch (error) {
        logger.error('Failed to save push token', error);
      }
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
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('Push init error:', err?.message || err?.code || JSON.stringify(error));
    logger.error('Failed to initialize push notifications', error);
  }
}

export async function unregisterPushNotifications(userId: string, token?: string) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Clear token from Firestore
    if (token) {
      await deletePushToken(userId, token);
    }

    // Unregister from FCM/APNs
    await PushNotifications.removeAllListeners();

    logger.info('Push notifications unregistered');
  } catch (error) {
    logger.error('Failed to unregister push notifications', error);
  }
}
