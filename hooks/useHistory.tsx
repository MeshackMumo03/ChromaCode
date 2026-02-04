import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Code } from '@/constants/codes';

export interface HistoryItem {
  _id: string;
  code: Code;
  timestamp: string;
}

interface HistoryContextType {
  history: HistoryItem[];
  addHistoryItem: (code: Code) => Promise<void>;
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

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Fetching history from:', `${BASE_URL}/history`);
      
      const response = await fetch(`${BASE_URL}/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: HistoryItem[] = await response.json();
      console.log('Fetched history:', data.length, 'items');
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

  const addHistoryItem = async (code: Code) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Adding history item:', code.name);
      
      const response = await fetch(`${BASE_URL}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      console.log('History item added successfully');
      
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
  }, []);

  return (
    <HistoryContext.Provider value={{ history, addHistoryItem, fetchHistory, isLoading, error }}>
      {children}
    </HistoryContext.Provider>
  );
}