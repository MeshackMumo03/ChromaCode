import { useState, useEffect, useRef } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuth } from './useAuth';
import { getBaseUrl } from '@/constants/api';

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const { token, user } = useAuth();
  const BASE_URL = getBaseUrl();

  useEffect(() => {
    // Remote notifications are completely unsupported in Expo Go for Android SDK 53+
    // Any call to Notifications.X will likely trigger the red error box.
    if (Constants.appOwnership === 'expo') {
      console.log('useNotifications: Detected Expo Go. Disabling push notification logic.');
      return;
    }

    // Set handler only if not in Expo Go
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });

    if (token && user) {
      registerForPushNotificationsAsync().then(async (pushToken) => {
        if (pushToken) {
          setExpoPushToken(pushToken);
          // Send token to backend
          try {
            await fetch(`${BASE_URL}/users/push-token`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ pushToken }),
            });
          } catch (error) {
            console.error('Error sending push token to backend:', error);
          }
        }
      });

      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        setNotification(notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response received:', response);
      });

      return () => {
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      };
    }
  }, [token, user]);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync() {
  // Remote notifications are not supported in Expo Go for SDK 53+
  if (Constants.appOwnership === 'expo') {
    return null;
  }

  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Remote notifications are not supported in Expo Go for SDK 53+
  if (Constants.appOwnership === 'expo') {
    console.log('Push notifications are not supported in Expo Go. Use a development build.');
    return;
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    // Note: You might need your Expo Project ID here if you have one
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
