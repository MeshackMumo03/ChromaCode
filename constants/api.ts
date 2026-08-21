import Constants from "expo-constants";

let _baseUrl: string | null = null;

export const getBaseUrl = (): string => {
  if (_baseUrl) return _baseUrl;

  // 1. Prioritize environment variable set during build/runtime
  if (process.env.EXPO_PUBLIC_API_URL) {
    _baseUrl = process.env.EXPO_PUBLIC_API_URL;
    return _baseUrl;
  }

  // 2. Fallback for Expo Go development (dynamic IP/tunnel)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const parts = hostUri.split(":");
    const hostname = parts[0];
    // This is the key for physical devices! 
    // It points to your computer's IP instead of 'localhost'
    _baseUrl = `http://${hostname}:5000/api`;
    return _baseUrl;
  }

  // 3. Fallback for web or if no other URL is found
  _baseUrl = `https://chromacode.onrender.com/api`;
  return _baseUrl;
};

const imageUrlCache = new Map<string, string>();
const MAX_IMAGE_URL_CACHE = 500;

const setImageUrlCache = (key: string, value: string) => {
  if (imageUrlCache.size >= MAX_IMAGE_URL_CACHE) {
    const firstKey = imageUrlCache.keys().next().value;
    if (firstKey) imageUrlCache.delete(firstKey);
  }
  imageUrlCache.set(key, value);
};

export const getImageUrl = (url?: string): string => {
  const raw = url ?? '';
  const cacheKey = raw.trim();
  if (imageUrlCache.has(cacheKey)) {
    return imageUrlCache.get(cacheKey)!;
  }

  if (!url || typeof url !== 'string' || !url.trim()) {
    const fallback = 'https://www.gravatar.com/avatar/?d=mp';
    setImageUrlCache(cacheKey, fallback);
    return fallback;
  }

  let cleaned = url.trim().replace(/\\/g, '/');

  // Fix double prepended URLs like https://server.comhttps://res.cloudinary.com/...
  const lastHttp = cleaned.lastIndexOf('http://');
  const lastHttps = cleaned.lastIndexOf('https://');
  const lastHttpIndex = Math.max(lastHttp, lastHttps);
  if (lastHttpIndex > 0) {
    cleaned = cleaned.substring(lastHttpIndex);
  }

  const baseUrl = getBaseUrl().replace('/api', '');
  let result: string;

  // Handle server local uploads (/uploads/...)
  if (cleaned.includes('/uploads/')) {
    const relativePath = cleaned.substring(cleaned.indexOf('/uploads/'));
    result = `${baseUrl}${relativePath}`;
  } else if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    // Return direct external URLs (Cloudinary, Gravatar, Google, etc.)
    result = cleaned;
  } else {
    // Fallback relative URL
    result = `${baseUrl}${cleaned.startsWith('/') ? '' : '/'}${cleaned}`;
  }

  setImageUrlCache(cacheKey, result);
  return result;
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

const parseResponse = async (res: Response) => {
  const contentType = res.headers.get('content-type');
  let data: any;

  if (contentType?.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    data = text;
  }

  if (!res.ok) {
    const message = typeof data === 'object' && data?.message ? data.message : data;
    throw new Error(message || `Request failed with status ${res.status}`);
  }

  return { data, status: res.status };
};

const buildHeaders = (body: any, extraHeaders?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (_authToken) headers.Authorization = `Bearer ${_authToken}`;
  if (extraHeaders) Object.assign(headers, extraHeaders);

  // Only set JSON content type for non-binary bodies
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
};

const request = async (method: string, path: string, body?: any, options?: { headers?: Record<string, string> }) => {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: buildHeaders(body, options?.headers),
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  return parseResponse(res);
};

export const api = {
  get: (path: string, options?: { headers?: Record<string, string> }) =>
    request('GET', path, undefined, options),
  post: (path: string, body?: any, options?: { headers?: Record<string, string> }) =>
    request('POST', path, body, options),
  put: (path: string, body?: any, options?: { headers?: Record<string, string> }) =>
    request('PUT', path, body, options),
  delete: (path: string, options?: { headers?: Record<string, string> }) =>
    request('DELETE', path, undefined, options),
};
