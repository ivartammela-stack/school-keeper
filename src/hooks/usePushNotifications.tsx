import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const registerTokenWithBackend = async (token: string, platform: 'android' | 'ios' | 'web') => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.log('No session, skipping token registration');
      return;
    }

    const { data, error } = await supabase.functions.invoke('register-push-token', {
      body: { token, platform },
    });

    if (error) {
      console.error('Error registering push token with backend:', error);
      return;
    }

    console.log('Push token registered with backend:', data);
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

  useEffect(() => {
    const isPushSupported = Capacitor.isNativePlatform();
    setIsSupported(isPushSupported);

    if (!isPushSupported) {
      console.log('Push notifications not supported on web');
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
      await PushNotifications.addListener('registration', async (tokenData: Token) => {
        console.log('Push registration success, token:', tokenData.value);
        setToken(tokenData.value);
        
        // Register token with backend
        const platform = getPlatform();
        await registerTokenWithBackend(tokenData.value, platform);
      });

      // On registration error
      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      // On push notification received (foreground)
      await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);
        toast(notification.title || 'Teavitus', {
          description: notification.body,
        });
      });

      // On push notification action performed (user tapped notification)
      await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Push notification action performed:', action);
        // Handle navigation based on action.notification.data
        const data = action.notification.data;
        if (data?.ticketId) {
          // Navigate to ticket - this will depend on your routing setup
          window.location.href = `/my-tickets`;
        }
      });
    };

    setupListeners();
    registerPush();

    // Cleanup listeners on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Push teavitused pole toetatud veebibrauseris');
      return false;
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
