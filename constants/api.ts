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

export const getImageUrl = (url?: string): string => {
  if (!url) return 'https://www.gravatar.com/avatar/?d=mp';
  if (url.startsWith('http')) return url;
  const normalizedUrl = url.replace(/\\/g, '/');
  const baseUrl = getBaseUrl().replace('/api', '');
  return `${baseUrl}${normalizedUrl.startsWith('/') ? '' : '/'}${normalizedUrl}`;
};

// Lightweight fetch-based API client (replaces axios, no extra dependency needed)
let _authToken: string | null = null;

export const setApiToken = (token: string | null) => {
  _authToken = token;
};

export const api = {
  get: async (path: string, options?: { headers?: Record<string, string> }) => {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(_authToken ? { Authorization: `Bearer ${_authToken}` } : {}),
        ...(options?.headers ?? {}),
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Request failed');
    return { data };
  },
  post: async (path: string, body?: any, options?: { headers?: Record<string, string> }) => {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(_authToken ? { Authorization: `Bearer ${_authToken}` } : {}),
        ...(options?.headers ?? {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Request failed');
    return { data };
  },
};
