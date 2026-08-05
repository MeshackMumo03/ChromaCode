import React, { useCallback, useState, useMemo } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View, RefreshControl, TextInput } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useConversations, Conversation } from '@/hooks/useConversations';
import { useSocket } from '@/hooks/useSocket';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl, getGroupImageUrl } from '@/constants/api';

export default function ConversationsScreen() {
  const { user } = useAuth();
  const { conversations, fetchConversations, isLoading } = useConversations();
  const socket = useSocket();
  const router = useRouter();
  
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
      socket?.emit('get_online_users');
      const handler = (users: string[]) => setOnlineUsers(users);
      const statusHandler = ({ userId, status }: any) => {
        setOnlineUsers(prev => {
          if (status === 'online' && !prev.includes(userId)) return [...prev, userId];
          if (status === 'offline') return prev.filter(id => id !== userId);
          return prev;
        });
      };
      socket?.on('online_users', handler);
      socket?.on('user_status_change', statusHandler);
      return () => { 
        socket?.off('online_users', handler);
        socket?.off('user_status_change', statusHandler);
      };
    }, [fetchConversations, socket])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.isGroup) return conversation.name;
    const other = conversation.participants.find(p => p._id.toString() !== user?._id?.toString());
    return other?.username || 'Unknown';
  };

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.isGroup) return getGroupImageUrl(conversation.groupImage);
    const other = conversation.participants.find(p => p._id.toString() !== user?._id?.toString());
    return getImageUrl(other?.profilePicture);
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

  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const title = conv.isGroup ? conv.name : conv.participants.find(p => p._id !== user?._id)?.username;
      return title?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [conversations, searchQuery, user?._id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <ThemedText style={[styles.title, { color: colors.text }]}>Chats</ThemedText>
          <TouchableOpacity
            style={[styles.addGroupBtn, { backgroundColor: colors.tint }]}
            onPress={() => router.push('/create-group')}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.icon} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.icon + '15', color: colors.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={colors.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isLoading}
              onRefresh={onRefresh}
              colors={[colors.tint]}
              tintColor={colors.tint}
            />
          }
          renderItem={({ item }) => {
            const hasUnread = (item.unreadCount || 0) > 0;
            const other = !item.isGroup && item.participants.find(p => p._id !== user?._id);
            const isOnline = other && onlineUsers.includes(other._id);
            const otherAvatar = other ? other.profilePicture : undefined;
            
            return (
              <TouchableOpacity
                style={[styles.conversationItem, { borderBottomColor: colors.icon + '20' }]}
                onPress={() => router.push({
                  pathname: `/chat/${item._id}` as any,
                  params: {
                    name: getConversationTitle(item),
                    avatar: getConversationAvatar(item)
                  }
                })}
              >
                <View>
                  <ExpoImage
                    source={{ uri: item.isGroup ? getGroupImageUrl(item.groupImage) : getImageUrl(otherAvatar) }}
                    style={[styles.avatar, { backgroundColor: colors.icon + '10' }]}
                    contentFit="cover"
                  />
                  {isOnline && <View style={styles.onlineDot} />}
                </View>
                <View style={styles.content}>
                  <View style={styles.headerRow}>
                    <ThemedText style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                      {getConversationTitle(item)}
                    </ThemedText>
                    <ThemedText style={[styles.time, { color: hasUnread ? colors.tint : colors.icon, fontWeight: hasUnread ? 'bold' : 'normal' }]}>
                      {formatTime(item.lastMessage?.timestamp || item.updatedAt)}
                    </ThemedText>
                  </View>
                  <ThemedText
                    style={[
                      styles.lastMessage,
                      {
                        color: hasUnread ? colors.text : colors.icon,
                        fontWeight: hasUnread ? 'bold' : 'normal'
                      }
                    ]}
                    numberOfLines={1}
                  >
                    {item.lastMessage?.text || 'No messages yet'}
                  </ThemedText>
                </View>
                {hasUnread && (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.tint }]}>
                    <ThemedText style={styles.unreadText}>{item.unreadCount}</ThemedText>
                  </View>
                )}
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
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 35,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    paddingLeft: 45,
    paddingRight: 15,
    fontSize: 16,
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
    right: 12,
    bottom: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4cd964',
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
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});