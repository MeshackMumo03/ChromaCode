import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Code } from '@/constants/codes'; // We'll still use the Code interface from here
import { useAuth } from './useAuth'; // Assuming useAuth is in the same directory

interface CodesContextType {
  codes: Code[];
  isLoading: boolean;
  error: string | null;
  fetchCodes: () => Promise<void>;
  createCode: (name: string, color: string, meaning: string) => Promise<boolean>;
  updateCode: (id: string, name: string, color: string, meaning: string) => Promise<boolean>;
  deleteCode: (id: string) => Promise<boolean>;
}

const CodesContext = createContext<CodesContextType | undefined>(undefined);

import Constants from 'expo-constants';

const getBaseUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const parts = hostUri.split(':');
    const hostname = parts[0];
    return `http://${hostname}:5000/api`;
  }
  return `http://localhost:5000/api`;
};

const BASE_URL = getBaseUrl();

export function useCodes() {
  const context = useContext(CodesContext);
  if (!context) {
    throw new Error('useCodes must be used within a CodesProvider');
  }
  return context;
}

export function CodesProvider({ children }: { children: ReactNode }) {
  const [codes, setCodes] = useState<Code[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchCodes = async () => {
    setIsLoading(true);
    setError(null);
    if (!token) {
      setCodes([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/codes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: Code[] = await response.json();
      setCodes(data);
    } catch (err: any) {
      setError(err.message);
      setCodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const createCode = async (name: string, color: string, meaning: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    if (!token) {
      setIsLoading(false);
      return false;
    }

    try {
      const response = await fetch(`${BASE_URL}/codes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, color, meaning }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }

      await fetchCodes(); // Refresh codes after creation
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCode = async (id: string, name: string, color: string, meaning: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    if (!token) {
      setIsLoading(false);
      return false;
    }

    try {
      const response = await fetch(`${BASE_URL}/codes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name, color, meaning }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }

      await fetchCodes(); // Refresh codes after update
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCode = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    if (!token) {
      setIsLoading(false);
      return false;
    }

    try {
      const response = await fetch(`${BASE_URL}/codes/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `HTTP error! status: ${response.status}`);
      }

      await fetchCodes(); // Refresh codes after deletion
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, [token]);

  return (
    <CodesContext.Provider value={{ codes, isLoading, error, fetchCodes, createCode, updateCode, deleteCode }}>
      {children}
    </CodesContext.Provider>
  );
}
