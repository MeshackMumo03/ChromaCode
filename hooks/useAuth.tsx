import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store'; // For storing JWT securely
import { useRouter } from 'expo-router'; // Import useRouter

interface AuthContextType {
  user: any; // Ideally, define a User interface
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  updateUser: (newUser: any) => void; // Add this
  fetchUser: () => Promise<void>; // Add this
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import Constants from 'expo-constants'; // Import Constants

// Dynamically determine BASE_URL
const getBaseUrl = () => {
  // Constants.expoConfig?.hostUri example: 192.168.1.100:8081 or tunnel.expo.dev:80
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const parts = hostUri.split(':');
    const hostname = parts[0]; // Get the IP address or tunnel domain
    return `http://${hostname}:5000/api`;
  }
  // Fallback for web or if hostUri is not available
  return `http://localhost:5000/api`;
};

const BASE_URL = getBaseUrl(); // Call the function to get the BASE_URL

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { ReactNode }) {
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
          // In a real app, you'd verify the token with the backend or decode it
          // to get user info. For now, we'll just assume token validity.
          // You might also fetch user profile here.
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

      // Try to parse JSON, fall back to text for diagnostics
      let data: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response during login:', text);
        return false;
      }

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        await SecureStore.setItemAsync('userToken', data.token);
        router.replace('/(tabs)'); // Navigate to main app
        return true;
      } else {
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

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      // Try to parse JSON, fall back to text for diagnostics
      let data: any;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response during registration:', text);
        return false;
      }

      if (response.ok) {
        setToken(data.token);
        setUser(data.user);
        await SecureStore.setItemAsync('userToken', data.token);
        router.replace('/(tabs)'); // Navigate to main app
        return true;
      } else {
        console.error('Registration failed:', data.message || data.error || data);
        return false;
      }
    } catch (error) {
      console.error('Network error during registration:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setToken(null);
      setUser(null);
      await SecureStore.deleteItemAsync('userToken');
    } catch (error) {
      console.error('Failed to clear auth from SecureStore', error);
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
          setUser(data);
        } else {
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
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading, updateUser, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}
