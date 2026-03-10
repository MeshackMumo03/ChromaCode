import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useSocket } from './useSocket';
import { getBaseUrl } from '@/constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = getBaseUrl();
const CACHE_KEY_CONVERSATIONS = 'chromacode_cache_conversations';

export interface Conversation {
  _id: string;
  participants: {
    _id: string;
    username: string;
    profilePicture?: string;
  }[];
  lastMessage: {
    text: string;
    timestamp: string;
    sender: any;
    status?: string;
  };
  updatedAt: string;
  isGroup?: boolean;
  name?: string;
  groupImage?: string;
  unreadCount?: number;
}

interface ConversationsContextType {
  conversations: Conversation[];
  totalUnreadCount: number;
  fetchConversations: () => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  isLoading: boolean;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (!context) {
    throw new Error('useConversations must be used within a ConversationsProvider');
  }
  return context;
}

export function ConversationsProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const socket = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load cache on mount
  useEffect(() => {
    const loadCache = async () => {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY_CONVERSATIONS);
        if (cached) {
          setConversations(JSON.parse(cached));
        }
      } catch (e) {
        console.error('Error loading conversations cache:', e);
      }
    };
    loadCache();
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setConversations(data);
        // Save to cache (limit to top 50)
        await AsyncStorage.setItem(CACHE_KEY_CONVERSATIONS, JSON.stringify(data.slice(0, 50)));
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const markAsRead = async (conversationId: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/conversations/${conversationId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        setConversations(prev => {
          const updated = prev.map(conv => 
            conv._id === conversationId ? { ...conv, unreadCount: 0 } : conv
          );
          AsyncStorage.setItem(CACHE_KEY_CONVERSATIONS, JSON.stringify(updated.slice(0, 50)));
          return updated;
        });
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  useEffect(() => {
    if (token) {
      fetchConversations();
    } else {
      setConversations([]);
    }
  }, [token, fetchConversations]);

  useEffect(() => {
    if (socket) {
      const handleNewMessage = (data: any) => {
        setConversations(prev => {
          const updated = [...prev];
          const index = updated.findIndex(c => c._id === data.conversationId);
          
          if (index !== -1) {
            const updatedConv = {
              ...updated[index],
              lastMessage: data.message,
              updatedAt: data.message.timestamp || new Date().toISOString(),
              unreadCount: (updated[index].unreadCount || 0) + (data.message.sender._id !== user?._id ? 1 : 0)
            };
            updated.splice(index, 1);
            const result = [updatedConv, ...updated];
            AsyncStorage.setItem(CACHE_KEY_CONVERSATIONS, JSON.stringify(result.slice(0, 50)));
            return result;
          } else {
            fetchConversations(); // Fetch new conversation
            return prev;
          }
        });
      };

      const handleMessagesRead = (data: any) => {
        setConversations(prev => {
          const updated = prev.map(conv => {
            if (conv._id === data.conversationId) {
              const isMe = data.readerId === user?._id;
              return {
                ...conv,
                unreadCount: isMe ? 0 : conv.unreadCount,
                lastMessage: conv.lastMessage && conv.lastMessage.sender._id !== data.readerId 
                  ? { ...conv.lastMessage, status: 'read' } 
                  : conv.lastMessage
              };
            }
            return conv;
          });
          AsyncStorage.setItem(CACHE_KEY_CONVERSATIONS, JSON.stringify(updated.slice(0, 50)));
          return updated;
        });
      };

      socket.on('new_message', handleNewMessage);
      socket.on('messages_read', handleMessagesRead);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('messages_read', handleMessagesRead);
      };
    }
  }, [socket, user?._id, fetchConversations]);

  const totalUnreadCount = conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);

  return (
    <ConversationsContext.Provider value={{ conversations, totalUnreadCount, fetchConversations, markAsRead, isLoading }}>
      {children}
    </ConversationsContext.Provider>
  );
}
