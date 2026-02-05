import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TextInput, Button, FlatList, Alert, View } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

const BASE_URL = 'http://172.30.10.196:5000/api';

interface Message {
  _id: string;
  sender: {
    _id: string;
    username: string;
  };
  text: string;
  timestamp: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const fetchConversation = async () => {
      if (!token || !id) return;
      try {
        const response = await fetch(`${BASE_URL}/conversations/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setConversation(data.conversation);
          setMessages(data.messages);
          const otherParticipant = data.conversation.participants.find(p => p._id !== user?._id);
          navigation.setOptions({ title: otherParticipant?.username || 'Chat' });
        } else {
          Alert.alert('Error', 'Failed to fetch conversation.');
        }
      } catch (error) {
        Alert.alert('Error', 'Network error while fetching conversation.');
      }
    };
    fetchConversation();
  }, [id, token, user]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !token || !id) return;

    try {
      const response = await fetch(`${BASE_URL}/conversations/${id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text: newMessage }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages(prevMessages => [...prevMessages, data]);
        setNewMessage('');
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      } else {
        Alert.alert('Send Failed', data.message || 'Could not send message.');
      }
    } catch (error) {
      console.error('Network error during sending message:', error);
      Alert.alert('Error', 'Network error while sending message.');
    }
  };
  
  return (
    <ThemedView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={[
            styles.messageContainer,
            item.sender._id.toString() === user?._id?.toString() ? styles.myMessage : styles.theirMessage
          ]}>
            <ThemedText style={styles.messageText}>{item.text}</ThemedText>
            <ThemedText style={styles.timestamp}>{new Date(item.timestamp).toLocaleTimeString()}</ThemedText>
          </View>
        )}
        contentContainerStyle={styles.messagesList}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
        />
        <Button title="Send" onPress={handleSendMessage} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  messagesList: {
    padding: 10,
  },
  messageContainer: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#dcf8c6',
    alignSelf: 'flex-end',
  },
  theirMessage: {
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
  },
  timestamp: {
    fontSize: 10,
    color: 'grey',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
});
