import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { getMessaging, getToken, isSupported as isMessagingSupported, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';
import { savePushToken } from '@/lib/firestore';
import { onAuthChange } from '@/lib/firebase-auth';
import { app } from '@/lib/firebase';

const registerTokenWithBackend = async (
  token: string,
  platform: 'android' | 'ios' | 'web',
  userId: string
) => {
  try {
    await savePushToken({
      user_id: userId,
      token,
      platform,
    });
    console.log('Push token registered with backend');
  } catch (error) {
    console.error('Failed to register push token:', error);
  }
};

const getPlatform = (): 'android' | 'ios' | 'web' => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'android';
  if (platform === 'ios') return 'ios';
  return 'web';
};

export const usePushNotifications = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const webListenerReady = useRef(false);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setUserId(user?.uid || null);
    });
    return () => unsubscribe();
  }, []);

  // Register token when we have both token and userId
  useEffect(() => {
    if (!token || !userId) return;

    registerTokenWithBackend(token, getPlatform(), userId);
  }, [token, userId]);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    setIsSupported(isNative);

    if (!isNative) {
      const setupWebPush = async () => {
        if (!app) return;
        const supported = await isMessagingSupported();
        if (!supported || !('serviceWorker' in navigator)) {
          console.log('Push notifications not supported on web');
          return;
        }
        setIsSupported(true);

        if (Notification.permission === 'granted') {
          await registerWebPush(false);
        }
      };

      void setupWebPush();
      return;
    }

    const registerPush = async () => {
      try {
        // Request permission
        const permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          const result = await PushNotifications.requestPermissions();
          if (result.receive !== 'granted') {
            console.log('Push notification permission denied');
            return;
          }
        } else if (permStatus.receive !== 'granted') {
          console.log('Push notification permission not granted');
          return;
        }

        // Register for push notifications
        await PushNotifications.register();
      } catch (error) {
        console.error('Error registering for push notifications:', error);
      }
    };

    // Add listeners
    const setupListeners = async () => {
      // On registration success
      await PushNotifications.addListener(
        'registration',
        async (tokenData: Token) => {
          console.log('Push registration success');
          setToken(tokenData.value);

          // Register token with backend if we have userId
          if (userId) {
            const platform = getPlatform();
            await registerTokenWithBackend(tokenData.value, platform, userId);
          }
        }
      );

      // On registration error
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      // On push notification received (foreground)
      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.log('Push notification received:', notification);
          toast(notification.title || 'Teavitus', {
            description: notification.body,
          });
        }
      );

      // On push notification action performed (user tapped notification)
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (action: ActionPerformed) => {
          console.log('Push notification action performed:', action);
          // Handle navigation based on action.notification.data
          const data = action.notification.data;
          if (data?.ticketId) {
            // Navigate to ticket
            window.location.href = `/my-tickets`;
          }
        }
      );
    };

    setupListeners();
    registerPush();

    // Cleanup listeners on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [userId]);

  const registerWebPush = async (forcePrompt: boolean) => {
    if (!app) return false;
    const supported = await isMessagingSupported();
    if (!supported || !('serviceWorker' in navigator)) return false;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
    if (!vapidKey) {
      toast.error('VAPID võti puudub');
      return false;
    }

    if (Notification.permission !== 'granted') {
      if (!forcePrompt) return false;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('Push teavitused keelatud');
        return false;
      }
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    const webToken = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (webToken) {
      setToken(webToken);
      if (userId) {
        await registerTokenWithBackend(webToken, 'web', userId);
      }
    }

    if (!webListenerReady.current) {
      onMessage(messaging, (payload) => {
        toast(payload.notification?.title || 'Teavitus', {
          description: payload.notification?.body,
        });
      });
      webListenerReady.current = true;
    }

    return true;
  };

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Push teavitused pole toetatud');
      return false;
    }

    if (!Capacitor.isNativePlatform()) {
      try {
        const ok = await registerWebPush(true);
        if (ok) {
          toast.success('Push teavitused lubatud!');
        }
        return ok;
      } catch (error) {
        console.error('Error requesting web push permission:', error);
        toast.error('Viga teavituste lubamisel');
        return false;
      }
    }

    try {
      const result = await PushNotifications.requestPermissions();
      if (result.receive === 'granted') {
        await PushNotifications.register();
        toast.success('Push teavitused lubatud!');
        return true;
      } else {
        toast.error('Push teavitused keelatud');
        return false;
      }
    } catch (error) {
      console.error('Error requesting push permission:', error);
      toast.error('Viga teavituste lubamisel');
      return false;
    }
  };

  return {
    token,
    isSupported,
    requestPermission,
  };
};
