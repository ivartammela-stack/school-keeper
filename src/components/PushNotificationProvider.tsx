import { useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface PushNotificationProviderProps {
  children: React.ReactNode;
}

export const PushNotificationProvider = ({ children }: PushNotificationProviderProps) => {
  const { token, isSupported } = usePushNotifications();

  useEffect(() => {
    if (token) {
      console.log('Device push token ready:', token);
      // TODO: Send token to your backend to store for sending notifications
    }
  }, [token]);

  useEffect(() => {
    if (isSupported) {
      console.log('Push notifications are supported on this device');
    }
  }, [isSupported]);

  return <>{children}</>;
};
