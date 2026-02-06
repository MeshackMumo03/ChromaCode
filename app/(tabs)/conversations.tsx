import React, { useEffect, useState } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';

const BASE_URL = 'http://172.30.10.196:5000/api';

interface Conversation {
  _id: string;
  participants: {
    _id: string;
    username: string;
  }[];
  lastMessage: {
    text: string;
  };
}

export default function ConversationsScreen() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  useEffect(() => {
    if (token) {
      const fetchConversations = async () => {
        try {
          const response = await fetch(`${BASE_URL}/conversations`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const data = await response.json();
          if (response.ok) {
            setConversations(data);
          } else {
            Alert.alert('Error', 'Failed to fetch conversations.');
          }
        } catch (error) {
          Alert.alert('Error', 'Network error while fetching conversations.');
        }
      };
      fetchConversations();
    }
  }, [token]);

  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find(p => p._id.toString() !== user?._id?.toString());
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedText style={[styles.title, { color: colors.text }]}>Conversations</ThemedText>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => {
          const otherParticipant = getOtherParticipant(item);
          return (
            <TouchableOpacity
              style={[styles.conversationItem, { borderBottomColor: colors.icon }]}
              onPress={() => router.push(`/chat/${item._id}`)}
            >
              <ThemedText style={[styles.username, { color: colors.text }]}>{otherParticipant?.username}</ThemedText>
              <ThemedText style={[styles.lastMessage, { color: colors.icon }]}>{item.lastMessage?.text}</ThemedText>
            </TouchableOpacity>
          );
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  conversationItem: {
    padding: 15,
    borderBottomWidth: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  lastMessage: {
    fontSize: 14,
  },
});
