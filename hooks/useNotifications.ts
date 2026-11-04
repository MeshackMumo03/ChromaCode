/**
 * useNotifications — push notifications for new messages.
 *
 * Push needs native code (expo-notifications + expo-device) that only exists
 * in app binaries built after these packages were added. An over-the-air
 * update can reach older binaries that lack it, and in August that crashed
 * the app on start. So nothing here touches expo-notifications until we have
 * confirmed every native module it needs is present; otherwise the hook
 * quietly does nothing and the app keeps working without push.
 */
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { getBaseUrl } from '@/constants/api';
import { useAuth } from './useAuth';

type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');

// Every native module expo-notifications loads when it is imported.
const REQUIRED_NATIVE_MODULES = [
  'ExpoDevice',
  'ExpoPushTokenManager',
  'ExpoNotificationPermissionsModule',
  'ExpoNotificationsHandlerModule',
  'ExpoNotificationsEmitter',
  'ExpoNotificationPresenter',
  'ExpoNotificationScheduler',
  'ExpoNotificationCategoriesModule',
  'ExpoBadgeModule',
  'ExpoBackgroundNotificationTasksModule',
  'NotificationsServerRegistrationModule',
  ...(Platform.OS === 'android' ? ['ExpoNotificationChannelManager', 'ExpoNotificationChannelGroupManager'] : []),
];

export const MESSAGES_CHANNEL_ID = 'messages';

let cached: { Notifications: NotificationsModule; Device: DeviceModule } | null | undefined;

/** Loads expo-notifications only if this binary can run it; null otherwise. */
export function loadNotificationModules() {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS === 'web') return cached;
  // Expo Go has no remote push since SDK 53.
  if (Constants.executionEnvironment === 'storeClient') return cached;
  const missing = REQUIRED_NATIVE_MODULES.filter((name) => !requireOptionalNativeModule(name));
  if (missing.length > 0) {
    console.log('[Notifications] Push unavailable in this build; missing native modules:', missing.join(', '));
    return cached;
  }
  try {
    // Required lazily so older binaries never evaluate these modules.
    const Notifications: NotificationsModule = require('expo-notifications');
    const Device: DeviceModule = require('expo-device');
    cached = { Notifications, Device };
  } catch (error) {
    console.warn('[Notifications] Could not load expo-notifications:', error);
  }
  return cached;
}

/** Saves (or clears, with '') this device's push token for the logged-in user. */
export async function savePushToken(authToken: string, pushToken: string) {
  const response = await fetch(`${getBaseUrl()}/users/push-token`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ pushToken }),
  });
  if (!response.ok) throw new Error(`Saving push token failed (${response.status})`);
}

async function registerForPush(modules: NonNullable<typeof cached>): Promise<string | null> {
  const { Notifications, Device } = modules;
  if (!Device.isDevice) return null; // Emulators/simulators can't receive remote push.

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      showBadge: true,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return data;
}

export function useNotifications() {
  const { token } = useAuth();
  const router = useRouter();
  const [expoPushToken, setExpoPushToken] = useState('');
  const handledResponseIds = useRef(new Set<string>());

  // Foreground behaviour + opening the right chat when a notification is tapped.
  useEffect(() => {
    const modules = loadNotificationModules();
    if (!modules) return;
    const { Notifications } = modules;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const openChat = (response: import('expo-notifications').NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledResponseIds.current.has(id)) return;
      handledResponseIds.current.add(id);
      const conversationId = response.notification.request.content.data?.conversationId;
      if (typeof conversationId === 'string' && conversationId) {
        router.push(`/chat/${conversationId}` as any);
      }
    };

    // Tapped while the app was closed.
    Notifications.getLastNotificationResponseAsync().then(openChat).catch(() => {});
    // Tapped while the app was running or in the background.
    const sub = Notifications.addNotificationResponseReceivedListener(openChat);
    return () => sub.remove();
  }, [router]);

  // Register this device's push token whenever someone logs in.
  useEffect(() => {
    if (!token) return;
    const modules = loadNotificationModules();
    if (!modules) return;
    let cancelled = false;

    registerForPush(modules)
      .then(async (pushToken) => {
        if (cancelled || !pushToken) return;
        await savePushToken(token, pushToken);
        setExpoPushToken(pushToken);
      })
      .catch((error) => console.warn('[Notifications] Registration failed:', error));

    // The OS can rotate the token; keep the server's copy current.
    const tokenSub = modules.Notifications.addPushTokenListener(() => {
      registerForPush(modules)
        .then(async (pushToken) => {
          if (pushToken) await savePushToken(token, pushToken);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      tokenSub.remove();
    };
  }, [token]);

  return { expoPushToken, notification: undefined };
}
