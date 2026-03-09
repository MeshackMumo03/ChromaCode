import React, { useCallback, useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, View, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';
import { useConversations, Conversation } from '@/hooks/useConversations';
import { Ionicons } from '@expo/vector-icons';

export default function ConversationsScreen() {
  const { user } = useAuth();
  const { conversations, fetchConversations, isLoading } = useConversations();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
              refreshing={refreshing || isLoading} 
              onRefresh={onRefresh} 
              colors={[colors.tint]} 
              tintColor={colors.tint}
            />
          }
          renderItem={({ item }) => {
            const hasUnread = (item.unreadCount || 0) > 0;
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
