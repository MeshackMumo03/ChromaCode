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
  if (!url || typeof url !== 'string' || !url.trim()) {
    return 'https://www.gravatar.com/avatar/?d=mp';
  }

  let cleaned = url.trim().replace(/\\/g, '/');

  // Fix double prepended URLs like https://server.comhttps://res.cloudinary.com/...
  const lastHttp = cleaned.lastIndexOf('http://');
  const lastHttps = cleaned.lastIndexOf('https://');
  const lastHttpIndex = Math.max(lastHttp, lastHttps);
  if (lastHttpIndex > 0) {
    cleaned = cleaned.substring(lastHttpIndex);
  }

  // Handle server local uploads (/uploads/...)
  if (cleaned.includes('/uploads/')) {
    const relativePath = cleaned.substring(cleaned.indexOf('/uploads/'));
    const baseUrl = getBaseUrl().replace('/api', '');
    return `${baseUrl}${relativePath}`;
  }

  // Return direct external URLs (Cloudinary, Gravatar, Google, etc.)
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }

  // Fallback relative URL
  const baseUrl = getBaseUrl().replace('/api', '');
  return `${baseUrl}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
};

/**
 * Generates a static JPEG thumbnail URL for a Cloudinary-hosted video.
 * For non-Cloudinary videos the video URL itself is returned as a best-effort
 * (React Native <Image> will fail silently, which is the same as before).
 */
export const getVideoThumbnailUrl = (videoUrl?: string): string => {
  const url = getImageUrl(videoUrl);
  if (url.includes('res.cloudinary.com')) {
    // Swap resource type and strip to a JPEG frame at second 0
    return url
      .replace('/video/upload/', '/video/upload/so_0/')
      .replace(/\.(mp4|mov|avi|mkv|webm)(\?.*)?$/i, '.jpg');
  }
  // Fallback: return the raw URL and hope the OS can generate a preview
  return url;
};

/**
 * Returns the avatar URL for a group conversation.
 * Falls back to a generic group icon (not Gravatar) when no image is set.
 */
export const getGroupImageUrl = (groupImage?: string): string => {
  if (!groupImage || !groupImage.trim()) {
    return 'https://cdn-icons-png.flaticon.com/512/166/166258.png';
  }
  return getImageUrl(groupImage);
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
