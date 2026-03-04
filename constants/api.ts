import Constants from "expo-constants";

export const getBaseUrl = (): string => {
  // 1. Prioritize environment variable set during build/runtime
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Fallback for Expo Go development (dynamic IP/tunnel)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const parts = hostUri.split(":");
    const hostname = parts[0];
    // This is the key for physical devices! 
    // It points to your computer's IP instead of 'localhost'
    return `http://${hostname}:5000/api`;
  }

  // 3. Fallback for web or if no other URL is found
  return `https://chromacode.onrender.com/api`;
};
