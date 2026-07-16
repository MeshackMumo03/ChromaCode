import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store'; // For storing JWT securely
import { useRouter } from 'expo-router'; // Import useRouter
import { getBaseUrl } from '@/constants/api'; // Import getBaseUrl from centralized file

export interface User {
  _id: string;
  username: string;
  email: string;
  profilePicture: string;
  friends: string[];
  pushToken?: string;
  blockedUsers?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; needsVerification?: boolean; email?: string }>;
  verifyEmail: (email: string, code: string) => Promise<boolean>;
  googleLogin: (userInfo: any) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  updateUser: (newUser: any) => void;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BASE_URL = getBaseUrl(); // Use the centralized getBaseUrl()

export function useAuth() {
  const context = useContext(AuthContext);
  // Return a safe empty state if context is missing (during initialization or if provider missing)
  if (!context) {
    return {
      user: null,
      token: null,
      login: async () => false,
      register: async () => ({ success: false }),
      verifyEmail: async () => false,
      googleLogin: async () => false,
      logout: () => {},
      isLoading: false,
      updateUser: () => {},
      fetchUser: async () => {},
    };
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter(); // Initialize router

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('userToken');
        if (storedToken) {
          setToken(storedToken);
        }
      } catch (error) {
        console.error('Failed to load auth from SecureStore', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStoredAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser({
          _id: data._id,
          username: data.username,
          email: data.email,
          profilePicture: data.profilePicture,
          friends: data.friends,
          pushToken: data.pushToken
        });
        await SecureStore.setItemAsync('userToken', data.token);
        // Use replace immediately without timeout for better UX, or a shorter one
        router.replace('/(tabs)');
        return true;
      } else {
        if (response.status === 401 && data.message && typeof data.message === 'string' && data.message.includes('verify')) {
          router.push({ pathname: '/verify-email', params: { email } });
        }
        console.error('Login failed:', data.message || data.error || data);
        return false;
      }
    } catch (error) {
      console.error('Network error during login:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; needsVerification?: boolean; email?: string }> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (response.status === 201) {
        return { success: true, needsVerification: true, email };
      } else {
        console.error('Registration failed:', data.message || data.error || data);
        return { success: false };
      }
    } catch (error) {
      console.error('Network error during registration:', error);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyEmail = async (email: string, code: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/users/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data);
        await SecureStore.setItemAsync('userToken', data.token);
        router.replace('/(tabs)');
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const googleLogin = async (userInfo: any): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/users/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userInfo),
      });

      const data = await response.json();

      if (response.ok) {
        setToken(data.token);
        setUser(data);
        await SecureStore.setItemAsync('userToken', data.token);
        router.replace('/(tabs)');
        return true;
      } else if (data.needsVerification) {
        // Redirect to verify email screen if backend requires it
        router.push({ pathname: '/verify-email', params: { email: data.email } });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Network error during Google login:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      // Clear all state first
      setToken(null);
      setUser(null);
      await SecureStore.deleteItemAsync('userToken');
      // Force navigation to login
      router.replace('/login');
    } catch (error) {
      console.error('Failed to clear auth from SecureStore', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (newUser: any) => {
    setUser(newUser);
  };

  const fetchUser = async () => {
    if (token) {
      try {
        const response = await fetch(`${BASE_URL}/users/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          // Profile endpoint returns the raw user object usually, 
          // let's ensure it matches our structure.
          setUser(data);
        } else if (response.status === 401) {
          // Token might be invalid, so log out
          logout();
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, register, googleLogin, verifyEmail, logout, isLoading, updateUser, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}
