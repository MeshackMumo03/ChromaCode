import Constants from 'expo-constants';

export const getBaseUrl = (): string => {
  // 1. Prioritize environment variable set during build/runtime
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Fallback for Expo Go development (dynamic IP/tunnel)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const parts = hostUri.split(':');
    const hostname = parts[0];
    return `http://${hostname}:5000/api`;
  }

  // 3. Fallback for web or if no other URL is found (development on same machine)
  return `http://localhost:5000/api`;
};