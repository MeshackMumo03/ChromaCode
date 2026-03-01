import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Alert, View, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';
import { getBaseUrl } from '@/constants/api';
import { useSocket } from '@/hooks/useSocket';
import { Ionicons } from '@expo/vector-icons';

const BASE_URL = getBaseUrl();

interface Conversation {
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
  };
  updatedAt: string;
  isGroup?: boolean;
  name?: string;
  groupImage?: string;
}

export default function ConversationsScreen() {
  const { token, user } = useAuth();
  const socket = useSocket();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [typingConversations, setTypingConversations] = useState<Record<string, string | null>>({});
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${BASE_URL}/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        // Robust sort by last message timestamp or updatedAt
        const sortedData = data.sort((a: Conversation, b: Conversation) => {
          const getTime = (conv: Conversation) => {
            if (conv.lastMessage?.timestamp) return new Date(conv.lastMessage.timestamp).getTime();
            if (conv.updatedAt) return new Date(conv.updatedAt).getTime();
            return 0;
          };
          return getTime(b) - getTime(a);
        });
        setConversations(sortedData);
      } else {
        console.error('Failed to fetch conversations:', data.message);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [token]);

  // Refresh when tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  useEffect(() => {
    if (socket) {
      const handleNewMessage = (data: any) => {
        const newMessageData = {
          ...data.message,
          timestamp: data.message.timestamp || new Date().toISOString()
        };

        setConversations(prev => {
          const updated = [...prev];
          const index = updated.findIndex(c => c._id === data.conversationId);
          
          if (index !== -1) {
            // Update existing conversation
            updated[index] = {
              ...updated[index],
              lastMessage: newMessageData,
              updatedAt: newMessageData.timestamp
            };
            // Move to top
            const item = updated.splice(index, 1)[0];
            return [item, ...updated];
          } else {
            // New conversation arrived, trigger a full fetch to get participants etc.
            fetchConversations();
            return prev;
          }
        });
      };

      const handleTyping = (data: any) => {
        setTypingConversations(prev => ({ ...prev, [data.conversationId]: data.senderName }));
      };

      const handleStopTyping = (data: any) => {
        setTypingConversations(prev => ({ ...prev, [data.conversationId]: null }));
      };

      const handleStatusChange = (data: { userId: string, status: string }) => {
        setOnlineUsers(prev => ({ ...prev, [data.userId]: data.status === 'online' }));
      };

      socket.on('new_message', handleNewMessage);
      socket.on('typing', handleTyping);
      socket.on('stop_typing', handleStopTyping);
      socket.on('user_status_change', handleStatusChange);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('typing', handleTyping);
        socket.off('stop_typing', handleStopTyping);
        socket.off('user_status_change', handleStatusChange);
      };
    }
  }, [socket, fetchConversations]);

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.isGroup) return conversation.name;
    const other = conversation.participants.find(p => p._id.toString() !== user?._id?.toString());
    return other?.username || 'Unknown';
  };

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.isGroup) return conversation.groupImage || 'https://cdn-icons-png.flaticon.com/512/166/166258.png';
    const other = conversation.participants.find(p => p._id.toString() !== user?._id?.toString());
    return other?.profilePicture || 'https://www.gravatar.com/avatar/?d=mp';
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: colors.text }]}>Chats</ThemedText>
          <TouchableOpacity 
            style={[styles.addGroupBtn, { backgroundColor: colors.tint }]}
            onPress={() => router.push('/create-group')}
          >
            <Ionicons name="people-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={conversations}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={[colors.tint]} 
              tintColor={colors.tint}
            />
          }
          renderItem={({ item }) => {
            const typingName = typingConversations[item._id];
            const otherParticipant = !item.isGroup ? item.participants.find(p => p._id !== user?._id) : null;
            const isOnline = otherParticipant ? onlineUsers[otherParticipant._id] : false;

            return (
              <TouchableOpacity
                style={[styles.conversationItem, { borderBottomColor: colors.icon + '33' }]}
                onPress={() => router.push(`/chat/${item._id}`)}
              >
                <View>
                  <Image 
                    source={{ uri: getConversationAvatar(item) }} 
                    style={styles.avatar} 
                  />
                  {isOnline && <View style={[styles.onlineDot, { backgroundColor: '#4CAF50' }]} />}
                </View>
                <View style={styles.content}>
                  <View style={styles.headerRow}>
                    <ThemedText style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                      {getConversationTitle(item)}
                    </ThemedText>
                    <ThemedText style={[styles.time, { color: typingName ? '#4CAF50' : colors.icon }]}>
                      {typingName ? 'typing...' : formatTime(item.lastMessage?.timestamp || item.updatedAt)}
                    </ThemedText>
                  </View>
                  <ThemedText 
                    style={[
                      styles.lastMessage, 
                      { color: typingName ? '#4CAF50' : colors.icon, fontWeight: typingName ? 'bold' : 'normal' }
                    ]} 
                    numberOfLines={1}
                  >
                    {typingName ? `${typingName} is typing...` : (item.lastMessage?.text || 'No messages yet')}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addGroupBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    alignItems: 'center',
  },
  avatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    marginRight: 15,
    backgroundColor: '#eee',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 15,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 17,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 10,
  },
  time: {
    fontSize: 12,
  },
  lastMessage: {
    fontSize: 14,
  },
});
