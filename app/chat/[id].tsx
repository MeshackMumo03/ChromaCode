import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, TextInput, FlatList, Alert, View, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';
import { getBaseUrl } from '@/constants/api'; // Import getBaseUrl
import { StyledButton } from '@/components/StyledButton'; // Import StyledButton
import { io, Socket } from 'socket.io-client';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { useSocket } from '@/hooks/useSocket';

const BASE_URL = getBaseUrl(); // Use the centralized getBaseUrl()
const SOCKET_URL = BASE_URL.replace('/api', '');

import { Image as ExpoImage } from 'expo-image';

interface Message {
  _id: string;
  sender: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  text: string;
  codeId?: {
    _id: string;
    name: string;
    color: string;
    meaning: string;
  };
  timestamp: string;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { token, user } = useAuth();
  const socket = useSocket();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversation, setConversation] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  // Helper to format dates for separators
  const formatDateSeparator = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

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
          const otherParticipant = data.conversation.participants.find((p: any) => p._id !== user?._id);
          
          // Set custom header with avatar
          navigation.setOptions({
            headerTitle: () => (
              <View style={styles.headerTitleContainer}>
                <ExpoImage 
                  source={{ uri: otherParticipant?.profilePicture || 'https://www.gravatar.com/avatar/?d=mp' }} 
                  style={styles.headerAvatar}
                />
                <ThemedText style={styles.headerUsername}>{otherParticipant?.username || 'Chat'}</ThemedText>
              </View>
            ),
          });
        } else {
          Alert.alert('Error', 'Failed to fetch conversation.');
        }
      } catch (error) {
        Alert.alert('Error', 'Network error while fetching conversation.');
      }
    };
    fetchConversation();

    // Socket.io initialization
    if (socket && id) {
      const handleNewMessage = (data: any) => {
        if (data.conversationId === id) {
          setMessages(prev => {
            if (prev.find(m => m._id === data.message._id)) return prev;
            if (data.message.sender._id !== user?._id) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            return [...prev, data.message];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      };

      const handleTyping = (data: any) => {
        if (data.conversationId === id) setIsTyping(true);
      };

      const handleStopTyping = (data: any) => {
        if (data.conversationId === id) setIsTyping(false);
      };

      socket.on('new_message', handleNewMessage);
      socket.on('typing', handleTyping);
      socket.on('stop_typing', handleStopTyping);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('typing', handleTyping);
        socket.off('stop_typing', handleStopTyping);
      };
    }
  }, [id, token, user?._id, socket]);

  const handleTyping = () => {
    if (!socket || !conversation || !user) return;

    const otherParticipant = conversation.participants.find((p: any) => p._id !== user._id);
    if (!otherParticipant) return;

    socket.emit('typing', {
      conversationId: id,
      recipientId: otherParticipant._id,
      senderId: user._id
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', {
        conversationId: id,
        recipientId: otherParticipant._id,
        senderId: user._id
      });
    }, 2000);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !token || !id) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

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
        setMessages(prevMessages => {
          if (prevMessages.find(m => m._id === data._id)) return prevMessages;
          return [...prevMessages, data];
        });
        setNewMessage('');
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (error) {
      console.error('Network error during sending message:', error);
    }
  };
  
  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }} 
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 100}
    >
      <ThemedView style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => {
            const isMyMessage = item.sender._id.toString() === user?._id?.toString();
            const showDateSeparator = index === 0 || 
              new Date(messages[index - 1].timestamp).toDateString() !== new Date(item.timestamp).toDateString();

            return (
              <View>
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <View style={[styles.dateLine, { backgroundColor: colors.icon }]} />
                    <ThemedText style={[styles.dateText, { color: colors.icon, backgroundColor: colors.background }]}>
                      {formatDateSeparator(item.timestamp)}
                    </ThemedText>
                    <View style={[styles.dateLine, { backgroundColor: colors.icon }]} />
                  </View>
                )}
                <View style={[
                  styles.messageWrapper,
                  isMyMessage ? styles.myMessageWrapper : styles.theirMessageWrapper
                ]}>
                  {!isMyMessage && (
                    <ExpoImage 
                      source={{ uri: item.sender.profilePicture || 'https://www.gravatar.com/avatar/?d=mp' }} 
                      style={styles.messageAvatar}
                    />
                  )}
                  <View style={[
                    styles.messageContainer,
                    isMyMessage ? styles.myMessage : styles.theirMessage,
                    { backgroundColor: isMyMessage ? colors.tint : (colorScheme === 'light' ? '#E0E0E0' : colors.icon) }
                  ]}>
                    {item.codeId ? (
                      <View style={styles.richMessageContainer}>
                        <View style={[styles.colorBubble, { backgroundColor: item.codeId.color }]} />
                        <View>
                          <ThemedText style={[
                            styles.codeName,
                            { color: isMyMessage ? (colorScheme === 'light' ? '#fff' : colors.background) : colors.text }
                          ]}>{item.codeId.name}</ThemedText>
                          <ThemedText style={[
                            styles.codeMeaning,
                            { color: isMyMessage ? (colorScheme === 'light' ? '#eee' : colors.icon) : colors.icon }
                          ]}>{item.codeId.meaning}</ThemedText>
                        </View>
                      </View>
                    ) : (
                      <ThemedText style={[
                        styles.messageText,
                        { color: isMyMessage ? (colorScheme === 'light' ? '#fff' : colors.background) : colors.text }
                      ]}>{item.text}</ThemedText>
                    )}
                    <ThemedText style={[styles.timestamp, { color: colors.icon }]}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</ThemedText>
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        
        <SafeAreaView edges={['bottom']} style={{ backgroundColor: colors.background }}>
          {isTyping && (
            <ThemedText style={[styles.typingIndicator, { color: colors.icon }]}>
              Someone is typing...
            </ThemedText>
          )}
          <View style={[styles.inputContainer, { borderTopColor: colors.icon, borderTopWidth: StyleSheet.hairlineWidth }]}>
            <TextInput
              style={[styles.input, { borderColor: colors.icon, backgroundColor: colors.background, color: colors.text }]}
              value={newMessage}
              onChangeText={(text) => {
                setNewMessage(text);
                handleTyping();
              }}
              placeholder="Type a message..."
              placeholderTextColor={colors.icon}
              multiline
            />
            <StyledButton title="Send" onPress={handleSendMessage} style={styles.sendButton} />
          </View>
        </SafeAreaView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#eee',
  },
  headerUsername: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesList: {
    padding: 10,
    paddingBottom: 20,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 5,
  },
  myMessageWrapper: {
    justifyContent: 'flex-end',
  },
  theirMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 2,
    backgroundColor: '#eee',
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  dateLine: {
    flex: 1,
    height: 1,
    opacity: 0.2,
  },
  dateText: {
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    textTransform: 'uppercase',
  },
  typingIndicator: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    fontSize: 12,
    fontStyle: 'italic',
  },
  messageContainer: {
    padding: 10,
    borderRadius: 15,
    marginBottom: 5,
    maxWidth: '85%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  richMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  codeName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  codeMeaning: {
    fontSize: 12,
  },
  timestamp: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 10,
  },
  sendButton: {
    height: 40,
    justifyContent: 'center',
    paddingVertical: 0,
  }
});
