import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Code } from '@/constants/codes';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth

export interface HistoryItem {
  _id: string;
  code: Code;
  timestamp: string;
  conversationId?: string;
  recipient?: {
    _id: string;
    username: string;
  };
}

interface HistoryContextType {
  history: HistoryItem[];
  addHistoryItem: (code: Code, conversationId: string, recipientId: string) => Promise<void>;
  fetchHistory: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
}

import Constants from 'expo-constants'; // Import Constants

// Configure your backend URL here
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

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token, user } = useAuth(); // Use useAuth to get token and user

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    // Only fetch if token is available
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {      
      const response = await fetch(`${BASE_URL}/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Use token for authentication
        },
      });
            
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      let data: HistoryItem[] = await response.json();
      setHistory(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to fetch history:', errorMessage);
      setError(errorMessage);
      
      // Don't fail silently - you might want to show this error to the user
      // For now, just log it and keep an empty history
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const addHistoryItem = async (code: Code, conversationId: string, recipientId: string) => {
    setIsLoading(true);
    setError(null);
    
    // Only add if token is available
    if (!token) {
        setIsLoading(false);
        return;
    }

    try {      
      const response = await fetch(`${BASE_URL}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Use token for authentication
        },
        body: JSON.stringify({ code, conversationId, recipientId }), // Include conversationId and recipientId
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
            
      // After adding, refetch the history to update the UI
      await fetchHistory();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to add history item:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [token]); // Add token to dependency array

  return (
    <HistoryContext.Provider value={{ history, addHistoryItem, fetchHistory, isLoading, error }}>
      {children}
    </HistoryContext.Provider>
  );
}