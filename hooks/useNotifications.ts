/**
 * useNotifications — OTA-safe stub
 *
 * Push notifications (expo-device + expo-notifications) require native code
 * that must be compiled into the binary. They cannot be delivered via OTA update.
 *
 * This stub makes the hook a safe no-op so the JS bundle does not crash on
 * startup. Push notifications will be re-enabled in the next full binary build
 * (EAS Build), at which point the native modules will be present.
 */

export function useNotifications() {
  // No-op: push notification setup is deferred to the next binary build.
  return { expoPushToken: '', notification: undefined };
}
