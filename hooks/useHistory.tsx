import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Code } from '@/constants/codes';
import { useAuth } from '@/hooks/useAuth'; // Import useAuth

export interface HistoryItem {
  _id: string;
  code: Code;
  timestamp: string;
  conversationId?: string; // Add conversationId
  recipientUsername?: string; // Add recipientUsername
}

interface HistoryContextType {
  history: HistoryItem[];
  addHistoryItem: (code: Code, conversationId?: string) => Promise<void>;
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
      console.log('Fetching history from:', `${BASE_URL}/history`);
      
      const response = await fetch(`${BASE_URL}/history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Use token for authentication
        },
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      let data: HistoryItem[] = await response.json();
      console.log('Fetched history:', data.length, 'items');

      // For each history item with a conversationId, fetch the recipient's username
      const historyWithRecipients = await Promise.all(data.map(async (item) => {
        if (item.conversationId) {
          try {
            const convoResponse = await fetch(`${BASE_URL}/conversations/${item.conversationId}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (convoResponse.ok) {
              const convoData = await convoResponse.json();
              // Find the other participant
              const otherParticipant = convoData.conversation.participants.find(
                (p: any) => p._id !== user?._id
              );
              return { ...item, recipientUsername: otherParticipant?.username };
            }
          } catch (convoError) {
            console.error('Failed to fetch conversation for history item:', item.conversationId, convoError);
            // Continue without recipientUsername if there's an error
          }
        }
        return item;
      }));

      setHistory(historyWithRecipients);
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

  const addHistoryItem = async (code: Code, conversationId?: string) => {
    setIsLoading(true);
    setError(null);
    
    // Only add if token is available
    if (!token) {
        setIsLoading(false);
        return;
    }

    try {
      console.log('Adding history item:', code.name);
      
      const response = await fetch(`${BASE_URL}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Use token for authentication
        },
        body: JSON.stringify({ code, conversationId }),
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
  }, [token]); // Add token to dependency array

  return (
    <HistoryContext.Provider value={{ history, addHistoryItem, fetchHistory, isLoading, error }}>
      {children}
    </HistoryContext.Provider>
  );
}